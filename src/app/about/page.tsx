'use client'
import React from 'react'
import { NavLogo } from '@/app/components/Logo'

const NAVY   = '#0D1E2E'
const NAVY2  = '#3A5A78'
const ORANGE = '#F29337'
const BORDER = '#E5EBF2'
const BG2    = '#F7FAFC'

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: NAVY }}>

      {/* ── Nav ── */}
      <header style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', background: '#fff', position: 'sticky', top: 0, zIndex: 50 }}>
        <a href="/marketing" style={{ textDecoration: 'none' }}>
          <NavLogo height={28} />
        </a>
        <a href="/marketing" style={{ fontSize: '0.78rem', color: NAVY2, textDecoration: 'none', marginLeft: 'auto' }}>← Back</a>
      </header>

      {/* ── Hero ── */}
      <div style={{ background: NAVY, padding: '5rem 1.5rem 4.5rem' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.04em', color: ORANGE, textTransform: 'uppercase', marginBottom: '1rem' }}>About</div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#E8F4FF', margin: 0 }}>Who We Are</h1>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '4rem 1.5rem 6rem' }}>

        {/* Intro */}
        <p style={{ fontSize: '1.1rem', color: NAVY2, lineHeight: 1.85, marginBottom: '3rem', maxWidth: 680 }}>
          Just Open Technologies is a software company built on a simple idea: the tools that architects, inspectors, and builders rely on every day should be as rigorous as the codes they enforce — and as easy to use as the phone in your pocket.
        </p>
        <p style={{ fontSize: '1rem', color: NAVY2, lineHeight: 1.85, marginBottom: '4rem', maxWidth: 680 }}>
          We sit at the intersection of architecture and technology. Our products are shaped by real practice, real code expertise, and a deep understanding of what it means to be accountable for a built environment.
        </p>

        <hr style={{ border: 'none', borderTop: `1px solid ${BORDER}`, marginBottom: '4rem' }} />

        {/* JOA Section */}
        <section style={{ marginBottom: '4rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.04em', color: ORANGE, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Just Open Architecture
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: NAVY, marginBottom: '1.25rem' }}>
            Just Open Architecture
          </h2>
          <p style={{ fontSize: '1rem', color: NAVY2, lineHeight: 1.85, marginBottom: '1.25rem', maxWidth: 660 }}>
            Just Open Technologies grew out of <a href="https://www.justopenarch.com/" target="_blank" rel="noopener noreferrer" style={{ color: NAVY, fontWeight: 700, textDecoration: 'underline', textDecorationColor: ORANGE }}>Just Open Architecture (JOA)</a>, a practice founded in Rotterdam in 2014. JOA brought together computational design, building technology, and a rigorous approach to the built environment — the same principles that now drive our software.
          </p>
          <p style={{ fontSize: '1rem', color: NAVY2, lineHeight: 1.85, maxWidth: 660 }}>
            JOA continues to operate as an independent architecture practice, and the two firms share a common commitment to rigour, openness, and doing the technical work properly.
          </p>
        </section>

        <hr style={{ border: 'none', borderTop: `1px solid ${BORDER}`, marginBottom: '4rem' }} />

        {/* stAIrcode Section */}
        <section style={{ marginBottom: '4rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.04em', color: ORANGE, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Our Product
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: NAVY, marginBottom: '1.25rem' }}>
            stAIrcode
          </h2>
          <p style={{ fontSize: '1rem', color: NAVY2, lineHeight: 1.85, marginBottom: '1.25rem', maxWidth: 660 }}>
            stAIrcode is our flagship product — a mobile app that checks building compliance against local codes using your phone camera. It supports the Ontario Building Code (OBC), National Building Code (NBC), Quebec Building Code (QBC), New York Building Code (Bbl, RCNYS), and more, with AI-assisted measurements and auto-detected jurisdiction.
          </p>
          <p style={{ fontSize: '1rem', color: NAVY2, lineHeight: 1.85, maxWidth: 660 }}>
            Built for architects, contractors, inspectors, and homeowners, stAIrcode replaces the tape measure and the code book with a single tool that fits in your hand.
          </p>
        </section>

        <hr style={{ border: 'none', borderTop: `1px solid ${BORDER}`, marginBottom: '4rem' }} />

        {/* Team Section */}
        <section style={{ marginBottom: '4rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.04em', color: ORANGE, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            The Team
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: NAVY, marginBottom: '2rem' }}>
            The Team
          </h2>

          {/* Jordan Yerbury */}
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', padding: '2rem', background: BG2, borderRadius: 16, border: `1px solid ${BORDER}`, maxWidth: 680 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: `linear-gradient(135deg, ${NAVY}, #2C5A7A)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>JY</span>
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: NAVY, marginBottom: '0.2rem' }}>Jordan Yerbury</div>
              <div style={{ fontSize: '0.78rem', color: ORANGE, fontWeight: 700, marginBottom: '0.6rem' }}>Director — Toronto, Canada</div>
              <p style={{ fontSize: '0.88rem', color: NAVY2, lineHeight: 1.75, margin: 0 }}>
                Jordan is a licensed architect with the Ontario Association of Architects (OAA). He holds a Master of Science in Architecture from Delft University of Technology and a Bachelor of Architectural Studies from Carleton University. His career spans firms including Hariri Pontarini Architects, CORE Architects, and NORR, alongside roles in building technology software development.
              </p>
            </div>
          </div>
        </section>

        <hr style={{ border: 'none', borderTop: `1px solid ${BORDER}`, marginBottom: '4rem' }} />

        {/* CTA / Link to justopen.tech */}
        <div style={{ background: NAVY, borderRadius: 20, padding: '2.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#E8F4FF', marginBottom: '0.35rem' }}>Just Open Technologies</div>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0, maxWidth: 360 }}>
              Learn more about our company, our architecture practice, and the principles behind our work.
            </p>
          </div>
          <a
            href="https://justopen.tech/about"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-block', background: `linear-gradient(135deg,${ORANGE},#C4721E)`, color: '#fff', fontWeight: 800, fontSize: '0.88rem', textDecoration: 'none', padding: '0.85rem 1.75rem', borderRadius: 12, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
          >
            justopen.tech →
          </a>
        </div>

      </div>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: '2rem 1.5rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.72rem', color: '#9DB4C5', margin: 0, lineHeight: 1.6 }}>
          © {new Date().getFullYear()} Just Open Technologies Inc. · Toronto, Canada ·{' '}
          <a href="/marketing" style={{ color: '#9DB4C5', textDecoration: 'none' }}>staircode.app</a>
        </p>
      </footer>
    </div>
  )
}
