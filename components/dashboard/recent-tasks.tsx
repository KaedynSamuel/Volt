"use client"

import { cn } from "@/lib/utils"
import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface Task {
  id: string
  title: string
  status: "pending" | "in-progress" | "completed"
  priority: "low" | "medium" | "high"
  assignee: {
    name: string
    initials: string
  }
  dueDate: string
}

const tasks: Task[] = [
  {
    id: "1",
    title: "Review quarterly report",
    status: "in-progress",
    priority: "high",
    assignee: { name: "John Doe", initials: "JD" },
    dueDate: "Today",
  },
  {
    id: "2",
    title: "Update API documentation",
    status: "pending",
    priority: "medium",
    assignee: { name: "Sarah Chen", initials: "SC" },
    dueDate: "Tomorrow",
  },
  {
    id: "3",
    title: "Deploy new features to staging",
    status: "completed",
    priority: "high",
    assignee: { name: "Mike Ross", initials: "MR" },
    dueDate: "Yesterday",
  },
  {
    id: "4",
    title: "Database optimization",
    status: "in-progress",
    priority: "medium",
    assignee: { name: "Lisa Park", initials: "LP" },
    dueDate: "Dec 20",
  },
  {
    id: "5",
    title: "Customer feedback analysis",
    status: "pending",
    priority: "low",
    assignee: { name: "Alex Kim", initials: "AK" },
    dueDate: "Dec 22",
  },
]

const statusIcons = {
  pending: Circle,
  "in-progress": Clock,
  completed: CheckCircle2,
}

const statusColors = {
  pending: "text-muted-foreground",
  "in-progress": "text-chart-4",
  completed: "text-primary",
}

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-chart-4/20 text-chart-4",
  high: "bg-destructive/20 text-destructive",
}

export function RecentTasks() {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Recent Tasks</h3>
          <p className="text-sm text-muted-foreground">Your latest assigned tasks</p>
        </div>
        <button className="text-sm text-primary hover:text-primary/80 transition-colors">
          View all
        </button>
      </div>
      <div className="space-y-4">
        {tasks.map((task) => {
          const StatusIcon = statusIcons[task.status]
          return (
            <div
              key={task.id}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <StatusIcon className={cn("h-5 w-5", statusColors[task.status])} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                <p className="text-xs text-muted-foreground">Due: {task.dueDate}</p>
              </div>
              <span
                className={cn(
                  "px-2 py-0.5 text-xs font-medium rounded-full capitalize",
                  priorityColors[task.priority]
                )}
              >
                {task.priority}
              </span>
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                  {task.assignee.initials}
                </AvatarFallback>
              </Avatar>
            </div>
          )
        })}
      </div>
    </div>
  )
}
