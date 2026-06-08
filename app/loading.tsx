import { Zap } from "lucide-react"

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex h-20 w-20 animate-pulse items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent shadow-[0_0_50px_rgba(34,197,94,0.35)]">
          <Zap className="h-10 w-10 text-primary-foreground" />
        </div>

        <h1 className="text-2xl font-bold">Loading Volt</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Preparing your dashboard...
        </p>
      </div>
    </main>
  )
}