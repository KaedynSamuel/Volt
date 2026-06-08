import { Resend } from "resend"

export type VoltEmailNotification = {
  to?: string | null
  subject: string
  message: string
  actionUrl?: string
  fromEmail?: string | null
}

export type VoltInAppNotification = {
  companyId: number
  userId: number
  type: "task_created" | "task_assigned" | "ticket_created" | "ticket_assigned" | "ticket_closed" | "ticket_resolved"
  title: string
  message: string
  relatedId?: string | null
}

function buildVoltEmailBody(notification: VoltEmailNotification) {
  return [
    "Volt Application Notification",
    "",
    notification.message,
    notification.actionUrl ? `Open Volt: ${notification.actionUrl}` : "",
    "",
    "This email was sent via Volt Application.",
  ]
    .filter(Boolean)
    .join("\n")
}

export async function sendVoltEmailNotification(notification: VoltEmailNotification) {
  if (!notification.to) return { skipped: true, reason: "Missing recipient email" }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.info("Volt email notification ready (no RESEND_API_KEY):", notification)
    return { queued: true, provider: "console" }
  }

  const resend = new Resend(apiKey)

  // Use the sender's login email as the "from" when domain is registered,
  // otherwise fall back to the configured default / onboarding address.
  const defaultFrom = process.env.VOLT_EMAIL_FROM || "Volt <no-reply@volt.app>"
  const fromEmail = notification.fromEmail
    ? `${notification.fromEmail.split("@")[0]} via Volt <${notification.fromEmail}>`
    : defaultFrom

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: notification.to,
    subject: notification.subject,
    text: buildVoltEmailBody(notification),
  })

  if (error) {
    throw new Error(`Resend error: ${error.message}`)
  }

  return { sent: true }
}

import sql from "mssql"

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
    console.warn("Volt in-app notification could not be saved:", err)
  }
}

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
        FROM dbo.DashboardUsers
        WHERE id = @user_id
      `)
    const email = result.recordset?.[0]?.email
    return typeof email === "string" && email.trim() ? email.trim() : null
  } catch {
    return null
  }
}

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
    senderEmail,
  }: VoltInAppNotification & { actionUrl?: string; senderEmail?: string },
) {
  await saveInAppNotification(pool, { companyId, userId, type, title, message, relatedId })

  const email = await getUserEmail(pool, userId, companyId)
  if (email) {
    await sendVoltEmailNotification({
      to: email,
      subject: title,
      message,
      actionUrl,
      fromEmail: senderEmail,
    }).catch(() => {})
  }
}
