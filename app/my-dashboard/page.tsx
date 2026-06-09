"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  Award,
  CheckCircle2,
  CheckSquare,
  Clock,
  Loader2,
  Target,
  Ticket,
  TrendingUp,
  UserRound,
} from "lucide-react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getStoredCompanyId } from "@/lib/tenant"
import { getStoredSession } from "@/lib/auth"
import { VoltPageTour } from "@/components/tours/VoltPageTour"

type Task = {
  id: string
  dbId?: number
  companyId: number
  title: string
  description?: string
  status: "pending" | "in-progress" | "completed"
  priority: "low" | "medium" | "high"
  assignmentType?: "personal" | "assigned"
  assignedToUserId?: number
  assigneeId?: number
  createdByUserId?: number
  assignee?: {
    id?: number
    name: string
    initials: string
  }
  dueDate?: string
  createdAt?: string
  updatedAt?: string
  createdAtRaw?: string
  updatedAtRaw?: string
  tags?: string[]
}

type TicketItem = {
  id: string
  dbId: number
  companyId: number
  title: string
  description?: string
  status: "open" | "in-progress" | "resolved" | "closed"
  priority: "low" | "medium" | "high" | "critical"
  assigneeId?: number
  reporterId?: number
  assignee?: {
    id?: number
    name: string
    initials: string
  }
  reporter?: {
    id?: number
    name: string
    initials: string
  }
  createdAt?: string
  updatedAt?: string
  createdAtRaw?: string
  updatedAtRaw?: string
  comments?: number
}

type GraphMode = "tasks" | "tickets" | "both"

function getCompanyId() {
  const session = getStoredSession()
  return getStoredCompanyId() || session?.companyId
}

function getInitials(name?: string) {
  if (!name) return "ME"

  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function getDateKey(value?: string) {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return null

  return date.toISOString().slice(0, 10)
}

function getDateRange(days: number) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Array.from({ length: days }).map((_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (days - 1 - index))

    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      shortLabel: date.toLocaleDateString("en-US", {
        weekday: "short",
      }),
    }
  })
}

function samePerson(a?: string, b?: string) {
  if (!a || !b) return false

  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function getTaskUserId(task: Task) {
  return Number(
    task.assignedToUserId ||
      task.assigneeId ||
      task.assignee?.id ||
      0
  )
}

function getTicketAssigneeId(ticket: TicketItem) {
  return Number(ticket.assigneeId || ticket.assignee?.id || 0)
}

function getTicketReporterId(ticket: TicketItem) {
  return Number(ticket.reporterId || ticket.reporter?.id || 0)
}

function isTaskLinkedToUser(task: Task, userId: number, userName: string) {
  const taskUserId = getTaskUserId(task)

  if (userId && taskUserId && taskUserId === userId) return true

  return samePerson(task.assignee?.name, userName)
}

function isTicketLinkedToUser(ticket: TicketItem, userId: number, userName: string) {
  const assigneeId = getTicketAssigneeId(ticket)
  const reporterId = getTicketReporterId(ticket)

  if (userId && assigneeId && assigneeId === userId) return true
  if (userId && reporterId && reporterId === userId) return true

  return (
    samePerson(ticket.assignee?.name, userName) ||
    samePerson(ticket.reporter?.name, userName)
  )
}

function priorityClass(priority: string) {
  if (priority === "critical") {
    return "bg-destructive text-destructive-foreground hover:bg-destructive"
  }

  if (priority === "high") {
    return "bg-destructive/15 text-destructive hover:bg-destructive/15"
  }

  if (priority === "medium") {
    return "bg-yellow-500/15 text-yellow-600 hover:bg-yellow-500/15"
  }

  return "bg-muted text-muted-foreground hover:bg-muted"
}

function statusClass(status: string) {
  if (status === "completed" || status === "resolved" || status === "closed") {
    return "bg-primary/15 text-primary hover:bg-primary/15"
  }

  if (status === "in-progress") {
    return "bg-blue-500/15 text-blue-500 hover:bg-blue-500/15"
  }

  return "bg-muted text-muted-foreground hover:bg-muted"
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "default",
}: {
  title: string
  value: number | string
  description: string
  icon: any
  tone?: "default" | "primary" | "accent" | "danger"
}) {
  return (
    <Card className="overflow-hidden border-border/60 bg-card/80 shadow-sm backdrop-blur">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {title}
            </p>

            <h3 className="text-3xl font-bold tracking-tight">{value}</h3>

            <p className="text-xs text-muted-foreground">{description}</p>
          </div>

          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
              tone === "primary" && "bg-primary/10 text-primary",
              tone === "accent" && "bg-accent/10 text-accent",
              tone === "danger" && "bg-destructive/10 text-destructive",
              tone === "default" && "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function MyDashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [graphMode, setGraphMode] = useState<GraphMode>("tasks")

  const [mounted, setMounted] = useState(false)
  const [currentUserId, setCurrentUserId] = useState(0)
  const [currentUserName, setCurrentUserName] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  async function loadMyDashboard(showLoading = false) {
    const companyId = getCompanyId()
    const session: any = getStoredSession()
    const userId = Number(session?.userId || session?.id || session?.appUserId || 0)

    if (!companyId) {
      setError("No active dashboard selected.")
      setLoading(false)
      return
    }

    try {
      if (showLoading) {
        setLoading(true)
      }

      setError("")

      const refreshKey = Date.now()

      const [tasksResponse, ticketsResponse] = await Promise.all([
        fetch(`/api/tasks?companyId=${companyId}&userId=${userId}&refresh=${refreshKey}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        }),
        fetch(`/api/tickets?companyId=${companyId}&userId=${userId}&refresh=${refreshKey}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        }),
      ])

      const tasksData = await tasksResponse.json().catch(() => null)
      const ticketsData = await ticketsResponse.json().catch(() => null)

      if (!tasksResponse.ok) {
        throw new Error(
          tasksData?.details || tasksData?.error || "Failed to load tasks"
        )
      }

      if (!ticketsResponse.ok) {
        throw new Error(
          ticketsData?.details || ticketsData?.error || "Failed to load tickets"
        )
      }

      setTasks(Array.isArray(tasksData) ? tasksData : [])
      setTickets(Array.isArray(ticketsData) ? ticketsData : [])
      setLastUpdated(new Date())
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load your dashboard"
      )
    } finally {
      setLoading(false)
    }
  }
