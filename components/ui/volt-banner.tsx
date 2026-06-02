"use client"

import { useEffect, useRef, useState } from "react"
import { Share2, X, Check } from "lucide-react"

type BannerProps = {
  userName: string
  userRole: string
  tierName: string
  tierColor: string
  tierIndex: number
  level: number
  totalXp: number
  xpProgress: number
  selectedBadgeIds: string[]
  onClose: () => void
  onShareTeam: () => void
  onShareEmail: () => void
}

// Each theme maps to a tier — you must have reached that tier to unlock it
const THEMES = [
  { name: "Spark",     c1: "34,197,94",   c2: "6,182,212",  requiredTier: 0 },
  { name: "Pulse",     c1: "6,182,212",   c2: "59,130,246", requiredTier: 1 },
  { name: "Surge",     c1: "59,130,246",  c2: "139,92,246", requiredTier: 2 },
  { name: "Voltage",   c1: "139,92,246",  c2: "34,197,94",  requiredTier: 3 },
  { name: "Overdrive", c1: "245,158,11",  c2: "249,115,22", requiredTier: 4 },
  { name: "Apex",      c1: "249,115,22",  c2: "239,68,68",  requiredTier: 5 },
  { name: "Legend",    c1: "239,68,68",   c2: "168,85,247", requiredTier: 6 },
]

const TIER_NAMES = ["Spark","Pulse","Surge","Voltage","Overdrive","Apex","Legend"]

