"use client"

import { useEffect, useState } from "react"

export function VoltIntro({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    // Start fade out at 3.2s, fully done at 3.7s
    const fadeTimer = setTimeout(() => setFading(true), 3200)
    const doneTimer = setTimeout(() => onDone(), 3700)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <video
        src="/volt-intro.mp4"
        autoPlay
        muted
        playsInline
        className="max-w-sm w-full"
        style={{ objectFit: "contain" }}
      />
    </div>
  )
}
