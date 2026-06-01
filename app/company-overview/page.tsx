"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ElementType,
} from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { getStoredSession } from "@/lib/auth";
import { getStoredCompanyId } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { VoltPageTour } from "@/components/tours/VoltPageTour";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Circle,
  Clock3,
  Filter,
  FolderKanban,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Ticket,
  TrendingDown,
  TrendingUp,
  Minus,
  Users,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Range = "daily" | "weekly" | "monthly";
type PieMode = "tasks" | "tickets";
type WorkFilter = "all" | "low" | "medium" | "high" | "blocked" | "urgent";
type TrendDirection = "up" | "down" | "flat";

type KpiTrend = {
  direction: TrendDirection;
  percentage: number;
  label: string;
};

type DropdownOption = {
  value: string;
  label: string;
};

type TeamMember = {
  id: number;
  full_name: string;
  role: string;
  email?: string | null;
};

type TeamOption = {
  id: number;
  name: string;
  description?: string | null;
  members: TeamMember[];
};

type ProjectOption = {
  id: string;
  name: string;
};

type WorkItem = {
  id: string | number;
  code?: string | null;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  project_id?: string | number | null;
  project_name?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  is_blocked?: boolean;
  block_reason?: string | null;
};

type OverviewData = {
  selected_user?: TeamMember | null;
  teams: TeamOption[];
  projects: ProjectOption[];
  stats: {
    total_tasks: number;
    completed_tasks: number;
    open_tasks: number;
    high_priority_tasks: number;
    blocked_tasks: number;
    total_tickets: number;
    open_tickets: number;
    resolved_tickets: number;
    urgent_tickets: number;
  };
  activity: Record<
    Range,
    Array<{ label: string; tasks: number; tickets: number }>
  >;
  tasks: WorkItem[];
  tickets: WorkItem[];
};

const rangeOptions: Range[] = ["daily", "weekly", "monthly"];

const taskFilters: { value: WorkFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "blocked", label: "Blocked" },
];