export function VoltBanner({
  userName, userRole, tierName, tierColor, tierIndex,
  level, totalXp, xpProgress, selectedBadgeIds,
  onClose, onShareTeam, onShareEmail,
}: BannerProps) {
  // Auto-assign theme based on current tier
  const defaultTheme = THEMES[Math.min(tierIndex, THEMES.length - 1)]
  const [theme, setTheme] = useState(defaultTheme)
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const [particles, setParticles] = useState<{id:number;x:number;y:number;size:number;delay:number}[]>([])
  const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2)

  useEffect(() => {
    setParticles(Array.from({length: 12}, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 60,
      size: 2 + Math.random() * 3,
      delay: Math.random() * 3,
    })))
  }, [])

  function handleCopy() {
    navigator.clipboard.writeText(`Check out my Volt profile! Level ${level} ${tierName} tier — ${totalXp} XP`).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const r1 = theme.c1; const r2 = theme.c2

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
    >
      <style>{`
        @keyframes bannerFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes bannerIn { from{transform:scale(0.92) translateY(20px);opacity:0} to{transform:scale(1) translateY(0);opacity:1} }
        @keyframes particleDrift { 0%,100%{transform:translateY(0);opacity:0.6} 50%{transform:translateY(-8px);opacity:0.2} }
        @keyframes shimmerBar { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes orbSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes badgePop { from{transform:scale(0.5);opacity:0} to{transform:scale(1);opacity:1} }
      `}</style>

      <div style={{ animation: "bannerIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards", maxWidth: 560, width: "100%" }}>

        {/* The actual banner card */}
        <div style={{
          position: "relative",
          borderRadius: 24,
          overflow: "hidden",
          border: `1.5px solid rgba(${r1},0.4)`,
          background: `radial-gradient(ellipse at 20% 30%, rgba(${r1},0.12) 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(${r2},0.08) 0%, transparent 50%), #0a0a14`,
          boxShadow: `0 0 60px rgba(${r1},0.2), 0 0 120px rgba(${r1},0.08), inset 0 1px 0 rgba(${r1},0.2)`,
          animation: "bannerFloat 4s ease-in-out infinite",
        }}>
          {/* Hex texture */}
          <div style={{
            position: "absolute", inset: 0, opacity: 0.03, pointerEvents: "none",
            backgroundImage: `repeating-linear-gradient(0deg,rgba(${r1},1) 0,transparent 1px,transparent 18px),repeating-linear-gradient(60deg,rgba(${r1},1) 0,transparent 1px,transparent 18px),repeating-linear-gradient(120deg,rgba(${r1},1) 0,transparent 1px,transparent 18px)`,
          }}/>
          {/* Top strip */}
          <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,rgba(${r1},0.7),rgba(${r2},0.5),transparent)` }}/>
          {/* Shimmer sweep */}
          <div style={{ position:"absolute",top:0,left:"-60%",width:"40%",height:"100%",background:`linear-gradient(90deg,transparent,rgba(${r1},0.05),transparent)`,animation:"orbSpin 6s linear infinite",transformOrigin:"200% 50%",pointerEvents:"none" }}/>

          {/* Floating particles */}
          {particles.map(p => (
            <div key={p.id} style={{
              position:"absolute", left:`${p.x}%`, top:`${p.y}%`,
              width:p.size, height:p.size, borderRadius:"50%",
              background:`rgba(${r1},0.6)`,
              animation:`particleDrift ${2+p.delay}s ease-in-out infinite`,
              animationDelay:`${p.delay}s`,
              boxShadow:`0 0 ${p.size*2}px rgba(${r1},0.8)`,
              pointerEvents:"none",
            }}/>
          ))}

          <div style={{ position:"relative", zIndex:1, padding:"24px 28px 22px" }}>

            {/* Top row */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                {/* Avatar with orbit */}
                <div style={{ position:"relative", flexShrink:0 }}>
                  <div style={{
                    position:"absolute", inset:-8, borderRadius:"50%",
                    border:`1px solid rgba(${r1},0.2)`,
                    animation:"orbSpin 6s linear infinite",
                  }}>
                    <div style={{ position:"absolute", width:6,height:6,borderRadius:"50%",background:`rgba(${r1},0.8)`,top:-3,left:"50%",transform:"translateX(-50%)",boxShadow:`0 0 8px rgba(${r1},1)` }}/>
                  </div>
                  <div style={{
                    width:60,height:60,borderRadius:"50%",
                    background:`linear-gradient(135deg,rgb(${r2}),rgb(${r1}))`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:20,fontWeight:900,color:"#fff",fontFamily:"'Courier New',monospace",
                    border:`2px solid rgba(${r1},0.5)`,
                    boxShadow:`0 0 20px rgba(${r1},0.35)`,
                  }}>
                    {initials}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:18,fontWeight:700,color:"#fff",fontFamily:"'Courier New',monospace",letterSpacing:"0.04em",textShadow:`0 0 20px rgba(${r1},0.4)` }}>
                    {userName}
                  </div>
                  <div style={{ fontSize:10,color:`rgba(${r1},0.5)`,fontFamily:"'Courier New',monospace",letterSpacing:"0.18em",textTransform:"uppercase",marginTop:2 }}>
                    {userRole}
                  </div>
                  <div style={{
                    display:"inline-flex",alignItems:"center",gap:5,marginTop:5,
                    background:`rgba(${r1},0.12)`,border:`1px solid rgba(${r1},0.35)`,
                    borderRadius:20,padding:"2px 10px",
                  }}>
                    <div style={{ width:5,height:5,borderRadius:"50%",background:`rgb(${r1})`,boxShadow:`0 0 6px rgba(${r1},1)` }}/>
                    <span style={{ fontSize:8,fontWeight:700,color:`rgba(${r1},0.9)`,fontFamily:"'Courier New',monospace",letterSpacing:"0.2em",textTransform:"uppercase" }}>
                      {tierName} Tier
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:9,color:`rgba(${r1},0.4)`,fontFamily:"'Courier New',monospace",letterSpacing:"0.25em",textTransform:"uppercase",marginBottom:2 }}>Level</div>
                <div style={{ fontSize:40,fontWeight:900,color:"#fff",fontFamily:"'Courier New',monospace",lineHeight:1,textShadow:`0 0 30px rgba(${r1},0.65)` }}>
                  {level}
                </div>
                <div style={{ fontSize:9,color:`rgba(${r1},0.35)`,fontFamily:"'Courier New',monospace",letterSpacing:"0.1em",marginTop:2 }}>
                  {totalXp.toLocaleString()} XP
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height:1,background:`linear-gradient(90deg,transparent,rgba(${r1},0.2),transparent)`,marginBottom:16 }}/>

            {/* Badges row */}
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:18 }}>
              {[0,1,2,3,4].map(i => {
                const badgeId = selectedBadgeIds[i]
                return (
                  <div key={i} style={{
                    width:52,height:52,borderRadius:14,overflow:"hidden",flexShrink:0,
                    border:`1px solid rgba(${r1},${badgeId ? "0.3" : "0.1"})`,
                    background:`rgba(${r1},${badgeId ? "0.06" : "0.02"})`,
                    boxShadow: badgeId ? `0 0 12px rgba(${r1},0.18)` : undefined,
                    animation: badgeId ? `badgePop 0.4s cubic-bezier(0.16,1,0.3,1) ${i*0.08}s both` : undefined,
                    position:"relative",
                  }}>
                    {badgeId ? (
                      <iframe
                        src={`/badges/animated/${badgeId}.html`}
                        scrolling="no"
                        style={{ width:260,height:260,border:"none",pointerEvents:"none",transform:"scale(0.2)",transformOrigin:"top left",marginTop:-(260-52)/2,marginLeft:-(260-52)/2 }}
                      />
                    ) : (
                      <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:`rgba(${r1},0.15)`,fontFamily:"'Courier New',monospace" }}>+</div>
                    )}
                  </div>
                )
              })}
              <div style={{ marginLeft:"auto",fontSize:9,color:`rgba(${r1},0.25)`,fontFamily:"'Courier New',monospace",letterSpacing:"0.15em",textTransform:"uppercase" }}>
                Featured
              </div>
            </div>

            {/* XP bar */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                <span style={{ fontSize:9,color:`rgba(${r1},0.35)`,fontFamily:"'Courier New',monospace",letterSpacing:"0.15em",textTransform:"uppercase" }}>Level progress</span>
                <span style={{ fontSize:9,color:`rgba(${r1},0.4)`,fontFamily:"'Courier New',monospace" }}>{xpProgress}%</span>
              </div>
              <div style={{ height:4,borderRadius:99,background:"rgba(255,255,255,0.07)",overflow:"hidden" }}>
                <div style={{
                  height:"100%",borderRadius:99,width:`${xpProgress}%`,
                  background:`linear-gradient(90deg,rgb(${r2}),rgb(${r1}),rgb(${r2}))`,
                  backgroundSize:"200% auto",
                  animation:"shimmerBar 2s linear infinite",
                  transition:"width 1s ease",
                }}/>
              </div>
            </div>

            {/* Bottom row */}
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <div style={{ fontSize:9,color:`rgba(${r1},0.2)`,fontFamily:"'Courier New',monospace",letterSpacing:"0.2em",textTransform:"uppercase" }}>⚡ Volt Dashboards</div>
              <button
                onClick={() => setShowShare(!showShare)}
                style={{
                  display:"flex",alignItems:"center",gap:6,padding:"6px 14px",
                  background:`rgba(${r1},0.12)`,border:`1px solid rgba(${r1},0.35)`,
                  borderRadius:8,cursor:"pointer",
                  fontFamily:"'Courier New',monospace",fontSize:9,fontWeight:700,
                  color:`rgba(${r1},0.9)`,letterSpacing:"0.15em",textTransform:"uppercase",
                }}
              >
                <Share2 size={12}/> Share
              </button>
            </div>

            {/* Share dropdown */}
            {showShare && (
              <div style={{
                marginTop:10,display:"flex",gap:8,justifyContent:"flex-end",
                animation:"badgePop 0.3s cubic-bezier(0.16,1,0.3,1) both",
              }}>
                <button onClick={() => { onShareTeam(); setShowShare(false) }} style={{ padding:"5px 14px",background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:8,cursor:"pointer",fontFamily:"'Courier New',monospace",fontSize:9,fontWeight:700,color:"#4ade80",letterSpacing:"0.12em",textTransform:"uppercase" }}>
                  Team Chat
                </button>
                <button onClick={() => { onShareEmail(); setShowShare(false) }} style={{ padding:"5px 14px",background:"rgba(59,130,246,0.12)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:8,cursor:"pointer",fontFamily:"'Courier New',monospace",fontSize:9,fontWeight:700,color:"#60a5fa",letterSpacing:"0.12em",textTransform:"uppercase" }}>
                  Email
                </button>
                <button onClick={handleCopy} style={{ padding:"5px 14px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,cursor:"pointer",fontFamily:"'Courier New',monospace",fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.5)",letterSpacing:"0.12em",textTransform:"uppercase",display:"flex",alignItems:"center",gap:4 }}>
                  {copied ? <><Check size={10}/> Copied</> : "Copy Link"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Theme selector */}
        <div style={{ marginTop:16,display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap" }}>
          {THEMES.map(t => (
            <button key={t.name} onClick={() => setTheme(t)} style={{
              padding:"5px 14px",borderRadius:20,cursor:"pointer",
              fontFamily:"'Courier New',monospace",fontSize:9,fontWeight:700,
              letterSpacing:"0.12em",textTransform:"uppercase",
              background:`rgba(${t.c1},${theme.name===t.name?"0.2":"0.08"})`,
              border:`1px solid rgba(${t.c1},${theme.name===t.name?"0.55":"0.2"})`,
              color:`rgba(${t.c1},${theme.name===t.name?"1":"0.6"})`,
            }}>
              {t.name}
            </button>
          ))}
        </div>

        {/* Close */}
        <div style={{ marginTop:14,textAlign:"center" }}>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)",fontFamily:"'Courier New',monospace",fontSize:10,letterSpacing:"0.15em",textTransform:"uppercase" }}>
            ✕ Close
          </button>
        </div>
      </div>
    </div>
  )
}
