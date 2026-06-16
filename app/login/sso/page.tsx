"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, ShieldAlert, ArrowLeft } from "lucide-react"
import { storeCompany } from "@/lib/tenant"
import { storeSession, type AppSession } from "@/lib/auth"
import { VoltyRoleIntro } from "@/components/ui/volty-role-intro"

const INTRO_SEEN_PREFIX = "volt-role-intro-seen-"

export default function SsoLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState("")
  const [introSession, setIntroSession] = useState<AppSession | null>(null)
  const [introCompany, setIntroCompany] = useState<{ name: string } | null>(null)

  useEffect(() => {
    // NextAuth passes the user's email via the session cookie after a successful
    // OAuth callback. We fetch /api/auth/session (a built-in NextAuth endpoint)
    // to get it without importing next-auth/react.
    async function completeLogin() {
      try {
        const sessionRes = await fetch("/api/auth/session")
        const sessionData = await sessionRes.json().catch(() => null)
        const email = sessionData?.user?.email

        if (!email) {
          setError("We couldn't read an email address from that account. Please go back and try again.")
          return
        }

        const response = await fetch("/api/auth/sso-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(data?.message || data?.error || "We couldn't find a Volt account for that email.")
        }

        storeSession(data.session)
        storeCompany(data.company)

        const introKey = `${INTRO_SEEN_PREFIX}${data.session.userId}`
        const alreadySeen = localStorage.getItem(introKey)

        if (!alreadySeen) {
          localStorage.setItem(introKey, "1")
          setIntroSession(data.session)
          setIntroCompany(data.company)
        } else {
          router.replace("/dashboards")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.")
      }
    }

    completeLogin()
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
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => router.replace("/login")}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-3 font-semibold text-primary-foreground hover:opacity-90 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = "/api/auth/signout?callbackUrl=/login" }}
                className="w-full rounded-xl border border-border px-5 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                Sign out and try a different account
              </button>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h1 className="text-xl font-bold tracking-tight">Signing you in...</h1>
            <p className="text-sm text-muted-foreground">
              Verifying your account, one moment…
            </p>
          </>
        )}
      </div>
    </main>
  )
}
