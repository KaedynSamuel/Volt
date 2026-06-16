"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Lock, Mail, Loader2, Eye, EyeOff } from "lucide-react"
import { storeCompany } from "@/lib/tenant"
import { storeSession, type AppSession } from "@/lib/auth"
import { VoltyRoleIntro } from "@/components/ui/volty-role-intro"

const REMEMBER_KEY = "volt-remembered-email"
const INTRO_SEEN_PREFIX = "volt-role-intro-seen-"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState<"microsoft" | "google" | null>(null)
  const [error, setError] = useState("")
  const [introSession, setIntroSession] = useState<AppSession | null>(null)
  const [introCompany, setIntroCompany] = useState<{ name: string } | null>(null)

  useEffect(() => {
    const ssoError = searchParams.get("sso_error")
    if (!ssoError) return
    if (ssoError === "no_account") {
      const ssoEmail = searchParams.get("sso_email") || ""
      setError(`No Volt account found for ${ssoEmail || "that email"}. Ask your admin to add this email on the Team page, then try again.`)
    } else {
      setError(`Sign-in failed: ${ssoError}. Please try again.`)
    }
  }, [searchParams])

  useEffect(() => {
    const remembered = localStorage.getItem(REMEMBER_KEY)
    if (remembered) {
      setEmail(remembered)
      setRememberMe(true)
    }
  }, [])

  async function handleSsoSignIn(provider: "microsoft-entra-id" | "google") {
    setError("")
    setSsoLoading(provider === "microsoft-entra-id" ? "microsoft" : "google")
    if (provider === "microsoft-entra-id") {
      const tenantId = process.env.NEXT_PUBLIC_AZURE_TENANT_ID || "common"
      const clientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || ""
      const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/sso-callback`)
      const state = encodeURIComponent(JSON.stringify({ provider: "microsoft" }))
      window.location.href = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=openid+email+profile&state=${state}`
    } else {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""
      const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/sso-callback`)
      const state = encodeURIComponent(JSON.stringify({ provider: "google" }))
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=openid+email+profile&state=${state}`
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setLoading(true)
      setError("")
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Login failed")
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, email)
      } else {
        localStorage.removeItem(REMEMBER_KEY)
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
        router.push("/dashboards")
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {introSession && introCompany && (
        <VoltyRoleIntro
          userName={introSession.fullName}
          role={introSession.role}
          companyName={introCompany.name}
          onDone={() => router.push("/dashboards")}
        />
      )}
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <form onSubmit={handleSubmit} className="glass-card w-full max-w-md p-8 space-y-5">
          <div>
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-5 glow">
              <Lock className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Log in</h1>
            <p className="text-muted-foreground mt-2">Sign in to choose one of your dashboards.</p>
          </div>

          <div className="space-y-2">
            <button type="button" onClick={() => handleSsoSignIn("microsoft-entra-id")} disabled={ssoLoading !== null || loading} className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background/70 px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-60">
              {ssoLoading === "microsoft" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <svg viewBox="0 0 23 23" className="h-4 w-4" aria-hidden="true">
                  <path fill="#f25022" d="M1 1h10v10H1z" /><path fill="#00a4ef" d="M1 12h10v10H1z" />
                  <path fill="#7fba00" d="M12 1h10v10H12z" /><path fill="#ffb900" d="M12 12h10v10H12z" />
                </svg>
              )}
              Continue with Microsoft
            </button>
            <button type="button" onClick={() => handleSsoSignIn("google")} disabled={ssoLoading !== null || loading} className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background/70 px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-60">
              {ssoLoading === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 7 29.6 5 24 5c-7.7 0-14.4 4.3-17.7 9.7z" />
                  <path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.5l-6.6-5.6c-2 1.5-4.6 2.1-7.7 2.1-5.2 0-9.7-3.3-11.3-8l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6.6 5.6C41.5 36.6 44 31.1 44 24c0-1.3-.1-2.7-.4-3.5z" />
                </svg>
              )}
              Continue with Google
            </button>
            <p className="px-1 text-center text-[11px] text-muted-foreground">Use your Microsoft or Google work/personal email — your admin must add that email to Volt first.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

          <label className="space-y-2 block">
            <span className="text-sm font-medium flex items-center gap-2"><Mail className="h-4 w-4 text-primary" />Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 outline-none focus:border-primary" placeholder="you@company.com" />
          </label>

          <label className="space-y-2 block">
            <span className="text-sm font-medium flex items-center gap-2"><Lock className="h-4 w-4 text-primary" />Password</span>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 pr-11 outline-none focus:border-primary" placeholder="Your password" />
              <button type="button" onClick={() => setShowPassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setRememberMe((p) => !p)} className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${rememberMe ? "border-primary bg-primary" : "border-border bg-background/70"}`}>
              {rememberMe && <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            </div>
            <span className="text-sm text-muted-foreground">Remember my email</span>
          </label>

          <button type="submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 glow">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in...</> : <>Log in<ArrowRight className="h-4 w-4" /></>}
          </button>

          <p className="text-sm text-muted-foreground text-center">
            Your company admin creates your login and assigns your dashboard.{" "}
            <Link href="/setup" className="text-primary hover:underline">Set up Dashboard</Link>
          </p>
        </form>
      </main>
    </>
  )
}
