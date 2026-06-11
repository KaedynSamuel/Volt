"use client"

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  type ElementType,
} from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { VoltPageTour } from "@/components/tours/VoltPageTour"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { getStoredCompanyId } from "@/lib/tenant"
import { getStoredSession } from "@/lib/auth"
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  Flame,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Ticket,
  Trophy,
  UserCheck,
  X,
  XCircle,
  Zap,
} from "lucide-react"

type TicketStatus = "open" | "in-progress" | "resolved" | "closed"
type TicketPriority = "low" | "medium" | "high" | "critical"
type TicketScope = "open" | "closed"
type StatusFilter = "all" | "open" | "in-progress" | "closed" | "past-due"

type TeamMember = {
  id: number
  fullName: string
  email?: string
  role?: string
}

type TicketRecord = {
  id: string
  dbId?: number
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  assignee?: { name?: string; initials?: string; id?: number; email?: string }
  reporter?: { name?: string; initials?: string; id?: number; email?: string }
  assigneeName?: string
  reporterName?: string
  assigneeUserId?: number | string | null
  reporterUserId?: number | string | null
  createdByUserId?: number | string | null
  tags?: string[] | string
  resolutionReason?: string
  resolvedReason?: string
  resolvedAt?: string
  closedAt?: string
  dueDate?: string
  dueDateRaw?: string
  createdAt?: string
  updatedAt?: string
  comments?: number
}

type NewTicketForm = {
  title: string
  description: string
  priority: TicketPriority
  assigneeUserId: string
  assigneeName: string
  reporterName: string
  tags: string[]
  tagInput: string
  dueDate: string
}

type DropdownOption = {
  value: string
  label: string
}

type CustomDropdownProps = {
  label: string
  value: string
  placeholder: string
  options: DropdownOption[]
  onChange: (value: string) => void
  menuDirection?: "down" | "up"
}

type ResolveModalState = {
  ticket: TicketRecord
  nextStatus: Extract<TicketStatus, "closed">
  reason: string
}

type TicketToast = {
  title: string
  xpGained: number
  totalXp: number
  level: number
  levelProgress: number
  achievements: string[]
}

type StoredAchievementProgress = {
  totalXp: number
  earnedXp?: number
  overduePenaltyXp?: number
  completedTaskIds: string[]
  resolvedTicketIds?: string[]
  recentAchievements: string[]
  lastCompletedTaskTitle?: string
  lastResolvedTicketTitle?: string
  lastUpdatedAt: string
}

const emptyTicketForm: NewTicketForm = {
  title: "",
  description: "",
  priority: "medium",
  assigneeUserId: "",
  assigneeName: "",
  reporterName: "",
  tags: [],
  tagInput: "",
  dueDate: "",
}

const ACHIEVEMENT_PROGRESS_STORAGE_PREFIX = "volt-achievement-progress"
const XP_STORAGE_KEY = "volt-task-xp-total"

const softMotion =
  "transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.015] active:translate-y-0 active:scale-[0.98]"

const shineMotion =
  "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:bg-foreground/10 before:transition-transform before:duration-700 hover:before:translate-x-full"

const actionButtonMotion = cn(
  "group relative overflow-hidden rounded-xl font-bold",
  "transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.015] hover:shadow-md active:translate-y-0 active:scale-[0.98]",
  "before:absolute before:inset-0 before:-translate-x-full before:bg-foreground/10 before:transition-transform before:duration-700 hover:before:translate-x-full",
)

const statusConfig: Record<
  TicketStatus,
  { icon: ElementType; label: string; chip: string; glow: string }
> = {
  open: {
    icon: AlertCircle,
    label: "Open",
    chip: "border-chart-4/30 bg-chart-4/10 text-chart-4",
    glow: "shadow-chart-4/10",
  },
  "in-progress": {
    icon: Clock,
    label: "Started",
    chip: "border-accent/30 bg-accent/10 text-accent",
    glow: "shadow-accent/10",
  },
  resolved: {
    icon: CheckCircle2,
    label: "Closed",
    chip: "border-primary/30 bg-primary/10 text-primary",
    glow: "shadow-primary/10",
  },
  closed: {
    icon: XCircle,
    label: "Closed",
    chip: "border-muted-foreground/25 bg-muted text-muted-foreground",
    glow: "shadow-muted/10",
  },
}

const priorityConfig: Record<
  TicketPriority,
  { label: string; chip: string; rank: number }
> = {
  low: {
    label: "Low",
    chip: "border-muted-foreground/20 bg-muted text-muted-foreground",
    rank: 1,
  },
  medium: {
    label: "Medium",
    chip: "border-chart-4/30 bg-chart-4/10 text-chart-4",
    rank: 2,
  },
  high: {
    label: "High",
    chip: "border-accent/30 bg-accent/10 text-accent",
    rank: 3,
  },
  critical: {
    label: "Critical",
    chip: "border-destructive/30 bg-destructive/10 text-destructive",
    rank: 4,
  },
}

const scopeTabs: {
  value: TicketScope
  title: string
  description: string
  icon: ElementType
}[] = [
  {
    value: "open",
    title: "Tickets Open",
    description: "Active tickets still moving",
    icon: Ticket,
  },
  {
    value: "closed",
    title: "Tickets Closed",
    description: "Resolved and closed tickets",
    icon: CheckCircle2,
  },
]

