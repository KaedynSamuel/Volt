import { NextResponse } from "next/server"
import sql from "mssql"
import { sendVoltEmailNotification, saveInAppNotification } from "@/lib/server/volt-notifications"

const dbConfig: sql.config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER as string,
  database: process.env.SQL_DATABASE,
  port: Number(process.env.SQL_PORT || 1433),
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
}

function getCompanyId(request: Request) {
  const url = new URL(request.url)
  return Number(url.searchParams.get("companyId") || request.headers.get("x-company-id") || 0)
}

async function getUserEmail(pool: sql.ConnectionPool, companyId: number, userId: number | null) {
  if (!userId) return null
  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT TOP 1 email, full_name AS fullName
      FROM dbo.AppUsers
      WHERE company_id = @company_id
        AND id = @user_id
        AND status = 'active'
    `)
  return result.recordset[0] || null
}

async function getTicketById(pool: sql.ConnectionPool, companyId: number, dbId: number) {
  const result = await pool
    .request()
    .input("id", sql.Int, dbId)
    .input("company_id", sql.Int, companyId)
    .query(`
      SELECT
        id,
        company_id,
        title,
        assignee_user_id,
        assignee_name,
        reporter_user_id,
        reporter_name
      FROM dbo.Tickets
      WHERE id = @id
        AND company_id = @company_id
    `)

  return result.recordset[0] || null
}

// POST /api/tickets/remind — sends a reminder to the assignee of a ticket
// Body: { dbId: number, fromUserId?: number, fromName?: string }
export async function POST(request: Request) {
  try {
    const companyId = getCompanyId(request)
    const body = await request.json().catch(() => ({}))
    const dbId = Number(body.dbId || body.id || 0)
    const fromName = String(body.fromName || "A teammate").trim()

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 })
    }

    if (!dbId) {
      return NextResponse.json({ error: "Ticket id is required" }, { status: 400 })
    }

    const pool = await sql.connect(dbConfig)
    const ticket = await getTicketById(pool, companyId, dbId)

    if (!ticket) {
      return NextResponse.json({ error: "Ticket was not found." }, { status: 404 })
    }

    const assigneeId = Number(ticket.assignee_user_id || 0)

    if (!assigneeId) {
      return NextResponse.json(
        { error: "This ticket doesn't have anyone assigned yet, so a reminder can't be sent." },
        { status: 400 },
      )
    }

    const assignee = await getUserEmail(pool, companyId, assigneeId)
    const title = `Reminder: ${ticket.title}`
    const message = `${fromName} sent you a reminder about the ticket "${ticket.title}". It's still waiting on you.`

    await saveInAppNotification(pool, {
      companyId,
      userId: assigneeId,
      type: "ticket_reminder",
      title,
      message,
      relatedId: String(ticket.id),
    })

    await sendVoltEmailNotification({
      to: assignee?.email || null,
      subject: title,
      message,
      actionUrl: "/tickets",
    })

    return NextResponse.json({ ok: true, remindedUserId: assigneeId })
  } catch (err) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 })
  }
}
