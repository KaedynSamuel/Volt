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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error || "Unknown error")
}

type TicketStatus = "open" | "in-progress" | "resolved" | "closed"
type TicketPriority = "low" | "medium" | "high" | "critical"

function getCompanyId(request: Request) {
  const url = new URL(request.url)

  return Number(
    url.searchParams.get("companyId") ||
      request.headers.get("x-company-id") ||
      0,
  )
}

function normalizeStatus(status: string): TicketStatus {
  const value = String(status || "").toLowerCase().trim()

  if (value === "open") return "open"

  if (
    value === "in-progress" ||
    value === "in progress" ||
    value === "progress"
  ) {
    return "in-progress"
  }

  if (value === "resolved" || value === "resolve") return "resolved"
  if (value === "closed" || value === "close") return "closed"

  return "open"
}

function normalizePriority(priority: string): TicketPriority {
  const value = String(priority || "").toLowerCase().trim()

  if (value === "low") return "low"
  if (value === "medium") return "medium"
  if (value === "high") return "high"
  if (value === "critical") return "critical"

  return "medium"
}

function getInitials(name?: string | null) {
  if (!name) return "U"

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function formatDate(value: Date | string | null) {
  if (!value) return ""

  const date = new Date(value)
  const now = new Date()

  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return "Just now"
  if (diffMinutes < 60) return `${diffMinutes} min ago`

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`
  }

  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`
  }

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function normalizeTags(tags: unknown) {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => String(tag).trim())
      .filter(Boolean)
  }

  if (typeof tags === "string") {
    const trimmed = tags.trim()

    if (!trimmed) return []

    try {
      const parsed = JSON.parse(trimmed)

      if (Array.isArray(parsed)) {
        return parsed
          .map((tag) => String(tag).trim())
          .filter(Boolean)
      }
    } catch {
      // Fall back to comma separated tags below.
    }

    return trimmed
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  }

  return []
}

function tagsToStorage(tags: unknown) {
  const normalizedTags = normalizeTags(tags)

  return normalizedTags.length ? JSON.stringify(normalizedTags) : null
}


async function getUserEmail(pool: sql.ConnectionPool, companyId: number, userId: number | null) {
  if (!userId) return null
  const result = await pool.request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT TOP 1 email
      FROM dbo.AppUsers
      WHERE company_id = @company_id
        AND id = @user_id
        AND status = 'active'
    `)
  return result.recordset[0]?.email || null
}

async function notifyTicketCreated(pool: sql.ConnectionPool, companyId: number, ticket: any) {
  try {
    const assigneeId = Number(ticket.assigneeUserId || ticket.assignedToUserId || 0)
    const email = await getUserEmail(pool, companyId, assigneeId)
    await sendVoltEmailNotification({
      to: email,
      subject: `New Volt ticket assigned: ${ticket.title}`,
      message: `A new ticket has been created for you in Volt: ${ticket.title}. Priority: ${ticket.priority}.`,
      actionUrl: "/tickets",
    })
    if (assigneeId) {
      await saveInAppNotification(pool, {
        companyId,
        userId: assigneeId,
        type: "ticket_assigned",
        title: `Ticket assigned: ${ticket.title}`,
        message: `A new ticket has been assigned to you. Priority: ${ticket.priority}.`,
        relatedId: String(ticket.dbId || ticket.id),
      })
    }
  } catch (error) {
    console.error("Volt ticket email notification failed:", error)
  }
}

async function notifyTicketStatusChanged(
  pool: sql.ConnectionPool,
  companyId: number,
  ticket: any,
  newStatus: string,
) {
  try {
    const assigneeId = Number(ticket.assigneeUserId || ticket.assignee_user_id || 0)
    const reporterId = Number(ticket.reporterUserId || ticket.reporter_user_id || 0)
    const notifyIds = [...new Set([assigneeId, reporterId].filter(Boolean))]

    if (!notifyIds.length) return

    const type = newStatus === "closed" ? "ticket_closed" : "ticket_resolved"
    const title = newStatus === "closed"
      ? `Ticket closed: ${ticket.title}`
      : `Ticket resolved: ${ticket.title}`
    const message = newStatus === "closed"
      ? `The ticket "${ticket.title}" has been closed.`
      : `The ticket "${ticket.title}" has been marked as resolved.`

    await Promise.all(
      notifyIds.map(async (userId) => {
        const email = await getUserEmail(pool, companyId, userId)
        await sendVoltEmailNotification({
          to: email,
          subject: title,
          message,
          actionUrl: "/tickets",
        })
        await saveInAppNotification(pool, {
          companyId,
          userId,
          type,
          title,
          message,
          relatedId: String(ticket.dbId || ticket.id),
        })
      }),
    )
  } catch (error) {
    console.error("Volt ticket status notification failed:", error)
  }
}

function formatTicket(row: any) {
  const assigneeName = row.assignee_name as string | null
  const reporterName = row.reporter_name || "Unknown"
  const tags = normalizeTags(row.tags)

  return {
    id: `TKT-${String(row.id).padStart(3, "0")}`,
    dbId: row.id,
    companyId: row.company_id,
    title: row.title,
    description: row.description || "",
    status: normalizeStatus(row.status),
    priority: normalizePriority(row.priority),

    assigneeUserId: row.assignee_user_id || null,
    assignedToUserId: row.assignee_user_id || null,
    reporterUserId: row.reporter_user_id || null,
    createdByUserId: row.reporter_user_id || null,

    tags,
    resolutionReason: row.resolution_reason || "",
    resolvedReason: row.resolution_reason || "",
    resolvedAtRaw: row.resolved_at,
    closedAtRaw: row.closed_at,
    dueDate: row.due_date,
    dueDateRaw: row.due_date,
    createdAtRaw: row.created_at,
    updatedAtRaw: row.updated_at,

    assignee: assigneeName
      ? {
          id: row.assignee_user_id || null,
          name: assigneeName,
          fullName: assigneeName,
          initials: getInitials(assigneeName),
        }
      : undefined,

    reporter: {
      id: row.reporter_user_id || null,
      name: reporterName,
      fullName: reporterName,
      initials: getInitials(reporterName),
    },

    createdAt: formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at),
    resolvedAt: formatDate(row.resolved_at),
    closedAt: formatDate(row.closed_at),
    dueDateFormatted: formatDate(row.due_date),
    comments: row.comments || 0,
  }
}

async function ensureTicketsTable(pool: sql.ConnectionPool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.Tickets', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Tickets (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        company_id INT NOT NULL,
        title NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX) NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'open',
        priority NVARCHAR(50) NOT NULL DEFAULT 'medium',
        assignee_name NVARCHAR(255) NULL,
        reporter_name NVARCHAR(255) NULL,
        comments INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE()
      );
    END
  `)
}

