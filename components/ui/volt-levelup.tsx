"use client"

import { useEffect, useRef, useState } from "react"

type LevelUpProps = {
  level: number
  tierName: string
  tierColor: string
  onDone: () => void
}

type TierUpProps = {
  fromTier: string
  toTier: string
  toColor: string
  onDone: () => void
}

export function VoltLevelUp({ level, tierName, tierColor, onDone }: LevelUpProps) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in")
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 600)
    const t2 = setTimeout(() => setPhase("out"), 4200)
    const t3 = setTimeout(() => onDone(), 4900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: { x: number; y: number; vx: number; vy: number; life: number; size: number; color: string }[] = []
    const cx = canvas.width / 2
    const cy = canvas.height / 2

    const colors = [tierColor, "#ffffff", tierColor + "aa", "#ffffff88"]

    for (let i = 0; i < 120; i++) {
      const angle = (Math.random() * Math.PI * 2)
      const speed = 2 + Math.random() * 8
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        life: 1,
        size: 2 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    let frame: number
    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.15
        p.life -= 0.018
        if (p.life > 0) {
          ctx!.globalAlpha = p.life
          ctx!.fillStyle = p.color
          ctx!.beginPath()
          ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx!.fill()
        }
      })
      ctx!.globalAlpha = 1
      if (particles.some(p => p.life > 0)) {
        frame = requestAnimationFrame(animate)
      }
    }
    animate()
    return () => cancelAnimationFrame(frame)
  }, [tierColor])

  const r = parseInt(tierColor.slice(1, 3), 16) || 99
  const g = parseInt(tierColor.slice(3, 5), 16) || 99
  const b = parseInt(tierColor.slice(5, 7), 16) || 99

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        transition: "opacity 0.6s ease",
        opacity: phase === "out" ? 0 : 1,
        background: `radial-gradient(ellipse at center, rgba(${r},${g},${b},0.18) 0%, rgba(0,0,0,0.85) 70%)`,
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Scan lines */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
      }} />

      {/* Main card */}
      <div
        className="relative flex flex-col items-center gap-5 text-center"
        style={{
          animation: phase === "in" ? "lvlIn 0.6s cubic-bezier(0.16,1,0.3,1) forwards" : undefined,
        }}
      >
        <style>{`
          @keyframes lvlIn {
            from { transform: scale(0.5) translateY(40px); opacity: 0; }
            to   { transform: scale(1) translateY(0);      opacity: 1; }
          }
          @keyframes ringPulse {
            0%,100% { transform: translate(-50%,-50%) scale(1);   opacity: 0.6; }
            50%      { transform: translate(-50%,-50%) scale(1.15); opacity: 0.2; }
          }
          @keyframes floatNum {
            0%,100% { transform: translateY(0);  }
            50%      { transform: translateY(-8px); }
          }
          @keyframes shimmer {
            0%   { background-position: -200% center; }
            100% { background-position:  200% center; }
          }
        `}</style>

        {/* Pulsing rings behind card */}
        {[180, 240, 300].map((size, i) => (
          <div key={i} className="absolute pointer-events-none rounded-full border" style={{
            width: size, height: size,
            borderColor: `${tierColor}40`,
            top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            animation: `ringPulse ${1.5 + i * 0.4}s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}

        {/* LEVEL UP text */}
        <div style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.35em",
          textTransform: "uppercase",
          color: tierColor,
          textShadow: `0 0 20px ${tierColor}`,
          opacity: 0.9,
        }}>
          ◈ level up ◈
        </div>

        {/* Big level number */}
        <div style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 96,
          fontWeight: 900,
          lineHeight: 1,
          background: `linear-gradient(135deg, #ffffff 0%, ${tierColor} 40%, #ffffff 60%, ${tierColor} 100%)`,
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          animation: "shimmer 2s linear infinite, floatNum 2s ease-in-out infinite",
          textShadow: "none",
          filter: `drop-shadow(0 0 30px ${tierColor}80)`,
        }}>
          {level}
        </div>

        {/* Tier name */}
        <div style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#ffffff",
          textShadow: `0 0 15px ${tierColor}, 0 0 30px ${tierColor}60`,
        }}>
          {tierName} Tier
        </div>

        {/* XP bar fill animation */}
        <div style={{ width: 220, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 999,
            background: `linear-gradient(90deg, ${tierColor}, #ffffff, ${tierColor})`,
            backgroundSize: "200% auto",
            animation: "shimmer 1.5s linear infinite",
            transition: "width 1s ease 0.3s",
            width: phase === "hold" || phase === "out" ? "100%" : "0%",
          }} />
        </div>

        <div style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 9,
          letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
        }}>
          Keep going — next level awaits
        </div>
      </div>
    </div>
  )
}

