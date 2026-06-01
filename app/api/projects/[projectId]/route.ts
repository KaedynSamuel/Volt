import { NextResponse } from "next/server"
import sql from "mssql"
import { ensureVoltSchema, getDbPool, getErrorMessage } from "@/lib/server/volt-schema"

function getCompanyId(request: Request) {
  const url = new URL(request.url)
  return Number(url.searchParams.get("companyId") || request.headers.get("x-company-id") || 0)
}

function getInitials(name?: string | null) {
  if (!name) return ""
  return name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2)
}

function normalizeStatus(status: string) {
  const value = status?.toLowerCase().trim()
  if (value === "completed" || value === "done") return "completed"
  if (value === "in-progress" || value === "in progress") return "in-progress"
  return "pending"
}

function normalizePriority(priority: string) {
  const value = priority?.toLowerCase().trim()
  if (value === "high") return "high"
  if (value === "low") return "low"
  return "medium"
}

function formatTask(row: any) {
  const assigneeName = row.assignee_name as string | null
  return {
    id: String(row.id),
    companyId: row.company_id,
    projectId: row.project_id ? String(row.project_id) : null,
    assignedToUserId: row.assigned_to_user_id,
    createdByUserId: row.created_by_user_id,
    assignmentType: row.assignment_type || "assigned",
    title: row.title,
    description: row.description || "",
    status: normalizeStatus(row.status),
    priority: normalizePriority(row.priority),
    assignee: assigneeName ? { name: assigneeName, initials: getInitials(assigneeName) } : undefined,
    dueDate: row.due_date
      ? new Date(row.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : undefined,
    tags: row.tags ? String(row.tags).split(",").map((tag) => tag.trim()).filter(Boolean) : [],
  }
}

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    await ensureVoltSchema()
    const { projectId } = await context.params
    const companyId = getCompanyId(request)

    if (!companyId || !projectId) {
      return NextResponse.json({ error: "companyId and projectId are required" }, { status: 400 })
    }

    const pool = await getDbPool()

    const projectResult = await pool.request()
      .input("company_id", sql.Int, companyId)
      .input("project_id", sql.Int, Number(projectId))
      .query(`
        SELECT TOP 1 id, company_id, name, description, icon, status, created_by_user_id, created_at
        FROM dbo.Projects
        WHERE id = @project_id AND company_id = @company_id AND status = 'active'
      `)

    if (projectResult.recordset.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const membersResult = await pool.request()
      .input("company_id", sql.Int, companyId)
      .input("project_id", sql.Int, Number(projectId))
      .query(`
        SELECT u.id, u.full_name, u.email, u.role, u.status
        FROM dbo.ProjectMembers pm
        INNER JOIN dbo.AppUsers u ON u.id = pm.user_id AND u.company_id = pm.company_id
        WHERE pm.project_id = @project_id AND pm.company_id = @company_id AND u.status = 'active'
        ORDER BY u.full_name ASC
      `)

    const tasksResult = await pool.request()
      .input("company_id", sql.Int, companyId)
      .input("project_id", sql.Int, Number(projectId))
      .query(`
        SELECT id, company_id, project_id, title, description, status, priority, assignee_name,
               assigned_to_user_id, created_by_user_id, assignment_type, due_date, tags, created_at, updated_at
        FROM dbo.Tasks
        WHERE company_id = @company_id AND project_id = @project_id
        ORDER BY updated_at DESC
      `)

    const project = projectResult.recordset[0]
    return NextResponse.json({
      project: {
        id: String(project.id),
        companyId: project.company_id,
        name: project.name,
        description: project.description || "",
        icon: project.icon,
        status: project.status,
        createdByUserId: project.created_by_user_id,
        createdAt: project.created_at,
      },
      members: membersResult.recordset.map((member) => ({
        id: member.id,
        fullName: member.full_name,
        email: member.email,
        role: member.role,
        status: member.status,
      })),
      tasks: tasksResult.recordset.map(formatTask),
    })
  } catch (error) {
    console.error("Failed to load project:", error)
    return NextResponse.json(
      { error: "Failed to load project", details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params
  const url = new URL(request.url)
  const companyId = Number(url.searchParams.get("companyId") || request.headers.get("x-company-id") || 0)

  if (!companyId || !projectId) {
    return NextResponse.json({ error: "companyId and projectId are required" }, { status: 400 })
  }

  try {
    const pool = await getDbPool()

    // Unlink tasks from this project
    await pool.request()
      .input("project_id", projectId)
      .input("company_id", sql.Int, companyId)
      .query(`
        UPDATE dbo.Tasks
        SET project_id = NULL
        WHERE project_id = @project_id AND company_id = @company_id
      `)

    // Remove project members
    await pool.request()
      .input("project_id", projectId)
      .input("company_id", sql.Int, companyId)
      .query(`
        DELETE FROM dbo.ProjectMembers
        WHERE project_id = @project_id AND company_id = @company_id
      `)

    // Delete the project
    await pool.request()
      .input("project_id", projectId)
      .input("company_id", sql.Int, companyId)
      .query(`
        DELETE FROM dbo.Projects
        WHERE id = @project_id AND company_id = @company_id
      `)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to delete project:", error)
    return NextResponse.json({ error: "Failed to delete project", details: getErrorMessage(error) }, { status: 500 })
  }
}
