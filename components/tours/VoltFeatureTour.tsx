"use client"

import { useState } from "react"
import Image from "next/image"
import { Check, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"

type Step = {
  title: string
  description: string
  image?: string
}

type VoltFeatureTourProps = {
  title: string
  storageKey: string
  steps: Step[]
}

export function VoltFeatureTour({ title, storageKey, steps }: VoltFeatureTourProps) {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(storageKey) !== "true"
  })
  const [index, setIndex] = useState(0)

  if (!open || steps.length === 0) return null

  const step = steps[index]
  const isLast = index === steps.length - 1

  function close() {
    window.localStorage.setItem(storageKey, "true")
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/20 bg-card p-6 shadow-2xl">
        <button type="button" onClick={close} className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Volty Guide</p>
            <h2 className="text-xl font-bold">{title}</h2>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-[150px_1fr]">
          <div className="flex items-center justify-center rounded-3xl border border-border bg-background/50 p-3">
            <Image src={step.image || "/volty/step-1-welcome.png"} alt="Volty" width={120} height={120} className="h-28 w-28 object-contain" />
          </div>
          <div className="flex flex-col justify-center">
            <p className="mb-2 text-sm font-semibold text-primary">Step {index + 1} of {steps.length}</p>
            <h3 className="text-2xl font-bold tracking-tight">{step.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <Button type="button" onClick={() => (isLast ? close() : setIndex((value) => value + 1))}>
            {isLast ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {isLast ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  )
}