export function VoltTierUp({ fromTier, toTier, toColor, onDone }: TierUpProps) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in")

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 500)
    const t2 = setTimeout(() => setPhase("out"), 5200)
    const t3 = setTimeout(() => onDone(), 5900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  const r = parseInt(toColor.slice(1, 3), 16) || 99
  const g = parseInt(toColor.slice(3, 5), 16) || 99
  const b = parseInt(toColor.slice(5, 7), 16) || 99

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{
        opacity: phase === "out" ? 0 : 1,
        transition: "opacity 0.7s ease",
        background: `radial-gradient(ellipse at center, rgba(${r},${g},${b},0.22) 0%, rgba(0,0,0,0.92) 65%)`,
      }}
    >
      <style>{`
        @keyframes tierIn {
          from { transform: scale(0.3) rotate(-8deg); opacity: 0; filter: blur(20px); }
          to   { transform: scale(1)   rotate(0deg);  opacity: 1; filter: blur(0);   }
        }
        @keyframes tierFromOut {
          0%   { transform: translateY(0)    scale(1);   opacity: 1; }
          100% { transform: translateY(-60px) scale(0.7); opacity: 0; }
        }
        @keyframes tierToIn {
          0%   { transform: translateY(60px) scale(0.7); opacity: 0; }
          100% { transform: translateY(0)    scale(1);   opacity: 1; }
        }
        @keyframes energyBurst {
          0%   { transform: translate(-50%,-50%) scale(0);   opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(3);   opacity: 0; }
        }
        @keyframes scanDown {
          0%   { top: -100%; opacity: 0.6; }
          100% { top:  100%; opacity: 0;   }
        }
        @keyframes glowPulse {
          0%,100% { opacity: 0.4; }
          50%      { opacity: 1;   }
        }
      `}</style>

      {/* Scan line sweep */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div style={{
          position: "absolute", left: 0, right: 0, height: "3px",
          background: `linear-gradient(90deg, transparent, ${toColor}, transparent)`,
          animation: "scanDown 1.5s ease-in-out infinite",
          animationDelay: "0.3s",
        }} />
      </div>

      {/* Energy burst rings */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="absolute pointer-events-none rounded-full" style={{
          width: 200, height: 200,
          border: `2px solid ${toColor}`,
          top: "50%", left: "50%",
          animation: `energyBurst 1.2s ease-out forwards`,
          animationDelay: `${i * 0.15}s`,
        }} />
      ))}

      <div style={{ animation: "tierIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards", textAlign: "center" }}>

        {/* TIER UP label */}
        <div style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 11, fontWeight: 700,
          letterSpacing: "0.4em", textTransform: "uppercase",
          color: toColor, opacity: 0.8,
          textShadow: `0 0 15px ${toColor}`,
          marginBottom: 24,
          animation: "glowPulse 1.5s ease-in-out infinite",
        }}>
          ⬡ tier unlocked ⬡
        </div>

        {/* From → To */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, justifyContent: "center", marginBottom: 28 }}>
          {/* From tier (flies out) */}
          <div style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 22, fontWeight: 700, letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
            animation: phase !== "in" ? "tierFromOut 0.6s ease forwards" : undefined,
          }}>
            {fromTier}
          </div>

          {/* Arrow */}
          <div style={{ color: toColor, fontSize: 20, filter: `drop-shadow(0 0 8px ${toColor})` }}>→</div>

          {/* To tier (flies in) */}
          <div style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 28, fontWeight: 900, letterSpacing: "0.08em",
            color: toColor, textTransform: "uppercase",
            textShadow: `0 0 20px ${toColor}, 0 0 40px ${toColor}60`,
            animation: phase !== "in" ? "tierToIn 0.6s cubic-bezier(0.16,1,0.3,1) forwards" : "none",
            opacity: phase === "in" ? 0 : 1,
          }}>
            {toTier}
          </div>
        </div>

        {/* Hexagonal badge-like frame */}
        <div style={{
          width: 120, height: 120, margin: "0 auto 24px",
          position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
            <path d="M60 8 L106 32 L106 88 L60 112 L14 88 L14 32 Z"
              stroke={toColor} strokeWidth="2" fill={`rgba(${r},${g},${b},0.12)`}
              style={{ filter: `drop-shadow(0 0 12px ${toColor})` }}
            />
            <path d="M60 20 L96 40 L96 80 L60 100 L24 80 L24 40 Z"
              stroke={`${toColor}60`} strokeWidth="1" fill="none"
            />
          </svg>
          <div style={{
            position: "absolute",
            fontFamily: "'Courier New', monospace",
            fontSize: 36, fontWeight: 900,
            color: toColor,
            textShadow: `0 0 20px ${toColor}`,
          }}>
            {toTier.charAt(0)}
          </div>
        </div>

        <div style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 9, letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
        }}>
          New tier · New power
        </div>
      </div>
    </div>
  )
}
