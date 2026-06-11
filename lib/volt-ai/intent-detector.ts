export type VoltIntent =
  // READ — all roles
  | "overdue_tasks"
  | "open_tasks"
  | "high_priority_tasks"
  | "open_tickets"
  | "high_priority_tickets"
  | "today_focus"
  | "ticket_summary"
  | "task_summary"
  | "my_progress"
  // READ — admin+ only
  | "company_progress"
  | "team_overview"
  | "all_users"
  // WRITE — create/update operations
  | "create_ticket"
  | "create_task"
  | "complete_task"
  | "assign_task"
  | "assign_ticket"
  // GENERAL
  | "help"
  | "unknown"

export type ParsedAction = {
  intent: VoltIntent
  params: Record<string, string>
}

export function detectIntent(message: string): ParsedAction {
  const text = message.toLowerCase().trim()

  const includes = (words: string[]) => words.some((w) => text.includes(w))

  // ── WRITE: create ticket ──
  if (
    includes(["create a ticket", "make a ticket", "open a ticket", "raise a ticket",
               "new ticket", "submit a ticket", "log a ticket", "create ticket"])
  ) {
    return { intent: "create_ticket", params: parseTicketParams(message) }
  }

  // ── WRITE: create task ──
  if (
    includes(["create a task", "make a task", "add a task", "new task",
               "create task", "add task"])
  ) {
    return { intent: "create_task", params: parseTaskParams(message) }
  }

  // ── WRITE: complete task ──
  if (
    includes(["complete task", "mark task", "finish task", "close task",
               "done with task", "complete the task", "mark as done", "mark as complete",
               "set task to complete", "set to done"])
  ) {
    return { intent: "complete_task", params: parseTitleParam(message) }
  }

  // ── WRITE: assign task ──
  if (
    includes(["assign task", "assign the task", "give task to", "reassign task"])
  ) {
    return { intent: "assign_task", params: parseAssignParams(message) }
  }

  // ── WRITE: assign ticket ──
  if (
    includes(["assign ticket", "assign the ticket", "give ticket to", "reassign ticket"])
  ) {
    return { intent: "assign_ticket", params: parseAssignParams(message) }
  }

  // ── READ: company/team (admin+ only) ──
  if (
    includes(["company progress", "company overview", "how is the company",
               "company performance", "overall progress", "business overview"])
  ) {
    return { intent: "company_progress", params: {} }
  }

  if (
    includes(["team overview", "team progress", "how is the team", "team performance",
               "team status", "all tasks", "everyone's tasks"])
  ) {
    return { intent: "team_overview", params: {} }
  }

  if (includes(["list users", "show users", "all users", "team members", "who is on the team"])) {
    return { intent: "all_users", params: {} }
  }

  // ── READ: personal ──
  if (includes(["overdue", "late", "past due", "behind", "missed deadline"])) {
    return { intent: "overdue_tasks", params: {} }
  }

  if (includes(["focus", "what should i do", "what must i do", "priority today", "attention today"])) {
    return { intent: "today_focus", params: {} }
  }

  if (includes(["my progress", "how am i doing", "my stats", "my xp", "my achievements"])) {
    return { intent: "my_progress", params: {} }
  }

  if (includes(["high priority task", "urgent task", "important task", "critical task"])) {
    return { intent: "high_priority_tasks", params: {} }
  }

  if (includes(["high priority ticket", "urgent ticket", "important ticket", "critical ticket"])) {
    return { intent: "high_priority_tickets", params: {} }
  }

  if (includes(["my tasks", "open tasks", "task list", "show tasks", "show my tasks"])) {
    return { intent: "open_tasks", params: {} }
  }

  if (includes(["my tickets", "open tickets", "ticket list", "show tickets", "show my tickets"])) {
    return { intent: "open_tickets", params: {} }
  }

  if (includes(["task summary", "summarize tasks", "summary of tasks"])) {
    return { intent: "task_summary", params: {} }
  }

  if (includes(["ticket summary", "summarize tickets", "summary of tickets"])) {
    return { intent: "ticket_summary", params: {} }
  }

  if (includes(["help", "what can you do", "how do i", "commands", "what can volty"])) {
    return { intent: "help", params: {} }
  }

  return { intent: "unknown", params: {} }
}

// ── param parsers ──────────────────────────────────────────────

function parseTicketParams(text: string): Record<string, string> {
  const params: Record<string, string> = {}

  // title: look for "called X" or "titled X" or quoted text
  const calledMatch = text.match(/(?:called|titled|named)\s+"?([^"]+?)"?(?:\s+(?:and|for|assigned|priority|urgent|high|low|medium|critical)|$)/i)
  if (calledMatch) params.title = calledMatch[1].trim()

  // assignee: "for X" or "assign to X" or "assigned to X"
  const forMatch = text.match(/(?:for|assign(?:ed)?\s+to)\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\s+(?:called|titled|named|and|priority|urgent|high|low|medium|critical)|$)/i)
  if (forMatch) params.assignee = forMatch[1].trim()

  // priority
  params.priority = parsePriority(text)

  return params
}

function parseTaskParams(text: string): Record<string, string> {
  const params: Record<string, string> = {}

  const calledMatch = text.match(/(?:called|titled|named)\s+"?([^"]+?)"?(?:\s+(?:and|for|assigned|priority|urgent|high|low|medium|critical)|$)/i)
  if (calledMatch) params.title = calledMatch[1].trim()

  const forMatch = text.match(/(?:for|assign(?:ed)?\s+to)\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\s+(?:called|titled|named|and|priority|urgent|high|low|medium|critical)|$)/i)
  if (forMatch) params.assignee = forMatch[1].trim()

  params.priority = parsePriority(text)

  // due date
  const dueMatch = text.match(/due\s+(?:on\s+)?([A-Za-z0-9\s,]+?)(?:\s+and|\s+assign|$)/i)
  if (dueMatch) params.dueDate = dueMatch[1].trim()

  return params
}

function parseTitleParam(text: string): Record<string, string> {
  const match = text.match(/(?:called|titled|named|task)\s+"?([^"]+?)"?(?:\s|$)/i)
  return match ? { title: match[1].trim() } : {}
}

function parseAssignParams(text: string): Record<string, string> {
  const params: Record<string, string> = {}
  const toMatch = text.match(/(?:assign(?:ed)?\s+to|give\s+(?:it\s+)?to)\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\s|$)/i)
  if (toMatch) params.assignee = toMatch[1].trim()

  const titleMatch = text.match(/(?:task|ticket)\s+"?([^"]+?)"?(?:\s+to|\s+assign|$)/i)
  if (titleMatch) params.title = titleMatch[1].trim()

  return params
}

function parsePriority(text: string): string {
  const t = text.toLowerCase()
  if (t.includes("critical") || t.includes("critical")) return "critical"
  if (t.includes("urgent")) return "urgent"
  if (t.includes("high")) return "high"
  if (t.includes("low")) return "low"
  return "medium"
}
