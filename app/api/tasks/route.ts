import { NextResponse } from "next/server"
import sql from "mssql"
import {
  ensureVoltSchema,
  getDbPool,
  getErrorMessage,
} from "@/lib/server/volt-schema"
import { sendVoltEmailNotification, saveInAppNotification } from "@/lib/server/volt-notifications"

function getCompanyId(request: Request) {
  const url = new URL(request.url)

  return Number(
    url.searchParams.get("companyId") ||
      request.headers.get("x-company-id") ||
      0
  )
}

function normalizeStatus(status: string) {
  const value = String(status || "").toLowerCase().trim()

  if (value === "completed" || value === "complete" || value === "done") {
    return "completed"
  }

  if (
    value === "in-progress" ||
    value === "in progress" ||
    value === "progress"
  ) {
    return "in-progress"
  }

  if (value === "blocked" || value === "block") {
    return "blocked"
  }

  if (value === "rollover" || value === "roll over" || value === "rolled-over") {
    return "rollover"
  }

  if (
    value === "todo" ||
    value === "to-do" ||
    value === "to do" ||
    value === "pending"
  ) {
    return "todo"
  }

  return "todo"
}

function normalizePriority(priority: string) {
  const value = String(priority || "").toLowerCase().trim()

  if (value === "high") return "high"
  if (value === "low") return "low"

  return "medium"
}

function normalizeAssignmentType(value: string) {
  return String(value || "assigned").toLowerCase() === "personal"
    ? "personal"
    : "assigned"
}


async function getUsersForEmail(pool: sql.ConnectionPool, companyId: number, userIds: number[]) {
  const safeIds = userIds.filter((id) => Number.isFinite(id) && id > 0)
  if (!safeIds.length) return []

  const request = pool.request().input("company_id", sql.Int, companyId)
  safeIds.forEach((userId, index) => request.input(`user_id_${index}`, sql.Int, userId))
  const inputs = safeIds.map((_, index) => `@user_id_${index}`).join(",")

  const result = await request.query(`
    SELECT id, full_name, email
    FROM dbo.AppUsers
    WHERE company_id = @company_id
      AND id IN (${inputs})
      AND status = 'active'
  `)

  return result.recordset as Array<{ id: number; full_name: string; email: string }>
}

async function notifyAssignedTaskCreated(
  pool: sql.ConnectionPool,
  companyId: number,
  task: ReturnType<typeof formatTask>,
  assignmentType: string,
  assignedToUserIds: number[],
) {
  if (assignmentType === "personal") return

  try {
    const users = await getUsersForEmail(pool, companyId, assignedToUserIds)

    await Promise.all(
      users.map(async (user) => {
        await sendVoltEmailNotification({
          to: user.email,
          subject: `New Volt task assigned: ${task.title}`,
          message: `A new task has been assigned to you in Volt: ${task.title}. Priority: ${task.priority}.`,
          actionUrl: "/tasks",
        })
        await saveInAppNotification(pool, {
          companyId,
          userId: user.id,
          type: "task_assigned",
          title: `Task assigned: ${task.title}`,
          message: `A new task has been assigned to you. Priority: ${task.priority}.`,
          relatedId: String(task.id),
        })
      }),
    )
  } catch (error) {
    console.error("Volt task email notification failed:", error)
  }
}

function getInitials(name?: string | null) {
  if (!name) return ""

  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1

  const normalized = String(value || "").toLowerCase().trim()

  return normalized === "true" || normalized === "1" || normalized === "yes"
}

function normalizeUserIds(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)
}

