"use client"

import { useEffect, useRef, useState } from "react"
import type { AppRole } from "@/lib/auth"

type Props = {
  userName: string
  role: AppRole
  companyName: string
  onDone: () => void
}

const ROLE_SCRIPTS: Record<AppRole, { title: string; lines: string[] }> = {
  creator: {
    title: "Platform Creator",
    lines: [
      "Welcome back, {name}! ⚡",
      "You're the Creator of {company} — the highest role in Volt.",
      "You have full control over every dashboard, user, and setting.",
      "You can create workspaces, manage billing, assign admins, and shape the entire Volt experience for your team.",
      "Think of yourself as the architect — everything runs because of you.",
      "Let's build something great today!",
    ],
  },
  business_owner: {
    title: "Business Owner",
    lines: [
      "Hey {name}, great to see you! ⚡",
      "You're the Business Owner of {company}.",
      "You have top-level access to all dashboards, reports, and team activity.",
      "You can oversee projects, manage team members, review tickets, and keep your business running at full voltage.",
      "Your role is all about the big picture — strategy, performance, and growth.",
      "Let's make today count!",
    ],
  },
  admin: {
    title: "Admin",
    lines: [
      "Welcome, {name}! ⚡",
      "You're an Admin at {company}.",
      "Admins are the engine room of Volt — you manage users, assign tasks, handle tickets, and keep projects on track.",
      "You can invite new team members, create dashboards, and configure workspace settings.",
      "Your team counts on you to keep things moving.",
      "Ready to take charge?",
    ],
  },
  employee: {
    title: "Team Member",
    lines: [
      "Hey {name}, welcome to Volt! ⚡",
      "You're a Team Member at {company}.",
      "As a team member you can view your tasks, resolve tickets, and track your achievements as you grow.",
      "Complete work items to earn XP, unlock badges, and climb the tier system.",
      "Stay on top of your deadlines and keep your streak alive!",
      "Your team is counting on you — let's get to work!",
    ],
  },
}

export function VoltyRoleIntro({ userName, role, companyName, onDone }: Props) {
  const script = ROLE_SCRIPTS[role] || ROLE_SCRIPTS.employee
  const firstName = userName.split(" ")[0]
  const lines = script.lines.map(l =>
    l.replace("{name}", firstName).replace("{company}", companyName)
  )

  const [lineIndex, setLineIndex] = useState(0)
  const [displayText, setDisplayText] = useState("")
  const [charIndex, setCharIndex] = useState(0)
  const [fading, setFading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Typewriter effect
  useEffect(() => {
    if (charIndex < lines[lineIndex].length) {
      timerRef.current = setTimeout(() => {
        setDisplayText(prev => prev + lines[lineIndex][charIndex])
        setCharIndex(c => c + 1)
      }, 28)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [charIndex, lineIndex, lines])

  // Auto-advance lines
  useEffect(() => {
    if (charIndex < lines[lineIndex].length) return
    const wait = lineIndex === lines.length - 1 ? 2200 : 1400
    timerRef.current = setTimeout(() => {
      if (lineIndex < lines.length - 1) {
        setLineIndex(l => l + 1)
        setDisplayText("")
        setCharIndex(0)
      } else {
        setFading(true)
        setTimeout(onDone, 700)
      }
    }, wait)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [charIndex, lineIndex, lines, onDone])

  function skip() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setFading(true)
    setTimeout(onDone, 400)
  }

  const voltyFrames = ["/volty/volty-1.png", "/volty/volty-2.png", "/volty/volty-3.png"]
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % voltyFrames.length), 400)
    return () => clearInterval(t)
  }, [])

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-background/95 backdrop-blur-xl"
      style={{ transition: "opacity 0.7s ease", opacity: fading ? 0 : 1, pointerEvents: fading ? "none" : "auto" }}
    >
      <style>{`
        @keyframes volty-intro-in { from{transform:scale(0.85) translateY(30px);opacity:0} to{transform:scale(1) translateY(0);opacity:1} }
        @keyframes volty-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes volt-cursor { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spark-drift { 0%,100%{transform:translateY(0);opacity:0.6} 50%{transform:translateY(-12px);opacity:0.2} }
      `}</style>

      {/* Ambient background sparks */}
      {[
        { x: "10%", y: "15%", s: 5, d: "0s" }, { x: "85%", y: "20%", s: 3, d: "0.4s" },
        { x: "20%", y: "80%", s: 4, d: "0.8s" }, { x: "75%", y: "75%", s: 5, d: "0.2s" },
        { x: "50%", y: "10%", s: 3, d: "1s"  }, { x: "92%", y: "55%", s: 4, d: "0.6s" },
      ].map((sp, i) => (
        <div key={i} className="pointer-events-none absolute rounded-full"
          style={{ left: sp.x, top: sp.y, width: sp.s, height: sp.s, background: "var(--primary)",
            boxShadow: "0 0 8px var(--primary)", animation: `spark-drift 2.5s ease-in-out ${sp.d} infinite` }} />
      ))}

      <div style={{ animation: "volty-intro-in 0.6s cubic-bezier(0.16,1,0.3,1) forwards" }}
        className="relative mx-auto flex w-full max-w-lg flex-col items-center gap-6 rounded-[2.5rem] border border-border bg-card/90 p-8 shadow-2xl backdrop-blur-xl text-center"
      >
        {/* Glow behind card */}
        <div className="pointer-events-none absolute inset-0 rounded-[2.5rem] opacity-20 blur-2xl"
          style={{ background: "radial-gradient(circle at 50% 0%, var(--primary), transparent 70%)" }} />

        {/* Volty mascot */}
        <div style={{ animation: "volty-bounce 1.6s ease-in-out infinite" }}>
          <img src={voltyFrames[frame]} alt="Volty" className="h-28 w-28 object-contain drop-shadow-2xl" />
        </div>

        {/* Role badge */}
        <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">{script.title}</span>
        </div>

        {/* Line progress dots */}
        <div className="flex gap-1.5">
          {lines.map((_, i) => (
            <div key={i} className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: i === lineIndex ? 20 : 6, background: i <= lineIndex ? "var(--primary)" : "var(--muted)" }} />
          ))}
        </div>

        {/* Typewriter text */}
        <div className="min-h-[5rem] flex items-center justify-center">
          <p className="text-lg font-semibold leading-relaxed text-foreground">
            {displayText}
            <span style={{ animation: "volt-cursor 0.8s step-end infinite" }}>|</span>
          </p>
        </div>

        {/* Skip button */}
        <button onClick={skip}
          className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline transition"
        >
          Skip intro
        </button>
      </div>
    </div>
  )
}
