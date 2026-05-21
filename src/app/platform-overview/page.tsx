'use client'
import React from 'react'
import { NavLogo } from '@/app/components/Logo'

const SCREENS = [
  {
    src: '/screen_width.jpg',
    title: 'Live AI measurement with AR overlay',
    body: 'Point your phone at the stairs and stAIrcode goes to work immediately. The AI vision layer detects stair edges in real time, overlaying guide lines that snap to the top and bottom of the stair flight. A live measurement appears on screen as the reading stabilises. Each scan takes under 60 seconds.',
  },
  {
    src: '/screen_tread.jpg',
    title: 'Guided scan sequence — every dimension covered',
    body: 'The app walks you through seven measurements in sequence: riser height, tread depth, stair width, handrail height, nosing projection, headroom, and riser consistency. On-screen instructions tell you exactly where to point the camera. No experience needed.',
  },
  {
    src: '/screen_review.jpg',
    title: 'Review, adjust, and generate your report',
    body: 'After scanning, you review every captured measurement before generating the report. Values can be nudged up or down with the ± controls. Once confirmed, the app checks every dimension against your local building code and presents a pass/fail summary — then lets you unlock the full PDF report.',
  },
]

export default function PlatformOverviewPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: '#0D1E2E' }}>

      {/* Nav */}
      <header style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5EBF2', display: 'flex', alignItems: 'center', gap: '1rem', background: '#fff' }}>
        <a href="/marketing" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <NavLogo height={28} />
        </a>
        <a href="/marketing" style={{ fontSize: '0.78rem', color: '#5E7D9B', textDecoration: 'none', marginLeft: 'auto' }}>← Back</a>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 1.5rem' }}>

        <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.14em', color: '#F29337', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
          Platform Overview
        </div>
        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '1rem' }}>
          How the app works
        </h1>
        <p style={{ fontSize: '1rem', color: '#5E7D9B', lineHeight: 1.75, marginBottom: '3.5rem', maxWidth: 620 }}>
          stAIrcode is a Progressive Web App — it runs directly in your mobile browser with no download required. Here is what the experience looks like.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5rem' }}>
          {SCREENS.map((s, i) => (
            <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: '2.5rem', alignItems: 'center', flexDirection: i % 2 === 1 ? 'row-reverse' : 'row' }}>
              {/* Phone screenshot */}
              <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 220, borderRadius: 36, background: '#1c1c1e', boxShadow: '0 24px 64px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.08)', padding: '12px 10px 18px', overflow: 'hidden' }}>
                  {/* Notch */}
                  <div style={{ width: 72, height: 22, background: '#111', borderRadius: 12, margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2a2a2a' }} />
                  </div>
                  {/* Screen */}
                  <div style={{ borderRadius: 20, overflow: 'hidden', aspectRatio: '9/19.5', background: '#000' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.src} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ width: 70, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 3, margin: '10px auto 0' }} />
                </div>
              </div>

              {/* Text */}
              <div style={{ flex: '1 1 300px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#F29337', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Step {i + 1}
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2, color: '#0D1E2E', marginBottom: '0.75rem' }}>
                  {s.title}
                </h2>
                <p style={{ fontSize: '0.9rem', color: '#5E7D9B', lineHeight: 1.8, margin: 0 }}>
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Feature grid */}
        <div style={{ marginTop: '5rem', padding: '2.5rem', background: '#F0F5FA', borderRadius: 20 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0D1E2E', marginBottom: '1.5rem', textAlign: 'center' }}>
            What&apos;s included
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              ['📱', 'No app download required', 'Runs in any mobile browser as a PWA'],
              ['🧠', 'AI Vision measurement', 'Camera-based dimension estimation'],
              ['📋', 'Building code check', 'OBC, NBC, IBC, BCBC, AODA supported'],
              ['📄', 'PDF compliance report', 'Photos, citations, pass/fail table'],
              ['📍', 'Location-aware', 'Auto-detects local building code'],
              ['🔒', 'Secure & private', 'Images deleted immediately after scan'],
            ].map(([icon, title, desc]) => (
              <div key={String(title)} style={{ background: '#fff', borderRadius: 12, padding: '1rem', boxShadow: '0 1px 8px rgba(44,74,110,0.07)' }}>
                <div style={{ fontSize: '1.4rem', marginBottom: '0.35rem' }}>{icon}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0D1E2E', marginBottom: '0.2rem' }}>{title}</div>
                <div style={{ fontSize: '0.75rem', color: '#5E7D9B', lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <a href="/?signin=1" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#F29337,#C4721E)', color: '#fff', fontWeight: 800, fontSize: '1rem', textDecoration: 'none', padding: '0.9rem 2.5rem', borderRadius: 14, letterSpacing: '0.04em', boxShadow: '0 4px 20px rgba(242,147,55,0.4)' }}>
            Try it now — free →
          </a>
        </div>

      </div>
    </div>
  )
}
