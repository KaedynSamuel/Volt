import { NextResponse } from "next/server"
import { detectIntent } from "@/lib/volt-ai/intent-detector"
import { buildResponse } from "@/lib/volt-ai/response-builder"
import {
  getOverdueTasks,
  getOpenTasks,
  getHighPriorityTasks,
  getOpenTickets,
  getHighPriorityTickets,
  getTodayFocusData,
} from "@/lib/volt-ai/queries"

export async function POST(req: Request) {
  try {
    const { message } = await req.json()

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }

    const intent = detectIntent(message)

    let data: any = null

    switch (intent) {
      case "overdue_tasks":
        data = await getOverdueTasks()
        break

      case "open_tasks":
      case "task_summary":
        data = await getOpenTasks()
        break

      case "high_priority_tasks":
        data = await getHighPriorityTasks()
        break

      case "open_tickets":
      case "ticket_summary":
        data = await getOpenTickets()
        break

      case "high_priority_tickets":
        data = await getHighPriorityTickets()
        break

      case "today_focus":
        data = await getTodayFocusData()
        break

      default:
        data = null
        break
    }

    const answer = buildResponse(intent, data)

    return NextResponse.json({
      answer,
      intent,
    })
  } catch (error) {
    console.error("Volt AI Engine error:", error)

    return NextResponse.json(
      { error: "Volt AI Engine failed to respond" },
      { status: 500 }
    )
  }
}