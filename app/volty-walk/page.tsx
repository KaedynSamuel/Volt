"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { cn } from "@/lib/utils"
import {
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  Sparkles,
  LayoutDashboard,
  CheckSquare,
  Ticket,
  FolderKanban,
  Trophy,
  Bot,
  Layers3,
  Users,
  BarChart3,
} from "lucide-react"

const STORAGE_KEY = "volt-volty-walk-dismissed"

type TourStep = {
  id: string
  page: string
  pageHref: string
  icon: React.ElementType
  title: string
  description: string
  image: string
  highlight: string
  action?: string
  actionHref?: string
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    page: "Welcome to Volt",
    pageHref: "/dashboards",
    icon: Sparkles,
    title: "Welcome! I'm Volty ⚡",
    description:
      "I'm going to show you how Volt works so you feel right at home. We'll walk through every major page, what it does, and how to use it. You can skip at any time — or explore with me step by step.",
    image: "/volty/ChatGPT_Image_May_27__2026__04_08_21_AM__10_-removebg-preview.png",
    highlight: "Start the tour to get the most out of Volt",
  },
  {
    id: "dashboards",
    page: "Dashboards",
    pageHref: "/dashboards",
    icon: LayoutDashboard,
    title: "Your Command Centre",
    description:
      "The Dashboards page is where you switch between your Personal dashboard and your Company overview. Each dashboard gives you a live snapshot of tasks, tickets, and team performance — all updating in real time as work moves.",
    image: "/volty/step-3-dashboards.png",
    highlight: "Click 'My Dashboard' or 'Company Dashboard' to explore both views",
    action: "Go to Dashboards",
    actionHref: "/dashboards",
  },
  {
    id: "tasks",
    page: "Tasks",
    pageHref: "/tasks",
    icon: CheckSquare,
    title: "Create & Track Tasks",
    description:
      "Tasks are the core of your daily work. Create personal tasks for yourself or assign tasks to teammates. Move them through To Do → In Progress → Rollover → Completed. Overdue tasks highlight in red so nothing slips through.",
    image: "/volty/step-1-welcome.png",
    highlight: "Press 'New Task' in the top right to add your first task",
    action: "Go to Tasks",
    actionHref: "/tasks",
  },
  {
    id: "tickets",
    page: "Tickets",
    pageHref: "/tickets",
    icon: Ticket,
    title: "Raise & Resolve Tickets",
    description:
      "Tickets are for issues, requests, or things that need formal tracking. Open tickets stay in your queue — closed tickets move to the Closed tab. Use priority levels (Low → Critical) to tell your team what needs attention first.",
    image: "/volty/step-2-join-codes.png",
    highlight: "Use the 'Open' and 'Closed' tabs to switch your view",
    action: "Go to Tickets",
    actionHref: "/tickets",
  },
  {
    id: "projects",
    page: "Projects",
    pageHref: "/projects",
    icon: FolderKanban,
    title: "Organise Work into Projects",
    description:
      "Projects group tasks under a shared goal. When you create a project you add team members, set a due date, and track overall progress with a live chart. Projects past their due date move to the end and turn red as a clear warning.",
    image: "/volty/step-5-build-dashboard.png",
    highlight: "Create a project and then link tasks to it",
    action: "Go to Projects",
    actionHref: "/projects",
  },
  {
    id: "team",
    page: "Team",
    pageHref: "/team",
    icon: Users,
    title: "Manage Your Team",
    description:
      "The Team page shows every member in your company workspace. Admins can invite new members, change roles, and see who is active. Team members must join with a code the admin provides during setup.",
    image: "/volty/team-idle-01.png",
    highlight: "Admin can invite members — they join with the code you share",
    action: "Go to Team",
    actionHref: "/team",
  },
  {
    id: "achievements",
    page: "Achievements",
    pageHref: "/achievements",
    icon: Trophy,
    title: "Level Up with Achievements",
    description:
      "Every task you complete earns XP. Overdue tasks deduct XP, so stay on top of deadlines! Unlock badges as you hit milestones. When you level up, a special animation plays and you get a new badge. Keep the streak going!",
    image: "/volty/step-4-plan-upgrade.png",
    highlight: "Complete tasks to earn XP and unlock badges",
    action: "Go to Achievements",
    actionHref: "/achievements",
  },
  {
    id: "assistant",
    page: "Volty AI",
    pageHref: "/assistant",
    icon: Bot,
    title: "Ask Volty Anything",
    description:
      "Volty AI is your built-in assistant. Ask about overdue tasks, open tickets, what to focus on today, or anything else about your workspace. Volty understands natural language — just type like you'd talk.",
    image: "/volty/ChatGPT_Image_May_27__2026__04_08_21_AM__10_-removebg-preview.png",
    highlight: "Type 'What should I focus on today?' to try it out",
    action: "Go to Volty AI",
    actionHref: "/assistant",
  },
  {
    id: "apps",
    page: "Apps",
    pageHref: "/environments",
    icon: Layers3,
    title: "Apps — Docs & Spreadsheets",
    description:
      "The Apps page gives you built-in document and spreadsheet tools. Open Volte Docs to write and format documents, or Volte Sheets to view and edit data — all inside Volt without leaving your workspace.",
    image: "/volty/step-6-goodbye.png",
    highlight: "Click a tool card to open the editor",
    action: "Go to Apps",
    actionHref: "/environments",
  },
  {
    id: "done",
    page: "All done!",
    pageHref: "/dashboards",
    icon: CheckCircle2,
    title: "You're all set! ⚡",
    description:
      "That's the full Volt tour! You now know how to create tasks, raise tickets, manage projects, track your team, earn achievements, and use Volty AI. Head to your dashboard and start getting things done.",
    image: "/volty/team-idle-05.png",
    highlight: "Go to your dashboard and start working",
    action: "Go to Dashboard",
    actionHref: "/dashboards",
  },
]

