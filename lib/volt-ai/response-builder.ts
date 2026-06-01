import type { VoltIntent } from "./intent-detector"
import type { TaskRow, TicketRow } from "./queries"

function formatDate(date?: string | null) {
  if (!date) return "No due date"

  try {
    return new Date(date).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return date
  }
}

function formatTaskList(tasks: TaskRow[]) {
  if (!tasks.length) {
    return "I could not find any matching tasks in Volt."
  }

  return tasks
    .map((task, index) => {
      return `${index + 1}. ${task.title}
   Status: ${task.status}
   Priority: ${task.priority || "Not set"}
   Due: ${formatDate(task.due_date)}`
    })
    .join("\n\n")
}

function formatTicketList(tickets: TicketRow[]) {
  if (!tickets.length) {
    return "I could not find any matching tickets in Volt."
  }

  return tickets
    .map((ticket, index) => {
      return `${index + 1}. ${ticket.title}
   Status: ${ticket.status}
   Priority: ${ticket.priority || "Not set"}`
    })
    .join("\n\n")
}

export function buildResponse(intent: VoltIntent, data: any) {
  switch (intent) {
    case "overdue_tasks":
      return `Here are the overdue tasks I found:\n\n${formatTaskList(data)}`

    case "open_tasks":
      return `Here are the open tasks I found:\n\n${formatTaskList(data)}`

    case "high_priority_tasks":
      return `Here are the high-priority tasks I found:\n\n${formatTaskList(data)}`

    case "open_tickets":
      return `Here are the open tickets I found:\n\n${formatTicketList(data)}`

    case "high_priority_tickets":
      return `Here are the high-priority tickets I found:\n\n${formatTicketList(data)}`

    case "task_summary":
      return buildTaskSummary(data)

    case "ticket_summary":
      return buildTicketSummary(data)

    case "today_focus":
      return buildTodayFocusResponse(data)

    default:
      return `I can help with tickets and tasks, but I could not understand that request yet.

Try asking something like:
- Show overdue tasks
- Show open tickets
- What should I focus on today?
- Show high priority tasks
- Summarize my tickets`
  }
}

function buildTaskSummary(tasks: TaskRow[]) {
  if (!tasks.length) {
    return "I could not find any open tasks to summarize."
  }

  const high = tasks.filter((task) =>
    ["high", "urgent", "critical"].includes(
      String(task.priority || "").toLowerCase()
    )
  )

  return `Task Summary:

Total open tasks found: ${tasks.length}
High-priority tasks: ${high.length}

Top tasks:
${formatTaskList(tasks.slice(0, 5))}`
}

function buildTicketSummary(tickets: TicketRow[]) {
  if (!tickets.length) {
    return "I could not find any open tickets to summarize."
  }

  const high = tickets.filter((ticket) =>
    ["high", "urgent", "critical"].includes(
      String(ticket.priority || "").toLowerCase()
    )
  )

  return `Ticket Summary:

Total open tickets found: ${tickets.length}
High-priority tickets: ${high.length}

Top tickets:
${formatTicketList(tickets.slice(0, 5))}`
}

function buildTodayFocusResponse(data: {
  overdueTasks: TaskRow[]
  highPriorityTasks: TaskRow[]
  highPriorityTickets: TicketRow[]
}) {
  const { overdueTasks, highPriorityTasks, highPriorityTickets } = data

  if (
    !overdueTasks.length &&
    !highPriorityTasks.length &&
    !highPriorityTickets.length
  ) {
    return "I could not find anything urgent in Volt right now."
  }

  let response = "Here is what you should focus on first:\n\n"

  if (overdueTasks.length) {
    response += `1. Overdue Tasks\n${formatTaskList(overdueTasks.slice(0, 3))}\n\n`
  }

  if (highPriorityTasks.length) {
    response += `2. High-Priority Tasks\n${formatTaskList(
      highPriorityTasks.slice(0, 3)
    )}\n\n`
  }

  if (highPriorityTickets.length) {
    response += `3. High-Priority Tickets\n${formatTicketList(
      highPriorityTickets.slice(0, 3)
    )}`
  }

  return response.trim()
}