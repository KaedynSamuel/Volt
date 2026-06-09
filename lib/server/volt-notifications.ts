import sql from "mssql"

export type VoltEmailNotification = {
  to?: string | null
  subject: string
  message: string
  actionUrl?: string
  /** Optional: the sender's email address (becomes the Reply-To and display From name). */
  fromEmail?: string | null
  /** Optional: the sender's display name. */
  fromName?: string | null
}

export type VoltInAppNotification = {
  companyId: number
  userId: number
  type: "task_created" | "task_assigned" | "ticket_created" | "ticket_assigned" | "ticket_closed" | "ticket_resolved"
  title: string
  message: string
  relatedId?: string | null
}

function buildVoltEmailHtml(notification: VoltEmailNotification) {
  const safeMessage = notification.message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")

  const actionBlock = notification.actionUrl
    ? `<p style="margin-top:20px"><a href="${notification.actionUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Open in Volt</a></p>`
    : ""

  const senderBlock = notification.fromEmail
    ? `<p style="color:#94a3b8;font-size:12px;margin-top:24px">Sent by ${notification.fromName || notification.fromEmail} via Volt</p>`
    : ""

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:32px">
    <div style="max-width:560px;margin:0 auto;background:#1e293b;border-radius:12px;padding:28px;border:1px solid #334155">
      <h2 style="margin:0 0 16px;color:#f8fafc">${notification.subject}</h2>
      <p style="line-height:1.6;color:#cbd5e1">${safeMessage}</p>
      ${actionBlock}
      ${senderBlock}
      <hr style="border-color:#334155;margin-top:28px">
      <p style="color:#475569;font-size:11px;margin:12px 0 0">This notification was sent by Volt Application.</p>
    </div>
  </body></html>`
}

function buildVoltEmailText(notification: VoltEmailNotification) {
  return [
    "Volt Application Notification",
    "",
    notification.message,
    notification.actionUrl ? `Open Volt: ${notification.actionUrl}` : "",
    notification.fromEmail ? `Sent by: ${notification.fromName || notification.fromEmail}` : "",
    "",
    "This email was sent by Volt Application.",
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * Send an email notification via Resend.
 * Set RESEND_API_KEY in your environment variables.
 * Set VOLT_EMAIL_FROM to your verified sender domain address (e.g. "Volt <no-reply@yourdomain.com>").
 *
 * When fromEmail is provided (the logged-in user's email), it is used as Reply-To so
 * replies go back to the sender, and the display name shows who sent it.
 */
export async function sendVoltEmailNotification(notification: VoltEmailNotification) {
  if (!notification.to) return { skipped: true, reason: "Missing recipient email" }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.info("Volt email notification ready (RESEND_API_KEY not set):", {
      to: notification.to,
      subject: notification.subject,
    })
    return { queued: true, provider: "console" }
  }

  // The verified "from" address must match your Resend-verified domain.
  // If the sender has a custom email we use it as reply-to so replies go to them.
  const fromAddress = process.env.VOLT_EMAIL_FROM || "Volt <no-reply@volt.app>"

  const payload: Record<string, unknown> = {
    from: fromAddress,
    to: [notification.to],
    subject: notification.subject,
    text: buildVoltEmailText(notification),
    html: buildVoltEmailHtml(notification),
  }

  // If the sending user's email is known, add it as reply-to so recipients
  // can reply directly to the person who triggered the notification.
  if (notification.fromEmail) {
    const replyToName = notification.fromName
      ? `${notification.fromName} <${notification.fromEmail}>`
      : notification.fromEmail
    payload.reply_to = replyToName
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => "")
    throw new Error(`Resend API error ${response.status}: ${errBody}`)
  }

  const data = await response.json().catch(() => ({}))
  console.info(`[Volt Email] Sent via Resend to ${notification.to}, id=${data.id}`)
  return { sent: true, id: data.id }
}

/**
 * Save an in-app notification to the database.
 * Silently swallows errors so it never blocks a main operation.
 */
export async function saveInAppNotification(
  pool: sql.ConnectionPool,
  notification: VoltInAppNotification,
) {
  try {
    await pool
      .request()
      .input("company_id", sql.Int, notification.companyId)
      .input("user_id", sql.Int, notification.userId)
      .input("type", sql.NVarChar(50), notification.type)
      .input("title", sql.NVarChar(255), notification.title)
      .input("message", sql.NVarChar(1000), notification.message)
      .input("related_id", sql.NVarChar(100), notification.relatedId ?? null)
      .query(`
        INSERT INTO dbo.VoltNotifications
          (company_id, user_id, type, title, message, related_id)
        VALUES
          (@company_id, @user_id, @type, @title, @message, @related_id)
      `)
  } catch (err) {
    // Table may not exist yet — log and continue.
    console.warn("Volt in-app notification could not be saved:", err)
  }
}

/**
 * Look up the email address for a user given their userId and companyId.
 * Returns null if not found.
 */
export async function getUserEmail(
  pool: sql.ConnectionPool,
  userId: number,
  companyId: number,
): Promise<string | null> {
  try {
    const result = await pool
      .request()
      .input("user_id", sql.Int, userId)
      .input("company_id", sql.Int, companyId)
      .query(`
        SELECT TOP 1 email
        FROM dbo.AppUsers
        WHERE id = @user_id AND company_id = @company_id
      `)
    const email = result.recordset?.[0]?.email
    return typeof email === "string" && email.trim() ? email.trim() : null
  } catch {
    return null
  }
}

/**
 * Look up a user's full name for a given userId and companyId.
 * Returns null if not found.
 */
export async function getUserFullName(
  pool: sql.ConnectionPool,
  userId: number,
  companyId: number,
): Promise<string | null> {
  try {
    const result = await pool
      .request()
      .input("user_id", sql.Int, userId)
      .input("company_id", sql.Int, companyId)
      .query(`
        SELECT TOP 1 full_name
        FROM dbo.AppUsers
        WHERE id = @user_id AND company_id = @company_id
      `)
    const name = result.recordset?.[0]?.full_name
    return typeof name === "string" && name.trim() ? name.trim() : null
  } catch {
    return null
  }
}

/**
 * Send a notification both in-app and via email.
 * The email is sent to the email address registered for the userId/companyId pair.
 * If the email cannot be found or the email provider is not configured, only the in-app notification is saved.
 */
export async function notifyUser(
  pool: sql.ConnectionPool,
  {
    companyId,
    userId,
    type,
    title,
    message,
    relatedId,
    actionUrl,
    fromEmail,
    fromName,
  }: VoltInAppNotification & { actionUrl?: string; fromEmail?: string | null; fromName?: string | null },
) {
  // Save in-app notification
  await saveInAppNotification(pool, { companyId, userId, type, title, message, relatedId })

  // Send email notification
  const email = await getUserEmail(pool, userId, companyId)
  if (email) {
    await sendVoltEmailNotification({ to: email, subject: title, message, actionUrl, fromEmail, fromName }).catch(() => {})
  }
}
