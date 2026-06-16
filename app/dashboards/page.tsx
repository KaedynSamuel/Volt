"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Crown,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  Palette,
  Plus,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  ClipboardList,
  TimerReset,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
  Users,
  Wand2,
  X,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  AppDashboardMembership,
  clearSession,
  getStoredSession,
  storeSession,
} from "@/lib/auth"
import { clearStoredCompanyId, getReadableForeground, storeCompany } from "@/lib/tenant"

type NewDashboardForm = {
  companyName: string
  dashboardName: string
  logoUrl: string
  primaryColor: string
  accentColor: string
}

type Placement = "top" | "bottom" | "left" | "right"
type MascotSide = "left" | "right"

type TourStep = {
  id: number
  title: string
  description: string
  target: string
  placement: Placement
  mascotSide: MascotSide
  image: string
  icon: React.ComponentType<{ className?: string }>
}

type RectState = {
  top: number
  left: number
  width: number
  height: number
}

const VOLT_PRIMARY = "#22c55e"
const VOLT_ACCENT = "#06b6d4"

function applyVoltHubTheme() {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.style.setProperty("--primary", VOLT_PRIMARY)
  root.style.setProperty("--sidebar-primary", VOLT_PRIMARY)
  root.style.setProperty("--ring", VOLT_PRIMARY)
  root.style.setProperty("--chart-1", VOLT_PRIMARY)
  root.style.setProperty("--gradient-start", VOLT_PRIMARY)
  root.style.setProperty("--accent", VOLT_ACCENT)
  root.style.setProperty("--chart-3", VOLT_ACCENT)
  root.style.setProperty("--gradient-end", VOLT_ACCENT)

  const primaryForeground = getReadableForeground(VOLT_PRIMARY)
  const accentForeground = getReadableForeground(VOLT_ACCENT)
  root.style.setProperty("--primary-foreground", primaryForeground)
  root.style.setProperty("--sidebar-primary-foreground", primaryForeground)
  root.style.setProperty("--accent-foreground", accentForeground)
  root.style.setProperty("--sidebar-accent-foreground", accentForeground)
}

const emptyForm: NewDashboardForm = {
  companyName: "",
  dashboardName: "",
  logoUrl: "",
  primaryColor: VOLT_PRIMARY,
  accentColor: VOLT_ACCENT,
}

const softMotion =
  "transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] active:translate-y-0 active:scale-[0.99]"

const shineMotion =
  "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:bg-foreground/10 before:transition-transform before:duration-700 hover:before:translate-x-full"

const VOLTY_IMAGES = {
  welcome: "/volty/step-1-welcome.png",
  join: "/volty/step-2-join-codes.png",
  dashboards: "/volty/step-3-dashboards.png",
  plan: "/volty/step-4-plan-upgrade.png",
  build: "/volty/step-5-build-dashboard.png",
  goodbye: "/volty/step-6-goodbye.png",
}

const VOLTY_ROTATION_IMAGES = [
  "/volty/volty-1.png",
  "/volty/volty-2.png",
  "/volty/volty-3.png",
  "/volty/volty-4.png",
  "/volty/volty-5.png",
  "/volty/volty-6.png",
  "/volty/volty-7.png",
  "/volty/volty-8.png",
]

const guideSlides = [
  {
    title: "Pick your company dashboard",
    description:
      "Every company workspace is separated, so your tasks, tickets, team members and company data stay organised.",
    icon: LayoutDashboard,
  },
  {
    title: "Join or create a workspace",
    description:
      "Use the dashboard your admin assigned to you, or create a new branded dashboard if your role allows it.",
    icon: ShieldCheck,
  },
  {
    title: "Customise the Volt experience",
    description:
      "Each dashboard can have its own name, logo and colours while still keeping the clean Volt app structure.",
    icon: Palette,
  },
  {
    title: "Let Volty guide the team",
    description:
      "Volty helps users understand where they are, what each hub action does, and how to start using the dashboard app.",
    icon: Sparkles,
  },
]

const welcomeSlides = [
  {
    eyebrow: "Welcome to Volt Dashboard",
    title: "Volt Hub",
    description:
      "Open dashboards, build new workspaces, join teams, and give your company a cleaner, smarter way to get work done.",
    icon: Zap,
    image: VOLTY_IMAGES.welcome,
    tag: "Charge your work. Power your team.",
    type: "welcome",
  },
  {
    eyebrow: "Patch Notes",
    title: "What’s new in Volt",
    description:
      "A cleaner dashboard hub, improved workspace switching, smoother create-dashboard flow, and Volty’s guided walkthrough are now ready for your team.",
    icon: ClipboardList,
    image: VOLTY_IMAGES.dashboards,
    tag: "Fresh updates for faster teamwork.",
    type: "patch",
  },
  {
    eyebrow: "Achievements Page",
    title: "Turn progress into motivation",
    description:
      "Achievements reward real work. Completing tasks, resolving tickets, hitting streaks, and staying consistent can unlock badges, XP, levels, and progress moments your team can celebrate.",
    icon: Trophy,
    image: VOLTY_IMAGES.build,
    tag: "Work hard. Level up. Celebrate progress.",
    type: "achievements",
  },
  {
    eyebrow: "Meet Volty",
    title: "Your Volt AI assistant",
    description:
      "Volty helps explain the hub, guide users through the app, point to important actions, and make Volt feel easier, friendlier, and more interactive.",
    icon: Sparkles,
    image: VOLTY_IMAGES.goodbye,
    tag: "A little spark to guide the way.",
    type: "volty",
  },
]

