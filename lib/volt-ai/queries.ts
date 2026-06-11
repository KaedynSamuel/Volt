import { getDbPool } from "@/lib/server/volt-schema"
import sql from "mssql"

export type TaskRow = {
  id: number | string
  title: string
  description?: string | null
  status: string
  priority?: string | null
  due_date?: string | null
  assignee_name?: string | null
  created_at?: string | null
}

export type TicketRow = {
  id: number | string
  title: string
  description?: string | null
  status: string
  priority?: string | null
  assignee_name?: string | null
  created_at?: string | null
}

export type UserRow = {
  id: number
  full_name: string
  email: string
  role: string
}

// ── READ queries (scoped by companyId + optionally userId) ──────

export async function getMyTasks(companyId: number, userId: number): Promise<TaskRow[]> {
  const pool = await getDbPool()
  const result = await pool.request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT TOP 15 t.id, t.title, t.status, t.priority, t.due_date, t.created_at,
             u.full_name AS assignee_name
      FROM dbo.Tasks t
      LEFT JOIN dbo.AppUsers u ON u.id = t.assignee_id
      WHERE t.company_id = @company_id AND t.assignee_id = @user_id
        AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
        AND LOWER(t.status) NOT IN ('completed','done','closed')
      ORDER BY t.due_date ASC
    `)
  return result.recordset
}

export async function getMyOverdueTasks(companyId: number, userId: number): Promise<TaskRow[]> {
  const pool = await getDbPool()
  const result = await pool.request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT TOP 15 t.id, t.title, t.status, t.priority, t.due_date, t.created_at,
             u.full_name AS assignee_name
      FROM dbo.Tasks t
      LEFT JOIN dbo.AppUsers u ON u.id = t.assignee_id
      WHERE t.company_id = @company_id AND t.assignee_id = @user_id
        AND t.due_date < GETDATE()
        AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
        AND LOWER(t.status) NOT IN ('completed','done','closed')
      ORDER BY t.due_date ASC
    `)
  return result.recordset
}

export async function getMyHighPriorityTasks(companyId: number, userId: number): Promise<TaskRow[]> {
  const pool = await getDbPool()
  const result = await pool.request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT TOP 15 t.id, t.title, t.status, t.priority, t.due_date, t.created_at
      FROM dbo.Tasks t
      WHERE t.company_id = @company_id AND t.assignee_id = @user_id
        AND LOWER(t.priority) IN ('high','urgent','critical')
        AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
        AND LOWER(t.status) NOT IN ('completed','done','closed')
      ORDER BY t.due_date ASC
    `)
  return result.recordset
}

export async function getMyTickets(companyId: number, userId: number): Promise<TicketRow[]> {
  const pool = await getDbPool()
  const result = await pool.request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT TOP 15 t.id, t.title, t.status, t.priority, t.created_at,
             u.full_name AS assignee_name
      FROM dbo.Tickets t
      LEFT JOIN dbo.AppUsers u ON u.id = t.assignee_id
      WHERE t.company_id = @company_id
        AND (t.assignee_id = @user_id OR t.reporter_id = @user_id)
        AND LOWER(t.status) NOT IN ('closed','resolved','completed','done')
      ORDER BY t.created_at DESC
    `)
  return result.recordset
}

// ── ADMIN+ only queries ─────────────────────────────────────────

export async function getAllTasksForCompany(companyId: number): Promise<TaskRow[]> {
  const pool = await getDbPool()
  const result = await pool.request()
    .input("company_id", sql.Int, companyId)
    .query(`
      SELECT TOP 20 t.id, t.title, t.status, t.priority, t.due_date, t.created_at,
             u.full_name AS assignee_name
      FROM dbo.Tasks t
      LEFT JOIN dbo.AppUsers u ON u.id = t.assignee_id
      WHERE t.company_id = @company_id
        AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
        AND LOWER(t.status) NOT IN ('completed','done','closed')
      ORDER BY t.due_date ASC
    `)
  return result.recordset
}

export async function getAllTicketsForCompany(companyId: number): Promise<TicketRow[]> {
  const pool = await getDbPool()
  const result = await pool.request()
    .input("company_id", sql.Int, companyId)
    .query(`
      SELECT TOP 20 t.id, t.title, t.status, t.priority, t.created_at,
             u.full_name AS assignee_name
      FROM dbo.Tickets t
      LEFT JOIN dbo.AppUsers u ON u.id = t.assignee_id
      WHERE t.company_id = @company_id
        AND LOWER(t.status) NOT IN ('closed','resolved','completed','done')
      ORDER BY t.created_at DESC
    `)
  return result.recordset
}

