"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { VoltPageTour } from "@/components/tours/VoltPageTour"
import { getStoredSession } from "@/lib/auth"
import { getStoredCompanyId } from "@/lib/tenant"
import { cn } from "@/lib/utils"
import {
  Bell,
  CheckCheck,
  Loader2,
  Trash2,
  X,
  CheckCircle2,
  Ticket,
  CheckSquare,
} from "lucide-react"

type VoltNotification = {
  id: number
  type: string
  title: string
  message: string
  relatedId: string | null
  isRead: boolean
  createdAt: string
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString("en-ZA", { day: "2-digit", month: "short" })
}

function notifIcon(type: string) {
  if (type.includes("ticket")) return <Ticket className="h-4 w-4 text-accent" />
  if (type.includes("task")) return <CheckSquare className="h-4 w-4 text-primary" />
  return <Bell className="h-4 w-4 text-muted-foreground" />
}

function notifBg(type: string) {
  if (type.includes("ticket")) return "bg-accent/10"
  if (type.includes("task")) return "bg-primary/10"
  return "bg-muted"
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<VoltNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [clearing, setClearing] = useState(false)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  const session = typeof window !== "undefined" ? getStoredSession() : null
  const companyId = typeof window !== "undefined" ? getStoredCompanyId() : null

  const fetchNotifications = useCallback(async () => {
    if (!session?.userId || !companyId) return
    try {
      const res = await fetch(
        `/api/notifications?companyId=${companyId}&userId=${session.userId}`,
        { cache: "no-store" },
      )
      if (res.ok) {
        const data = await res.json()
        setNotifications(Array.isArray(data) ? data : [])
      }
    } catch {
      setError("Could not load notifications.")
    } finally {
      setLoading(false)
    }
  }, [session?.userId, companyId])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  async function markAllRead() {
    if (!session?.userId || !companyId) return
    try {
      await fetch(`/api/notifications?companyId=${companyId}&userId=${session.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch {
      setError("Could not mark notifications as read.")
    }
  }

  async function deleteOne(id: number) {
    if (!session?.userId || !companyId) return
    setDeletingId(id)
    try {
      await fetch(`/api/notifications?companyId=${companyId}&userId=${session.userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch {
      setError("Could not delete notification.")
    } finally {
      setDeletingId(null)
    }
  }

  async function clearAll() {
    if (!session?.userId || !companyId) return
    if (!confirm("Delete all notifications? This cannot be undone.")) return
    setClearing(true)
    try {
      await fetch(`/api/notifications?companyId=${companyId}&userId=${session.userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAll: true }),
      })
      setNotifications([])
    } catch {
      setError("Could not clear notifications.")
    } finally {
      setClearing(false)
    }
  }

  async function markOneRead(id: number) {
    if (!session?.userId || !companyId) return
    try {
      await fetch(`/api/notifications?companyId=${companyId}&userId=${session.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    } catch {}
  }

  const filtered = filter === "unread"
    ? notifications.filter((n) => !n.isRead)
    : notifications
  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <DashboardLayout title="Notifications" subtitle="All your Volt alerts in one place">
      <VoltPageTour
        storageKey="volt-notifications-tour-seen"
        steps={[
          {
            title: "Your Notifications ⚡",
            description: "Every time a task is assigned to you or a ticket is created, opened or closed, Volt sends you a notification here and by email.",
            image: "/volty/step-1-welcome.png",
            placement: "center",
          },
          {
            title: "Filter & Read",
            description: "Switch between All and Unread to focus on what matters. Click a notification to mark it as read.",
            target: '[data-tour="notif-filters"]',
            placement: "bottom",
            mascotSide: "right",
            image: "/volty/step-3-dashboards.png",
          },
          {
            title: "Delete & Clear",
            description: "Delete individual notifications with the X button, or use 'Clear All' to wipe your entire notification history at once.",
            target: '[data-tour="notif-actions"]',
            placement: "bottom",
            mascotSide: "left",
            image: "/volty/step-4-plan-upgrade.png",
          },
        ]}
      />

      <div className="mx-auto max-w-2xl space-y-4">
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div data-tour="notif-filters" className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-xl border px-4 py-2 text-sm font-bold transition",
                filter === "all"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/20 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              All
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{notifications.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={cn(
                "rounded-xl border px-4 py-2 text-sm font-bold transition",
                filter === "unread"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/20 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              Unread
              {unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-destructive/80 px-2 py-0.5 text-xs text-white">{unreadCount}</span>
              )}
            </button>
          </div>

          <div data-tour="notif-actions" className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                disabled={clearing}
                className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
              >
                {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Clear all
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="glass-card border border-destructive/30 p-3 text-sm text-destructive">{error}</div>
        )}

        {/* Notifications list */}
        {loading ? (
          <div className="glass-card flex items-center justify-center gap-2 p-12">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-muted-foreground">Loading notifications…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-bold text-foreground">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filter === "unread"
                ? "You're all caught up!"
                : "Notifications appear here when tasks are assigned or tickets change status."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "glass-card group flex items-start gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md",
                  n.isRead
                    ? "border-border/50 opacity-75"
                    : "border-primary/20 bg-primary/[0.02]",
                )}
              >
                {/* Icon */}
                <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", notifBg(n.type))}>
                  {notifIcon(n.type)}
                </div>

                {/* Content */}
                <button
                  type="button"
                  onClick={() => { if (!n.isRead) markOneRead(n.id) }}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className={cn("text-sm font-bold", n.isRead ? "text-muted-foreground" : "text-foreground")}>
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{n.message}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground/60">{timeAgo(n.createdAt)}</p>
                </button>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  {!n.isRead && (
                    <span className="h-2 w-2 rounded-full bg-primary" title="Unread" />
                  )}
                  <button
                    type="button"
                    onClick={() => deleteOne(n.id)}
                    disabled={deletingId === n.id}
                    title="Delete"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  >
                    {deletingId === n.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <X className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
