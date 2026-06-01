"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { getStoredSession } from "@/lib/auth"
import { getStoredCompanyId } from "@/lib/tenant"

export default function HomeRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    const session = getStoredSession()
    const companyId = getStoredCompanyId() || session?.companyId

    if (!session) {
      router.replace("/login")
      return
    }

    if (!companyId) {
      router.replace("/dashboards")
      return
    }

    router.replace(["creator", "business_owner", "admin"].includes(String(session.role)) ? "/company-overview" : "/my-dashboard")
  }, [router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="glass-card flex items-center gap-3 rounded-2xl border border-border p-5 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Opening your dashboard...
      </div>
    </main>
  )
}
