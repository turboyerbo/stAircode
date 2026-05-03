'use client'
import { useState, useEffect } from "react"

// ── Animated Phone Mockup ─────────────────────────────────────────────────────
const PHONE_SCREENS = [
  { src: '/screen_width.jpg',   alt: 'AI measuring stair width — 1127mm detected',      label: 'Stair Width' },
  { src: '/screen_tread.jpg',   alt: 'AI measuring tread depth — 267mm confirmed',       label: 'Tread Depth' },
  { src: '/screen_nosing.jpg',  alt: 'Checking for nosing — front edge of tread',        label: 'Nosing Check' },
  { src: '/screen_review.jpg',  alt: 'Review measurements before generating report',     label: 'Review' },

]

function PhoneMockup() {
  const [active, setActive] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setActive(i => (i + 1) % PHONE_SCREENS.length)
        setFading(false)
      }, 350)
    }, 2800)
    return () => clearInterval(id)
  }, [])

  const screen = PHONE_SCREENS[active]

  return (
    <div style={{ position: 'relative', width: 220, userSelect: 'none' }}>
      {/* Phone shell */}
      <div style={{
        width: 220, borderRadius: 36,
        background: 'linear-gradient(160deg,#1c1c1e,#2c2c2e)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.05)',
        padding: '14px 10px 20px',
        position: 'relative',
      }}>
        {/* Notch */}
        <div style={{ width: 80, height: 26, background: '#1c1c1e', borderRadius: 14, margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#333' }} />
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#444' }} />
        </div>

        {/* Screen area */}
        <div style={{ borderRadius: 22, overflow: 'hidden', position: 'relative', background: '#000', aspectRatio: '9/19.5' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screen.src}
            alt={screen.alt}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              display: 'block',
              opacity: fading ? 0 : 1,
              transition: 'opacity 0.35s ease',
            }}
          />
          {/* Screen label overlay */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)',
            padding: '1.5rem 0.75rem 0.6rem',
            opacity: fading ? 0 : 1,
            transition: 'opacity 0.35s ease',
          }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#F29337', letterSpacing: '0.12em', fontFamily: 'monospace' }}>
              {screen.label.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Home bar */}
        <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 4, margin: '10px auto 0' }} />
      </div>

      {/* Screen dots */}
      <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 14 }}>
        {PHONE_SCREENS.map((_, i) => (
          <button key={i} onClick={() => setActive(i)} style={{
            width: i === active ? 18 : 6, height: 6,
            borderRadius: 3, border: 'none', cursor: 'pointer',
            background: i === active ? '#F29337' : 'rgba(255,255,255,0.25)',
            padding: 0, transition: 'all 0.25s',
          }} />
        ))}
      </div>
    </div>
  )
}

export { PhoneMockup }
export default PhoneMockup
