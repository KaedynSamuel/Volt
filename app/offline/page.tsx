"use client"

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚡</div>
        <h1 className="text-2xl font-bold mb-2">You're offline</h1>
        <p className="text-muted-foreground mb-6">
          Volt needs an internet connection to sync your data. Please check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
