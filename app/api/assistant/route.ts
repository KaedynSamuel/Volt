import { NextResponse } from "next/server"
import {
  getMyTasks, getMyOverdueTasks, getMyHighPriorityTasks, getMyTickets,
  getAllTasksForCompany, getAllTicketsForCompany, getCompanyStats,
  getCompanyUsers, findUserByName,
  createTicketForAI, createTaskForAI, completeTaskForAI,
} from "@/lib/volt-ai/queries"

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = process.env.GROQ_MODEL || "llama3-70b-8192"
const ADMIN_ROLES = ["admin", "creator", "business_owner"]

function isAdmin(role: string) {
  return ADMIN_ROLES.includes(role?.toLowerCase())
}

// ── Step 1: Ask Groq to understand the intent + extract params ──
// Returns a clean JSON object regardless of how messy the input was
async function understandMessage(
  message: string,
  role: string,
  userName: string,
  companyName: string
): Promise<{ intent: string; params: Record<string, string>; clarification?: string } | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null

  const adminUser = isAdmin(role)

  const systemPrompt = `You are an intent parser for Volt, a workplace task and ticket management app.
Your job is to understand what the user wants — even if they have terrible spelling, typos, or write casually.

The user is: ${userName}, role: ${role} at ${companyName}.

Available intents:
- open_tasks: user wants to see their tasks
- overdue_tasks: user wants to see late/overdue tasks
- high_priority_tasks: user wants urgent/high priority tasks
- open_tickets: user wants to see their tickets
- today_focus: user wants to know what to work on today
- my_progress: user wants their XP/achievements/stats
${adminUser ? `- company_progress: company-wide stats and overview (ADMIN ONLY)
- team_overview: all tasks/tickets across the team (ADMIN ONLY)
- all_users: list of team members (ADMIN ONLY)` : ""}
- create_ticket: user wants to create/make/open/raise a new ticket
- create_task: user wants to create/make/add a new task
- complete_task: user wants to mark/finish/complete a task as done
- assign_task: user wants to assign a task to someone
- help: user wants to know what Volty can do
- general: general question or advice, not a specific data/action request

For create_ticket and create_task extract:
- title: the name/title of the ticket or task (clean it up if spelled wrong)
- assignee: person's name if mentioned (e.g. "for Kaedyn", "assign to John")
- priority: urgent/high/medium/low/critical (default medium)
- dueDate: if a date is mentioned

For complete_task extract:
- title: the task name to search for

Respond ONLY with valid JSON, no explanation, no markdown. Example:
{"intent":"create_ticket","params":{"title":"Admin Services Help","assignee":"Kaedyn","priority":"urgent"}}`

  try {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.1, // low temp for consistent structured output
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return null
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content?.trim()
    if (!text) return null

    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, "").trim()
    return JSON.parse(clean)
  } catch {
    return null
  }
}

// ── Step 2: Ask Groq to generate the final answer ──
async function generateAnswer(
  message: string,
  intent: string,
  contextData: any,
  role: string,
  userName: string,
  companyName: string
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null

  const adminUser = isAdmin(role)

  const systemPrompt = `You are Volty ⚡, the AI assistant inside the Volt workspace platform.
You are talking to ${userName} (${role} at ${companyName}).

YOUR PERSONALITY:
- Energetic, friendly, direct and encouraging
- Use ⚡ occasionally but not every sentence
- Keep answers concise — no walls of text
- Use markdown: **bold**, bullet points, etc.
- Reference actual data when it's provided — don't make things up

YOUR SCOPE:
${adminUser
  ? `- Full company visibility: tasks, tickets, users, company stats
- Can see all team data and give company-level insights`
  : `- You can only see and act on ${userName}'s own tasks and tickets
- You cannot access other users' private data or company-wide stats
- If asked for restricted data, explain this politely`}

The intent was detected as: ${intent}
${contextData ? `\nWorkspace data:\n${JSON.stringify(contextData, null, 2)}` : ""}

Give a helpful, natural, human response based on the above data.
If it was an action (create/complete), confirm clearly what was done.
If it was a data request, summarise it clearly.
If it's a general question, give practical Volt-related advice.`

  try {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) return null
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    return typeof text === "string" && text.trim() ? text.trim() : null
  } catch {
    return null
  }
}

