import { NextResponse } from "next/server"
import { sendVoltEmailNotification, getUserEmail, getUserFullName } from "@/lib/server/volt-notifications"
import { getDbPool } from "@/lib/server/volt-schema"

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
      console.warn(`[EmailV] Sensitive content detected in email from user ${senderUserId} (company ${companyId})`)
    }

    // Look up the sender's email and name so recipients can reply directly to them
    let fromEmail: string | null = null
    let fromName: string | null = null
    if (senderUserId && companyId) {
      try {
        const pool = await getDbPool()
        fromEmail = await getUserEmail(pool, Number(senderUserId), Number(companyId))
        fromName = await getUserFullName(pool, Number(senderUserId), Number(companyId))
      } catch {
        // Non-fatal — proceed without sender info
      }
    }

    console.info(`[EmailV] Send: from userId=${senderUserId} (${fromEmail || "unknown"}) companyId=${companyId} to=${to.join(",")} subject="${subject}" priority=${priority}`)

    // Send to each recipient
    await Promise.all(
      to.map((recipient: string) =>
        sendVoltEmailNotification({
          to: recipient,
          subject: priority === "high" ? `[HIGH PRIORITY] ${subject}` : subject,
          message: emailBody,
          fromEmail,
          fromName,
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
            fromEmail,
            fromName,
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
