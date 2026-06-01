"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LayoutDashboard,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react"

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

type DashboardHubTourProps = {
  open: boolean
  onClose: () => void
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    title: "Welcome to your Dashboard Hub",
    description:
      "This is your Volt Hub. From here you can manage dashboards, open workspaces, and quickly move around your company app.",
    target: '[data-tour="hub-welcome"]',
    placement: "bottom",
    mascotSide: "right",
    image: "/volty/step-1-welcome.png",
    icon: Sparkles,
  },
  {
    id: 2,
    title: "Admin-created users",
    description:
      "Access codes are removed. Admins now create users directly, assign roles, and those dashboards appear after login.",
    target: '[data-tour="join-code"]',
    placement: "right",
    mascotSide: "left",
    image: "/volty/step-2-join-codes.png",
    icon: ShieldCheck,
  },
  {
    id: 3,
    title: "Your Dashboard Section",
    description:
      "This area shows the dashboards you already belong to. Click any dashboard card to open it and start working.",
    target: '[data-tour="dashboard-list"]',
    placement: "right",
    mascotSide: "left",
    image: "/volty/step-3-dashboards.png",
    icon: LayoutDashboard,
  },
  {
    id: 4,
    title: "Your Plan and Upgrade",
    description:
      "Here you can see your current plan, features, and when needed, upgrade to unlock more dashboards, storage, or advanced tools.",
    target: '[data-tour="plan-card"]',
    placement: "left",
    mascotSide: "right",
    image: "/volty/step-4-plan-upgrade.png",
    icon: Star,
  },
  {
    id: 5,
    title: "Build a Dashboard",
    description:
      "Click here to create a brand-new dashboard. You can customise the dashboard name, colours, logo, and company identity.",
    target: '[data-tour="build-dashboard"]',
    placement: "left",
    mascotSide: "right",
    image: "/volty/step-5-build-dashboard.png",
    icon: PlusCircle,
  },
  {
    id: 6,
    title: "See you in your dashboard",
    description:
      "That’s it for now. You’re all set to use Volt. See you in your dashboard — until next time!",
    target: '[data-tour="hub-welcome"]',
    placement: "bottom",
    mascotSide: "right",
    image: "/volty/step-6-goodbye.png",
    icon: Check,
  },
]

type RectState = {
  top: number
  left: number
  width: number
  height: number
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

export default function DashboardHubTour({
  open,
  onClose,
}: DashboardHubTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<RectState | null>(null)

  const currentStep = TOUR_STEPS[stepIndex]
  const Icon = currentStep.icon

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
    const CARD_WIDTH = 420
    const CARD_HEIGHT = 270
    const GAP = 18
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1440
    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : 900

    if (!targetRect) {
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

  const isLastStep = stepIndex === TOUR_STEPS.length - 1

  const handleNext = () => {
    if (isLastStep) {
      localStorage.setItem("volt-hub-tour-seen", "true")
      onClose()
      return
    }

    setStepIndex((prev) => prev + 1)
  }

  const handlePrev = () => {
    if (stepIndex === 0) return
    setStepIndex((prev) => prev - 1)
  }

  const handleSkip = () => {
    localStorage.setItem("volt-hub-tour-seen", "true")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />

      {/* Target Highlight */}
      {targetRect && (
        <div
          className="pointer-events-none absolute rounded-3xl border-2 border-cyan-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] transition-all duration-300"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* Tutorial Card */}
      <div
        className="absolute w-[420px] rounded-[28px] border border-white/20 bg-white/95 p-5 shadow-2xl transition-all duration-300"
        style={{
          top: cardPosition.top,
          left: cardPosition.left,
        }}
      >
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          {/* Volty */}
          <div
            className={`absolute -top-24 ${
              currentStep.mascotSide === "right"
                ? "right-0 translate-x-1/3"
                : "left-0 -translate-x-1/3"
            }`}
          >
            <Image
              src={currentStep.image}
              alt="Volty mascot"
              width={170}
              height={170}
              className="h-[170px] w-[170px] object-contain drop-shadow-2xl"
              priority
            />
          </div>

          <div className="pr-12">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
              <Icon className="h-3.5 w-3.5" />
              Step {stepIndex + 1} of {TOUR_STEPS.length}
            </div>

            <h3 className="text-2xl font-black tracking-tight text-slate-900">
              {currentStep.title}
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {currentStep.description}
            </p>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              onClick={handleSkip}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Skip Tutorial
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={stepIndex === 0}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Prev
              </button>

              <button
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
              <span
                key={i}
                className={`h-2.5 rounded-full transition-all ${
                  i === stepIndex
                    ? "w-8 bg-cyan-500"
                    : "w-2.5 bg-slate-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}