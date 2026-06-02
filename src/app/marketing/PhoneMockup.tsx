'use client'
import { useState, useEffect } from "react"

const PHONE_SCREENS = [
  {
    src:   '/screen_width.jpg',
    alt:   'AI measuring stair width — 1127mm detected in real time',
    label: 'Stair Width',
    badge: 'AI SCAN',
    badgeColor: '#27A96B',
  },
  {
    src:   '/screen_tread.jpg',
    alt:   'AI measuring tread depth — 267mm confirmed',
    label: 'Tread Depth',
    badge: 'OBC 2024',
    badgeColor: '#417CA4',
  },
  {
    src:   '/screen_results.jpg',
    alt:   '4 passed, 1 failed — guard height non-compliant at 1mm',
    label: 'Results',
    badge: 'INSTANT',
    badgeColor: '#E84545',
  },
  {
    src:   '/screen_foundation.jpg',
    alt:   'Foundation weeping tile analysis — filter fabric missing, action required',
    label: 'AI Analysis',
    badge: 'REPORT',
    badgeColor: '#C4780A',
  },
  {
    src:   '/screen_review.jpg',
    alt:   'Review measurements before generating report',
    label: 'Review',
    badge: 'REVIEW',
    badgeColor: '#417CA4',
  },
  {
    src:   '/screen_dashboard.jpg',
    alt:   'Generate Report dashboard — assemble and send final report',
    label: 'Generate Report',
    badge: 'PDF',
    badgeColor: '#F29337',
  },
  {
    src:   '/screen_report.jpg',
    alt:   'Professional 30-page PDF building inspection report',
    label: 'PDF Report',
    badge: '30 PAGES',
    badgeColor: '#27A96B',
  },
]

function PhoneMockup() {
  const [active, setActive]   = useState(0)
  const [fading, setFading]   = useState(false)
  const [paused, setPaused]   = useState(false)

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setActive(i => (i + 1) % PHONE_SCREENS.length)
        setFading(false)
      }, 350)
    }, 3200)
    return () => clearInterval(id)
  }, [paused])

  const screen = PHONE_SCREENS[active]

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>

      {/* Phone shell */}
      <div style={{
        width: 252,
        borderRadius: 44,
        background: 'linear-gradient(160deg,#1a1a1c,#2c2c2e)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(255,255,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.06)',
        padding: '14px 12px 24px',
        position: 'relative',
      }}>

        {/* Side buttons */}
        <div style={{ position:'absolute', left:-3, top:90, width:3, height:32, borderRadius:'2px 0 0 2px', background:'rgba(255,255,255,0.12)' }}/>
        <div style={{ position:'absolute', left:-3, top:132, width:3, height:56, borderRadius:'2px 0 0 2px', background:'rgba(255,255,255,0.12)' }}/>
        <div style={{ position:'absolute', left:-3, top:196, width:3, height:56, borderRadius:'2px 0 0 2px', background:'rgba(255,255,255,0.12)' }}/>
        <div style={{ position:'absolute', right:-3, top:130, width:3, height:80, borderRadius:'0 2px 2px 0', background:'rgba(255,255,255,0.12)' }}/>

        {/* Dynamic island */}
        <div style={{
          width: 92, height: 30,
          background: '#111',
          borderRadius: 18,
          margin: '0 auto 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#222' }}/>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2a2a2a' }}/>
        </div>

        {/* Screen area */}
        <div style={{
          borderRadius: 26,
          overflow: 'hidden',
          position: 'relative',
          background: '#000',
          aspectRatio: '9/19.5',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
        }}>
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

          {/* Top badge */}
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: screen.badgeColor,
            borderRadius: 6,
            padding: '2px 7px',
            fontSize: '0.44rem',
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '0.08em',
            opacity: fading ? 0 : 1,
            transition: 'opacity 0.35s ease',
          }}>
            {screen.badge}
          </div>

          {/* Bottom label gradient */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
            padding: '2rem 0.75rem 0.75rem',
            opacity: fading ? 0 : 1,
            transition: 'opacity 0.35s ease',
          }}>
            <div style={{ fontSize: '0.52rem', fontWeight: 800, color: '#F29337', letterSpacing: '0.12em' }}>
              {screen.label.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Home bar */}
        <div style={{ width: 88, height: 4, background: 'rgba(255,255,255,0.22)', borderRadius: 4, margin: '14px auto 0' }}/>
      </div>

      {/* Dot indicators below phone */}
      <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:16 }}>
        {PHONE_SCREENS.map((_, i) => (
          <button
            key={i}
            onClick={() => { setPaused(true); setFading(true); setTimeout(() => { setActive(i); setFading(false) }, 200) }}
            style={{
              width: i === active ? 18 : 6,
              height: 6,
              borderRadius: 3,
              background: i === active ? '#F29337' : 'rgba(255,255,255,0.25)',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>

    </div>
  )
}

export { PhoneMockup }
export default PhoneMockup