export default function VoltyWalkPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "true") setDismissed(true)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "true")
    setDismissed(true)
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY)
    setDismissed(false)
    setStep(0)
  }

  function next() {
    if (step < TOUR_STEPS.length - 1) setStep((s) => s + 1)
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1)
  }

  const current = TOUR_STEPS[step]
  const Icon = current.icon
  const isLast = step === TOUR_STEPS.length - 1
  const isFirst = step === 0

  if (!mounted) return null

  if (dismissed) {
    return (
      <DashboardLayout title="Volty Walk" subtitle="Guided tour of Volt">
        <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
          <div className="h-20 w-20 overflow-hidden rounded-3xl border-2 border-primary/30 shadow-xl">
            <img
              src="/volty/team-idle-05.png"
              alt="Volty"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">Volty Walk Completed</h2>
            <p className="mt-2 text-muted-foreground">
              You've already completed the Volt tour. Want to go through it again?
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-6 py-3 text-sm font-bold text-primary transition hover:bg-primary/15"
            >
              <Sparkles className="h-4 w-4" />
              Restart Tour
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboards")}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-bold text-primary-foreground shadow transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Volty Walk" subtitle="Your guided tour of Volt">
      <div className="mx-auto max-w-4xl">
        {/* Progress bar */}
        <div className="mb-6 flex items-center gap-3">
          <span className="text-xs font-bold text-muted-foreground">
            {step + 1} / {TOUR_STEPS.length}
          </span>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
              style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
            Skip tour
          </button>
        </div>

        {/* Step dots */}
        <div className="mb-6 flex items-center justify-center gap-1.5 flex-wrap">
          {TOUR_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === step
                  ? "w-6 bg-primary"
                  : i < step
                  ? "w-2 bg-primary/40"
                  : "w-2 bg-muted",
              )}
            />
          ))}
        </div>

        {/* Main card */}
        <div className="glass-card overflow-hidden rounded-3xl border border-border/60 shadow-2xl">
          <div className="grid md:grid-cols-2">
            {/* Image side */}
            <div className="relative flex items-center justify-center bg-gradient-to-br from-primary/10 via-accent/5 to-background p-8 md:p-12">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              <div className="relative">
                <div className="mx-auto h-52 w-52 overflow-hidden rounded-3xl border-2 border-primary/20 shadow-2xl">
                  <img
                    src={current.image}
                    alt={current.title}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src =
                        "/volty/ChatGPT_Image_May_27__2026__04_08_21_AM__10_-removebg-preview.png"
                    }}
                  />
                </div>
                {/* Page badge */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-primary/30 bg-background/90 px-3 py-1.5 shadow-md backdrop-blur">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-bold text-foreground">{current.page}</span>
                </div>
              </div>
            </div>

            {/* Content side */}
            <div className="flex flex-col justify-between p-8">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-foreground">
                  {current.title}
                </h2>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  {current.description}
                </p>

                <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm font-semibold text-primary">{current.highlight}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                {current.action && current.actionHref && (
                  <button
                    type="button"
                    onClick={() => router.push(current.actionHref!)}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-accent px-5 py-3 text-sm font-bold text-primary-foreground shadow transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20 active:translate-y-0"
                  >
                    {current.action}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={prev}
                    disabled={isFirst}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-muted/30 px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                  {isLast ? (
                    <button
                      type="button"
                      onClick={dismiss}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-primary/15"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Finish Tour
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={next}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm font-bold text-accent transition hover:bg-accent/15"
                    >
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* All steps preview */}
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {TOUR_STEPS.map((s, i) => {
            const SIcon = s.icon
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition",
                  i === step
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : i < step
                    ? "border-border/40 bg-muted/30 text-muted-foreground"
                    : "border-border/30 bg-transparent text-muted-foreground/60 hover:bg-muted/20 hover:text-muted-foreground",
                )}
              >
                {i < step ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <SIcon className="h-4 w-4" />
                )}
                <span className="text-[10px] font-semibold leading-tight">{s.page}</span>
              </button>
            )
          })}
        </div>
      </div>
    </DashboardLayout>
  )
}