useEffect(() => {
  setMounted(true)

  const session: any = getStoredSession()
  const userId = Number(session?.userId || session?.id || session?.appUserId || 0)
  const userName = session?.fullName || session?.name || ""

  setCurrentUserId(userId)
  setCurrentUserName(userName)

  loadMyDashboard(true)

  const refreshInterval = setInterval(() => {
    loadMyDashboard(false)
  }, 3000)

  const handleFocus = () => {
    loadMyDashboard(false)
  }

  const handleVisibilityChange = () => {
    if (!document.hidden) {
      loadMyDashboard(false)
    }
  }

  window.addEventListener("focus", handleFocus)
  document.addEventListener("visibilitychange", handleVisibilityChange)

  return () => {
    clearInterval(refreshInterval)
    window.removeEventListener("focus", handleFocus)
    document.removeEventListener("visibilitychange", handleVisibilityChange)
  }
}, [])
  const userId = currentUserId
  const userName = currentUserName
  const userInitials = mounted ? getInitials(userName) : "ME"

  const myTasks = useMemo(() => {
    return tasks.filter((task) => isTaskLinkedToUser(task, userId, userName))
  }, [tasks, userId, userName])

  const myTickets = useMemo(() => {
    return tickets.filter((ticket) =>
      isTicketLinkedToUser(ticket, userId, userName)
    )
  }, [tickets, userId, userName])
const completedTasks = myTasks.filter((task) => {
  const status = String(task.status || "").toLowerCase().trim()
  return status === "completed" || status === "complete" || status === "done"
}).length

const pendingTasks = myTasks.filter((task) => {
  const status = String(task.status || "").toLowerCase().trim()
  return status === "pending" || status === "todo" || status === "to-do"
}).length

const inProgressTasks = myTasks.filter((task) => {
  const status = String(task.status || "").toLowerCase().trim()
  return status === "in-progress" || status === "in progress" || status === "progress"
}).length

const activeTasks = myTasks.length - completedTasks

const resolvedTickets = myTickets.filter((ticket) => {
  const status = String(ticket.status || "").toLowerCase().trim()
  return status === "resolved" || status === "closed" || status === "completed" || status === "complete" || status === "done"
}).length

const openTickets = myTickets.length - resolvedTickets
  const taskProgress =
    myTasks.length > 0 ? Math.round((completedTasks / myTasks.length) * 100) : 0

  const highPriorityCount =
    myTasks.filter((task) => task.priority === "high").length +
    myTickets.filter(
      (ticket) => ticket.priority === "high" || ticket.priority === "critical"
    ).length
