"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { getStoredSession } from "@/lib/auth"
import { getStoredCompanyId } from "@/lib/tenant"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

type VoltNotification = {
  id: number
  type: string
  title: string
  message: string
  relatedId: string | null
  isRead: boolean
  createdAt: string
}

type ToastNotif = {
  id: number
  type: string
  title: string
  message: string
  relatedId: string | null
}

function playSound(src: string) {
  try {
    const audio = new Audio(src)
    audio.volume = 0.6
    audio.play().catch(() => {})
  } catch {}
}

function getNotifSound(type: string) {
  const t = type?.toLowerCase() || ""
  if (t.includes("complet") || t.includes("resolv") || t.includes("closed") || t.includes("done")) {
    return "/sounds/notif-complete.mp3"
  }
  if (t.includes("ticket")) return "/sounds/notif-ticket.mp3"
  return "/sounds/notif-task.mp3"
}

export function VoltNotificationToasts() {
  const router = useRouter()
  const [toasts, setToasts] = useState<ToastNotif[]>([])
  const seenIds = useRef<Set<number>>(new Set())

  const fetchAndNotify = useCallback(async () => {
    const session = getStoredSession()
    const companyId = getStoredCompanyId()
    if (!session?.userId || !companyId) return

    try {
      const res = await fetch(
        `/api/notifications?companyId=${companyId}&userId=${session.userId}`,
        { cache: "no-store" },
      )
      if (!res.ok) return
      const data: VoltNotification[] = await res.json()
      if (!Array.isArray(data)) return

      const newOnes = data.filter((n) => !n.isRead && !seenIds.current.has(n.id))

      newOnes.forEach((n) => {
        seenIds.current.add(n.id)
        playSound(getNotifSound(n.type))
        setToasts((prev) => [
          ...prev,
          { id: n.id, type: n.type, title: n.title, message: n.message, relatedId: n.relatedId },
        ])
        // Auto-dismiss after 6s
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== n.id))
        }, 6000)
      })
    } catch {}
  }, [])

  useEffect(() => {
    fetchAndNotify()
    const interval = setInterval(fetchAndNotify, 20000)
    return () => clearInterval(interval)
  }, [fetchAndNotify])

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  function handleClick(toast: ToastNotif) {
    dismiss(toast.id)
    const type = toast.type?.toLowerCase() || ""
    if (type.includes("ticket")) router.push("/tickets")
    else router.push("/tasks")
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-2xl border bg-background/95 backdrop-blur-xl p-4 shadow-2xl",
            "animate-in slide-in-from-bottom-4 fade-in duration-300",
            "border-primary/30",
          )}
        >
          <div className="text-2xl leading-none mt-0.5">
            {toast.type?.includes("ticket") ? "🎫" : toast.type?.includes("complet") ? "✅" : "⚡"}
          </div>
          <button
            type="button"
            onClick={() => handleClick(toast)}
            className="flex-1 text-left min-w-0"
          >
            <p className="text-sm font-bold text-foreground truncate">{toast.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{toast.message}</p>
            <p className="mt-1 text-[10px] text-primary font-semibold">Click to open →</p>
          </button>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