const ticketFilters: { value: WorkFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const softCardMotion =
  "transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] active:translate-y-0 active:scale-[0.99]";

const shineMotion =
  "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:bg-foreground/10 before:transition-transform before:duration-700 hover:before:translate-x-full";

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function priorityClass(priority: string) {
  const value = priority?.toLowerCase();

  if (value === "urgent")
    return "border-destructive/40 bg-destructive/10 text-destructive";
  if (value === "high")
    return "border-destructive/30 bg-destructive/10 text-destructive";
  if (value === "medium") return "border-primary/30 bg-primary/10 text-primary";
  if (value === "low") return "border-border bg-muted/40 text-muted-foreground";

  return "border-border bg-muted/30 text-muted-foreground";
}

function matchesFilter(item: WorkItem, filter: WorkFilter) {
  const priority = String(item.priority || "").toLowerCase();
  const status = String(item.status || "").toLowerCase();
  const blocked = item.is_blocked || status === "blocked";

  if (filter === "all") return true;
  if (filter === "blocked") return blocked;
  if (filter === "urgent") return priority === "urgent";

  return priority === filter;
}

function getItemDateKey(item: WorkItem) {
  const rawDate = item.created_at || item.due_date;

  if (!rawDate) return "";

  const date = new Date(rawDate);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function isWorkItemClosed(item: WorkItem) {
  const status = getStatusValue(item);

  return ["completed", "done", "closed", "resolved"].includes(status);
}

function isWorkItemOverdue(item: WorkItem) {
  if (!item.due_date || isWorkItemClosed(item)) return false;

  const dueDate = new Date(item.due_date);

  if (Number.isNaN(dueDate.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate < today;
}

function makeTrend(
  current: number,
  previous: number,
  label = "vs previous day",
): KpiTrend {
  if (!current && !previous) {
    return { direction: "flat", percentage: 0, label: "No change" };
  }

  if (!previous && current > 0) {
    return { direction: "up", percentage: 100, label: "New activity" };
  }

  const change = ((current - previous) / Math.max(previous, 1)) * 100;
  const rounded = Math.round(Math.abs(change));

  if (change > 0) return { direction: "up", percentage: rounded, label };
  if (change < 0) return { direction: "down", percentage: rounded, label };

  return { direction: "flat", percentage: 0, label: "No change" };
}

function getTrendWord(direction: TrendDirection) {
  if (direction === "up") return "increased";
  if (direction === "down") return "decreased";

  return "stayed steady";
}

function getTrendExplanation(title: string, trend: KpiTrend) {
  if (trend.direction === "flat") {
    return `${title} stayed steady compared with the previous result in this view.`;
  }

  return `${title} ${getTrendWord(trend.direction)} by ${trend.percentage}% because the latest activity count changed compared with the previous result in this view.`;
}

function getTrendFromItems(
  currentItems: WorkItem[],
  previousItems: WorkItem[],
  filter: (item: WorkItem) => boolean,
) {
  return makeTrend(
    currentItems.filter(filter).length,
    previousItems.filter(filter).length,
  );
}
function getStatusValue(item: WorkItem) {
  return String(item.status || "")
    .toLowerCase()
    .replace(/_/g, "-");
}

function countItemsByStatus(
  items: WorkItem[],
  matcher: (item: WorkItem, status: string) => boolean,
) {
  return items.filter((item) => matcher(item, getStatusValue(item))).length;
}

function getTaskPieCounts(data?: OverviewData | null) {
  const tasks = data?.tasks || [];

  if (!tasks.length) {
    return {
      todo: Math.max(
        0,
        (data?.stats.open_tasks || 0) - (data?.stats.blocked_tasks || 0),
      ),
      inProgress: 0,
      completed: data?.stats.completed_tasks || 0,
      blocked: data?.stats.blocked_tasks || 0,
    };
  }

  const completed = countItemsByStatus(tasks, (_item, status) =>
    ["completed", "done", "closed"].includes(status),
  );
  const blocked = countItemsByStatus(
    tasks,
    (item, status) => item.is_blocked || status === "blocked",
  );
  const inProgress = countItemsByStatus(tasks, (_item, status) =>
    ["in-progress", "progress", "active", "doing"].includes(status),
  );
  const todo = tasks.filter((item) => {
    const status = getStatusValue(item);

    return (
      !item.is_blocked &&
      ![
        "completed",
        "done",
        "closed",
        "blocked",
        "in-progress",
        "progress",
        "active",
        "doing",
      ].includes(status)
    );
  }).length;

  return { todo, inProgress, completed, blocked };
}

function getTicketPieCounts(data?: OverviewData | null) {
  const tickets = data?.tickets || [];

  if (!tickets.length) {
    return {
      open: data?.stats.open_tickets || 0,
      inProgress: 0,
      resolved: data?.stats.resolved_tickets || 0,
      urgent: data?.stats.urgent_tickets || 0,
    };
  }

  const resolved = countItemsByStatus(tickets, (_item, status) =>
    ["resolved", "closed", "completed", "done"].includes(status),
  );
  const inProgress = countItemsByStatus(tickets, (_item, status) =>
    ["in-progress", "progress", "active", "pending", "assigned"].includes(
      status,
    ),
  );
  const urgent = tickets.filter(
    (item) => String(item.priority || "").toLowerCase() === "urgent",
  ).length;
  const open = tickets.filter((item) => {
    const status = getStatusValue(item);

    return ![
      "resolved",
      "closed",
      "completed",
      "done",
      "in-progress",
      "progress",
      "active",
      "pending",
      "assigned",
    ].includes(status);
  }).length;

  return { open, inProgress, resolved, urgent };
}

function CustomDropdown({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div className="relative">
      <label className="mb-1.5 block text-xs font-bold text-foreground">
        {label}
      </label>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-xl border border-border bg-background/80 px-3 text-left text-sm font-semibold outline-none transition-all duration-200",
          "hover:border-primary/40 hover:bg-background focus:border-primary focus:ring-2 focus:ring-primary/10",
          open && "border-primary/50 ring-2 ring-primary/10",
        )}
      >
        <span
          className={cn(
            "truncate",
            selected ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          className={cn(
            "ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180 text-primary",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[80] max-h-56 overflow-y-auto rounded-xl border border-border bg-background p-1.5 shadow-2xl shadow-foreground/15 company-overview-scroll">
          {options.length ? (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition",
                  option.value === value
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted/60",
                )}
              >
                <span className="truncate">{option.label}</span>
                {option.value === value && (
                  <Check className="ml-2 h-3.5 w-3.5 shrink-0" />
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No options found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
  tone = "primary",
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: ElementType;
  trend: KpiTrend;
  tone?: "primary" | "accent" | "danger" | "muted";
}) {
  const TrendIcon =
    trend.direction === "up"
      ? TrendingUp
      : trend.direction === "down"
        ? TrendingDown
        : Minus;

  return (
    <article
      className={cn(
        "group glass-card relative rounded-2xl border border-border/70 bg-background/55 p-4",
        softCardMotion,
        shineMotion,
        tone === "primary" && "hover:border-primary/40 hover:shadow-primary/10",
        tone === "accent" && "hover:border-accent/40 hover:shadow-accent/10",
        tone === "danger" &&
          "hover:border-destructive/40 hover:shadow-destructive/10",
        tone === "muted" &&
          "hover:border-foreground/20 hover:shadow-foreground/5",
      )}
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </p>

          <div className="mt-2 flex items-end gap-2">
            <p className="text-3xl font-black leading-none text-foreground transition-all duration-300 group-hover:scale-105">
              {value}
            </p>
          </div>

          <div
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 text-[11px] font-black transition-all duration-300 group-hover:translate-x-0.5",
              trend.direction === "up" && "text-primary",
              trend.direction === "down" && "text-destructive",
              trend.direction === "flat" && "text-muted-foreground",
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            <span>{trend.percentage}%</span>
          </div>
        </div>

        <Icon
          className={cn(
            "h-5 w-5 shrink-0 transition-all duration-300 group-hover:scale-110",
            tone === "primary" && "text-primary",
            tone === "accent" && "text-accent",
            tone === "danger" && "text-destructive",
            tone === "muted" &&
              "text-muted-foreground group-hover:text-foreground",
          )}
        />
      </div>
    </article>
  );
}

function WorkList({
  title,
  subtitle,
  icon: Icon,
  items,
  filter,
  filters,
  onFilterChange,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  icon: typeof CheckSquare;
  items: WorkItem[];
  filter: WorkFilter;
  filters: { value: WorkFilter; label: string }[];
  onFilterChange: (value: WorkFilter) => void;
  emptyLabel: string;
}) {
  const filteredItems = items.filter((item) => matchesFilter(item, filter));

  return (
    <section className="glass-card overflow-hidden rounded-2xl border border-border/70">
      <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/10 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onFilterChange(item.value)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all duration-300 hover:-translate-y-0.5",
                filter === item.value
                  ? "border-primary/40 bg-primary/10 text-primary shadow-sm shadow-primary/10"
                  : "border-border/70 bg-background/50 text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="company-overview-scroll max-h-[430px] space-y-3 overflow-y-auto p-4">
        {filteredItems.length ? (
          filteredItems.map((item) => {
            const blocked =
              item.is_blocked ||
              String(item.status).toLowerCase() === "blocked";

            return (
              <article
                key={item.id}
                className="group rounded-2xl border border-border/70 bg-background/55 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-background/75 hover:shadow-lg hover:shadow-foreground/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {item.code && (
                        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/80">
                          {item.code}
                        </span>
                      )}
                      {item.project_name && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted/45 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          <FolderKanban className="h-3 w-3" />
                          {item.project_name}
                        </span>
                      )}
                    </div>
                    <h3 className="line-clamp-2 text-sm font-bold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {item.description || "No description added."}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "shrink-0 rounded-lg border px-2 py-1 text-[10px] font-black uppercase",
                      priorityClass(item.priority),
                    )}
                  >
                    {item.priority || "normal"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/30 px-2 py-1">
                    <Clock3 className="h-3 w-3" />
                    {formatDate(item.due_date || item.created_at)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/30 px-2 py-1 capitalize">
                    <Circle className="h-3 w-3" />
                    {item.status?.replace("-", " ") || "unknown"}
                  </span>
                  {blocked && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      Blocked
                    </span>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/15 p-8 text-center">
            <Filter className="mb-3 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-bold text-foreground">{emptyLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try another filter or choose another employee.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function CompanyOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [range, setRange] = useState<Range>("daily");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [taskFilter, setTaskFilter] = useState<WorkFilter>("all");
  const [ticketFilter, setTicketFilter] = useState<WorkFilter>("all");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activePieIndex, setActivePieIndex] = useState(0);
  const [pieMode, setPieMode] = useState<PieMode>("tasks");
  const [overviewScope, setOverviewScope] = useState<"company" | "employee">(
    "company",
  );

  const selectedTeam = useMemo(
    () => data?.teams.find((team) => String(team.id) === selectedTeamId),
    [data?.teams, selectedTeamId],
  );

  const chartData = useMemo(() => data?.activity?.[range] || [], [data, range]);
  const pieData = useMemo(() => {
    const taskCounts = getTaskPieCounts(data);
    const ticketCounts = getTicketPieCounts(data);

    const values =
      pieMode === "tasks"
        ? [
            {
              name: "To Do",
              value: taskCounts.todo,
              fill: "url(#pie-todo-gradient)",
              stroke: "#06b6d4",
              bar: "linear-gradient(90deg, #06b6d4, #22d3ee)",
            },
            {
              name: "In Progress",
              value: taskCounts.inProgress,
              fill: "url(#pie-progress-gradient)",
              stroke: "#8b5cf6",
              bar: "linear-gradient(90deg, #8b5cf6, #a855f7)",
            },
            {
              name: "Completed",
              value: taskCounts.completed,
              fill: "url(#pie-completed-gradient)",
              stroke: "#22c55e",
              bar: "linear-gradient(90deg, #22c55e, #4ade80)",
            },
            {
              name: "Blocked",
              value: taskCounts.blocked,
              fill: "url(#pie-blocked-gradient)",
              stroke: "#f97316",
              bar: "linear-gradient(90deg, #f97316, #fb7185)",
            },
          ]
        : [
            {
              name: "Open",
              value: ticketCounts.open,
              fill: "url(#pie-todo-gradient)",
              stroke: "#06b6d4",
              bar: "linear-gradient(90deg, #06b6d4, #22d3ee)",
            },
            {
              name: "In Progress",
              value: ticketCounts.inProgress,
              fill: "url(#pie-progress-gradient)",
              stroke: "#8b5cf6",
              bar: "linear-gradient(90deg, #8b5cf6, #a855f7)",
            },
            {
              name: "Resolved",
              value: ticketCounts.resolved,
              fill: "url(#pie-completed-gradient)",
              stroke: "#22c55e",
              bar: "linear-gradient(90deg, #22c55e, #4ade80)",
            },
            {
              name: "Urgent",
              value: ticketCounts.urgent,
              fill: "url(#pie-blocked-gradient)",
              stroke: "#f97316",
              bar: "linear-gradient(90deg, #f97316, #fb7185)",
            },
          ];

    const filteredValues = values.filter((item) => item.value > 0);

    return filteredValues.length
      ? filteredValues
      : [
          {
            name: "No data yet",
            value: 1,
            fill: "#e5e7eb",
            stroke: "#cbd5e1",
            bar: "linear-gradient(90deg, #cbd5e1, #e5e7eb)",
          },
        ];
  }, [data, pieMode]);

  const totalWorkSplit = useMemo(
    () => pieData.reduce((total, item) => total + Number(item.value || 0), 0),
    [pieData],
  );

  const activePieData = pieData[activePieIndex] || pieData[0];
  const activePiePercent = activePieData
    ? Math.round(
        (Number(activePieData.value || 0) / Math.max(totalWorkSplit, 1)) * 100,
      )
    : 0;

  useEffect(() => {
    setActivePieIndex(0);
  }, [pieMode]);

  const teamOptions = useMemo(
    () =>
      (data?.teams || []).map((team) => ({
        value: String(team.id),
        label: team.name,
      })),
    [data?.teams],
  );

  const projectOptions = useMemo(
    () => [
      { value: "all", label: "All projects" },
      ...(data?.projects || []).map((project) => ({
        value: String(project.id),
        label: project.name,
      })),
    ],
    [data?.projects],
  );

  const isCompanyOverview = overviewScope === "company";

  const selectedUserName = isCompanyOverview
    ? "Company overview"
    : data?.selected_user?.full_name || "Select an employee";

  const kpiTrends = useMemo(() => {
    const allItems = [...(data?.tasks || []), ...(data?.tickets || [])];
    const dateKeys = Array.from(
      new Set(allItems.map(getItemDateKey).filter(Boolean)),
    ).sort();
    const currentKey = dateKeys[dateKeys.length - 1] || "";
    const previousKey = dateKeys[dateKeys.length - 2] || "";
    const currentTasks = (data?.tasks || []).filter(
      (item) => getItemDateKey(item) === currentKey,
    );
    const previousTasks = (data?.tasks || []).filter(
      (item) => getItemDateKey(item) === previousKey,
    );
    const currentTickets = (data?.tickets || []).filter(
      (item) => getItemDateKey(item) === currentKey,
    );
    const previousTickets = (data?.tickets || []).filter(
      (item) => getItemDateKey(item) === previousKey,
    );

    const latestActivity = chartData[chartData.length - 1];
    const previousActivity = chartData[chartData.length - 2];

    return {
      totalTasks: latestActivity
        ? makeTrend(
            Number(latestActivity.tasks || 0),
            Number(previousActivity?.tasks || 0),
          )
        : getTrendFromItems(currentTasks, previousTasks, () => true),
      openTickets: latestActivity
        ? makeTrend(
            Number(latestActivity.tickets || 0),
            Number(previousActivity?.tickets || 0),
          )
        : getTrendFromItems(currentTickets, previousTickets, () => true),
      overdueWork: getTrendFromItems(
        [...currentTasks, ...currentTickets],
        [...previousTasks, ...previousTickets],
        isWorkItemOverdue,
      ),
      blockedTasks: getTrendFromItems(
        currentTasks,
        previousTasks,
        (item) =>
          item.is_blocked ||
          String(item.status || "").toLowerCase() === "blocked",
      ),
    };
  }, [chartData, data?.tasks, data?.tickets]);

  const metricCards = useMemo(
    () => [
      {
        title: "Total Tasks",
        value: data?.stats.total_tasks || 0,
        subtitle: `${data?.stats.completed_tasks || 0} completed`,
        icon: CheckSquare,
        trend: kpiTrends.totalTasks,
        tone: "primary" as const,
      },
      {
        title: "Open Tickets",
        value: data?.stats.open_tickets || 0,
        subtitle: `${data?.stats.resolved_tickets || 0} resolved`,
        icon: Ticket,
        trend: kpiTrends.openTickets,
        tone: "accent" as const,
      },
      {
        title: "Overdue",
        value: [...(data?.tasks || []), ...(data?.tickets || [])].filter(
          isWorkItemOverdue,
        ).length,
        subtitle: "past due date",
        icon: Clock3,
        trend: kpiTrends.overdueWork,
        tone: "muted" as const,
      },
      {
        title: "Blocked Tasks",
        value: data?.stats.blocked_tasks || 0,
        subtitle: "needs attention",
        icon: AlertTriangle,
        trend: kpiTrends.blockedTasks,
        tone: "danger" as const,
      },
    ],
    [data?.stats, kpiTrends],
  );

  async function loadOverview(options?: {
    teamId?: string;
    userId?: string;
    projectId?: string;
    soft?: boolean;
    companyMode?: boolean;
  }) {
    try {
      if (options?.soft) setIsRefreshing(true);
      else setLoading(true);
      setError("");

      const session = getStoredSession();
      const companyId = session?.companyId || getStoredCompanyId();

      if (!session || !["business_owner", "admin"].includes(session.role)) {
        throw new Error(
          "Only admins and business owners can view company overview",
        );
      }

      if (!companyId) {
        throw new Error("Company setup is missing");
      }

      const params = new URLSearchParams({ companyId: String(companyId) });
      if (options?.teamId) params.set("teamId", options.teamId);
      if (options?.userId) params.set("userId", options.userId);
      if (options?.projectId && options.projectId !== "all")
        params.set("projectId", options.projectId);

      const response = await fetch(
        `/api/company-overview?${params.toString()}`,
        {
          cache: "no-store",
          headers: {
            "x-user-role": session.role,
          },
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Failed to load overview");
      }

      setData(result);

      if (options?.companyMode) {
        setOverviewScope("company");
        setSelectedTeamId("");
        setSelectedUserId("");
        return;
      }

      setOverviewScope("employee");

      const nextTeamId = String(
        result.selected_team_id ||
          options?.teamId ||
          result.teams?.[0]?.id ||
          "",
      );
      const nextUserId = String(
        result.selected_user?.id ||
          options?.userId ||
          result.teams?.[0]?.members?.[0]?.id ||
          "",
      );

      setSelectedTeamId(nextTeamId);
      setSelectedUserId(nextUserId);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to load overview",
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadOverview({ companyMode: true });

    // Auto-refresh every 30 seconds so graphs update live
    const refreshInterval = setInterval(() => {
      loadOverview({ companyMode: true, soft: true });
    }, 30000);

    const handleFocus = () => loadOverview({ companyMode: true, soft: true });
    const handleVisibility = () => {
      if (!document.hidden) loadOverview({ companyMode: true, soft: true });
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  function handleTeamChange(teamId: string) {
    setOverviewScope("employee");
    const team = data?.teams.find((item) => String(item.id) === teamId);
    const firstMemberId = team?.members?.[0]?.id
      ? String(team.members[0].id)
      : "";

    setSelectedTeamId(teamId);
    setSelectedUserId(firstMemberId);
    loadOverview({
      teamId,
      userId: firstMemberId,
      projectId: selectedProjectId,
      soft: true,
    });
  }

  function handleUserChange(userId: string) {
    setOverviewScope("employee");
    setSelectedUserId(userId);
    loadOverview({
      teamId: selectedTeamId,
      userId,
      projectId: selectedProjectId,
      soft: true,
    });
  }

  function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId);
    loadOverview({
      teamId: isCompanyOverview ? "" : selectedTeamId,
      userId: isCompanyOverview ? "" : selectedUserId,
      projectId,
      soft: true,
      companyMode: isCompanyOverview,
    });
  }

  function handleCompanyOverview() {
    setOverviewScope("company");
    setSelectedTeamId("");
    setSelectedUserId("");
    loadOverview({
      projectId: selectedProjectId,
      soft: true,
      companyMode: true,
    });
  }

  return (
    <DashboardLayout
      title="Company Overview"
      subtitle="Advanced team and work overview for admins and business owners."
    >
      <VoltPageTour
        storageKey="volt-company-overview-tour-seen"
        steps={[
          {
            title: "Welcome to Company Overview ⚡",
            description: "This is the admin view of your whole company. See task and ticket stats, team performance, and live charts across every project.",
            image: "/volty/step-1-welcome.png",
            placement: "center",
          },
          {
            title: "KPI Cards",
            description: "The top cards show total tasks, tickets, completion rates and activity trends. They update live as your team works.",
            target: "[data-tour=\"co-kpi-cards\"]",
            placement: "bottom",
            mascotSide: "right",
            image: "/volty/step-3-dashboards.png",
          },
          {
            title: "Filter by Team or Employee",
            description: "Use the Team and Employee dropdowns to drill into a specific person or group and see their work breakdown in detail.",
            target: "[data-tour=\"co-filters\"]",
            placement: "bottom",
            mascotSide: "left",
            image: "/volty/step-4-plan-upgrade.png",
          },
          {
            title: "Activity Charts",
            description: "The activity graph shows work over time. Switch between daily, weekly and monthly views to understand team output.",
            target: "[data-tour=\"co-charts\"]",
            placement: "top",
            mascotSide: "right",
            image: "/volty/step-5-build-dashboard.png",
          },
          {
            title: "All set!",
            description: "The overview refreshes every 30 seconds automatically. Keep this open to watch your team work in real time.",
            image: "/volty/step-6-goodbye.png",
            placement: "center",
          },
        ]}
      />
      <style jsx global>{`
        .company-overview-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .company-overview-scroll::-webkit-scrollbar-track {
          background: rgba(148, 163, 184, 0.12);
          border-radius: 2px;
        }

        .company-overview-scroll::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.55);
          border-radius: 2px;
          border: 2px solid rgba(15, 23, 42, 0.08);
        }

        .company-overview-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.78);
        }

        .company-overview-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.65) rgba(148, 163, 184, 0.12);
        }

        @keyframes overview-soft-refresh {
          0% {
            opacity: 0.78;
            transform: translateY(3px) scale(0.995);
            filter: blur(1px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        .overview-refresh-in {
          animation: overview-soft-refresh 420ms ease-out both;
        }

        @keyframes overview-progress-fill {
          0% {
            width: 0%;
            opacity: 0.75;
          }
          100% {
            width: var(--target-width);
            opacity: 1;
          }
        }

        @keyframes overview-progress-shine {
          0% {
            transform: translateX(-120%);
            opacity: 0;
          }
          35% {
            opacity: 0.65;
          }
          100% {
            transform: translateX(120%);
            opacity: 0;
          }
        }

        .overview-progress-pill {
          width: var(--target-width);
          animation: overview-progress-fill 850ms cubic-bezier(0.16, 1, 0.3, 1)
            both;
        }

        .overview-progress-pill::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.58),
            transparent
          );
          animation: overview-progress-shine 950ms ease-out 120ms both;
        }
      `}</style>

      {error && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-card flex items-center gap-3 p-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading company overview...
        </div>
      ) : data ? (
        <div className={cn("space-y-5", isRefreshing && "overview-refresh-in")}>
          <div data-tour="co-kpi-cards" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metricCards.map((card) => (
              <KpiCard
                key={card.title}
                title={card.title}
                value={card.value}
                icon={card.icon}
                trend={card.trend}
                tone={card.tone}
              />
            ))}
          </div>

          <section className="glass-card rounded-2xl border border-border/70 p-4">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-black text-foreground">
                  Tasks & Tickets Activity
                </h2>
                <p className="text-xs text-muted-foreground">
                  Activity for{" "}
                  <span className="font-bold text-foreground">
                    {selectedUserName}
                  </span>
                  .
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {rangeOptions.map((item) => (
                  <Button
                    key={item}
                    size="sm"
                    variant={range === item ? "default" : "outline"}
                    onClick={() => setRange(item)}
                    className={cn(
                      "h-8 rounded-lg px-3 text-xs font-bold",
                      softCardMotion,
                    )}
                  >
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.5fr_0.85fr]">
              <div className="rounded-2xl border border-border/60 bg-muted/10 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-bold text-foreground">Trend</p>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Tasks vs tickets
                  </span>
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 14, left: -18, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.28} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        cursor={{ opacity: 0.12 }}
                        contentStyle={{
                          borderRadius: "14px",
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--background))",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="tasks"
                        name="Tasks"
                        stroke="var(--primary)"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="tickets"
                        name="Tickets"
                        stroke="var(--accent)"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="group rounded-2xl border border-border/60 bg-muted/10 p-3 transition-all duration-300 hover:border-primary/30 hover:bg-muted/15 hover:shadow-lg hover:shadow-primary/5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-foreground">
                    Work split
                  </p>

                  <div className="flex rounded-full border border-border/70 bg-background/70 p-1">
                    {(["tasks", "tickets"] as PieMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPieMode(mode)}
                        className={cn(
                          "rounded-full px-3 py-1 text-[11px] font-black capitalize transition-all duration-300",
                          pieMode === mode
                            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid min-h-[260px] gap-3 md:grid-cols-[1fr_0.9fr] xl:grid-cols-1 2xl:grid-cols-[1fr_0.9fr]">
                  <div className="h-[230px] rounded-2xl border border-border/40 bg-background/35 p-2 transition-all duration-300 group-hover:bg-background/50">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <defs>
                          <linearGradient
                            id="pie-todo-gradient"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#22d3ee"
                              stopOpacity="0.95"
                            />
                            <stop
                              offset="100%"
                              stopColor="#06b6d4"
                              stopOpacity="0.72"
                            />
                          </linearGradient>
                          <linearGradient
                            id="pie-progress-gradient"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#a855f7"
                              stopOpacity="0.95"
                            />
                            <stop
                              offset="100%"
                              stopColor="#6366f1"
                              stopOpacity="0.76"
                            />
                          </linearGradient>
                          <linearGradient
                            id="pie-completed-gradient"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#4ade80"
                              stopOpacity="0.95"
                            />
                            <stop
                              offset="100%"
                              stopColor="#22c55e"
                              stopOpacity="0.76"
                            />
                          </linearGradient>
                          <linearGradient
                            id="pie-blocked-gradient"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#fb7185"
                              stopOpacity="0.92"
                            />
                            <stop
                              offset="100%"
                              stopColor="#f97316"
                              stopOpacity="0.78"
                            />
                          </linearGradient>
                        </defs>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={0}
                          outerRadius={82}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                          animationBegin={80}
                          animationDuration={850}
                          animationEasing="ease-out"
                          onMouseEnter={(_, index) => setActivePieIndex(index)}
                        >
                          {pieData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={entry.fill}
                              stroke={entry.stroke}
                              strokeWidth={activePieIndex === index ? 2.5 : 1.5}
                              className="cursor-pointer transition-all duration-300 outline-none"
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-col justify-between rounded-2xl border border-primary/15 bg-background/55 p-3 shadow-sm shadow-primary/5 transition-all duration-300 group-hover:border-primary/25 group-hover:bg-background/70">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        Selected split
                      </p>
                      <h3 className="mt-2 text-sm font-black text-foreground">
                        {activePieData?.name || "No data yet"}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        View {pieMode === "tasks" ? "task" : "ticket"} progress
                        from each work split here as you move through the chart.
                      </p>
                    </div>

                    <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            Count
                          </p>
                          <p className="text-3xl font-black leading-none text-foreground">
                            {activePieData?.value || 0}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            Share
                          </p>
                          <p className="text-lg font-black text-primary">
                            {activePiePercent}%
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted/70 p-[2px] shadow-inner">
                        <div
                          key={`${pieMode}-${activePieData?.name || "empty"}`}
                          className="overview-progress-pill relative h-full overflow-hidden rounded-full"
                          style={
                            {
                              "--target-width": `${activePiePercent}%`,
                              background:
                                activePieData?.bar || activePieData?.stroke,
                            } as CSSProperties
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="glass-card rounded-2xl border border-border/70 p-4">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Team Activity
                </div>
                <h2 className="text-base font-black text-foreground">
                  Team Activity
                </h2>
                <p className="text-xs text-muted-foreground">
                  View the full company first, then choose a team member to drill
                  into their work.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                <div className="mr-2 flex min-w-[220px] items-center gap-3 rounded-lg px-0 py-1 lg:-ml-4 lg:mr-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 via-accent/20 to-primary/10 text-xs font-black text-primary ring-1 ring-primary/30 shadow-sm shadow-primary/10">
                    {initials(selectedUserName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                      Viewing now
                    </p>
                    <h3 className="truncate text-sm font-black text-foreground">
                      {selectedUserName}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCompanyOverview}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-black transition-all duration-300 hover:-translate-y-0.5",
                    shineMotion,
                    isCompanyOverview
                      ? "border-primary/40 bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20"
                      : "border-primary/25 bg-primary/10 text-primary hover:border-primary/45 hover:bg-primary/15",
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Company dashboard
                </button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    loadOverview({
                      teamId: isCompanyOverview ? "" : selectedTeamId,
                      userId: isCompanyOverview ? "" : selectedUserId,
                      projectId: selectedProjectId,
                      soft: true,
                      companyMode: isCompanyOverview,
                    })
                  }
                  className={cn(
                    "h-9 rounded-lg px-3 text-xs font-bold",
                    softCardMotion,
                  )}
                >
                  {isRefreshing ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCcw className="mr-2 h-3.5 w-3.5" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-foreground">
                      Select team member
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Pick a team, then tick one employee from the clean list.
                    </p>
                  </div>
                  <Users className="h-4 w-4 text-primary" />
                </div>

                <CustomDropdown
                  label="Select team"
                  value={selectedTeamId}
                  placeholder="Select team"
                  options={teamOptions}
                  onChange={handleTeamChange}
                />

                <div className="company-overview-scroll mt-4 max-h-[180px] space-y-2 overflow-y-auto pr-1">
                  {selectedTeam?.members?.length ? (
                    selectedTeam.members.map((member) => {
                      const active =
                        !isCompanyOverview && selectedUserId === String(member.id);

                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleUserChange(String(member.id))}
                          className="group flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition-all duration-300 hover:translate-x-1"
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                              active
                                ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                                : "border-muted-foreground/45 bg-transparent text-transparent group-hover:border-primary/60 group-hover:text-primary",
                            )}
                          >
                            {active && <Check className="h-3 w-3" />}
                          </span>

                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-foreground">
                              {member.full_name}
                            </span>
                            <span className="block truncate text-[10px] capitalize text-muted-foreground">
                              {member.role?.replace("_", " ")}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      Select a team to view its employees.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-foreground">
                      Project filter
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Filter the company dashboard or selected employee by project.
                    </p>
                  </div>
                  <FolderKanban className="h-4 w-4 text-primary" />
                </div>

                <div className="company-overview-scroll max-h-[190px] overflow-y-auto pr-1">
                  <div className="space-y-2">
                    {projectOptions.map((project) => {
                      const active = selectedProjectId === project.value;

                      return (
                        <button
                          key={project.value}
                          type="button"
                          onClick={() => handleProjectChange(project.value)}
                          className={cn(
                            "group flex w-full items-center gap-3 rounded-full border px-3 py-2.5 text-left text-xs font-black transition-all duration-300 hover:translate-x-1",
                            shineMotion,
                            active
                              ? "border-primary/45 bg-gradient-to-r from-primary/95 to-accent/95 text-primary-foreground shadow-lg shadow-primary/15"
                              : "border-border/70 bg-background/55 text-foreground hover:border-primary/35 hover:bg-background/80",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                              active
                                ? "border-primary-foreground/80 bg-primary-foreground/20 text-primary-foreground"
                                : "border-muted-foreground/45 bg-transparent text-transparent group-hover:border-primary/60 group-hover:text-primary",
                            )}
                          >
                            {active && <Check className="h-3 w-3" />}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{project.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {!projectOptions.length && (
                    <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      No projects found yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <WorkList
              title={isCompanyOverview ? "Company Tasks" : "Employee Tasks"}
              subtitle={
                isCompanyOverview
                  ? "All company tasks with the selected project filter."
                  : "Filtered tasks for the selected employee."
              }
              icon={CheckCircle2}
              items={data.tasks}
              filter={taskFilter}
              filters={taskFilters}
              onFilterChange={setTaskFilter}
              emptyLabel="No tasks found"
            />

            <WorkList
              title={isCompanyOverview ? "Company Tickets" : "Employee Tickets"}
              subtitle={
                isCompanyOverview
                  ? "All company tickets with the selected project filter."
                  : "Filtered tickets for the selected employee."
              }
              icon={Ticket}
              items={data.tickets}
              filter={ticketFilter}
              filters={ticketFilters}
              onFilterChange={setTicketFilter}
              emptyLabel="No tickets found"
            />
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
