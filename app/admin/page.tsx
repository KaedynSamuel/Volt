"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { getStoredSession, isAdminLike } from "@/lib/auth"
import { getStoredCompanyId } from "@/lib/tenant"
import { cn } from "@/lib/utils"

type AdminRole = "business_owner" | "admin" | "employee" | "creator"

type AdminUser = {
  id: number
  fullName: string
  email: string
  role: AdminRole
  status: string
}

type AdminTeam = {
  id: number
  name: string
  description?: string | null
  memberCount: number
  members: Array<{ id: number; fullName: string; email: string; role: string }>
}

const emptyUserForm = {
  fullName: "",
  email: "",
  password: "",
  role: "employee" as AdminRole,
}

const emptyTeamForm = {
  name: "",
  description: "",
  memberIds: [] as number[],
}

const cardMotion =
  "transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] active:translate-y-0 active:scale-[0.99]"

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "U"
  )
}

function roleLabel(role: string) {
  return role.replace("_", " ")
}

export default function AdminHubPage() {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [teams, setTeams] = useState<AdminTeam[]>([])
  const [userForm, setUserForm] = useState(emptyUserForm)
  const [teamForm, setTeamForm] = useState(emptyTeamForm)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null)
  const [userEditForm, setUserEditForm] = useState({ fullName: "", email: "", role: "employee" as AdminRole })
  const [teamEditForm, setTeamEditForm] = useState(emptyTeamForm)
  const [loading, setLoading] = useState(true)
  const [savingUser, setSavingUser] = useState(false)
  const [savingTeam, setSavingTeam] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null)
  const [updatingTeamId, setUpdatingTeamId] = useState<number | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null)
  const [deletingTeamId, setDeletingTeamId] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const session = typeof window !== "undefined" ? getStoredSession() : null
  const companyId = getStoredCompanyId() || session?.companyId
  const canManage = isAdminLike(session?.role)

  const activeUsers = useMemo(
    () => users.filter((user) => String(user.status).toLowerCase() === "active"),
    [users],
  )

  const admins = useMemo(
    () => users.filter((user) => ["admin", "business_owner", "creator"].includes(user.role)),
    [users],
  )

  const editingUser = useMemo(
    () => users.find((user) => user.id === editingUserId) || null,
    [users, editingUserId],
  )

  const editingTeam = useMemo(
    () => teams.find((team) => team.id === editingTeamId) || null,
    [teams, editingTeamId],
  )

  function authHeaders() {
    if (!session || !companyId) throw new Error("You need to be logged in")
    return {
      "x-company-id": String(companyId),
      "x-user-id": String(session.userId),
    }
  }

  const loadAdminData = useCallback(async () => {
    if (!session || !companyId) return

    const [usersResponse, teamsResponse] = await Promise.all([
      fetch(`/api/users?companyId=${companyId}&userId=${session.userId}`, {
        cache: "no-store",
        headers: authHeaders(),
      }),
      fetch(`/api/teams?companyId=${companyId}&userId=${session.userId}`, {
        cache: "no-store",
        headers: authHeaders(),
      }),
    ])

    const usersData = await usersResponse.json().catch(() => null)
    const teamsData = await teamsResponse.json().catch(() => null)

    if (!usersResponse.ok) {
      throw new Error(usersData?.details || usersData?.error || "Failed to load users")
    }

    if (!teamsResponse.ok) {
      throw new Error(teamsData?.details || teamsData?.error || "Failed to load teams")
    }

    setUsers(Array.isArray(usersData) ? usersData : [])
    setTeams(Array.isArray(teamsData) ? teamsData : [])
  }, [companyId, session?.userId])

  useEffect(() => {
    if (!session) {
      router.replace("/login")
      return
    }

    if (!canManage) {
      router.replace("/my-dashboard")
      return
    }

    async function load() {
      try {
        setLoading(true)
        setError("")
        await loadAdminData()
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to load Admin Hub")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router, canManage, loadAdminData])

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSavingUser(true)
      setError("")
      setSuccess("")

      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ...userForm, companyId, userId: session?.userId }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) throw new Error(data?.details || data?.error || "Failed to create user")

      setUserForm(emptyUserForm)
      await loadAdminData()
      setSuccess(`${data.fullName || userForm.fullName} was added to this dashboard.`)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create user")
    } finally {
      setSavingUser(false)
    }
  }

  async function handleCreateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSavingTeam(true)
      setError("")
      setSuccess("")

      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ...teamForm, companyId, userId: session?.userId }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) throw new Error(data?.details || data?.error || "Failed to create team")

      setTeamForm(emptyTeamForm)
      await loadAdminData()
      setSuccess(`${data.name} was created and is ready in Team.`)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create team")
    } finally {
      setSavingTeam(false)
    }
  }

  function startEditUser(user: AdminUser) {
    setEditingUserId(user.id)
    setUserEditForm({ fullName: user.fullName, email: user.email, role: user.role })
  }

  async function handleUpdateUser(userId: number) {
    try {
      setUpdatingUserId(userId)
      setError("")
      setSuccess("")

      const response = await fetch(
        `/api/users?companyId=${companyId}&userId=${session?.userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ ...userEditForm, targetId: userId }),
        }
      )
      const data = await response.json().catch(() => null)

      if (!response.ok) throw new Error(data?.details || data?.error || "Failed to update user")

      setEditingUserId(null)
      await loadAdminData()
      setSuccess(`${data.fullName || userEditForm.fullName} was updated.`)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to update user")
    } finally {
      setUpdatingUserId(null)
    }
  }

  async function handleDeleteUser(user: AdminUser) {
    if (!window.confirm(`Delete ${user.fullName}? They will be removed from teams as well.`)) return

    try {
      setDeletingUserId(user.id)
      setError("")
      setSuccess("")

      const response = await fetch(
        `/api/users?companyId=${companyId}&userId=${session?.userId}&targetId=${user.id}`,
        { method: "DELETE", headers: authHeaders() }
      )
      const data = await response.json().catch(() => null)

      if (!response.ok) throw new Error(data?.details || data?.error || "Failed to delete user")

      await loadAdminData()
      setSuccess(`${user.fullName} was deleted.`)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to delete user")
    } finally {
      setDeletingUserId(null)
    }
  }

  function startEditTeam(team: AdminTeam) {
    setEditingTeamId(team.id)
    setTeamEditForm({
      name: team.name,
      description: team.description || "",
      memberIds: team.members?.map((member) => member.id) || [],
    })
  }

  async function handleUpdateTeam(teamId: number) {
    try {
      setUpdatingTeamId(teamId)
      setError("")
      setSuccess("")

      const response = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ...teamEditForm, companyId, userId: session?.userId }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) throw new Error(data?.details || data?.error || "Failed to update team")

      setEditingTeamId(null)
      await loadAdminData()
      setSuccess(`${data.name || teamEditForm.name} was updated.`)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to update team")
    } finally {
      setUpdatingTeamId(null)
    }
  }

  async function handleDeleteTeam(team: AdminTeam) {
    if (!window.confirm(`Delete ${team.name}?`)) return

    try {
      setDeletingTeamId(team.id)
      setError("")
      setSuccess("")

      const response = await fetch(`/api/teams/${team.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ companyId, userId: session?.userId }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) throw new Error(data?.details || data?.error || "Failed to delete team")

      await loadAdminData()
      setSuccess(`${team.name} was deleted.`)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to delete team")
    } finally {
      setDeletingTeamId(null)
    }
  }

  function memberSelector(value: number[], onChange: (ids: number[]) => void) {
    return (
      <div className="max-h-44 space-y-2 overflow-auto rounded-2xl border border-border bg-background/30 p-2.5">
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">Create users first, then select them here.</p>
        ) : (
          users.map((user) => (
            <label
              key={user.id}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-transparent px-3 py-2 hover:border-primary/20 hover:bg-primary/5",
                cardMotion,
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                  {getInitials(user.fullName)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{user.fullName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.email} • {roleLabel(user.role)}
                  </span>
                </span>
              </span>
              <input
                type="checkbox"
                checked={value.includes(user.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...value, user.id]
                      : value.filter((id) => id !== user.id),
                  )
                }
              />
            </label>
          ))
        )}
      </div>
    )
  }

  return (
    <DashboardLayout
      title="Admin Hub"
      subtitle="Create users, build teams, and manage the company workspace system."
    >
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-4 shadow-sm">
          <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Admin Control Centre
              </div>
              <h2 className="text-xl font-black tracking-tight">Admin Centre: Users and Teams</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Manage users, roles, teams, and team membership from clean pop-up panels.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
              <div className="rounded-2xl border border-border/70 bg-background/60 p-2.5">
                <p className="text-xl font-black">{activeUsers.length}</p>
                <p className="text-[11px] font-bold uppercase text-muted-foreground">Active users</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/60 p-2.5">
                <p className="text-xl font-black">{teams.length}</p>
                <p className="text-[11px] font-bold uppercase text-muted-foreground">Teams</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/60 p-2.5">
                <p className="text-xl font-black">{admins.length}</p>
                <p className="text-[11px] font-bold uppercase text-muted-foreground">Admins</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" /> {success}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <form onSubmit={handleCreateUser} className="glass-card space-y-3 p-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <ShieldCheck className="h-5 w-5 text-primary" /> Create User
              </h2>
              <p className="text-sm text-muted-foreground">Add a person directly to this company dashboard with their role.</p>
            </div>

            <input className="w-full rounded-xl border border-border bg-background/80 px-3 py-1.5 text-sm outline-none focus:border-primary" placeholder="Full name" value={userForm.fullName} onChange={(e) => setUserForm((p) => ({ ...p, fullName: e.target.value }))} />
            <input className="w-full rounded-xl border border-border bg-background/80 px-3 py-1.5 text-sm outline-none focus:border-primary" placeholder="Email" type="email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} />
            <input className="w-full rounded-xl border border-border bg-background/80 px-3 py-1.5 text-sm outline-none focus:border-primary" placeholder="Temporary password" type="password" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} />
            <select className="w-full rounded-xl border border-border bg-background/80 px-3 py-1.5 text-sm outline-none focus:border-primary" value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value as AdminRole }))}>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
              <option value="business_owner">Business Owner</option>
            </select>

            <Button type="submit" disabled={savingUser} className="h-9 w-auto self-start bg-gradient-to-r from-primary to-accent px-4 text-sm text-primary-foreground">
              {savingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add User
            </Button>
          </form>

          <form onSubmit={handleCreateTeam} className="glass-card space-y-3 p-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Users className="h-5 w-5 text-primary" /> Create Team
              </h2>
              <p className="text-sm text-muted-foreground">Build teams and choose which users belong to each workspace.</p>
            </div>

            <input className="w-full rounded-xl border border-border bg-background/80 px-3 py-1.5 text-sm outline-none focus:border-primary" placeholder="Team name" value={teamForm.name} onChange={(e) => setTeamForm((p) => ({ ...p, name: e.target.value }))} />
            <textarea className="min-h-16 w-full rounded-xl border border-border bg-background/80 px-3 py-1.5 text-sm outline-none focus:border-primary" placeholder="Team description" value={teamForm.description} onChange={(e) => setTeamForm((p) => ({ ...p, description: e.target.value }))} />
            {memberSelector(teamForm.memberIds, (memberIds) => setTeamForm((prev) => ({ ...prev, memberIds })))}

            <Button type="submit" disabled={savingTeam} className="h-9 w-auto self-start bg-gradient-to-r from-primary to-accent px-4 text-sm text-primary-foreground">
              {savingTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Create Team
            </Button>
          </form>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="glass-card p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">Users</h2>
                <p className="text-xs text-muted-foreground">List of accounts for the dashboard</p>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading users...
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users yet.</p>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-2.5 rounded-2xl border border-border/70 bg-background/45 p-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">{getInitials(user.fullName)}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{user.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">{roleLabel(user.role)}</span>
                      <Button type="button" variant="outline" onClick={() => startEditUser(user)} className="h-8 px-2">
                        <Edit3 className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit user</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass-card p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">Teams</h2>
                <p className="text-xs text-muted-foreground">Team members in dedicated teams created.</p>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading teams...
              </div>
            ) : teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No teams yet.</p>
            ) : (
              <div className="space-y-2">
                {teams.map((team) => (
                  <div key={team.id} className="rounded-2xl border border-border/70 bg-background/45 p-2.5">
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{team.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{team.description || "Team workspace"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">{team.memberCount} members</span>
                        <Button type="button" variant="outline" onClick={() => startEditTeam(team)} className="h-8 px-2">
                          <Edit3 className="h-3.5 w-3.5" />
                          <span className="sr-only">Manage team</span>
                        </Button>
                      </div>
                    </div>
                    {team.members?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {team.members.map((member) => (
                          <span key={member.id} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                            {member.fullName} • {roleLabel(member.role)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border/70 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-black text-primary">
                  {getInitials(editingUser.fullName)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black uppercase tracking-wide text-primary">Edit User</p>
                  <h3 className="truncate text-xl font-black">{editingUser.fullName}</h3>
                  <p className="truncate text-xs text-muted-foreground">{editingUser.email}</p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => setEditingUserId(null)} className="h-8 px-2">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-3 p-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Full name</label>
                <input className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary" value={userEditForm.fullName} onChange={(e) => setUserEditForm((p) => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Email</label>
                <input className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary" type="email" value={userEditForm.email} onChange={(e) => setUserEditForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Role</label>
                <select className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary" value={userEditForm.role} onChange={(e) => setUserEditForm((p) => ({ ...p, role: e.target.value as AdminRole }))}>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                  <option value="business_owner">Business Owner</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 p-4">
              <Button type="button" variant="outline" disabled={deletingUserId === editingUser.id} onClick={() => handleDeleteUser(editingUser)} className="h-9 px-3 text-sm text-destructive hover:text-destructive">
                {deletingUserId === editingUser.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete User
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingUserId(null)} className="h-9 px-3 text-sm">
                  Cancel
                </Button>
                <Button type="button" disabled={updatingUserId === editingUser.id} onClick={() => handleUpdateUser(editingUser.id)} className="h-9 bg-gradient-to-r from-primary to-accent px-4 text-sm text-primary-foreground">
                  {updatingUserId === editingUser.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border/70 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-4">
              <div className="min-w-0">
                <p className="text-sm font-black uppercase tracking-wide text-primary">Manage Team</p>
                <h3 className="truncate text-xl font-black">{editingTeam.name}</h3>
                <p className="truncate text-xs text-muted-foreground">
                  {editingTeam.memberCount} members • Add, remove, or update this team
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => setEditingTeamId(null)} className="h-8 px-2">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="max-h-[calc(90vh-145px)] space-y-4 overflow-auto p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Team name</label>
                  <input className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary" value={teamEditForm.name} onChange={(e) => setTeamEditForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Current selected members</label>
                  <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-border bg-background/50 px-3 py-2">
                    {teamEditForm.memberIds.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No members selected</span>
                    ) : (
                      users
                        .filter((user) => teamEditForm.memberIds.includes(user.id))
                        .map((member) => (
                          <span key={member.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            {member.fullName}
                          </span>
                        ))
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Description</label>
                <textarea className="min-h-20 w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary" value={teamEditForm.description} onChange={(e) => setTeamEditForm((p) => ({ ...p, description: e.target.value }))} />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                    <UserPlus className="h-3.5 w-3.5" /> Add or remove team members
                  </div>
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                    {teamEditForm.memberIds.length} selected
                  </span>
                </div>
                {memberSelector(teamEditForm.memberIds, (memberIds) => setTeamEditForm((prev) => ({ ...prev, memberIds })))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 p-4">
              <Button type="button" variant="outline" disabled={deletingTeamId === editingTeam.id} onClick={() => handleDeleteTeam(editingTeam)} className="h-9 px-3 text-sm text-destructive hover:text-destructive">
                {deletingTeamId === editingTeam.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete Team
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingTeamId(null)} className="h-9 px-3 text-sm">
                  Cancel
                </Button>
                <Button type="button" disabled={updatingTeamId === editingTeam.id} onClick={() => handleUpdateTeam(editingTeam.id)} className="h-9 bg-gradient-to-r from-primary to-accent px-4 text-sm text-primary-foreground">
                  {updatingTeamId === editingTeam.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Team
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
