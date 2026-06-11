import { NextResponse } from "next/server"
import { sendVoltEmailNotification } from "@/lib/server/volt-notifications"

const BLOCKED_DOMAINS = [
  "tempmail.com","mailinator.com","guerrillamail.com","throwaway.email",
  "yopmail.com","dispostable.com","fakeinbox.com","maildrop.cc",
]
const BLOCKED_PATTERNS = [
  /\bpassword\b/i, /\bpin\b/i, /\bcredit.?card\b/i,
  /\bsocial.?security\b/i, /\bssn\b/i, /\baccount.?number\b/i,
]
const MAX_RECIPIENTS = 10
const MAX_BODY_CHARS = 5000

function isValidEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) }
function isBlockedDomain(e: string) { return BLOCKED_DOMAINS.includes(e.split("@")[1]?.toLowerCase() || "") }
function hasSensitiveContent(text: string) { return BLOCKED_PATTERNS.some((p) => p.test(text)) }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { to, cc = [], subject, body: emailBody, priority, senderUserId, companyId } = body

    // Server-side validation (mirrors client checks)
    if (!Array.isArray(to) || to.length === 0) {
      return NextResponse.json({ error: "At least one recipient is required" }, { status: 400 })
    }

    const allRecipients: string[] = [...to, ...cc]

    if (allRecipients.length > MAX_RECIPIENTS) {
      return NextResponse.json({ error: `Too many recipients (max ${MAX_RECIPIENTS})` }, { status: 400 })
    }

    for (const email of allRecipients) {
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: `Invalid email address: ${email}` }, { status: 400 })
      }
      if (isBlockedDomain(email)) {
        return NextResponse.json({ error: `Disposable email address blocked: ${email}` }, { status: 400 })
      }
    }

    if (!subject?.trim()) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 })
    }

    if (!emailBody || emailBody.length > MAX_BODY_CHARS) {
      return NextResponse.json({ error: `Body must be between 1 and ${MAX_BODY_CHARS} characters` }, { status: 400 })
    }

    if (hasSensitiveContent(emailBody) || hasSensitiveContent(subject)) {
      // Log but do not block — warn was shown client-side; server logs the event
      console.warn(`[EmailV] Sensitive content detected in email from user ${senderUserId} (company ${companyId})`)
    }

    // Log every send attempt server-side for audit trail
    console.info(`[EmailV] Send: from userId=${senderUserId} companyId=${companyId} to=${to.join(",")} subject="${subject}" priority=${priority}`)

    // Send to each recipient
    await Promise.all(
      to.map((recipient: string) =>
        sendVoltEmailNotification({
          to: recipient,
          subject: priority === "high" ? `[HIGH PRIORITY] ${subject}` : subject,
          message: emailBody,
        }),
      ),
    )

    // CC recipients
    if (cc.length > 0) {
      await Promise.all(
        cc.map((recipient: string) =>
          sendVoltEmailNotification({
            to: recipient,
            subject: `[CC] ${subject}`,
            message: emailBody,
          }),
        ),
      )
    }

    return NextResponse.json({ ok: true, sentTo: allRecipients.length })
  } catch (error) {
    console.error("[EmailV] Send failed:", error)
    return NextResponse.json(
      { error: "Email could not be sent. Check server configuration." },
      { status: 500 },
    )
  }
}
