"use client"

import { Bell, Plus, User, LogOut, LayoutDashboard, Check, Sparkles } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState, useCallback, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { clearSession, getStoredSession } from "@/lib/auth"
import { clearStoredCompanyId, getStoredCompanyId } from "@/lib/tenant"
import { cn } from "@/lib/utils"

interface HeaderProps {
  title: string
  subtitle?: string
  companyName?: string
  userName?: string
  userEmail?: string
  userRole?: string
}

type VoltNotification = {
  id: number
  type: string
  title: string
  message: string
  relatedId: string | null
  isRead: boolean
  createdAt: string
}

const TOUR_STORAGE_KEYS: Record<string, string> = {
  "/my-dashboard": "volt-my-dashboard-tour-seen",
  "/company-overview": "volt-company-overview-tour-seen",
  "/tasks": "volt-tasks-tour-seen",
  "/tickets": "volt-tickets-tour-seen",
  "/projects": "volt-projects-tour-seen",
  "/achievements": "volt-achievements-tour-seen",
  "/assistant": "volt-assistant-tour-seen",
  "/environments": "volt-apps-tour-seen",
  "/notifications": "volt-notifications-tour-seen",
  "/emailv": "volt-emailv-tour-seen",
  "/team": "volt-team-tour-seen",
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function notifIcon(type: string) {
  if (type.includes("ticket")) return "🎫"
  if (type.includes("task")) return "✅"
  return "🔔"
}

export function Header({
  title,
  subtitle,
  companyName = "Company",
  userName = "Business Owner",
  userEmail = "owner@company.com",
  userRole = "employee",
}: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [notifications, setNotifications] = useState<VoltNotification[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const headerRef = useRef<HTMLElement>(null)

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const fetchNotifications = useCallback(async () => {
    const session = getStoredSession()
    const companyId = getStoredCompanyId()
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
    } catch {}
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Show header when dropdown is open — prevent glitch
  useEffect(() => {
    if (notifOpen) {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      setVisible(true)
    }
  }, [notifOpen])

  function handleMouseEnter() {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setVisible(true)
  }

  function handleMouseLeave() {
    // Only hide if no dropdown is open
    if (notifOpen) return
    hideTimer.current = setTimeout(() => setVisible(false), 300)
  }

  async function markAllRead() {
    const session = getStoredSession()
    const companyId = getStoredCompanyId()
    if (!session?.userId || !companyId) return
    try {
      await fetch(`/api/notifications?companyId=${companyId}&userId=${session.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch {}
  }

  async function markOneRead(id: number) {
    const session = getStoredSession()
    const companyId = getStoredCompanyId()
    if (!session?.userId || !companyId) return
    try {
      await fetch(`/api/notifications?companyId=${companyId}&userId=${session.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      )
    } catch {}
  }

  function handleLogout() {
    clearSession()
    clearStoredCompanyId()
    router.push("/login")
  }

  function activatePageTour() {
    const key = TOUR_STORAGE_KEYS[pathname] || null
    if (!key) return
    localStorage.removeItem(key)
    window.location.reload()
  }

  const hasTourForPage = Boolean(TOUR_STORAGE_KEYS[pathname])

  return (
    <>
      {/* Invisible hover trigger strip at very top */}
      <div
        className="absolute top-0 left-0 right-0 h-2 z-50"
        onMouseEnter={handleMouseEnter}
      />

      <header
        ref={headerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "flex items-center justify-between px-6 py-4 border-b border-border bg-background/90 backdrop-blur-sm transition-all duration-300 z-40",
          visible
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-full pointer-events-none h-0 py-0 border-0 overflow-hidden"
        )}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={() => router.push("/dashboards")} className="hidden sm:flex">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Switch Dashboard
          </Button>

          {hasTourForPage && (
            <Button
              size="sm"
              variant="outline"
              onClick={activatePageTour}
              className="hidden sm:flex items-center gap-2 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/50"
            >
              <div className="h-5 w-5 overflow-hidden rounded-full border border-primary/20">
                <Image
                  src="/volty/ChatGPT_Image_May_27__2026__04_08_21_AM__10_-removebg-preview.png"
                  alt="Volty"
                  width={20}
                  height={20}
                  className="h-full w-full object-cover"
                />
              </div>
              Volty
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground glow">
                <Plus className="h-4 w-4 mr-2" />
                New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => router.push("/tasks")}>New Task</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/tickets")}>New Ticket</DropdownMenuItem>
              <DropdownMenuItem>New Pipeline</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Import Data</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notification Bell — keeps header visible while open */}
          <DropdownMenu
            open={notifOpen}
            onOpenChange={(open) => {
              setNotifOpen(open)
              if (!open) {
                hideTimer.current = setTimeout(() => setVisible(false), 800)
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-bold text-foreground">Notifications</p>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Check className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markOneRead(n.id)}
                      className={cn(
                        "flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition hover:bg-muted/30",
                        !n.isRead && "bg-primary/5",
                      )}
                    >
                      <span className="mt-0.5 text-lg leading-none">{notifIcon(n.type)}</span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm font-semibold", !n.isRead ? "text-foreground" : "text-muted-foreground")}>
                          {n.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src="/avatars/user.png" alt="User" />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-muted-foreground">{userEmail}</p>
                  <p className="text-xs text-muted-foreground">{companyName}</p>
                  <p className="text-xs text-primary capitalize">{userRole.replace("_", " ")}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/dashboards")}>My Dashboards</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/achievements")}>Achievements</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  )
}