async function ensureTaskExtraColumns(pool: sql.ConnectionPool) {
  await pool.request().query(`
    IF COL_LENGTH('dbo.Tasks', 'is_blocked') IS NULL
    BEGIN
      ALTER TABLE dbo.Tasks
      ADD is_blocked BIT NOT NULL
      CONSTRAINT DF_Tasks_is_blocked DEFAULT 0
    END

    IF COL_LENGTH('dbo.Tasks', 'block_reason') IS NULL
    BEGIN
      ALTER TABLE dbo.Tasks
      ADD block_reason NVARCHAR(MAX) NULL
    END

    IF COL_LENGTH('dbo.Tasks', 'is_deleted') IS NULL
    BEGIN
      ALTER TABLE dbo.Tasks
      ADD is_deleted BIT NOT NULL
      CONSTRAINT DF_Tasks_is_deleted DEFAULT 0
    END

    IF COL_LENGTH('dbo.Tasks', 'deleted_at') IS NULL
    BEGIN
      ALTER TABLE dbo.Tasks
      ADD deleted_at DATETIME2 NULL
    END

    IF COL_LENGTH('dbo.Tasks', 'deleted_by_user_id') IS NULL
    BEGIN
      ALTER TABLE dbo.Tasks
      ADD deleted_by_user_id INT NULL
    END

    IF COL_LENGTH('dbo.Tasks', 'clear_completed_at') IS NULL
    BEGIN
      ALTER TABLE dbo.Tasks
      ADD clear_completed_at DATETIME2 NULL
    END

    IF COL_LENGTH('dbo.Tasks', 'cleared_by_user_id') IS NULL
    BEGIN
      ALTER TABLE dbo.Tasks
      ADD cleared_by_user_id INT NULL
    END

    IF COL_LENGTH('dbo.Tasks', 'completed_at') IS NULL
    BEGIN
      ALTER TABLE dbo.Tasks
      ADD completed_at DATETIME2 NULL
    END

    IF OBJECT_ID('dbo.TaskAssignees', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.TaskAssignees (
        id INT IDENTITY(1,1) PRIMARY KEY,
        company_id INT NOT NULL,
        task_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_TaskAssignees_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_TaskAssignees_company_task_user UNIQUE (company_id, task_id, user_id)
      )
    END
  `)
}

function formatTask(row: any) {
  const assigneeName = row.assignee_name as string | null
  const assignedUsers = row.assigned_users_json
    ? JSON.parse(row.assigned_users_json)
    : []

  const assignedToUserIds = Array.isArray(assignedUsers)
    ? assignedUsers.map((user: any) => String(user.id))
    : []

  const isBlocked =
    row.is_blocked === true ||
    row.is_blocked === 1 ||
    normalizeStatus(row.status) === "blocked"

  return {
    id: String(row.id),
    dbId: row.id,
    companyId: row.company_id,
    projectId: row.project_id ? String(row.project_id) : null,
    projectName: row.project_name || null,
    assignedToUserId: row.assigned_to_user_id,
    assignedToUserIds,
    assignedUsers,
    createdByUserId: row.created_by_user_id,
    assignmentType: row.assignment_type || "assigned",
    title: row.title,
    description: row.description || "",
    status: isBlocked ? "blocked" : normalizeStatus(row.status),
    priority: normalizePriority(row.priority),
    isBlocked,
    blockReason: row.block_reason || "",
    isDeleted: row.is_deleted === true || row.is_deleted === 1,
    deletedAt: row.deleted_at || null,
    deletedByUserId: row.deleted_by_user_id || null,
    clearCompletedAt: row.clear_completed_at || null,
    clearedByUserId: row.cleared_by_user_id || null,
    completedAt: row.completed_at || null,
    createdAtRaw: row.created_at,
    updatedAtRaw: row.updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignee: assigneeName
      ? {
          id: row.assigned_to_user_id,
          name: assigneeName,
          initials: getInitials(assigneeName),
        }
      : undefined,
    dueDateRaw: row.due_date,
    dueDate: row.due_date
      ? new Date(row.due_date).toISOString().slice(0, 10)
      : undefined,
    tags: row.tags
      ? String(row.tags)
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [],
  }
}