const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    title: "Welcome to your Volt Hub",
    description:
      "This is your main dashboard hub. From here you can open company dashboards, join workspaces, create dashboards, and manage your starting point inside Volt.",
    target: '[data-tour="hub-welcome"]',
    placement: "bottom",
    mascotSide: "right",
    image: VOLTY_IMAGES.welcome,
    icon: Sparkles,
  },
  {
    id: 2,
    title: "Admin-created login",
    description:
      "Use this button when an admin gives you a join code. It lets team members securely join the correct company dashboard.",
    target: '[data-tour="join-code"]',
    placement: "right",
    mascotSide: "left",
    image: VOLTY_IMAGES.join,
    icon: ShieldCheck,
  },
  {
    id: 3,
    title: "Your dashboard list",
    description:
      "This side panel holds all dashboards connected to your account. Click any dashboard to open that workspace instantly.",
    target: '[data-tour="dashboard-list"]',
    placement: "right",
    mascotSide: "left",
    image: VOLTY_IMAGES.dashboards,
    icon: LayoutDashboard,
  },
  {
    id: 4,
    title: "Your current plan",
    description:
      "This plan area shows the current access level. Later, you can connect this to billing so users can upgrade for more dashboards and features.",
    target: '[data-tour="plan-card"]',
    placement: "left",
    mascotSide: "right",
    image: VOLTY_IMAGES.plan,
    icon: Crown,
  },
  {
    id: 5,
    title: "Build a new dashboard",
    description:
      "Admins, creators, and business owners can build new dashboards here. Add the company name, dashboard name, logo and colours.",
    target: '[data-tour="build-dashboard"]',
    placement: "left",
    mascotSide: "right",
    image: VOLTY_IMAGES.build,
    icon: Plus,
  },
  {
    id: 6,
    title: "See you in your dashboard",
    description:
      "That is the hub walkthrough done. Pick your dashboard and I’ll see you inside Volt. Until next time!",
    target: '[data-tour="hub-welcome"]',
    placement: "bottom",
    mascotSide: "right",
    image: VOLTY_IMAGES.goodbye,
    icon: Check,
  },
]

function getInitials(value?: string) {
  if (!value?.trim()) return "VT"

  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}

function isValidHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

function VoltyCard({
  message,
  image = VOLTY_IMAGES.welcome,
}: {
  message: string
  image?: string
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-primary/10 p-4 shadow-lg shadow-primary/10">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/25 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <div className="relative h-32 w-32 shrink-0">
          <Image
            src={image}
            alt="Volty mascot"
            fill
            sizes="128px"
            className="object-contain drop-shadow-2xl"
            priority
          />
        </div>

        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-foreground">Volty</p>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary">
              AI Assistant
            </span>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  )
}

