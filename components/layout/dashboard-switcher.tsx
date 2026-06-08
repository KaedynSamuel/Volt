"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronsUpDown, LayoutDashboard, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { applyCompanyTheme, storeCompanyId } from "@/lib/tenant"
import { AppSession, getStoredSession, storeSession } from "@/lib/auth"

type DashboardOption = {
  userId: number
  companyId: number
  companyName: string
  dashboardName: string
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  ownerName: string
  ownerEmail: string
  role: AppSession["role"]
  status: string
}

type CreateDashboardForm = {
  companyName: string
  dashboardName: string
  logoUrl: string
  primaryColor: string
  accentColor: string
}

const emptyForm: CreateDashboardForm = {
  companyName: "",
  dashboardName: "",
  logoUrl: "",
  primaryColor: "#22c55e",
  accentColor: "#8b5cf6",
}

interface DashboardSwitcherProps {
  currentCompanyId?: number
  currentDashboardName?: string
  currentCompanyName?: string
}

export function DashboardSwitcher({
  currentCompanyId,
  currentDashboardName = "Dashboard",
  currentCompanyName = "Company",
}: DashboardSwitcherProps) {
  const router = useRouter()
  const [dashboards, setDashboards] = useState<DashboardOption[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateDashboardForm>(emptyForm)
  const [error, setError] = useState("")

  const session = getStoredSession()
  const isAdmin = session?.role === "admin"

  async function loadDashboards() {
    const currentSession = getStoredSession()
    if (!currentSession?.email) return

    try {
      setLoading(true)
      const response = await fetch(`/api/dashboards?email=${encodeURIComponent(currentSession.email)}`, {
        cache: "no-store",
      })

      if (!response.ok) return
      setDashboards(await response.json())
    } finally {
      setLoading(false)
    }
  }

  async function switchDashboard(dashboard: DashboardOption) {
    const currentSession = getStoredSession()
    if (!currentSession) return

    const nextSession: AppSession = {
      ...currentSession,
      userId: dashboard.userId,
      companyId: dashboard.companyId,
      role: dashboard.role,
    }

    storeSession(nextSession)
    storeCompanyId(dashboard.companyId)
    applyCompanyTheme({
      id: dashboard.companyId,
      name: dashboard.companyName,
      dashboardName: dashboard.dashboardName,
      logoUrl: dashboard.logoUrl,
      primaryColor: dashboard.primaryColor,
      accentColor: dashboard.accentColor,
      ownerName: dashboard.ownerName,
      ownerEmail: dashboard.ownerEmail,
    })

    router.refresh()
    window.location.reload()
  }

  async function createDashboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const currentSession = getStoredSession()
    if (!currentSession || currentSession.role !== "admin") {
      setError("Only admins can create dashboards.")
      return
    }

    if (!form.companyName.trim() || !form.dashboardName.trim()) {
      setError("Company name and dashboard name are required.")
      return
    }

    try {
      setCreating(true)
      setError("")

      const response = await fetch("/api/dashboards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": currentSession.role,
          "x-user-id": String(currentSession.userId),
          "x-user-email": currentSession.email,
          "x-user-name": currentSession.fullName,
        },
        body: JSON.stringify(form),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || "Failed to create dashboard")
      }

      setForm(emptyForm)
      setShowCreate(false)
      await loadDashboards()
      await switchDashboard(data)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create dashboard")
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    loadDashboards()
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="hidden md:flex min-w-56 justify-between gap-3 bg-background/70">
          <span className="flex items-center gap-2 min-w-0">
            <LayoutDashboard className="h-4 w-4 text-primary" />
            <span className="truncate">{currentDashboardName}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>
          <div className="space-y-1">
            <p>Switch Dashboard</p>
            <p className="text-xs font-normal text-muted-foreground">{currentCompanyName}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <DropdownMenuItem disabled>Loading dashboards...</DropdownMenuItem>
        ) : dashboards.length === 0 ? (
          <DropdownMenuItem disabled>No dashboards found</DropdownMenuItem>
        ) : (
          dashboards.map((dashboard) => (
            <DropdownMenuItem
              key={`${dashboard.companyId}-${dashboard.userId}`}
              onClick={() => switchDashboard(dashboard)}
              className="gap-3"
            >
              {dashboard.logoUrl ? (
                <img src={dashboard.logoUrl} alt="" className="h-7 w-7 rounded-md object-contain border" />
              ) : (
                <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-accent" />
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{dashboard.dashboardName}</p>
                <p className="truncate text-xs text-muted-foreground">{dashboard.companyName} • {dashboard.role.replace("_", " ")}</p>
              </div>
              {Number(currentCompanyId) === Number(dashboard.companyId) && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))
        )}

        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            {!showCreate ? (
              <DropdownMenuItem onClick={() => setShowCreate(true)} className="gap-2 text-primary">
                <Plus className="h-4 w-4" />
                Create new dashboard
              </DropdownMenuItem>
            ) : (
              <div className="p-3 space-y-3">
                <form onSubmit={createDashboard} className="space-y-3">
                  <input
                    value={form.companyName}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        companyName: event.target.value,
                        dashboardName: prev.dashboardName || `${event.target.value} Dashboard`,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    placeholder="Company name"
                  />
                  <input
                    value={form.dashboardName}
                    onChange={(event) => setForm((prev) => ({ ...prev, dashboardName: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    placeholder="Dashboard name"
                  />
                  <input
                    value={form.logoUrl}
                    onChange={(event) => setForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    placeholder="Logo URL optional"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={(event) => setForm((prev) => ({ ...prev, primaryColor: event.target.value }))}
                      className="h-10 w-full rounded-lg border border-border bg-background"
                      title="Primary colour"
                    />
                    <input
                      type="color"
                      value={form.accentColor}
                      onChange={(event) => setForm((prev) => ({ ...prev, accentColor: event.target.value }))}
                      className="h-10 w-full rounded-lg border border-border bg-background"
                      title="Accent colour"
                    />
                  </div>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setShowCreate(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" className="flex-1" disabled={creating}>
                      {creating && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      Create
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
