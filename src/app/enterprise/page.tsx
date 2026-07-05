import React from 'react'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Staircode Enterprise — Team Access & API for Architecture Firms',
  description: 'Staircode Enterprise gives architecture and engineering firms team seats, API access, BIM export, and a custom code library.',
}

const C = { blue: '#007FFF', orange: '#FF7F00', dark: '#0D2B45' }

export default function EnterprisePage() {
  return (
    <main style={{ minHeight: '100dvh', background: C.dark, color: '#fff', fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}><nav style={{ padding: '1.2rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}><a href="/" style={{ fontSize: '0.55rem', letterSpacing: '0.04em', color: C.orange, textDecoration: 'none' }}>{/* eslint-disable-next-line @next/next/no-img-element */}
              <img src='/staircode_header.jpg' alt='stAIrcode' style={{height:24,objectFit:'contain'}} /></a>
        <a href="/" style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>← Back to app</a>
      </nav>

      <section style={{ maxWidth: 520, margin: '0 auto', padding: '3rem 1.5rem 1.5rem', textAlign: 'center' }}><div style={{ display: 'inline-block', background: 'rgba(255,127,0,0.15)', border: '1px solid rgba(255,127,0,0.3)', borderRadius: 20, padding: '0.3rem 1rem', fontSize: '0.62rem', letterSpacing: '0.04em', color: C.orange, marginBottom: '1rem' }}>ENTERPRISE
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 0.75rem' }}>Built for architecture<br />firms and studios
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: '0 0 2rem' }}>Team-wide access, API integration with your workflow, custom code libraries, and white-label PDF reports.
        </p>
        <div style={{ fontSize: '2.4rem', fontWeight: 700, color: '#fff', marginBottom: '0.2rem' }}>$79<span style={{ fontSize: '1rem', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/month</span>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginBottom: '2rem' }}>Up to 10 seats · Volume pricing available</p>

        <a href="https://calendly.com/staircode/30min" target="_blank" rel="noopener noreferrer" style={{
          display: 'block', width: '100%', padding: '1.1rem',
          background: `linear-gradient(135deg,${C.orange},${C.blue})`,
          borderRadius: 16, color: '#fff', textDecoration: 'none',
          fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.1em', textAlign: 'center',
          boxShadow: '0 6px 32px rgba(255,127,0,0.3)',
        }}>Book a 30-min Call →
        </a>
      </section>

      <section style={{ maxWidth: 520, margin: '0 auto', padding: '2rem 1.5rem' }}>{[
          { icon: '', title: 'Team Seats (up to 10)', desc: 'Every team member gets full Pro access. Centralised billing, shared scan history.' },
          { icon: '', title: 'REST API Access', desc: 'Integrate Staircode measurements directly into your BIM workflow, Revit plugins, or project management tools.' },
          { icon: '', title: 'BIM / IFC Export', desc: 'Export compliance data as IFC-compatible JSON for import into Revit, ArchiCAD, and Vectorworks.' },
          { icon: '', title: 'Custom Code Library', desc: 'Add your own local amendments, house styles, or client-specific tolerances.' },
          { icon: '', title: 'Dedicated Support', desc: 'Priority email support with a 4-hour response SLA during business hours.' },
          { icon: '', title: 'White-Label Reports', desc: 'PDF reports branded with your firm logo and contact details.' },
        ].map(f => (
          <div key={f.title} style={{ display: 'flex', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{f.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{f.title}</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </section>

      <section style={{ textAlign: 'center', padding: '2rem 1.5rem 4rem' }}><a href="https://calendly.com/staircode/30min" target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-block', padding: '1rem 2.5rem',
          background: `linear-gradient(135deg,${C.orange},${C.blue})`,
          borderRadius: 16, color: '#fff', textDecoration: 'none',
          fontSize: '0.88rem', fontWeight: 700, letterSpacing: '0.1em', boxShadow: '0 4px 24px rgba(255,127,0,0.3)',
        }}>Book a 30-min Call →
        </a>
        <p style={{ marginTop: '1rem', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} Just Open Technologies Inc. ·{' '}
          <a href="/privacy" style={{ color: 'rgba(255,255,255,0.3)' }}>Privacy</a> ·{' '}
          <a href="/terms" style={{ color: 'rgba(255,255,255,0.3)' }}>Terms</a>
        </p>
      </section>
    </main>
  )
}
