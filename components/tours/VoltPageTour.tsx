"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react"
import type { ComponentType } from "react"

type Placement = "top" | "bottom" | "left" | "right" | "center"

export type PageTourStep = {
  title: string
  description: string
  target?: string        // CSS selector — if omitted, card centres
  placement?: Placement
  mascotSide?: "left" | "right"
  image?: string
  icon?: ComponentType<{ className?: string }>
}

type VoltPageTourProps = {
  storageKey: string
  steps: PageTourStep[]
}

const CARD_W = 420
const CARD_H = 290
const GAP = 20

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(v, hi))
}

export function VoltPageTour({ storageKey, steps }: VoltPageTourProps) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  // Only open on first visit (after mount so SSR is safe)
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.localStorage.getItem(storageKey) !== "true") {
      setOpen(true)
    }
  }, [storageKey])

  const step = steps[index] ?? steps[0]
  const placement: Placement = step.placement ?? "bottom"
  const mascotSide = step.mascotSide ?? "right"

  // Track the target element's position
  useEffect(() => {
    if (!open || !step.target) { setRect(null); return }

    const update = () => {
      const el = document.querySelector(step.target!) as HTMLElement | null
      setRect(el ? el.getBoundingClientRect() : null)
    }

    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [open, step])

  // Lock scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [open])

  const cardPos = useMemo(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1440
    const vh = typeof window !== "undefined" ? window.innerHeight : 900

    if (!rect || placement === "center") {
      return { top: vh / 2 - CARD_H / 2, left: vw / 2 - CARD_W / 2 }
    }

    let top = 0
    let left = 0

    switch (placement) {
      case "top":
        top = rect.top - CARD_H - GAP
        left = rect.left + rect.width / 2 - CARD_W / 2
        break
      case "bottom":
        top = rect.top + rect.height + GAP
        left = rect.left + rect.width / 2 - CARD_W / 2
        break
      case "left":
        top = rect.top + rect.height / 2 - CARD_H / 2
        left = rect.left - CARD_W - GAP
        break
      case "right":
        top = rect.top + rect.height / 2 - CARD_H / 2
        left = rect.left + rect.width + GAP
        break
    }

    return {
      top: clamp(top, 16, vh - CARD_H - 16),
      left: clamp(left, 16, vw - CARD_W - 16),
    }
  }, [rect, placement])

  if (!open) return null

  const isLast = index === steps.length - 1

  function dismiss() {
    window.localStorage.setItem(storageKey, "true")
    setOpen(false)
  }

  function next() {
    if (isLast) { dismiss(); return }
    setIndex((i) => i + 1)
  }

  function prev() {
    setIndex((i) => Math.max(0, i - 1))
  }

  const StepIcon = step.icon

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Dimmed backdrop */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />

      {/* Spotlight highlight around target */}
      {rect && (
        <div
          className="pointer-events-none absolute rounded-3xl border-2 border-cyan-400 transition-all duration-300"
          style={{
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          }}
        />
      )}

      {/* Tour card */}
      <div
        className="absolute w-[420px] rounded-[28px] border border-white/20 bg-white/96 p-5 shadow-2xl transition-all duration-300"
        style={{ top: cardPos.top, left: cardPos.left }}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          {/* Volty mascot */}
          <div
            className={`absolute -top-24 ${
              mascotSide === "right"
                ? "right-0 translate-x-1/3"
                : "left-0 -translate-x-1/3"
            }`}
          >
            <Image
              src={step.image || "/volty/ChatGPT_Image_May_27__2026__04_08_21_AM__10_-removebg-preview.png"}
              alt="Volty"
              width={160}
              height={160}
              className="h-[160px] w-[160px] object-contain drop-shadow-2xl"
              priority
            />
          </div>

          <div className="pr-12">
            {/* Step badge */}
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
              {StepIcon && <StepIcon className="h-3.5 w-3.5" />}
              Step {index + 1} of {steps.length}
            </div>

            <h3 className="text-xl font-black tracking-tight text-slate-900">
              {step.title}
            </h3>

            <p className="mt-2.5 text-sm leading-6 text-slate-600">
              {step.description}
            </p>
          </div>

          {/* Buttons */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              onClick={dismiss}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Skip
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                disabled={index === 0}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Prev
              </button>

              <button
                onClick={next}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-cyan-300/30 transition hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLast ? "Done" : "Next"}
                {isLast ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Dot progress */}
          <div className="mt-4 flex items-center justify-center gap-2">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === index ? "w-8 bg-cyan-500" : "w-2.5 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