async function addTicketColumnIfMissing(
  pool: sql.ConnectionPool,
  columnName: string,
  definition: string,
) {
  await pool
    .request()
    .input("column_name", sql.NVarChar, columnName)
    .query(`
      IF NOT EXISTS (
        SELECT 1
        FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.Tickets')
          AND name = @column_name
      )
      BEGIN
        EXEC('ALTER TABLE dbo.Tickets ADD ${columnName} ${definition}')
      END
    `)
}

async function ensureTicketEnhancements(pool: sql.ConnectionPool) {
  await ensureTicketsTable(pool)

  await addTicketColumnIfMissing(pool, "assignee_user_id", "INT NULL")
  await addTicketColumnIfMissing(pool, "reporter_user_id", "INT NULL")
  await addTicketColumnIfMissing(pool, "tags", "NVARCHAR(MAX) NULL")
  await addTicketColumnIfMissing(pool, "resolution_reason", "NVARCHAR(MAX) NULL")
  await addTicketColumnIfMissing(pool, "resolved_at", "DATETIME NULL")
  await addTicketColumnIfMissing(pool, "closed_at", "DATETIME NULL")
  await addTicketColumnIfMissing(pool, "due_date", "DATETIME NULL")
}


async function getTicketById(
  pool: sql.ConnectionPool,
  companyId: number,
  dbId: number,
) {
  const result = await pool
    .request()
    .input("id", sql.Int, dbId)
    .input("company_id", sql.Int, companyId)
    .query(`
      SELECT
        id,
        company_id,
        title,
        description,
        status,
        priority,
        assignee_name,
        assignee_user_id,
        reporter_name,
        reporter_user_id,
        tags,
        resolution_reason,
        resolved_at,
        closed_at,
        due_date,
        comments,
        created_at,
        updated_at
      FROM dbo.Tickets
      WHERE id = @id
        AND company_id = @company_id
    `)

  return result.recordset[0] || null
}

