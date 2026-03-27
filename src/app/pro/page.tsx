import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Staircode Pro — AR Measurement + Unlimited Reports',
  description: 'Upgrade to Staircode Pro for LiDAR-accurate AR measurements, unlimited PDF reports, and 10+ building code jurisdictions.',
}

const C = { blue: '#007FFF', orange: '#FF7F00', dark: '#0D2B45', text: '#1a2b3c' }

export default function ProPage() {
  return (
    <main style={{ minHeight: '100dvh', background: C.dark, color: '#fff', fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* Nav */}
      <nav style={{ padding: '1.2rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <a href="/" style={{ fontSize: '0.55rem', fontFamily: 'monospace', letterSpacing: '0.3em', color: C.orange, textDecoration: 'none' }}>▲ STAIRCODE</a>
        <a href="/" style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>← Back to app</a>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 480, margin: '0 auto', padding: '3rem 1.5rem 1.5rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(0,127,255,0.15)', border: '1px solid rgba(0,127,255,0.3)', borderRadius: 20, padding: '0.3rem 1rem', fontSize: '0.62rem', fontFamily: 'monospace', letterSpacing: '0.14em', color: C.blue, marginBottom: '1rem' }}>
          PRO PLAN
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 0.75rem' }}>
          AR-accurate stair<br />measurements
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: '0 0 2rem' }}>
          Upgrade from AI estimation to true plane-detection AR. Sub-5mm accuracy on ARCore and ARKit devices.
        </p>
        <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#fff', marginBottom: '0.2rem' }}>
          $38.99<span style={{ fontSize: '1rem', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/month</span>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginBottom: '2rem' }}>Cancel anytime · 7-day free trial</p>

        <a href="https://calendly.com/staircode/30min" target="_blank" rel="noopener noreferrer" style={{
          display: 'block', width: '100%', padding: '1.1rem',
          background: `linear-gradient(135deg,${C.blue},${C.orange})`,
          borderRadius: 16, color: '#fff', textDecoration: 'none',
          fontSize: '0.95rem', fontWeight: 700, fontFamily: 'monospace',
          letterSpacing: '0.1em', textAlign: 'center',
          boxShadow: '0 6px 32px rgba(0,127,255,0.4)',
        }}>
          Start Pro Trial →
        </a>
        <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)', marginTop: '0.75rem' }}>
          In-app payments launching with Google Play (April 2026) and App Store (May 2026).<br />
          Email us to subscribe now.
        </p>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {[
          { icon: '📡', title: 'AR Plane Detection', desc: 'WebXR plane tracking on ARCore (Android) and ARKit (iOS). Measurements lock to real-world geometry, not pixels.' },
          { icon: '📄', title: 'Unlimited PDF Reports', desc: 'Export clean, branded compliance reports with no disclaimer watermark. Email or share directly from the app.' },
          { icon: '🌍', title: '10+ Building Codes', desc: 'OBC 2024, NBC 2020, BCBC 2024, QBC, IRC 2021, IBC 2021, NYRC, NYBC, ADA, and Bbl 2024 (Netherlands).' },
          { icon: '🔄', title: 'All 8 Dimensions', desc: 'Riser, tread, nosing, width, headroom, handrail, landing, and variation — full compliance picture.' },
          { icon: '📊', title: 'Scan History', desc: 'Save and revisit past inspections. Compare before/after renovations.' },
        ].map(f => (
          <div key={f.title} style={{ display: 'flex', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{f.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{f.title}</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </section>

      {/* CTA footer */}
      <section style={{ textAlign: 'center', padding: '2rem 1.5rem 4rem' }}>
        <a href="https://calendly.com/staircode/30min" target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-block', padding: '1rem 2.5rem',
          background: `linear-gradient(135deg,${C.blue},${C.orange})`,
          borderRadius: 16, color: '#fff', textDecoration: 'none',
          fontSize: '0.88rem', fontWeight: 700, fontFamily: 'monospace',
          letterSpacing: '0.1em', boxShadow: '0 4px 24px rgba(0,127,255,0.35)',
        }}>
          Book a Call →
        </a>
        <p style={{ marginTop: '1rem', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>
          © {new Date().getFullYear()} Staircode Inc. ·{' '}
          <a href="/privacy" style={{ color: 'rgba(255,255,255,0.3)' }}>Privacy</a> ·{' '}
          <a href="/terms" style={{ color: 'rgba(255,255,255,0.3)' }}>Terms</a>
        </p>
      </section>
    </main>
  )
}
