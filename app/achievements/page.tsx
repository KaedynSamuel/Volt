"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { VoltPageTour } from "@/components/tours/VoltPageTour"
import {
  Award,
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Flame,
  Gem,
  Layers3,
  Loader2,
  Lock,
  Medal,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Ticket,
  Trophy,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { getStoredSession } from "@/lib/auth"
import { VoltLevelUp, VoltTierUp } from "@/components/ui/volt-levelup"
import { VoltBanner } from "@/components/ui/volt-banner"

type AchievementTask = {
  id: string
  title?: string
  status?: string
  priority?: string
  dueDate?: string
  due_date?: string
  completedAt?: string
  completed_at?: string
  createdAt?: string
  created_at?: string
  assignedTo?: string
  assigneeId?: string
  isDeleted?: boolean
  deleted?: boolean
  deletedAt?: string
  assignee?: {
    name?: string
    initials?: string
  }
}

type AchievementTicket = {
  id: string
  title?: string
  status?: string
  priority?: string
  dueDate?: string
  due_date?: string
  resolvedAt?: string
  resolved_at?: string
  completedAt?: string
  completed_at?: string
  createdAt?: string
  created_at?: string
  assignee?: {
    name?: string
    initials?: string
  }
  isDeleted?: boolean
  deleted?: boolean
  deletedAt?: string
  reporter?: {
    name?: string
    initials?: string
  }
}

type BadgeDifficulty = "Easy" | "Medium" | "Hard" | "Legendary"

type AchievementStats = {
  totalXp: number
  tasksCompleted: number
  ticketsResolved: number
  totalCompleted: number
  highPriorityCompleted: number
  urgentCompleted: number
  earlyTasks: number
  twoDaysEarlyTasks: number
  sameDayTasks: number
  overdueCompleted: number
  overdueTasks: number
  overduePenaltyXp: number
  createdTasks: number
  createdTickets: number
  activeTasks: number
  activeTickets: number
  totalWorkItems: number
}

type AchievementBadge = {
  id: string
  name: string
  description: string
  image: string
  fallback: React.ElementType
  difficulty: BadgeDifficulty
  metric: number
  target: number
  unlocked: boolean
  xpReward: number
}

type StoredYearRank = {
  year: number
  tierName: string
  tierLevel: number
  globalLevel: number
  totalXp: number
  image: string
}

type StoredAchievementProgress = {
  totalXp: number
  completedTaskIds: string[]
  recentAchievements: string[]
  lastCompletedTaskTitle?: string
  lastUpdatedAt: string
}

const LEVELS_PER_TIER = 30
const XP_PER_LEVEL = 100
const MAX_PROFILE_BADGES = 5
const ACHIEVEMENT_PROGRESS_STORAGE_PREFIX = "volt-achievement-progress"

function getAchievementProgressStorageKey(
  session?: { companyId?: unknown; userId?: unknown; email?: string } | null
) {
  return `${ACHIEVEMENT_PROGRESS_STORAGE_PREFIX}-${
    session?.companyId || "global"
  }-${session?.userId || session?.email || "user"}`
}

function readStoredAchievementProgress(key: string): StoredAchievementProgress {
  if (typeof window === "undefined") {
    return {
      totalXp: 0,
      completedTaskIds: [],
      recentAchievements: [],
      lastUpdatedAt: new Date().toISOString(),
    }
  }

  try {
    const stored = window.localStorage.getItem(key)
    const parsed = stored ? JSON.parse(stored) : null

    return {
      totalXp: Number(parsed?.totalXp || 0),
      completedTaskIds: Array.isArray(parsed?.completedTaskIds)
        ? parsed.completedTaskIds
        : [],
      recentAchievements: Array.isArray(parsed?.recentAchievements)
        ? parsed.recentAchievements
        : [],
      lastCompletedTaskTitle: parsed?.lastCompletedTaskTitle,
      lastUpdatedAt: parsed?.lastUpdatedAt || new Date().toISOString(),
    }
  } catch {
    return {
      totalXp: 0,
      completedTaskIds: [],
      recentAchievements: [],
      lastUpdatedAt: new Date().toISOString(),
    }
  }
}

const TIERS = [
  {
    name: "Spark",
    color: "#22c55e",
    glow: "rgba(34, 197, 94, 0.35)",
    image: "/badges/rank-spark.png",
    description: "The first ignition of your Volt journey.",
  },
  {
    name: "Pulse",
    color: "#06b6d4",
    glow: "rgba(6, 182, 212, 0.35)",
    image: "/badges/rank-pulse.png",
    description: "You are building rhythm and consistency.",
  },
  {
    name: "Surge",
    color: "#3b82f6",
    glow: "rgba(59, 130, 246, 0.35)",
    image: "/badges/rank-surge.png",
    description: "Your work rate is becoming powerful.",
  },
  {
    name: "Voltage",
    color: "#8b5cf6",
    glow: "rgba(139, 92, 246, 0.35)",
    image: "/badges/rank-voltage.png",
    description: "You are operating at a high level.",
  },
  {
    name: "Overdrive",
    color: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.35)",
    image: "/badges/rank-overdrive.png",
    description: "You are pushing beyond normal output.",
  },
  {
    name: "Apex",
    color: "#f97316",
    glow: "rgba(249, 115, 22, 0.35)",
    image: "/badges/rank-apex.png",
    description: "You are one of the top performers.",
  },
  {
    name: "Legend",
    color: "#ef4444",
    glow: "rgba(239, 68, 68, 0.35)",
    image: "/badges/rank-legend.png",
    description: "A rare level of consistency and impact.",
  },
]

function normaliseList<T>(data: any, key: string): T[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data[key])) return data[key]
  if (data && Array.isArray(data.data)) return data.data
  return []
}

function isCompleted(status?: string) {
  return ["completed", "complete", "done", "resolved", "closed"].includes(
    String(status || "").toLowerCase()
  )
}

function isActive(status?: string) {
  return ["open", "pending", "in-progress", "in progress", "active"].includes(
    String(status || "").toLowerCase()
  )
}

