"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BarChart3,
  Boxes,
  Code2,
  FolderKanban,
  Layers3,
  Loader2,
  Megaphone,
  Plus,
  Rocket,
  Trash2,
  Users,
  X,
  CalendarDays,
  AlertTriangle,
} from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { VoltPageTour } from "@/components/tours/VoltPageTour"
import { getStoredCompanyId } from "@/lib/tenant"
import { getStoredSession } from "@/lib/auth"
import { cn } from "@/lib/utils"

const projectIcons = [
  { name: "FolderKanban", label: "Project", icon: FolderKanban },
  { name: "Rocket", label: "Launch", icon: Rocket },
  { name: "Code2", label: "Code", icon: Code2 },
  { name: "BarChart3", label: "Reports", icon: BarChart3 },
  { name: "Megaphone", label: "Marketing", icon: Megaphone },
  { name: "Layers3", label: "System", icon: Layers3 },
]

function getProjectIcon(iconName: string) {
  return projectIcons.find((item) => item.name === iconName)?.icon || FolderKanban
}

type TeamMember = { id: number; fullName: string; email: string; role: string }
type Project = {
  id: string
  name: string
  description: string
  icon: string
  memberCount: number
  totalTasks: number
  pendingTasks: number
  inProgressTasks: number
  completedTasks: number
  dueDate?: string | null
  previewTasks: Array<{
    id: number
    title: string
    status: "pending" | "in-progress" | "completed"
    priority: "low" | "medium" | "high"
    assigneeName?: string
  }>
}

const emptyForm = {
  name: "",
  description: "",
  icon: "FolderKanban",
  memberIds: [] as number[],
  dueDate: "",
}

function isOverdue(dueDate?: string | null) {
  if (!dueDate) return false
  const due = new Date(dueDate)
  if (isNaN(due.getTime())) return false
  due.setHours(23, 59, 59, 999)
  return due.getTime() < Date.now()
}

function formatDate(d?: string | null) {
  if (!d) return null
  const date = new Date(d)
  if (isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })
}