async function validateTaskAssignment(
  pool: sql.ConnectionPool,
  companyId: number,
  projectId: number | null,
  assignedToUserIds: number[]
) {
  if (assignedToUserIds.length === 0) {
    return {
      allowed: true,
      assigneeName: null,
    }
  }

  if (projectId) {
    const request = pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("project_id", sql.Int, projectId)

    assignedToUserIds.forEach((userId, index) => {
      request.input(`user_id_${index}`, sql.Int, userId)
    })

    const userInputs = assignedToUserIds
      .map((_, index) => `@user_id_${index}`)
      .join(",")

    const result = await request.query(`
      SELECT u.id, u.full_name
      FROM dbo.ProjectMembers pm
      INNER JOIN dbo.AppUsers u 
        ON u.id = pm.user_id 
        AND u.company_id = pm.company_id
      WHERE pm.company_id = @company_id
        AND pm.project_id = @project_id
        AND pm.user_id IN (${userInputs})
        AND u.status = 'active'
    `)

    if (result.recordset.length !== assignedToUserIds.length) {
      return {
        allowed: false,
        assigneeName: null,
        message: "One or more selected users are not part of this project",
      }
    }

    return {
      allowed: true,
      assigneeName: result.recordset[0]?.full_name as string,
    }
  }

  const request = pool.request().input("company_id", sql.Int, companyId)

  assignedToUserIds.forEach((userId, index) => {
    request.input(`user_id_${index}`, sql.Int, userId)
  })

  const userInputs = assignedToUserIds
    .map((_, index) => `@user_id_${index}`)
    .join(",")

  const result = await request.query(`
    SELECT id, full_name
    FROM dbo.AppUsers
    WHERE company_id = @company_id
      AND id IN (${userInputs})
      AND status = 'active'
  `)

  if (result.recordset.length !== assignedToUserIds.length) {
    return {
      allowed: false,
      assigneeName: null,
      message: "One or more selected users are not part of this dashboard",
    }
  }

  return {
    allowed: true,
    assigneeName: result.recordset[0]?.full_name as string,
  }
}

