"use client"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  CheckCircle2,
  Circle,
  Clock,
  MoreHorizontal,
  Calendar,
  User,
  Flag,
} from "lucide-react"

export interface Task {
  id: string
  title: string
  description?: string
  status: "pending" | "todo" | "in-progress" | "rollover" | "completed" | "blocked"
  priority: "low" | "medium" | "high"
  projectId?: string | null
  projectName?: string | null
  assignedToUserId?: number | null
  createdByUserId?: number | null
  assignmentType?: "personal" | "assigned"
  assignee?: {
    name: string
    initials: string
  }
  dueDate?: string
  tags?: string[]
}

interface TaskCardProps {
  task: Task
  onStatusChange?: (id: string, status: Task["status"]) => void
}

const statusConfig = {
  pending: {
    icon: Circle,
    label: "Pending",
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
  todo: {
    icon: Circle,
    label: "To Do",
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
  "in-progress": {
    icon: Clock,
    label: "In Progress",
    color: "text-chart-4",
    bg: "bg-chart-4/20",
  },
  rollover: {
    icon: Clock,
    label: "Rollover",
    color: "text-accent",
    bg: "bg-accent/20",
  },
  blocked: {
    icon: Flag,
    label: "Blocked",
    color: "text-destructive",
    bg: "bg-destructive/20",
  },
  completed: {
    icon: CheckCircle2,
    label: "Completed",
    color: "text-primary",
    bg: "bg-primary/20",
  },
}

const priorityConfig = {
  low: { label: "Low", color: "text-muted-foreground", bg: "bg-muted" },
  medium: { label: "Medium", color: "text-chart-4", bg: "bg-chart-4/20" },
  high: { label: "High", color: "text-destructive", bg: "bg-destructive/20" },
}

export function TaskCard({ task, onStatusChange }: TaskCardProps) {
  const status = statusConfig[task.status]
  const priority = priorityConfig[task.priority]
  const StatusIcon = status.icon

  return (
    <div className="glass-card p-4 hover:border-primary/30 transition-all duration-300 group">
      <div className="flex items-start gap-3">
        <button
          onClick={() => {
            const nextStatus: Task["status"] =
              task.status === "pending" || task.status === "todo"
                ? "in-progress"
                : task.status === "in-progress"
                  ? "rollover"
                  : task.status === "rollover"
                    ? "completed"
                    : "todo"
            onStatusChange?.(task.id, nextStatus)
          }}
          className="mt-0.5 hover:scale-110 transition-transform"
        >
          <StatusIcon className={cn("h-5 w-5", status.color)} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4
              className={cn(
                "font-medium text-foreground",
                task.status === "completed" && "line-through text-muted-foreground"
              )}
            >
              {task.title}
            </h4>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Edit Task</DropdownMenuItem>
                <DropdownMenuItem>Assign User</DropdownMenuItem>
                <DropdownMenuItem>Set Due Date</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {task.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          )}

          {task.projectName && (
            <div className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Project: {task.projectName}
            </div>
          )}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full", priority.bg, priority.color)}>
              <Flag className="h-3 w-3 inline mr-1" />
              {priority.label}
            </span>
            <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full", status.bg, status.color)}>
              {status.label}
            </span>
            {task.dueDate && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {task.dueDate}
              </span>
            )}
            {task.assignee && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-secondary text-secondary-foreground">
                    {task.assignee.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">{task.assignee.name}</span>
              </div>
            )}
          </div>
          {task.tags && task.tags.length > 0 && (
            <div className="flex gap-2 mt-3">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs rounded-full bg-accent/20 text-accent"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
