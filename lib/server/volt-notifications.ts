import sql from "mssql"
import nodemailer from "nodemailer"

export type VoltEmailNotification = {
  to?: string | null
  subject: string
  message: string
  actionUrl?: string
}

export type VoltInAppNotification = {
  companyId: number
  userId: number
  type: "task_created" | "task_assigned" | "ticket_created" | "ticket_assigned" | "ticket_closed" | "ticket_resolved" | "ticket_reminder"
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
    "This email was sent by Volt Application.",
  ]
    .filter(Boolean)
    .join("\n")
}

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null

/**
 * Builds (and caches) an SMTP transporter from environment variables.
 *
 * Works with:
 *  - Microsoft 365 / Outlook: smtp.office365.com : 587 (STARTTLS)
 *  - Google Workspace / Gmail: smtp.gmail.com : 587 (STARTTLS, use an App Password)
 *  - Azure Communication Services SMTP relay, SendGrid, Mailgun, etc.
 *
 * Set these in your hosting environment (e.g. Azure App Service > Configuration):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, VOLT_EMAIL_FROM
 *   SMTP_SECURE=true if using port 465 (implicit TLS)
 */
function getSmtpTransporter() {
  if (cachedTransporter) return cachedTransporter
  if (!process.env.SMTP_HOST) return null

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        }
      : undefined,
  })

  return cachedTransporter
}

export async function sendVoltEmailNotification(notification: VoltEmailNotification) {
  if (!notification.to) return { skipped: true, reason: "Missing recipient email" }

  const payload = {
    from: process.env.VOLT_EMAIL_FROM || "Volt Application <no-reply@volt.local>",
    to: notification.to,
    subject: notification.subject,
    text: buildVoltEmailBody(notification),
  }

  // Option 1: SMTP (recommended) — Microsoft 365, Google Workspace, Azure Communication
  // Services, or any other SMTP relay. Configure SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD.
  const transporter = getSmtpTransporter()
  if (transporter) {
    try {
      await transporter.sendMail(payload)
      return { sent: true, provider: "smtp" }
    } catch (error) {
      console.error("Volt SMTP email send failed:", error)
      throw new Error("Volt email could not be sent via SMTP. Check SMTP_* configuration.")
    }
  }

  // Option 2: Custom webhook/automation endpoint. Set VOLT_EMAIL_WEBHOOK_URL to an
  // internal API/automation endpoint when you are ready to send real emails from Volt.
  if (process.env.VOLT_EMAIL_WEBHOOK_URL) {
    const response = await fetch(process.env.VOLT_EMAIL_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.VOLT_EMAIL_WEBHOOK_SECRET
          ? { Authorization: `Bearer ${process.env.VOLT_EMAIL_WEBHOOK_SECRET}` }
          : {}),
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Volt email webhook failed with status ${response.status}`)
    }

    return { sent: true, provider: "webhook" }
  }

  // Option 3: No email provider configured — log so the message isn't silently lost.
  console.info("Volt email notification ready (no SMTP_HOST or VOLT_EMAIL_WEBHOOK_URL configured):", payload)
  return { queued: true, provider: "console" }
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
        FROM dbo.DashboardUsers
        WHERE id = @user_id
      `)
    const email = result.recordset?.[0]?.email
    return typeof email === "string" && email.trim() ? email.trim() : null
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
  }: VoltInAppNotification & { actionUrl?: string },
) {
  // Save in-app notification
  await saveInAppNotification(pool, { companyId, userId, type, title, message, relatedId })

  // Send email notification
  const email = await getUserEmail(pool, userId, companyId)
  if (email) {
    await sendVoltEmailNotification({ to: email, subject: title, message, actionUrl }).catch(() => {})
  }
}