export async function getCompanyStats(companyId: number) {
  const pool = await getDbPool()
  const [taskStats, ticketStats, userStats] = await Promise.all([
    pool.request().input("company_id", sql.Int, companyId).query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN LOWER(status) IN ('completed','done','closed') THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN due_date < GETDATE() AND LOWER(status) NOT IN ('completed','done','closed') THEN 1 ELSE 0 END) AS overdue
      FROM dbo.Tasks WHERE company_id = @company_id AND (is_deleted = 0 OR is_deleted IS NULL)
    `),
    pool.request().input("company_id", sql.Int, companyId).query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN LOWER(status) IN ('resolved','closed','completed','done') THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN LOWER(priority) IN ('high','urgent','critical') AND LOWER(status) NOT IN ('resolved','closed','completed','done') THEN 1 ELSE 0 END) AS high_priority_open
      FROM dbo.Tickets WHERE company_id = @company_id
    `),
    pool.request().input("company_id", sql.Int, companyId).query(`
      SELECT COUNT(*) AS total FROM dbo.AppUsers WHERE company_id = @company_id AND status = 'active'
    `)
  ])
  return {
    tasks: taskStats.recordset[0],
    tickets: ticketStats.recordset[0],
    users: userStats.recordset[0],
  }
}

export async function getCompanyUsers(companyId: number): Promise<UserRow[]> {
  const pool = await getDbPool()
  const result = await pool.request()
    .input("company_id", sql.Int, companyId)
    .query(`
      SELECT id, full_name, email, role
      FROM dbo.AppUsers
      WHERE company_id = @company_id AND status = 'active'
      ORDER BY full_name ASC
    `)
  return result.recordset
}

export async function findUserByName(companyId: number, name: string): Promise<UserRow | null> {
  const pool = await getDbPool()
  const result = await pool.request()
    .input("company_id", sql.Int, companyId)
    .input("name", sql.NVarChar(200), `%${name}%`)
    .query(`
      SELECT TOP 1 id, full_name, email, role
      FROM dbo.AppUsers
      WHERE company_id = @company_id AND status = 'active'
        AND full_name LIKE @name
    `)
  return result.recordset[0] || null
}

// ── WRITE operations ────────────────────────────────────────────

export async function createTicketForAI(
  companyId: number,
  createdByUserId: number,
  title: string,
  priority: string,
  assigneeId?: number
) {
  const pool = await getDbPool()
  const result = await pool.request()
    .input("company_id", sql.Int, companyId)
    .input("title", sql.NVarChar(500), title)
    .input("status", sql.NVarChar(50), "open")
    .input("priority", sql.NVarChar(50), priority)
    .input("reporter_id", sql.Int, createdByUserId)
    .input("assignee_id", sql.Int, assigneeId || createdByUserId)
    .query(`
      INSERT INTO dbo.Tickets (company_id, title, status, priority, reporter_id, assignee_id, created_at)
      OUTPUT inserted.id, inserted.title, inserted.status, inserted.priority
      VALUES (@company_id, @title, @status, @priority, @reporter_id, @assignee_id, SYSUTCDATETIME())
    `)
  return result.recordset[0]
}

export async function createTaskForAI(
  companyId: number,
  createdByUserId: number,
  title: string,
  priority: string,
  assigneeId?: number,
  dueDate?: string
) {
  const pool = await getDbPool()
  const result = await pool.request()
    .input("company_id", sql.Int, companyId)
    .input("title", sql.NVarChar(500), title)
    .input("status", sql.NVarChar(50), "todo")
    .input("priority", sql.NVarChar(50), priority)
    .input("created_by", sql.Int, createdByUserId)
    .input("assignee_id", sql.Int, assigneeId || createdByUserId)
    .input("due_date", sql.DateTime, dueDate ? new Date(dueDate) : null)
    .query(`
      INSERT INTO dbo.Tasks (company_id, title, status, priority, created_by, assignee_id, due_date, created_at)
      OUTPUT inserted.id, inserted.title, inserted.status, inserted.priority
      VALUES (@company_id, @title, @status, @priority, @created_by, @assignee_id, @due_date, SYSUTCDATETIME())
    `)
  return result.recordset[0]
}

export async function completeTaskForAI(companyId: number, userId: number, titleSearch: string) {
  const pool = await getDbPool()
  // Find the task first
  const found = await pool.request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .input("title", sql.NVarChar(500), `%${titleSearch}%`)
    .query(`
      SELECT TOP 1 id, title FROM dbo.Tasks
      WHERE company_id = @company_id AND assignee_id = @user_id
        AND title LIKE @title
        AND LOWER(status) NOT IN ('completed','done','closed')
        AND (is_deleted = 0 OR is_deleted IS NULL)
    `)
  const task = found.recordset[0]
  if (!task) return null

  await pool.request()
    .input("id", sql.Int, task.id)
    .input("company_id", sql.Int, companyId)
    .query(`
      UPDATE dbo.Tasks
      SET status = 'completed', completed_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
      WHERE id = @id AND company_id = @company_id
    `)
  return task
}

// legacy compat
export async function getOverdueTasks() { return [] }
export async function getOpenTasks() { return [] }
export async function getHighPriorityTasks() { return [] }
export async function getOpenTickets() { return [] }
export async function getHighPriorityTickets() { return [] }
export async function getTodayFocusData() { return { overdueTasks: [], highPriorityTasks: [], highPriorityTickets: [] } }