function isHighPriority(priority?: string) {
  return ["high", "critical", "urgent"].includes(
    String(priority || "").toLowerCase()
  )
}

function isUrgent(priority?: string) {
  return ["critical", "urgent"].includes(String(priority || "").toLowerCase())
}


function isDeletedItem(item: AchievementTask | AchievementTicket) {
  return item.isDeleted === true || item.deleted === true || Boolean(item.deletedAt)
}

function getOverdueDays(item: AchievementTask | AchievementTicket) {
  if (isCompleted(item.status) || isDeletedItem(item)) return 0

  const due = getDueDate(item)

  if (!due) return 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)

  const diff = today.getTime() - due.getTime()

  if (diff <= 0) return 0

  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function parseDate(value?: string) {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

function getDueDate(item: AchievementTask | AchievementTicket) {
  return parseDate(item.dueDate || item.due_date)
}

function getCreatedDate(item: AchievementTask | AchievementTicket) {
  return parseDate(item.createdAt || item.created_at)
}

function getCompletedDate(item: AchievementTask | AchievementTicket) {
  return parseDate(
    "resolvedAt" in item
      ? item.resolvedAt ||
          item.resolved_at ||
          item.completedAt ||
          item.completed_at
      : item.completedAt || item.completed_at
  )
}

function completedBeforeDue(item: AchievementTask | AchievementTicket) {
  const due = getDueDate(item)
  const completed = getCompletedDate(item)

  if (!due || !completed) return false

  return completed.getTime() <= due.getTime()
}

function completedTwoDaysBeforeDue(item: AchievementTask | AchievementTicket) {
  const due = getDueDate(item)
  const completed = getCompletedDate(item)

  if (!due || !completed) return false

  const twoDaysMs = 1000 * 60 * 60 * 24 * 2

  return completed.getTime() <= due.getTime() - twoDaysMs
}

function completedSameDayCreated(item: AchievementTask | AchievementTicket) {
  const created = getCreatedDate(item)
  const completed = getCompletedDate(item)

  if (!created || !completed) return false

  return created.toDateString() === completed.toDateString()
}

function completedAfterDue(item: AchievementTask | AchievementTicket) {
  const due = getDueDate(item)
  const completed = getCompletedDate(item)

  if (!due || !completed) return false

  return completed.getTime() > due.getTime()
}

function getAchievementRank(totalXp: number) {
  const globalLevel = Math.floor(totalXp / XP_PER_LEVEL) + 1

  const tierIndex = Math.min(
    Math.floor((globalLevel - 1) / LEVELS_PER_TIER),
    TIERS.length - 1
  )

  const tier = TIERS[tierIndex]
  const tierLevel = ((globalLevel - 1) % LEVELS_PER_TIER) + 1
  const currentLevelXp = totalXp % XP_PER_LEVEL
  const xpToNextLevel = XP_PER_LEVEL - currentLevelXp
  const progressPercent = Math.round((currentLevelXp / XP_PER_LEVEL) * 100)

  return {
    tier,
    tierIndex,
    tierLevel,
    globalLevel,
    currentLevelXp,
    xpToNextLevel,
    progressPercent,
    nextTier: TIERS[Math.min(tierIndex + 1, TIERS.length - 1)],
  }
}

function getStats(tasks: AchievementTask[], tickets: AchievementTicket[]) {
  const visibleTasks = tasks.filter((task) => !isDeletedItem(task))
  const visibleTickets = tickets.filter((ticket) => !isDeletedItem(ticket))
  const completedTasks = visibleTasks.filter((task) => isCompleted(task.status))
  const resolvedTickets = visibleTickets.filter((ticket) => isCompleted(ticket.status))

  const allCompleted = [...completedTasks, ...resolvedTickets]

  const highPriorityCompleted = allCompleted.filter((item) =>
    isHighPriority(item.priority)
  ).length

  const urgentCompleted = allCompleted.filter((item) =>
    isUrgent(item.priority)
  ).length

  const earlyTasks = completedTasks.filter((task) =>
    completedBeforeDue(task)
  ).length

  const twoDaysEarlyTasks = completedTasks.filter((task) =>
    completedTwoDaysBeforeDue(task)
  ).length

  const sameDayTasks = completedTasks.filter((task) =>
    completedSameDayCreated(task)
  ).length

  const overdueCompleted = allCompleted.filter((item) =>
    completedAfterDue(item)
  ).length

  const tasksCompleted = completedTasks.length
  const ticketsResolved = resolvedTickets.length
  const totalCompleted = tasksCompleted + ticketsResolved

  const overdueTasks = visibleTasks.filter((task) => getOverdueDays(task) > 0).length
  const overduePenaltyXp = visibleTasks.reduce(
    (total, task) => total + getOverdueDays(task) * 10,
    0
  )

  const earnedXp =
    tasksCompleted * 20 +
    ticketsResolved * 40 +
    highPriorityCompleted * 25 +
    urgentCompleted * 35 +
    earlyTasks * 15 +
    twoDaysEarlyTasks * 25 +
    sameDayTasks * 10

  const totalXp = Math.max(0, earnedXp - overduePenaltyXp)

  return {
    totalXp,
    tasksCompleted,
    ticketsResolved,
    totalCompleted,
    highPriorityCompleted,
    urgentCompleted,
    earlyTasks,
    twoDaysEarlyTasks,
    sameDayTasks,
    overdueCompleted,
    overdueTasks,
    overduePenaltyXp,
    createdTasks: visibleTasks.length,
    createdTickets: visibleTickets.length,
    activeTasks: visibleTasks.filter((task) => isActive(task.status)).length,
    activeTickets: visibleTickets.filter((ticket) => isActive(ticket.status)).length,
    totalWorkItems: visibleTasks.length + visibleTickets.length,
  }
}

function makeBadge(
  id: string,
  name: string,
  description: string,
  fallback: React.ElementType,
  difficulty: BadgeDifficulty,
  metric: number,
  target: number,
  xpReward: number
): AchievementBadge {
  return {
    id,
    name,
    description,
    image: `/badges/${id}.png`,
    fallback,
    difficulty,
    metric,
    target,
    xpReward,
    unlocked: metric >= target,
  }
}

function getBadges(stats: AchievementStats): AchievementBadge[] {
  return [
    makeBadge("first-spark", "First Spark", "Complete your first task.", Zap, "Easy", stats.tasksCompleted, 1, 25),
    makeBadge("task-starter", "Task Starter", "Complete 5 tasks.", CheckCircle2, "Easy", stats.tasksCompleted, 5, 50),
    makeBadge("task-builder", "Task Builder", "Complete 10 tasks.", CheckCircle2, "Easy", stats.tasksCompleted, 10, 75),
    makeBadge("task-runner", "Task Runner", "Complete 15 tasks.", Rocket, "Easy", stats.tasksCompleted, 15, 90),
    makeBadge("task-flow", "Task Flow", "Complete 20 tasks.", Layers3, "Easy", stats.tasksCompleted, 20, 110),
    makeBadge("daily-pusher", "Daily Pusher", "Complete 25 tasks.", Flame, "Easy", stats.tasksCompleted, 25, 125),
    makeBadge("task-grinder", "Task Grinder", "Complete 30 tasks.", Trophy, "Medium", stats.tasksCompleted, 30, 150),
    makeBadge("work-sprinter", "Work Sprinter", "Complete 40 tasks.", Rocket, "Medium", stats.tasksCompleted, 40, 180),
    makeBadge("task-master", "Task Master", "Complete 50 tasks.", Trophy, "Medium", stats.tasksCompleted, 50, 220),
    makeBadge("task-champion", "Task Champion", "Complete 75 tasks.", Medal, "Medium", stats.tasksCompleted, 75, 300),
    makeBadge("task-elite", "Task Elite", "Complete 100 tasks.", Award, "Hard", stats.tasksCompleted, 100, 450),
    makeBadge("task-commander", "Task Commander", "Complete 150 tasks.", ShieldCheck, "Hard", stats.tasksCompleted, 150, 650),
    makeBadge("task-overlord", "Task Overlord", "Complete 200 tasks.", Gem, "Legendary", stats.tasksCompleted, 200, 900),
    makeBadge("ticket-rookie", "Ticket Rookie", "Resolve your first ticket.", Ticket, "Easy", stats.ticketsResolved, 1, 40),
    makeBadge("ticket-helper", "Ticket Helper", "Resolve 5 tickets.", Ticket, "Easy", stats.ticketsResolved, 5, 80),
    makeBadge("ticket-solver", "Ticket Solver", "Resolve 10 tickets.", Ticket, "Easy", stats.ticketsResolved, 10, 120),
    makeBadge("ticket-specialist", "Ticket Specialist", "Resolve 20 tickets.", BadgeCheck, "Medium", stats.ticketsResolved, 20, 180),
    makeBadge("ticket-warrior", "Ticket Warrior", "Resolve 35 tickets.", ShieldCheck, "Medium", stats.ticketsResolved, 35, 260),
    makeBadge("ticket-guardian", "Ticket Guardian", "Resolve 50 tickets.", Trophy, "Hard", stats.ticketsResolved, 50, 400),
    makeBadge("ticket-legend", "Ticket Legend", "Resolve 100 tickets.", Gem, "Legendary", stats.ticketsResolved, 100, 850),
    makeBadge("early-bird", "Early Bird", "Complete 1 task before the due date.", Clock, "Easy", stats.earlyTasks, 1, 40),
    makeBadge("deadline-dodger", "Deadline Dodger", "Complete 5 tasks before due dates.", CalendarCheck, "Easy", stats.earlyTasks, 5, 90),
    makeBadge("ahead-of-time", "Ahead Of Time", "Complete 10 tasks before due dates.", CalendarCheck, "Medium", stats.earlyTasks, 10, 160),
    makeBadge("two-days-early", "Two Days Early", "Complete 3 tasks at least 2 days before due.", Clock, "Medium", stats.twoDaysEarlyTasks, 3, 180),
    makeBadge("future-planner", "Future Planner", "Complete 10 tasks at least 2 days before due.", Target, "Hard", stats.twoDaysEarlyTasks, 10, 350),
    makeBadge("same-day-finisher", "Same Day Finisher", "Complete 5 tasks on the same day they were created.", Zap, "Easy", stats.sameDayTasks, 5, 100),
    makeBadge("speed-runner", "Speed Runner", "Complete 15 tasks on the same day they were created.", Rocket, "Medium", stats.sameDayTasks, 15, 220),
    makeBadge("lightning-close", "Lightning Close", "Complete 30 tasks on the same day they were created.", Zap, "Hard", stats.sameDayTasks, 30, 420),
    makeBadge("priority-spark", "Priority Spark", "Complete 3 high priority items.", Flame, "Easy", stats.highPriorityCompleted, 3, 100),
    makeBadge("priority-hero", "Priority Hero", "Complete 10 high priority items.", Flame, "Medium", stats.highPriorityCompleted, 10, 220),
    makeBadge("pressure-player", "Pressure Player", "Complete 25 high priority items.", ShieldCheck, "Hard", stats.highPriorityCompleted, 25, 500),
    makeBadge("urgent-responder", "Urgent Responder", "Complete 3 urgent or critical items.", Flame, "Medium", stats.urgentCompleted, 3, 180),
    makeBadge("critical-closer", "Critical Closer", "Complete 10 urgent or critical items.", ShieldCheck, "Hard", stats.urgentCompleted, 10, 400),
    makeBadge("crisis-legend", "Crisis Legend", "Complete 25 urgent or critical items.", Gem, "Legendary", stats.urgentCompleted, 25, 850),
    makeBadge("work-item-one", "First Impact", "Complete your first task or ticket.", Star, "Easy", stats.totalCompleted, 1, 30),
    makeBadge("work-item-ten", "Ten Wins", "Complete 10 total work items.", BadgeCheck, "Easy", stats.totalCompleted, 10, 100),
    makeBadge("work-item-twenty-five", "Momentum", "Complete 25 total work items.", Rocket, "Medium", stats.totalCompleted, 25, 180),
    makeBadge("work-item-fifty", "Volt Grinder", "Complete 50 total work items.", Trophy, "Medium", stats.totalCompleted, 50, 300),
    makeBadge("work-item-hundred", "Century Worker", "Complete 100 total work items.", Award, "Hard", stats.totalCompleted, 100, 600),
    makeBadge("work-item-two-fifty", "Unstoppable", "Complete 250 total work items.", Gem, "Legendary", stats.totalCompleted, 250, 1200),
    makeBadge("active-operator", "Active Operator", "Have 5 active tasks.", BarChart3, "Easy", stats.activeTasks, 5, 60),
    makeBadge("task-juggler", "Task Juggler", "Have 15 active tasks.", Layers3, "Medium", stats.activeTasks, 15, 140),
    makeBadge("queue-controller", "Queue Controller", "Have 10 active tickets.", Ticket, "Medium", stats.activeTickets, 10, 160),
    makeBadge("system-watch", "System Watch", "Have 25 active tickets.", ShieldCheck, "Hard", stats.activeTickets, 25, 350),
    makeBadge("workload-builder", "Workload Builder", "Create or receive 50 total work items.", Layers3, "Medium", stats.totalWorkItems, 50, 250),
    makeBadge("workload-architect", "Workload Architect", "Create or receive 150 total work items.", Trophy, "Hard", stats.totalWorkItems, 150, 550),
    makeBadge("workload-empire", "Workload Empire", "Create or receive 300 total work items.", Gem, "Legendary", stats.totalWorkItems, 300, 1100),
    makeBadge("clean-finisher", "Clean Finisher", "Complete 10 items without missing due dates.", CheckCircle2, "Medium", Math.max(stats.totalCompleted - stats.overdueCompleted, 0), 10, 180),
    makeBadge("reliable-finisher", "Reliable Finisher", "Complete 30 items without missing due dates.", BadgeCheck, "Hard", Math.max(stats.totalCompleted - stats.overdueCompleted, 0), 30, 450),
    makeBadge("domain-surge", "Domain Surge", "Reach 5000 XP in the current year.", Sparkles, "Legendary", stats.totalXp, 5000, 1500),
  ]
}

function BadgeImage({
  badge,
  tierColor,
  size = "normal",
}: {
  badge: AchievementBadge
  tierColor: string
  size?: "small" | "normal" | "large"
}) {
  const Icon = badge.fallback
  const [failed, setFailed] = useState(false)
  const animatedSrc = `/badges/animated/${badge.id}.html`

  // px = outer container; inner iframe renders at 300px then scales down
  const px = size === "large" ? 130 : size === "small" ? 70 : 90
  const scale = px / 300

  return (
    <div className="relative shrink-0" style={{ width: px, height: px, overflow: "hidden" }}>
      {!failed ? (
        <iframe
          src={animatedSrc}
          title={badge.name}
          scrolling="no"
          style={{
            width: 300,
            height: 300,
            border: "none",
            background: "transparent",
            pointerEvents: "none",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            // negative margins collapse the scaled-down whitespace
            marginBottom: -(300 - px),
            marginRight: -(300 - px),
            filter: badge.unlocked ? undefined : "grayscale(1) brightness(0.28) opacity(0.55)",
          }}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-3xl"
          style={{ background: badge.unlocked ? `${tierColor}12` : "rgba(255,255,255,0.03)" }}
        >
          <Icon style={{ width: px * 0.5, height: px * 0.5, color: badge.unlocked ? tierColor : "rgba(255,255,255,0.3)" }} />
        </div>
      )}
      {!badge.unlocked && (
        <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/80 z-10">
          <Lock className="h-3 w-3 text-white/50" />
        </div>
      )}
    </div>
  )
}

function difficultyClass(difficulty: BadgeDifficulty) {
  if (difficulty === "Easy") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
  }

  if (difficulty === "Medium") {
    return "border-sky-400/20 bg-sky-400/10 text-sky-300"
  }

  if (difficulty === "Hard") {
    return "border-orange-400/20 bg-orange-400/10 text-orange-300"
  }

  return "border-red-400/20 bg-red-400/10 text-red-300"
}

