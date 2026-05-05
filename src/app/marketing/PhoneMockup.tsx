'use client'
import { useState, useEffect } from "react"

const PHONE_SCREENS = [
  { src: '/screen_width.jpg',   alt: 'AI measuring stair width — 1127mm detected',   label: 'Stair Width'  },
  { src: '/screen_tread.jpg',   alt: 'AI measuring tread depth — 267mm confirmed',   label: 'Tread Depth'  },
  { src: '/screen_nosing.jpg',  alt: 'Checking nosing — front edge of tread',         label: 'Nosing Check' },
  { src: '/screen_review.jpg',  alt: 'Review measurements before generating report', label: 'Review'       },
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
    }, 3000)
    return () => clearInterval(id)
  }, [])

  const screen = PHONE_SCREENS[active]

  return (
    <div style={{ position: 'relative', width: 240, userSelect: 'none' }}>
      {/* Phone shell */}
      <div style={{
        width: 240,
        borderRadius: 40,
        background: 'linear-gradient(160deg,#1c1c1e,#2c2c2e)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.05)',
        padding: '14px 11px 22px',
        position: 'relative',
      }}>
        {/* Dynamic island / notch */}
        <div style={{ width: 88, height: 28, background: '#1c1c1e', borderRadius: 16, margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#333' }} />
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#444' }} />
        </div>

        {/* Screen area */}
        <div style={{ borderRadius: 24, overflow: 'hidden', position: 'relative', background: '#000', aspectRatio: '9/19.5' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screen.src}
            alt={screen.alt}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: '50% 0%',
              display: 'block',
              opacity: fading ? 0 : 1,
              transition: 'opacity 0.35s ease',
            }}
          />
          {/* Measurement label overlay */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
            padding: '1.5rem 0.75rem 0.7rem',
            opacity: fading ? 0 : 1,
            transition: 'opacity 0.35s ease',
          }}>
            <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#F29337', letterSpacing: '0.12em', fontFamily: 'monospace' }}>
              {screen.label.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Home bar */}
        <div style={{ width: 88, height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 4, margin: '12px auto 0' }} />
      </div>
    </div>
  )
}

export { PhoneMockup }
export default PhoneMockup