// ── Fallback rule-based answers (when Groq is unavailable) ──
function fallbackAnswer(intent: string, data: any, params: Record<string, string>): string {
  switch (intent) {
    case "help":
      return `Hey! I'm **Volty** ⚡\n\n**I understand natural language** — just talk to me normally, typos and all!\n\n**Read your data:**\n- "show my tasks" / "any overdue stuff?"\n- "what tickets do i have"\n- "what should i do today"\n\n**Take action:**\n- "make a ticket called Server Down urgent"\n- "create task called Update Docs for Kaedyn"\n- "complete the weekly report task"\n\n**Admins:**\n- "how is the company doing"\n- "team overview" / "list all users"`
    case "open_tasks":
      return data?.length
        ? `**${data.length} open tasks:**\n\n${data.map((t: any, i: number) => `${i + 1}. **${t.title}** — ${t.priority || "medium"} — Due: ${t.due_date ? new Date(t.due_date).toLocaleDateString("en-ZA") : "No date"}`).join("\n")}`
        : "No open tasks right now. Nice work! ⚡"
    case "overdue_tasks":
      return data?.length
        ? `⚠️ **${data.length} overdue tasks:**\n\n${data.map((t: any, i: number) => `${i + 1}. **${t.title}** — was due ${t.due_date ? new Date(t.due_date).toLocaleDateString("en-ZA") : "unknown"}`).join("\n")}\n\nGet these done first to stop losing XP.`
        : "No overdue tasks — you're on top of it! ⚡"
    case "open_tickets":
      return data?.length
        ? `**${data.length} open tickets:**\n\n${data.map((t: any, i: number) => `${i + 1}. **${t.title}** — ${t.priority || "medium"} — ${t.status}`).join("\n")}`
        : "No open tickets assigned to you."
    case "company_progress":
      return data
        ? `**Company Overview ⚡**\n\n**Tasks:** ${data.tasks?.completed || 0}/${data.tasks?.total || 0} completed — ${data.tasks?.overdue || 0} overdue\n**Tickets:** ${data.tickets?.resolved || 0}/${data.tickets?.total || 0} resolved — ${data.tickets?.high_priority_open || 0} high priority open\n**Active team members:** ${data.users?.total || 0}`
        : "No company data available."
    case "create_ticket":
      return data?.error ? `Couldn't create ticket: ${data.error}` : `✅ **Ticket created!**\n\n**"${data?.title}"**\nPriority: ${data?.priority} · Status: open\n\nIt's live in your tickets board.`
    case "create_task":
      return data?.error ? `Couldn't create task: ${data.error}` : `✅ **Task created!**\n\n**"${data?.title}"**\nPriority: ${data?.priority} · Status: todo\n\nIt's in your task list.`
    case "complete_task":
      return data?.error ? data.error : data ? `✅ **Done!** "${data.title}" marked complete. XP awarded ⚡` : `Couldn't find a task matching "${params.title}".`
    case "all_users":
      return data?.length ? `**Team (${data.length}):**\n\n${data.map((u: any) => `- **${u.full_name}** — ${u.role}`).join("\n")}` : "No team members found."
    default:
      return "I'm not sure how to help with that. Type **help** to see what I can do."
  }
}

