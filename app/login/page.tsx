"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Lock, Mail, Loader2, Eye, EyeOff } from "lucide-react"
import { storeCompany } from "@/lib/tenant"
import { storeSession } from "@/lib/auth"
import { VoltIntro } from "@/components/ui/volt-intro"

const REMEMBER_KEY = "volt-remembered-email"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    // Show intro only once per session
    const introSeen = sessionStorage.getItem("volt-intro-seen")
    if (!introSeen) {
      setShowIntro(true)
    }

    // Restore remembered email
    const remembered = localStorage.getItem(REMEMBER_KEY)
    if (remembered) {
      setEmail(remembered)
      setRememberMe(true)
    }
  }, [])

  function handleIntroDone() {
    setShowIntro(false)
    sessionStorage.setItem("volt-intro-seen", "1")
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

      if (!response.ok) {
        throw new Error(data?.error || "Login failed")
      }

      // Handle remember me
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, email)
      } else {
        localStorage.removeItem(REMEMBER_KEY)
      }

      storeSession(data.session)
      storeCompany(data.company)

      router.push("/dashboards")
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {showIntro && <VoltIntro onDone={handleIntroDone} />}

      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <form onSubmit={handleSubmit} className="glass-card w-full max-w-md p-8 space-y-5">
          <div>
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-5 glow">
              <Lock className="h-6 w-6 text-primary-foreground" />
            </div>

            <h1 className="text-3xl font-bold tracking-tight">Log in</h1>
            <p className="text-muted-foreground mt-2">
              Sign in to choose one of your dashboards.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <label className="space-y-2 block">
            <span className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 outline-none focus:border-primary"
              placeholder="you@company.com"
            />
          </label>

          <label className="space-y-2 block">
            <span className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Password
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 pr-11 outline-none focus:border-primary"
                placeholder="Your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {/* Remember Me */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setRememberMe((prev) => !prev)}
              className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${
                rememberMe
                  ? "border-primary bg-primary"
                  : "border-border bg-background/70"
              }`}
            >
              {rememberMe && (
                <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-muted-foreground">Remember my email</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 glow"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Log in
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <p className="text-sm text-muted-foreground text-center">
            Your company admin creates your login and assigns your dashboard.{" "}
            <Link href="/setup" className="text-primary hover:underline">
              Set up Dashboard
            </Link>
          </p>
        </form>
      </main>
    </>
  )
}
