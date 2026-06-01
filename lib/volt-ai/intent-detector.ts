export type VoltIntent =
  | "overdue_tasks"
  | "open_tasks"
  | "high_priority_tasks"
  | "open_tickets"
  | "high_priority_tickets"
  | "today_focus"
  | "ticket_summary"
  | "task_summary"
  | "unknown"

export function detectIntent(message: string): VoltIntent {
  const text = message.toLowerCase().trim()

  const includesAny = (words: string[]) =>
    words.some((word) => text.includes(word))

  if (
    includesAny([
      "overdue",
      "late",
      "past due",
      "behind",
      "falling behind",
      "missed",
    ])
  ) {
    return "overdue_tasks"
  }

  if (
    includesAny([
      "focus",
      "priority today",
      "what should i do",
      "what must i do",
      "attention today",
      "important today",
    ])
  ) {
    return "today_focus"
  }

  if (
    includesAny(["high priority task", "urgent task", "important task"])
  ) {
    return "high_priority_tasks"
  }

  if (
    includesAny(["high priority ticket", "urgent ticket", "important ticket"])
  ) {
    return "high_priority_tickets"
  }

  if (
    includesAny(["open tasks", "my tasks", "tasks", "task list"])
  ) {
    return "open_tasks"
  }

  if (
    includesAny(["open tickets", "tickets", "ticket list", "support tickets"])
  ) {
    return "open_tickets"
  }

  if (
    includesAny(["summarize tasks", "task summary", "summary of tasks"])
  ) {
    return "task_summary"
  }

  if (
    includesAny(["summarize tickets", "ticket summary", "summary of tickets"])
  ) {
    return "ticket_summary"
  }

  return "unknown"
}