// ── Main handler ──────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      message,
      userId,
      companyId,
      role = "employee",
      userName = "User",
      companyName = "your company",
    } = body

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }
    if (!userId || !companyId) {
      return NextResponse.json({ error: "Session required" }, { status: 401 })
    }

    const uid = Number(userId)
    const cid = Number(companyId)
    const adminUser = isAdmin(role)

    // ── Step 1: Understand the message (Groq does this, handles any spelling) ──
    const understood = await understandMessage(message, role, userName, companyName)

    // Fallback to basic keyword detection if Groq is unavailable
    const intent = understood?.intent || detectBasicIntent(message)
    const params = understood?.params || {}

    // ── Block employees from admin-only intents ──
    const adminOnlyIntents = ["company_progress", "team_overview", "all_users"]
    if (adminOnlyIntents.includes(intent) && !adminUser) {
      return NextResponse.json({
        answer: "You don't have access to company-wide data. Ask your admin if you need that info.",
        intent,
        action: false,
      })
    }

    // ── Step 2: Execute the intent ──
    let data: any = null
    let actionPerformed = false

    async function resolveAssignee(): Promise<number> {
      if (params.assignee) {
        const user = await findUserByName(cid, params.assignee)
        if (user) return user.id
      }
      return uid
    }

    switch (intent) {
      case "open_tasks":
      case "task_summary":
        data = await getMyTasks(cid, uid)
        break
      case "overdue_tasks":
        data = await getMyOverdueTasks(cid, uid)
        break
      case "high_priority_tasks":
        data = await getMyHighPriorityTasks(cid, uid)
        break
      case "open_tickets":
      case "ticket_summary":
        data = await getMyTickets(cid, uid)
        break
      case "today_focus": {
        const [overdue, hipri, tickets] = await Promise.all([
          getMyOverdueTasks(cid, uid),
          getMyHighPriorityTasks(cid, uid),
          getMyTickets(cid, uid),
        ])
        data = { overdue, highPriorityTasks: hipri, openTickets: tickets }
        break
      }
      case "company_progress":
        data = await getCompanyStats(cid)
        break
      case "team_overview": {
        const [allTasks, allTickets] = await Promise.all([
          getAllTasksForCompany(cid),
          getAllTicketsForCompany(cid),
        ])
        data = { tasks: allTasks, tickets: allTickets }
        break
      }
      case "all_users":
        data = await getCompanyUsers(cid)
        break
      case "create_ticket": {
        actionPerformed = true
        if (!params.title) {
          data = { error: "I need a title. Try: 'create a ticket called [name] urgent'" }
        } else {
          const assigneeId = await resolveAssignee()
          try {
            data = await createTicketForAI(cid, uid, params.title, params.priority || "medium", assigneeId)
          } catch (e: any) {
            data = { error: e?.message || "Database error" }
          }
        }
        break
      }
      case "create_task": {
        actionPerformed = true
        if (!params.title) {
          data = { error: "I need a title. Try: 'create a task called [name]'" }
        } else {
          const assigneeId = await resolveAssignee()
          try {
            data = await createTaskForAI(cid, uid, params.title, params.priority || "medium", assigneeId, params.dueDate)
          } catch (e: any) {
            data = { error: e?.message || "Database error" }
          }
        }
        break
      }
      case "complete_task": {
        actionPerformed = true
        const titleSearch = params.title || message.replace(/complete|mark|finish|task|done|the|as/gi, "").trim()
        try {
          data = await completeTaskForAI(cid, uid, titleSearch)
        } catch (e: any) {
          data = { error: e?.message }
        }
        break
      }
      default:
        data = null
    }

    // ── Step 3: Generate answer ──
    // For write actions — use Groq to confirm naturally, or fallback
    // For read/general — use Groq for a smart natural answer
    const groqAnswer = await generateAnswer(message, intent, data, role, userName, companyName)
    const answer = groqAnswer || fallbackAnswer(intent, data, params)

    return NextResponse.json({
      answer,
      intent,
      action: actionPerformed,
      aiPowered: !!groqAnswer,
    })
  } catch (error) {
    console.error("Volt AI Engine error:", error)
    return NextResponse.json({ error: "Volt AI Engine failed to respond" }, { status: 500 })
  }
}

// ── Very basic keyword fallback (only used if Groq API key not set) ──
function detectBasicIntent(message: string): string {
  const t = message.toLowerCase()
  if (t.includes("overdue") || t.includes("late")) return "overdue_tasks"
  if (t.includes("create") && t.includes("ticket")) return "create_ticket"
  if (t.includes("create") && t.includes("task")) return "create_task"
  if (t.includes("complete") || t.includes("finish") || t.includes("mark")) return "complete_task"
  if (t.includes("company") || t.includes("overview") || t.includes("progress")) return "company_progress"
  if (t.includes("ticket")) return "open_tickets"
  if (t.includes("task") || t.includes("todo")) return "open_tasks"
  if (t.includes("focus") || t.includes("today")) return "today_focus"
  if (t.includes("help")) return "help"
  return "general"
}
