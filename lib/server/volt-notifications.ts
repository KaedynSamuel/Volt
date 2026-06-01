import sql from "mssql"

export type VoltEmailNotification = {
  to?: string | null
  subject: string
  message: string
  actionUrl?: string
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
    "This email was sent by Volt Application.",
  ]
    .filter(Boolean)
    .join("\n")
}

export async function sendVoltEmailNotification(notification: VoltEmailNotification) {
  if (!notification.to) return { skipped: true, reason: "Missing recipient email" }

  const payload = {
    from: process.env.VOLT_EMAIL_FROM || "Volt Application <no-reply@volt.local>",
    to: notification.to,
    subject: notification.subject,
    text: buildVoltEmailBody(notification),
  }

  // Hook point for your real email provider. Set VOLT_EMAIL_WEBHOOK_URL to an internal
  // API/automation endpoint when you are ready to send real emails from Volt.
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

    return { sent: true }
  }

  console.info("Volt email notification ready:", payload)
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
