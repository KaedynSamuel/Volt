"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  Bell,
  Bot,
  CheckSquare,
  LayoutDashboard,
  LayoutGrid,
  ShieldCheck,
  FolderKanban,
  Settings,
  Sparkles,
  Ticket,
  Trophy,
  UserRound,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { canAccessTeamPage, getStoredSession } from "@/lib/auth"

type NavItem = {
  title: string
  href: string
  icon: any
  badge?: string
  adminOnly?: boolean
  adminLikeOnly?: boolean
}

const navItems: NavItem[] = [
  { title: "My Dashboard", href: "/my-dashboard", icon: UserRound },
  { title: "Company Dashboard", href: "/company-overview", icon: LayoutDashboard, adminLikeOnly: true },
  { title: "Admin Hub", href: "/admin", icon: ShieldCheck, adminLikeOnly: true },
  { title: "Tasks", href: "/tasks", icon: CheckSquare },
  { title: "Tickets", href: "/tickets", icon: Ticket },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Team", href: "/team", icon: Users },
  { title: "AI Assistant", href: "/assistant", icon: Bot, badge: "AI" },
  { title: "Apps", href: "/environments", icon: LayoutGrid },
  { title: "Achievements", href: "/achievements", icon: Trophy },
]

const bottomNavItems: NavItem[] = [
  { title: "Notifications", href: "/notifications", icon: Bell },
  { title: "Settings", href: "/settings", icon: Settings },
]

interface SidebarProps {
  companyName?: string
  dashboardName?: string
  logoUrl?: string | null
}

export function Sidebar({ companyName = "Volt", dashboardName = "Volt Dashboards", logoUrl }: SidebarProps) {
  const pathname = usePathname()
  const [hovered, setHovered] = useState(false)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const session = getStoredSession()
    setRole(session?.role || null)
  }, [pathname])

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => {
      if (item.adminOnly) return canAccessTeamPage(role)
      if (item.adminLikeOnly) return role === "admin" || role === "business_owner"
      return true
    })
  }, [role])

  const expanded = hovered

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "glass-panel h-screen flex flex-col transition-all duration-300 ease-in-out z-50",
        expanded ? "w-64" : "w-16"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border overflow-hidden">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${companyName} logo`}
            className="h-9 w-9 shrink-0 rounded-lg object-contain bg-background border border-sidebar-border"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
        )}

        <div className={cn(
          "flex flex-col min-w-0 transition-all duration-300",
          expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
        )}>
          <span className="text-lg font-semibold tracking-tight text-foreground truncate whitespace-nowrap">
            {dashboardName}
          </span>
          <span className="text-xs text-muted-foreground truncate whitespace-nowrap">
            {companyName}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                "hover:bg-sidebar-accent",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-muted-foreground hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />

              <div className={cn(
                "flex flex-1 items-center justify-between transition-all duration-300 overflow-hidden",
                expanded ? "opacity-100 w-auto" : "opacity-0 w-0"
              )}>
                <span className="whitespace-nowrap">{item.title}</span>
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gradient-to-r from-primary to-accent text-primary-foreground whitespace-nowrap">
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom nav */}
      <div className="px-2 py-4 border-t border-sidebar-border space-y-1">
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                "hover:bg-sidebar-accent",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-muted-foreground hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
              <span className={cn(
                "whitespace-nowrap transition-all duration-300 overflow-hidden",
                expanded ? "opacity-100 w-auto" : "opacity-0 w-0"
              )}>
                {item.title}
              </span>
            </Link>
          )
        })}
      </div>
    </aside>
  )
}
