"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"

const data = [
  { date: "Mon", tasks: 12, tickets: 8 },
  { date: "Tue", tasks: 19, tickets: 15 },
  { date: "Wed", tasks: 15, tickets: 12 },
  { date: "Thu", tasks: 25, tickets: 18 },
  { date: "Fri", tasks: 32, tickets: 22 },
  { date: "Sat", tasks: 18, tickets: 10 },
  { date: "Sun", tasks: 8, tickets: 5 },
]

export function ActivityChart() {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Weekly Activity</h3>
          <p className="text-sm text-muted-foreground">Tasks and tickets completed</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Tasksss</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-accent" />
            <span className="text-sm text-muted-foreground">Tickets</span>
          </div>
        </div>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="tasksGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.65 0.2 145)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="oklch(0.65 0.2 145)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ticketsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.55 0.18 280)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="oklch(0.55 0.18 280)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 270)" />
            <XAxis
              dataKey="date"
              stroke="oklch(0.65 0 0)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="oklch(0.65 0 0)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.15 0.01 270)",
                border: "1px solid oklch(0.25 0.015 270)",
                borderRadius: "8px",
                color: "oklch(0.95 0 0)",
              }}
            />
            <Area
              type="monotone"
              dataKey="tasks"
              stroke="oklch(0.65 0.2 145)"
              strokeWidth={2}
              fill="url(#tasksGradient)"
            />
            <Area
              type="monotone"
              dataKey="tickets"
              stroke="oklch(0.55 0.18 280)"
              strokeWidth={2}
              fill="url(#ticketsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
