"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Task } from "@/components/tasks/task-card";
import { Button } from "@/components/ui/button";
import { VoltPageTour } from "@/components/tours/VoltPageTour";
import { cn } from "@/lib/utils";
import { getStoredCompanyId } from "@/lib/tenant";
import { getStoredSession } from "@/lib/auth";
import {
  Plus,
  Loader2,
  X,
  ChevronDown,
  Check,
  User,
  Users,
  AlertTriangle,
  CalendarDays,
  Circle,
  Clock3,
  CheckCircle2,
  Ban,
  FolderKanban,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Trophy,
  Star,
  TrendingUp,
  Trash2,
  Pencil,
  Save,
  CalendarX,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";

type TeamMember = {
  id: number;
  fullName: string;
  email: string;
  role: string;
};

type ProjectOption = {
  id: string;
  name: string;
  description: string;
};

type NewTaskForm = {
  title: string;
  description: string;
  status: "todo" | "in-progress" | "rollover" | "completed" | "blocked";
  priority: "low" | "medium" | "high";
  assignmentType: "personal" | "assigned";
  assignedToUserId: string;
  assignedToUserIds: string[];
  projectId: string;
  dueDate: string;
  tags: string;
  isBlocked: boolean;
  blockReason: string;
};

type DropdownOption = {
  value: string;
  label: string;
};

type CustomDropdownProps = {
  label: string;
  value: string;
  placeholder: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  menuDirection?: "down" | "up";
};

type BoardFilter = "all" | "low" | "medium" | "high" | "blocked";
type TaskScopeFilter = "todo" | "in-progress" | "rollover" | "completed";
type SortOption = "newest" | "dueDate" | "priority" | "title";
type EditTaskForm = Pick<
  NewTaskForm,
  | "title"
  | "description"
  | "priority"
  | "dueDate"
  | "tags"
  | "isBlocked"
  | "blockReason"
  | "projectId"
  | "assignmentType"
> & {
  assignedToUserIds: string[];
};

type CompletionToast = {
  taskTitle: string;
  xpGained: number;
  totalXp: number;
  level: number;
  levelProgress: number;
  achievements: string[];
};

type ExtendedTask = Task & {
  dueDateRaw?: string | null;
  projectName?: string | null;
  assignedToUserIds?: string[];
  assignedUsers?: {
    id: number;
    fullName: string;
    name: string;
  }[];
  blockReason?: string;
  isBlocked?: boolean;
};

type StoredAchievementProgress = {
  totalXp: number;
  earnedXp: number;
  overduePenaltyXp: number;
  completedTaskIds: string[];
  recentAchievements: string[];
  lastCompletedTaskTitle?: string;
  lastUpdatedAt: string;
};

const XP_STORAGE_KEY = "volt-task-xp-total";
const ACHIEVEMENT_PROGRESS_STORAGE_PREFIX = "volt-achievement-progress";
const LEVEL_XP_TARGET = 250;

function getAchievementProgressStorageKey(
  session?: { companyId?: unknown; userId?: unknown; email?: string } | null,
) {
  return `${ACHIEVEMENT_PROGRESS_STORAGE_PREFIX}-${
    session?.companyId || "global"
  }-${session?.userId || session?.email || "user"}`;
}

function readStoredAchievementProgress(key: string): StoredAchievementProgress {
  if (typeof window === "undefined") {
    return {
      totalXp: 0,
      earnedXp: 0,
      overduePenaltyXp: 0,
      completedTaskIds: [],
      recentAchievements: [],
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  try {
    const stored = window.localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : null;

    return {
      totalXp: Number(parsed?.totalXp ?? parsed?.earnedXp ?? 0),
      earnedXp: Number(parsed?.earnedXp ?? parsed?.totalXp ?? 0),
      overduePenaltyXp: Number(parsed?.overduePenaltyXp || 0),
      completedTaskIds: Array.isArray(parsed?.completedTaskIds)
        ? parsed.completedTaskIds
        : [],
      recentAchievements: Array.isArray(parsed?.recentAchievements)
        ? parsed.recentAchievements
        : [],
      lastCompletedTaskTitle: parsed?.lastCompletedTaskTitle,
      lastUpdatedAt: parsed?.lastUpdatedAt || new Date().toISOString(),
    };
  } catch {
    return {
      totalXp: 0,
      earnedXp: 0,
      overduePenaltyXp: 0,
      completedTaskIds: [],
      recentAchievements: [],
      lastUpdatedAt: new Date().toISOString(),
    };
  }
}

function saveStoredAchievementProgress(
  key: string,
  progress: StoredAchievementProgress,
) {
  window.localStorage.setItem(key, JSON.stringify(progress));
  window.dispatchEvent(
    new CustomEvent("volt-achievement-progress-updated", {
      detail: progress,
    }),
  );
}

function getXpForTask(task: Task) {
  const priority = getTaskText(task, "priority") || "medium";

  if (priority === "high") return 80;
  if (priority === "low") return 30;

  return 50;
}

function getLevelProgress(totalXp: number) {
  const level = Math.floor(totalXp / LEVEL_XP_TARGET) + 1;
  const levelProgress = Math.round(
    ((totalXp % LEVEL_XP_TARGET) / LEVEL_XP_TARGET) * 100,
  );

  return {
    level,
    levelProgress,
  };
}

function getTaskAchievements(task: Task, completedCount: number) {
  const achievements: string[] = [];
  const priority = getTaskText(task, "priority") || "medium";

  if (completedCount === 1) achievements.push("First task completed");
  if (completedCount === 5) achievements.push("5 task streak unlocked");
  if (completedCount === 10) achievements.push("10 completed tasks");
  if (priority === "high") achievements.push("High priority finisher");
  if (isProjectTask(task)) achievements.push("Project progress updated");

  return achievements.length ? achievements : ["Progress saved"];
}

const emptyForm: NewTaskForm = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  assignmentType: "assigned",
  assignedToUserId: "",
  assignedToUserIds: [],
  projectId: "",
  dueDate: "",
  tags: "",
  isBlocked: false,
  blockReason: "",
};

const softButtonMotion =
  "transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.015] active:translate-y-0 active:scale-[0.98]";

const shineMotion =
  "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:bg-foreground/10 before:transition-transform before:duration-700 hover:before:translate-x-full";

const pulseMotion =
  "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0";

const boardTabs: {
  value: BoardFilter;
  label: string;
  icon: ElementType;
}[] = [
  { value: "all", label: "All", icon: Circle },
  { value: "low", label: "Low", icon: Circle },
  { value: "medium", label: "Medium", icon: Clock3 },
  { value: "high", label: "High", icon: AlertTriangle },
  { value: "blocked", label: "Blocked", icon: Ban },
];

const scopeFilters: {
  value: TaskScopeFilter;
  title: string;
  description: string;
  icon: ElementType;
}[] = [
  {
    value: "todo",
    title: "To Do",
    description: "Tasks ready to start",
    icon: Circle,
  },
  {
    value: "in-progress",
    title: "In Progress",
    description: "Tasks currently being worked on",
    icon: Clock3,
  },
  {
    value: "rollover",
    title: "Rollover",
    description: "Tasks carried into the next work cycle",
    icon: RefreshCw,
  },
  {
    value: "completed",
    title: "Completed",
    description: "Finished tasks and done work",
    icon: CheckCircle2,
  },
];
function CustomDropdown({
  label,
  value,
  placeholder,
  options,
  onChange,
  menuDirection = "down",
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="relative space-y-1">
      {label && (
        <label className="text-sm font-semibold text-foreground">{label}</label>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-3 text-left text-sm outline-none transition",
          "hover:border-primary/60 hover:bg-muted/40",
          open && "border-primary ring-2 ring-primary/10",
        )}
      >
        <span
          className={cn(
            "truncate",
            selectedOption ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180 text-primary",
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 max-h-44 w-full overflow-y-auto rounded-lg border border-border bg-background p-1 shadow-2xl volt-scrollbar",
            menuDirection === "up" ? "bottom-full mb-1" : "mt-1",
          )}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "w-full rounded-md px-2.5 py-1.5 text-left text-sm transition",
                value === option.value
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getTaskValue(task: Task, key: string) {
  return (task as unknown as Record<string, unknown>)[key];
}

function getTaskText(task: Task, key: string) {
  const value = getTaskValue(task, key);

  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);

  return "";
}

function getTaskNumber(task: Task, key: string) {
  const value = getTaskValue(task, key);

  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);

  return null;
}

function getTaskDateTime(task: Task, key: string) {
  const value = getTaskValue(task, key);

  if (!value) return 0;

  const date = new Date(String(value)).getTime();

  return Number.isNaN(date) ? 0 : date;
}

function formatDate(value: unknown) {
  if (!value) return "No due date";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) return "No due date";

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name: string) {
  if (!name.trim()) return "U";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getAssignedName(task: Task, members: TeamMember[]) {
  const possibleName =
    getTaskText(task, "assignedToName") ||
    getTaskText(task, "assignedToUserName") ||
    getTaskText(task, "assignedToFullName") ||
    getTaskText(task, "assigneeName");

  if (possibleName) return possibleName;

  const assignedId = getTaskNumber(task, "assignedToUserId");
  const foundMember = members.find((member) => member.id === assignedId);

  return foundMember?.fullName || "Unassigned";
}

function getAssignedUsers(task: Task, members: TeamMember[]) {
  const directUsers = getTaskValue(task, "assignedUsers");

  if (Array.isArray(directUsers) && directUsers.length > 0) {
    return directUsers
      .map((user) => {
        const record = user as Record<string, unknown>;
        const id = Number(record.id ?? record.userId ?? record.user_id ?? 0);
        const name = String(
          record.fullName ?? record.full_name ?? record.name ?? "",
        ).trim();

        if (!id && !name) return null;

        return {
          id,
          fullName:
            name ||
            members.find((member) => member.id === id)?.fullName ||
            "User",
        };
      })
      .filter(Boolean) as { id: number; fullName: string }[];
  }

  const assignedUserIds = getTaskValue(task, "assignedToUserIds");

  if (Array.isArray(assignedUserIds) && assignedUserIds.length > 0) {
    return assignedUserIds
      .map((value) => Number(value))
      .filter(Boolean)
      .map((id) => ({
        id,
        fullName:
          members.find((member) => member.id === id)?.fullName || "User",
      }));
  }

  const assignedIdsText = getTaskText(task, "assignedUserIds");

  if (assignedIdsText) {
    return assignedIdsText
      .split(",")
      .map((value) => Number(value.trim()))
      .filter(Boolean)
      .map((id) => ({
        id,
        fullName:
          members.find((member) => member.id === id)?.fullName || "User",
      }));
  }

  const singleId = getTaskNumber(task, "assignedToUserId");
  const singleName = getAssignedName(task, members);

  return singleId ? [{ id: singleId, fullName: singleName }] : [];
}

function getAssignedUserIds(task: Task, members: TeamMember[]) {
  const users = getAssignedUsers(task, members);

  return users.length
    ? users.map((user) => String(user.id))
    : getTaskNumber(task, "assignedToUserId")
      ? [String(getTaskNumber(task, "assignedToUserId"))]
      : [];
}

function getAssignedDisplay(task: Task, members: TeamMember[]) {
  const users = getAssignedUsers(task, members);

  if (users.length === 0) return "Unassigned";
  if (users.length === 1) return users[0].fullName;

  return `${users[0].fullName} +${users.length - 1}`;
}

function getProjectName(task: Task, projects: ProjectOption[]) {
  const possibleName =
    getTaskText(task, "projectName") || getTaskText(task, "projectTitle");

  if (possibleName) return possibleName;

  const projectId = getTaskText(task, "projectId");
  const foundProject = projects.find((project) => project.id === projectId);

  return foundProject?.name || "";
}

function getTaskCode(task: Task) {
  const existingCode =
    getTaskText(task, "taskCode") ||
    getTaskText(task, "task_code") ||
    getTaskText(task, "taskNumber") ||
    getTaskText(task, "task_number");

  if (existingCode) {
    const numericPart = existingCode.match(/\d+/)?.[0];

    if (numericPart) {
      return `ID ${String(Number(numericPart)).padStart(3, "0")}`;
    }

    return `ID ${existingCode.replace(/[^a-zA-Z0-9]/g, "").slice(-3).toUpperCase()}`;
  }

  const idText = String(task.id || "").trim();
  const numericPart = idText.match(/\d+/)?.[0];

  if (numericPart) {
    return `ID ${String(Number(numericPart)).padStart(3, "0")}`;
  }

  const fallback = idText.replace(/[^a-zA-Z0-9]/g, "").slice(-3).toUpperCase();

  return `ID ${fallback || "001"}`;
}

function isProjectTask(task: Task) {
  return Boolean(getTaskText(task, "projectId"));
}

function isTaskDeleted(task: Task) {
  const deletedValue =
    getTaskValue(task, "isDeleted") ?? getTaskValue(task, "deleted");

  return deletedValue === true || String(deletedValue).toLowerCase() === "true";
}

function isTaskCompleted(task: Task) {
  return (
    task.status === "completed" || String(task.status).toLowerCase() === "done"
  );
}

function getDueDateMs(task: Task) {
  const dueDate =
    getTaskValue(task, "dueDate") || getTaskValue(task, "due_date");

  if (!dueDate) return null;

  const date = new Date(String(dueDate));

  if (Number.isNaN(date.getTime())) return null;

  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function getOverdueDays(task: Task) {
  if (isTaskCompleted(task) || isTaskDeleted(task)) return 0;

  const dueMs = getDueDateMs(task);

  if (!dueMs) return 0;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const startOfDue = new Date(dueMs);
  startOfDue.setHours(0, 0, 0, 0);

  const diff = now.getTime() - startOfDue.getTime();

  if (diff <= 0) return 0;

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function isTaskOverdue(task: Task) {
  return getOverdueDays(task) > 0;
}

function getOverduePenalty(tasks: Task[]) {
  return tasks
    .filter((task) => !isTaskDeleted(task))
    .reduce((total, task) => total + getOverdueDays(task) * 10, 0);
}

function StatusActionButton({
  children,
  onClick,
  variant = "primary",
  size = "normal",
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "muted" | "success" | "danger";
  size?: "normal" | "small";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-lg border text-[11px] font-bold transition-all duration-300",
        "before:absolute before:inset-0 before:-translate-x-full before:bg-foreground/10 before:transition-transform before:duration-700 hover:before:translate-x-full",
        "hover:-translate-y-0.5 hover:scale-[1.015] hover:shadow-md active:translate-y-0 active:scale-[0.98]",
        size === "small"
          ? "flex h-8 items-center justify-center gap-1.5 px-2.5"
          : "flex h-9 items-center justify-center gap-1.5 px-3",
        variant === "primary" &&
          "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 hover:shadow-primary/10",
        variant === "success" &&
          "border-primary/40 bg-primary/15 text-primary hover:bg-primary/20 hover:shadow-primary/10",
        variant === "muted" &&
          "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground",
        variant === "danger" &&
          "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
      )}
    >
      <span className="relative flex items-center gap-2">{children}</span>
    </button>
  );
}

function IconCardAction({
  label,
  icon: Icon,
  onClick,
  tone = "muted",
}: {
  label: string;
  icon: ElementType;
  onClick: () => void;
  tone?: "muted" | "danger";
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur transition-all duration-200",
        "hover:-translate-y-0.5 hover:scale-105 active:translate-y-0 active:scale-95",
        tone === "danger"
          ? "border-destructive/25 bg-destructive/10 text-destructive hover:border-destructive/50 hover:bg-destructive/15"
          : "border-border/70 bg-background/65 text-muted-foreground hover:border-accent/40 hover:bg-accent/10 hover:text-accent",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function CleanTaskCard({
  task,
  members,
  projects,
  onStatusChange,
  onSoftDelete,
  onEdit,
  isAnimating,
  isOverdueTask,
  overdueDays,
}: {
  task: Task;
  members: TeamMember[];
  projects: ProjectOption[];
  onStatusChange: (id: string, status: Task["status"]) => void;
  onSoftDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
  isAnimating?: boolean;
  isOverdueTask?: boolean;
  overdueDays?: number;
}) {
  const description = getTaskText(task, "description");
  const blockReason = getTaskText(task, "blockReason");
  const priority = getTaskText(task, "priority") || "medium";
  const dueDate = getTaskValue(task, "dueDate");
  const assignedName = getAssignedDisplay(task, members);
  const assignedUsers = getAssignedUsers(task, members);
  const projectName = getProjectName(task, projects);
  const canDelete =
    task.status === "todo" ||
    task.status === "in-progress" ||
    task.status === "blocked";
  const isBlocked =
    task.status === "blocked" || Boolean(getTaskValue(task, "isBlocked"));

  return (
    <div
      className={cn(
        "glass-card relative rounded-2xl border p-3.5 transition hover:-translate-y-0.5 hover:shadow-lg",
        isOverdueTask
          ? "border-destructive/60 bg-destructive/10 shadow-destructive/10 hover:border-destructive/70 hover:bg-destructive/15 hover:shadow-destructive/20"
          : "border-border/70 hover:border-primary/40",
        isAnimating &&
          "pointer-events-none animate-task-clean-exit border-accent/50 shadow-xl",
      )}
    >
      {isAnimating && (
        <>
          <div className="task-transfer-glow pointer-events-none absolute inset-0 z-10 rounded-2xl" />
          <div className="task-transfer-sparkle pointer-events-none absolute right-5 top-5 z-20" />
        </>
      )}

      <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
            priority === "high" && "bg-destructive/10 text-destructive",
            priority === "medium" && "bg-primary/10 text-primary",
            priority === "low" && "bg-muted text-muted-foreground",
          )}
        >
          {priority}
        </span>

        <IconCardAction
          label="Edit task"
          icon={Pencil}
          onClick={() => onEdit(task)}
        />
        {canDelete && (
          <IconCardAction
            label="Delete task"
            icon={Trash2}
            tone="danger"
            onClick={() => onSoftDelete(task)}
          />
        )}
      </div>

      {isOverdueTask && (
        <div className="mb-2.5 mr-20 flex items-center rounded-xl border border-destructive/40 bg-destructive/15 px-3 py-2 text-destructive">
          <CalendarX className="mr-2 h-4 w-4" />
          <span className="text-[11px] font-black uppercase tracking-wide">
            Overdue by {overdueDays || 1} day
            {(overdueDays || 1) === 1 ? "" : "s"}
          </span>
        </div>
      )}

      <div className="mb-2.5 flex items-start gap-3 pr-[100px] sm:pr-[150px]">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            {getTaskCode(task)}
          </div>

          <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground">
            {task.title}
          </h3>

          {projectName && (
            <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
              {projectName}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/25 p-2.5">
        <p
          className={cn(
            "line-clamp-3 text-[13px] leading-relaxed",
            description ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {description || "No description added."}
        </p>
      </div>

      {isBlocked && (
        <div className="mt-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-[11px] font-bold uppercase tracking-wide">
              Block Reason
            </span>
          </div>

          <p className="line-clamp-3 text-sm leading-relaxed text-destructive">
            {blockReason || "No block reason added."}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              isOverdueTask
                ? "bg-destructive/15 text-destructive"
                : "bg-primary/10 text-primary",
            )}
          >
            {getInitials(assignedName)}
          </div>

          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {assignedName}
            </p>
            {assignedUsers.length > 1 && (
              <p className="truncate text-[11px] font-medium text-muted-foreground">
                {assignedUsers.map((user) => user.fullName).join(", ")}
              </p>
            )}

            <p
              className={cn(
                "flex items-center gap-1.5 text-sm font-bold",
                isOverdueTask ? "text-destructive" : "text-foreground/80",
              )}
            >
              <CalendarDays
                className={cn(
                  "h-4 w-4",
                  isOverdueTask ? "text-destructive" : "text-primary",
                )}
              />
              {formatDate(dueDate)}
            </p>
          </div>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
            isOverdueTask &&
              "bg-destructive/15 text-destructive ring-1 ring-destructive/25",
            !isOverdueTask &&
              task.status === "todo" &&
              "bg-muted text-muted-foreground",
            !isOverdueTask &&
              task.status === "in-progress" &&
              "bg-primary/10 text-primary",
            !isOverdueTask &&
              task.status === "blocked" &&
              "bg-destructive/10 text-destructive",
            !isOverdueTask &&
              task.status === "rollover" &&
              "bg-accent/10 text-accent",
            !isOverdueTask &&
              task.status === "completed" &&
              "bg-primary/10 text-primary",
          )}
        >
          {isOverdueTask
            ? "Overdue"
            : task.status === "todo"
              ? "To Do"
              : task.status === "in-progress"
                ? "In Progress"
                : task.status === "blocked"
                  ? "Blocked"
                  : task.status === "rollover"
                    ? "Rollover"
                    : "Completed"}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {task.status === "todo" && (
          <StatusActionButton
            onClick={() => onStatusChange(task.id, "in-progress")}
            variant="primary"
            size="small"
          >
            Start
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </StatusActionButton>
        )}

        {task.status === "in-progress" && (
          <>
            <StatusActionButton
              onClick={() => onStatusChange(task.id, "rollover")}
              variant="muted"
              size="small"
            >
              <RefreshCw className="h-3.5 w-3.5 transition group-hover:rotate-180" />
              Rollover
            </StatusActionButton>

            <StatusActionButton
              onClick={() => onStatusChange(task.id, "completed")}
              variant="success"
            >
              Complete
              <CheckCircle2 className="h-4 w-4 transition group-hover:scale-110" />
            </StatusActionButton>
          </>
        )}

        {task.status === "rollover" && (
          <>
            <StatusActionButton
              onClick={() => onStatusChange(task.id, "todo")}
              variant="muted"
              size="small"
            >
              <RotateCcw className="h-3.5 w-3.5 transition group-hover:-rotate-12" />
              To Do
            </StatusActionButton>

            <StatusActionButton
              onClick={() => onStatusChange(task.id, "in-progress")}
              variant="primary"
              size="small"
            >
              Start
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </StatusActionButton>

            <StatusActionButton
              onClick={() => onStatusChange(task.id, "completed")}
              variant="success"
              size="small"
            >
              Complete
              <CheckCircle2 className="h-3.5 w-3.5 transition group-hover:scale-110" />
            </StatusActionButton>
          </>
        )}

        {task.status === "blocked" && (
          <>
            <StatusActionButton
              onClick={() => onStatusChange(task.id, "todo")}
              variant="muted"
              size="small"
            >
              <RotateCcw className="h-3.5 w-3.5 transition group-hover:-rotate-12" />
              To Do
            </StatusActionButton>

            <StatusActionButton
              onClick={() => onStatusChange(task.id, "in-progress")}
              variant="primary"
              size="small"
            >
              Start
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </StatusActionButton>

            <StatusActionButton
              onClick={() => onStatusChange(task.id, "completed")}
              variant="success"
              size="small"
            >
              Complete
              <CheckCircle2 className="h-3.5 w-3.5 transition group-hover:scale-110" />
            </StatusActionButton>
          </>
        )}

        {task.status === "completed" && (
          <StatusActionButton
            onClick={() => onStatusChange(task.id, "todo")}
            variant="muted"
            size="small"
          >
            <RotateCcw className="h-3.5 w-3.5 transition group-hover:-rotate-12" />
            Reopen
          </StatusActionButton>
        )}
      </div>
    </div>
  );
}

function ScopeHoverAnimation({
  active,
}: {
  type: TaskScopeFilter;
  active: boolean;
}) {
  return (
    <>
      <span
        className={cn(
          "pointer-events-none absolute inset-0 -translate-x-[120%] rounded-2xl",
          "bg-gradient-to-r from-transparent via-accent/18 to-transparent",
          "transition-transform duration-700 ease-out group-hover:translate-x-[120%]",
          active && "via-accent/25",
        )}
      />

      <span
        className={cn(
          "pointer-events-none absolute inset-x-4 bottom-0 h-[2px] origin-left scale-x-0 rounded-full",
          "bg-gradient-to-r from-accent/0 via-accent to-accent/0",
          "transition-transform duration-500 ease-out group-hover:scale-x-100",
          active && "scale-x-100",
        )}
      />

      <span
        className={cn(
          "pointer-events-none absolute right-4 top-3.5 h-2 w-2 rounded-full bg-accent",
          "opacity-0 shadow-[0_0_18px_hsl(var(--accent))] transition-all duration-300",
          "group-hover:scale-125 group-hover:opacity-80",
          active && "scale-125 opacity-80",
        )}
      />
    </>
  );
}

export default function TasksPage() {
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [projectMembers, setProjectMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [activeTab, setActiveTab] = useState<BoardFilter>("all");
  const [activeScope, setActiveScope] = useState<TaskScopeFilter>("todo");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTask, setNewTask] = useState<NewTaskForm>(emptyForm);
  const [mounted, setMounted] = useState(false);
  const [animatingTaskId, setAnimatingTaskId] = useState<string | null>(null);
  const [highlightedTab, setHighlightedTab] = useState<TaskScopeFilter | null>(
    null,
  );
  const [completionToast, setCompletionToast] =
    useState<CompletionToast | null>(null);
  const [toastProgressWidth, setToastProgressWidth] = useState(0);
  const [showOverduePanel, setShowOverduePanel] = useState(false);
  const [overdueFlashActive, setOverdueFlashActive] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<EditTaskForm | null>(null);

  const session = mounted ? getStoredSession() : null;
  const selectableMembers = newTask.projectId ? projectMembers : teamMembers;
  const createAssignedToUserIds = Array.isArray(newTask.assignedToUserIds)
    ? newTask.assignedToUserIds
    : [];
  const activeTasksForPenalty = tasks.filter((task) => !isTaskDeleted(task));
  const overdueTasks = activeTasksForPenalty.filter((task) =>
    isTaskOverdue(task),
  );
  const overduePenaltyXp = getOverduePenalty(activeTasksForPenalty);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Flash overdue tasks every 20 seconds when there are overdue tasks on the page
  useEffect(() => {
    if (overdueTasks.length === 0) return;
    const interval = window.setInterval(() => {
      setOverdueFlashActive(true);
      window.setTimeout(() => setOverdueFlashActive(false), 1200);
    }, 20000);
    return () => window.clearInterval(interval);
  }, [overdueTasks.length]);

  useEffect(() => {
    if (!completionToast) {
      setToastProgressWidth(0);
      return;
    }

    setToastProgressWidth(0);

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setToastProgressWidth(completionToast.levelProgress);
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [completionToast]);

  async function loadTasks() {
    try {
      setLoading(true);
      setError("");

      const companyId = getStoredCompanyId();

      if (!companyId) {
        router.push("/dashboards");
        return;
      }

      const urlProjectId =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("projectId")
          : "";

      const taskUrl = urlProjectId
        ? `/api/tasks?companyId=${companyId}&projectId=${urlProjectId}`
        : `/api/tasks?companyId=${companyId}`;

      const [tasksResponse, membersResponse, projectsResponse] =
        await Promise.all([
          fetch(taskUrl, { cache: "no-store" }),
          fetch(`/api/team-members?companyId=${companyId}`, {
            cache: "no-store",
          }),
          fetch(`/api/projects?companyId=${companyId}`, {
            cache: "no-store",
          }),
        ]);

      const tasksData = await tasksResponse.json().catch(() => null);
      const membersData = await membersResponse.json().catch(() => null);
      const projectsData = await projectsResponse.json().catch(() => null);

      if (!tasksResponse.ok) {
        throw new Error(
          tasksData?.details ||
            tasksData?.error ||
            "Unable to load tasks at this time.",
        );
      }

      if (!membersResponse.ok) {
        throw new Error(
          membersData?.details ||
            membersData?.error ||
            "Unable to load team members at this time.",
        );
      }

      if (!projectsResponse.ok) {
        throw new Error(
          projectsData?.details ||
            projectsData?.error ||
            "Unable to load projects at this time.",
        );
      }

      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setTeamMembers(Array.isArray(membersData) ? membersData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);

      if (urlProjectId) {
        setNewTask((prev) => ({
          ...prev,
          projectId: urlProjectId,
          assignmentType: "assigned",
        }));

        setSelectedProjectId(urlProjectId);
        setActiveScope("todo");
        setShowCreateTask(true);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "We could not load your tasks. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!mounted) return;

    loadTasks();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    async function loadProjectMembers() {
      try {
        const companyId = getStoredCompanyId();

        if (!companyId || !newTask.projectId) {
          setProjectMembers([]);
          return;
        }

        const response = await fetch(
          `/api/projects/${newTask.projectId}?companyId=${companyId}`,
          { cache: "no-store" },
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.error || "Unable to load members for this project.",
          );
        }

        setProjectMembers(Array.isArray(data.members) ? data.members : []);

        setNewTask((prev) => ({
          ...prev,
          assignedToUserId: "",
          assignedToUserIds: [],
        }));
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "We could not load the selected project's members.",
        );
      }
    }

    loadProjectMembers();
  }, [mounted, newTask.projectId]);

  useEffect(() => {
    if (!mounted) return;

    const activeSession = getStoredSession();
    const progressKey = getAchievementProgressStorageKey(activeSession);
    const currentProgress = readStoredAchievementProgress(progressKey);
    const earnedXp =
      currentProgress.earnedXp ??
      currentProgress.totalXp + currentProgress.overduePenaltyXp;
    const totalXp = Math.max(0, earnedXp - overduePenaltyXp);

    saveStoredAchievementProgress(progressKey, {
      ...currentProgress,
      earnedXp,
      overduePenaltyXp,
      totalXp,
      lastUpdatedAt: new Date().toISOString(),
    });

    window.localStorage.setItem(XP_STORAGE_KEY, String(totalXp));
  }, [mounted, overduePenaltyXp]);

  function openEditTask(task: Task) {
    setEditingTask(task);
    setEditTask({
      title: task.title || "",
      description: getTaskText(task, "description"),
      priority: (getTaskText(task, "priority") ||
        "medium") as NewTaskForm["priority"],
      dueDate:
        getTaskText(task, "dueDateRaw")?.slice(0, 10) ||
        getTaskText(task, "dueDate")?.slice(0, 10) ||
        "",
      tags: Array.isArray(getTaskValue(task, "tags"))
        ? (getTaskValue(task, "tags") as string[]).join(", ")
        : getTaskText(task, "tags"),
      isBlocked:
        task.status === "blocked" || Boolean(getTaskValue(task, "isBlocked")),
      blockReason: getTaskText(task, "blockReason"),
      projectId: getTaskText(task, "projectId"),
      assignmentType:
        getTaskText(task, "assignmentType") === "personal"
          ? "personal"
          : "assigned",
      assignedToUserIds: getAssignedUserIds(task, teamMembers),
    });
  }

  const handleSoftDelete = async (task: Task) => {
    if (
      !(
        task.status === "todo" ||
        task.status === "in-progress" ||
        task.status === "blocked"
      )
    ) {
      setError(
        "Completed tasks cannot be deleted here. Use Clear Done instead.",
      );
      return;
    }

    const oldTasks = tasks;
    setError("");
    setTasks((prev) =>
      prev.map((item) =>
        item.id === task.id
          ? ({
              ...item,
              isDeleted: true,
              deleted: true,
              deletedAt: new Date().toISOString(),
            } as Task)
          : item,
      ),
    );

    try {
      const companyId = getStoredCompanyId();

      if (!companyId) {
        router.push("/dashboards");
        return;
      }

      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-company-id": companyId,
        },
        body: JSON.stringify({
          id: task.id,
          isDeleted: true,
          deleted: true,
          deletedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.details || data?.error || "Unable to delete task.",
        );
      }
    } catch (error) {
      setTasks(oldTasks);
      setError(
        error instanceof Error
          ? error.message
          : "The task could not be deleted.",
      );
    }
  };

  const handleClearCompleted = async () => {
    const completedTasks = tasks.filter(
      (task) => task.status === "completed" && !isTaskDeleted(task),
    );

    if (!completedTasks.length) return;

    const oldTasks = tasks;

    try {
      setError("");

      const companyId = getStoredCompanyId();
      const activeSession = getStoredSession();

      if (!companyId) {
        router.push("/dashboards");
        return;
      }

      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-company-id": companyId,
        },
        body: JSON.stringify({
          action: "clear-completed",
          userId: activeSession?.userId || null,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.details || data?.error || "Unable to clear completed tasks.",
        );
      }

      setTasks((prev) => prev.filter((task) => task.status !== "completed"));
    } catch (error) {
      setTasks(oldTasks);
      setError(
        error instanceof Error
          ? error.message
          : "Completed tasks could not be cleared.",
      );
    }
  };

  function toggleEditAssignedUser(userId: string) {
    setEditTask((prev) => {
      if (!prev) return prev;

      const exists = prev.assignedToUserIds.includes(userId);
      const assignedToUserIds = exists
        ? prev.assignedToUserIds.filter((id) => id !== userId)
        : [...prev.assignedToUserIds, userId];

      return {
        ...prev,
        assignmentType: "assigned",
        assignedToUserIds,
      };
    });
  }

  const handleSaveEditTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingTask || !editTask) return;

    if (!editTask.title.trim()) {
      setError("Please enter a task title before saving.");
      return;
    }

    if (editTask.isBlocked && !editTask.blockReason.trim()) {
      setError("Please add a block reason before saving.");
      return;
    }

    if (
      editTask.assignmentType === "assigned" &&
      editTask.assignedToUserIds.length === 0
    ) {
      setError("Please select at least one user for this task.");
      return;
    }

    const oldTasks = tasks;
    const nextStatus = editTask.isBlocked
      ? "blocked"
      : editingTask.status === "blocked"
        ? "todo"
        : editingTask.status;

    setError("");
    setSaving(true);

    const updatedAssignedUsers = editTask.assignedToUserIds.map((userId) => {
      const member = teamMembers.find((item) => String(item.id) === userId);

      return {
        id: Number(userId),
        fullName: member?.fullName || "User",
        name: member?.fullName || "User",
      };
    });

    const selectedProject = projects.find(
      (project) => project.id === editTask.projectId,
    );

    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== editingTask.id) return task;

        const updatedTask: ExtendedTask = {
          ...task,
          title: editTask.title,
          description: editTask.description,
          priority: editTask.priority,
          dueDate: editTask.dueDate || undefined,
          dueDateRaw: editTask.dueDate || null,
          tags: editTask.tags
            ? editTask.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
            : [],
          projectId: editTask.projectId || null,
          projectName: selectedProject?.name || null,
          assignmentType: editTask.assignmentType,
          assignedToUserId: editTask.assignedToUserIds[0]
            ? Number(editTask.assignedToUserIds[0])
            : null,
          assignedToUserIds: editTask.assignedToUserIds,
          assignedUsers: updatedAssignedUsers,
          isBlocked: editTask.isBlocked,
          blockReason: editTask.isBlocked ? editTask.blockReason : "",
          status: nextStatus as Task["status"],
        };

        return updatedTask;
      }),
    );
    try {
      const companyId = getStoredCompanyId();

      if (!companyId) {
        router.push("/dashboards");
        return;
      }

      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-company-id": companyId,
        },
        body: JSON.stringify({
          id: editingTask.id,
          title: editTask.title,
          description: editTask.description,
          priority: editTask.priority,
          dueDate: editTask.dueDate || null,
          tags: editTask.tags,
          projectId: editTask.projectId || null,
          assignmentType: editTask.assignmentType,
          assignedToUserId: editTask.assignedToUserIds[0]
            ? Number(editTask.assignedToUserIds[0])
            : null,
          assignedToUserIds: editTask.assignedToUserIds.map((userId) =>
            Number(userId),
          ),
          isBlocked: editTask.isBlocked,
          blockReason: editTask.isBlocked ? editTask.blockReason : "",
          status: nextStatus,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.details || data?.error || "Unable to update task.",
        );
      }

      setEditingTask(null);
      setEditTask(null);
    } catch (error) {
      setTasks(oldTasks);
      setError(
        error instanceof Error
          ? error.message
          : "The task could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: Task["status"]) => {
    const oldTasks = tasks;

    setError("");
    setAnimatingTaskId(id);

    window.setTimeout(() => {
      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== id) return task;

          return {
            ...task,
            status,
          };
        }),
      );

      setAnimatingTaskId(null);
      if (
        status === "todo" ||
        status === "in-progress" ||
        status === "rollover" ||
        status === "completed"
      ) {
        setHighlightedTab(status);
      }

      window.setTimeout(() => {
        setHighlightedTab(null);
      }, 1800);

      if (status === "completed") {
        const completedTask = tasks.find((task) => task.id === id);

        if (completedTask) {
          const activeSession = getStoredSession();
          const progressKey = getAchievementProgressStorageKey(activeSession);
          const currentProgress = readStoredAchievementProgress(progressKey);
          const alreadyRewarded = currentProgress.completedTaskIds.includes(id);

          if (!alreadyRewarded) {
            const xpGained = getXpForTask(completedTask);
            const earnedXp =
              (currentProgress.earnedXp ??
                currentProgress.totalXp + currentProgress.overduePenaltyXp) +
              xpGained;
            const penaltyXp = getOverduePenalty(tasks);
            const totalXp = Math.max(0, earnedXp - penaltyXp);
            const { level, levelProgress } = getLevelProgress(totalXp);
            const completedCount = currentProgress.completedTaskIds.length + 1;
            const achievements = getTaskAchievements(
              completedTask,
              completedCount,
            );

            const nextProgress: StoredAchievementProgress = {
              totalXp,
              earnedXp,
              overduePenaltyXp: penaltyXp,
              completedTaskIds: [...currentProgress.completedTaskIds, id],
              recentAchievements: [
                ...achievements,
                ...currentProgress.recentAchievements,
              ].slice(0, 10),
              lastCompletedTaskTitle: completedTask.title,
              lastUpdatedAt: new Date().toISOString(),
            };

            saveStoredAchievementProgress(progressKey, nextProgress);

            // Legacy key kept so older pages/components still show the same XP.
            window.localStorage.setItem(XP_STORAGE_KEY, String(totalXp));

            setCompletionToast({
              taskTitle: completedTask.title,
              xpGained,
              totalXp,
              level,
              levelProgress,
              achievements,
            });

            window.setTimeout(() => {
              setCompletionToast(null);
              setToastProgressWidth(0);
            }, 3600);
          }
        }
      }
    }, 320);

    try {
      const companyId = getStoredCompanyId();

      if (!companyId) {
        router.push("/dashboards");
        return;
      }

      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-company-id": companyId,
        },
        body: JSON.stringify({
          id,
          status,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);

        throw new Error(
          data?.details || data?.error || "Unable to update task status.",
        );
      }
    } catch (error) {
      setTasks(oldTasks);
      setAnimatingTaskId(null);
      setHighlightedTab(null);
      setCompletionToast(null);

      setError(
        error instanceof Error
          ? error.message
          : "The task status could not be updated. Please try again.",
      );
    }
  };

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!newTask.title.trim()) {
      setError("Please enter a task title before continuing.");
      return;
    }

    if (
      newTask.assignmentType === "assigned" &&
      createAssignedToUserIds.length === 0
    ) {
      setError("Please select at least one team member to assign this task to.");
      return;
    }

    if (newTask.isBlocked && !newTask.blockReason.trim()) {
      setError("Please add a reason explaining why this task is blocked.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const companyId = getStoredCompanyId();

      if (!companyId) {
        router.push("/dashboards");
        return;
      }

      const finalStatus = newTask.isBlocked ? "blocked" : newTask.status;
      const nextTaskCode = `ID ${String(tasks.length + 1).padStart(3, "0")}`;

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-company-id": companyId,
        },
        body: JSON.stringify({
          taskCode: nextTaskCode,
          title: newTask.title,
          description: newTask.description,
          status: finalStatus,
          priority: newTask.priority,
          assignmentType: newTask.assignmentType,
          assignedToUserId:
            newTask.assignmentType === "personal"
              ? session?.userId
              : createAssignedToUserIds[0]
                ? Number(createAssignedToUserIds[0])
                : null,
          assignedToUserIds:
            newTask.assignmentType === "personal"
              ? session?.userId
                ? [Number(session.userId)]
                : []
              : createAssignedToUserIds.map((userId) => Number(userId)),
          createdByUserId: session?.userId,
          projectId:
            newTask.assignmentType === "personal"
              ? null
              : newTask.projectId || null,
          dueDate: newTask.dueDate || null,
          tags: newTask.tags,
          isBlocked: newTask.isBlocked,
          blockReason: newTask.isBlocked ? newTask.blockReason : "",
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.details || data?.error || "Unable to create this task.",
        );
      }

      setTasks((prev) => [data, ...prev]);
      setNewTask(emptyForm);
      setShowCreateTask(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "This task could not be created. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const visibleTasks = useMemo(() => {
    const currentUserId = session?.userId ? String(session.userId) : null;

    const filtered = tasks.filter((task) => {
      if (isTaskDeleted(task)) {
        return false;
      }

      // Update 1: Only show tasks assigned to the current user
      if (currentUserId) {
        const assignmentType = getTaskText(task, "assignmentType");
        const assignedUserIds = getAssignedUserIds(task, teamMembers);
        const assignedToUserId = getTaskNumber(task, "assignedToUserId");
        const createdByUserId = getTaskText(task, "createdByUserId");

        const isPersonalOwnedByMe =
          assignmentType === "personal" &&
          (assignedUserIds.includes(currentUserId) ||
            (assignedToUserId !== null && String(assignedToUserId) === currentUserId) ||
            (createdByUserId && String(createdByUserId) === currentUserId));
        const isAssignedToMe =
          assignmentType !== "personal" &&
          (assignedUserIds.includes(currentUserId) ||
            (assignedToUserId !== null && String(assignedToUserId) === currentUserId));

        if (!isPersonalOwnedByMe && !isAssignedToMe) {
          return false;
        }
      }

      if (selectedProjectId && getTaskText(task, "projectId") !== selectedProjectId) {
        return false;
      }

      if (activeTab === "blocked") {
        return (
          task.status === "blocked" || Boolean(getTaskValue(task, "isBlocked"))
        );
      }

      if (task.status !== activeScope) {
        return false;
      }

      if (activeTab !== "all") {
        const priority = getTaskText(task, "priority") || "medium";

        if (priority !== activeTab) {
          return false;
        }
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "title") {
        return getTaskText(a, "title").localeCompare(getTaskText(b, "title"));
      }

      if (sortBy === "priority") {
        const rank: Record<string, number> = {
          high: 3,
          medium: 2,
          low: 1,
        };

        return (
          (rank[getTaskText(b, "priority")] || 0) -
          (rank[getTaskText(a, "priority")] || 0)
        );
      }

      if (sortBy === "dueDate") {
        const aDate = getTaskDateTime(a, "dueDate") || Number.MAX_SAFE_INTEGER;
        const bDate = getTaskDateTime(b, "dueDate") || Number.MAX_SAFE_INTEGER;

        return aDate - bDate;
      }

      const aDate =
        getTaskDateTime(a, "updatedAtRaw") ||
        getTaskDateTime(a, "createdAtRaw") ||
        getTaskDateTime(a, "updatedAt") ||
        getTaskDateTime(a, "createdAt") ||
        0;

      const bDate =
        getTaskDateTime(b, "updatedAtRaw") ||
        getTaskDateTime(b, "createdAtRaw") ||
        getTaskDateTime(b, "updatedAt") ||
        getTaskDateTime(b, "createdAt") ||
        0;

      return bDate - aDate;
    });
  }, [tasks, activeTab, activeScope, selectedProjectId, sortBy]);

  const getTabCount = (filter: BoardFilter) => {
    return tasks.filter((task) => {
      if (isTaskDeleted(task)) {
        return false;
      }

      if (selectedProjectId && getTaskText(task, "projectId") !== selectedProjectId) {
        return false;
      }

      if (filter === "blocked") {
        // Blocked tasks: must be in current scope (or status blocked) AND blocked
        return (
          task.status === "blocked" || Boolean(getTaskValue(task, "isBlocked"))
        ) && (task.status === activeScope || task.status === "blocked");
      }

      // All other filters: task must be in the current scope tab
      if (task.status !== activeScope) {
        return false;
      }

      if (filter !== "all") {
        const priority = getTaskText(task, "priority") || "medium";

        if (priority !== filter) {
          return false;
        }
      }

      return true;
    }).length;
  };

  const getStageCount = (status: TaskScopeFilter) => {
    return tasks.filter((task) => {
      if (isTaskDeleted(task)) {
        return false;
      }

      if (selectedProjectId && getTaskText(task, "projectId") !== selectedProjectId) {
        return false;
      }

      return task.status === status;
    }).length;
  };

  const projectFilterOptions = [
    { value: "", label: "All Projects" },
    ...projects.map((project) => ({
      value: project.id,
      label: project.name,
    })),
  ];

  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );

  if (!mounted) {
    return (
      <DashboardLayout title="Tasks" subtitle="Manage and track all tasks">
        <div className="glass-card flex items-center justify-center gap-2 p-12 text-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className="text-muted-foreground">
            Loading your task workspace...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Tasks" subtitle="Manage and track all tasks">
      <VoltPageTour
        storageKey="volt-tasks-tour-seen"
        steps={[
          {
            title: "Welcome to Tasks ⚡",
            description: "This is your task board. Personal tasks are only visible to you. Assigned tasks go to specific teammates. Let me show you around.",
            image: "/volty/step-1-welcome.png",
            placement: "center",
          },
          {
            title: "Create a New Task",
            description: "Click 'New Task' to open the task form. Give it a title, description, priority, due date and assign it to yourself or a teammate.",
            target: '[data-tour="new-task-btn"]',
            placement: "bottom",
            mascotSide: "left",
            image: "/volty/step-2-join-codes.png",
          },
          {
            title: "Task Stages",
            description: "Your tasks move through four stages: To Do, In Progress, Rollover, and Completed. Click a stage card to filter tasks in that state.",
            target: '[data-tour="task-scope-filters"]',
            placement: "bottom",
            mascotSide: "right",
            image: "/volty/step-3-dashboards.png",
          },
          {
            title: "Priority Filters",
            description: "Use these filter tabs to show All, Low, Medium, High or Blocked tasks within the current stage.",
            target: '[data-tour="task-priority-filters"]',
            placement: "top",
            mascotSide: "left",
            image: "/volty/step-4-plan-upgrade.png",
          },
          {
            title: "Overdue Tasks",
            description: "Overdue tasks highlight in red. Open the Overdue panel to review what's late and start working on them right away.",
            target: '[data-tour="overdue-btn"]',
            placement: "bottom",
            mascotSide: "right",
            image: "/volty/step-5-build-dashboard.png",
          },
          {
            title: "You're ready!",
            description: "Create tasks, track progress, stay on top of deadlines and earn XP when you complete work. Go get things done!",
            image: "/volty/step-6-goodbye.png",
            placement: "center",
          },
        ]}
      />
      <div className="mb-5 flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div data-tour="task-scope-filters" className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {scopeFilters.map((filter) => {
            const Icon = filter.icon;
            const active = activeScope === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveScope(filter.value)}
                className={cn(
                  "group glass-card relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3.5 text-left",
                  softButtonMotion,
                  "hover:border-accent/40 hover:bg-accent/[0.04]",
                  active ? "border-accent/50 bg-accent/10" : "border-border/70",
                  highlightedTab === filter.value &&
                    "animate-stage-drop-highlight border-accent bg-accent/15 text-accent shadow-lg shadow-accent/15",
                )}
              >
                <ScopeHoverAnimation type={filter.value} active={active} />

                {highlightedTab === filter.value && (
                  <>
                    <span className="stage-light-sweep pointer-events-none absolute inset-0 rounded-2xl" />
                    <span className="stage-light-orb pointer-events-none absolute right-3 top-3 h-2.5 w-2.5 rounded-sm bg-accent" />
                    <span className="stage-light-orb stage-light-orb-two pointer-events-none absolute bottom-3 left-4 h-1.5 w-1.5 rounded-sm bg-foreground/45" />
                  </>
                )}

                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
                    active
                      ? "bg-accent text-accent-foreground shadow-md shadow-accent/20"
                      : "bg-muted text-muted-foreground group-hover:bg-accent/10 group-hover:text-accent",
                    highlightedTab === filter.value &&
                      "animate-stage-icon-pop bg-accent text-accent-foreground shadow-md shadow-accent/25",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-transform duration-300",
                      filter.value === "todo" &&
                        "group-hover:scale-110 group-hover:rotate-3",
                      filter.value === "in-progress" &&
                        "group-hover:-translate-y-0.5 group-hover:rotate-6",
                      filter.value === "rollover" &&
                        "group-hover:rotate-180 group-hover:scale-105",
                      filter.value === "completed" && "group-hover:scale-105",
                    )}
                  />
                </div>

                <div className="relative z-10 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-bold transition-colors duration-300",
                      active
                        ? "text-accent"
                        : "text-foreground group-hover:text-accent",
                    )}
                  >
                    {filter.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {filter.description}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-[11px] font-black uppercase tracking-wide text-muted-foreground",
                      highlightedTab === filter.value &&
                        "animate-stage-count-pop text-accent",
                    )}
                  >
                    {getStageCount(filter.value)} task
                    {getStageCount(filter.value) === 1 ? "" : "s"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
          <Button
            data-tour="new-task-btn"
            onClick={() => setShowCreateTask(true)}
            className={cn(
              "group relative h-9 overflow-hidden rounded-xl px-4 text-sm font-bold",
              "bg-gradient-to-r from-primary via-accent to-primary text-primary-foreground",
              "shadow-md shadow-primary/15 transition-all duration-300",
              "hover:-translate-y-0.5 hover:scale-[1.015] hover:shadow-lg hover:shadow-primary/25 active:translate-y-0 active:scale-[0.98]",
              "before:absolute before:inset-0 before:-translate-x-full before:bg-foreground/10 before:transition-transform before:duration-700 hover:before:translate-x-full",
            )}
          >
            <span className="relative flex items-center">
              <Sparkles className="mr-2 h-4 w-4 transition group-hover:rotate-12 group-hover:scale-110" />
              New Task
              <Plus className="ml-2 h-4 w-4 transition group-hover:rotate-90" />
            </span>
          </Button>

          <Button
            data-tour="overdue-btn"
            type="button"
            variant="outline"
            onClick={() => setShowOverduePanel(true)}
            className={cn(
              "group h-9 rounded-xl border-destructive/35 bg-destructive/10 px-4 text-sm font-bold text-destructive",
              "hover:border-destructive/60 hover:bg-destructive/15 hover:text-destructive",
              softButtonMotion,
              overdueFlashActive && overdueTasks.length > 0 && "animate-overdue-flash",
            )}
          >
            <CalendarX className="mr-2 h-4 w-4 transition group-hover:-rotate-6" />
            Overdue Tasks
            {overdueTasks.length > 0 && (
              <span className="ml-2 rounded-full bg-destructive/20 px-2 py-0.5 text-[11px]">
                {overdueTasks.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="glass-card rounded-2xl border border-accent/20 bg-accent/10 p-3.5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <CustomDropdown
              label="Project Filter"
              value={selectedProjectId}
              placeholder="All Projects"
              options={projectFilterOptions}
              onChange={setSelectedProjectId}
            />

            <Button
              type="button"
              variant="outline"
              disabled={!selectedProjectId}
              onClick={() => {
                if (selectedProjectId) {
                  router.push(`/projects?projectId=${selectedProjectId}`);
                }
              }}
              className={cn(
                "h-9 rounded-xl border-accent/30 bg-background/60 px-4 text-xs font-bold text-accent hover:bg-accent/10",
                softButtonMotion,
              )}
            >
              <FolderKanban className="mr-2 h-4 w-4" />
              View Project Page
            </Button>
          </div>

          <p className="mt-2 text-xs font-semibold text-muted-foreground">
            {selectedProject
              ? `Showing tasks linked to ${selectedProject.name}.`
              : "Showing tasks from every project you can access."}
          </p>
        </div>
      </div>

      {editingTask && editTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 px-3 py-3 backdrop-blur-sm">
          <div className="glass-card w-full max-w-[540px] rounded-2xl border border-accent/20 bg-background/95 p-5 shadow-2xl">
            <div className="mb-2.5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Edit Task
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Update the task without deleting database history.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingTask(null);
                  setEditTask(null);
                }}
                className={cn(
                  "rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
                  softButtonMotion,
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTask} className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">
                  Title
                </label>
                <input
                  value={editTask.title}
                  onChange={(event) =>
                    setEditTask(
                      (prev) => prev && { ...prev, title: event.target.value },
                    )
                  }
                  className="h-9 w-full rounded-lg border border-border bg-muted/30 px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">
                  Description
                </label>
                <textarea
                  value={editTask.description}
                  rows={3}
                  onChange={(event) =>
                    setEditTask(
                      (prev) =>
                        prev && { ...prev, description: event.target.value },
                    )
                  }
                  className="w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <CustomDropdown
                  label="Priority"
                  value={editTask.priority}
                  placeholder="Select priority"
                  options={[
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                  ]}
                  onChange={(value) =>
                    setEditTask(
                      (prev) =>
                        prev && {
                          ...prev,
                          priority: value as NewTaskForm["priority"],
                        },
                    )
                  }
                />

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-foreground">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editTask.dueDate}
                    onChange={(event) =>
                      setEditTask(
                        (prev) =>
                          prev && { ...prev, dueDate: event.target.value },
                      )
                    }
                    className="h-9 w-full rounded-lg border border-border bg-muted/30 px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/10 p-3.5">
                <div className="grid gap-2 md:grid-cols-2">
                  <CustomDropdown
                    label="Project optional"
                    value={editTask.projectId}
                    placeholder="No project"
                    options={[
                      { value: "", label: "No project" },
                      ...projects.map((project) => ({
                        value: project.id,
                        label: project.name,
                      })),
                    ]}
                    onChange={(value) =>
                      setEditTask(
                        (prev) =>
                          prev && {
                            ...prev,
                            projectId: value,
                          },
                      )
                    }
                  />

                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-foreground">
                      Assigned users
                    </label>
                    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      {editTask.assignedToUserIds.length} user
                      {editTask.assignedToUserIds.length === 1 ? "" : "s"}{" "}
                      selected
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">
                      Assign people to this task
                    </label>
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Multiple people can work together
                    </span>
                  </div>

                  <div className="grid max-h-36 gap-2 overflow-y-auto rounded-xl volt-scrollbar border border-border bg-muted/15 p-2 sm:grid-cols-2">
                    {teamMembers.map((member) => {
                      const selected = editTask.assignedToUserIds.includes(
                        String(member.id),
                      );

                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() =>
                            toggleEditAssignedUser(String(member.id))
                          }
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition",
                            selected
                              ? "border-accent/50 bg-accent/10 text-accent"
                              : "border-border bg-background/40 text-foreground hover:border-accent/30 hover:bg-accent/5",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                              selected
                                ? "border-accent bg-accent text-accent-foreground"
                                : "border-muted-foreground/40 text-muted-foreground",
                            )}
                          >
                            {selected ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              getInitials(member.fullName)
                            )}
                          </span>
                          <span className="min-w-0 truncate font-semibold">
                            {member.fullName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEditTask(
                      (prev) =>
                        prev && {
                          ...prev,
                          isBlocked: !prev.isBlocked,
                          blockReason: prev.isBlocked ? "" : prev.blockReason,
                        },
                    )
                  }
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left",
                    softButtonMotion,
                    editTask.isBlocked
                      ? "border-destructive/40 bg-destructive/10"
                      : "border-border bg-muted/20 hover:border-accent/40 hover:bg-muted/30",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition",
                      editTask.isBlocked
                        ? "border-destructive bg-destructive text-destructive-foreground"
                        : "border-muted-foreground/50 bg-muted",
                    )}
                  >
                    {editTask.isBlocked && <Check className="h-3 w-3" />}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      editTask.isBlocked
                        ? "text-destructive"
                        : "text-foreground",
                    )}
                  >
                    Blocked
                  </span>
                </button>

                {editTask.isBlocked && (
                  <textarea
                    value={editTask.blockReason}
                    onChange={(event) =>
                      setEditTask(
                        (prev) =>
                          prev && { ...prev, blockReason: event.target.value },
                      )
                    }
                    placeholder="Explain what is blocking this task..."
                    rows={2}
                    className="w-full resize-none rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs outline-none transition placeholder:text-muted-foreground focus:border-destructive focus:ring-2 focus:ring-destructive/10"
                  />
                )}
              </div>

              <div className="border-t border-border/60 bg-background/80 px-4 py-3.5 backdrop-blur">
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-9 w-full rounded-lg bg-gradient-to-r from-accent to-primary text-sm font-semibold text-accent-foreground"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 px-3 py-4 backdrop-blur-sm">
          <div className="glass-card animate-create-modal-enter relative flex max-h-[84vh] w-full max-w-[580px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-2xl shadow-foreground/10">
            <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative z-10 flex items-start justify-between gap-3 border-b border-border/60 px-5 py-3.5">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Create New Task
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Keep it simple, clean, and ready for your workflow.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowCreateTask(false);
                  setNewTask(emptyForm);
                }}
                className={cn(
                  "rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                  softButtonMotion,
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateTask}
              className="relative z-10 flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3.5 volt-square-scrollbar">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">
                    Title
                  </label>
                  <input
                    value={newTask.title}
                    onChange={(event) =>
                      setNewTask((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Task title"
                    className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">
                    Description
                  </label>
                  <textarea
                    value={newTask.description}
                    onChange={(event) =>
                      setNewTask((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Task description"
                    rows={2}
                    className="w-full resize-none rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div className="grid gap-2.5 border-t border-border/50 pt-3.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setNewTask((prev) => ({
                        ...prev,
                        assignmentType: "personal",
                        assignedToUserId: String(session?.userId || ""),
                        assignedToUserIds: session?.userId
                          ? [String(session.userId)]
                          : [],
                        projectId: "",
                      }))
                    }
                    className={cn(
                      "flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition",
                      newTask.assignmentType === "personal"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background/60 text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                    )}
                  >
                    <User className="h-4 w-4" />
                    Personal
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setNewTask((prev) => ({
                        ...prev,
                        assignmentType: "assigned",
                        assignedToUserId: "",
                        assignedToUserIds: [],
                      }))
                    }
                    className={cn(
                      "flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition",
                      newTask.assignmentType === "assigned"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background/60 text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                    )}
                  >
                    <Users className="h-4 w-4" />
                    Assigned
                  </button>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <CustomDropdown
                    label="Status"
                    value={newTask.status}
                    placeholder="Select status"
                    options={[
                      { value: "todo", label: "To Do" },
                      { value: "in-progress", label: "In Progress" },
                      { value: "rollover", label: "Rollover" },
                      { value: "completed", label: "Completed" },
                      { value: "blocked", label: "Blocked" },
                    ]}
                    onChange={(value) =>
                      setNewTask((prev) => ({
                        ...prev,
                        status: value as NewTaskForm["status"],
                        isBlocked: value === "blocked",
                      }))
                    }
                  />

                  <CustomDropdown
                    label="Priority"
                    value={newTask.priority}
                    placeholder="Select priority"
                    options={[
                      { value: "low", label: "Low" },
                      { value: "medium", label: "Medium" },
                      { value: "high", label: "High" },
                    ]}
                    onChange={(value) =>
                      setNewTask((prev) => ({
                        ...prev,
                        priority: value as NewTaskForm["priority"],
                      }))
                    }
                  />
                </div>

                <div
                  className={cn(
                    "grid gap-2.5",
                    newTask.assignmentType === "assigned"
                      ? "sm:grid-cols-2"
                      : "sm:grid-cols-1",
                  )}
                >
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-foreground">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(event) =>
                        setNewTask((prev) => ({
                          ...prev,
                          dueDate: event.target.value,
                        }))
                      }
                      className="h-9 w-full rounded-lg border border-border bg-muted/30 px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  {newTask.assignmentType === "assigned" && (
                    <CustomDropdown
                      label="Project optional"
                      value={newTask.projectId}
                      placeholder="No project"
                      options={[
                        { value: "", label: "No project" },
                        ...projects.map((project) => ({
                          value: project.id,
                          label: project.name,
                        })),
                      ]}
                      onChange={(value) =>
                        setNewTask((prev) => ({
                          ...prev,
                          projectId: value,
                          assignedToUserId: "",
                          assignedToUserIds: [],
                        }))
                      }
                    />
                  )}
                </div>

                {newTask.assignmentType === "assigned" && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-semibold text-foreground">
                        Assign Task
                      </label>
                      {createAssignedToUserIds.length > 0 && (
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {createAssignedToUserIds.length} selected
                        </span>
                      )}
                    </div>

                    <CustomDropdown
                      label=""
                      value=""
                      placeholder={
                        selectableMembers.length === 0
                          ? "No team members available"
                          : "Select a team member"
                      }
                      options={selectableMembers
                        .filter(
                          (member) =>
                            !createAssignedToUserIds.includes(String(member.id)),
                        )
                        .map((member) => ({
                          value: String(member.id),
                          label: member.fullName,
                        }))}
                      onChange={(value) => {
                        if (!value) return;

                        setNewTask((prev) => {
                          const selectedUserIds = Array.isArray(
                            prev.assignedToUserIds,
                          )
                            ? prev.assignedToUserIds
                            : [];

                          if (selectedUserIds.includes(value)) {
                            return prev;
                          }

                          const assignedToUserIds = [
                            ...selectedUserIds,
                            value,
                          ];

                          return {
                            ...prev,
                            assignmentType: "assigned",
                            assignedToUserIds,
                            assignedToUserId: assignedToUserIds[0] || "",
                          };
                        });
                      }}
                    />

                    {createAssignedToUserIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {createAssignedToUserIds.map((userId) => {
                          const member = selectableMembers.find(
                            (item) => String(item.id) === userId,
                          );
                          const name = member?.fullName || "Selected user";

                          return (
                            <span
                              key={userId}
                              className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-semibold text-foreground shadow-sm"
                            >
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                                {getInitials(name)}
                              </span>
                              <span className="truncate">{name}</span>
                              <button
                                type="button"
                                aria-label={`Remove ${name}`}
                                onClick={() =>
                                  setNewTask((prev) => {
                                    const selectedUserIds = Array.isArray(
                                      prev.assignedToUserIds,
                                    )
                                      ? prev.assignedToUserIds
                                      : [];
                                    const assignedToUserIds = selectedUserIds.filter(
                                      (id) => id !== userId,
                                    );

                                    return {
                                      ...prev,
                                      assignedToUserIds,
                                      assignedToUserId: assignedToUserIds[0] || "",
                                    };
                                  })
                                }
                                className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="border-t border-border/50 pt-3.5">
                  <button
                    type="button"
                    onClick={() =>
                      setNewTask((prev) => ({
                        ...prev,
                        isBlocked: !prev.isBlocked,
                        status: !prev.isBlocked ? "blocked" : "todo",
                        blockReason: prev.isBlocked ? "" : prev.blockReason,
                      }))
                    }
                    className={cn(
                      "flex h-9 w-full items-center gap-2 rounded-lg border px-3 text-left transition",
                      softButtonMotion,
                      newTask.isBlocked
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-border bg-background/60 text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                        newTask.isBlocked
                          ? "border-destructive bg-destructive text-destructive-foreground"
                          : "border-muted-foreground/40 bg-transparent",
                      )}
                    >
                      {newTask.isBlocked && <Check className="h-4 w-4" />}
                    </span>
                    <span className="text-sm font-semibold">Blocked</span>
                  </button>
                </div>

                {newTask.isBlocked && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-foreground">
                      Block Reason
                    </label>
                    <textarea
                      value={newTask.blockReason}
                      onChange={(event) =>
                        setNewTask((prev) => ({
                          ...prev,
                          blockReason: event.target.value,
                        }))
                      }
                      placeholder="Explain what is blocking this task..."
                      rows={2}
                      className="w-full resize-none rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-destructive focus:ring-2 focus:ring-destructive/10"
                    />
                  </div>
                )}
              </div>

              <div className="border-t border-border/60 bg-background/90 px-5 py-3.5 backdrop-blur">
                <Button
                  type="submit"
                  disabled={saving}
                  className={cn(
                    "group relative h-9 w-full overflow-hidden rounded-lg bg-gradient-to-r from-primary to-accent text-sm font-semibold text-primary-foreground glow",
                    "transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] active:translate-y-0 active:scale-[0.98]",
                    "before:absolute before:inset-0 before:-translate-x-full before:bg-foreground/10 before:transition-transform before:duration-700 hover:before:translate-x-full",
                  )}
                >
                  <span className="relative flex items-center justify-center">
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Task...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4 transition group-hover:rotate-90" />
                        Create Task
                      </>
                    )}
                  </span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}


      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div data-tour="task-priority-filters" className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-black uppercase tracking-wide text-muted-foreground">
            Filters
          </span>
          {boardTabs.map((tab) => {
            const Icon = tab.icon;
            const count = getTabCount(tab.value);

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "group flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-semibold",
                  pulseMotion,
                  activeTab === tab.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  String(highlightedTab) === tab.value &&
                    "animate-tab-clean-highlight border-accent bg-accent/15 text-accent",
                )}
              >
                <Icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" />
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px]",
                    String(highlightedTab) === tab.value
                      ? "animate-tab-count-pop bg-accent text-accent-foreground"
                      : activeTab === tab.value
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {activeScope === "completed" && getStageCount("completed") > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={handleClearCompleted}
            className="h-10 rounded-xl border-accent/30 bg-accent/10 text-xs font-bold text-accent hover:bg-accent/15"
          >
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Clear Done Page
          </Button>
        )}

        <div className="w-full lg:w-52">
          <CustomDropdown
            label=""
            value={sortBy}
            placeholder="Sort by"
            options={[
              { value: "newest", label: "Newest" },
              { value: "dueDate", label: "Due Date" },
              { value: "priority", label: "Priority" },
              { value: "title", label: "Title A-Z" },
            ]}
            onChange={(value) => setSortBy(value as SortOption)}
          />
        </div>
      </div>

      {showOverduePanel && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/75 backdrop-blur-sm">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-destructive/25 bg-background/95 p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">
                  <CalendarX className="h-3.5 w-3.5" />
                  Overdue Tasks
                </div>
                <h2 className="text-xl font-black text-foreground">
                  Tasks needing attention
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start overdue work from here and keep the full details on the
                  task card.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowOverduePanel(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-5 rounded-2xl border border-destructive/25 bg-destructive/10 p-3.5">
              <p className="text-xs font-semibold text-destructive">
                Overdue Tasks
              </p>
              <p className="mt-2 text-2xl font-black text-destructive">
                {overdueTasks.length}
              </p>
            </div>

            <div className="space-y-3">
              {overdueTasks.length > 0 ? (
                overdueTasks.map((task) => {
                  const days = getOverdueDays(task);
                  return (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-destructive/25 bg-destructive/5 p-3.5"
                    >
                      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words font-bold text-foreground">
                            {task.title}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Due {formatDate(getTaskValue(task, "dueDate"))}
                          </p>
                        </div>
                        <span className="self-start shrink-0 rounded-full bg-destructive/15 px-2 py-1 text-xs font-bold text-destructive">
                          {days} day{days === 1 ? "" : "s"} overdue
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <StatusActionButton
                          onClick={() => {
                            handleStatusChange(task.id, "in-progress");
                            setShowOverduePanel(false);
                          }}
                          variant="primary"
                          size="small"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                          Start
                        </StatusActionButton>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-border bg-muted/20 p-8 text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-accent" />
                  <p className="font-bold text-foreground">No overdue tasks</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your review panel is clear.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="glass-card mb-4 border border-destructive/30 p-3.5">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {completionToast && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-[80] w-[calc(100%-2.5rem)] max-w-sm animate-reward-clean-toast">
          <div className="glass-card rounded-3xl border border-primary/30 bg-background/95 p-5 shadow-2xl backdrop-blur-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Trophy className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <p className="text-base font-black text-foreground">
                  Congratulations!
                </p>
                <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                  You finished “{completionToast.taskTitle}”
                </p>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-primary">
                  <Star className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase">
                    XP Gained
                  </span>
                </div>
                <p className="text-2xl font-black text-primary">
                  +{completionToast.xpGained}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/25 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-[11px] font-bold uppercase">Level</span>
                </div>
                <p className="text-2xl font-black text-foreground">
                  {completionToast.level}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Level progress</span>
                <span className="text-primary">
                  {completionToast.levelProgress}%
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-1000 ease-out"
                  style={{
                    width: `${toastProgressWidth}%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              {completionToast.achievements.slice(0, 3).map((achievement) => (
                <div
                  key={achievement}
                  className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs font-semibold text-foreground"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {achievement}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="glass-card flex items-center justify-center gap-2 p-12 text-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className="text-muted-foreground">
            Loading your task workspace...
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid max-h-[760px] grid-cols-1 gap-3.5 overflow-y-auto px-1 volt-scrollbar pb-2 pt-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleTasks.map((task) => (
              <CleanTaskCard
                key={task.id}
                task={task}
                members={teamMembers}
                projects={projects}
                onStatusChange={handleStatusChange}
                onSoftDelete={handleSoftDelete}
                onEdit={openEditTask}
                isAnimating={animatingTaskId === task.id}
                isOverdueTask={isTaskOverdue(task)}
                overdueDays={getOverdueDays(task)}
              />
            ))}
          </div>

          {visibleTasks.length === 0 && (
            <div className="glass-card p-12 text-center">
              <p className="text-muted-foreground">
                No tasks match the selected filters.
              </p>
            </div>
          )}
        </>
      )}

      <style jsx global>{`
        @keyframes task-clean-exit {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1) rotate(0deg);
            filter: saturate(1);
          }
          22% {
            opacity: 1;
            transform: translateY(-10px) scale(1.018) rotate(-0.45deg);
            filter: saturate(1.08);
          }
          54% {
            opacity: 0.9;
            transform: translateY(-4px) translateX(10px) scale(0.985) rotate(0.35deg);
            filter: saturate(1.02);
          }
          100% {
            opacity: 0;
            transform: translateY(12px) translateX(24px) scale(0.94) rotate(0deg);
            filter: saturate(0.92);
          }
        }

        @keyframes task-transfer-glow {
          0% {
            opacity: 0;
            box-shadow: inset 0 0 0 1px hsl(var(--accent) / 0);
            background-position: -140% 0;
          }
          20% {
            opacity: 1;
            box-shadow:
              inset 0 0 0 1px hsl(var(--accent) / 0.24),
              0 18px 38px hsl(var(--foreground) / 0.12);
          }
          100% {
            opacity: 0;
            box-shadow: inset 0 0 0 1px hsl(var(--accent) / 0);
            background-position: 180% 0;
          }
        }

        @keyframes task-transfer-sparkle {
          0%,
          100% {
            opacity: 0;
            transform: scale(0.7) rotate(0deg);
          }
          35% {
            opacity: 1;
            transform: scale(1) rotate(18deg);
          }
          62% {
            opacity: 0.7;
            transform: scale(0.88) rotate(34deg);
          }
        }

        @keyframes stage-drop-highlight {
          0% {
            transform: translateY(0) scale(1);
            box-shadow: 0 0 0 0 hsl(var(--accent) / 0);
          }
          14% {
            transform: translateY(-8px) scale(1.025);
            box-shadow:
              0 0 0 5px hsl(var(--accent) / 0.12),
              0 16px 32px hsl(var(--accent) / 0.18);
          }
          32% {
            transform: translateY(2px) scale(0.992);
            box-shadow:
              0 0 0 9px hsl(var(--accent) / 0.08),
              0 10px 22px hsl(var(--accent) / 0.14);
          }
          52% {
            transform: translateY(-4px) scale(1.012);
            box-shadow:
              0 0 0 5px hsl(var(--accent) / 0.1),
              0 10px 22px hsl(var(--accent) / 0.14);
          }
          76% {
            transform: translateY(0) scale(1.004);
            box-shadow:
              0 0 0 3px hsl(var(--accent) / 0.08),
              0 6px 14px hsl(var(--accent) / 0.1);
          }
          100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 0 0 0 hsl(var(--accent) / 0);
          }
        }

        @keyframes stage-light-sweep {
          0% {
            opacity: 0;
            transform: translateX(-130%);
          }
          18% {
            opacity: 1;
          }
          70% {
            opacity: 0.82;
          }
          100% {
            opacity: 0;
            transform: translateX(130%);
          }
        }

        @keyframes stage-light-orb {
          0%,
          100% {
            opacity: 0;
            transform: scale(0.65) rotate(0deg);
          }
          28% {
            opacity: 0.95;
            transform: scale(1.16) rotate(12deg);
          }
          55% {
            opacity: 0.68;
            transform: scale(0.9) rotate(28deg);
          }
        }

        @keyframes stage-icon-pop {
          0% {
            transform: scale(1) rotate(0deg);
          }
          28% {
            transform: scale(1.14) rotate(6deg);
          }
          60% {
            transform: scale(0.96) rotate(-3deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
          }
        }

        @keyframes stage-count-pop {
          0% {
            letter-spacing: 0.08em;
            transform: translateY(0);
          }
          32% {
            letter-spacing: 0.14em;
            transform: translateY(-1px);
          }
          100% {
            letter-spacing: 0.08em;
            transform: translateY(0);
          }
        }

        .animate-stage-drop-highlight {
          animation: stage-drop-highlight 1800ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform, box-shadow;
        }

        .stage-light-sweep {
          animation: stage-light-sweep 900ms cubic-bezier(0.22, 1, 0.36, 1);
          background: linear-gradient(
            110deg,
            transparent 0%,
            hsl(var(--foreground) / 0.02) 30%,
            hsl(var(--accent) / 0.2) 48%,
            hsl(var(--foreground) / 0.05) 62%,
            transparent 100%
          );
          width: 58%;
          will-change: transform, opacity;
        }

        .stage-light-orb {
          animation: stage-light-orb 880ms ease-out both;
          box-shadow:
            0 0 18px hsl(var(--accent) / 0.65),
            0 0 28px hsl(var(--accent) / 0.24);
          will-change: transform, opacity;
        }

        .stage-light-orb-two {
          animation-delay: 120ms;
          box-shadow: 0 0 14px hsl(var(--foreground) / 0.24);
        }

        .animate-stage-icon-pop {
          animation: stage-icon-pop 720ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform;
        }

        .animate-stage-count-pop {
          animation: stage-count-pop 820ms cubic-bezier(0.16, 1, 0.3, 1);
          display: inline-block;
          will-change: transform, letter-spacing;
        }

        @keyframes tab-clean-highlight {
          0% {
            transform: translateY(0) scale(1);
            box-shadow: 0 0 0 0 hsl(var(--accent) / 0);
          }
          12% {
            transform: translateY(-7px) scaleX(1.03) scaleY(0.98);
            box-shadow:
              0 0 0 4px hsl(var(--accent) / 0.12),
              0 12px 28px hsl(var(--accent) / 0.2);
          }
          28% {
            transform: translateY(2px) scaleX(0.98) scaleY(1.03);
            box-shadow:
              0 0 0 8px hsl(var(--accent) / 0.09),
              0 8px 18px hsl(var(--accent) / 0.16);
          }
          44% {
            transform: translateY(-4px) scaleX(1.015) scaleY(0.99);
            box-shadow:
              0 0 0 5px hsl(var(--accent) / 0.12),
              0 10px 22px hsl(var(--accent) / 0.16);
          }
          68% {
            transform: translateY(0) scale(1.01);
            box-shadow:
              0 0 0 3px hsl(var(--accent) / 0.1),
              0 6px 16px hsl(var(--accent) / 0.12);
          }
          100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 0 0 0 hsl(var(--accent) / 0);
          }
        }

        @keyframes tab-count-pop {
          0% {
            transform: scale(1);
          }
          35% {
            transform: scale(1.16);
          }
          70% {
            transform: scale(0.96);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes reward-clean-toast {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.96);
          }
          12% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          86% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
        }

        .animate-task-clean-exit {
          animation: task-clean-exit 460ms cubic-bezier(0.16, 1, 0.3, 1)
            forwards;
          will-change: transform, opacity, filter;
        }

        .task-transfer-glow {
          animation: task-transfer-glow 460ms cubic-bezier(0.16, 1, 0.3, 1)
            forwards;
          background: linear-gradient(
            115deg,
            transparent 0%,
            hsl(var(--foreground) / 0.03) 34%,
            hsl(var(--accent) / 0.12) 48%,
            hsl(var(--foreground) / 0.04) 62%,
            transparent 100%
          );
          background-size: 240% 100%;
          will-change: opacity, background-position, box-shadow;
        }

        .task-transfer-sparkle {
          animation: task-transfer-sparkle 460ms ease-out forwards;
          height: 8px;
          width: 8px;
          border-radius: 2px;
          background: hsl(var(--accent) / 0.75);
          box-shadow:
            12px 7px 0 -2px hsl(var(--foreground) / 0.36),
            -10px 10px 0 -3px hsl(var(--accent) / 0.48);
          will-change: transform, opacity;
        }

        .animate-tab-clean-highlight {
          animation: tab-clean-highlight 1250ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform, box-shadow;
        }

        .animate-tab-count-pop {
          animation: tab-count-pop 520ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform;
        }

        .animate-reward-clean-toast {
          animation: reward-clean-toast 3600ms cubic-bezier(0.22, 1, 0.36, 1)
            forwards;
          will-change: transform, opacity;
        }

        @keyframes create-modal-soft-enter {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes create-modal-soft-glow {
          0% {
            opacity: 0.35;
            transform: translateX(-30%) scale(0.9);
          }
          50% {
            opacity: 0.7;
            transform: translateX(20%) scale(1);
          }
          100% {
            opacity: 0.35;
            transform: translateX(70%) scale(0.95);
          }
        }

        .animate-create-modal-enter {
          animation: create-modal-soft-enter 260ms
            cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform, opacity;
        }

        .create-modal-glow {
          animation: create-modal-soft-glow 7s ease-in-out infinite alternate;
          will-change: transform, opacity;
        }

        .volt-scrollbar,
        .volt-square-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: hsl(var(--muted-foreground) / 0.42) transparent;
        }

        .volt-scrollbar::-webkit-scrollbar,
        .volt-square-scrollbar::-webkit-scrollbar {
          width: 9px;
          height: 9px;
        }

        .volt-scrollbar::-webkit-scrollbar-track,
        .volt-square-scrollbar::-webkit-scrollbar-track {
          background: hsl(var(--muted) / 0.18);
          border-radius: 0;
          margin: 10px 0;
        }

        .volt-scrollbar::-webkit-scrollbar-thumb,
        .volt-square-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.36);
          border-radius: 3px;
          border: 2px solid hsl(var(--background) / 0.85);
          background-clip: padding-box;
        }

        .volt-scrollbar::-webkit-scrollbar-thumb:hover,
        .volt-square-scrollbar::-webkit-scrollbar-thumb:hover,
        .volt-scrollbar:focus-within::-webkit-scrollbar-thumb,
        .volt-square-scrollbar:focus-within::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.58);
          border: 2px solid hsl(var(--background) / 0.85);
          background-clip: padding-box;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-task-clean-exit,
          .animate-stage-drop-highlight,
          .animate-stage-icon-pop,
          .animate-stage-count-pop,
          .animate-tab-clean-highlight,
          .animate-tab-count-pop,
          .animate-reward-clean-toast,
          .animate-create-modal-enter {
            animation-duration: 1ms;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
