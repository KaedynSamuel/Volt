"use client"

import { useEffect, useRef, useState } from "react"

export function VoltIntro({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    function handleEnded() {
      setFading(true)
      setTimeout(() => onDone(), 700)
    }

    video.addEventListener("ended", handleEnded)

    // Fallback: if video doesn't load or play, bail out after 5s
    const fallback = setTimeout(() => {
      setFading(true)
      setTimeout(() => onDone(), 700)
    }, 5000)

    return () => {
      video.removeEventListener("ended", handleEnded)
      clearTimeout(fallback)
    }
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0f]"
      style={{
        transition: "opacity 0.7s ease-out",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <video
        ref={videoRef}
        src="/volt-intro.mp4"
        autoPlay
        muted
        playsInline
        style={{
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
        }}
      />
    </div>
  )
}
