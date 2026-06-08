import { NextResponse } from "next/server"
import sql from "mssql"

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

function getNumberParam(request: Request, key: string) {
  const url = new URL(request.url)
  const value = Number(url.searchParams.get(key) || 0)
  return Number.isFinite(value) ? value : 0
}

function getTextParam(request: Request, key: string) {
  const url = new URL(request.url)
  return String(url.searchParams.get(key) || "").trim()
}

function getUserRole(request: Request) {
  return String(request.headers.get("x-user-role") || "").toLowerCase().trim()
}

function canViewOverview(request: Request) {
  const role = getUserRole(request)
  return role === "business_owner" || role === "admin"
}

function rows<T = Record<string, unknown>>(result: sql.IResult<T>) {
  return Array.isArray(result.recordset) ? result.recordset : []
}

export async function GET(request: Request) {
  try {
    const companyId = getCompanyId(request)
    const requestedTeamId = getNumberParam(request, "teamId")
    const requestedUserId = getNumberParam(request, "userId")
    const requestedProjectId = getTextParam(request, "projectId")

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 })
    }

    if (!canViewOverview(request)) {
      return NextResponse.json({ error: "Only admins and business owners can view company overview" }, { status: 403 })
    }

    const pool = await sql.connect(dbConfig)

    const teamResult = await pool.request().input("company_id", sql.Int, companyId).query(`
      SELECT
        tm.id,
        tm.name,
        tm.description
      FROM dbo.Teams tm
      WHERE tm.company_id = @company_id
      ORDER BY tm.name ASC
    `)

    const teams = rows<{ id: number; name: string; description: string | null }>(teamResult)

    const selectedTeamId = requestedTeamId || teams[0]?.id || 0

    const memberResult = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("team_id", sql.Int, selectedTeamId)
      .query(`
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.role
        FROM dbo.TeamMembers mt
        INNER JOIN dbo.AppUsers u
          ON u.id = mt.user_id
         AND u.company_id = mt.company_id
        WHERE mt.company_id = @company_id
          AND mt.team_id = @team_id
          AND ISNULL(u.status, 'active') = 'active'
        ORDER BY u.full_name ASC
      `)

    const selectedTeamMembers = rows<{ id: number; full_name: string; email: string | null; role: string }>(memberResult)
    const selectedUserId = requestedUserId || selectedTeamMembers[0]?.id || 0

    const allTeamMembersResult = await pool.request().input("company_id", sql.Int, companyId).query(`
      SELECT
        mt.team_id,
        u.id,
        u.full_name,
        u.email,
        u.role
      FROM dbo.TeamMembers mt
      INNER JOIN dbo.AppUsers u
        ON u.id = mt.user_id
       AND u.company_id = mt.company_id
      WHERE mt.company_id = @company_id
        AND ISNULL(u.status, 'active') = 'active'
      ORDER BY u.full_name ASC
    `)

    const allTeamMembers = rows<{
      team_id: number
      id: number
      full_name: string
      email: string | null
      role: string
    }>(allTeamMembersResult)

    const teamsWithMembers = teams.map((team) => ({
      ...team,
      members: allTeamMembers
        .filter((member) => member.team_id === team.id)
        .map(({ team_id, ...member }) => member),
    }))

    const selectedUser = selectedTeamMembers.find((member) => member.id === selectedUserId) || null

    const projectFilter = requestedProjectId && requestedProjectId !== "all" ? requestedProjectId : null

    const projectResult = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, selectedUserId)
      .query(`
        SELECT DISTINCT
          CAST(p.id AS varchar(50)) AS id,
          p.name
        FROM dbo.Projects p
        LEFT JOIN dbo.Tasks t
          ON t.company_id = p.company_id
         AND CAST(t.project_id AS varchar(50)) = CAST(p.id AS varchar(50))
        LEFT JOIN dbo.Tickets tk
          ON tk.company_id = p.company_id
         AND CAST(tk.project_id AS varchar(50)) = CAST(p.id AS varchar(50))
        WHERE p.company_id = @company_id
          AND (
            @user_id = 0
            OR t.assigned_to_user_id = @user_id
            OR tk.assigned_to_user_id = @user_id
          )
        ORDER BY p.name ASC
      `)

    const statsResult = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, selectedUserId)
      .input("project_id", sql.VarChar(50), projectFilter)
      .query(`
        SELECT
          (SELECT COUNT(*)
             FROM dbo.Tasks t
            WHERE t.company_id = @company_id
              AND (@user_id = 0 OR t.assigned_to_user_id = @user_id OR t.created_by_user_id = @user_id)
              AND (@project_id IS NULL OR CAST(t.project_id AS varchar(50)) = @project_id)
          ) AS total_tasks,
          (SELECT COUNT(*)
             FROM dbo.Tasks t
            WHERE t.company_id = @company_id
              AND LOWER(ISNULL(t.status, '')) IN ('completed', 'complete', 'done')
              AND (@user_id = 0 OR t.assigned_to_user_id = @user_id OR t.created_by_user_id = @user_id)
              AND (@project_id IS NULL OR CAST(t.project_id AS varchar(50)) = @project_id)
          ) AS completed_tasks,
          (SELECT COUNT(*)
             FROM dbo.Tasks t
            WHERE t.company_id = @company_id
              AND LOWER(ISNULL(t.status, '')) NOT IN ('completed', 'complete', 'done')
              AND (@user_id = 0 OR t.assigned_to_user_id = @user_id OR t.created_by_user_id = @user_id)
              AND (@project_id IS NULL OR CAST(t.project_id AS varchar(50)) = @project_id)
          ) AS open_tasks,
          (SELECT COUNT(*)
             FROM dbo.Tasks t
            WHERE t.company_id = @company_id
              AND LOWER(ISNULL(t.priority, '')) = 'high'
              AND (@user_id = 0 OR t.assigned_to_user_id = @user_id OR t.created_by_user_id = @user_id)
              AND (@project_id IS NULL OR CAST(t.project_id AS varchar(50)) = @project_id)
          ) AS high_priority_tasks,
          (SELECT COUNT(*)
             FROM dbo.Tasks t
            WHERE t.company_id = @company_id
              AND (LOWER(ISNULL(t.status, '')) = 'blocked' OR ISNULL(t.is_blocked, 0) = 1)
              AND (@user_id = 0 OR t.assigned_to_user_id = @user_id OR t.created_by_user_id = @user_id)
              AND (@project_id IS NULL OR CAST(t.project_id AS varchar(50)) = @project_id)
          ) AS blocked_tasks,
          (SELECT COUNT(*)
             FROM dbo.Tickets tk
            WHERE tk.company_id = @company_id
              AND (@user_id = 0 OR tk.assigned_to_user_id = @user_id OR tk.reporter_user_id = @user_id)
              AND (@project_id IS NULL OR CAST(tk.project_id AS varchar(50)) = @project_id)
          ) AS total_tickets,
          (SELECT COUNT(*)
             FROM dbo.Tickets tk
            WHERE tk.company_id = @company_id
              AND LOWER(ISNULL(tk.status, '')) IN ('open', 'in-progress', 'in progress')
              AND (@user_id = 0 OR tk.assigned_to_user_id = @user_id OR tk.reporter_user_id = @user_id)
              AND (@project_id IS NULL OR CAST(tk.project_id AS varchar(50)) = @project_id)
          ) AS open_tickets,
          (SELECT COUNT(*)
             FROM dbo.Tickets tk
            WHERE tk.company_id = @company_id
              AND LOWER(ISNULL(tk.status, '')) IN ('resolved', 'closed', 'completed')
              AND (@user_id = 0 OR tk.assigned_to_user_id = @user_id OR tk.reporter_user_id = @user_id)
              AND (@project_id IS NULL OR CAST(tk.project_id AS varchar(50)) = @project_id)
          ) AS resolved_tickets,
          (SELECT COUNT(*)
             FROM dbo.Tickets tk
            WHERE tk.company_id = @company_id
              AND LOWER(ISNULL(tk.priority, '')) = 'urgent'
              AND (@user_id = 0 OR tk.assigned_to_user_id = @user_id OR tk.reporter_user_id = @user_id)
              AND (@project_id IS NULL OR CAST(tk.project_id AS varchar(50)) = @project_id)
          ) AS urgent_tickets
      `)

    const tasksResult = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, selectedUserId)
      .input("project_id", sql.VarChar(50), projectFilter)
      .query(`
        SELECT TOP 60
          t.id,
          COALESCE(t.task_code, CONCAT('ID ', RIGHT('000' + CAST(t.id AS varchar(10)), 3))) AS code,
          t.title,
          t.description,
          t.status,
          ISNULL(t.priority, 'medium') AS priority,
          t.project_id,
          p.name AS project_name,
          t.due_date,
          t.created_at,
          ISNULL(t.is_blocked, 0) AS is_blocked,
          t.block_reason
        FROM dbo.Tasks t
        LEFT JOIN dbo.Projects p
          ON p.company_id = t.company_id
         AND CAST(p.id AS varchar(50)) = CAST(t.project_id AS varchar(50))
        WHERE t.company_id = @company_id
          AND ISNULL(t.is_deleted, 0) = 0
          AND (@user_id = 0 OR t.assigned_to_user_id = @user_id OR t.created_by_user_id = @user_id)
          AND (@project_id IS NULL OR CAST(t.project_id AS varchar(50)) = @project_id)
        ORDER BY COALESCE(t.updated_at, t.created_at) DESC
      `)

    const ticketsResult = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, selectedUserId)
      .input("project_id", sql.VarChar(50), projectFilter)
      .query(`
        SELECT TOP 60
          tk.id,
          COALESCE(tk.ticket_code, CONCAT('TCK ', RIGHT('000' + CAST(tk.id AS varchar(10)), 3))) AS code,
          tk.title,
          tk.description,
          tk.status,
          ISNULL(tk.priority, 'medium') AS priority,
          tk.project_id,
          p.name AS project_name,
          tk.due_date,
          tk.created_at,
          CAST(0 AS bit) AS is_blocked,
          CAST(NULL AS varchar(max)) AS block_reason
        FROM dbo.Tickets tk
        LEFT JOIN dbo.Projects p
          ON p.company_id = tk.company_id
         AND CAST(p.id AS varchar(50)) = CAST(tk.project_id AS varchar(50))
        WHERE tk.company_id = @company_id
          AND (@user_id = 0 OR tk.assigned_to_user_id = @user_id OR tk.reporter_user_id = @user_id)
          AND (@project_id IS NULL OR CAST(tk.project_id AS varchar(50)) = @project_id)
        ORDER BY COALESCE(tk.updated_at, tk.created_at) DESC
      `)

    const activityResult = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, selectedUserId)
      .input("project_id", sql.VarChar(50), projectFilter)
      .query(`
        ;WITH days AS (
          SELECT CAST(DATEADD(day, -6, CAST(GETDATE() AS date)) AS date) AS activity_date
          UNION ALL
          SELECT DATEADD(day, 1, activity_date)
          FROM days
          WHERE activity_date < CAST(GETDATE() AS date)
        )
        SELECT
          FORMAT(d.activity_date, 'ddd') AS label,
          ISNULL(tasks.total, 0) AS tasks,
          ISNULL(tickets.total, 0) AS tickets
        FROM days d
        OUTER APPLY (
          SELECT COUNT(*) AS total
          FROM dbo.Tasks t
          WHERE t.company_id = @company_id
            AND CAST(t.created_at AS date) = d.activity_date
            AND (@user_id = 0 OR t.assigned_to_user_id = @user_id OR t.created_by_user_id = @user_id)
            AND (@project_id IS NULL OR CAST(t.project_id AS varchar(50)) = @project_id)
        ) tasks
        OUTER APPLY (
          SELECT COUNT(*) AS total
          FROM dbo.Tickets tk
          WHERE tk.company_id = @company_id
            AND CAST(tk.created_at AS date) = d.activity_date
            AND (@user_id = 0 OR tk.assigned_to_user_id = @user_id OR tk.reporter_user_id = @user_id)
            AND (@project_id IS NULL OR CAST(tk.project_id AS varchar(50)) = @project_id)
        ) tickets
        OPTION (MAXRECURSION 7)
      `)

    const weeklyResult = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, selectedUserId)
      .input("project_id", sql.VarChar(50), projectFilter)
      .query(`
        ;WITH weeks AS (
          SELECT 0 AS n
          UNION ALL SELECT n + 1 FROM weeks WHERE n < 3
        )
        SELECT
          CONCAT('Week ', 4 - n) AS label,
          (SELECT COUNT(*) FROM dbo.Tasks t WHERE t.company_id = @company_id AND t.created_at >= DATEADD(day, -7 * (n + 1), GETDATE()) AND t.created_at < DATEADD(day, -7 * n, GETDATE()) AND (@user_id = 0 OR t.assigned_to_user_id = @user_id OR t.created_by_user_id = @user_id) AND (@project_id IS NULL OR CAST(t.project_id AS varchar(50)) = @project_id)) AS tasks,
          (SELECT COUNT(*) FROM dbo.Tickets tk WHERE tk.company_id = @company_id AND tk.created_at >= DATEADD(day, -7 * (n + 1), GETDATE()) AND tk.created_at < DATEADD(day, -7 * n, GETDATE()) AND (@user_id = 0 OR tk.assigned_to_user_id = @user_id OR tk.reporter_user_id = @user_id) AND (@project_id IS NULL OR CAST(tk.project_id AS varchar(50)) = @project_id)) AS tickets
        FROM weeks
        ORDER BY n DESC
      `)

    const monthlyResult = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, selectedUserId)
      .input("project_id", sql.VarChar(50), projectFilter)
      .query(`
        ;WITH months AS (
          SELECT 0 AS n
          UNION ALL SELECT n + 1 FROM months WHERE n < 5
        )
        SELECT
          FORMAT(DATEADD(month, -n, GETDATE()), 'MMM') AS label,
          (SELECT COUNT(*) FROM dbo.Tasks t WHERE t.company_id = @company_id AND YEAR(t.created_at) = YEAR(DATEADD(month, -n, GETDATE())) AND MONTH(t.created_at) = MONTH(DATEADD(month, -n, GETDATE())) AND (@user_id = 0 OR t.assigned_to_user_id = @user_id OR t.created_by_user_id = @user_id) AND (@project_id IS NULL OR CAST(t.project_id AS varchar(50)) = @project_id)) AS tasks,
          (SELECT COUNT(*) FROM dbo.Tickets tk WHERE tk.company_id = @company_id AND YEAR(tk.created_at) = YEAR(DATEADD(month, -n, GETDATE())) AND MONTH(tk.created_at) = MONTH(DATEADD(month, -n, GETDATE())) AND (@user_id = 0 OR tk.assigned_to_user_id = @user_id OR tk.reporter_user_id = @user_id) AND (@project_id IS NULL OR CAST(tk.project_id AS varchar(50)) = @project_id)) AS tickets
        FROM months
        ORDER BY n DESC
      `)

    return NextResponse.json({
      selected_team_id: selectedTeamId,
      selected_user: selectedUser,
      teams: teamsWithMembers,
      projects: rows(projectResult),
      stats: rows(statsResult)[0],
      tasks: rows(tasksResult),
      tickets: rows(ticketsResult),
      activity: {
        daily: rows(activityResult),
        weekly: rows(weeklyResult),
        monthly: rows(monthlyResult),
      },
    })
  } catch (error) {
    console.error("Failed to load company overview:", error)
    return NextResponse.json({ error: "Failed to load company overview" }, { status: 500 })
  }
}
