"use client"

import { cn } from "@/lib/utils"
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: LucideIcon
  variant?: "default" | "primary" | "accent"
}

export function StatsCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  variant = "default",
}: StatsCardProps) {
  const isPositive = change !== undefined && change >= 0

  return (
    <div className="glass-card p-6 hover:border-primary/30 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1.5">
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-primary" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              <span
                className={cn(
                  "text-sm font-medium",
                  isPositive ? "text-primary" : "text-destructive"
                )}
              >
                {isPositive ? "+" : ""}{change}%
              </span>
              {changeLabel && (
                <span className="text-sm text-muted-foreground">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-lg",
            variant === "primary" && "bg-primary/10",
            variant === "accent" && "bg-accent/10",
            variant === "default" && "bg-muted"
          )}
        >
          <Icon
            className={cn(
              "h-6 w-6",
              variant === "primary" && "text-primary",
              variant === "accent" && "text-accent",
              variant === "default" && "text-muted-foreground"
            )}
          />
        </div>
      </div>
    </div>
  )
}