function DashboardHubTour({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<RectState | null>(null)

  const currentStep = TOUR_STEPS[stepIndex]
  const Icon = currentStep.icon
  const isLastStep = stepIndex === TOUR_STEPS.length - 1

  useEffect(() => {
    if (!open) return

    const updateTarget = () => {
      const el = document.querySelector(currentStep.target) as HTMLElement | null

      if (!el) {
        setTargetRect(null)
        return
      }

      const rect = el.getBoundingClientRect()

      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
    }

    updateTarget()

    window.addEventListener("resize", updateTarget)
    window.addEventListener("scroll", updateTarget, true)

    return () => {
      window.removeEventListener("resize", updateTarget)
      window.removeEventListener("scroll", updateTarget, true)
    }
  }, [open, currentStep])

  useEffect(() => {
    if (!open) return

    const bodyOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = bodyOverflow
    }
  }, [open])

  const cardPosition = useMemo(() => {
    const CARD_WIDTH = 430
    const CARD_HEIGHT = 280
    const GAP = 18
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1440
    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : 900

    if (!targetRect || viewportWidth < 900) {
      return {
        top: viewportHeight / 2 - CARD_HEIGHT / 2,
        left: viewportWidth / 2 - CARD_WIDTH / 2,
      }
    }

    let top = 0
    let left = 0

    switch (currentStep.placement) {
      case "top":
        top = targetRect.top - CARD_HEIGHT - GAP
        left = targetRect.left + targetRect.width / 2 - CARD_WIDTH / 2
        break

      case "bottom":
        top = targetRect.top + targetRect.height + GAP
        left = targetRect.left + targetRect.width / 2 - CARD_WIDTH / 2
        break

      case "left":
        top = targetRect.top + targetRect.height / 2 - CARD_HEIGHT / 2
        left = targetRect.left - CARD_WIDTH - GAP
        break

      case "right":
        top = targetRect.top + targetRect.height / 2 - CARD_HEIGHT / 2
        left = targetRect.left + targetRect.width + GAP
        break
    }

    return {
      top: clamp(top, 20, viewportHeight - CARD_HEIGHT - 20),
      left: clamp(left, 20, viewportWidth - CARD_WIDTH - 20),
    }
  }, [targetRect, currentStep])

  if (!open) return null

  function handleNext() {
    if (isLastStep) {
      window.localStorage.setItem("volt-hub-tour-seen", "true")
      onClose()
      return
    }

    setStepIndex((prev) => prev + 1)
  }

  function handlePrev() {
    if (stepIndex === 0) return
    setStepIndex((prev) => prev - 1)
  }

  function handleSkip() {
    window.localStorage.setItem("volt-hub-tour-seen", "true")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      {targetRect && (
        <div
          className="pointer-events-none absolute rounded-[1.75rem] border-2 border-cyan-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.45),0_0_40px_rgba(34,211,238,0.45)] transition-all duration-300"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      <div
        className="absolute w-[430px] max-w-[calc(100vw-2rem)] rounded-[2rem] border border-white/25 bg-white/95 p-5 text-slate-950 shadow-2xl transition-all duration-300"
        style={{
          top: cardPosition.top,
          left: cardPosition.left,
        }}
      >
        <button
          type="button"
          onClick={handleSkip}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          <div
            className={`pointer-events-none absolute -top-28 hidden h-[185px] w-[185px] sm:block ${
              currentStep.mascotSide === "right"
                ? "right-0 translate-x-1/3"
                : "left-0 -translate-x-1/3"
            }`}
          >
            <Image
              src={currentStep.image}
              alt="Volty tutorial mascot"
              fill
              sizes="185px"
              className="object-contain drop-shadow-2xl"
              priority
            />
          </div>

          <div className="pr-10">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
              <Icon className="h-3.5 w-3.5" />
              Step {stepIndex + 1} of {TOUR_STEPS.length}
            </div>

            <h3 className="text-2xl font-black tracking-tight">
              {currentStep.title}
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {currentStep.description}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleSkip}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Skip Tutorial
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={stepIndex === 0}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Prev
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-300/30 transition hover:scale-[1.02]"
              >
                {isLastStep ? "Finish" : "Next"}
                {!isLastStep && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStepIndex(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === stepIndex ? "w-8 bg-cyan-500" : "w-2.5 bg-slate-300"
                }`}
                aria-label={`Go to tutorial step ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


function VoltyInfoModal({
  open,
  onClose,
  onStartTour,
}: {
  open: boolean
  onClose: () => void
  onStartTour: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
      <div className="glass-card relative w-full max-w-[560px] overflow-hidden rounded-[2rem] border border-border/70 bg-card/95 p-5 shadow-2xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative grid gap-4 sm:grid-cols-[160px_1fr] sm:items-center">
          <div className="mx-auto h-40 w-40 sm:mx-0">
            <Image
              src={VOLTY_IMAGES.welcome}
              alt="Volty assistant"
              width={160}
              height={160}
              className="h-full w-full object-contain drop-shadow-2xl"
              priority
            />
          </div>

          <div className="min-w-0 pr-8">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Meet Volty
            </div>

            <h2 className="text-2xl font-black tracking-tight">
              Your Volt AI assistant
            </h2>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Volty is the friendly AI assistant for Volt Dashboard. He is here
              to guide users through the hub, explain features, point out
              important actions, and help every team member understand how to
              use Volt with confidence.
            </p>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              In the future, Volty can become the assistant that helps answer
              dashboard questions, guide users through tasks and tickets, and
              make the app feel more interactive and helpful.
            </p>
          </div>
        </div>

        <div className="relative mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-10 rounded-xl px-4 text-sm font-bold"
          >
            Close
          </Button>

          <Button
            type="button"
            onClick={onStartTour}
            className="h-10 rounded-xl bg-gradient-to-r from-primary via-accent to-primary px-4 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20"
          >
            <Rocket className="mr-2 h-4 w-4" />
            Start Volty Tour
          </Button>
        </div>
      </div>
    </div>
  )
}


export default function DashboardsPage() {
  const router = useRouter()

  const [mounted, setMounted] = useState(false)
  const [dashboards, setDashboards] = useState<AppDashboardMembership[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [editingDashboard, setEditingDashboard] = useState<AppDashboardMembership | null>(null)
  const [deletingDashboard, setDeletingDashboard] = useState<AppDashboardMembership | null>(null)
  const [editForm, setEditForm] = useState<NewDashboardForm>(emptyForm)
  const [showTour, setShowTour] = useState(false)
  const [showVoltyInfo, setShowVoltyInfo] = useState(false)
  const [form, setForm] = useState<NewDashboardForm>(emptyForm)
  const [canCreateDashboard, setCanCreateDashboard] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const [activeWelcomeSlide, setActiveWelcomeSlide] = useState(0)
  const [welcomeSliderPaused, setWelcomeSliderPaused] = useState(false)
  const [voltyRotationIndex, setVoltyRotationIndex] = useState(0)

  const safePrimaryColor = isValidHexColor(form.primaryColor)
    ? form.primaryColor
    : VOLT_PRIMARY

  const safeAccentColor = isValidHexColor(form.accentColor)
    ? form.accentColor
    : VOLT_ACCENT

  const previewInitials = useMemo(
    () => getInitials(form.companyName || form.dashboardName),
    [form.companyName, form.dashboardName],
  )

  const currentSlide = guideSlides[activeSlide]
  const CurrentSlideIcon = currentSlide.icon
  const currentWelcomeSlide = welcomeSlides[activeWelcomeSlide]
  const CurrentWelcomeIcon = currentWelcomeSlide.icon
  const rotatingVoltyImage = VOLTY_ROTATION_IMAGES[voltyRotationIndex]

  useEffect(() => {
    applyVoltHubTheme()
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const seen = window.localStorage.getItem("volt-hub-tour-seen")

    if (!seen) {
      const timer = window.setTimeout(() => setShowTour(true), 650)
      return () => window.clearTimeout(timer)
    }
  }, [mounted])

  useEffect(() => {
    if (!mounted || welcomeSliderPaused) return

    const interval = window.setInterval(() => {
      setActiveWelcomeSlide((current) => (current + 1) % welcomeSlides.length)
    }, 7000)

    return () => window.clearInterval(interval)
  }, [mounted, welcomeSliderPaused])

  useEffect(() => {
    if (!mounted) return

    const interval = window.setInterval(() => {
      setVoltyRotationIndex(
        (current) => (current + 1) % VOLTY_ROTATION_IMAGES.length,
      )
    }, 5000)

    return () => window.clearInterval(interval)
  }, [mounted])

  function nextWelcomeSlide() {
    setActiveWelcomeSlide((current) => (current + 1) % welcomeSlides.length)
  }

  function previousWelcomeSlide() {
    setActiveWelcomeSlide((current) =>
      current === 0 ? welcomeSlides.length - 1 : current - 1,
    )
  }

  async function loadDashboards() {
    try {
      setLoading(true)
      setError("")

      const storedSession = getStoredSession()

      if (!storedSession) {
        router.push("/login")
        return
      }

      setCanCreateDashboard(
        ["creator", "business_owner", "admin"].includes(
          String(storedSession.role),
        ),
      )

      const response = await fetch(
        `/api/dashboards?email=${encodeURIComponent(storedSession.email)}`,
        { cache: "no-store" },
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.details || data?.error || "Failed to load dashboards",
        )
      }

      setDashboards(Array.isArray(data) ? data : [])

      storeSession({
        ...storedSession,
        dashboards: Array.isArray(data) ? data : [],
      })
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load dashboards",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!mounted) return

    loadDashboards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted])

  function openDashboard(dashboard: AppDashboardMembership) {
    const storedSession = getStoredSession()

    if (!storedSession) {
      router.push("/login")
      return
    }

    const nextSession = {
      ...storedSession,
      userId: dashboard.userId,
      companyId: dashboard.companyId,
      fullName: dashboard.fullName,
      email: dashboard.email,
      role: dashboard.role,
      dashboards,
    }

    storeSession(nextSession)
    storeCompany(dashboard.company)
    router.push(["creator", "business_owner", "admin"].includes(String(dashboard.role)) ? "/company-overview" : "/my-dashboard")
  }

  function logout() {
    clearSession()
    clearStoredCompanyId()
    router.push("/login")
  }

  function nextSlide() {
    setActiveSlide((current) => (current + 1) % guideSlides.length)
  }

  function previousSlide() {
    setActiveSlide((current) =>
      current === 0 ? guideSlides.length - 1 : current - 1,
    )
  }

  function restartTour() {
    window.localStorage.removeItem("volt-hub-tour-seen")
    setShowTour(true)
  }

  function startEditDashboard(dashboard: AppDashboardMembership) {
    setEditingDashboard(dashboard)
    setEditForm({
      companyName: dashboard.company.name || "",
      dashboardName: dashboard.company.dashboardName || "",
      logoUrl: dashboard.company.logoUrl || "",
      primaryColor: dashboard.company.primaryColor || VOLT_PRIMARY,
      accentColor: dashboard.company.accentColor || VOLT_ACCENT,
    })
  }

  async function updateDashboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editingDashboard) return

    const storedSession = getStoredSession()

    if (!storedSession) {
      router.push("/login")
      return
    }

    if (!editForm.companyName.trim() || !editForm.dashboardName.trim()) {
      setError("Company name and dashboard name are required.")
      return
    }

    if (
      !isValidHexColor(editForm.primaryColor) ||
      !isValidHexColor(editForm.accentColor)
    ) {
      setError("Please use valid HEX colours, for example #22c55e.")
      return
    }

    try {
      setSaving(true)
      setError("")

      const response = await fetch("/api/dashboards", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(storedSession.userId),
          "x-user-email": storedSession.email,
        },
        body: JSON.stringify({
          companyId: editingDashboard.companyId,
          ...editForm,
          updatedByUserId: storedSession.userId,
          updatedByEmail: storedSession.email,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.details || data?.error || "Failed to update dashboard",
        )
      }

      setEditingDashboard(null)
      await loadDashboards()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update dashboard",
      )
    } finally {
      setSaving(false)
    }
  }

  async function deleteDashboard() {
    if (!deletingDashboard) return

    const storedSession = getStoredSession()

    if (!storedSession) {
      router.push("/login")
      return
    }

    try {
      setSaving(true)
      setError("")

      const response = await fetch("/api/dashboards", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(storedSession.userId),
          "x-user-email": storedSession.email,
        },
        body: JSON.stringify({
          companyId: deletingDashboard.companyId,
          deletedByUserId: storedSession.userId,
          deletedByEmail: storedSession.email,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.details || data?.error || "Failed to delete dashboard",
        )
      }

      setDeletingDashboard(null)
      await loadDashboards()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not delete dashboard",
      )
    } finally {
      setSaving(false)
    }
  }

  async function createDashboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const storedSession = getStoredSession()

    if (!storedSession) {
      router.push("/login")
      return
    }

    if (!form.companyName.trim() || !form.dashboardName.trim()) {
      setError("Company name and dashboard name are required.")
      return
    }

    if (!isValidHexColor(form.primaryColor) || !isValidHexColor(form.accentColor)) {
      setError("Please use valid HEX colours, for example #22c55e.")
      return
    }

    try {
      setSaving(true)
      setError("")

      const response = await fetch("/api/dashboards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(storedSession.userId),
          "x-user-email": storedSession.email,
        },
        body: JSON.stringify({
          ...form,
          creatorUserId: storedSession.userId,
          creatorEmail: storedSession.email,
          creatorName: storedSession.fullName,
          ownerName: storedSession.fullName,
          ownerEmail: storedSession.email,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.details || data?.error || "Failed to create dashboard",
        )
      }

      setForm(emptyForm)
      setShowCreate(false)
      await loadDashboards()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not create dashboard",
      )
    } finally {
      setSaving(false)
    }
  }

  if (!mounted) {
    return (
      <main className="min-h-screen bg-background p-5 text-foreground">
        <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center">
          <div className="glass-card flex items-center gap-2 rounded-2xl border border-border/70 px-5 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading dashboards...
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.13),transparent_30%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.15),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />

      <div className="mx-auto grid min-h-screen max-w-[1500px] gap-4 p-4 lg:grid-cols-[320px_1fr]">
        <aside className="glass-card flex max-h-[calc(100vh-2rem)] flex-col rounded-[2rem] border border-border/70 bg-card/75 p-4 shadow-2xl overflow-hidden">
          <div className="mb-4 flex items-center gap-3 border-b border-border/70 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
              <Zap className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">
                Volt Hub
              </p>
              <h1 className="truncate text-lg font-black">Dashboards</h1>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-border/70 bg-background/50 p-2.5">
              <p className="text-lg font-black">{dashboards.length}</p>
              <p className="text-[11px] font-medium text-muted-foreground">
                Workspaces
              </p>
            </div>

            <div
              data-tour="plan-card"
              className="rounded-2xl border border-primary/20 bg-primary/10 p-2.5"
            >
              <p className="text-lg font-black text-primary">
                {canCreateDashboard ? "Pro" : "User"}
              </p>
              <p className="text-[11px] font-medium text-muted-foreground">
                Current plan
              </p>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
              Your dashboards
            </p>

            {canCreateDashboard && (
              <button
                type="button"
                onClick={() => setShowCreate((value) => !value)}
                className={`flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary ${softMotion}`}
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>

          <div
            data-tour="dashboard-list"
            className="volt-dashboard-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
          >
            {loading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/45 p-3 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Loading dashboards...
              </div>
            ) : dashboards.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-background/45 p-4 text-center">
                <Building2 className="mx-auto h-7 w-7 text-primary" />
                <p className="mt-2 text-sm font-black">No dashboards yet</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Join one with a code or create a workspace.
                </p>
              </div>
            ) : (
              dashboards.map((dashboard) => {
                const primaryColor =
                  dashboard.company.primaryColor || VOLT_PRIMARY
                const accentColor = dashboard.company.accentColor || VOLT_ACCENT
                const dashboardInitials = getInitials(dashboard.company.name)

                return (
                  <div
                    key={`${dashboard.companyId}-${dashboard.userId}`}
                    className={`group relative w-full rounded-2xl border border-border/70 bg-background/50 p-3 text-left hover:border-primary/40 hover:bg-primary/[0.04] ${softMotion}`}
                  >
                    <button
                      type="button"
                      onClick={() => openDashboard(dashboard)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-3 pr-7">
                        {dashboard.company.logoUrl ? (
                          <img
                            src={dashboard.company.logoUrl}
                            alt={`${dashboard.company.name} logo`}
                            className="h-10 w-10 rounded-xl border border-border bg-background object-contain p-1"
                          />
                        ) : (
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-xs font-black text-white shadow-md"
                            style={{
                              background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                            }}
                          >
                            {dashboardInitials}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black">
                            {dashboard.company.dashboardName}
                          </p>
                          <p className="truncate text-[11px] capitalize text-muted-foreground">
                            {dashboard.role.replace(/_/g, " ")}
                          </p>
                        </div>
                      </div>
                    </button>

                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground transition group-hover:opacity-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </div>

                      <div className="absolute right-0 top-1/2 z-30 flex -translate-y-1/2 translate-x-2 scale-95 items-center gap-1 rounded-2xl border border-border/70 bg-card/95 p-1 opacity-0 shadow-2xl shadow-foreground/10 backdrop-blur-xl transition-all duration-200 group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => openDashboard(dashboard)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                          title="Open dashboard"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => startEditDashboard(dashboard)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-accent/10 hover:text-accent"
                          title="Edit dashboard branding"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingDashboard(dashboard)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                          title="Delete dashboard"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="mt-4 space-y-2.5 border-t border-border/70 pt-4">
            <div
              data-tour="join-code"
              className="rounded-xl border border-border/70 bg-background/50 px-3 py-2 text-center text-[11px] font-semibold text-muted-foreground"
            >
              Users are added by admins from the Team page.
            </div>

            {canCreateDashboard && (
              <Button
                data-tour="build-dashboard"
                onClick={() => setShowCreate(true)}
                className={`h-9 w-full rounded-xl bg-gradient-to-r from-primary via-accent to-primary text-xs font-black text-primary-foreground shadow-lg shadow-primary/20 ${softMotion} ${shineMotion}`}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Create Dashboard
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={restartTour}
              className={`h-9 w-full rounded-xl border-accent/30 bg-accent/10 text-xs font-bold text-accent ${softMotion}`}
            >
              <Rocket className="mr-2 h-4 w-4" />
              Start Volty Tour
            </Button>

            <Button
              variant="ghost"
              onClick={logout}
              className={`h-9 w-full rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground ${softMotion}`}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          {error && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
              {error}
            </div>
          )}

          <div
            data-tour="hub-welcome"
            className="glass-card relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/75 p-5 shadow-2xl sm:p-6"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-primary/15 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 right-28 h-44 w-44 rounded-full bg-accent/15 blur-3xl" />

            <div
              className="relative"
              onMouseEnter={() => setWelcomeSliderPaused(true)}
              onMouseLeave={() => setWelcomeSliderPaused(false)}
            >
              <div className="grid gap-5 xl:grid-cols-[1fr_340px] xl:items-center">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary">
                    <CurrentWelcomeIcon className="h-3.5 w-3.5" />
                    {currentWelcomeSlide.eyebrow}
                  </div>

                  <h2 className="max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
                    {currentWelcomeSlide.title}
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {currentWelcomeSlide.description}
                  </p>

                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3.5 py-2 text-xs font-black text-cyan-300 shadow-lg shadow-cyan-400/10">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300" />
                    </span>
                    <Zap className="h-3.5 w-3.5" />
                    {currentWelcomeSlide.tag}
                  </div>

                  <div className="mt-6">
                    <div className="flex flex-wrap items-center gap-2">
                    {canCreateDashboard && (
                      <button
                        type="button"
                        onClick={() => setShowCreate(true)}
                        className={`group relative h-9 overflow-hidden rounded-xl border border-primary/35 bg-primary/10 px-4 text-xs font-black text-primary shadow-lg shadow-primary/10 backdrop-blur transition hover:border-primary/60 hover:bg-primary/15 ${softMotion}`}
                      >
                        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                        <span className="relative flex items-center">
                          <Wand2 className="mr-2 h-3.5 w-3.5" />
                          Build Dashboard
                        </span>
                      </button>
                    )}

                    {currentWelcomeSlide.type === "patch" && (
                      <button
                        type="button"
                        onClick={() => setActiveWelcomeSlide(1)}
                        className={`h-9 rounded-xl border border-sky-400/25 bg-sky-400/10 px-3 text-xs font-bold text-sky-300 hover:border-sky-400/45 hover:bg-sky-400/15 ${softMotion}`}
                      >
                        View Patch Notes
                      </button>
                    )}

                    {currentWelcomeSlide.type === "achievements" && (
                      <button
                        type="button"
                        className={`h-9 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 text-xs font-bold text-amber-300 hover:border-amber-400/45 hover:bg-amber-400/15 ${softMotion}`}
                      >
                        Explore Achievements
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowVoltyInfo(true)}
                      className={`h-9 rounded-xl border border-accent/25 bg-accent/10 px-3 text-xs font-bold text-accent hover:bg-accent/15 ${softMotion}`}
                    >
                      <span className="flex items-center">
                        <Sparkles className="mr-2 h-3.5 w-3.5" />
                        Meet Volty
                      </span>
                    </button>
                    </div>
                  </div>
                </div>

                <VoltyCard
                  image={currentWelcomeSlide.image}
                  message={
                    currentWelcomeSlide.type === "welcome"
                      ? "Welcome to Volt. Build your workspace, power your team, and keep progress moving."
                      : currentWelcomeSlide.type === "patch"
                        ? "Patch notes will keep your team updated as Volt grows and new features launch."
                        : currentWelcomeSlide.type === "achievements"
                          ? "Achievements help turn everyday progress into something your team can feel proud of."
                          : "I’m Volty, your assistant inside Volt. I’ll guide users and help the app feel easier to use."
                  }
                />
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {welcomeSlides.map((slide, index) => (
                    <button
                      key={slide.title}
                      type="button"
                      onClick={() => setActiveWelcomeSlide(index)}
                      className={`h-2.5 rounded-full transition-all ${
                        activeWelcomeSlide === index
                          ? "w-8 bg-primary"
                          : "w-2.5 bg-muted-foreground/30 hover:bg-primary/50"
                      }`}
                      aria-label={`Go to ${slide.title}`}
                    />
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={previousWelcomeSlide}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border border-border/70 bg-background/60 text-muted-foreground hover:text-primary ${softMotion}`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={nextWelcomeSlide}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border border-border/70 bg-background/60 text-muted-foreground hover:text-primary ${softMotion}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <div className="glass-card rounded-[2rem] border border-border/70 bg-card/75 p-5 shadow-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                  <Zap className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                    Why teams use Volt
                  </p>
                  <h3 className="text-xl font-black">Work smarter, stay motivated</h3>
                </div>
              </div>

              <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>
                  Volt brings your tasks, tickets, dashboards, teams, and
                  progress into one powerful workspace built for real business
                  momentum.
                </p>

                <p>
                  It is professional enough to manage company work, but
                  interactive enough to make progress feel rewarding. Complete
                  tasks, resolve tickets, unlock achievements, track growth, and
                  turn hard work into something your team can actually see.
                </p>

                <p>
                  Create a dashboard for each company, project, or team. Keep
                  everything organised, give people the right access, and build a
                  workspace that feels alive from the moment they open it.
                </p>

                <p>
                  Volt is made for teams that want to move faster, stay aligned,
                  and bring more energy into the way they work.
                </p>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
                  <p className="text-xs font-black text-primary">Build</p>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    Create branded dashboards for every workspace.
                  </p>
                </div>

                <div className="rounded-2xl border border-accent/20 bg-accent/10 p-3">
                  <p className="text-xs font-black text-accent">Track</p>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    Manage tasks, tickets, progress and activity.
                  </p>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
                  <p className="text-xs font-black text-primary">Reward</p>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    Unlock achievements and celebrate hard work.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 p-4">
                <p className="flex items-center gap-2 text-sm font-black text-primary">
                  <Sparkles className="h-4 w-4" />
                  Build your workspace. Power your team. Be the lightning in your industry.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="glass-card rounded-[2rem] border border-border/70 bg-card/75 p-5 shadow-xl">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                  Hub Activities
                </p>

                <div className="mt-4 grid gap-2">
                  <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <LayoutDashboard className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black">Open workspace</p>
                        <p className="text-xs text-muted-foreground">
                          Select any dashboard from the side panel.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black">Join a team</p>
                        <p className="text-xs text-muted-foreground">
                          Your admin creates users and assigns roles in the Team page.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Code2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black">Create access</p>
                        <p className="text-xs text-muted-foreground">
                          Admins can build and brand workspaces.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <VoltyCard
                image={rotatingVoltyImage}
                message="Start by picking a dashboard from the left. If this is a new company, create a workspace and choose the logo and colours."
              />
            </div>
          </div>

          {showCreate && (
            <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/55 px-4 py-4 backdrop-blur-sm">
              <button
                type="button"
                aria-label="Close create dashboard popup"
                onClick={() => setShowCreate(false)}
                className="absolute inset-0 cursor-default"
              />

              <form
                onSubmit={createDashboard}
                className="glass-card relative z-10 max-h-[92vh] w-full max-w-[920px] overflow-y-auto rounded-[2rem] border border-border/70 bg-card/95 p-4 shadow-2xl"
              >
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/70 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>

                  <div>
                    <h2 className="text-base font-black">Create new dashboard</h2>
                    <p className="text-xs text-muted-foreground">
                      Set up a professional company workspace with its own name, logo and colour identity.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreate(false)}
                  className={`h-9 rounded-xl px-3 text-xs font-bold ${softMotion}`}
                >
                  Close
                </Button>
              </div>

              <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                <aside className="order-2 rounded-3xl border border-border/70 bg-background/45 p-3.5 xl:order-1">
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Dashboard studio
                  </p>

                  <div className="rounded-2xl border border-border/70 bg-card/70 p-3 shadow-lg">
                    <div className="mb-3 flex items-center gap-3">
                      {form.logoUrl ? (
                        <img
                          src={form.logoUrl}
                          alt="Dashboard logo preview"
                          className="h-12 w-12 rounded-2xl border border-border bg-background object-contain p-1"
                        />
                      ) : (
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black text-white shadow-md"
                          style={{
                            background: `linear-gradient(135deg, ${safePrimaryColor}, ${safeAccentColor})`,
                          }}
                        >
                          {previewInitials}
                        </div>
                      )}

                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-black">
                          {form.dashboardName || "New Dashboard"}
                        </h3>

                        <p className="truncate text-xs text-muted-foreground">
                          {form.companyName || "Company name"}
                        </p>
                      </div>
                    </div>

                    <div
                      className="mb-3 h-2 rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${safePrimaryColor}, ${safeAccentColor})`,
                      }}
                    />

                    <div className="grid gap-2">
                      <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-3 py-2">
                        <span className="text-xs font-bold text-muted-foreground">
                          Main colour
                        </span>
                        <span
                          className="h-4 w-4 rounded-full border border-border"
                          style={{ backgroundColor: safePrimaryColor }}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-3 py-2">
                        <span className="text-xs font-bold text-muted-foreground">
                          Accent colour
                        </span>
                        <span
                          className="h-4 w-4 rounded-full border border-border"
                          style={{ backgroundColor: safeAccentColor }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-accent/20 bg-accent/10 p-3 text-xs leading-5 text-muted-foreground">
                    Your dashboard will keep the Volt structure but use this
                    company branding.
                  </div>
                </aside>

                <div className="order-1 space-y-3 xl:order-2">
                  <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-black">Dashboard details</h3>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1.5">
                        <span className="text-xs font-bold text-muted-foreground">
                          Company name
                        </span>

                        <input
                          value={form.companyName}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              companyName: event.target.value,
                              dashboardName:
                                prev.dashboardName ||
                                `${event.target.value} Dashboard`,
                            }))
                          }
                          placeholder="PK Capital"
                          className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-xs font-bold text-muted-foreground">
                          Dashboard name
                        </span>

                        <input
                          value={form.dashboardName}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              dashboardName: event.target.value,
                            }))
                          }
                          placeholder="PK Capital Dashboard"
                          className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Upload className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-black">Brand logo</h3>
                    </div>

                    <label className="space-y-1.5">
                      <span className="text-xs font-bold text-muted-foreground">
                        Logo URL
                      </span>

                      <div className="relative">
                        <ImageIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                        <input
                          value={form.logoUrl}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              logoUrl: event.target.value,
                            }))
                          }
                          placeholder="https://your-logo-url.png"
                          className="h-10 w-full rounded-xl border border-border/80 bg-background/70 pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                    </label>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-black">Colour identity</h3>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            primaryColor: VOLT_PRIMARY,
                            accentColor: VOLT_ACCENT,
                          }))
                        }
                        className={`rounded-xl border border-border/70 bg-background/70 px-3 py-1.5 text-[11px] font-black text-muted-foreground hover:border-primary/30 hover:text-primary ${softMotion}`}
                      >
                        Use Volt default
                      </button>
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-card/55 p-3">
                      <div className="mb-3 flex items-center gap-2">
                        <div
                          className="h-9 flex-1 rounded-xl border border-border/50"
                          style={{
                            background: `linear-gradient(90deg, ${safePrimaryColor}, ${safeAccentColor})`,
                          }}
                        />
                        <div
                          className="h-9 w-9 rounded-xl border border-border/50"
                          style={{ backgroundColor: safePrimaryColor }}
                        />
                        <div
                          className="h-9 w-9 rounded-xl border border-border/50"
                          style={{ backgroundColor: safeAccentColor }}
                        />
                      </div>

                      <div className="grid gap-2">
                        <label className="grid gap-2 rounded-xl border border-border/70 bg-background/60 p-2.5 sm:grid-cols-[120px_1fr] sm:items-center">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: safePrimaryColor }}
                            />
                            <span className="text-xs font-black text-foreground">
                              Primary
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={safePrimaryColor}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  primaryColor: event.target.value,
                                }))
                              }
                              className="h-8 w-10 cursor-pointer rounded-lg border border-border bg-background p-1"
                            />

                            <input
                              value={form.primaryColor}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  primaryColor: event.target.value,
                                }))
                              }
                              placeholder="#22c55e"
                              className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background/70 px-3 font-mono text-xs font-bold uppercase outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                            />
                          </div>
                        </label>

                        <label className="grid gap-2 rounded-xl border border-border/70 bg-background/60 p-2.5 sm:grid-cols-[120px_1fr] sm:items-center">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: safeAccentColor }}
                            />
                            <span className="text-xs font-black text-foreground">
                              Accent
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={safeAccentColor}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  accentColor: event.target.value,
                                }))
                              }
                              className="h-8 w-10 cursor-pointer rounded-lg border border-border bg-background p-1"
                            />

                            <input
                              value={form.accentColor}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  accentColor: event.target.value,
                                }))
                              }
                              placeholder="#06b6d4"
                              className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background/70 px-3 font-mono text-xs font-bold uppercase outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
                            />
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowCreate(false)}
                      className={`h-10 rounded-xl px-4 text-sm font-bold ${softMotion}`}
                    >
                      Cancel
                    </Button>

                    <Button
                      type="submit"
                      disabled={saving}
                      className={`h-10 rounded-xl bg-gradient-to-r from-primary via-accent to-primary px-4 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 ${softMotion} ${shineMotion}`}
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Create Dashboard
                    </Button>
                  </div>
                </div>
              </div>
              </form>
            </div>
          )}
        </section>
      </div>

      <VoltyInfoModal
        open={showVoltyInfo}
        onClose={() => setShowVoltyInfo(false)}
        onStartTour={() => {
          setShowVoltyInfo(false)
          restartTour()
        }}
      />

      {editingDashboard && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/55 px-4 py-4 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close edit dashboard popup"
            onClick={() => setEditingDashboard(null)}
            className="absolute inset-0 cursor-default"
          />

          <form
            onSubmit={updateDashboard}
            className="glass-card relative z-10 w-full max-w-[720px] rounded-[2rem] border border-border/70 bg-card/95 p-4 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/70 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
                  <Pencil className="h-4 w-4" />
                </div>

                <div>
                  <h2 className="text-base font-black">Edit dashboard branding</h2>
                  <p className="text-xs text-muted-foreground">
                    Update the dashboard name, company name, logo and colours.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingDashboard(null)}
                className={`h-9 rounded-xl px-3 text-xs font-bold ${softMotion}`}
              >
                Close
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-muted-foreground">
                  Company name
                </span>

                <input
                  value={editForm.companyName}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      companyName: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold text-muted-foreground">
                  Dashboard name
                </span>

                <input
                  value={editForm.dashboardName}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      dashboardName: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-bold text-muted-foreground">
                  Logo URL
                </span>

                <div className="relative">
                  <ImageIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <input
                    value={editForm.logoUrl}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        logoUrl: event.target.value,
                      }))
                    }
                    placeholder="https://your-logo-url.png"
                    className="h-10 w-full rounded-xl border border-border/80 bg-background/70 pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </label>

              <label className="rounded-2xl border border-border/70 bg-background/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-black text-foreground">
                    Primary colour
                  </span>
                  <span
                    className="h-4 w-4 rounded-full border border-border"
                    style={{
                      backgroundColor: isValidHexColor(editForm.primaryColor)
                        ? editForm.primaryColor
                        : VOLT_PRIMARY,
                    }}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={
                      isValidHexColor(editForm.primaryColor)
                        ? editForm.primaryColor
                        : VOLT_PRIMARY
                    }
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        primaryColor: event.target.value,
                      }))
                    }
                    className="h-8 w-10 cursor-pointer rounded-lg border border-border bg-background p-1"
                  />

                  <input
                    value={editForm.primaryColor}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        primaryColor: event.target.value,
                      }))
                    }
                    className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background/70 px-3 font-mono text-xs font-bold uppercase outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </label>

              <label className="rounded-2xl border border-border/70 bg-background/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-black text-foreground">
                    Accent colour
                  </span>
                  <span
                    className="h-4 w-4 rounded-full border border-border"
                    style={{
                      backgroundColor: isValidHexColor(editForm.accentColor)
                        ? editForm.accentColor
                        : VOLT_ACCENT,
                    }}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={
                      isValidHexColor(editForm.accentColor)
                        ? editForm.accentColor
                        : VOLT_ACCENT
                    }
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        accentColor: event.target.value,
                      }))
                    }
                    className="h-8 w-10 cursor-pointer rounded-lg border border-border bg-background p-1"
                  />

                  <input
                    value={editForm.accentColor}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        accentColor: event.target.value,
                      }))
                    }
                    className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background/70 px-3 font-mono text-xs font-bold uppercase outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
                  />
                </div>
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingDashboard(null)}
                className={`h-10 rounded-xl px-4 text-sm font-bold ${softMotion}`}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={saving}
                className={`h-10 rounded-xl bg-gradient-to-r from-primary via-accent to-primary px-4 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 ${softMotion} ${shineMotion}`}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      )}

      {deletingDashboard && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
          <div className="glass-card w-full max-w-[440px] rounded-[2rem] border border-destructive/30 bg-card/95 p-5 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive">
                <Trash2 className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-black">Delete dashboard?</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  This will delete “{deletingDashboard.company.dashboardName}”.
                  Only continue if you are sure this dashboard should be removed.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeletingDashboard(null)}
                className={`h-10 rounded-xl px-4 text-sm font-bold ${softMotion}`}
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={saving}
                onClick={deleteDashboard}
                className={`h-10 rounded-xl bg-destructive px-4 text-sm font-black text-destructive-foreground shadow-lg shadow-destructive/20 ${softMotion}`}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete Dashboard
              </Button>
            </div>
          </div>
        </div>
      )}

      <DashboardHubTour open={showTour} onClose={() => setShowTour(false)} />

      <style jsx global>{`
        .volt-dashboard-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .volt-dashboard-scroll::-webkit-scrollbar {
          display: none;
          height: 0;
          width: 0;
        }

        @media (prefers-reduced-motion: reduce) {
          .group:hover,
          button:hover {
            transform: none !important;
          }
        }
      `}</style>
    </main>
  )
}