const graphData = useMemo(() => {
  const days = getDateRange(7)

  return days.map((day) => {
    const dayTasks = myTasks.filter((task) => {
      const dateValue =
        task.updatedAtRaw ||
        task.updatedAt ||
        task.createdAtRaw ||
        task.createdAt ||
        task.dueDate

      return getDateKey(dateValue) === day.key
    })

    const dayTickets = myTickets.filter((ticket) => {
      const dateValue =
        ticket.updatedAtRaw ||
        ticket.updatedAt ||
        ticket.createdAtRaw ||
        ticket.createdAt

      return getDateKey(dateValue) === day.key
    })

    const completedTaskCount = dayTasks.filter((task) => {
      const status = String(task.status || "").toLowerCase().trim()
      return status === "completed" || status === "complete" || status === "done"
    }).length

    const completedTicketCount = dayTickets.filter((ticket) => {
      const status = String(ticket.status || "").toLowerCase().trim()
      return status === "resolved" || status === "closed" || status === "completed" || status === "complete" || status === "done"
    }).length

    return {
      ...day,
      tasks: dayTasks.length,
      tickets: dayTickets.length,
      completedTasks: completedTaskCount,
      completedTickets: completedTicketCount,
      total: dayTasks.length + dayTickets.length,
      completedTotal: completedTaskCount + completedTicketCount,
    }
  })
}, [myTasks, myTickets, lastUpdated])

  const maxGraphValue = Math.max(
    1,
    ...graphData.map((item) => {
      if (graphMode === "tasks") return item.tasks
      if (graphMode === "tickets") return item.tickets
      return item.total
    })
  )

  const graphTotalActivity = graphData.reduce((total, item) => {
    if (graphMode === "tasks") return total + item.tasks
    if (graphMode === "tickets") return total + item.tickets

    return total + item.total
  }, 0)

  const achievements = [
    {
      title: "Task Finisher",
      description: "Complete at least 5 personal tasks",
      unlocked: completedTasks >= 5,
      progress: Math.min(100, Math.round((completedTasks / 5) * 100)),
    },
    {
      title: "Momentum Builder",
      description: "Reach 75% personal task progress",
      unlocked: taskProgress >= 75,
      progress: Math.min(100, taskProgress),
    },
    {
      title: "Ticket Solver",
      description: "Resolve at least 5 tickets linked to you",
      unlocked: resolvedTickets >= 5,
      progress: Math.min(100, Math.round((resolvedTickets / 5) * 100)),
    },
  ]

  const recentItems = [
    ...myTasks.slice(0, 5).map((task) => ({
      id: `task-${task.id}`,
      type: "task",
      title: task.title,
      status: task.status,
      priority: task.priority,
      href: "/tasks",
    })),
    ...myTickets.slice(0, 3).map((ticket) => ({
      id: `ticket-${ticket.dbId}`,
      type: "ticket",
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      href: "/tickets",
    })),
  ].slice(0, 6)

  return (
    <DashboardLayout
      title="My Dashboard"
      subtitle="Your personal tasks, tickets, achievements and progress."
    >
      <VoltPageTour
        storageKey="volt-my-dashboard-tour-seen"
        steps={[
          {
            title: "Welcome to My Dashboard ⚡",
            description: "This is your personal view of Volt. See your active tasks, tickets, XP progress and recent activity — all in one place, updating live.",
            image: "/volty/step-1-welcome.png",
            placement: "center",
          },
          {
            title: "Your Profile Card",
            description: "This card shows your name, role, XP level, and completion stats. It updates every time you finish a task or resolve a ticket.",
            target: "[data-tour=\"my-profile-card\"]",
            placement: "bottom",
            mascotSide: "right",
            image: "/volty/step-3-dashboards.png",
          },
          {
            title: "Your Active Tasks",
            description: "Tasks assigned to you appear here. You can see status, priority, and due dates at a glance. Overdue tasks show in red.",
            target: "[data-tour=\"my-tasks-section\"]",
            placement: "top",
            mascotSide: "left",
            image: "/volty/step-2-join-codes.png",
          },
          {
            title: "Your Tickets",
            description: "Tickets assigned to or raised by you show here. Open, in-progress and recently closed tickets all appear in this section.",
            target: "[data-tour=\"my-tickets-section\"]",
            placement: "top",
            mascotSide: "right",
            image: "/volty/step-4-plan-upgrade.png",
          },
          {
            title: "Activity Charts",
            description: "The graphs update live as work moves. They show your output over time so you can spot patterns and stay productive.",
            target: "[data-tour=\"my-charts-section\"]",
            placement: "top",
            mascotSide: "left",
            image: "/volty/step-5-build-dashboard.png",
          },
          {
            title: "You're all set!",
            description: "Your dashboard refreshes automatically. Complete tasks, close tickets and watch your stats grow.",
            image: "/volty/step-6-goodbye.png",
            placement: "center",
          },
        ]}
      />
      <div className="space-y-6">
        <Card data-tour="my-profile-card" className="overflow-hidden border-border/60 bg-gradient-to-br from-card to-muted/30 shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border border-border">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <p className="text-sm text-muted-foreground">
                    Personal Overview
                  </p>

                  <h2 className="text-2xl font-bold tracking-tight">
                    Welcome back, {userName || "Team Member"}
                  </h2>

                  <p className="text-sm text-muted-foreground">
                    This page only shows work linked to you.
                  </p>

                  {lastUpdated && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Live updated {lastUpdated.toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/tasks">Open Tasks</Link>
                </Button>

                <Button asChild variant="outline">
                  <Link href="/tickets">Open Tickets</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive/30 bg-destructive/10">
            <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <Card>
            <CardContent className="flex min-h-[320px] items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading your personal dashboard...
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="My Tasks"
                value={myTasks.length}
                description={`${completedTasks} completed, ${activeTasks} active`}
                icon={CheckSquare}
                tone="primary"
              />

              <StatCard
                title="My Tickets"
                value={myTickets.length}
                description={`${resolvedTickets} resolved, ${openTickets} open`}
                icon={Ticket}
                tone="accent"
              />

              <StatCard
                title="Task Progress"
                value={`${taskProgress}%`}
                description="Based only on your personal tasks"
                icon={TrendingUp}
                tone="primary"
              />

              <StatCard
                title="High Priority"
                value={highPriorityCount}
                description="Important items linked to you"
                icon={Target}
                tone="danger"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-border/60 bg-card/95 shadow-sm">
                <CardHeader className="space-y-4 pb-3">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle>Personal Activity Graph</CardTitle>
                      <CardDescription>
                        A clean live view of your personal task and ticket activity.
                      </CardDescription>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(["tasks", "tickets", "both"] as GraphMode[]).map(
                        (mode) => (
                          <Button
                            key={mode}
                            type="button"
                            size="sm"
                            variant={graphMode === mode ? "default" : "outline"}
                            onClick={() => setGraphMode(mode)}
                            className="h-8 capitalize"
                          >
                            {mode}
                          </Button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Selected activity
                      </p>
                      <p className="text-2xl font-bold leading-none">
                        {graphTotalActivity}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          item{graphTotalActivity === 1 ? "" : "s"}
                        </span>
                      </p>
                    </div>

<div className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
  Weekly Live Updates
</div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="rounded-3xl border bg-gradient-to-b from-muted/30 to-background p-4 shadow-inner">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                          Tasks
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                          Tickets
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Peak day: {maxGraphValue} item{maxGraphValue === 1 ? "" : "s"}
                      </p>
                    </div>

                    <div className="relative overflow-x-auto pb-2">
                      <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-[260px] rounded-2xl opacity-60"
                        style={{
                          backgroundImage:
                            "linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
                          backgroundSize: "100% 52px",
                        }}
                      />

                      <div className="relative flex min-h-[320px] min-w-[760px] items-end gap-3 rounded-2xl px-2 pt-8">
                        {graphData.map((item) => {
                       const value =
  graphMode === "tasks"
    ? item.completedTasks
    : graphMode === "tickets"
      ? item.completedTickets
      : item.completedTotal

                          const barHeight = Math.max(
                            value === 0 ? 8 : 34,
                            (value / maxGraphValue) * 240
                          )

const taskHeight =
  value > 0 ? (item.completedTasks / value) * barHeight : 0

const ticketHeight =
  value > 0 ? (item.completedTickets / value) * barHeight : 0

                          return (
                            <div
                              key={item.key}
                              className="group flex flex-1 flex-col items-center gap-3"
                            >
                              <div className="relative flex h-[260px] w-full items-end justify-center">
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20 hidden whitespace-nowrap rounded-xl border bg-card px-3 py-1.5 text-xs shadow-lg group-hover:block">
                                  <span className="font-semibold">{value}</span>{" "}
                                  item{value === 1 ? "" : "s"} • {item.label}
                                  {graphMode === "both" && (
                                    <span className="ml-1 text-muted-foreground">
                                      ({item.tasks} tasks, {item.tickets} tickets)
                                    </span>
                                  )}
                                </div>

                                <div
                                  className="flex w-full max-w-[46px] flex-col-reverse overflow-hidden rounded-b-md rounded-t-2xl border border-primary/10 bg-muted shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg"
                                  style={{ height: barHeight }}
                                >
                                  {graphMode === "both" ? (
                                    <>
                                      <div
                                        className="bg-primary"
                                        style={{
                                          height: Math.max(
                                            taskHeight,
                                            item.tasks > 0 ? 10 : 0
                                          ),
                                        }}
                                      />
                                      <div
                                        className="bg-accent"
                                        style={{
                                          height: Math.max(
                                            ticketHeight,
                                            item.tickets > 0 ? 10 : 0
                                          ),
                                        }}
                                      />
                                    </>
                                  ) : (
                                    <div
                                      className={cn(
                                        "h-full w-full",
                                        graphMode === "tasks"
                                          ? "bg-primary"
                                          : "bg-accent"
                                      )}
                                    />
                                  )}
                                </div>
                              </div>

                              <div className="text-center leading-tight">
                                <p className="text-xs font-semibold">
                                  {item.shortLabel}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {item.label}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-border/60 bg-card/95 shadow-sm">
                <CardHeader>
                  <CardTitle>Task Progress</CardTitle>
                  <CardDescription>
                    Your completion rate across personal tasks only.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="flex items-center justify-center py-2">
                    <div className="relative flex h-48 w-48 items-center justify-center rounded-full bg-muted shadow-inner">
                      <div
                        className="absolute inset-0 rounded-full shadow-sm"
                        style={{
                          background: `conic-gradient(var(--primary) ${taskProgress}%, var(--muted) ${taskProgress}% 100%)`,
                        }}
                      />

                      <div className="absolute inset-3 rounded-full bg-card" />

                      <div className="relative flex h-36 w-36 flex-col items-center justify-center rounded-full border bg-background shadow-sm">
                        <span className="text-4xl font-bold tracking-tight">
                          {taskProgress}%
                        </span>
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          complete
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                    <div className="rounded-2xl border bg-muted/20 p-4">
                      <p className="text-xs text-muted-foreground">
                        Completed Tasks
                      </p>
                      <p className="text-2xl font-bold">{completedTasks}</p>
                    </div>

                    <div className="rounded-2xl border bg-muted/20 p-4">
                      <p className="text-xs text-muted-foreground">
                        In Progress
                      </p>
                      <p className="text-2xl font-bold">{inProgressTasks}</p>
                    </div>

                    <div className="rounded-2xl border bg-muted/20 p-4">
                      <p className="text-xs text-muted-foreground">
                        To Do
                      </p>
                      <p className="text-2xl font-bold">{pendingTasks}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Personal task completion</span>
                      <span>
                        {completedTasks}/{myTasks.length || 0}
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                        style={{ width: `${taskProgress}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    My Achievements
                  </CardTitle>

                  <CardDescription>
                    Personal badges based on your task progress.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {achievements.map((achievement) => (
                    <div
                      key={achievement.title}
                      className={cn(
                        "rounded-2xl border p-4",
                        achievement.unlocked
                          ? "border-primary/30 bg-primary/10"
                          : "bg-muted/30"
                      )}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{achievement.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {achievement.description}
                          </p>
                        </div>

                        {achievement.unlocked ? (
                          <Badge className="bg-primary text-primary-foreground">
                            Unlocked
                          </Badge>
                        ) : (
                          <Badge variant="outline">Locked</Badge>
                        )}
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                          style={{ width: `${achievement.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>My Recent Work</CardTitle>
                  <CardDescription>
                    Your latest personal tasks and linked tickets.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {recentItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-8 text-center">
                      <UserRound className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />

                      <p className="font-medium">No personal work found</p>

                      <p className="text-sm text-muted-foreground">
                        Tasks assigned to you will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentItems.map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          className="flex flex-col gap-3 rounded-2xl border bg-background/60 p-4 transition hover:bg-muted/40 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div
                              className={cn(
                                "mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl",
                                item.status === "completed" ||
                                  item.status === "resolved" ||
                                  item.status === "closed"
                                  ? "bg-primary/10 text-primary"
                                  : item.status === "in-progress"
                                    ? "bg-blue-500/10 text-blue-500"
                                    : "bg-muted text-muted-foreground"
                              )}
                            >
                              {item.status === "completed" ||
                              item.status === "resolved" ||
                              item.status === "closed" ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <Clock className="h-4 w-4" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {item.title}
                              </p>

                              <p className="text-xs text-muted-foreground capitalize">
                                {item.type}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              className={cn(
                                "capitalize",
                                statusClass(item.status)
                              )}
                            >
                              {item.status.replace("-", " ")}
                            </Badge>

                            <Badge
                              className={cn(
                                "capitalize",
                                priorityClass(item.priority)
                              )}
                            >
                              {item.priority}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}