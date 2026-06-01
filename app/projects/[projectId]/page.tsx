"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Cell, Pie, PieChart } from "recharts"
import { ArrowLeft, CheckCircle2, Circle, Clock, FolderKanban, Loader2, Users } from "lucide-react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { TaskCard, Task } from "@/components/tasks/task-card"
import { getStoredCompanyId } from "@/lib/tenant"

type ProjectMember = { id: number; fullName: string; email: string; role: string }
type ProjectDetails = { id: string; name: string; description: string; icon: string }

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams<{ projectId: string }>()
  const [project, setProject] = useState<ProjectDetails | null>(null)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const columns = useMemo(() => [
    { id: "pending" as const, title: "To Do", icon: Circle },
    { id: "in-progress" as const, title: "In Progress", icon: Clock },
    { id: "completed" as const, title: "Done", icon: CheckCircle2 },
  ], [])

  const chartData = useMemo(() => [
    { status: "To Do", value: tasks.filter((task) => task.status === "pending").length, fill: "var(--color-todo)" },
    { status: "In Progress", value: tasks.filter((task) => task.status === "in-progress").length, fill: "var(--color-progress)" },
    { status: "Done", value: tasks.filter((task) => task.status === "completed").length, fill: "var(--color-done)" },
  ], [tasks])

  async function loadProject() {
    try {
      setLoading(true)
      setError("")
      const companyId = getStoredCompanyId()
      if (!companyId) {
        router.push("/dashboards")
        return
      }
      const response = await fetch(`/api/projects/${params.projectId}?companyId=${companyId}`, { cache: "no-store" })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.details || data?.error || "Failed to load project")
      setProject(data.project)
      setMembers(Array.isArray(data.members) ? data.members : [])
      setTasks(Array.isArray(data.tasks) ? data.tasks : [])
    } catch (error) {
      setError(error instanceof Error ? error.message : "Project could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProject() }, [params.projectId])

  async function handleStatusChange(id: string, status: Task["status"]) {
    const oldTasks = tasks
    setTasks((prev) => prev.map((task) => task.id === id ? { ...task, status } : task))
    try {
      const companyId = getStoredCompanyId()
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-company-id": String(companyId || "") },
        body: JSON.stringify({ id, status }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.details || data?.error || "Failed to update task")
    } catch (error) {
      setTasks(oldTasks)
      setError(error instanceof Error ? error.message : "Task could not be updated.")
    }
  }

  return (
    <DashboardLayout title={project?.name || "Project"} subtitle={project?.description || "Project board and task progress"}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/projects")}><ArrowLeft className="mr-2 h-4 w-4" />Back to Projects</Button>
        <Button size="sm" onClick={() => router.push(`/tasks?projectId=${params.projectId}`)} className="bg-gradient-to-r from-primary to-accent text-primary-foreground">Create Project Task</Button>
      </div>

      {error && <div className="glass-card mb-4 border border-destructive/30 p-4"><p className="text-sm text-destructive">{error}</p></div>}

      {loading ? <div className="glass-card flex items-center justify-center gap-2 p-12"><Loader2 className="h-5 w-5 animate-spin" />Loading project...</div> : (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="glass-card p-5">
              <div className="flex items-start gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground glow"><FolderKanban className="h-6 w-6" /></div><div><h2 className="text-xl font-semibold text-foreground">{project?.name}</h2><p className="mt-1 text-sm text-muted-foreground">{project?.description || "No description added."}</p></div></div>
              <div className="mt-5 flex flex-wrap gap-2">{members.map((member) => <span key={member.id} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{member.fullName}</span>)}</div>
            </div>
            <div className="glass-card p-5">
              <div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h3 className="font-medium text-foreground">Project Progress</h3></div>
              <ChartContainer config={{ todo: { label: "To Do", color: "hsl(var(--muted-foreground))" }, progress: { label: "In Progress", color: "hsl(var(--chart-4))" }, done: { label: "Done", color: "hsl(var(--primary))" } }} className="mx-auto aspect-square max-h-[220px]">
                <PieChart><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Pie data={chartData} dataKey="value" nameKey="status" innerRadius={55}>{chartData.map((entry) => <Cell key={entry.status} fill={entry.fill} />)}</Pie></PieChart>
              </ChartContainer>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {columns.map((column) => { const Icon = column.icon; const columnTasks = tasks.filter((task) => task.status === column.id); return <div key={column.id} className="glass-card p-4"><div className="mb-4 flex items-center justify-between"><h3 className="flex items-center gap-2 font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" />{column.title}</h3><span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{columnTasks.length}</span></div><div className="space-y-3">{columnTasks.length ? columnTasks.map((task) => <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} />) : <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No tasks here.</p>}</div></div> })}
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