export async function GET(request: Request) {
  try {
    const companyId = getCompanyId(request)

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 },
      )
    }

    const pool = await sql.connect(dbConfig)
    await ensureTicketEnhancements(pool)

    const result = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .query(`
        SELECT
          id,
          company_id,
          title,
          description,
          status,
          priority,
          assignee_name,
          assignee_user_id,
          reporter_name,
          reporter_user_id,
          tags,
          resolution_reason,
          resolved_at,
          closed_at,
          due_date,
          comments,
          created_at,
          updated_at
        FROM dbo.Tickets
        WHERE company_id = @company_id
        ORDER BY updated_at DESC
      `)

    const tickets = result.recordset.map(formatTicket)

    return NextResponse.json(tickets)
  } catch (error) {
    console.error("Failed to load tickets:", error)

    return NextResponse.json(
      {
        error: "Failed to load tickets from database",
        details: getErrorMessage(error),
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const companyId = getCompanyId(request)
    const body = await request.json()

    const {
      title,
      description,
      priority,
      assigneeName,
      reporterName,
      tags,
      dueDate,
    } = body

    const assigneeUserId = Number(
      body.assigneeUserId || body.assignedToUserId || 0,
    )

    const reporterUserId = Number(
      body.reporterUserId || body.createdByUserId || 0,
    )

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 },
      )
    }

    if (!title || !String(title).trim()) {
      return NextResponse.json(
        { error: "Ticket title is required" },
        { status: 400 },
      )
    }

    if (!assigneeName && !assigneeUserId) {
      return NextResponse.json(
        { error: "Please select one user to send this ticket to." },
        { status: 400 },
      )
    }

    const pool = await sql.connect(dbConfig)
    await ensureTicketEnhancements(pool)

    const result = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("title", sql.NVarChar, String(title).trim())
      .input("description", sql.NVarChar, description || "")
      .input("status", sql.NVarChar, "open")
      .input("priority", sql.NVarChar, normalizePriority(priority))
      .input("assignee_name", sql.NVarChar, assigneeName || null)
      .input("assignee_user_id", sql.Int, assigneeUserId || null)
      .input("reporter_name", sql.NVarChar, reporterName || "Unknown")
      .input("reporter_user_id", sql.Int, reporterUserId || null)
      .input("tags", sql.NVarChar, tagsToStorage(tags))
      .input("due_date", sql.DateTime, dueDate ? new Date(dueDate) : null)
      .query(`
        INSERT INTO dbo.Tickets (
          company_id,
          title,
          description,
          status,
          priority,
          assignee_name,
          assignee_user_id,
          reporter_name,
          reporter_user_id,
          tags,
          due_date,
          comments,
          created_at,
          updated_at
        )
        OUTPUT
          inserted.id,
          inserted.company_id,
          inserted.title,
          inserted.description,
          inserted.status,
          inserted.priority,
          inserted.assignee_name,
          inserted.assignee_user_id,
          inserted.reporter_name,
          inserted.reporter_user_id,
          inserted.tags,
          inserted.resolution_reason,
          inserted.resolved_at,
          inserted.closed_at,
          inserted.due_date,
          inserted.comments,
          inserted.created_at,
          inserted.updated_at
        VALUES (
          @company_id,
          @title,
          @description,
          @status,
          @priority,
          @assignee_name,
          @assignee_user_id,
          @reporter_name,
          @reporter_user_id,
          @tags,
          @due_date,
          0,
          GETDATE(),
          GETDATE()
        )
      `)

    const newTicket = formatTicket(result.recordset[0])

    await notifyTicketCreated(pool, companyId, newTicket)

    return NextResponse.json(newTicket, { status: 201 })
  } catch (error) {
    console.error("Failed to create ticket:", error)

    return NextResponse.json(
      {
        error: "Failed to create ticket",
        details: getErrorMessage(error),
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const companyId = getCompanyId(request)
    const body = await request.json()
    const dbId = Number(body.dbId || body.id || 0)
    const hasStatus = typeof body.status === "string" && body.status.trim()
    const normalizedStatus = hasStatus ? normalizeStatus(body.status) : null

    const resolutionReason = String(
      body.resolutionReason || body.resolvedReason || "",
    ).trim()

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 },
      )
    }

    if (!dbId) {
      return NextResponse.json(
        { error: "Ticket id is required" },
        { status: 400 },
      )
    }

    const pool = await sql.connect(dbConfig)
    await ensureTicketEnhancements(pool)

    if (
      (normalizedStatus === "resolved" || normalizedStatus === "closed") &&
      !resolutionReason
    ) {
      return NextResponse.json(
        {
          error:
            "Please add a reason or explain how the ticket was solved before closing it.",
        },
        { status: 400 },
      )
    }

    const existingTicket = await getTicketById(pool, companyId, dbId)

    if (!existingTicket) {
      return NextResponse.json(
        { error: "Ticket was not found." },
        { status: 404 },
      )
    }

    const nextStatus = normalizedStatus || normalizeStatus(existingTicket.status)
    const nextPriority =
      body.priority !== undefined
        ? normalizePriority(body.priority)
        : normalizePriority(existingTicket.priority)

    const nextTags =
      body.tags !== undefined ? tagsToStorage(body.tags) : existingTicket.tags

    const nextDueDate =
      body.dueDate !== undefined || body.due_date !== undefined
        ? body.dueDate || body.due_date
          ? new Date(body.dueDate || body.due_date)
          : null
        : existingTicket.due_date

    const nextAssigneeUserId =
      body.assigneeUserId !== undefined || body.assignedToUserId !== undefined
        ? Number(body.assigneeUserId || body.assignedToUserId || 0) || null
        : existingTicket.assignee_user_id

    const nextReporterUserId =
      body.reporterUserId !== undefined || body.createdByUserId !== undefined
        ? Number(body.reporterUserId || body.createdByUserId || 0) || null
        : existingTicket.reporter_user_id

    const nextResolutionReason =
      resolutionReason || existingTicket.resolution_reason || null

    const result = await pool
      .request()
      .input("id", sql.Int, dbId)
      .input("company_id", sql.Int, companyId)
      .input(
        "title",
        sql.NVarChar,
        body.title !== undefined ? String(body.title).trim() : existingTicket.title,
      )
      .input(
        "description",
        sql.NVarChar,
        body.description !== undefined
          ? String(body.description || "")
          : existingTicket.description || "",
      )
      .input("status", sql.NVarChar, nextStatus)
      .input("priority", sql.NVarChar, nextPriority)
      .input(
        "assignee_name",
        sql.NVarChar,
        body.assigneeName !== undefined
          ? body.assigneeName || null
          : existingTicket.assignee_name,
      )
      .input("assignee_user_id", sql.Int, nextAssigneeUserId)
      .input(
        "reporter_name",
        sql.NVarChar,
        body.reporterName !== undefined
          ? body.reporterName || "Unknown"
          : existingTicket.reporter_name || "Unknown",
      )
      .input("reporter_user_id", sql.Int, nextReporterUserId)
      .input("tags", sql.NVarChar, nextTags)
      .input("resolution_reason", sql.NVarChar, nextResolutionReason)
      .input("due_date", sql.DateTime, nextDueDate)
      .query(`
        UPDATE dbo.Tickets
        SET
          title = @title,
          description = @description,
          status = @status,
          priority = @priority,
          assignee_name = @assignee_name,
          assignee_user_id = @assignee_user_id,
          reporter_name = @reporter_name,
          reporter_user_id = @reporter_user_id,
          tags = @tags,
          resolution_reason = @resolution_reason,
          due_date = @due_date,
          resolved_at =
            CASE
              WHEN @status = 'resolved' AND resolved_at IS NULL THEN GETDATE()
              WHEN @status NOT IN ('resolved', 'closed') THEN NULL
              ELSE resolved_at
            END,
          closed_at =
            CASE
              WHEN @status = 'closed' AND closed_at IS NULL THEN GETDATE()
              WHEN @status <> 'closed' THEN NULL
              ELSE closed_at
            END,
          updated_at = GETDATE()
        OUTPUT
          inserted.id,
          inserted.company_id,
          inserted.title,
          inserted.description,
          inserted.status,
          inserted.priority,
          inserted.assignee_name,
          inserted.assignee_user_id,
          inserted.reporter_name,
          inserted.reporter_user_id,
          inserted.tags,
          inserted.resolution_reason,
          inserted.resolved_at,
          inserted.closed_at,
          inserted.due_date,
          inserted.comments,
          inserted.created_at,
          inserted.updated_at
        WHERE id = @id
          AND company_id = @company_id
      `)

    const updatedTicket = formatTicket(result.recordset[0])

    if (normalizedStatus === "closed" || normalizedStatus === "resolved") {
      await notifyTicketStatusChanged(pool, companyId, updatedTicket, normalizedStatus)
    }

    return NextResponse.json(updatedTicket)
  } catch (error) {
    console.error("Failed to update ticket:", error)

    return NextResponse.json(
      {
        error: "Failed to update ticket",
        details: getErrorMessage(error),
      },
      { status: 500 },
    )
  }
}
