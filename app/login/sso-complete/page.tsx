"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldAlert, ArrowLeft } from "lucide-react"
import { storeCompany } from "@/lib/tenant"
import { storeSession, type AppSession } from "@/lib/auth"
import { VoltyRoleIntro } from "@/components/ui/volty-role-intro"

const INTRO_SEEN_PREFIX = "volt-role-intro-seen-"

export default function SsoCompletePage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [introSession, setIntroSession] = useState<AppSession | null>(null)
  const [introCompany, setIntroCompany] = useState<{ name: string } | null>(null)

  useEffect(() => {
    try {
      // Read the short-lived cookie the callback route set
      const match = document.cookie.match(/(?:^|;\s*)volt_sso_payload=([^;]+)/)
      if (!match) {
        setError("Sign-in session expired or was not found. Please try again.")
        return
      }

      // Clear the cookie immediately
      document.cookie = "volt_sso_payload=; max-age=0; path=/"

      const payload = JSON.parse(atob(match[1].replace(/-/g, "+").replace(/_/g, "/")))
      const { session, company } = payload

      if (!session?.userId) {
        setError("Invalid session data. Please try again.")
        return
      }

      storeSession(session)
      storeCompany(company)

      const introKey = `${INTRO_SEEN_PREFIX}${session.userId}`
      const alreadySeen = localStorage.getItem(introKey)

      if (!alreadySeen) {
        localStorage.setItem(introKey, "1")
        setIntroSession(session as AppSession)
        setIntroCompany(company)
      } else {
        router.replace("/dashboards")
      }
    } catch (err) {
      setError("Something went wrong completing sign-in. Please go back and try again.")
    }
  }, [router])

  if (introSession && introCompany) {
    return (
      <VoltyRoleIntro
        userName={introSession.fullName}
        role={introSession.role}
        companyName={introCompany.name}
        onDone={() => router.replace("/dashboards")}
      />
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="glass-card w-full max-w-md p-8 text-center space-y-5">
        {error ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Couldn't sign you in</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-3 font-semibold text-primary-foreground hover:opacity-90 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h1 className="text-xl font-bold tracking-tight">Signing you in...</h1>
            <p className="text-sm text-muted-foreground">Almost there, setting up your session.</p>
          </>
        )}
      </div>
    </main>
  )
}
