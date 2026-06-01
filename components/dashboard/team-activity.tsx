"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CheckCircle2, MessageSquare, GitBranch, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"

interface Activity {
  id: string
  user: {
    name: string
    initials: string
  }
  action: string
  target: string
  type: "task" | "comment" | "pipeline" | "achievement"
  time: string
}

const activities: Activity[] = [
  {
    id: "1",
    user: { name: "Sarah Chen", initials: "SC" },
    action: "completed",
    target: "API Integration Task",
    type: "task",
    time: "2 min ago",
  },
  {
    id: "2",
    user: { name: "Mike Ross", initials: "MR" },
    action: "commented on",
    target: "Database Migration Ticket",
    type: "comment",
    time: "15 min ago",
  },
  {
    id: "3",
    user: { name: "Lisa Park", initials: "LP" },
    action: "created",
    target: "Weekly Report Pipeline",
    type: "pipeline",
    time: "1 hour ago",
  },
  {
    id: "4",
    user: { name: "Alex Kim", initials: "AK" },
    action: "earned",
    target: "100 Tasks Completed",
    type: "achievement",
    time: "2 hours ago",
  },
  {
    id: "5",
    user: { name: "John Doe", initials: "JD" },
    action: "completed",
    target: "Security Audit Review",
    type: "task",
    time: "3 hours ago",
  },
]

const typeIcons = {
  task: CheckCircle2,
  comment: MessageSquare,
  pipeline: GitBranch,
  achievement: Trophy,
}

const typeColors = {
  task: "text-primary bg-primary/10",
  comment: "text-chart-2 bg-chart-2/10",
  pipeline: "text-accent bg-accent/10",
  achievement: "text-chart-4 bg-chart-4/10",
}

export function TeamActivity() {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Team Activity</h3>
          <p className="text-sm text-muted-foreground">Recent team updates</p>
        </div>
        <button className="text-sm text-primary hover:text-primary/80 transition-colors">
          View all
        </button>
      </div>
      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = typeIcons[activity.type]
          return (
            <div key={activity.id} className="flex items-start gap-3">
              <Avatar className="h-8 w-8 mt-0.5">
                <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                  {activity.user.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{activity.user.name}</span>{" "}
                  <span className="text-muted-foreground">{activity.action}</span>{" "}
                  <span className="font-medium">{activity.target}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
              </div>
              <div className={cn("p-1.5 rounded-lg", typeColors[activity.type])}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