function CustomDropdown({
  label,
  value,
  placeholder,
  options,
  onChange,
  menuDirection = "down",
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value)

  return (
    <div className={cn("relative space-y-2", open && "z-[9999]")}>
      {label && (
        <label className="text-sm font-semibold text-foreground">{label}</label>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-lg border border-border bg-background/70 px-3 text-left text-sm outline-none transition",
          "hover:border-primary/60 hover:bg-muted/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15",
          open && "border-primary bg-background ring-2 ring-primary/10",
        )}
      >
        <span
          className={cn(
            "truncate font-medium",
            selectedOption ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180 text-primary",
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-[9999] w-full overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-2xl shadow-foreground/10",
            menuDirection === "up" ? "bottom-full mb-1" : "mt-1",
          )}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={cn(
                "w-full rounded-md px-2.5 py-1.5 text-left text-sm font-medium transition",
                value === option.value
                  ? "bg-primary/10 text-primary"
                  : "text-popover-foreground hover:bg-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function getAchievementProgressStorageKey(
  session?: { companyId?: unknown; userId?: unknown; email?: string } | null,
) {
  return `${ACHIEVEMENT_PROGRESS_STORAGE_PREFIX}-${
    session?.companyId || "global"
  }-${session?.userId || session?.email || "user"}`
}

function readStoredAchievementProgress(key: string): StoredAchievementProgress {
  if (typeof window === "undefined") {
    return {
      totalXp: 0,
      earnedXp: 0,
      overduePenaltyXp: 0,
      completedTaskIds: [],
      resolvedTicketIds: [],
      recentAchievements: [],
      lastUpdatedAt: new Date().toISOString(),
    }
  }

  try {
    const stored = window.localStorage.getItem(key)
    const parsed = stored ? JSON.parse(stored) : null

    return {
      totalXp: Number(parsed?.totalXp ?? parsed?.earnedXp ?? 0),
      earnedXp: Number(parsed?.earnedXp ?? parsed?.totalXp ?? 0),
      overduePenaltyXp: Number(parsed?.overduePenaltyXp || 0),
      completedTaskIds: Array.isArray(parsed?.completedTaskIds)
        ? parsed.completedTaskIds
        : [],
      resolvedTicketIds: Array.isArray(parsed?.resolvedTicketIds)
        ? parsed.resolvedTicketIds
        : [],
      recentAchievements: Array.isArray(parsed?.recentAchievements)
        ? parsed.recentAchievements
        : [],
      lastCompletedTaskTitle: parsed?.lastCompletedTaskTitle,
      lastResolvedTicketTitle: parsed?.lastResolvedTicketTitle,
      lastUpdatedAt: parsed?.lastUpdatedAt || new Date().toISOString(),
    }
  } catch {
    return {
      totalXp: 0,
      earnedXp: 0,
      overduePenaltyXp: 0,
      completedTaskIds: [],
      resolvedTicketIds: [],
      recentAchievements: [],
      lastUpdatedAt: new Date().toISOString(),
    }
  }
}

function saveStoredAchievementProgress(
  key: string,
  progress: StoredAchievementProgress,
) {
  window.localStorage.setItem(key, JSON.stringify(progress))
  window.dispatchEvent(
    new CustomEvent("volt-achievement-progress-updated", {
      detail: progress,
    }),
  )
}

function getInitials(name?: string) {
  if (!name?.trim()) return "U"

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

function normaliseTickets(data: unknown): TicketRecord[] {
  const record = data as { tickets?: unknown; data?: unknown }
  const list = Array.isArray(data)
    ? data
    : Array.isArray(record?.tickets)
      ? record.tickets
      : Array.isArray(record?.data)
        ? record.data
        : []

  return list.map((item) => {
    const value = item as Record<string, unknown>
    const assignee = value.assignee as TicketRecord["assignee"] | undefined
    const reporter = value.reporter as TicketRecord["reporter"] | undefined
    const status = String(value.status || "open").toLowerCase()
    const priority = String(value.priority || "medium").toLowerCase()
    const rawTags = value.tags

    return {
      id: String(value.id ?? value.ticketId ?? value.dbId ?? "TICKET"),
      dbId:
        typeof value.dbId === "number"
          ? value.dbId
          : typeof value.id === "number"
            ? value.id
            : Number(value.dbId ?? value.ticketDbId ?? 0) || undefined,
      title: String(value.title ?? "Untitled ticket"),
      description: String(value.description ?? ""),
      status: ["open", "in-progress", "resolved", "closed"].includes(status)
        ? (status as TicketStatus)
        : status === "in progress"
          ? "in-progress"
          : "open",
      priority: ["low", "medium", "high", "critical"].includes(priority)
        ? (priority as TicketPriority)
        : "medium",
      assignee,
      reporter,
      assigneeName: String(
        value.assigneeName ?? assignee?.name ?? value.assignedToName ?? "",
      ),
      reporterName: String(
        value.reporterName ?? reporter?.name ?? value.createdByName ?? "",
      ),
      assigneeUserId:
        (value.assigneeUserId as number | string | null | undefined) ??
        (value.assignedToUserId as number | string | null | undefined) ??
        assignee?.id ??
        null,
      reporterUserId:
        (value.reporterUserId as number | string | null | undefined) ??
        (value.createdByUserId as number | string | null | undefined) ??
        reporter?.id ??
        null,
      createdByUserId:
        (value.createdByUserId as number | string | null | undefined) ?? null,
      tags: Array.isArray(rawTags)
        ? rawTags.map(String)
        : typeof rawTags === "string" && rawTags.trim()
          ? rawTags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
      resolutionReason: String(
        value.resolutionReason ?? value.resolvedReason ?? value.closeReason ?? "",
      ),
      resolvedReason: String(value.resolvedReason ?? ""),
      resolvedAt: String(value.resolvedAt ?? value.resolved_at ?? ""),
      closedAt: String(value.closedAt ?? value.closed_at ?? ""),
      dueDate: String(value.dueDate ?? value.due_date ?? value.dueDateRaw ?? ""),
      dueDateRaw: String(value.dueDateRaw ?? value.dueDate ?? value.due_date ?? ""),
      createdAt: String(value.createdAt ?? value.created_at ?? ""),
      updatedAt: String(value.updatedAt ?? value.updated_at ?? ""),
      comments: Number(value.comments ?? value.commentCount ?? 0),
    }
  })
}

function getTicketAssigneeName(ticket: TicketRecord) {
  return ticket.assignee?.name || ticket.assigneeName || "Unassigned"
}

function getTicketReporterName(ticket: TicketRecord) {
  return ticket.reporter?.name || ticket.reporterName || "Unknown"
}

function getTicketTags(ticket: TicketRecord) {
  if (Array.isArray(ticket.tags)) return ticket.tags
  if (typeof ticket.tags === "string" && ticket.tags.trim()) {
    return ticket.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  }

  return []
}

function formatDate(value?: string) {
  if (!value) return "No date"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}


function getTicketDueDateMs(ticket: TicketRecord) {
  const value = ticket.dueDateRaw || ticket.dueDate

  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return null

  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

function isTicketCompleted(ticket: TicketRecord) {
  const status = String(ticket.status || "").toLowerCase().trim()
  return status === "closed" || status === "resolved"
}

function getTicketOverdueDays(ticket: TicketRecord) {
  if (isTicketCompleted(ticket)) return 0

  const dueMs = getTicketDueDateMs(ticket)

  if (!dueMs) return 0

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const due = new Date(dueMs)
  due.setHours(0, 0, 0, 0)

  const diff = now.getTime() - due.getTime()

  if (diff <= 0) return 0

  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function isTicketOverdue(ticket: TicketRecord) {
  return getTicketOverdueDays(ticket) > 0
}

function getTicketRowKey(ticket: TicketRecord) {
  return String(ticket.dbId ?? ticket.id)
}

function ticketBelongsToUser(ticket: TicketRecord, _session: any, scope: TicketScope) {
  if (scope === "closed") {
    return isTicketCompleted(ticket)
  }

  return !isTicketCompleted(ticket)
}
function getTicketXp(ticket: TicketRecord) {
  if (ticket.priority === "critical") return 90
  if (ticket.priority === "high") return 70
  if (ticket.priority === "low") return 35
  return 50
}

const ACHIEVEMENT_XP_PER_LEVEL = 100

function getLevelProgress(totalXp: number) {
  const level = Math.floor(totalXp / ACHIEVEMENT_XP_PER_LEVEL) + 1
  const levelProgress = Math.round(
    ((totalXp % ACHIEVEMENT_XP_PER_LEVEL) / ACHIEVEMENT_XP_PER_LEVEL) * 100,
  )

  return { level, levelProgress }
}

function getTicketAchievements(ticket: TicketRecord, resolvedCount: number) {
  const achievements: string[] = []

  if (resolvedCount === 1) achievements.push("First ticket resolved")
  if (resolvedCount === 5) achievements.push("5 ticket solves unlocked")
  if (resolvedCount === 10) achievements.push("10 ticket solves unlocked")
  if (ticket.priority === "critical") achievements.push("Critical closer")
  if (ticket.priority === "high") achievements.push("High priority resolver")

  return achievements.length ? achievements : ["Ticket progress saved"]
}

export default function TicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [activeScope, setActiveScope] = useState<TicketScope>("open")
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all")
  const [priorityFilter, setPriorityFilter] = useState<"all" | TicketPriority>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [showCreateTicket, setShowCreateTicket] = useState(false)
  const [newTicket, setNewTicket] = useState<NewTicketForm>(emptyTicketForm)
  const [resolveModal, setResolveModal] = useState<ResolveModalState | null>(null)
  const [movingTicketId, setMovingTicketId] = useState<string | null>(null)
  const [ticketToast, setTicketToast] = useState<TicketToast | null>(null)
  const [toastProgress, setToastProgress] = useState(0)
  const [highlightedStatus, setHighlightedStatus] = useState<StatusFilter | null>(null)
  const [showOverduePanel, setShowOverduePanel] = useState(false)
  const [listMotion, setListMotion] = useState<"left" | "right" | null>(null)
  const [listMotionKey, setListMotionKey] = useState(0)

  const session = typeof window !== "undefined" ? (getStoredSession() as any) : null
  const selectedAssignee = teamMembers.find(
    (member) => String(member.id) === newTicket.assigneeUserId,
  )
  const priorityOptions = useMemo(
    () => [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: "critical", label: "Critical" },
    ],
    [],
  )
  const assigneeOptions = useMemo(
    () => [
      { value: "", label: "Select user" },
      ...teamMembers.map((member) => ({
        value: String(member.id),
        label: member.fullName,
      })),
    ],
    [teamMembers],
  )

  const statusOrder: StatusFilter[] = activeScope === "closed"
    ? ["all", "closed", "past-due"]
    : ["all", "open", "in-progress", "closed"]

  function playListMotion(direction: "left" | "right") {
    setListMotion(null)

    if (typeof window === "undefined") return

    window.requestAnimationFrame(() => {
      setListMotion(direction)
      setListMotionKey((current) => current + 1)
    })

    window.setTimeout(() => setListMotion(null), 520)
  }

  function handleScopeTabChange(scope: TicketScope) {
    if (scope === activeScope) return

    playListMotion(scope === "closed" ? "right" : "left")
    setActiveScope(scope)
    setActiveStatus("all")
  }

  function handleStatusFilterChange(status: StatusFilter) {
    const nextStatus: StatusFilter = status === activeStatus ? "all" : status

    if (nextStatus === activeStatus) return

    const currentIndex = statusOrder.indexOf(activeStatus)
    const nextIndex = statusOrder.indexOf(nextStatus)

    playListMotion(nextIndex > currentIndex ? "right" : "left")
    setActiveStatus(nextStatus)
  }

  async function loadTickets() {
    try {
      setLoading(true)
      setError("")

      const companyId = getStoredCompanyId()

      if (!companyId) {
        router.push("/dashboards")
        return
      }

      const [ticketsResponse, membersResponse] = await Promise.all([
        fetch(`/api/tickets?companyId=${encodeURIComponent(String(companyId))}`, {
          method: "GET",
          cache: "no-store",
        }),
        fetch(`/api/team-members?companyId=${encodeURIComponent(String(companyId))}`, {
          method: "GET",
          cache: "no-store",
        }),
      ])

      const ticketsData = await ticketsResponse.json().catch(() => null)
      const membersData = await membersResponse.json().catch(() => null)

      if (!ticketsResponse.ok) {
        throw new Error(
          ticketsData?.details || ticketsData?.error || "Failed to load tickets",
        )
      }

      setTickets(normaliseTickets(ticketsData))
      setTeamMembers(Array.isArray(membersData) ? membersData : [])
    } catch (error) {
      console.error("Error loading tickets:", error)
      setError(
        error instanceof Error
          ? error.message
          : "Could not load tickets from the database.",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [])

  useEffect(() => {
    if (!ticketToast) {
      setToastProgress(0)
      return
    }

    setToastProgress(0)

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setToastProgress(ticketToast.levelProgress))
    })

    const timeout = window.setTimeout(() => {
      setTicketToast(null)
      setToastProgress(0)
    }, 3600)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [ticketToast])

  function addTagFromInput() {
    const tag = newTicket.tagInput.trim()

    if (!tag) return

    setNewTicket((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags : [...prev.tags, tag],
      tagInput: "",
    }))
  }

  function removeTag(tag: string) {
    setNewTicket((prev) => ({
      ...prev,
      tags: prev.tags.filter((item) => item !== tag),
    }))
  }

  function handleAssigneeChange(userId: string) {
    const member = teamMembers.find((item) => String(item.id) === userId)

    setNewTicket((prev) => ({
      ...prev,
      assigneeUserId: userId,
      assigneeName: member?.fullName || "",
    }))
  }

  const handleCreateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!newTicket.title.trim()) {
      setError("Ticket title is required.")
      return
    }

    if (!newTicket.assigneeUserId) {
      setError("Please select one user to send this ticket to.")
      return
    }

    try {
      setSaving(true)
      setError("")

      const companyId = getStoredCompanyId()
      const activeSession = getStoredSession() as any
      const reporterName =
        newTicket.reporterName.trim() ||
        activeSession?.fullName ||
        activeSession?.name ||
        activeSession?.email ||
        "Current User"

      if (!companyId) {
        router.push("/dashboards")
        return
      }

      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-company-id": String(companyId),
        },
        body: JSON.stringify({
          title: newTicket.title,
          description: newTicket.description,
          priority: newTicket.priority,
          assigneeName: newTicket.assigneeName,
          assigneeUserId: Number(newTicket.assigneeUserId),
          assignedToUserId: Number(newTicket.assigneeUserId),
          reporterName,
          reporterUserId: activeSession?.userId || null,
          createdByUserId: activeSession?.userId || null,
          tags: newTicket.tags,
          dueDate: newTicket.dueDate || null,
          status: "open",
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to create ticket")
      }

      const createdTicket = normaliseTickets([data])[0]

      setTickets((prev) => [createdTicket, ...prev])
      setNewTicket(emptyTicketForm)
      setShowCreateTicket(false)
      playListMotion("right")
      setActiveScope("open")
      setActiveStatus("all")
    } catch (error) {
      console.error("Error creating ticket:", error)
      setError(error instanceof Error ? error.message : "Ticket could not be created.")
    } finally {
      setSaving(false)
    }
  }

  async function patchTicketStatus(
    ticket: TicketRecord,
    status: TicketStatus,
    resolutionReason?: string,
  ) {
    const oldTickets = tickets
    const key = getTicketRowKey(ticket)

    setTickets((prev) =>
      prev.map((item) =>
        getTicketRowKey(item) === key
          ? {
              ...item,
              status,
              resolutionReason: resolutionReason ?? item.resolutionReason,
              resolvedReason: resolutionReason ?? item.resolvedReason,
              resolvedAt:
                status === "closed" ? new Date().toISOString() : item.resolvedAt,
            }
          : item,
      ),
    )

    setHighlightedStatus(isTicketCompleted({ ...ticket, status }) ? "closed" : (status as StatusFilter))
    window.setTimeout(() => setHighlightedStatus(null), 1250)

    try {
      const companyId = getStoredCompanyId()

      if (!companyId) {
        router.push("/dashboards")
        return
      }

      const response = await fetch("/api/tickets", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-company-id": String(companyId),
        },
        body: JSON.stringify({
          dbId: ticket.dbId,
          id: ticket.id,
          status,
          resolutionReason: resolutionReason || undefined,
          resolvedReason: resolutionReason || undefined,
          resolvedAt: status === "closed" ? new Date().toISOString() : undefined,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to update ticket")
      }

      if (status === "closed") {
        rewardTicket(ticket)
      }
    } catch (error) {
      console.error("Error updating ticket:", error)
      setTickets(oldTickets)
      setHighlightedStatus(null)
      setError(
        error instanceof Error
          ? error.message
          : "Ticket status could not be updated.",
      )
    }
  }

  function handleStatusChange(ticket: TicketRecord, status: TicketStatus) {
    if (status === "closed") {
      setResolveModal({
        ticket,
        nextStatus: status,
        reason: ticket.resolutionReason || ticket.resolvedReason || "",
      })
      return
    }

    patchTicketStatus(ticket, status)
  }

  function rewardTicket(ticket: TicketRecord) {
    const activeSession = getStoredSession()
    const progressKey = getAchievementProgressStorageKey(activeSession)
    const currentProgress = readStoredAchievementProgress(progressKey)
    const ticketKey = getTicketRowKey(ticket)
    const resolvedTicketIds = currentProgress.resolvedTicketIds || []

    if (resolvedTicketIds.includes(ticketKey)) return

    const xpGained = getTicketXp(ticket)
    const earnedXp = Number(currentProgress.earnedXp ?? currentProgress.totalXp ?? 0) + xpGained
    const totalXp = Math.max(0, earnedXp - Number(currentProgress.overduePenaltyXp || 0))
    const resolvedCount = resolvedTicketIds.length + 1
    const achievements = getTicketAchievements(ticket, resolvedCount)
    const { level, levelProgress } = getLevelProgress(totalXp)

    const nextProgress: StoredAchievementProgress = {
      ...currentProgress,
      totalXp,
      earnedXp,
      resolvedTicketIds: [...resolvedTicketIds, ticketKey],
      recentAchievements: [
        ...achievements,
        ...currentProgress.recentAchievements,
      ].slice(0, 10),
      lastResolvedTicketTitle: ticket.title,
      lastUpdatedAt: new Date().toISOString(),
    }

    saveStoredAchievementProgress(progressKey, nextProgress)
    window.localStorage.setItem(XP_STORAGE_KEY, String(totalXp))

    setTicketToast({
      title: ticket.title,
      xpGained,
      totalXp,
      level,
      levelProgress,
      achievements,
    })
  }

  const scopedTickets = useMemo(() => {
    return tickets.filter((ticket) => ticketBelongsToUser(ticket, session, activeScope))
  }, [tickets, session, activeScope])

  const counts = useMemo(() => {
    return {
      all: scopedTickets.length,
      open: scopedTickets.filter((ticket) => ticket.status === "open").length,
      "in-progress": scopedTickets.filter((ticket) => ticket.status === "in-progress").length,
      closed: scopedTickets.filter((ticket) => isTicketCompleted(ticket) || ticket.status === "closed").length,
      "past-due": scopedTickets.filter((ticket) => {
        if (!isTicketCompleted(ticket)) return false
        const dueDate = ticket.dueDate || ticket.dueDateRaw
        if (!dueDate) return false
        const due = new Date(dueDate)
        if (isNaN(due.getTime())) return false
        const closedAt = ticket.resolvedAt || ticket.closedAt
        const closedDate = closedAt ? new Date(closedAt) : null
        return closedDate !== null && closedDate > due
      }).length,
    }
  }, [scopedTickets])

  const openCount = useMemo(
    () => tickets.filter((ticket) => ticketBelongsToUser(ticket, session, "open")).length,
    [tickets, session],
  )
  const closedCount = useMemo(
    () => tickets.filter((ticket) => ticketBelongsToUser(ticket, session, "closed")).length,
    [tickets, session],
  )

  const filteredTickets = useMemo(() => {
    const search = searchTerm.toLowerCase().trim()

    return scopedTickets
      .filter((ticket) => {
        if (activeStatus !== "all") {
          if (activeStatus === "closed" && !isTicketCompleted(ticket)) return false
          if (activeStatus === "past-due") {
            // Past Due = ticket was closed/resolved but its due date had already passed
            if (!isTicketCompleted(ticket)) return false
            const dueDate = ticket.dueDate || ticket.dueDateRaw
            if (!dueDate) return false
            const due = new Date(dueDate)
            if (isNaN(due.getTime())) return false
            // The ticket closed after the due date
            const closedAt = ticket.resolvedAt || ticket.closedAt
            const closedDate = closedAt ? new Date(closedAt) : new Date()
            if (closedDate <= due) return false
          }
          if (activeStatus !== "closed" && activeStatus !== "past-due" && ticket.status !== activeStatus) return false
        }
        if (priorityFilter !== "all" && ticket.priority !== priorityFilter) return false

        const tags = getTicketTags(ticket).join(" ").toLowerCase()
        const matchesSearch =
          !search ||
          ticket.id.toLowerCase().includes(search) ||
          ticket.title.toLowerCase().includes(search) ||
          ticket.description.toLowerCase().includes(search) ||
          ticket.priority.toLowerCase().includes(search) ||
          ticket.status.toLowerCase().includes(search) ||
          getTicketAssigneeName(ticket).toLowerCase().includes(search) ||
          getTicketReporterName(ticket).toLowerCase().includes(search) ||
          tags.includes(search)

        return matchesSearch
      })
      .sort((a, b) => {
        const aClosed = isTicketCompleted(a)
        const bClosed = isTicketCompleted(b)

        if (aClosed !== bClosed) return aClosed ? 1 : -1

        const priorityDiff = priorityConfig[b.priority].rank - priorityConfig[a.priority].rank
        if (priorityDiff !== 0) return priorityDiff

        return (
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime()
        )
      })
  }, [scopedTickets, activeStatus, priorityFilter, searchTerm])

  const activeTicketsForOverdue = tickets.filter((ticket) => !isTicketCompleted(ticket))
  const overdueTickets = activeTicketsForOverdue.filter((ticket) => isTicketOverdue(ticket))

  const queueTotal = Math.max(1, counts.open + counts["in-progress"] + counts.closed)
  const activeQueueCount = counts.open + counts["in-progress"]
  const queueProgressScore = counts["in-progress"] * 0.5 + counts.closed
  const queueCompletionPercent = Math.round((queueProgressScore / queueTotal) * 100)
  const queueVisualPercent = Math.min(
    100,
    Math.max(queueCompletionPercent, activeQueueCount > 0 || counts.closed > 0 ? 8 : 0),
  )
  const highPriorityQueue = scopedTickets.filter(
    (ticket) => !isTicketCompleted(ticket) && ["high", "critical"].includes(ticket.priority),
  ).length
  const filterLabel =
    activeStatus === "all"
      ? "Full queue"
      : activeStatus === "open"
        ? "Open tickets"
        : activeStatus === "in-progress"
          ? "Started tickets"
          : "Closed tickets"

  return (
    <DashboardLayout title="Tickets" subtitle="Open, start, and close tickets">
      <VoltPageTour
        storageKey="volt-tickets-tour-seen"
        steps={[
          {
            title: "Welcome to Tickets ⚡",
            description: "Tickets are for requests, bugs, issues and follow-ups. They move from Open → Started → Closed. Let me show you how it all works.",
            image: "/volty/step-1-welcome.png",
            placement: "center",
          },
          {
            title: "Open vs Closed",
            description: "The two main tabs separate active work (Open) from finished work (Closed). Switch between them here.",
            target: '[data-tour="ticket-scope-tabs"]',
            placement: "bottom",
            mascotSide: "right",
            image: "/volty/step-3-dashboards.png",
          },
          {
            title: "Status Sub-filters",
            description: "Inside each scope, filter by status. In the Closed tab you'll also find 'Past Due' — tickets that were closed after their due date.",
            target: '[data-tour="ticket-status-cards"]',
            placement: "bottom",
            mascotSide: "left",
            image: "/volty/step-4-plan-upgrade.png",
          },
          {
            title: "Create a Ticket",
            description: "Click 'New Ticket' to raise an issue. Set priority (Low → Critical), assign it to someone, add a due date and tags.",
            target: '[data-tour="new-ticket-btn"]',
            placement: "bottom",
            mascotSide: "right",
            image: "/volty/step-2-join-codes.png",
          },
          {
            title: "Search & Priority Filter",
            description: "Use the search box to find tickets by keyword, and the priority dropdown to focus on what matters most right now.",
            target: '[data-tour="ticket-search"]',
            placement: "bottom",
            mascotSide: "left",
            image: "/volty/step-5-build-dashboard.png",
          },
          {
            title: "You're all set!",
            description: "Open tickets, assign to teammates, resolve when done. The company dashboard tracks everything automatically.",
            image: "/volty/step-6-goodbye.png",
            placement: "center",
          },
        ]}
      />
      <div className="tickets-no-horizontal-scroll">
      <style jsx global>{`
        .volt-ticket-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .volt-ticket-scrollbar::-webkit-scrollbar {
          display: none;
          height: 0;
          width: 0;
        }

        html,
        body {
          overflow-x: hidden;
        }

        body > * {
          max-width: 100vw;
        }

        .tickets-no-horizontal-scroll,
        .tickets-no-horizontal-scroll * {
          box-sizing: border-box;
        }

        .tickets-no-horizontal-scroll {
          max-width: 100%;
          overflow-x: clip;
        }

        @keyframes ticket-status-push-wave {
          0% {
            transform: scaleX(0.18);
            opacity: 0;
          }
          38% {
            transform: scaleX(1.12);
            opacity: 1;
          }
          100% {
            transform: scaleX(1);
            opacity: 0.9;
          }
        }

        @keyframes ticket-status-block-kick {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 hsl(var(--primary) / 0);
          }
          42% {
            transform: scale(1.035) translateX(4px);
            box-shadow: 0 18px 45px hsl(var(--primary) / 0.13);
          }
          70% {
            transform: scale(0.992) translateX(-2px);
          }
          100% {
            transform: scale(1) translateX(0);
          }
        }

        @keyframes ticket-status-border-flow {
          0% {
            opacity: 0;
            transform: scaleX(0.2);
          }
          50% {
            opacity: 1;
            transform: scaleX(1.08);
          }
          100% {
            opacity: 0.9;
            transform: scaleX(1);
          }
        }

        @keyframes ticket-side-panel-in {
          0% {
            opacity: 0;
            transform: translateX(34px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .ticket-status-block-active {
          animation: ticket-status-block-kick 620ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .ticket-status-block-active::after {
          animation: ticket-status-border-flow 680ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .ticket-status-block-active::before {
          animation: ticket-status-push-wave 720ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .ticket-side-panel {
          animation: ticket-side-panel-in 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @keyframes reward-clean-toast {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.96);
          }
          12% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          86% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
        }

        .animate-reward-clean-toast {
          animation: reward-clean-toast 3600ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          will-change: transform, opacity;
        }

        @media (prefers-reduced-motion: reduce) {
          .ticket-status-block-active,
          .ticket-status-block-active::before,
          .ticket-status-block-active::after,
          .ticket-side-panel,
          .animate-create-modal-enter,
          .animate-ticket-complete-toast,
          .animate-reward-clean-toast {
            animation: none !important;
          }

          .group:hover,
          button:hover {
            transform: none !important;
          }
        }

        @media (prefers-color-scheme: light) {
          .tickets-no-horizontal-scroll {
            color-scheme: light;
          }
        }

        @media (prefers-color-scheme: dark) {
          .tickets-no-horizontal-scroll {
            color-scheme: dark;
          }
        }

      `}</style>

      <div className="space-y-5 text-foreground">
        <div data-tour="ticket-scope-tabs" className="grid gap-3 md:grid-cols-2">
          {scopeTabs.map((tab) => {
            const Icon = tab.icon
            const active = activeScope === tab.value
            const count = tab.value === "open" ? openCount : closedCount

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleScopeTabChange(tab.value)}
                className={cn(
                  "group glass-card relative overflow-hidden rounded-2xl border p-4 text-left",
                  softMotion,
                  shineMotion,
                  active
                    ? "border-primary/45 bg-primary/10 shadow-lg shadow-primary/10"
                    : "border-border/70 bg-card/70 hover:border-primary/30 hover:bg-primary/[0.035]",
                )}
              >
                <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-2xl transition",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="font-bold">{tab.title}</p>
                      <p className="text-sm text-muted-foreground">{tab.description}</p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm font-bold",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        <div data-tour="ticket-status-cards" className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
          {(activeScope === "closed"
            ? (["closed", "past-due"] as Array<"closed" | "past-due">)
            : (["open", "in-progress"] as Array<"open" | "in-progress">)
          ).map((status) => {
            const config = status === "past-due"
              ? { icon: Flame, label: "Past Due", chip: "border-destructive/30 bg-destructive/10 text-destructive", glow: "shadow-destructive/10" }
              : statusConfig[status as keyof typeof statusConfig]
            const Icon = config.icon

            return (
              <button
                key={status}
                type="button"
                onClick={() => handleStatusFilterChange(status as StatusFilter)}
                className={cn(
                  "group glass-card relative min-w-0 overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition-[flex,transform,box-shadow,border-color,background-color] duration-500",
                  activeStatus === status ? "lg:flex-[1.28]" : "lg:flex-1",
                  softMotion,
                  "before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-foreground/10 before:to-transparent before:transition-transform before:duration-700 hover:before:translate-x-full",
                  "after:absolute after:inset-x-4 after:bottom-0 after:h-[2px] after:origin-left after:scale-x-0 after:rounded-full after:transition-transform after:duration-500 hover:after:scale-x-100",
                  status === "open" && "hover:border-chart-4/45 hover:bg-chart-4/10 hover:shadow-lg hover:shadow-chart-4/10 after:bg-chart-4",
                  status === "in-progress" && "hover:border-accent/45 hover:bg-accent/10 hover:shadow-lg hover:shadow-accent/10 after:bg-accent",
                  (status === "closed" || status === "resolved") && "hover:border-primary/45 hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/10 after:bg-primary",
                  status === "past-due" && "hover:border-destructive/45 hover:bg-destructive/10 hover:shadow-lg hover:shadow-destructive/10 after:bg-destructive",
                  (activeStatus === status || highlightedStatus === status)
                    ? cn(
                        "ticket-status-block-active after:scale-x-100",
                        status === "open" && "border-chart-4/45 bg-chart-4/10 shadow-chart-4/10",
                        status === "in-progress" && "border-accent/45 bg-accent/10 shadow-accent/10",
                        (status === "closed" || status === "resolved") && "border-primary/45 bg-primary/10 shadow-primary/10",
                        status === "past-due" && "border-destructive/45 bg-destructive/10 shadow-destructive/10",
                      )
                    : "border-border/70 bg-card/70",
                )}
              >
                <div className="relative flex items-center justify-between gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300 group-hover:-rotate-3 group-hover:scale-110",
                      config.chip,
                    )}
                  >
                    <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <p className="text-2xl font-black transition-transform duration-300 group-hover:-translate-y-0.5">
                    {(counts as Record<string, number>)[status] ?? 0}
                  </p>
                </div>
                <p className="relative mt-3 text-sm font-semibold text-muted-foreground transition-colors duration-300 group-hover:text-foreground">
                  {config.label}
                </p>
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setShowOverduePanel(true)}
            className={cn(
              "group glass-card relative min-w-0 overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition-[flex,transform,box-shadow,border-color,background-color] duration-500 lg:flex-1",
              softMotion,
              "before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-destructive/10 before:to-transparent before:transition-transform before:duration-700 hover:before:translate-x-full",
              "after:absolute after:inset-x-4 after:bottom-0 after:h-[2px] after:origin-left after:scale-x-0 after:rounded-full after:bg-destructive after:transition-transform after:duration-500 hover:after:scale-x-100",
              "border-border/70 bg-card/70 hover:border-destructive/45 hover:bg-destructive/10 hover:shadow-lg hover:shadow-destructive/10",
            )}
          >
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive transition-all duration-300 group-hover:-rotate-3 group-hover:scale-110">
                <Flame className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
              </div>
              <p className="text-2xl font-black transition-transform duration-300 group-hover:-translate-y-0.5">
                {overdueTickets.length}
              </p>
            </div>
            <p className="relative mt-3 text-sm font-semibold text-muted-foreground transition-colors duration-300 group-hover:text-foreground">
              Overdue
            </p>
          </button>
        </div>

        <div className="relative z-[120] grid gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(420px,1.05fr)] xl:items-center">
          <div
            className={cn(
              "group relative z-10 flex min-h-[74px] flex-col justify-center overflow-hidden rounded-2xl border px-4 py-3",
              "border-primary/25 bg-primary/[0.06] shadow-sm shadow-primary/10",
              "transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.08] hover:shadow-md hover:shadow-primary/15",
              "before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-primary/10 before:to-transparent before:transition-transform before:duration-700 hover:before:translate-x-full",
            )}
          >
            <div className="relative z-10 mb-2 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary transition-all duration-300 group-hover:scale-105 group-hover:rotate-3">
                <Zap className="h-5 w-5" />
              </span>

              <div className="min-w-0">
                <p className="text-sm font-black leading-none text-foreground">
                  Progression Tracker
                </p>
                <p className="mt-1 text-[11px] font-medium leading-none text-muted-foreground">
                  {filterLabel} · {activeQueueCount} active · {highPriorityQueue} high priority
                </p>
              </div>
            </div>

            <div className="relative z-10 flex items-center gap-2">
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${queueVisualPercent}%` }}
                />
              </div>
              <span className="min-w-[42px] text-right text-xs font-black leading-none text-foreground">
                {queueCompletionPercent}%
              </span>
            </div>
          </div>

          <div className="glass-card relative z-[140] overflow-visible rounded-2xl border border-border/70 bg-card/70 p-3.5">
            <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />

            <div data-tour="ticket-search" className="relative z-[150] flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:justify-end">
              <div className="relative min-w-0 flex-1 xl:max-w-[330px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search tickets, tags, users..."
                  className="h-9 w-full rounded-xl border-border bg-background/70 pl-9 text-sm"
                />
              </div>

              <div className="relative z-[9998] w-full sm:w-44">
                <CustomDropdown
                  label=""
                  value={priorityFilter}
                  placeholder="All Priority"
                  options={[
                    { value: "all", label: "All Priority" },
                    ...priorityOptions,
                  ]}
                  onChange={(value) =>
                    setPriorityFilter(value as "all" | TicketPriority)
                  }
                  menuDirection="down"
                />
              </div>

              <div className="relative z-20 flex justify-end sm:shrink-0">
                <Button
                  data-tour="new-ticket-btn"
                  type="button"
                  onClick={() => setShowCreateTicket(true)}
                  className={cn(
                    actionButtonMotion,
                    "h-9 rounded-xl bg-gradient-to-r from-primary via-accent to-primary px-3 text-xs font-black text-primary-foreground shadow-primary/15",
                    softMotion,
                  )}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 transition group-hover:rotate-12 group-hover:scale-110" />
                  New
                  <Plus className="ml-1.5 h-3.5 w-3.5 transition group-hover:rotate-90" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="glass-card rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
            {error}
          </div>
        )}

        {showCreateTicket && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/70 px-3 py-3 backdrop-blur-xl">
            <div className="glass-card relative flex max-h-[94vh] w-full max-w-[570px] flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl">
              <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
              <div className="pointer-events-none absolute -left-24 bottom-10 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />

              <div className="relative z-10 flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    Create New Ticket
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Send one ticket to one person, add custom tags, and track it.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowCreateTicket(false)
                    setNewTicket(emptyTicketForm)
                  }}
                  className={cn(
                    "rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                    softMotion,
                  )}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="relative z-10 flex min-h-0 flex-1 flex-col">
                <div className="volt-ticket-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Ticket Title</label>
                    <input
                      value={newTicket.title}
                      onChange={(event) =>
                        setNewTicket((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="Enter ticket title"
                      className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Description</label>
                    <textarea
                      value={newTicket.description}
                      onChange={(event) =>
                        setNewTicket((prev) => ({ ...prev, description: event.target.value }))
                      }
                      placeholder="Explain the issue or request..."
                      rows={3}
                      className="w-full resize-none rounded-lg border border-border bg-background/70 px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <CustomDropdown
                      label="Priority"
                      value={newTicket.priority}
                      placeholder="Select priority"
                      options={[
                        { value: "low", label: "Low" },
                        { value: "medium", label: "Medium" },
                        { value: "high", label: "High" },
                        { value: "critical", label: "Critical" },
                      ]}
                      onChange={(value) =>
                        setNewTicket((prev) => ({
                          ...prev,
                          priority: value as TicketPriority,
                        }))
                      }
                    />

                    <CustomDropdown
                      label="Send Ticket To"
                      value={newTicket.assigneeUserId}
                      placeholder="Select user"
                      options={assigneeOptions}
                      onChange={handleAssigneeChange}
                    />
                  </div>

                  {selectedAssignee && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">
                          {getInitials(selectedAssignee.fullName)}
                        </span>
                        {selectedAssignee.fullName}
                        <button
                          type="button"
                          onClick={() =>
                            setNewTicket((prev) => ({
                              ...prev,
                              assigneeUserId: "",
                              assigneeName: "",
                            }))
                          }
                          className={cn("rounded-full p-0.5 hover:bg-primary/15", softMotion)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Due Date</label>
                    <input
                      type="date"
                      value={newTicket.dueDate}
                      onChange={(event) =>
                        setNewTicket((prev) => ({ ...prev, dueDate: event.target.value }))
                      }
                      className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Custom Tags</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={newTicket.tagInput}
                          onChange={(event) =>
                            setNewTicket((prev) => ({ ...prev, tagInput: event.target.value }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()
                              addTagFromInput()
                            }
                          }}
                          placeholder="Type tag and press Enter"
                          className="h-9 w-full rounded-lg border border-border bg-background/70 pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={addTagFromInput}
                        className={cn(
                          actionButtonMotion,
                          "h-9 shrink-0 rounded-lg bg-gradient-to-r from-primary/90 via-accent to-primary/90 px-2.5 text-xs font-bold text-primary-foreground shadow-sm shadow-primary/10",
                        )}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5 transition group-hover:rotate-90" />
                        Add
                      </Button>
                    </div>

                    {newTicket.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {newTicket.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent"
                          >
                            #{tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className={cn("rounded-full p-0.5 hover:bg-accent/15", softMotion)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative z-10 flex items-center justify-between gap-3 border-t border-border/70 bg-card/95 px-5 py-4 backdrop-blur-xl">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowCreateTicket(false)
                      setNewTicket(emptyTicketForm)
                    }}
                    disabled={saving}
                    className={cn("h-9 rounded-lg text-sm", softMotion)}
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    disabled={saving}
                    className={cn(
                      actionButtonMotion,
                      "h-9 rounded-lg bg-gradient-to-r from-primary to-accent px-4 text-sm text-primary-foreground shadow-primary/15",
                    )}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Ticket
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showOverduePanel && (
          <div className="fixed inset-0 z-[200] bg-background/55 backdrop-blur-sm">
            <button
              type="button"
              aria-label="Close overdue tickets panel"
              onClick={() => setShowOverduePanel(false)}
              className="absolute inset-0 cursor-default"
            />

            <aside className="ticket-side-panel glass-card absolute right-0 top-0 z-[210] flex h-full w-full max-w-[430px] flex-col overflow-hidden border-l border-destructive/25 bg-card/95 shadow-2xl shadow-destructive/10">
              <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Overdue Tickets</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Tickets past their due date and not closed yet.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOverduePanel(false)}
                  className={cn("rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground", softMotion)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 volt-ticket-scrollbar">
                {overdueTickets.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-background/60 p-8 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
                    <p className="mt-2 text-sm font-bold text-foreground">No overdue tickets</p>
                    <p className="mt-1 text-xs text-muted-foreground">Everything is currently on track.</p>
                  </div>
                ) : (
                  overdueTickets.map((ticket) => (
                    <div
                      key={getTicketRowKey(ticket)}
                      className="rounded-2xl border border-destructive/25 bg-destructive/10 p-3 transition hover:border-destructive/45 hover:bg-destructive/15"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-foreground">{ticket.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Due {formatDate(ticket.dueDateRaw || ticket.dueDate)} • Overdue by {getTicketOverdueDays(ticket)} day{getTicketOverdueDays(ticket) === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-destructive/30 bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                          {statusConfig[ticket.status].label}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>
          </div>
        )}

        {resolveModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/70 px-3 py-3 backdrop-blur-xl">
            <div className="glass-card w-full max-w-[520px] rounded-2xl border border-border bg-card/95 p-5 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-foreground">
                    Close Ticket
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Add how it was solved before this ticket is closed.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setResolveModal(null)}
                  className={cn(
                    "rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                    softMotion,
                  )}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-3 rounded-2xl border border-border bg-background/60 p-3">
                <p className="text-sm font-semibold text-foreground">{resolveModal.ticket.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {resolveModal.ticket.description || "No description added."}
                </p>
              </div>

              <textarea
                value={resolveModal.reason}
                onChange={(event) =>
                  setResolveModal((prev) => prev && { ...prev, reason: event.target.value })
                }
                placeholder="Example: Fixed the issue by updating the database table and confirming with the user."
                rows={4}
                className="w-full resize-none rounded-lg border border-border bg-background/70 px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
              />

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setResolveModal(null)}
                  className={cn("h-9 rounded-lg text-sm", softMotion)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!resolveModal.reason.trim()) {
                      setError("Please add a reason or how the ticket was solved first.")
                      return
                    }

                    const current = resolveModal
                    setResolveModal(null)
                    patchTicketStatus(current.ticket, current.nextStatus, current.reason.trim())
                  }}
                  className={cn(
                    actionButtonMotion,
                    "h-8 rounded-lg bg-gradient-to-r from-primary to-accent px-3 text-xs text-primary-foreground hover:shadow-primary/20",
                  )}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Close Ticket
                </Button>
              </div>
            </div>
          </div>
        )}

        {ticketToast && (
          <div className="pointer-events-none fixed bottom-5 right-5 z-[80] w-[calc(100%-2.5rem)] max-w-sm animate-reward-clean-toast">
            <div className="glass-card rounded-3xl border border-primary/30 bg-background/95 p-5 shadow-2xl backdrop-blur-xl">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Trophy className="h-6 w-6" />
                </div>

                <div className="min-w-0">
                  <p className="text-base font-black text-foreground">
                    Congratulations!
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                    You closed “{ticketToast.title}”
                  </p>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-primary">
                    <Star className="h-4 w-4" />
                    <span className="text-[11px] font-bold uppercase">
                      XP Gained
                    </span>
                  </div>
                  <p className="text-2xl font-black text-primary">
                    +{ticketToast.xpGained}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-muted/25 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-foreground">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-[11px] font-bold uppercase">Level</span>
                  </div>
                  <p className="text-2xl font-black text-foreground">
                    {ticketToast.level}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Level progress</span>
                  <span className="text-primary">
                    {ticketToast.levelProgress}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-1000 ease-out"
                    style={{
                      width: `${toastProgress}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                {ticketToast.achievements.slice(0, 3).map((achievement) => (
                  <div
                    key={achievement}
                    className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs font-semibold text-foreground"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    {achievement}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-2.5">
          {loading ? (
            <div className="glass-card flex items-center justify-center gap-2 rounded-2xl border border-border p-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading tickets from database...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="glass-card rounded-2xl border border-border p-12 text-center">
              <Ticket className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-bold text-foreground">No tickets found</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Try another search, filter, or create a new ticket.
              </p>
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              const status = statusConfig[ticket.status]
              const priority = priorityConfig[ticket.priority]
              const StatusIcon = status.icon
              const tags = getTicketTags(ticket)
              const key = getTicketRowKey(ticket)
              const canStart = ticket.status === "open"
              const canResolve = ticket.status === "in-progress"

              return (
                <div
                  key={key}
                  className={cn(
                    "glass-card relative overflow-hidden rounded-xl border border-border/70 bg-card/75 p-2.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
                    status.glow,
                  )}
                >
                  <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full bg-primary/5 blur-3xl" />

                  <div className="relative flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-muted-foreground">
                          {ticket.id}
                        </span>
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold", status.chip)}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                        <span className={cn("inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-bold", priority.chip)}>
                          {priority.label}
                        </span>
                      </div>

                      <h3 className="mt-1.5 line-clamp-1 text-[14px] font-black tracking-tight text-foreground">
                        {ticket.title}
                      </h3>
                      <p className="mt-0.5 line-clamp-1 text-[12px] leading-relaxed text-muted-foreground">
                        {ticket.description || "No description added."}
                      </p>

                      {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {(ticket.resolutionReason || ticket.resolvedReason) && (
                        <div className="mt-2 rounded-lg border border-primary/20 bg-primary/10 p-2">
                          <p className="text-[10px] font-black uppercase tracking-wide text-primary">
                            How it was solved
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-foreground">
                            {ticket.resolutionReason || ticket.resolvedReason}
                          </p>
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {getInitials(getTicketAssigneeName(ticket))}
                          </span>
                          <span>
                            To <b className="text-foreground">{getTicketAssigneeName(ticket)}</b>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                            {getInitials(getTicketReporterName(ticket))}
                          </span>
                          <span>
                            From <b className="text-foreground">{getTicketReporterName(ticket)}</b>
                          </span>
                        </div>

                        <span className="flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {ticket.comments || 0}
                        </span>

                        {(ticket.dueDateRaw || ticket.dueDate) && (
                          <span className={cn(isTicketOverdue(ticket) && "font-bold text-destructive")}>
                            Due {formatDate(ticket.dueDateRaw || ticket.dueDate)}
                          </span>
                        )}

                        <span>Updated {formatDate(ticket.updatedAt || ticket.createdAt)}</span>
                      </div>
                    </div>

                    <div className="grid min-w-[145px] gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                      {canStart && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleStatusChange(ticket, "in-progress")}
                          className={cn(
                            actionButtonMotion,
                            "h-8 rounded-lg border-accent/25 bg-accent/10 px-3 text-xs text-accent hover:bg-accent/15 hover:shadow-accent/10",
                          )}
                        >
                          Start
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                        </Button>
                      )}

                      {canResolve && (
                        <Button
                          type="button"
                          onClick={() => handleStatusChange(ticket, "closed")}
                          className={cn(
                            actionButtonMotion,
                            "h-8 rounded-lg bg-gradient-to-r from-primary to-accent px-3 text-xs text-primary-foreground hover:shadow-primary/20",
                          )}
                        >
                          Close
                          <CheckCircle2 className="ml-1.5 h-3.5 w-3.5 transition group-hover:scale-110" />
                        </Button>
                      )}

                      {isTicketCompleted(ticket) && (
                        <div className="flex h-8 items-center justify-center rounded-lg border border-border bg-background/70 px-3 text-xs font-bold text-muted-foreground">
                          {ticket.id}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
      </div>

    </DashboardLayout>
  )
}