async function replaceTaskAssignees(
  pool: sql.ConnectionPool,
  companyId: number,
  taskId: number,
  userIds: number[]
) {
  const transaction = new sql.Transaction(pool)

  await transaction.begin()

  try {
    await new sql.Request(transaction)
      .input("company_id", sql.Int, companyId)
      .input("task_id", sql.Int, taskId)
      .query(`
        DELETE FROM dbo.TaskAssignees
        WHERE company_id = @company_id
          AND task_id = @task_id
      `)

    for (const userId of userIds) {
      await new sql.Request(transaction)
        .input("company_id", sql.Int, companyId)
        .input("task_id", sql.Int, taskId)
        .input("user_id", sql.Int, userId)
        .query(`
          INSERT INTO dbo.TaskAssignees (
            company_id,
            task_id,
            user_id,
            created_at
          )
          VALUES (
            @company_id,
            @task_id,
            @user_id,
            SYSUTCDATETIME()
          )
        `)
    }

    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

async function getTaskById(
  pool: sql.ConnectionPool,
  companyId: number,
  taskId: number
) {
  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("id", sql.Int, taskId)
    .query(`
      SELECT
        t.id,
        t.company_id,
        t.project_id,
        p.name AS project_name,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.assignee_name,
        t.assigned_to_user_id,
        t.created_by_user_id,
        t.assignment_type,
        t.due_date,
        t.tags,
        t.is_blocked,
        t.block_reason,
        t.is_deleted,
        t.deleted_at,
        t.deleted_by_user_id,
        t.clear_completed_at,
        t.cleared_by_user_id,
        t.completed_at,
        t.created_at,
        t.updated_at,
        (
          SELECT
            u.id,
            u.full_name AS fullName,
            u.full_name AS name,
            LEFT(
              UPPER(
                ISNULL(
                  NULLIF(
                    CONCAT(
                      LEFT(PARSENAME(REPLACE(u.full_name, ' ', '.'), 2), 1),
                      LEFT(PARSENAME(REPLACE(u.full_name, ' ', '.'), 1), 1)
                    ),
                    ''
                  ),
                  LEFT(u.full_name, 2)
                )
              ),
              2
            ) AS initials
          FROM dbo.TaskAssignees ta
          INNER JOIN dbo.AppUsers u
            ON u.id = ta.user_id
            AND u.company_id = ta.company_id
          WHERE ta.company_id = t.company_id
            AND ta.task_id = t.id
          FOR JSON PATH
        ) AS assigned_users_json
      FROM dbo.Tasks t
      LEFT JOIN dbo.Projects p 
        ON p.id = t.project_id 
        AND p.company_id = t.company_id
      WHERE t.company_id = @company_id
        AND t.id = @id
    `)

  return result.recordset[0] || null
}

export async function GET(request: Request) {
  try {
    await ensureVoltSchema()

    const companyId = getCompanyId(request)
    const url = new URL(request.url)
    const projectId = Number(url.searchParams.get("projectId") || 0)
    const userId = Number(url.searchParams.get("userId") || 0)
    const createdBy = Number(url.searchParams.get("createdBy") || 0)
    const scope = String(url.searchParams.get("scope") || "")
      .trim()
      .toLowerCase()

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      )
    }

    const pool = await getDbPool()
    await ensureTaskExtraColumns(pool)

    const result = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("project_id", sql.Int, projectId || null)
      .input("user_id", sql.Int, userId || null)
      .input("created_by", sql.Int, createdBy || null)
      .input("scope", sql.NVarChar(30), scope || null)
      .query(`
        SELECT
          t.id,
          t.company_id,
          t.project_id,
          p.name AS project_name,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.assignee_name,
          t.assigned_to_user_id,
          t.created_by_user_id,
          t.assignment_type,
          t.due_date,
          t.tags,
          t.is_blocked,
          t.block_reason,
          t.is_deleted,
          t.deleted_at,
          t.deleted_by_user_id,
          t.clear_completed_at,
          t.cleared_by_user_id,
          t.completed_at,
          t.created_at,
          t.updated_at,
          (
            SELECT
              u.id,
              u.full_name AS fullName,
              u.full_name AS name,
              LEFT(
                UPPER(
                  ISNULL(
                    NULLIF(
                      CONCAT(
                        LEFT(PARSENAME(REPLACE(u.full_name, ' ', '.'), 2), 1),
                        LEFT(PARSENAME(REPLACE(u.full_name, ' ', '.'), 1), 1)
                      ),
                      ''
                    ),
                    LEFT(u.full_name, 2)
                  )
                ),
                2
              ) AS initials
            FROM dbo.TaskAssignees ta
            INNER JOIN dbo.AppUsers u
              ON u.id = ta.user_id
              AND u.company_id = ta.company_id
            WHERE ta.company_id = t.company_id
              AND ta.task_id = t.id
            FOR JSON PATH
          ) AS assigned_users_json
        FROM dbo.Tasks t
        LEFT JOIN dbo.Projects p 
          ON p.id = t.project_id 
          AND p.company_id = t.company_id
        WHERE t.company_id = @company_id
          AND ISNULL(t.is_deleted, 0) = 0
          AND NOT (
            t.status = 'completed'
            AND t.clear_completed_at IS NOT NULL
          )
          AND (@project_id IS NULL OR t.project_id = @project_id)
          AND (
            @scope IS NULL
            OR @scope = ''
            OR @scope = 'all'
            OR (@scope = 'personal' AND t.assigned_to_user_id = @user_id)
            OR (@scope = 'created' AND t.created_by_user_id = @user_id)
            OR (@scope = 'assigned' AND t.assignment_type = 'assigned')
            OR (@scope = 'blocked' AND (t.status = 'blocked' OR t.is_blocked = 1))
            OR (
              @scope = 'overdue'
              AND t.status <> 'completed'
              AND t.due_date IS NOT NULL
              AND CONVERT(date, t.due_date) < CONVERT(date, SYSUTCDATETIME())
            )
          )
          AND (
            @user_id IS NULL
            OR @scope IN ('all', 'created', 'assigned', 'blocked', 'overdue')
            OR t.assigned_to_user_id = @user_id
            OR t.created_by_user_id = @user_id
            OR t.created_by_user_id = @created_by
            OR EXISTS (
              SELECT 1
              FROM dbo.TaskAssignees ta
              WHERE ta.company_id = t.company_id
                AND ta.task_id = t.id
                AND ta.user_id = @user_id
            )
          )
        ORDER BY t.updated_at DESC, t.created_at DESC
      `)

    return NextResponse.json(result.recordset.map(formatTask))
  } catch (error) {
    console.error("Failed to load tasks:", error)

    return NextResponse.json(
      {
        error: "Failed to load tasks from database",
        details: getErrorMessage(error),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    await ensureVoltSchema()

    const companyId = getCompanyId(request)
    const body = await request.json()

    const title = String(body.title || "").trim()
    const description = String(body.description || "").trim()
    const priority = normalizePriority(body.priority)
    const dueDate = body.dueDate || null
    const tags = body.tags || null
    const projectId = body.projectId ? Number(body.projectId) : null
    const createdByUserId = body.createdByUserId
      ? Number(body.createdByUserId)
      : null
    const assignmentType = normalizeAssignmentType(body.assignmentType)

    const bodyUserIds = normalizeUserIds(body.assignedToUserIds)
    const singleAssignedToUserId = body.assignedToUserId
      ? Number(body.assignedToUserId)
      : null

    const requestedStatus = normalizeStatus(body.status)
    const isBlocked = toBoolean(body.isBlocked) || requestedStatus === "blocked"
    const blockReason = String(body.blockReason || "").trim()
    const finalStatus = isBlocked ? "blocked" : requestedStatus

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      )
    }

    if (!title) {
      return NextResponse.json(
        { error: "Task title is required" },
        { status: 400 }
      )
    }

    if (!createdByUserId) {
      return NextResponse.json(
        { error: "createdByUserId is required" },
        { status: 400 }
      )
    }

    const assignedToUserIds =
      assignmentType === "personal"
        ? [createdByUserId]
        : bodyUserIds.length
          ? bodyUserIds
          : singleAssignedToUserId
            ? [singleAssignedToUserId]
            : []

    if (assignmentType === "assigned" && assignedToUserIds.length === 0) {
      return NextResponse.json(
        { error: "Assigned tasks require at least one team member" },
        { status: 400 }
      )
    }

    if (isBlocked && !blockReason) {
      return NextResponse.json(
        { error: "Blocked tasks require a block reason" },
        { status: 400 }
      )
    }

    const primaryAssignedUserId = assignedToUserIds[0] || createdByUserId

    const pool = await getDbPool()
    await ensureTaskExtraColumns(pool)

    if (projectId) {
      const projectCheck = await pool
        .request()
        .input("company_id", sql.Int, companyId)
        .input("project_id", sql.Int, projectId)
        .query(`
          SELECT TOP 1 id 
          FROM dbo.Projects 
          WHERE id = @project_id 
            AND company_id = @company_id 
            AND status = 'active'
        `)

      if (projectCheck.recordset.length === 0) {
        return NextResponse.json(
          { error: "Project does not belong to this dashboard" },
          { status: 400 }
        )
      }
    }

    const assignment = await validateTaskAssignment(
      pool,
      companyId,
      projectId,
      assignedToUserIds
    )

    if (!assignment.allowed) {
      return NextResponse.json(
        { error: assignment.message || "Invalid task assignment" },
        { status: 400 }
      )
    }

    const result = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input(
        "project_id",
        sql.Int,
        assignmentType === "personal" ? null : projectId
      )
      .input("title", sql.NVarChar(250), title)
      .input("description", sql.NVarChar(sql.MAX), description || "")
      .input("status", sql.NVarChar(50), finalStatus)
      .input("priority", sql.NVarChar(50), priority)
      .input(
        "assignee_name",
        sql.NVarChar(200),
        assignment.assigneeName || body.assigneeName || null
      )
      .input("assigned_to_user_id", sql.Int, primaryAssignedUserId)
      .input("created_by_user_id", sql.Int, createdByUserId)
      .input("assignment_type", sql.NVarChar(50), assignmentType)
      .input("due_date", sql.Date, dueDate)
      .input("tags", sql.NVarChar(1000), tags)
      .input("is_blocked", sql.Bit, isBlocked)
      .input("block_reason", sql.NVarChar(sql.MAX), isBlocked ? blockReason : null)
      .query(`
        INSERT INTO dbo.Tasks (
          company_id,
          project_id,
          title,
          description,
          status,
          priority,
          assignee_name,
          assigned_to_user_id,
          created_by_user_id,
          assignment_type,
          due_date,
          tags,
          is_blocked,
          block_reason,
          completed_at,
          created_at,
          updated_at
        )
        OUTPUT inserted.id
        VALUES (
          @company_id,
          @project_id,
          @title,
          @description,
          @status,
          @priority,
          @assignee_name,
          @assigned_to_user_id,
          @created_by_user_id,
          @assignment_type,
          @due_date,
          @tags,
          @is_blocked,
          @block_reason,
          CASE WHEN @status = 'completed' THEN SYSUTCDATETIME() ELSE NULL END,
          SYSUTCDATETIME(),
          SYSUTCDATETIME()
        )
      `)

    const taskId = Number(result.recordset[0].id)

    await replaceTaskAssignees(pool, companyId, taskId, assignedToUserIds)

    const task = await getTaskById(pool, companyId, taskId)
    const formattedTask = formatTask(task)

    await notifyAssignedTaskCreated(pool, companyId, formattedTask, assignmentType, assignedToUserIds)

    return NextResponse.json(formattedTask, { status: 201 })
  } catch (error) {
    console.error("Failed to create task:", error)

    return NextResponse.json(
      {
        error: "Failed to create task",
        details: getErrorMessage(error),
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureVoltSchema()

    const companyId = getCompanyId(request)
    const body = await request.json()

    const action = String(body.action || "").trim().toLowerCase()
    const id = body.id ? Number(body.id) : 0
    const userId = body.userId ? Number(body.userId) : null

    const hasStatus = typeof body.status !== "undefined"
    const hasBlocked = typeof body.isBlocked !== "undefined"
    const hasBlockReason = typeof body.blockReason !== "undefined"
    const hasTitle = typeof body.title !== "undefined"
    const hasDescription = typeof body.description !== "undefined"
    const hasPriority = typeof body.priority !== "undefined"
    const hasDueDate = typeof body.dueDate !== "undefined"
    const hasTags = typeof body.tags !== "undefined"
    const hasProjectId = typeof body.projectId !== "undefined"
    const hasAssignmentType = typeof body.assignmentType !== "undefined"
    const hasAssignedToUserIds = Array.isArray(body.assignedToUserIds)

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      )
    }

    const pool = await getDbPool()
    await ensureTaskExtraColumns(pool)

    if (action === "clear-completed") {
      await pool
        .request()
        .input("company_id", sql.Int, companyId)
        .input("cleared_by_user_id", sql.Int, userId)
        .query(`
          UPDATE dbo.Tasks
          SET
            clear_completed_at = SYSUTCDATETIME(),
            cleared_by_user_id = @cleared_by_user_id,
            updated_at = SYSUTCDATETIME()
          WHERE company_id = @company_id
            AND status = 'completed'
            AND ISNULL(is_deleted, 0) = 0
        `)

      return NextResponse.json({ success: true })
    }

    if (!id) {
      return NextResponse.json(
        { error: "Task id is required" },
        { status: 400 }
      )
    }

    if (action === "delete") {
      const deleteResult = await pool
        .request()
        .input("id", sql.Int, id)
        .input("company_id", sql.Int, companyId)
        .input("deleted_by_user_id", sql.Int, userId)
        .query(`
          UPDATE dbo.Tasks
          SET
            is_deleted = 1,
            deleted_at = SYSUTCDATETIME(),
            deleted_by_user_id = @deleted_by_user_id,
            updated_at = SYSUTCDATETIME()
          OUTPUT
            inserted.id,
            inserted.company_id,
            inserted.project_id,
            NULL AS project_name,
            inserted.title,
            inserted.description,
            inserted.status,
            inserted.priority,
            inserted.assignee_name,
            inserted.assigned_to_user_id,
            inserted.created_by_user_id,
            inserted.assignment_type,
            inserted.due_date,
            inserted.tags,
            inserted.is_blocked,
            inserted.block_reason,
            inserted.is_deleted,
            inserted.deleted_at,
            inserted.deleted_by_user_id,
            inserted.clear_completed_at,
            inserted.cleared_by_user_id,
            inserted.completed_at,
            inserted.created_at,
            inserted.updated_at,
            NULL AS assigned_users_json
          WHERE id = @id
            AND company_id = @company_id
            AND status <> 'completed'
        `)

      if (deleteResult.recordset.length === 0) {
        return NextResponse.json(
          { error: "Task not found or completed tasks cannot be deleted" },
          { status: 404 }
        )
      }

      return NextResponse.json(formatTask(deleteResult.recordset[0]))
    }

    if (
      !hasStatus &&
      !hasBlocked &&
      !hasBlockReason &&
      !hasTitle &&
      !hasDescription &&
      !hasPriority &&
      !hasDueDate &&
      !hasTags &&
      !hasProjectId &&
      !hasAssignmentType &&
      !hasAssignedToUserIds
    ) {
      return NextResponse.json(
        { error: "No task updates were provided" },
        { status: 400 }
      )
    }

    const normalizedStatus = hasStatus ? normalizeStatus(body.status) : null
    const isBlocked = hasBlocked
      ? toBoolean(body.isBlocked)
      : normalizedStatus === "blocked"
        ? true
        : undefined

    const blockReason = hasBlockReason
      ? String(body.blockReason || "").trim()
      : undefined

    if (isBlocked === true && hasBlockReason && !blockReason) {
      return NextResponse.json(
        { error: "Blocked tasks require a block reason" },
        { status: 400 }
      )
    }

    const title = hasTitle ? String(body.title || "").trim() : null
    const description = hasDescription
      ? String(body.description || "").trim()
      : null
    const priority = hasPriority ? normalizePriority(body.priority) : null
    const dueDate = hasDueDate ? body.dueDate || null : null
    const tags = hasTags ? body.tags || null : null
    const projectId = hasProjectId && body.projectId ? Number(body.projectId) : null
    const assignmentType = hasAssignmentType
      ? normalizeAssignmentType(body.assignmentType)
      : null
    const assignedToUserIds = hasAssignedToUserIds
      ? normalizeUserIds(body.assignedToUserIds)
      : []

    if (hasTitle && !title) {
      return NextResponse.json(
        { error: "Task title is required" },
        { status: 400 }
      )
    }

    if (hasAssignedToUserIds && assignedToUserIds.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one assigned user" },
        { status: 400 }
      )
    }

    if (hasProjectId && projectId) {
      const projectCheck = await pool
        .request()
        .input("company_id", sql.Int, companyId)
        .input("project_id", sql.Int, projectId)
        .query(`
          SELECT TOP 1 id 
          FROM dbo.Projects 
          WHERE id = @project_id 
            AND company_id = @company_id 
            AND status = 'active'
        `)

      if (projectCheck.recordset.length === 0) {
        return NextResponse.json(
          { error: "Project does not belong to this dashboard" },
          { status: 400 }
        )
      }
    }

    if (hasAssignedToUserIds) {
      const assignment = await validateTaskAssignment(
        pool,
        companyId,
        hasProjectId ? projectId : null,
        assignedToUserIds
      )

      if (!assignment.allowed) {
        return NextResponse.json(
          { error: assignment.message || "Invalid task assignment" },
          { status: 400 }
        )
      }
    }

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("company_id", sql.Int, companyId)
      .input("status", sql.NVarChar(50), normalizedStatus)
      .input("has_status", sql.Bit, hasStatus)
      .input("is_blocked", sql.Bit, typeof isBlocked === "boolean" ? isBlocked : null)
      .input("has_blocked", sql.Bit, typeof isBlocked === "boolean")
      .input("block_reason", sql.NVarChar(sql.MAX), blockReason ?? null)
      .input("has_block_reason", sql.Bit, hasBlockReason)
      .input("title", sql.NVarChar(250), title)
      .input("has_title", sql.Bit, hasTitle)
      .input("description", sql.NVarChar(sql.MAX), description)
      .input("has_description", sql.Bit, hasDescription)
      .input("priority", sql.NVarChar(50), priority)
      .input("has_priority", sql.Bit, hasPriority)
      .input("due_date", sql.Date, dueDate)
      .input("has_due_date", sql.Bit, hasDueDate)
      .input("tags", sql.NVarChar(1000), tags)
      .input("has_tags", sql.Bit, hasTags)
      .input("project_id", sql.Int, projectId)
      .input("has_project_id", sql.Bit, hasProjectId)
      .input("assignment_type", sql.NVarChar(50), assignmentType)
      .input("has_assignment_type", sql.Bit, hasAssignmentType)
      .input(
        "assigned_to_user_id",
        sql.Int,
        hasAssignedToUserIds ? assignedToUserIds[0] : null
      )
      .input("has_assigned_to_user_id", sql.Bit, hasAssignedToUserIds)
      .query(`
        UPDATE dbo.Tasks
        SET
          title = CASE WHEN @has_title = 1 THEN @title ELSE title END,
          description = CASE WHEN @has_description = 1 THEN @description ELSE description END,
          priority = CASE WHEN @has_priority = 1 THEN @priority ELSE priority END,
          due_date = CASE WHEN @has_due_date = 1 THEN @due_date ELSE due_date END,
          tags = CASE WHEN @has_tags = 1 THEN @tags ELSE tags END,
          project_id = CASE WHEN @has_project_id = 1 THEN @project_id ELSE project_id END,
          assignment_type = CASE WHEN @has_assignment_type = 1 THEN @assignment_type ELSE assignment_type END,
          assigned_to_user_id = CASE
            WHEN @has_assigned_to_user_id = 1 THEN @assigned_to_user_id
            ELSE assigned_to_user_id
          END,
          status = CASE
            WHEN @has_blocked = 1 AND @is_blocked = 1 THEN 'blocked'
            WHEN @has_blocked = 1 AND @is_blocked = 0 AND status = 'blocked' THEN 'todo'
            WHEN @has_status = 1 THEN @status
            ELSE status
          END,
          is_blocked = CASE
            WHEN @has_blocked = 1 THEN @is_blocked
            WHEN @has_status = 1 AND @status = 'blocked' THEN 1
            WHEN @has_status = 1 AND @status <> 'blocked' THEN 0
            ELSE is_blocked
          END,
          block_reason = CASE
            WHEN @has_block_reason = 1 THEN @block_reason
            WHEN @has_blocked = 1 AND @is_blocked = 0 THEN NULL
            WHEN @has_status = 1 AND @status <> 'blocked' THEN NULL
            ELSE block_reason
          END,
          completed_at = CASE
            WHEN @has_status = 1 AND @status = 'completed' THEN ISNULL(completed_at, SYSUTCDATETIME())
            WHEN @has_status = 1 AND @status <> 'completed' THEN NULL
            ELSE completed_at
          END,
          clear_completed_at = CASE
            WHEN @has_status = 1 AND @status <> 'completed' THEN NULL
            ELSE clear_completed_at
          END,
          updated_at = SYSUTCDATETIME()
        WHERE id = @id
          AND company_id = @company_id
          AND ISNULL(is_deleted, 0) = 0
      `)

    if (result.rowsAffected[0] === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    if (hasAssignedToUserIds) {
      await replaceTaskAssignees(pool, companyId, id, assignedToUserIds)
    }

    const updatedTask = await getTaskById(pool, companyId, id)

    return NextResponse.json(formatTask(updatedTask))
  } catch (error) {
    console.error("Failed to update task:", error)

    return NextResponse.json(
      {
        error: "Failed to update task",
        details: getErrorMessage(error),
      },
      { status: 500 }
    )
  }
}
