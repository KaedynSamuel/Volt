import { query } from "@/lib/db"

export type TaskRow = {
  id: number | string
  title: string
  description?: string | null
  status: string
  priority?: string | null
  due_date?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type TicketRow = {
  id: number | string
  title: string
  description?: string | null
  status: string
  priority?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export async function getOverdueTasks() {
  return query<TaskRow>(`
    SELECT TOP 10
      id,
      title,
      description,
      status,
      priority,
      due_date,
      created_at,
      updated_at
    FROM tasks
    WHERE due_date < GETDATE()
      AND LOWER(status) NOT IN ('completed', 'done', 'closed')
    ORDER BY due_date ASC
  `)
}

export async function getOpenTasks() {
  return query<TaskRow>(`
    SELECT TOP 10
      id,
      title,
      description,
      status,
      priority,
      due_date,
      created_at,
      updated_at
    FROM tasks
    WHERE LOWER(status) NOT IN ('completed', 'done', 'closed')
    ORDER BY 
      CASE 
        WHEN LOWER(priority) = 'high' THEN 1
        WHEN LOWER(priority) = 'medium' THEN 2
        WHEN LOWER(priority) = 'low' THEN 3
        ELSE 4
      END,
      due_date ASC
  `)
}

export async function getHighPriorityTasks() {
  return query<TaskRow>(`
    SELECT TOP 10
      id,
      title,
      description,
      status,
      priority,
      due_date,
      created_at,
      updated_at
    FROM tasks
    WHERE LOWER(priority) IN ('high', 'urgent', 'critical')
      AND LOWER(status) NOT IN ('completed', 'done', 'closed')
    ORDER BY due_date ASC
  `)
}

export async function getOpenTickets() {
  return query<TicketRow>(`
    SELECT TOP 10
      id,
      title,
      description,
      status,
      priority,
      created_at,
      updated_at
    FROM tickets
    WHERE LOWER(status) NOT IN ('closed', 'resolved', 'completed', 'done')
    ORDER BY updated_at DESC
  `)
}

export async function getHighPriorityTickets() {
  return query<TicketRow>(`
    SELECT TOP 10
      id,
      title,
      description,
      status,
      priority,
      created_at,
      updated_at
    FROM tickets
    WHERE LOWER(priority) IN ('high', 'urgent', 'critical')
      AND LOWER(status) NOT IN ('closed', 'resolved', 'completed', 'done')
    ORDER BY updated_at DESC
  `)
}

export async function getTodayFocusData() {
  const overdueTasks = await getOverdueTasks()
  const highPriorityTasks = await getHighPriorityTasks()
  const highPriorityTickets = await getHighPriorityTickets()

  return {
    overdueTasks,
    highPriorityTasks,
    highPriorityTickets,
  }
}