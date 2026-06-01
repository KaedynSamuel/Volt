"use client"

import { cn } from "@/lib/utils"
import {
  Sparkles,
  FileText,
  ListTodo,
  BarChart3,
  Mail,
  Calendar,
  Search,
  Zap,
} from "lucide-react"

const quickActions = [
  {
    icon: ListTodo,
    label: "Summarize tasks",
    prompt: "Summarize my open tasks and priorities for today",
    color: "text-blue-400",
    bg: "bg-blue-500/10 hover:bg-blue-500/20",
  },
  {
    icon: FileText,
    label: "Draft response",
    prompt: "Help me draft a professional response to this ticket",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 hover:bg-emerald-500/20",
  },
  {
    icon: BarChart3,
    label: "Analyze trends",
    prompt: "Analyze the trends in my ticket data this month",
    color: "text-purple-400",
    bg: "bg-purple-500/10 hover:bg-purple-500/20",
  },
  {
    icon: Zap,
    label: "Automate this",
    prompt: "Help me create an automation for this workflow",
    color: "text-amber-400",
    bg: "bg-amber-500/10 hover:bg-amber-500/20",
  },
]

interface QuickActionsProps {
  onSelectAction: (prompt: string) => void
}

export function QuickActions({ onSelectAction }: QuickActionsProps) {
  return (
    <div className="p-4 border-b border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">
          Quick Actions
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => onSelectAction(action.prompt)}
            className={cn(
              "flex items-center gap-2 rounded-lg p-2.5 text-left transition-colors",
              action.bg
            )}
          >
            <action.icon className={cn("h-4 w-4 shrink-0", action.color)} />
            <span className="text-xs font-medium text-foreground truncate">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const contextSuggestions = [
  { icon: Search, label: "Search tickets" },
  { icon: Mail, label: "Check emails" },
  { icon: Calendar, label: "View schedule" },
]

export function ContextSuggestions() {
  return (
    <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg">
      <span className="text-xs text-muted-foreground">Context:</span>
      {contextSuggestions.map((item) => (
        <button
          key={item.label}
          className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <item.icon className="h-3 w-3" />
          {item.label}
        </button>
      ))}
    </div>
  )
}
