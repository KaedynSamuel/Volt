"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Image from "next/image"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { cn } from "@/lib/utils"
import { getStoredSession } from "@/lib/auth"
import {
  Send,
  Plus,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  CheckSquare,
  Ticket,
  BarChart3,
  Zap,
  CheckCheck,
  ChevronDown,
  Loader2,
  Sparkles,
} from "lucide-react"

/* ─────────────────────────────── types ── */
type Role = "user" | "assistant"

type Message = {
  id: string
  role: Role
  content: string
  ts: Date
  loading?: boolean
  aiPowered?: boolean
  action?: boolean
}

type Conversation = {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
}

/* ─────────────────────────────── constants ── */
const WELCOME =
  "Hey! I'm **Volty** ⚡ — your Volt AI assistant.\n\nI can **read your data**, **take action**, and **answer questions** about your work.\n\nTry asking:\n- *\"What are my overdue tasks?\"*\n- *\"Create a ticket called Server Down urgent\"*\n- *\"Complete task called Weekly Report\"*\n- *\"What should I focus on today?\"*\n\nType **help** to see everything I can do."

const SUGGESTIONS = [
  { icon: CheckSquare, label: "What are my overdue tasks?", short: "Overdue tasks" },
  { icon: Ticket, label: "Create a ticket called Test Issue urgent", short: "Create ticket" },
  { icon: BarChart3, label: "What should I focus on today?", short: "Today's focus" },
  { icon: Zap, label: "Show my high priority tasks", short: "High priority" },
]

const VOLTY_IMGS = [
  "/volty/ChatGPT_Image_May_27__2026__04_08_21_AM__10_-removebg-preview.png",
  "/volty/volty-1.png",
  "/volty/volty-2.png",
  "/volty/volty-3.png",
  "/volty/team-idle-01.png",
  "/volty/team-idle-05.png",
]

function randomVolty() {
  return VOLTY_IMGS[Math.floor(Math.random() * VOLTY_IMGS.length)]
}

function newConvo(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [],
    createdAt: new Date(),
  }
}

/* ─────────────────────────────── markdown-lite renderer ── */
function renderMarkdown(text: string) {
  const lines = text.split("\n")
  const out: React.ReactNode[] = []
  let listItems: string[] = []

  function flushList() {
    if (!listItems.length) return
    out.push(
      <ul key={out.length} className="my-1.5 ml-4 space-y-0.5 list-disc">
        {listItems.map((li, i) => (
          <li key={i} className="text-sm leading-relaxed">{li}</li>
        ))}
      </ul>
    )
    listItems = []
  }

  lines.forEach((line, i) => {
    if (line.startsWith("- ") || line.startsWith("• ")) {
      listItems.push(line.slice(2))
    } else {
      flushList()
      if (!line.trim()) {
        out.push(<div key={i} className="h-2" />)
      } else {
        // **bold**
        const parts = line.split(/(\*\*[^*]+\*\*)/g)
        const rendered = parts.map((p, pi) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={pi} className="font-bold">{p.slice(2, -2)}</strong>
            : <span key={pi}>{p}</span>
        )
        out.push(<p key={i} className="text-sm leading-relaxed">{rendered}</p>)
      }
    }
  })
  flushList()
  return out
}

