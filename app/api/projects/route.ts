import { NextResponse } from "next/server"
import sql from "mssql"
import { ensureVoltSchema, getDbPool, getErrorMessage } from "@/lib/server/volt-schema"

function getCompanyId(request: Request, body?: any) {
  const url = new URL(request.url)
  return Number(body?.companyId || url.searchParams.get("companyId") || request.headers.get("x-company-id") || 0)
}

function getUserId(request: Request, body?: any) {
  const url = new URL(request.url)
  return Number(body?.userId || body?.createdByUserId || url.searchParams.get("userId") || request.headers.get("x-user-id") || 0)
}

function formatProject(row: any) {
  return {
    id: String(row.id),
    companyId: row.company_id,
    name: row.name,
    description: row.description || "",
    icon: row.icon || "FolderKanban",
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberCount: row.member_count || 0,
    totalTasks: row.total_tasks || 0,
    pendingTasks: row.pending_tasks || 0,
    inProgressTasks: row.in_progress_tasks || 0,
    completedTasks: row.completed_tasks || 0,
    previewTasks: row.preview_tasks ? JSON.parse(row.preview_tasks) : [],
  }
}

export async function GET(request: Request) {
  try {
    await ensureVoltSchema()
    const companyId = getCompanyId(request)

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 })
    }

    const pool = await getDbPool()

    const result = await pool.request()
      .input("company_id", sql.Int, companyId)
      .query(`
        SELECT
          p.id,
          p.company_id,
          p.name,
          p.description,
          p.icon,
          p.status,
          p.created_by_user_id,
          p.created_at,
          p.updated_at,
          COUNT(DISTINCT pm.user_id) AS member_count,
          COUNT(DISTINCT t.id) AS total_tasks,
          SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending_tasks,
          SUM(CASE WHEN t.status = 'in-progress' THEN 1 ELSE 0 END) AS in_progress_tasks,
          SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
          (
            SELECT TOP 3
              t2.id,
              t2.title,
              t2.status,
              t2.priority,
              t2.assignee_name AS assigneeName
            FROM dbo.Tasks t2
            WHERE t2.company_id = p.company_id
              AND t2.project_id = p.id
            ORDER BY t2.updated_at DESC
            FOR JSON PATH
          ) AS preview_tasks
        FROM dbo.Projects p
        LEFT JOIN dbo.ProjectMembers pm 
          ON pm.project_id = p.id 
          AND pm.company_id = p.company_id
        LEFT JOIN dbo.Tasks t 
          ON t.project_id = p.id 
          AND t.company_id = p.company_id
        WHERE p.company_id = @company_id
          AND p.status = 'active'
        GROUP BY 
          p.id, 
          p.company_id, 
          p.name, 
          p.description, 
          p.icon, 
          p.status, 
          p.created_by_user_id, 
          p.created_at,
          p.updated_at
        ORDER BY p.updated_at DESC
      `)

    return NextResponse.json(result.recordset.map(formatProject))
  } catch (error) {
    console.error("Failed to load projects:", error)
    return NextResponse.json(
      { error: "Failed to load projects", details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const pool = await getDbPool()
  const transaction = new sql.Transaction(pool)

  try {
    await ensureVoltSchema()

    const body = await request.json()
    const companyId = getCompanyId(request, body)
    const createdByUserId = getUserId(request, body)
    const name = String(body.name || "").trim()
    const description = String(body.description || "").trim()
    const icon = String(body.icon || "FolderKanban").trim()
    const dueDate = body.dueDate ? String(body.dueDate) : null

    const memberIds = Array.isArray(body.memberIds)
      ? body.memberIds.map((id: any) => Number(id)).filter(Boolean)
      : []

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 })
    }

    await transaction.begin()

    const projectResult = await new sql.Request(transaction)
      .input("company_id", sql.Int, companyId)
      .input("name", sql.NVarChar(200), name)
      .input("description", sql.NVarChar(sql.MAX), description || null)
      .input("icon", sql.NVarChar(50), icon)
      .input("created_by_user_id", sql.Int, createdByUserId || null)
      .input("due_date", sql.Date, dueDate || null)
      .query(`
        INSERT INTO dbo.Projects (
          company_id, 
          name, 
          description, 
          icon, 
          created_by_user_id, 
          due_date,
          status, 
          created_at, 
          updated_at
        )
        OUTPUT inserted.*
        VALUES (
          @company_id, 
          @name, 
          @description, 
          @icon, 
          @created_by_user_id, 
          @due_date,
          'active', 
          SYSUTCDATETIME(), 
          SYSUTCDATETIME()
        )
      `)

    const project = projectResult.recordset[0]

    const allMemberIds = Array.from(
      new Set([createdByUserId, ...memberIds].filter(Boolean))
    )

    for (const memberId of allMemberIds) {
      await new sql.Request(transaction)
        .input("project_id", sql.Int, project.id)
        .input("company_id", sql.Int, companyId)
        .input("user_id", sql.Int, memberId)
        .input("added_by_user_id", sql.Int, createdByUserId || null)
        .query(`
          IF EXISTS (
            SELECT 1 
            FROM dbo.AppUsers 
            WHERE id = @user_id 
              AND company_id = @company_id 
              AND status = 'active'
          )
          AND NOT EXISTS (
            SELECT 1 
            FROM dbo.ProjectMembers 
            WHERE project_id = @project_id 
              AND user_id = @user_id
          )
          BEGIN
            INSERT INTO dbo.ProjectMembers (
              project_id, 
              company_id, 
              user_id, 
              added_by_user_id
            )
            VALUES (
              @project_id, 
              @company_id, 
              @user_id, 
              @added_by_user_id
            )
          END
        `)
    }

    await transaction.commit()

    return NextResponse.json(
      {
        id: String(project.id),
        companyId: project.company_id,
        name: project.name,
        description: project.description || "",
        icon: project.icon,
        status: project.status,
        createdByUserId: project.created_by_user_id,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        memberCount: allMemberIds.length,
        totalTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        completedTasks: 0,
        previewTasks: [],
      },
      { status: 201 }
    )
  } catch (error) {
    try {
      await transaction.rollback()
    } catch {}

    console.error("Failed to create project:", error)

    return NextResponse.json(
      { error: "Failed to create project", details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}