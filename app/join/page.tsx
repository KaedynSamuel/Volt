"use client"

import Link from "next/link"
import { ArrowLeft, ShieldCheck } from "lucide-react"

export default function JoinPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="glass-card w-full max-w-md space-y-5 p-7 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Access codes removed</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your company admin now creates your account directly from the Team page and gives you your email, temporary password, and role.
          </p>
        </div>
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
      </div>
    </main>
  )
}