/* ─────────────────────────────── components ── */
function VoltyAvatar({ size = 8 }: { size?: number }) {
  const px = size * 4
  return (
    <div
      className="shrink-0 rounded-full overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/10 to-accent/10 shadow"
      style={{ width: px, height: px }}
    >
      <Image
        src={VOLTY_IMGS[0]}
        alt="Volty"
        width={px}
        height={px}
        className="h-full w-full object-cover"
      />
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current opacity-60 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}

function MessageBubble({
  msg,
  onCopy,
}: {
  msg: Message
  onCopy: (text: string) => void
}) {
  const isUser = msg.role === "user"
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null)

  return (
    <div className={cn("group flex gap-3 px-4 py-2", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      {isUser ? (
        <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-primary-foreground shadow">
          You
        </div>
      ) : (
        <VoltyAvatar size={8} />
      )}

      {/* Bubble */}
      <div className={cn("flex max-w-[78%] flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm shadow-sm",
            isUser
              ? "bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-br-sm"
              : "bg-card/80 border border-border/60 text-foreground rounded-bl-sm",
          )}
        >
          {msg.loading ? (
            <TypingDots />
          ) : isUser ? (
            <p className="leading-relaxed">{msg.content}</p>
          ) : (
            <div className="space-y-1">{renderMarkdown(msg.content)}</div>
          )}
        </div>

        {/* Actions */}
        {!msg.loading && !isUser && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] text-muted-foreground pr-1">
              {msg.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {msg.aiPowered && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">⚡ AI</span>
            )}
            {msg.action && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ Done</span>
            )}
            <button
              type="button"
              onClick={() => onCopy(msg.content)}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition"
              title="Copy"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setFeedback("up")}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded transition",
                feedback === "up" ? "text-green-500" : "text-muted-foreground hover:bg-muted hover:text-green-500",
              )}
              title="Helpful"
            >
              <ThumbsUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setFeedback("down")}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded transition",
                feedback === "down" ? "text-destructive" : "text-muted-foreground hover:bg-muted hover:text-destructive",
              )}
              title="Not helpful"
            >
              <ThumbsDown className="h-3 w-3" />
            </button>
          </div>
        )}

        {!msg.loading && isUser && (
          <span className="text-[10px] text-muted-foreground">
            {msg.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────── main page ── */
export default function AssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([newConvo()])
  const [activeId, setActiveId] = useState(() => "")
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Init active conversation
  useEffect(() => {
    setActiveId(conversations[0].id)
  }, [])

  const activeConvo = conversations.find((c) => c.id === activeId) ?? conversations[0]

  function scrollToBottom() {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    }, 50)
  }

  useEffect(() => {
    scrollToBottom()
  }, [activeConvo?.messages])

  function updateConvo(id: string, updater: (c: Conversation) => Conversation) {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)))
  }

  async function sendMessage(prompt?: string) {
    const text = (prompt ?? input).trim()
    if (!text || isLoading) return

    const convoId = activeId || conversations[0].id

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      ts: new Date(),
    }
    const loadingMsg: Message = {
      id: "loading",
      role: "assistant",
      content: "",
      ts: new Date(),
      loading: true,
    }

    // Update title from first message
    updateConvo(convoId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? text.slice(0, 40) : c.title,
      messages: [...c.messages, userMsg, loadingMsg],
    }))

    setInput("")
    setIsLoading(true)
    if (textareaRef.current) {
      textareaRef.current.style.height = "48px"
    }

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          ...(() => {
            const s = getStoredSession()
            return {
              userId: s?.userId,
              companyId: s?.companyId,
              role: s?.role,
              userName: s?.fullName,
              companyName: s?.dashboards?.[0]?.company?.name || "your company",
            }
          })(),
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Request failed")

      const reply: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer || "I didn't get a response — please try again.",
        ts: new Date(),
        aiPowered: !!data.aiPowered,
        action: !!data.action,
      }

      updateConvo(convoId, (c) => ({
        ...c,
        messages: c.messages.filter((m) => m.id !== "loading").concat(reply),
      }))
    } catch {
      updateConvo(convoId, (c) => ({
        ...c,
        messages: c.messages.filter((m) => m.id !== "loading").concat({
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I couldn't reach the Volt AI engine right now. Please try again.",
          ts: new Date(),
        }),
      }))
    } finally {
      setIsLoading(false)
    }
  }

  function startNewChat() {
    const c = newConvo()
    setConversations((prev) => [c, ...prev])
    setActiveId(c.id)
  }

  function deleteConvo(id: string) {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id)
      if (next.length === 0) {
        const fresh = newConvo()
        setActiveId(fresh.id)
        return [fresh]
      }
      if (activeId === id) setActiveId(next[0].id)
      return next
    })
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const showWelcome = activeConvo?.messages.length === 0

  return (
    <DashboardLayout title="Volty AI" subtitle="Your Volt-powered AI assistant">
      <div className="flex h-[calc(100vh-10rem)] min-h-0 gap-0 overflow-hidden rounded-2xl border border-border/60 bg-card/30 shadow-xl backdrop-blur-xl">

        {/* ── Sidebar ── */}
        <aside
          className={cn(
            "flex flex-col border-r border-border/50 bg-muted/20 transition-all duration-300 overflow-hidden",
            sidebarOpen ? "w-60 shrink-0" : "w-0",
          )}
        >
          <div className="flex items-center justify-between p-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <VoltyAvatar size={7} />
              <div>
                <p className="text-sm font-bold text-foreground leading-tight">Volty</p>
                <p className="text-[10px] text-muted-foreground">Volt AI</p>
              </div>
            </div>
            <button
              type="button"
              onClick={startNewChat}
              title="New chat"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition",
                  c.id === activeId
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => setActiveId(c.id)}
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{c.title}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deleteConvo(c.id) }}
                  className="hidden group-hover:flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Quick prompts */}
          <div className="border-t border-border/40 p-2 space-y-1">
            <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quick Ask</p>
            {SUGGESTIONS.map(({ icon: Icon, label, short }) => (
              <button
                key={short}
                type="button"
                onClick={() => sendMessage(label)}
                disabled={isLoading}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{short}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* ── Main chat area ── */}
        <div className="flex min-w-0 flex-1 flex-col">

          {/* Chat topbar */}
          <div className="flex items-center gap-3 border-b border-border/40 bg-card/30 px-4 py-3 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", sidebarOpen ? "-rotate-90" : "rotate-90")} />
            </button>
            <VoltyAvatar size={8} />
            <div>
              <p className="text-sm font-bold text-foreground">Volty</p>
              <p className="text-xs text-muted-foreground">Volt AI · Your workspace assistant</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-500">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Active
              </span>
              <button
                type="button"
                onClick={startNewChat}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                New chat
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 volt-ai-scroll">
            {showWelcome ? (
              /* ── Welcome screen ── */
              <div className="flex flex-col items-center justify-center h-full gap-8 px-6 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-20 w-20 overflow-hidden rounded-3xl border-2 border-primary/20 shadow-xl">
                    <Image
                      src={VOLTY_IMGS[0]}
                      alt="Volty"
                      width={80}
                      height={80}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-foreground">
                      Welcome to Volty ⚡
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                      Ask me anything about your tasks, tickets or workspace — I'll look it up and give you a clear answer.
                    </p>
                  </div>
                </div>

                {/* Suggestion grid */}
                <div className="grid w-full max-w-lg grid-cols-2 gap-2">
                  {SUGGESTIONS.map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => sendMessage(label)}
                      disabled={isLoading}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border border-border/60 bg-card/60 p-3.5 text-left transition",
                        "hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm",
                        "disabled:opacity-50",
                      )}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-xs font-semibold text-foreground leading-snug">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Conversation ── */
              <div className="space-y-1">
                {activeConvo?.messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} onCopy={copyText} />
                ))}
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t border-border/40 bg-card/30 p-4 backdrop-blur-sm">
            <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-background/70 px-4 py-3 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  e.target.style.height = "auto"
                  e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void sendMessage()
                  }
                }}
                placeholder="Ask Volty anything about your tasks, tickets or workspace…"
                rows={1}
                disabled={isLoading}
                className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
                style={{ minHeight: "24px", maxHeight: "140px" }}
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                  "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow",
                  "hover:shadow-md hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0",
                  "disabled:opacity-40 disabled:translate-y-0 disabled:shadow-none",
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between px-1">
              <p className="text-[11px] text-muted-foreground">
                Shift+Enter for new line · Volty uses your live Volt data
              </p>
              {copied && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                  <CheckCheck className="h-3 w-3" /> Copied!
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .volt-ai-scroll {
          scrollbar-width: thin;
          scrollbar-color: hsl(var(--muted-foreground) / 0.25) transparent;
        }
        .volt-ai-scroll::-webkit-scrollbar { width: 5px; }
        .volt-ai-scroll::-webkit-scrollbar-track { background: transparent; }
        .volt-ai-scroll::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.25);
          border-radius: 3px;
        }
      `}</style>
    </DashboardLayout>
  )
}