export default function AchievementsPage() {
  const [mounted, setMounted] = useState(false)
  const [tasks, setTasks] = useState<AchievementTask[]>([])
  const [tickets, setTickets] = useState<AchievementTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedBadgeIds, setSelectedBadgeIds] = useState<string[]>([])
  const [storedProgress, setStoredProgress] =
    useState<StoredAchievementProgress>({
      totalXp: 0,
      completedTaskIds: [],
      recentAchievements: [],
      lastUpdatedAt: new Date().toISOString(),
    })
  const [levelUpData, setLevelUpData] = useState<{ level: number; tierName: string; tierColor: string } | null>(null)
  const [tierUpData, setTierUpData] = useState<{ fromTier: string; toTier: string; toColor: string } | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [badgeFilter, setBadgeFilter] = useState<"All"|"Easy"|"Medium"|"Hard"|"Legendary">("All")
  const prevLevelRef = React.useRef<number | null>(null)
  const prevTierRef = React.useRef<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const session = typeof window !== "undefined" ? getStoredSession() : null

  const storageKey = `volt-profile-badges-${
    session?.companyId || "global"
  }-${session?.userId || session?.email || "user"}`

  const yearRankKey = `volt-year-rank-${
    session?.companyId || "global"
  }-${session?.userId || session?.email || "user"}-${new Date().getFullYear()}`

  const progressStorageKey = getAchievementProgressStorageKey(session)

  useEffect(() => {
    if (!mounted) return

    const stored = localStorage.getItem(storageKey)

    if (stored) {
      setSelectedBadgeIds(JSON.parse(stored))
    }
  }, [mounted, storageKey])

  useEffect(() => {
    if (!mounted) return

    const syncProgress = () => {
      setStoredProgress(readStoredAchievementProgress(progressStorageKey))
    }

    syncProgress()

    window.addEventListener("storage", syncProgress)
    window.addEventListener("volt-achievement-progress-updated", syncProgress)

    return () => {
      window.removeEventListener("storage", syncProgress)
      window.removeEventListener(
        "volt-achievement-progress-updated",
        syncProgress
      )
    }
  }, [mounted, progressStorageKey])

  // Detect level-up and tier-up — uses localStorage to persist last-seen level
  // so the animation never fires on page load, only on genuine XP gains
  const prevXpRef = React.useRef<number | null>(null)
  useEffect(() => {
    if (!mounted) return

    const rank = getAchievementRank(storedProgress.totalXp)
    const currentLevel = rank.globalLevel
    const currentTier = rank.tier.name
    const currentXp = storedProgress.totalXp

    // Read last-seen values from localStorage (persists across page loads)
    const lsKey = `volt-last-level-${session?.userId || "user"}`
    const lsXpKey = `volt-last-xp-${session?.userId || "user"}`
    const lastLevel = parseInt(localStorage.getItem(lsKey) || "0", 10)
    const lastXp = parseInt(localStorage.getItem(lsXpKey) || "0", 10)

    // On first ever visit with no stored data, just save baseline — no animation
    if (lastLevel === 0) {
      localStorage.setItem(lsKey, String(currentLevel))
      localStorage.setItem(lsXpKey, String(currentXp))
      prevLevelRef.current = currentLevel
      prevTierRef.current = currentTier
      prevXpRef.current = currentXp
      return
    }

    // Only fire if XP genuinely increased since last time
    const xpIncreased = currentXp > lastXp

    if (xpIncreased && currentLevel > lastLevel) {
      // Get the previous tier name from the previous level
      const prevRank = getAchievementRank(lastXp)
      const prevTier = prevRank.tier.name

      if (prevTier !== currentTier) {
        setTierUpData({ fromTier: prevTier, toTier: currentTier, toColor: rank.tier.color })
        setTimeout(() => {
          setTierUpData(null)
          setLevelUpData({ level: currentLevel, tierName: currentTier, tierColor: rank.tier.color })
          setTimeout(() => setLevelUpData(null), 5000)
        }, 6000)
      } else {
        setLevelUpData({ level: currentLevel, tierName: currentTier, tierColor: rank.tier.color })
        setTimeout(() => setLevelUpData(null), 5000)
      }
    }

    // Always update stored baseline after checking
    localStorage.setItem(lsKey, String(currentLevel))
    localStorage.setItem(lsXpKey, String(currentXp))
    prevLevelRef.current = currentLevel
    prevTierRef.current = currentTier
    prevXpRef.current = currentXp
  }, [mounted, storedProgress.totalXp])

  useEffect(() => {
    if (!mounted) return

    async function loadAchievements() {
      try {
        setLoading(true)
        setError("")

        const activeSession = getStoredSession()

        if (!activeSession?.companyId) {
          setError("No active company found. Please open a dashboard first.")
          return
        }

        const companyId = String(activeSession.companyId)

        const [tasksResponse, ticketsResponse] = await Promise.all([
          fetch(`/api/tasks?companyId=${encodeURIComponent(companyId)}`, {
            cache: "no-store",
          }),
          fetch(`/api/tickets?companyId=${encodeURIComponent(companyId)}`, {
            cache: "no-store",
          }),
        ])

        const tasksData = await tasksResponse.json().catch(() => [])
        const ticketsData = await ticketsResponse.json().catch(() => [])

        setTasks(
          tasksResponse.ok
            ? normaliseList<AchievementTask>(tasksData, "tasks")
            : []
        )

        setTickets(
          ticketsResponse.ok
            ? normaliseList<AchievementTicket>(ticketsData, "tickets")
            : []
        )
      } catch {
        setError("Could not load achievements.")
      } finally {
        setLoading(false)
      }
    }

    loadAchievements()
  }, [mounted])

  const baseStats = useMemo(() => getStats(tasks, tickets), [tasks, tickets])
  const stats = useMemo(
    () => ({
      ...baseStats,
      totalXp: Math.max(baseStats.totalXp, storedProgress.totalXp),
    }),
    [baseStats, storedProgress.totalXp]
  )
  const rank = useMemo(() => getAchievementRank(stats.totalXp), [stats.totalXp])
  const badges = useMemo(() => getBadges(stats), [stats])
  const unlockedBadges = badges.filter((badge) => badge.unlocked)

  const profileBadges = selectedBadgeIds
    .map((id) => badges.find((badge) => badge.id === id))
    .filter(Boolean) as AchievementBadge[]

  const currentYearRank: StoredYearRank = {
    year: new Date().getFullYear(),
    tierName: rank.tier.name,
    tierLevel: rank.tierLevel,
    globalLevel: rank.globalLevel,
    totalXp: stats.totalXp,
    image: rank.tier.image,
  }

  useEffect(() => {
    if (!mounted) return

    localStorage.setItem(yearRankKey, JSON.stringify(currentYearRank))
  }, [
    mounted,
    yearRankKey,
    currentYearRank.year,
    currentYearRank.tierName,
    currentYearRank.tierLevel,
    currentYearRank.globalLevel,
    currentYearRank.totalXp,
    currentYearRank.image,
  ])

  function toggleProfileBadge(badge: AchievementBadge) {
    if (!badge.unlocked) return

    setSelectedBadgeIds((current) => {
      let next = current.includes(badge.id)
        ? current.filter((id) => id !== badge.id)
        : [...current, badge.id]

      if (next.length > MAX_PROFILE_BADGES) {
        next = next.slice(next.length - MAX_PROFILE_BADGES)
      }

      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  if (!mounted) {
    return (
      <DashboardLayout
        title="Achievements"
        subtitle="Levels, tiers, badges and yearly rank rewards"
      >
        <div className="glass-card flex items-center justify-center gap-2 p-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading achievements...
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Achievements"
      subtitle="Levels, tiers, badges and yearly rank rewards"
    >
      <VoltPageTour
        storageKey="volt-achievements-tour-seen"
        steps={[
          {
            title: "Welcome to Achievements ⚡",
            description: "Every task and ticket you complete earns XP. XP fills your level bar, and reaching a new level triggers a special animation. Let me show you around.",
            image: "/volty/step-1-welcome.png",
            placement: "center",
          },
          {
            title: "Your Level & XP",
            description: "This card shows your current level, tier, and XP progress. Complete high-priority tasks to earn the most XP. Overdue tasks deduct XP — stay on schedule!",
            target: '[data-tour="xp-level-card"]',
            placement: "right",
            mascotSide: "left",
            image: "/volty/step-3-dashboards.png",
          },
          {
            title: "Badges & Milestones",
            description: "Scroll down to see your badge collection. Unlock badges by hitting milestones — first task, high priority streaks, speed completions and more.",
            target: '[data-tour="badges-section"]',
            placement: "top",
            mascotSide: "right",
            image: "/volty/step-4-plan-upgrade.png",
          },
          {
            title: "Level-Up Animation",
            description: "When you gain enough XP to level up, a special full-screen animation plays. Complete tasks to trigger it — keep the streak going!",
            image: "/volty/step-5-build-dashboard.png",
            placement: "center",
          },
          {
            title: "Keep going!",
            description: "Your achievements follow you across the whole app. The more work you complete, the higher your rank. See you at the top!",
            image: "/volty/step-6-goodbye.png",
            placement: "center",
          },
        ]}
      />
      {/* Level-up animation overlay */}
      {showBanner && (
        <VoltBanner
          userName={session?.fullName || "Volt User"}
          userRole={session?.role || "employee"}
          tierName={rank.tier.name}
          tierColor={rank.tier.color}
          tierIndex={rank.tierIndex}
          level={rank.globalLevel}
          totalXp={stats.totalXp}
          xpProgress={Math.round(((stats.totalXp % 100) / 100) * 100)}
          selectedBadgeIds={selectedBadgeIds}
          onClose={() => setShowBanner(false)}
          onShareTeam={() => {
            setShowBanner(false)
            alert("Shared to team chat! (wire to team API)")
          }}
          onShareEmail={() => {
            setShowBanner(false)
            alert("Shared via email! (wire to email API)")
          }}
        />
      )}
      {tierUpData && (
        <VoltTierUp
          fromTier={tierUpData.fromTier}
          toTier={tierUpData.toTier}
          toColor={tierUpData.toColor}
          onDone={() => setTierUpData(null)}
        />
      )}
      {levelUpData && (
        <VoltLevelUp
          level={levelUpData.level}
          tierName={levelUpData.tierName}
          tierColor={levelUpData.tierColor}
          onDone={() => setLevelUpData(null)}
        />
      )}
      <div className="space-y-7 text-foreground">
        <div className="pointer-events-none fixed inset-0 -z-10 opacity-70">
          <div
            className="absolute left-10 top-10 h-80 w-80 rounded-full blur-3xl"
            style={{ backgroundColor: rank.tier.glow }}
          />
          <div className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl space-y-7">

          {/* ── Inline Banner replaces old XP card ── */}
          <section data-tour="xp-level-card" className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-card/55 shadow-2xl backdrop-blur-xl" style={{ borderColor: `${rank.tier.color}30` }}>
            {/* Ambient glow */}
            <div className="absolute right-0 top-0 h-64 w-64 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: rank.tier.glow, opacity: 0.35 }} />
            <div className="absolute left-0 bottom-0 h-48 w-48 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: rank.tier.glow, opacity: 0.15 }} />
            {/* Hex texture */}
            <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.025, backgroundImage: `repeating-linear-gradient(0deg,${rank.tier.color} 0,transparent 1px,transparent 18px),repeating-linear-gradient(60deg,${rank.tier.color} 0,transparent 1px,transparent 18px),repeating-linear-gradient(120deg,${rank.tier.color} 0,transparent 1px,transparent 18px)` }} />
            {/* Top shimmer strip */}
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${rank.tier.color},transparent)` }} />

            <div className="relative p-6 md:p-8">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                {/* Left: level badge + avatar + info */}
                <div className="flex items-center gap-4">
                  {/* Avatar with orbit */}
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 rounded-full border animate-spin" style={{ borderColor: `${rank.tier.color}25`, animationDuration: "8s", margin: -6 }} />
                    <div className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-black text-white border-2" style={{ background: `linear-gradient(135deg, ${rank.tier.color}, ${rank.tier.color}80)`, borderColor: `${rank.tier.color}60`, boxShadow: `0 0 20px ${rank.tier.color}50` }}>
                      {(session?.fullName || "U").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{session?.fullName || "Volt User"}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">{session?.role || "employee"}</p>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      {/* Tier pill */}
                      <div className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1" style={{ borderColor: `${rank.tier.color}35`, background: `${rank.tier.color}12` }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: rank.tier.color, boxShadow: `0 0 6px ${rank.tier.color}` }} />
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: rank.tier.color }}>{rank.tier.name} Tier</span>
                      </div>
                      {/* Level badge inline — next to tier pill */}
                      {(() => {
                        const lvl = rank.globalLevel
                        const thresholds = [1,11,21,31,41,51,61,71,81,91]
                        const badgeLevel = [...thresholds].reverse().find(t => lvl >= t) || 1
                        return (
                          <div className="relative shrink-0 overflow-hidden" style={{ width:32, height:32 }}>
                            <iframe
                              src={`/badges/levels/level-${badgeLevel}.html`}
                              scrolling="no"
                              style={{ width:300,height:300,border:"none",background:"transparent",pointerEvents:"none",transform:"scale(0.107)",transformOrigin:"top left",marginBottom:-(300-32),marginRight:-(300-32) }}
                            />
                          </div>
                        )
                      })()}
                      {/* View Banner button */}
                      <button
                        onClick={() => setShowBanner(true)}
                        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition hover:opacity-80"
                        style={{ borderColor: `${rank.tier.color}35`, background: `${rank.tier.color}08`, color: rank.tier.color }}
                      >
                        <span style={{ fontSize:10 }}>⚡</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest">View Banner</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: level number */}
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Level</p>
                  <p className="text-5xl font-black leading-none" style={{ color: rank.tier.color, textShadow: `0 0 30px ${rank.tier.color}80` }}>{rank.globalLevel}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stats.totalXp.toLocaleString()} XP</p>
                </div>
              </div>

              {/* Divider */}
              <div className="my-5 h-px" style={{ background: `linear-gradient(90deg,transparent,${rank.tier.color}25,transparent)` }} />

              {/* Selected badges row */}
              <div className="flex items-center gap-3 mb-5">
                {[0,1,2,3,4].map(i => {
                  const b = profileBadges[i]
                  return (
                    <div key={i} className="relative overflow-hidden shrink-0" style={{ width: 56, height: 56 }}>
                      {b ? (
                        <>
                          <iframe src={`/badges/animated/${b.id}.html`} scrolling="no" style={{ width:300,height:300,border:"none",background:"transparent",pointerEvents:"none",transform:"scale(0.187)",transformOrigin:"top left",marginBottom:-(300-56),marginRight:-(300-56) }} />
                        </>
                      ) : (
                        <div className="h-full w-full rounded-xl border flex items-center justify-center text-lg" style={{ borderColor: `${rank.tier.color}15`, background: `${rank.tier.color}05`, color: `${rank.tier.color}25` }}>+</div>
                      )}
                    </div>
                  )
                })}
                <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">Featured badges</span>
              </div>

              {/* XP progress bar */}
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{rank.currentLevelXp} / 100 XP</span>
                  <span>{rank.xpToNextLevel} XP to next level</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-white/[0.07]">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${rank.progressPercent}%`, background: `linear-gradient(90deg, ${rank.tier.color}90, ${rank.tier.color}, #ffffff80)` }} />
                </div>
              </div>

              {/* Stats row */}
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Badges</p>
                  <p className="mt-1 text-xl font-bold">{unlockedBadges.length}/{badges.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Tasks Done</p>
                  <p className="mt-1 text-xl font-bold">{stats.tasksCompleted}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Year-end</p>
                  <p className="mt-1 text-sm font-bold truncate">{rank.tier.name} Lv{rank.tierLevel}</p>
                </div>
              </div>
            </div>
          </section>

          {error && (
            <div className="glass-card border border-destructive/30 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <div className="glass-card flex items-center justify-center gap-2 p-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading achievements...
            </div>
          ) : (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {[
                  {
                    label: "Tasks Completed",
                    value: stats.tasksCompleted,
                    icon: CheckCircle2,
                  },
                  {
                    label: "Tickets Resolved",
                    value: stats.ticketsResolved,
                    icon: Ticket,
                  },
                  {
                    label: "Early Tasks",
                    value: stats.earlyTasks,
                    icon: Clock,
                  },
                  {
                    label: "Total Completed",
                    value: stats.totalCompleted,
                    icon: Trophy,
                  },
                  {
                    label: "Overdue Penalty",
                    value: `-${stats.overduePenaltyXp} XP`,
                    icon: Flame,
                  },
                ].map((item) => {
                  const Icon = item.icon

                  return (
                    <div
                      key={item.label}
                      className="rounded-[1.5rem] border border-white/10 bg-card/50 p-5 shadow-xl backdrop-blur-xl"
                    >
                      <div
                        className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl"
                        style={{
                          backgroundColor: `${rank.tier.color}18`,
                          color: rank.tier.color,
                        }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {item.label}
                      </p>

                      <p className="mt-2 text-3xl font-bold">{item.value}</p>
                    </div>
                  )
                })}
              </section>


              <section className="rounded-[2rem] border border-white/10 bg-card/50 p-6 shadow-xl backdrop-blur-xl">
                <style>{`
                  @keyframes sparkFloat{0%,100%{transform:translateY(0) scale(1);opacity:0.7}50%{transform:translateY(-5px) scale(1.1);opacity:1}}
                  @keyframes pulseRing{0%,100%{transform:scale(1);opacity:0.5}50%{transform:scale(1.12);opacity:1}}
                  @keyframes surgeZap{0%,100%{opacity:0.6;transform:scaleY(1)}50%{opacity:1;transform:scaleY(1.15)}}
                  @keyframes voltageArc{0%{stroke-dashoffset:100}100%{stroke-dashoffset:0}}
                  @keyframes overdriveShake{0%,100%{transform:rotate(0deg)}25%{transform:rotate(-3deg)}75%{transform:rotate(3deg)}}
                  @keyframes apexRise{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
                  @keyframes legendBurn{0%,100%{filter:drop-shadow(0 0 4px currentColor)}50%{filter:drop-shadow(0 0 12px currentColor) drop-shadow(0 0 20px currentColor)}}
                  @keyframes tierGlow{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 20px 2px var(--tc)}}
                `}</style>
                <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Tier Roadmap</h2>
                    <p className="text-sm text-muted-foreground">Every 30 levels moves you into the next Volt tier.</p>
                  </div>
                  <Button variant="outline"><BarChart3 className="h-4 w-4" />Level {rank.globalLevel}</Button>
                </div>

                <div className="grid gap-3 md:grid-cols-7">
                  {TIERS.map((tier, index) => {
                    const unlocked = index <= rank.tierIndex
                    const active = index === rank.tierIndex
                    const startLevel = index * LEVELS_PER_TIER + 1
                    const endLevel = (index + 1) * LEVELS_PER_TIER

                    // Unique animation + icon per tier
                    const tierStyles: Record<string, { anim: string; icon: string; particles: boolean }> = {
                      Spark:     { anim: "sparkFloat 2s ease-in-out infinite",     icon: "⚡", particles: true  },
                      Pulse:     { anim: "pulseRing 1.8s ease-in-out infinite",    icon: "〜", particles: false },
                      Surge:     { anim: "surgeZap 1.5s ease-in-out infinite",     icon: "↑", particles: false },
                      Voltage:   { anim: "overdriveShake 2s ease-in-out infinite", icon: "V", particles: true  },
                      Overdrive: { anim: "overdriveShake 1.2s ease-in-out infinite",icon:"▶", particles: false },
                      Apex:      { anim: "apexRise 2s ease-in-out infinite",       icon: "△", particles: false },
                      Legend:    { anim: "legendBurn 1.5s ease-in-out infinite",   icon: "★", particles: true  },
                    }
                    const ts = tierStyles[tier.name] || { anim: "", icon: "◈", particles: false }

                    return (
                      <div
                        key={tier.name}
                        className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 ${
                          active ? "border-white/25 bg-white/10 scale-[1.03]"
                          : unlocked ? "border-white/15 bg-white/[0.055]"
                          : "border-white/10 bg-white/[0.025] opacity-50"
                        }`}
                        style={{ ["--tc" as string]: tier.color } as React.CSSProperties}
                      >
                        {/* Animated bg glow */}
                        {(active || unlocked) && (
                          <div className="absolute inset-0 rounded-2xl opacity-15 blur-lg pointer-events-none" style={{ backgroundColor: tier.color, animation: active ? "pulseRing 2s ease-in-out infinite" : undefined }} />
                        )}

                        {/* Particle dots for special tiers */}
                        {ts.particles && active && [0,1,2].map(p => (
                          <div key={p} className="absolute rounded-full pointer-events-none" style={{ width:3,height:3,background:tier.color,boxShadow:`0 0 6px ${tier.color}`,top:`${20+p*25}%`,right:`${10+p*15}%`,animation:`sparkFloat ${1.5+p*0.4}s ease-in-out infinite`,animationDelay:`${p*0.3}s` }} />
                        ))}

                        <div className="relative">
                          {/* Animated tier icon */}
                          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl text-lg font-black" style={{ backgroundColor: `${tier.color}18`, color: tier.color, animation: active ? ts.anim : undefined }}>
                            {unlocked ? ts.icon : <Lock className="h-4 w-4" />}
                          </div>

                          <p className="font-semibold text-sm">{tier.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Lv {startLevel}–{endLevel}</p>

                          {active && (
                            <p className="mt-2 rounded-full px-2 py-0.5 text-center text-[10px] font-bold" style={{ backgroundColor: `${tier.color}22`, color: tier.color }}>
                              Current
                            </p>
                          )}
                          {!unlocked && (
                            <p className="mt-2 text-[10px] text-muted-foreground">Locked</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section data-tour="badges-section" className="rounded-[2rem] border border-white/10 bg-card/50 p-6 shadow-xl backdrop-blur-xl">
                <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">Badge Collection</h2>
                    <p className="text-sm text-muted-foreground">{unlockedBadges.length} of {badges.length} unlocked</p>
                  </div>
                  {/* Difficulty filter */}
                  <div className="flex gap-2 flex-wrap">
                    {(["All","Easy","Medium","Hard","Legendary"] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setBadgeFilter(f === badgeFilter ? "All" : f)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                          badgeFilter === f ? "border-white/30 bg-white/10 text-white" : "border-white/10 bg-transparent text-muted-foreground hover:border-white/20"
                        } ${f === "Easy" ? "hover:text-emerald-300" : f === "Medium" ? "hover:text-sky-300" : f === "Hard" ? "hover:text-purple-300" : f === "Legendary" ? "hover:text-amber-300" : ""}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {badges.filter(b => badgeFilter === "All" || b.difficulty === badgeFilter).map((badge) => {
                    const percent = Math.min(100, Math.round((badge.metric / badge.target) * 100))
                    const selected = selectedBadgeIds.includes(badge.id)

                    return (
                      <button
                        key={badge.id}
                        onClick={() => toggleProfileBadge(badge)}
                        className={`group relative rounded-2xl border text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                          badge.unlocked
                            ? selected ? "border-white/25 bg-white/[0.07]" : "border-white/12 bg-white/[0.04]"
                            : "border-white/8 bg-white/[0.02]"
                        }`}
                        style={{ padding: "10px 12px" }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Badge — no box, just the badge */}
                          <BadgeImage badge={badge} tierColor={rank.tier.color} size="normal" />

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-sm font-semibold truncate leading-tight">{badge.name}</p>
                              {badge.unlocked
                                ? <Award className="h-3.5 w-3.5 shrink-0" style={{ color: rank.tier.color }} />
                                : <Lock className="h-3.5 w-3.5 shrink-0 text-white/20" />
                              }
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${difficultyClass(badge.difficulty)}`}>
                                {badge.difficulty}
                              </span>
                              <span className="text-[9px] text-muted-foreground">+{badge.xpReward} XP</span>
                              {selected && <span className="text-[9px] text-white/50">● Featured</span>}
                            </div>
                            {/* Progress bar */}
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-0.5">
                                <span>{Math.min(badge.metric, badge.target)}/{badge.target}</span>
                                <span>{percent}%</span>
                              </div>
                              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: badge.unlocked ? rank.tier.color : "rgba(255,255,255,0.2)" }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes volt-levelup-overlay-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes volt-levelup-card-in {
          0% { opacity: 0; transform: scale(0.7) translateY(40px); }
          60% { opacity: 1; transform: scale(1.06) translateY(-8px); }
          80% { transform: scale(0.97) translateY(2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes volt-levelup-bounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-14px) rotate(-4deg); }
          50% { transform: translateY(-6px) rotate(3deg); }
          75% { transform: translateY(-10px) rotate(-2deg); }
        }
        @keyframes volt-levelup-text-in {
          0% { opacity: 0; transform: scale(0.8) translateY(10px); }
          70% { opacity: 1; transform: scale(1.04) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes volt-levelup-burst {
          0% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0); }
          30% { box-shadow: 0 0 60px 20px hsl(var(--primary) / 0.35), 0 0 100px 40px hsl(var(--accent) / 0.2); }
          100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0); }
        }

        .volt-levelup-overlay { animation: volt-levelup-overlay-in 400ms ease forwards; }
        .volt-levelup-card { animation: volt-levelup-card-in 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .volt-levelup-bounce { animation: volt-levelup-bounce 1s ease-in-out infinite; animation-delay: 400ms; }
        .volt-levelup-text { animation: volt-levelup-text-in 500ms cubic-bezier(0.22, 1, 0.36, 1) forwards; animation-delay: 250ms; opacity: 0; }
        .volt-levelup-burst { animation: volt-levelup-burst 1.8s ease-out forwards; animation-delay: 100ms; }
      `}</style>
    </DashboardLayout>
  )
}