function ProgressDonut({ percent }: { percent: number }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  return (
    <svg width="52" height="52" className="shrink-0 -rotate-90">
      <circle cx="26" cy="26" r={r} stroke="hsl(var(--muted))" strokeWidth="5" fill="none" />
      <circle
        cx="26"
        cy="26"
        r={r}
        stroke="hsl(var(--primary))"
        strokeWidth="5"
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const session = useMemo(() => getStoredSession(), [])

  async function loadProjects() {
    try {
      setLoading(true)
      setError("")
      const companyId = getStoredCompanyId()
      if (!companyId) { router.push("/dashboards"); return }
      const [projectsResponse, membersResponse] = await Promise.all([
        fetch(`/api/projects?companyId=${companyId}`, { cache: "no-store" }),
        fetch(`/api/team-members?companyId=${companyId}`, { cache: "no-store" }),
      ])
      const projectsData = await projectsResponse.json().catch(() => null)
      const membersData = await membersResponse.json().catch(() => null)
      if (!projectsResponse.ok) throw new Error(projectsData?.details || projectsData?.error || "Failed to load projects")
      if (!membersResponse.ok) throw new Error(membersData?.details || membersData?.error || "Failed to load team members")
      setProjects(Array.isArray(projectsData) ? projectsData : [])
      setMembers(Array.isArray(membersData) ? membersData : [])
    } catch (error) {
      setError(error instanceof Error ? error.message : "Projects could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProjects() }, [])

  function toggleMember(userId: number) {
    setForm((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(userId)
        ? prev.memberIds.filter((id) => id !== userId)
        : [...prev.memberIds, userId],
    }))
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.name.trim()) { setError("Project name is required."); return }
    try {
      setSaving(true)
      setError("")
      const companyId = getStoredCompanyId()
      if (!companyId) { router.push("/dashboards"); return }
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-company-id": companyId, "x-user-id": String(session?.userId || "") },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          icon: form.icon,
          memberIds: form.memberIds,
          createdByUserId: session?.userId,
          dueDate: form.dueDate || null,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.details || data?.error || "Failed to create project")
      setProjects((prev) => [data, ...prev])
      setForm(emptyForm)
      setShowCreateProject(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Project could not be created.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteProject(projectId: string) {
    if (!confirm("Are you sure you want to delete this project? Tasks linked to it will be unlinked.")) return
    try {
      setDeletingId(projectId)
      const companyId = getStoredCompanyId()
      if (!companyId) return
      const response = await fetch(`/api/projects/${projectId}?companyId=${companyId}`, {
        method: "DELETE",
        headers: { "x-company-id": companyId },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || "Failed to delete project")
      }
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
    } catch (error) {
      setError(error instanceof Error ? error.message : "Project could not be deleted.")
    } finally {
      setDeletingId(null)
    }
  }

  // Sort overdue to end
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const aOver = isOverdue(a.dueDate) ? 1 : 0
      const bOver = isOverdue(b.dueDate) ? 1 : 0
      return aOver - bOver
    })
  }, [projects])

  const overdueCount = projects.filter((p) => isOverdue(p.dueDate)).length

  return (
    <DashboardLayout title="Projects" subtitle="Group work by project, members, and project-only tasks">
      <VoltPageTour
        storageKey="volt-projects-tour-seen"
        steps={[
          {
            title: "Welcome to Projects ⚡",
            description: "Projects group tasks under a shared goal. Add a due date, pick team members, and track progress with a live chart on each card.",
            image: "/volty/step-1-welcome.png",
            placement: "center",
          },
          {
            title: "Create a Project",
            description: "Click 'New Project' to create one. Give it a name, description, due date and choose which team members can be assigned tasks inside it.",
            target: '[data-tour="new-project-btn"]',
            placement: "bottom",
            mascotSide: "left",
            image: "/volty/step-2-join-codes.png",
          },
          {
            title: "Project Cards",
            description: "Each project shows a progress donut, task counts, and due date. Overdue projects turn red and move to the end of the list automatically.",
            target: '[data-tour="project-grid"]',
            placement: "top",
            mascotSide: "right",
            image: "/volty/step-3-dashboards.png",
          },
          {
            title: "Delete a Project",
            description: "Hover over a project card to reveal the delete button (top-right). Deleting a project unlinks its tasks — they stay in your task board.",
            target: '[data-tour="project-grid"]',
            placement: "top",
            mascotSide: "left",
            image: "/volty/step-5-build-dashboard.png",
          },
          {
            title: "All set!",
            description: "Click any project card to open its detail board and manage tasks directly from there.",
            image: "/volty/step-6-goodbye.png",
            placement: "center",
          },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="glass-card px-4 py-2">
            <span className="text-2xl font-bold text-foreground">{projects.length}</span>
            <span className="ml-2 text-sm text-muted-foreground">Projects</span>
          </div>
          <div className="glass-card px-4 py-2">
            <span className="text-2xl font-bold text-primary">{projects.reduce((sum, p) => sum + p.totalTasks, 0)}</span>
            <span className="ml-2 text-sm text-muted-foreground">Project Tasks</span>
          </div>
          {overdueCount > 0 && (
            <div className="glass-card border border-destructive/30 bg-destructive/5 px-4 py-2">
              <span className="text-2xl font-bold text-destructive">{overdueCount}</span>
              <span className="ml-2 text-sm text-destructive/80">Overdue</span>
            </div>
          )}
        </div>
        <Button data-tour="new-project-btn" onClick={() => setShowCreateProject(true)} className="bg-gradient-to-r from-primary to-accent text-primary-foreground glow">
          <Plus className="mr-2 h-4 w-4" />New Project
        </Button>
      </div>

      {error && <div className="glass-card mb-4 border border-destructive/30 p-4"><p className="text-sm text-destructive">{error}</p></div>}

      {/* Create Project Modal */}
      {showCreateProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="glass-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-primary/20 p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Create Project</h2>
                <p className="mt-1 text-xs text-muted-foreground">Set a due date and add team members to restrict who can be assigned tasks in this project.</p>
              </div>
              <button type="button" onClick={() => setShowCreateProject(false)} className="rounded-full p-1.5 transition hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Project Name</label>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Database Migration" className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Description</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="What is this project about?" rows={3} className="w-full resize-none rounded-lg border border-border bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Due Date</label>
                <input type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm outline-none focus:border-primary" />
                <p className="text-[11px] text-muted-foreground">Overdue projects will move to the end and highlight in red.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Icon</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {projectIcons.map((item) => {
                    const Icon = item.icon
                    const selected = form.icon === item.name
                    return (
                      <button key={item.name} type="button" onClick={() => setForm((p) => ({ ...p, icon: item.name }))} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition", selected ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                        <Icon className="h-4 w-4" />{item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Project Team</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {members.map((member) => (
                    <label key={member.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background/60 p-3 text-sm hover:bg-muted/50">
                      <input type="checkbox" checked={form.memberIds.includes(member.id)} onChange={() => toggleMember(member.id)} className="h-4 w-4" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{member.fullName}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">Only these members can be selected when creating tasks inside this project.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setShowCreateProject(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={saving} className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
                  {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Plus className="mr-2 h-4 w-4" />Create Project</>}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="glass-card flex items-center justify-center gap-2 p-12 text-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Boxes className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium text-foreground">No projects yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first project and add the correct dashboard team members.</p>
        </div>
      ) : (
        <div data-tour="project-grid" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedProjects.map((project) => {
            const Icon = getProjectIcon(project.icon)
            const donePercent = project.totalTasks ? Math.round((project.completedTasks / project.totalTasks) * 100) : 0
            const overdue = isOverdue(project.dueDate)

            return (
              <div
                key={project.id}
                className={cn(
                  "glass-card relative flex flex-col p-5 transition hover:-translate-y-1",
                  overdue
                    ? "border-destructive/50 bg-destructive/5 shadow-destructive/10 hover:border-destructive/70 hover:shadow-destructive/20"
                    : "hover:border-primary/30",
                )}
              >
                {overdue && (
                  <div className="mb-3 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wide">Project Overdue</span>
                  </div>
                )}

                {/* Delete button */}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); handleDeleteProject(project.id) }}
                  disabled={deletingId === project.id}
                  title="Delete project"
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg border border-destructive/25 bg-destructive/10 text-destructive opacity-0 transition hover:bg-destructive/20 group-hover:opacity-100 [.glass-card:hover_&]:opacity-100"
                >
                  {deletingId === project.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>

                <Link href={`/projects/${project.id}`} className="flex flex-col gap-4">
                  {/* Header */}
                  <div className="flex items-start gap-3 pr-8">
                    <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-primary-foreground glow", overdue ? "bg-destructive" : "bg-gradient-to-br from-primary to-accent")}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold text-foreground">{project.name}</h3>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{project.description || "No description added."}</p>
                    </div>
                  </div>

                  {/* Due date */}
                  {project.dueDate && (
                    <div className={cn("flex items-center gap-1.5 text-xs font-semibold", overdue ? "text-destructive" : "text-muted-foreground")}>
                      <CalendarDays className="h-3.5 w-3.5" />
                      Due {formatDate(project.dueDate)}
                    </div>
                  )}

                  {/* Progress + donut */}
                  <div className="flex items-center gap-3">
                    <ProgressDonut percent={donePercent} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className={overdue ? "text-destructive" : "text-primary"}>{donePercent}% complete</span>
                        <span className="text-muted-foreground">{project.completedTasks}/{project.totalTasks} tasks</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all duration-700", overdue ? "bg-destructive" : "bg-gradient-to-r from-primary to-accent")}
                          style={{ width: `${donePercent}%` }}
                        />
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                        <div className="rounded-md bg-muted/30 py-1">
                          <p className="text-sm font-bold text-foreground">{project.pendingTasks}</p>
                          <p className="text-[10px] text-muted-foreground">Todo</p>
                        </div>
                        <div className="rounded-md bg-muted/30 py-1">
                          <p className="text-sm font-bold text-primary">{project.inProgressTasks}</p>
                          <p className="text-[10px] text-muted-foreground">Active</p>
                        </div>
                        <div className="rounded-md bg-muted/30 py-1">
                          <p className="text-sm font-bold text-foreground">{project.memberCount}</p>
                          <p className="text-[10px] text-muted-foreground">Members</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Preview tasks */}
                  <div className="space-y-1.5">
                    {project.previewTasks?.length ? (
                      project.previewTasks.slice(0, 3).map((task) => (
                        <div key={task.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-1.5 text-xs">
                          <span className="truncate text-foreground">{task.title}</span>
                          <span className="ml-2 shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{task.status}</span>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">No tasks in this project yet.</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-4 w-4" />Open project board
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </DashboardLayout>
  )
}
