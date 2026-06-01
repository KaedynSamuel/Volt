"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { VoltPageTour } from "@/components/tours/VoltPageTour"
import { cn } from "@/lib/utils"
import {
  FileText,
  Table2,
  Upload,
  Download,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Type,
  X,
  ChevronRight,
  Plus,
  Minus,
  Mail,
  Shield,
  Send,
  AlertTriangle,
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import { getStoredSession } from "@/lib/auth"
import { getStoredCompanyId } from "@/lib/tenant"

// ────────────────────────────────────────────
// VOLTE DOCS — rich-text editor
// ────────────────────────────────────────────
function VolteDocs({ onClose }: { onClose: () => void }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [fileName, setFileName] = useState("Untitled Document")
  const fileInputRef = useRef<HTMLInputElement>(null)

  function exec(cmd: string, value?: string) {
    document.execCommand(cmd, false, value)
    editorRef.current?.focus()
  }

  function exportDoc() {
    const content = editorRef.current?.innerHTML || ""
    const blob = new Blob(
      [`<!DOCTYPE html><html><body>${content}</body></html>`],
      { type: "text/html" },
    )
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${fileName}.html`
    a.click()
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      if (editorRef.current) {
        if (file.name.endsWith(".html") || file.name.endsWith(".htm")) {
          const parser = new DOMParser()
          const doc = parser.parseFromString(text, "text/html")
          editorRef.current.innerHTML = doc.body.innerHTML
        } else {
          editorRef.current.innerText = text
        }
      }
      setFileName(file.name.replace(/\.[^/.]+$/, ""))
    }
    reader.readAsText(file)
  }

  const toolbarGroups = [
    [
      { icon: Bold, title: "Bold", action: () => exec("bold") },
      { icon: Italic, title: "Italic", action: () => exec("italic") },
      { icon: Underline, title: "Underline", action: () => exec("underline") },
    ],
    [
      { icon: AlignLeft, title: "Align Left", action: () => exec("justifyLeft") },
      { icon: AlignCenter, title: "Align Center", action: () => exec("justifyCenter") },
      { icon: AlignRight, title: "Align Right", action: () => exec("justifyRight") },
    ],
    [
      { icon: List, title: "Bullet List", action: () => exec("insertUnorderedList") },
      { icon: ListOrdered, title: "Numbered List", action: () => exec("insertOrderedList") },
    ],
    [
      { icon: Type, title: "Heading 1", action: () => exec("formatBlock", "h1") },
      { icon: Type, title: "Heading 2", action: () => exec("formatBlock", "h2") },
    ],
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
          <FileText className="h-4 w-4 text-blue-400" />
        </div>
        <input
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-foreground outline-none"
        />
        <div className="flex items-center gap-1.5">
          <input ref={fileInputRef} type="file" accept=".txt,.html,.htm" className="hidden" onChange={handleImport} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Import file"
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </button>
          <button
            type="button"
            onClick={exportDoc}
            title="Export"
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border/40 bg-background/50 px-3 py-1.5">
        {toolbarGroups.map((group, gi) => (
          <span key={gi} className={cn("flex items-center gap-0.5", gi > 0 && "ml-1 border-l border-border/50 pl-1")}>
            {group.map(({ icon: Icon, title, action }) => (
              <button
                key={title}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); action() }}
                title={title}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </span>
        ))}
        <span className="ml-1 border-l border-border/50 pl-1">
          <select
            onChange={(e) => exec("fontSize", e.target.value)}
            defaultValue="3"
            className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((s) => (
              <option key={s} value={s}>{[8,10,12,14,18,24,36][s-1]}pt</option>
            ))}
          </select>
        </span>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto bg-white p-8">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-full max-w-none text-black outline-none [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal"
          data-placeholder="Start typing your document here…"
          style={{ fontSize: "14px", lineHeight: "1.7", fontFamily: "Georgia, serif" }}
        />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// VOLTE SHEETS — spreadsheet viewer/editor
// ────────────────────────────────────────────
const DEFAULT_ROWS = 20
const DEFAULT_COLS = 10

type CellData = Record<string, string>
type Selection = { row: number; col: number } | null

function colLabel(i: number) {
  let label = ""
  let n = i + 1
  while (n > 0) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}

function VolteSheets({ onClose }: { onClose: () => void }) {
  const [cells, setCells] = useState<CellData>({})
  const [rows, setRows] = useState(DEFAULT_ROWS)
  const [cols, setCols] = useState(DEFAULT_COLS)
  const [selected, setSelected] = useState<Selection>(null)
  const [fileName, setFileName] = useState("Untitled Sheet")
  const fileInputRef = useRef<HTMLInputElement>(null)

  function cellKey(r: number, c: number) { return `${r}:${c}` }
  function getCellValue(r: number, c: number) { return cells[cellKey(r, c)] || "" }

  function handleCellChange(r: number, c: number, value: string) {
    setCells((prev) => ({ ...prev, [cellKey(r, c)]: value }))
  }

  function exportCsv() {
    const lines = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => `"${getCellValue(r, c).replace(/"/g, '""')}"`).join(",")
    )
    const blob = new Blob([lines.join("\n")], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${fileName}.csv`
    a.click()
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const newCells: CellData = {}
      const lines = text.split("\n")
      let maxCol = DEFAULT_COLS
      lines.forEach((line, r) => {
        const parts = line.split(",").map((p) => p.replace(/^"|"$/g, "").replace(/""/g, '"'))
        parts.forEach((val, c) => {
          if (val) newCells[cellKey(r, c)] = val
        })
        if (parts.length > maxCol) maxCol = parts.length
      })
      setCells(newCells)
      setRows(Math.max(DEFAULT_ROWS, lines.length + 2))
      setCols(Math.max(DEFAULT_COLS, maxCol + 1))
      setFileName(file.name.replace(/\.[^/.]+$/, ""))
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-green-500/10">
          <Table2 className="h-4 w-4 text-green-400" />
        </div>
        <input
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-foreground outline-none"
        />
        <div className="flex items-center gap-1.5">
          <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleImport} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Upload className="h-3.5 w-3.5" />
            Import CSV
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <div className="ml-1 flex items-center gap-1 border-l border-border/50 pl-2">
            <button type="button" onClick={() => setRows((r) => r + 5)} title="Add rows" className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition">
              <Plus className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-muted-foreground">Rows</span>
            <button type="button" onClick={() => setCols((c) => c + 2)} title="Add columns" className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition ml-1">
              <Plus className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-muted-foreground">Cols</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground ml-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 border-b border-border/40 bg-background/50 px-3 py-1.5">
        <span className="text-xs font-bold text-muted-foreground w-12 text-center">
          {selected ? `${colLabel(selected.col)}${selected.row + 1}` : "—"}
        </span>
        <div className="h-4 w-px bg-border" />
        <input
          value={selected ? getCellValue(selected.row, selected.col) : ""}
          onChange={(e) => {
            if (selected) handleCellChange(selected.row, selected.col, e.target.value)
          }}
          placeholder="Formula or value"
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 w-10 border border-border/50 bg-muted/60 px-2 py-1 text-center text-[10px] font-bold text-muted-foreground" />
              {Array.from({ length: cols }, (_, c) => (
                <th
                  key={c}
                  className="sticky top-0 z-10 min-w-[80px] border border-border/50 bg-muted/60 px-2 py-1 text-center text-[10px] font-bold text-muted-foreground"
                >
                  {colLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <td className="sticky left-0 z-10 border border-border/50 bg-muted/40 px-2 py-0.5 text-center text-[10px] font-bold text-muted-foreground">
                  {r + 1}
                </td>
                {Array.from({ length: cols }, (_, c) => {
                  const isSelected = selected?.row === r && selected?.col === c
                  return (
                    <td
                      key={c}
                      onClick={() => setSelected({ row: r, col: c })}
                      className={cn(
                        "border border-border/50 p-0",
                        isSelected && "ring-2 ring-inset ring-primary",
                      )}
                    >
                      <input
                        value={getCellValue(r, c)}
                        onChange={(e) => handleCellChange(r, c, e.target.value)}
                        onFocus={() => setSelected({ row: r, col: c })}
                        className="h-6 w-full bg-transparent px-1.5 text-foreground outline-none"
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// APPS PAGE
// ────────────────────────────────────────────
// ────────────────────────────────────────────
// EMAILV — secure email (embedded in Apps)
// ────────────────────────────────────────────
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

type EmailDraft = { to: string[]; cc: string[]; subject: string; body: string; priority: "normal" | "high" }
type SentEmail = EmailDraft & { id: string; sentAt: string }
type SecurityCheck = { passed: boolean; warnings: string[]; errors: string[] }

function isValidEmailAddr(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) }
function isBlockedEmailDomain(e: string) { return BLOCKED_DOMAINS.includes(e.split("@")[1]?.toLowerCase() || "") }
function hasSensitiveEmailContent(text: string) {
  return BLOCKED_PATTERNS.filter((p) => p.test(text)).map((p) => p.source.replace(/\\b/g,"").replace(/\?/g,"").replace(/\./g," "))
}
function runEmailSecurityChecks(draft: EmailDraft): SecurityCheck {
  const errors: string[] = []
  const warnings: string[] = []
  const all = [...draft.to, ...draft.cc]
  for (const e of all) {
    if (!isValidEmailAddr(e)) errors.push(`Invalid email: ${e}`)
    if (isBlockedEmailDomain(e)) errors.push(`Disposable address blocked: ${e}`)
  }
  if (all.length > MAX_RECIPIENTS) errors.push(`Too many recipients (max ${MAX_RECIPIENTS})`)
  if (draft.to.length === 0) errors.push("At least one recipient required")
  if (!draft.subject.trim()) errors.push("Subject is required")
  if (draft.body.length > MAX_BODY_CHARS) errors.push(`Body too long (max ${MAX_BODY_CHARS})`)
  const bodyFlags = hasSensitiveEmailContent(draft.body)
  if (bodyFlags.length) warnings.push(`Body may contain sensitive data: ${bodyFlags.join(", ")}`)
  return { passed: errors.length === 0, warnings, errors }
}

const emptyEmailDraft: EmailDraft = { to: [], cc: [], subject: "", body: "", priority: "normal" }

function EmailRecipientInput({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("")
  function add() {
    const t = input.trim()
    if (t && !values.includes(t)) onChange([...values, t])
    setInput("")
  }
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold uppercase tracking-wide text-foreground">{label}</label>
      <div className="flex flex-wrap gap-1 min-h-9 rounded-xl border border-border bg-background/70 px-2 py-1.5">
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
          placeholder={values.length === 0 ? "email and press Enter" : ""}
          className="min-w-[140px] flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  )
}

function EmailVApp({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<EmailDraft>(emptyEmailDraft)
  const [securityResult, setSecurityResult] = useState<SecurityCheck | null>(null)
  const [sending, setSending] = useState(false)
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([])
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [bodyVisible, setBodyVisible] = useState(true)

  function runCheck() { const r = runEmailSecurityChecks(draft); setSecurityResult(r); return r }

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
        body: JSON.stringify({ ...draft, senderUserId: session?.userId, companyId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Email could not be sent")
      setSentEmails((prev) => [{ ...draft, id: crypto.randomUUID(), sentAt: new Date().toISOString() }, ...prev])
      setDraft(emptyEmailDraft); setSecurityResult(null)
      setSuccess(`Sent to ${draft.to.join(", ")}`)
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send")
    } finally { setSending(false) }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
          <Mail className="h-4 w-4 text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">EmailV</p>
          <p className="text-xs text-muted-foreground">Secure email</p>
        </div>
        <span className="ml-1 flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-bold text-primary"><Lock className="h-2.5 w-2.5" />Secured</span>
        <button type="button" onClick={onClose} className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Compose */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
            <Shield className="h-3.5 w-3.5 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground">Blocked domains · Sensitive content scan · Max {MAX_RECIPIENTS} recipients</p>
          </div>

          <EmailRecipientInput label="To" values={draft.to} onChange={(v) => setDraft((p) => ({ ...p, to: v }))} />
          <EmailRecipientInput label="CC (optional)" values={draft.cc} onChange={(v) => setDraft((p) => ({ ...p, cc: v }))} />

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wide text-foreground">Subject</label>
            <input value={draft.subject} onChange={(e) => setDraft((p) => ({ ...p, subject: e.target.value }))} placeholder="Email subject" maxLength={200} className="w-full rounded-xl border border-border bg-background/70 px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary" />
          </div>

          <div className="flex flex-1 flex-col space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wide text-foreground">Message</label>
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px]", draft.body.length > MAX_BODY_CHARS * 0.9 ? "text-destructive" : "text-muted-foreground")}>{draft.body.length}/{MAX_BODY_CHARS}</span>
                <button type="button" onClick={() => setBodyVisible((v) => !v)} className="text-muted-foreground hover:text-foreground">{bodyVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</button>
              </div>
            </div>
            {bodyVisible && <textarea value={draft.body} onChange={(e) => setDraft((p) => ({ ...p, body: e.target.value }))} placeholder="Write your message…" rows={6} maxLength={MAX_BODY_CHARS} className="w-full resize-none rounded-xl border border-border bg-background/70 px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary" />}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-foreground">Priority</span>
            {(["normal", "high"] as const).map((p) => (
              <button key={p} type="button" onClick={() => setDraft((d) => ({ ...d, priority: p }))} className={cn("rounded-lg border px-3 py-1 text-xs font-semibold capitalize transition", draft.priority === p ? p === "high" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted/20 text-muted-foreground hover:bg-muted")}>{p}</button>
            ))}
          </div>

          {securityResult && (
            <div className="space-y-1.5">
              {securityResult.errors.map((e) => <div key={e} className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" /><p className="text-xs font-semibold text-destructive">{e}</p></div>)}
              {securityResult.warnings.map((w) => <div key={w} className="flex items-start gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-600" /><p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">{w}</p></div>)}
              {securityResult.passed && <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /><p className="text-xs font-semibold text-green-600">All security checks passed</p></div>}
            </div>
          )}
          {success && <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /><p className="text-xs font-semibold text-green-600">{success}</p></div>}
          {error && <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" /><p className="text-xs font-semibold text-destructive">{error}</p></div>}

          <div className="flex gap-2">
            <button type="button" onClick={runCheck} className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/20 px-4 py-2 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"><Shield className="h-4 w-4" />Check</button>
            <button type="button" onClick={handleSend} disabled={sending} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-bold text-primary-foreground shadow transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40 disabled:translate-y-0">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Sending…" : "Send Email"}
            </button>
          </div>
        </div>

        {/* Sent panel */}
        <div className="w-56 shrink-0 border-l border-border/50 bg-muted/10 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
            <p className="text-xs font-bold text-foreground">Sent ({sentEmails.length})</p>
            {sentEmails.length > 0 && <button type="button" onClick={() => setSentEmails([])} className="text-[10px] text-muted-foreground hover:text-destructive">Clear</button>}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {sentEmails.length === 0 ? (
              <div className="py-8 text-center"><Mail className="mx-auto mb-1.5 h-6 w-6 text-muted-foreground/40" /><p className="text-xs text-muted-foreground">No sent emails</p></div>
            ) : sentEmails.map((e) => (
              <div key={e.id} className="rounded-xl border border-border/50 bg-card/50 p-2">
                <p className="truncate text-xs font-semibold text-foreground">{e.subject || "(no subject)"}</p>
                <p className="truncate text-[10px] text-muted-foreground">To: {e.to.join(", ")}</p>
                <p className="text-[10px] text-muted-foreground/60">{new Date(e.sentAt).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// APPS PAGE
// ────────────────────────────────────────────
type AppTool = "docs" | "sheets" | "emailv" | null

const APP_CARDS = [
  {
    id: "docs" as AppTool,
    name: "Volte Docs",
    tagline: "Write, format and export documents",
    description:
      "Create documents with rich formatting — headings, lists, bold, italic and more. Import text or HTML files and export your work. A clean writing space built right into Volt.",
    icon: FileText,
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
    border: "hover:border-blue-500/40",
    badge: "Document editor",
  },
  {
    id: "sheets" as AppTool,
    name: "Volte Sheets",
    tagline: "View and edit tabular data",
    description:
      "A built-in spreadsheet for viewing, editing and analysing data. Import CSV files, edit cells directly, add rows and columns, and export back to CSV. No external tools needed.",
    icon: Table2,
    iconBg: "bg-green-500/10",
    iconColor: "text-green-400",
    border: "hover:border-green-500/40",
    badge: "Spreadsheet editor",
  },
  {
    id: "emailv" as AppTool,
    name: "EmailV",
    tagline: "Secure email from your workspace",
    description:
      "Send emails to any address securely from inside Volt. EmailV screens every email for blocked domains and sensitive content before it leaves, keeping your outbound communications safe.",
    icon: Mail,
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-400",
    border: "hover:border-violet-500/40",
    badge: "Secure email",
  },
]

export default function EnvironmentsPage() {
  const [openApp, setOpenApp] = useState<AppTool>(null)

  if (openApp === "docs") {
    return (
      <DashboardLayout title="Volte Docs" subtitle="Document editor">
        <div className="h-[calc(100vh-10rem)]">
          <VolteDocs onClose={() => setOpenApp(null)} />
        </div>
      </DashboardLayout>
    )
  }

  if (openApp === "sheets") {
    return (
      <DashboardLayout title="Volte Sheets" subtitle="Spreadsheet editor">
        <div className="h-[calc(100vh-10rem)]">
          <VolteSheets onClose={() => setOpenApp(null)} />
        </div>
      </DashboardLayout>
    )
  }

  if (openApp === "emailv") {
    return (
      <DashboardLayout title="EmailV" subtitle="Secure email">
        <div className="h-[calc(100vh-10rem)]">
          <EmailVApp onClose={() => setOpenApp(null)} />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Apps" subtitle="Built-in tools for your workspace">
      <VoltPageTour
        storageKey="volt-apps-tour-seen"
        steps={[
          {
            title: "Welcome to Volt Apps ⚡",
            description: "Your built-in productivity tools — Docs, Sheets, and secure Email. No installs, no external accounts, everything runs inside Volt.",
            image: "/volty/step-1-welcome.png",
            placement: "center",
          },
          {
            title: "Volte Docs",
            description: "A full document editor with formatting, import and export. Write reports, notes or any document without leaving Volt.",
            target: "[data-tour=\"app-cards\"]",
            placement: "bottom",
            mascotSide: "right",
            image: "/volty/step-3-dashboards.png",
          },
          {
            title: "Volte Sheets",
            description: "A live spreadsheet. Import CSV, edit cells, add rows and columns, and export back to CSV — all inside Volt.",
            target: "[data-tour=\"app-cards\"]",
            placement: "top",
            mascotSide: "left",
            image: "/volty/step-4-plan-upgrade.png",
          },
          {
            title: "EmailV — Secure Email",
            description: "Send emails to any address securely. EmailV blocks disposable domains, scans for sensitive content, and logs every send for your audit trail.",
            target: "[data-tour=\"app-cards\"]",
            placement: "top",
            mascotSide: "right",
            image: "/volty/step-5-build-dashboard.png",
          },
          {
            title: "You're all set!",
            description: "Click any app card to open the tool. More apps coming soon from Volty!",
            image: "/volty/step-6-goodbye.png",
            placement: "center",
          },
        ]}
      />
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border-2 border-primary/30 shadow-lg">
            <img
              src="/volty/volty-4.png"
              alt="Volty"
              className="h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = "/volty/ChatGPT_Image_May_27__2026__04_08_21_AM__10_-removebg-preview.png" }}
            />
          </div>
          <h2 className="text-2xl font-black text-foreground">Volt Apps</h2>
          <p className="mt-1 text-muted-foreground">
            Productivity tools built right into your workspace — no installs, no sign-ups.
          </p>
        </div>

        {/* App cards */}
        <div data-tour="app-cards" className="grid gap-5 sm:grid-cols-3">
          {APP_CARDS.map((app) => {
            const Icon = app.icon
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => setOpenApp(app.id)}
                className={cn(
                  "group glass-card relative overflow-hidden rounded-3xl border border-border/60 p-6 text-left transition-all duration-300",
                  "hover:-translate-y-1 hover:shadow-xl",
                  app.border,
                  "before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-foreground/5 before:to-transparent before:transition-transform before:duration-700 hover:before:translate-x-full",
                )}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 transition group-hover:scale-110", app.iconBg)}>
                    <Icon className={cn("h-6 w-6", app.iconColor)} />
                  </div>
                  <div>
                    <p className="text-base font-black text-foreground">{app.name}</p>
                    <p className="text-xs font-semibold text-muted-foreground">{app.tagline}</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{app.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {app.badge}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-bold text-primary transition group-hover:translate-x-0.5">
                    Open <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          More apps coming to Volt — Volty is always working on something new ⚡
        </p>
      </div>
    </DashboardLayout>
  )
}
