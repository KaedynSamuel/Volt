"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Zap } from "lucide-react"

function getPageName(pathname: string) {
  if (pathname === "/") return "Company Dashboard"
  if (pathname === "/my-dashboard") return "My Dashboard"
  if (pathname === "/dashboards") return "Dashboards"
  if (pathname === "/tasks") return "Tasks"
  if (pathname === "/tickets") return "Tickets"
  if (pathname === "/team") return "Team"
  if (pathname === "/assistant") return "AI Assistant"
  if (pathname === "/achievements") return "Achievements"
  if (pathname === "/environments") return "Environment"
  if (pathname === "/settings") return "Settings"
  if (pathname === "/notifications") return "Notifications"

  return "Workspace"
}

export function VoltPageLoader() {
  const pathname = usePathname()
  const previousPathname = useRef(pathname)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [loading, setLoading] = useState(false)
  const [targetPage, setTargetPage] = useState("Workspace")

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement
      const anchor = target.closest("a")

      if (!anchor) return

      const href = anchor.getAttribute("href")
      const targetAttr = anchor.getAttribute("target")

      if (!href) return
      if (targetAttr === "_blank") return
      if (href.startsWith("#")) return
      if (href.startsWith("mailto:")) return
      if (href.startsWith("tel:")) return

      const isModifiedClick =
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0

      if (isModifiedClick) return

      try {
        const nextUrl = new URL(href, window.location.origin)

        if (nextUrl.origin !== window.location.origin) return
        if (nextUrl.pathname === window.location.pathname) return

        setTargetPage(getPageName(nextUrl.pathname))
        setLoading(true)

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        timeoutRef.current = setTimeout(() => {
          setLoading(false)
        }, 3500)
      } catch {
        return
      }
    }

    document.addEventListener("click", handleClick)

    return () => {
      document.removeEventListener("click", handleClick)

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname

      const finishTimer = setTimeout(() => {
        setLoading(false)
      }, 650)

      return () => clearTimeout(finishTimer)
    }
  }, [pathname])

  if (!loading) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-background/90 backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.14),transparent_34%),radial-gradient(circle_at_top,rgba(139,92,246,0.10),transparent_35%)]" />

      <div className="volt-grid absolute inset-0 opacity-[0.08]" />

      <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-primary/20 volt-ring-one" />
          <div className="absolute inset-2 rounded-full border border-accent/20 volt-ring-two" />
          <div className="absolute inset-4 rounded-3xl bg-gradient-to-br from-primary to-accent shadow-[0_0_50px_rgba(34,197,94,0.35)] volt-core" />

          <Zap className="relative z-10 h-10 w-10 fill-primary-foreground text-primary-foreground volt-bolt" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">
            Volt System
          </p>

          <h2 className="text-2xl font-bold tracking-tight">
            Loading {targetPage}
          </h2>

          <p className="text-sm text-muted-foreground">
            Connecting your workspace and syncing live data.
          </p>
        </div>

        <div className="relative mt-7 h-2 overflow-hidden rounded-full bg-muted">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent volt-shimmer" />
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-primary via-accent to-primary volt-loader-bar" />
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary volt-dot" />
          Powering up
          <span className="h-1.5 w-1.5 rounded-full bg-accent volt-dot delay-150" />
          Securing session
          <span className="h-1.5 w-1.5 rounded-full bg-primary volt-dot delay-300" />
        </div>

        <div className="volt-lightning volt-lightning-left" />
        <div className="volt-lightning volt-lightning-right" />
      </div>

      <style jsx>{`
        .volt-grid {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
          background-size: 48px 48px;
          animation: gridMove 8s linear infinite;
        }

        .volt-ring-one {
          animation: ringPulse 1.8s ease-in-out infinite;
          box-shadow: 0 0 35px rgba(34, 197, 94, 0.18);
        }

        .volt-ring-two {
          animation: ringPulse 2.4s ease-in-out infinite reverse;
          box-shadow: 0 0 30px rgba(139, 92, 246, 0.15);
        }

        .volt-core {
          animation: corePulse 1.6s ease-in-out infinite;
        }

        .volt-bolt {
          animation: boltPulse 1.15s ease-in-out infinite;
          filter: drop-shadow(0 0 14px rgba(255, 255, 255, 0.7));
        }

        .volt-loader-bar {
          animation: loaderMove 1.15s ease-in-out infinite;
          box-shadow: 0 0 18px rgba(34, 197, 94, 0.55);
        }

        .volt-shimmer {
          animation: shimmer 1.7s linear infinite;
        }

        .volt-dot {
          animation: dotPulse 1s ease-in-out infinite;
        }

        .delay-150 {
          animation-delay: 0.15s;
        }

        .delay-300 {
          animation-delay: 0.3s;
        }

        .volt-lightning {
          position: absolute;
          top: 0;
          width: 1px;
          height: 100%;
          opacity: 0;
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(34, 197, 94, 0.8),
            rgba(255, 255, 255, 0.9),
            rgba(139, 92, 246, 0.7),
            transparent
          );
          filter: drop-shadow(0 0 12px rgba(34, 197, 94, 0.8));
          pointer-events: none;
        }

        .volt-lightning-left {
          left: 22px;
          animation: lightningFlash 2.4s ease-in-out infinite;
        }

        .volt-lightning-right {
          right: 22px;
          animation: lightningFlash 2.8s ease-in-out infinite 0.45s;
        }

        @keyframes gridMove {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(48px);
          }
        }

        @keyframes ringPulse {
          0% {
            transform: scale(0.94);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.08);
            opacity: 1;
          }
          100% {
            transform: scale(0.94);
            opacity: 0.5;
          }
        }

        @keyframes corePulse {
          0% {
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            transform: scale(1.06);
            filter: brightness(1.25);
          }
          100% {
            transform: scale(1);
            filter: brightness(1);
          }
        }

        @keyframes boltPulse {
          0% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.16);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0.85;
          }
        }

        @keyframes loaderMove {
          0% {
            transform: translateX(-120%);
          }
          50% {
            transform: translateX(70%);
          }
          100% {
            transform: translateX(230%);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(120%);
          }
        }

        @keyframes dotPulse {
          0%,
          100% {
            opacity: 0.35;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.25);
          }
        }

        @keyframes lightningFlash {
          0%,
          78%,
          100% {
            opacity: 0;
            transform: scaleY(0.35);
          }
          82% {
            opacity: 0.7;
            transform: scaleY(1);
          }
          86% {
            opacity: 0.18;
          }
          90% {
            opacity: 0.85;
          }
          94% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}