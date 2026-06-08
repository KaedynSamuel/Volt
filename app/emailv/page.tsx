"use client"

import { useState, useCallback } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { VoltPageTour } from "@/components/tours/VoltPageTour"
import { cn } from "@/lib/utils"
import { getStoredSession } from "@/lib/auth"
import { getStoredCompanyId } from "@/lib/tenant"
import {
  Send, Shield, Lock, AlertTriangle, X, Loader2,
  CheckCircle2, Mail, Eye, EyeOff,
} from "lucide-react"

const BLOCKED_DOMAINS = [
  "tempmail.com","mailinator.com","guerrillamail.com","throwaway.email",
  "yopmail.com","dispostable.com","fakeinbox.com","maildrop.cc",
]
const BLOCKED_PATTERNS = [
  /\bpassword\b/i, /\bpin\b/i, /\bcredit.?card\b/i,
  /\bsocial.?security\b/i, /\bssn\b/i, /\baccount.?number\b/i,
]
const MAX_RECIPIENTS = 10
const MAX_BODY_CHARS = 5000
const RATE_LIMIT_KEY = "emailv-rate-limit"
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

type DraftEmail = { to: string[]; cc: string[]; subject: string; body: string; priority: "normal" | "high" }
type SentEmail = DraftEmail & { id: string; sentAt: string; status: "sent" | "failed" }
type SecurityCheck = { passed: boolean; warnings: string[]; errors: string[] }

function isValidEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) }
function isBlockedDomain(e: string) { return BLOCKED_DOMAINS.includes(e.split("@")[1]?.toLowerCase() || "") }
function hasSensitiveContent(text: string) {
  return BLOCKED_PATTERNS.filter((p) => p.test(text)).map((p) => p.source.replace(/\\b/g,"").replace(/\?/g,"").replace(/\./g," "))
}
function checkRateLimit() {
  if (typeof window === "undefined") return { allowed: true, remaining: RATE_LIMIT_MAX }
  const raw = localStorage.getItem(RATE_LIMIT_KEY)
  const data = raw ? JSON.parse(raw) : { count: 0, windowStart: Date.now() }
  if (Date.now() - data.windowStart > RATE_LIMIT_WINDOW_MS) return { allowed: true, remaining: RATE_LIMIT_MAX }
  return { allowed: data.count < RATE_LIMIT_MAX, remaining: RATE_LIMIT_MAX - data.count }
}
function incrementRateLimit() {
  if (typeof window === "undefined") return
  const raw = localStorage.getItem(RATE_LIMIT_KEY)
  const now = Date.now()
  const data = raw ? JSON.parse(raw) : { count: 0, windowStart: now }
  if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ count: 1, windowStart: now }))
  } else {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ ...data, count: data.count + 1 }))
  }
}
function runSecurityChecks(draft: DraftEmail): SecurityCheck {
  const errors: string[] = []
  const warnings: string[] = []
  const all = [...draft.to, ...draft.cc]
  for (const e of all) {
    if (!isValidEmail(e)) errors.push(`Invalid email: ${e}`)
    if (isBlockedDomain(e)) errors.push(`Disposable address blocked: ${e}`)
  }
  if (all.length > MAX_RECIPIENTS) errors.push(`Too many recipients (max ${MAX_RECIPIENTS})`)
  if (draft.to.length === 0) errors.push("At least one recipient required")
  if (!draft.subject.trim()) errors.push("Subject is required")
  if (draft.body.length > MAX_BODY_CHARS) errors.push(`Body too long (max ${MAX_BODY_CHARS})`)
  const bodyFlags = hasSensitiveContent(draft.body)
  const subjectFlags = hasSensitiveContent(draft.subject)
  if (bodyFlags.length) warnings.push(`Body may contain sensitive data: ${bodyFlags.join(", ")}`)
  if (subjectFlags.length) warnings.push(`Subject may contain sensitive data: ${subjectFlags.join(", ")}`)
  if (!checkRateLimit().allowed) errors.push(`Send limit reached (${RATE_LIMIT_MAX}/hour). Try again later.`)
  return { passed: errors.length === 0, warnings, errors }
}

const emptyDraft: DraftEmail = { to: [], cc: [], subject: "", body: "", priority: "normal" }

function RecipientInput({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("")
  function add() {
    const t = input.trim()
    if (t && !values.includes(t)) onChange([...values, t])
    setInput("")
  }
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wide text-foreground">{label}</label>
      <div className="flex flex-wrap gap-1.5 min-h-9 rounded-xl border border-border bg-background/70 px-2 py-1.5">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add() } }}
          onBlur={add}
          placeholder={values.length === 0 ? "type email and press Enter" : ""}
          className="min-w-[160px] flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  )
}

export default function EmailVPage() {
  const [draft, setDraft] = useState<DraftEmail>(emptyDraft)
  const [securityResult, setSecurityResult] = useState<SecurityCheck | null>(null)
  const [sending, setSending] = useState(false)
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([])
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [bodyVisible, setBodyVisible] = useState(true)
  const rateStatus = checkRateLimit()

  function runCheck() { const r = runSecurityChecks(draft); setSecurityResult(r); return r }

  async function handleSend() {
    setError(""); setSuccess("")
    const checks = runCheck()
    if (!checks.passed) return
    setSending(true)
    try {
      const session = getStoredSession()
      const companyId = getStoredCompanyId()
      const res = await fetch("/api/emailv/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-company-id": String(companyId||""), "x-user-id": String(session?.userId||"") },
        body: JSON.stringify({ ...draft, senderUserId: session?.userId, companyId, senderEmail: session?.email || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Email could not be sent")
      incrementRateLimit()
      setSentEmails((prev) => [{ ...draft, id: crypto.randomUUID(), sentAt: new Date().toISOString(), status: "sent" }, ...prev])
      setDraft(emptyDraft); setSecurityResult(null)
      setSuccess(`Sent to ${draft.to.join(", ")}`)
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send")
    } finally { setSending(false) }
  }

  return (
    <DashboardLayout title="EmailV" subtitle="Secure internal email — powered by Volt">
      <VoltPageTour storageKey="volt-emailv-tour-seen" steps={[
        { title: "Welcome to EmailV ⚡", description: "Send emails securely from inside Volt. Every email is screened for sensitive content, blocked domains, and rate limits before delivery.", image: "/volty/step-1-welcome.png", placement: "center" },
        { title: "Compose", description: "Add recipients (press Enter after each), write your subject and message. CC is optional. Your Volt identity is attached automatically.", target: '[data-tour="emailv-compose"]', placement: "right", mascotSide: "left", image: "/volty/step-3-dashboards.png" },
        { title: "Security Checks", description: "EmailV blocks disposable domains, detects sensitive words, limits 10 recipients, and enforces 5 emails/hour. Click Check before sending.", target: '[data-tour="emailv-send-btn"]', placement: "top", mascotSide: "right", image: "/volty/step-4-plan-upgrade.png" },
        { title: "Sent History", description: "Every email you send appears here so you have a complete outbound record.", target: '[data-tour="emailv-sent"]', placement: "left", mascotSide: "right", image: "/volty/step-5-build-dashboard.png" },
        { title: "You're ready!", description: "Configure VOLT_EMAIL_WEBHOOK_URL in your .env for real delivery. Without it, sends are logged to the server console.", image: "/volty/step-6-goodbye.png", placement: "center" },
      ]} />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
            <Shield className="h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-bold text-primary">EmailV Security Active</p>
              <p className="text-xs text-muted-foreground">Blocked domains · Sensitive content scan · {rateStatus.remaining}/{RATE_LIMIT_MAX} sends left this hour</p>
            </div>
          </div>

          <div data-tour="emailv-compose" className="glass-card space-y-4 rounded-2xl border border-border/60 p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10"><Mail className="h-4 w-4 text-primary" /></div>
              <h2 className="text-base font-bold text-foreground">Compose</h2>
              <span className="ml-auto flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-bold text-primary"><Lock className="h-3 w-3" />Secured</span>
            </div>

            <RecipientInput label="To" values={draft.to} onChange={(v) => setDraft((p) => ({ ...p, to: v }))} />
            <RecipientInput label="CC (optional)" values={draft.cc} onChange={(v) => setDraft((p) => ({ ...p, cc: v }))} />

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wide text-foreground">Subject</label>
              <input value={draft.subject} onChange={(e) => setDraft((p) => ({ ...p, subject: e.target.value }))} placeholder="Email subject" maxLength={200} className="w-full rounded-xl border border-border bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">Message</label>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-semibold", draft.body.length > MAX_BODY_CHARS * 0.9 ? "text-destructive" : "text-muted-foreground")}>{draft.body.length}/{MAX_BODY_CHARS}</span>
                  <button type="button" onClick={() => setBodyVisible((v) => !v)} className="text-muted-foreground hover:text-foreground">{bodyVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                </div>
              </div>
              {bodyVisible && <textarea value={draft.body} onChange={(e) => setDraft((p) => ({ ...p, body: e.target.value }))} placeholder="Write your message here…" rows={8} maxLength={MAX_BODY_CHARS} className="w-full resize-none rounded-xl border border-border bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10" />}
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-bold uppercase tracking-wide text-foreground">Priority</label>
              {(["normal", "high"] as const).map((p) => (
                <button key={p} type="button" onClick={() => setDraft((d) => ({ ...d, priority: p }))} className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition", draft.priority === p ? p === "high" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted/20 text-muted-foreground hover:bg-muted")}>{p}</button>
              ))}
            </div>

            {securityResult && (
              <div className="space-y-2">
                {securityResult.errors.map((e) => <div key={e} className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" /><p className="text-xs font-semibold text-destructive">{e}</p></div>)}
                {securityResult.warnings.map((w) => <div key={w} className="flex items-start gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-600" /><p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">{w}</p></div>)}
                {securityResult.passed && <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /><p className="text-xs font-semibold text-green-600">All security checks passed</p></div>}
              </div>
            )}

            {success && <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /><p className="text-xs font-semibold text-green-600">{success}</p></div>}
            {error && <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" /><p className="text-xs font-semibold text-destructive">{error}</p></div>}

            <div data-tour="emailv-send-btn" className="flex gap-2">
              <button type="button" onClick={runCheck} className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/20 px-4 py-2.5 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"><Shield className="h-4 w-4" />Check</button>
              <button type="button" onClick={handleSend} disabled={sending || !rateStatus.allowed} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-bold text-primary-foreground shadow transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40 disabled:translate-y-0">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? "Sending…" : "Send Email"}
              </button>
            </div>
          </div>
        </div>

        <div data-tour="emailv-sent" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Sent ({sentEmails.length})</h3>
            {sentEmails.length > 0 && <button type="button" onClick={() => setSentEmails([])} className="text-xs text-muted-foreground hover:text-destructive transition">Clear</button>}
          </div>
          {sentEmails.length === 0 ? (
            <div className="glass-card rounded-2xl border border-border/60 p-8 text-center"><Mail className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">No emails sent yet</p></div>
          ) : (
            <div className="space-y-2">
              {sentEmails.map((e) => (
                <div key={e.id} className="glass-card rounded-2xl border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">{e.subject || "(no subject)"}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">To: {e.to.join(", ")}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground/60">{new Date(e.sentAt).toLocaleString()}</p>
                    </div>
                    <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", e.status === "sent" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive")}>{e.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-2">
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-primary" />EmailV Security</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Disposable domains blocked</li>
              <li>• Sensitive content detection</li>
              <li>• Max {MAX_RECIPIENTS} recipients</li>
              <li>• Rate limited: {RATE_LIMIT_MAX}/hour</li>
              <li>• Sender identity attached</li>
              <li>• All sends server-logged</li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
