'use client'
/**
 * /marketing — stAIrcode landing page
 * Design reference: chronoinnovation.com/chrono-rd/features/sred-automation/
 * Font: DM Sans (Google Fonts) — same as Chrono
 */

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import styles from './marketing.module.css'
import { NavLogo } from '@/app/components/Logo'
import PhoneMockup from "./PhoneMockup"


export default function MarketingPage() {
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [scrolled,  setScrolled]  = useState(false)
  const [openFaq,   setOpenFaq]   = useState(null as number | null)
  const [cookieBanner, setCookieBanner] = useState(false)
  const [showSubscribeModal, setShowSubscribeModal] = useState(false)
  const [betaCode,  setBetaCode]  = useState('')
  const [betaError, setBetaError] = useState<string|null>(null)
  const [betaChecking, setBetaChecking] = useState(false)

  async function handleBetaCode() {
    if (!betaCode.trim()) return
    setBetaChecking(true); setBetaError(null)
    try {
      const res  = await fetch('/api/discount/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: betaCode.trim() }),
      })
      const data = await res.json()
      if (data.valid) {
        // Redirect to app with beta unlock token
        window.location.href = `/?signin=1&beta=1&token=${encodeURIComponent(data.unlockToken ?? 'beta-unlock')}`
      } else {
        setBetaError(data.error ?? 'Invalid code. Please try again.')
      }
    } catch {
      setBetaError('Could not verify code. Check your connection.')
    }
    setBetaChecking(false)
  }

  // Show cookie banner only if not yet answered
  useEffect(() => {
    try {
      if (!localStorage.getItem('sc_cookie_consent')) setCookieBanner(true)
    } catch { setCookieBanner(true) }
  }, [])

  function acceptCookies() {
    try { localStorage.setItem('sc_cookie_consent', 'accepted') } catch {}
    setCookieBanner(false)
  }

  function declineCookies() {
    try { localStorage.setItem('sc_cookie_consent', 'declined') } catch {}
    setCookieBanner(false)
  }
  const articlesRef = useRef<HTMLDivElement>(null)

  // Convert vertical wheel scroll → horizontal on the articles row (PC fix)
  useEffect(() => {
    const el = articlesRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return // already horizontal
      e.preventDefault()
      el.scrollLeft += e.deltaY * 2
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Sample Report', href: '/sample-report' },
    { label: 'Research',     href: '/research' },
    { label: 'Pricing',      href: '#pricing' },
    { label: 'About',        href: '/about' },
    { label: 'Sign In',      href: '/' },
  ]

  const faqs = [
    {
      q: 'Is stAIrcode a replacement for a building inspector?',
      a: 'No. stAIrcode is a compliance aid tool. It helps building inspectors and professionals quickly document and assess stair compliance against local codes — flagging issues and generating cited reports. Always confirm findings with the appropriate authority having jurisdiction.',
    },
    {
      q: 'Which building codes does stAIrcode check against?',
      a: 'stAIrcode automatically detects your location and applies the appropriate code: OBC 2024 (Ontario), NBC 2020 (other Canadian provinces), QBC 2020 (Quebec), BCBC 2024 (BC), IBC 2021 (United States), and others. The code used is shown on every report.',
    },
    {
      q: 'How accurate are the measurements?',
      a: 'Without a reference object, AI vision achieves ±30–50 mm accuracy. Placing a standard credit card (85.6 × 54 mm) in the scene as a scale reference improves this to ±10–15 mm. stAIrcode prompts you to use this method automatically.',
    },
    {
      q: 'What does the free scan include?',
      a: 'The free scan checks all key stair dimensions — riser height, tread depth, stair width, headroom, nosing, and guardrail height — and shows pass/fail against your local code. The full PDF compliance report with cited measurements requires a one-time purchase.',
    },
    {
      q: 'Does it work on Android and iOS?',
      a: 'Yes. stAIrcode is a Progressive Web App (PWA) that runs directly in your mobile browser — no app store download required. An Android TWA and iOS Capacitor build are also in development.',
    },
  ]

  return (
    <>
      {/* ══════════════════════════════════════════════
          NAV
      ══════════════════════════════════════════════ */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'rgba(10,28,46,0.98)' : '#0A1C2E',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)',
        transition: 'box-shadow 0.2s',
        boxShadow: scrolled ? '0 2px 16px rgba(0,0,0,0.06)' : 'none',
      }}><div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 1.25rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{/* Logo */}
          <a href="/marketing" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>{/* eslint-disable-next-line @next/next/no-img-element */}
            <NavLogo height={28} />
          </a>

          {/* Desktop nav */}
          <nav className={styles.desktopNav} style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>{navLinks.slice(0, 5).map(l => (
              <a key={l.label} href={l.href} className={styles.navLink}>{l.label}</a>
            ))}
            <a href="/?signin=1" style={{ fontSize: '0.9rem', fontWeight: 500, color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>Sign In</a>
            <a href="/?signin=1" className={styles.navCta}>Get a compliance report →</a>
          </nav>

          {/* Hamburger */}
          <button
            className={`${styles.mobMenuBtn}${menuOpen ? ' ' + styles.hamOpen : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, padding: 4 }}
            aria-label="Menu"
          >
            <span className={styles.hamLine} />
            <span className={styles.hamLine} />
            <span className={styles.hamLine} />
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className={styles.mobMenuPanel} style={{
            background: '#0A1C2E', borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: '1rem 1.25rem 1.5rem',
            display: 'flex', flexDirection: 'column', gap: '0.25rem',
          }}>{navLinks.map(l => (
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)}
                style={{ padding: '0.75rem 0', fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.85)', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              >{l.label}</a>
            ))}
            <a href="/?signin=1" className={styles.navCta} style={{ marginTop: '1rem', justifyContent: 'center' }}>Get a compliance report →
            </a>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════ */}
      <section style={{ paddingTop: 'calc(64px + 4rem)', paddingBottom: '4.5rem', paddingLeft: '1.25rem', paddingRight: '1.25rem', background: '#FFFFFF', borderBottom: '1px solid #E5EBF2' }}><div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '3rem', alignItems: 'center' }}>{/* ── Left: headline + CTAs ── */}
          <div style={{ flex: '1 1 320px' }}><div style={{ display: 'inline-block', background: '#F29337', color: '#fff', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.35rem 0.85rem', borderRadius: 4, marginBottom: '1.25rem' }}>Assisted Building Compliance Reports for Residential Building Inspections</div>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, maxWidth: 680, marginBottom: '1.25rem', color: '#0A1C2E' }}>The AI-guided building compliance platform.
            </h1>
            <p style={{ fontSize: '1rem', lineHeight: 1.75, color: '#3A5A78', maxWidth: 520, marginBottom: '2rem' }}>AI vision. Live code analysis. Photo records. Phased guided inspections. One comprehensive building compliance report — from any phone.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              <a href="/?signin=1" className={styles.navCta} style={{ fontSize: '0.95rem', padding: '12px 24px' }}>Try Free Demo — Stair Scan →</a>
              <button onClick={() => setShowSubscribeModal(true)} style={{ fontSize: '0.95rem', padding: '12px 24px', background: '#0A1C2E', color: '#fff', borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(10,28,46,0.18)' }}>Full Inspection — Subscribe</button>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#9DB4C5', marginTop: '0.85rem', lineHeight: 1.5 }}>Stair scan is free · Full inspection requires monthly subscription · Beta code available</p>
          </div>

          {/* ── Right: animated phone mockup ── */}
          <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><PhoneMockup />
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════
          AS SEEN IN / TRUST BAR
      ══════════════════════════════════════════════ */}
      <div style={{ borderTop: '1px solid #E2EAF0', borderBottom: '1px solid #E2EAF0', padding: '1.1rem 1.25rem', background: '#F7FAFC' }}><div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}><span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0D1E2E' }}>AI-powered building code compliance — jurisdiction detected automatically, report generated in minutes
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          WHY CHOOSE
      ══════════════════════════════════════════════ */}


      {/* ══════════════════════════════════════════════
          PRODUCT INTRO — what stAIrcode is
      ══════════════════════════════════════════════ */}
      <section style={{ background: '#0A1C2E', padding: '5rem 1.25rem' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem', marginBottom: '3.5rem' }}>
            {[
              { n: '01', label: 'AI Vision', desc: 'Photogrammetric measurements from your phone camera — no tape measure required.' },
              { n: '02', label: 'Live Code Analysis', desc: 'Every finding cross-referenced against the applicable building code in real time.' },
              { n: '03', label: 'Photo Records', desc: 'Inspection photos stored per phase and module — fully timestamped and retrievable.' },
              { n: '04', label: 'Comprehensive Report', desc: 'A structured 30-page PDF covering all 9 inspection phases, code citations, and recommendations.' },
            ].map(item => (
              <div key={item.n} style={{ borderLeft: '2px solid rgba(242,147,55,0.4)', paddingLeft: '1.25rem' }}>
                <div style={{ fontSize: '0.62rem', color: '#F29337', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.4rem' }}>{item.n}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.35rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.65 }}>{item.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
            <a href="/?signin=1" style={{ padding: '0.75rem 1.75rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, color: '#fff', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600 }}>Try Free Stair Demo</a>
            <button onClick={() => setShowSubscribeModal(true)} style={{ padding: '0.75rem 1.75rem', background: '#F29337', border: 'none', borderRadius: 10, color: '#fff', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 18px rgba(242,147,55,0.4)' }}>Get Full Inspection Access →</button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          INSPECTION PHASES — the full product
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '5rem 1.25rem', background: '#fff', borderTop: '1px solid #E5EBF2' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F29337', marginBottom: '0.6rem' }}>Full Residential Inspection</div>
          <h2 style={{ fontSize: 'clamp(1.5rem,4vw,2.2rem)', fontWeight: 800, letterSpacing: '-0.03em', color: '#0A1C2E', marginBottom: '0.75rem' }}>9 inspection phases. Every element of the building.</h2>
          <p style={{ fontSize: '0.95rem', color: '#5E7D9B', lineHeight: 1.7, maxWidth: 640, marginBottom: '2.5rem' }}>
            stAIrcode guides inspectors through every phase of a residential building inspection — from roof to site — with AI vision measurements, live code analysis, photo documentation, and a comprehensive report matching AS 4349.1 / OBC inspection standards.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {[
              {
                n: '01', phase: 'Roof — External',
                modules: ['Roof covering & condition', 'Flashings & sealants', 'Gutters & downpipes', 'Eaves, fascias & barge boards', 'Ridge & hip condition'],
              },
              {
                n: '02', phase: 'Roof — Internal',
                modules: ['Roof framing & trusses', 'Insulation coverage', 'Sarking & membrane'],
              },
              {
                n: '03', phase: 'Interior',
                modules: ['Ceilings', 'Internal walls', 'Windows & doors', 'Floors', 'Stairs (AI Compliance Scan ✓)'],
              },
              {
                n: '04', phase: 'Wet Areas',
                modules: ['Kitchen', 'Laundry', 'Bathroom(s)', 'Ensuite', 'Toilet', 'Accessibility compliance (AI Scan ✓)'],
              },
              {
                n: '05', phase: 'Exterior',
                modules: ['External walls & cladding', 'External cracking', 'Windows & doors exterior', 'Foundation (AI Scan ✓)'],
              },
              {
                n: '06', phase: 'Garage & Structures',
                modules: ['Garage condition', 'Decks, pergolas & balconies', 'Outbuildings'],
              },
              {
                n: '07', phase: 'Site',
                modules: ['Driveway', 'Fences & gates', 'Paths & paving', 'Surface drainage', 'Yard & gardens', 'Swimming pool (specialist referral)'],
              },
              {
                n: '08', phase: 'Services',
                modules: ['Electrical (visual)', 'Plumbing (visual)', 'Gas connections', 'Smoke & CO detectors', 'Hot water system', 'HVAC'],
              },
              {
                n: '09', phase: 'Compliance Modules',
                modules: ['Guardrails & handrails (coming soon)', 'Windows egress (coming soon)', 'Bathroom ventilation (coming soon)', 'Ceiling heights (coming soon)', 'Door widths (coming soon)'],
                comingSoon: true,
              },
            ].map((phase: { n: string; phase: string; modules: string[]; comingSoon?: boolean }) => (
              <div key={phase.n} style={{ background: phase.comingSoon ? '#F4F7FB' : '#fff', border: `1px solid ${phase.comingSoon ? 'rgba(44,90,122,0.1)' : 'rgba(44,90,122,0.15)'}`, borderRadius: 12, padding: '1.25rem', opacity: phase.comingSoon ? 0.7 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#F29337', background: 'rgba(242,147,55,0.1)', padding: '0.18rem 0.5rem', borderRadius: 4, border: '1px solid rgba(242,147,55,0.25)' }}>{phase.n}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0A1C2E' }}>{phase.phase}</div>
                  {phase.comingSoon && <div style={{ marginLeft: 'auto', fontSize: '0.6rem', color: '#9DB4C5', border: '1px solid rgba(147,186,212,0.3)', padding: '0.1rem 0.45rem', borderRadius: 4 }}>Expanding</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {phase.modules.map(m => (
                    <div key={m} style={{ fontSize: '0.78rem', color: m.includes('AI Scan ✓') ? '#417CA4' : m.includes('coming soon') ? '#9DB4C5' : '#5E7D9B', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: m.includes('AI Scan ✓') ? '#417CA4' : m.includes('coming soon') ? '#C8D8E4' : '#9DB4C5', flexShrink: 0 }} />
                      {m}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#F7FAFC', borderRadius: 14, border: '1px solid #E5EBF2', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.5rem', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0A1C2E', marginBottom: '0.25rem' }}>Free Demo: Stair Compliance Scan</div>
              <div style={{ fontSize: '0.82rem', color: '#5E7D9B' }}>Try AI-vision stair measurement free — no account required. Includes pass/fail vs local building code.</div>
            </div>
            <a href="/?signin=1" style={{ padding: '0.75rem 1.5rem', background: '#0A1C2E', color: '#fff', borderRadius: 9, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>Try Free Demo →</a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════ */}
      <section id="how-it-works" style={{ padding: '5rem 1.25rem', background: '#F7FAFC' }}><div style={{ maxWidth: 1080, margin: '0 auto' }}><div className={styles.sectionLabel}>How It Works</div>
          <h2 className={styles.sectionTitle} style={{ marginBottom: '3rem' }}>Three steps to a compliance report</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3rem', alignItems: 'flex-start' }}>{/* Steps */}
            <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>{[
                { n: '1', title: 'Complete a scan with any smartphone', body: 'Create a free account and select the compliance module you need. AI-Vision guides you step by step — no technical knowledge or specialized equipment required.' },
                { n: '2', title: 'Get instant pass/fail results', body: 'Follow the guided on-screen prompts. stAIrcode walks you through each measurement automatically and checks every dimension against your local building code in real time.' },
                { n: '3', title: 'Download a professional compliance report', body: 'For a detailed assessment, include a reference object for scale — no measuring tape required. Your PDF report includes measurement photos, code citations, and a full pass/fail analysis ready to share with your client, architect, or contractor.' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}><div className={styles.stepNum}>{s.n}</div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0D1E2E' }}>{s.title}</h3>
                    <p style={{ fontSize: '0.88rem', color: '#5E7D9B', lineHeight: 1.65 }}>{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* How it works image */}
            <div style={{ flex: '0 1 340px' }}>{/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero_app_scan.jpg"
                alt="stAIrcode app scanning stairs — live measurement in progress"
                style={{ width: '100%', borderRadius: 16, objectFit: 'cover', boxShadow: '0 8px 32px rgba(44,74,110,0.18)', border: '1px solid rgba(44,90,122,0.15)' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          STATS
      ══════════════════════════════════════════════ */}
      <section className={styles.darkSection} style={{ padding: '4.5rem 1.25rem' }}><div style={{ maxWidth: 1080, margin: '0 auto' }}><div className={styles.sectionLabel} style={{ color: '#F29337' }}>The Data</div>
          <h2 className={styles.sectionTitle} style={{ marginBottom: '2rem', color: '#fff' }}>Building code compliance is a safety issue</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>{[
              { num: '$92B+', lbl: 'Annual US medical costs from non-fatal stair falls' },
              { num: '1,800', lbl: 'ER visits per day from falls in Canada' },
              { num: '20%',   lbl: 'Of senior fall hospitalizations involve stairs' },
              { num: '+50%',  lbl: 'Increased trip risk from riser inconsistency >3/8"' },
            ].map(s => (
              <div key={s.num} className={styles.statPill}>
                <div className="num">{s.num}</div>
                <div className="lbl">{s.lbl}</div>
              </div>
            ))}
          </div>
          <a href="/research" style={{ fontSize: '0.85rem', color: '#F29337', fontWeight: 600, textDecoration: 'none' }}>View research and sources →
          </a>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TESTIMONIAL
      ══════════════════════════════════════════════ */}
      

      {/* ══════════════════════════════════════════════
          PRICING
      ══════════════════════════════════════════════ */}
      <section id="pricing" style={{ background: '#F7FAFC', padding: '5rem 1.25rem' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5E7D9B', marginBottom: '0.6rem' }}>Pricing</div>
          <h2 style={{ fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 800, letterSpacing: '-0.03em', color: '#0A1C2E', marginBottom: '0.75rem' }}>Simple, transparent pricing</h2>
          <p style={{ fontSize: '0.95rem', color: '#5E7D9B', maxWidth: 540, marginBottom: '2.5rem', lineHeight: 1.7 }}>Start free with the stair demo. Upgrade to a monthly subscription for the full residential inspection platform.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>

            {/* ── Free Demo ── */}
            <div style={{ background: '#fff', border: '1px solid rgba(44,90,122,0.15)', borderRadius: 16, padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5E7D9B', marginBottom: '0.5rem' }}>Free Demo</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#0A1C2E', lineHeight: 1 }}>$0</div>
                <div style={{ fontSize: '0.78rem', color: '#5E7D9B', marginTop: '0.25rem' }}>No credit card required</div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {[
                  'Stair Compliance Scan only',
                  'AI vision measurement',
                  'Pass/fail vs OBC, NBC, IBC',
                  'Instant results on screen',
                  'No account required',
                ].map(f => (
                  <li key={f} style={{ fontSize: '0.85rem', color: '#3A5A78', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(39,169,107,0.12)', border: '1px solid rgba(39,169,107,0.3)', flexShrink: 0, marginTop: 2 }}/>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="/?signin=1" style={{ display: 'block', textAlign: 'center', padding: '0.85rem', background: '#0A1C2E', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none', marginTop: 'auto' }}>
                Try Stair Demo Free →
              </a>
            </div>

            {/* ── Full Inspection — Monthly ── */}
            <div style={{ background: '#0A1C2E', border: '2px solid #F29337', borderRadius: 16, padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, background: '#F29337', color: '#fff', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', padding: '0.3rem 0.8rem', borderRadius: '0 14px 0 8px' }}>BETA</div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F29337', marginBottom: '0.5rem' }}>Full Residential Inspection</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>$38.99</div>
                  <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)' }}>/month</div>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.25rem' }}>Beta access · Cancel anytime</div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {[
                  '9-phase guided inspection workflow',
                  'All AI scan modules (stair, foundation, accessibility)',
                  'Photo documentation per module',
                  'Live code analysis & citations',
                  '30-page PDF compliance report',
                  'AI inspection assistant (in-field chat)',
                  'Supabase-stored reports, retrievable anytime',
                  'Email delivery of reports',
                  'OBC, NBC, IBC, IRC, UK Part K support',
                ].map(f => (
                  <li key={f} style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(242,147,55,0.2)', border: '1px solid rgba(242,147,55,0.5)', flexShrink: 0, marginTop: 2 }}/>
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => setShowSubscribeModal(true)}
                style={{ display: 'block', width: '100%', padding: '0.95rem', background: 'linear-gradient(135deg,#F29337,#C4721E)', color: '#fff', borderRadius: 10, fontWeight: 800, fontSize: '0.95rem', border: 'none', cursor: 'pointer', marginTop: 'auto', boxShadow: '0 4px 20px rgba(242,147,55,0.45)' }}>
                Subscribe — $38.99/month →
              </button>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>Have a beta code? Enter it on the next screen.</div>
            </div>

          </div>
        </div>
      </section>
      {/* ══════════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '5rem 1.25rem', background: '#ffffff' }}><div style={{ maxWidth: 720, margin: '0 auto' }}><div className={styles.sectionLabel}>FAQ</div>
          <h2 className={styles.sectionTitle} style={{ marginBottom: '2rem' }}>Frequently asked questions</h2>
          {faqs.map((f, i) => (
            <div key={i} className={styles.faqItem}>
              <button className={styles.faqQ} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                {f.q}
                <span style={{ fontSize: '1.1rem', color: '#F29337', flexShrink: 0 }}>{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && <p className={styles.faqA}>{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#F7FAFC', padding: '5rem 1.25rem' }}><div className={styles.section} style={{ padding: 0 }}><div style={{ maxWidth: 1080, margin: '0 auto' }}><div className={styles.sectionLabel}>Why stAIrcode</div>
            <h2 className={styles.sectionTitle} style={{ marginBottom: '2.5rem' }}>Built for inspectors and compliance professionals</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>{[
                { title: 'AI Vision Analysis', body: "Claude Vision reads your photos, extracts measurements, and cross-references every dimension against your jurisdiction's building code — no tape measure, no manual calculations." },
                { title: 'Code-Accurate Results', body: 'Automatically detects your jurisdiction and checks every measurement against OBC, NBC, IBC, and more. Pass/fail shown per dimension with the exact code clause cited.' },
                { title: 'PDF Compliance Report', body: 'Generate a shareable, cited compliance report in minutes — ready for building inspection documentation, code enforcement records, or contractor briefings.' },
                { title: 'Guided Module Workflow', body: 'Each inspection category is its own guided module. Select what you need to check, follow the on-screen steps, and receive a report scoped to that category.' },
              ].map(f => (
                <div key={f.title} className={styles.featureCard}>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════ */}
      <section id="about" className={styles.darkSection} style={{ padding: '5rem 1.25rem', textAlign: 'center' }}><div style={{ maxWidth: 640, margin: '0 auto' }}><h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', marginBottom: '1rem' }}>Ready to run a compliance scan?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem', lineHeight: 1.65, marginBottom: '2rem' }}>Scan for free in under 5 minutes. No app download. No tape measure.<br />
            Just your phone and the building element in question.
          </p>
          <a href="/?signin=1" className={styles.navCta} style={{ fontSize: '1rem', padding: '14px 32px' }}>Get a compliance report →
          </a>
          <p style={{ marginTop: '1rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>Compliance aid tool. Always confirm with a licensed inspector or authority having jurisdiction before renovation or occupancy decisions.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          ARTICLES
      ══════════════════════════════════════════════ */}
      <section style={{ background: '#F0F5FA', padding: '4rem 1.25rem' }}><div style={{ maxWidth: 1080, margin: '0 auto' }}><div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', color: '#F29337', textTransform: 'uppercase', marginBottom: '0.5rem' }}>In the news &amp; research</div>
          <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, color: '#0D1E2E', letterSpacing: '-0.02em', marginBottom: '2rem' }}>Building safety and code compliance
          </h2>

          {/* Scrollable article cards — with PC scroll support */}
          <div style={{ position: 'relative' }}>{/* Left arrow */}
            <button
              onClick={() => articlesRef.current && (articlesRef.current.scrollLeft -= 320)}
              aria-label="Scroll left"
              style={{ position: 'absolute', left: -20, top: '50%', transform: 'translateY(-50%)', zIndex: 10, width: 40, height: 40, borderRadius: '50%', background: '#fff', border: '1.5px solid #E2EAF0', boxShadow: '0 2px 12px rgba(44,74,110,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: '#0D1E2E', transition: 'box-shadow 0.2s' }}
            >‹</button>
            {/* Right arrow */}
            <button
              onClick={() => articlesRef.current && (articlesRef.current.scrollLeft += 320)}
              aria-label="Scroll right"
              style={{ position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)', zIndex: 10, width: 40, height: 40, borderRadius: '50%', background: '#fff', border: '1.5px solid #E2EAF0', boxShadow: '0 2px 12px rgba(44,74,110,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: '#0D1E2E', transition: 'box-shadow 0.2s' }}
            >›</button>

          <div ref={articlesRef} style={{ display: 'flex', gap: '1.25rem', overflowX: 'auto', paddingBottom: '1rem', WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth', cursor: 'grab' } as any}
            onMouseDown={e => {
              const el = articlesRef.current; if (!el) return
              el.style.cursor = 'grabbing'
              const startX = e.pageX - el.offsetLeft
              const scrollLeft = el.scrollLeft
              const onMove = (me: MouseEvent) => { el.scrollLeft = scrollLeft - (me.pageX - el.offsetLeft - startX) }
              const onUp   = () => { el.style.cursor = 'grab'; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
              window.addEventListener('mousemove', onMove)
              window.addEventListener('mouseup', onUp)
            }}
          >

            {/* Article 1 — CTV News */}
            <a href="https://www.ctvnews.ca/ottawa/video/2026/03/02/ask-the-expert-stairway-safety-and-homeowner-liability/" target="_blank" rel="noopener noreferrer"
              style={{ flexShrink: 0, width: 300, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(44,74,110,0.1)', textDecoration: 'none', border: '1px solid rgba(44,90,122,0.1)', display: 'flex', flexDirection: 'column' }}><div style={{ height: 160, overflow: 'hidden', position: 'relative', background: '#0A1C2E' }}>{/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/news/ctv_stairway_safety.png" alt="CTV News — Stairway safety and homeowner liability" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.4rem 0.7rem', background: 'linear-gradient(to top,rgba(0,0,0,0.72),transparent)' }}><span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.85)', fontWeight: 700, letterSpacing: '0.1em' }}>CTV NEWS · OTTAWA</span>
                </div>
              </div>
              <div style={{ padding: '1rem', flex: 1 }}><div style={{ fontSize: '0.72rem', color: '#F29337', fontWeight: 700, marginBottom: '0.4rem' }}>CUSTOMER STORY</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0D1E2E', lineHeight: 1.3, marginBottom: '0.5rem' }}>Ask The Expert: Stairway safety and homeowner liability</div>
                <p style={{ fontSize: '0.78rem', color: '#5E7D9B', lineHeight: 1.55, margin: 0 }}>Personal injury lawyer Calla Rose discusses homeowner responsibilities regarding stairway maintenance and safety under the Ontario Building Code.</p>
              </div>
              <div style={{ padding: '0 1rem 1rem' }}><span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0D1E2E' }}>Read more →</span>
              </div>
            </a>

            {/* Article 2 — Global News */}
            <a href="https://globalnews.ca/news/10729529/firefighters-raise-concerns-about-b-c-s-new-single-stairwell-apartment-rules/" target="_blank" rel="noopener noreferrer"
              style={{ flexShrink: 0, width: 300, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(44,74,110,0.1)', textDecoration: 'none', border: '1px solid rgba(44,90,122,0.1)', display: 'flex', flexDirection: 'column' }}><div style={{ height: 160, overflow: 'hidden', position: 'relative', background: '#1a2a1a' }}>{/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/news/global_news_firefighters.png" alt="Global News — Firefighters raise concerns about B.C. stairwell rules" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.4rem 0.7rem', background: 'linear-gradient(to top,rgba(0,0,0,0.72),transparent)' }}><span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.85)', fontWeight: 700, letterSpacing: '0.1em' }}>GLOBAL NEWS · B.C.</span>
                </div>
              </div>
              <div style={{ padding: '1rem', flex: 1 }}><div style={{ fontSize: '0.72rem', color: '#F29337', fontWeight: 700, marginBottom: '0.4rem' }}>INDUSTRY UPDATE</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0D1E2E', lineHeight: 1.3, marginBottom: '0.5rem' }}>Firefighters raise concerns about B.C.&apos;s new single-stairwell apartment rules</div>
                <p style={{ fontSize: '0.78rem', color: '#5E7D9B', lineHeight: 1.55, margin: 0 }}>Safety advocates question changes to stairwell requirements in new residential construction across British Columbia.</p>
              </div>
              <div style={{ padding: '0 1rem 1rem' }}><span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0D1E2E' }}>Read more →</span>
              </div>
            </a>

            {/* Article 5 — OBC Reference */}
            <a href="https://www.ontario.ca/laws/statute/92b23" target="_blank" rel="noopener noreferrer"
              style={{ flexShrink: 0, width: 300, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(44,74,110,0.1)', textDecoration: 'none', border: '1px solid rgba(44,90,122,0.1)', display: 'flex', flexDirection: 'column' }}><div style={{ height: 160, overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg,#0A1C2E,#1a3a2a)' }}><div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', boxSizing: 'border-box' }}><div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff', lineHeight: 1.3, marginBottom: '0.3rem' }}>Ontario Building Code 2024</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>Section 9.8 — Stair and Ramp Requirements</div>
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.4rem 0.7rem', background: 'linear-gradient(to top,rgba(0,0,0,0.6),transparent)' }}><span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.85)', fontWeight: 700, letterSpacing: '0.1em' }}>ONTARIO · BUILDING CODE</span>
                </div>
              </div>
              <div style={{ padding: '1rem', flex: 1 }}><div style={{ fontSize: '0.72rem', color: '#F29337', fontWeight: 700, marginBottom: '0.4rem' }}>REGULATORY</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0D1E2E', lineHeight: 1.3, marginBottom: '0.5rem' }}>Ontario Building Code 2024 — Stair and ramp requirements</div>
                <p style={{ fontSize: '0.78rem', color: '#5E7D9B', lineHeight: 1.55, margin: 0 }}>Official OBC 2024 provisions covering riser height, tread depth, handrail height, and stairway width for residential and commercial occupancies.</p>
              </div>
              <div style={{ padding: '0 1rem 1rem' }}><span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0D1E2E' }}>Read more →</span>
              </div>
            </a>

            {/* Article 6 — WSJ */}
            <a href="https://www.wsj.com/articles/construction-companies-see-promise-in-ai-agents-12dc2d60" target="_blank" rel="noopener noreferrer"
              style={{ flexShrink: 0, width: 300, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(44,74,110,0.1)', textDecoration: 'none', border: '1px solid rgba(44,90,122,0.1)', display: 'flex', flexDirection: 'column' }}><div style={{ height: 160, overflow: 'hidden', position: 'relative', background: '#1a1208' }}>{/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/news/wsj_ai_construction.png" alt="Wall Street Journal — Construction Companies See Promise in AI Agents" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.4rem 0.7rem', background: 'linear-gradient(to top,rgba(0,0,0,0.72),transparent)' }}><span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.85)', fontWeight: 700, letterSpacing: '0.1em' }}>WALL STREET JOURNAL</span>
                </div>
              </div>
              <div style={{ padding: '1rem', flex: 1 }}><div style={{ fontSize: '0.72rem', color: '#F29337', fontWeight: 700, marginBottom: '0.4rem' }}>INDUSTRY · AI</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0D1E2E', lineHeight: 1.3, marginBottom: '0.5rem' }}>Construction Companies See Promise in AI Agents</div>
                <p style={{ fontSize: '0.78rem', color: '#5E7D9B', lineHeight: 1.55, margin: 0 }}>The Wall Street Journal examines how the construction industry is adopting AI agents to automate inspections, documentation, and compliance workflows on job sites.</p>
              </div>
              <div style={{ padding: '0 1rem 1rem' }}><span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0D1E2E' }}>Read more →</span>
              </div>
            </a>

          </div>
          </div>{/* end scroll wrapper */}
          <p style={{ fontSize: '0.72rem', color: '#5E7D9B', marginTop: '1.5rem', textAlign: 'center' }}>Use scroll wheel, drag, or the arrows to browse · Updated regularly
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SITE FOOTER (Procore-style)
      ══════════════════════════════════════════════ */}
      <section style={{ background: '#fff', borderTop: '1px solid #E5EBF2', padding: '3.5rem 1.25rem 2rem' }}><div style={{ maxWidth: 1080, margin: '0 auto' }}><div style={{ display: 'flex', flexWrap: 'wrap', gap: '2.5rem', marginBottom: '3rem' }}>{/* Brand */}
            <div style={{ flex: '1 1 220px', minWidth: 180 }}>{/* eslint-disable-next-line @next/next/no-img-element */}
              <div style={{ display:'inline-flex', flexDirection:'column', alignItems:'flex-start', marginBottom:'1rem' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/staircode_logo.png" alt="stAIrcode" style={{ height: 32, display: 'block' }} />
                <div style={{ fontSize: 8, fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif', fontWeight: 400, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(27,58,107,0.48)', marginTop: 4, lineHeight: 1, whiteSpace: 'nowrap' }}>Next Step in Building Information</div>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#5E7D9B', lineHeight: 1.7, marginBottom: '1rem' }}>stAIrcode is committed to improving building safety by giving inspectors and compliance professionals instant, AI-powered code analysis — from any phone, on any job site.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>{[
                  { href: 'https://www.instagram.com/staircode/', label: 'IG', title: 'Instagram' },
                  { href: 'https://www.facebook.com/people/Staircode/61589350702805/', label: 'FB', title: 'Facebook' },
                  { href: 'https://play.google.com/store/apps/details?id=app.staircode.android&pcampaignid=web_share', label: 'GP', title: 'Google Play' },
                  { href: 'mailto:info@staircode.app', label: '@', title: 'Email us' },
                ].map(s => (
                  <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" title={s.title}
                    style={{ width: 36, height: 36, borderRadius: '50%', background: '#F0F5FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', textDecoration: 'none', color: '#0D1E2E' }}>{s.label}
                  </a>
                ))}
              </div>
            </div>

            {/* New to stAIrcode? */}
            <div style={{ flex: '1 1 160px', minWidth: 140 }}><div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', color: '#0D1E2E', textTransform: 'uppercase', marginBottom: '0.85rem' }}>New to stAIrcode?</div>
                  {[
                { label: 'What is stAIrcode?',  href: '/what-is-staircode' },
                { label: 'Platform Overview',    href: '/platform-overview' },
                { label: 'Product Updates',      href: '#' },
                { label: 'Resource Center',      href: '/research' },
                { label: 'Trust & Security',     href: '/privacy' },
                { label: 'App Marketplace',      href: '#' },
                { label: 'Developers / API',     href: '#' },
              ].map(l => (
                <div key={l.label} style={{ marginBottom: '0.55rem' }}><a href={l.href} style={{ fontSize: '0.83rem', color: '#5E7D9B', textDecoration: 'none' }}>{l.label}</a>
                </div>
              ))}
            </div>

            {/* About */}
            <div style={{ flex: '1 1 160px', minWidth: 140 }}><div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', color: '#0D1E2E', textTransform: 'uppercase', marginBottom: '0.85rem' }}>About stAIrcode</div>
                  {[
                { label: 'The Blog',          href: '/blog' },
                { label: 'Blog',              href: '#' },
                { label: 'Careers',           href: '#' },
                { label: 'Contact Us',        href: 'mailto:info@staircode.app' },
                { label: 'Legal',             href: '#' },
                { label: 'Privacy Policy',    href: '/privacy' },
                { label: 'Terms of Service',  href: '/terms' },
                { label: 'Unsubscribe',       href: 'mailto:info@staircode.app?subject=Unsubscribe' },
              ].map(l => (
                <div key={l.label} style={{ marginBottom: '0.55rem' }}><a href={l.href} style={{ fontSize: '0.83rem', color: '#5E7D9B', textDecoration: 'none' }}>{l.label}</a>
                </div>
              ))}
            </div>

            {/* Downloads */}
            <div style={{ flex: '1 1 160px', minWidth: 140 }}><div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', color: '#0D1E2E', textTransform: 'uppercase', marginBottom: '0.85rem' }}>Downloads</div>

              {/* Google Play badge */}
              <a href="https://play.google.com/store/apps/details?id=app.staircode.android&pcampaignid=web_share" target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', background: '#000', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '0.55rem 1rem', textDecoration: 'none', marginBottom: '0.65rem', minWidth: 155 }}>{/* Google Play triangle logo */}
                <svg width="20" height="22" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0.5 1.33L11.14 11L0.5 20.67V1.33Z" fill="#4285F4"/>
                  <path d="M14.5 7.5L2.5 0.5L11.14 11L14.5 7.5Z" fill="#34A853"/>
                  <path d="M14.5 14.5L11.14 11L2.5 21.5L14.5 14.5Z" fill="#FBBC04"/>
                  <path d="M19.5 11C19.5 10.17 19.07 9.43 18.41 9L14.5 7.5L11.14 11L14.5 14.5L18.41 13C19.07 12.57 19.5 11.83 19.5 11Z" fill="#EA4335"/>
                </svg>
                <div>
                  <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Get it on</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', lineHeight: 1.3, letterSpacing: '-0.01em' }}>Google Play</div>
                </div>
              </a>

              {/* App Store badge */}
              <a href="#" aria-disabled="true"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', background: '#000', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '0.55rem 1rem', textDecoration: 'none', minWidth: 155, opacity: 0.55, cursor: 'default', pointerEvents: 'none' }}>{/* Apple logo */}
                <svg width="18" height="22" viewBox="0 0 18 22" fill="white" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.93 11.62c-.02-2.45 2-3.63 2.09-3.69-1.14-1.67-2.91-1.9-3.54-1.93-1.51-.15-2.96.89-3.73.89-.78 0-1.97-.87-3.24-.85C4.79 6.07 3.2 7 2.35 8.43.59 11.33 1.89 15.63 3.59 18c.85 1.17 1.85 2.48 3.16 2.43 1.27-.05 1.75-.82 3.28-.82s1.97.82 3.3.79c1.36-.02 2.22-1.19 3.05-2.37.97-1.36 1.36-2.69 1.38-2.76-.03-.01-2.64-1.01-2.67-4.02l.04.37zM12.51 3.91c.7-.86 1.17-2.05 1.04-3.25-1.01.04-2.23.67-2.95 1.52-.65.74-1.22 1.94-1.07 3.08 1.13.09 2.28-.58 2.98-1.35z"/>
                </svg>
                <div>
                  <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Download on the</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', lineHeight: 1.3, letterSpacing: '-0.01em' }}>App Store</div>
                </div>
              </a>
              <div style={{ fontSize: '0.68rem', color: '#9BB5C8', marginTop: '0.4rem' }}>iOS — Launching May 2025</div>
            </div>

          </div>

          {/* Bottom strip */}
          <div style={{ borderTop: '1px solid #E5EBF2', paddingTop: '1.25rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}><div style={{ fontSize: '0.75rem', color: '#9BB5C8' }}>© {new Date().getFullYear()} Just Open Technologies Inc. · staircode.app
            </div>
            <div style={{ display: 'flex', gap: '1.25rem' }}>{[['Privacy', '/privacy'], ['Terms', '/terms'], ['Research', '/research'], ['Contact', 'mailto:info@staircode.app']].map(([l, h]) => (
                <a key={l} href={h} style={{ fontSize: '0.75rem', color: '#9BB5C8', textDecoration: 'none' }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FOOTER (minimal — keep for structure)
      ══════════════════════════════════════════════ */}
      <footer style={{ display: 'none' }}><div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{/* eslint-disable-next-line @next/next/no-img-element */}
            <NavLogo height={20} style={{ opacity: 0.75 }} />
            <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>stAIrcode</span>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.8em' }}>staircode.app</span>
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}><a href="/research">Research</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="mailto:info@staircode.app">Contact</a>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.25)' }}>© {new Date().getFullYear()} Just Open Technologies Inc.</div>
        </div>
      </footer>

      {/* ── Cookie Consent Banner ─────────────────────────────────────────────── */}
      {cookieBanner && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          padding: '0 1rem 1rem',
          pointerEvents: 'none',
        }}><div style={{
            maxWidth: 620,
            margin: '0 auto',
            background: '#0D1E2E',
            border: '1px solid rgba(147,186,212,0.2)',
            borderRadius: 16,
            boxShadow: '0 -4px 40px rgba(0,0,0,0.45)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexWrap: 'wrap' as const,
            alignItems: 'center',
            gap: '1rem',
            pointerEvents: 'auto',
          }}>{/* Icon + text */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: '1 1 280px' }}><div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#E8F4FF', marginBottom: '0.3rem' }}>We use cookies
                </div>
                <div style={{ fontSize: '0.75rem', color: '#93BAD4', lineHeight: 1.6 }}>We use cookies and similar technologies to improve your experience, analyse site traffic, and serve relevant content.
                  By clicking <strong style={{ color: '#E8F4FF' }}>Accept</strong>, you consent to our use of cookies.
                  {' '}<a href="/privacy" style={{ color: '#F29337', textDecoration: 'underline' }}>Privacy Policy</a>
                  {' '}·{' '}
                  <a href="/terms" style={{ color: '#F29337', textDecoration: 'underline' }}>Terms</a>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.6rem', flexShrink: 0 }}><button
                onClick={declineCookies}
                style={{
                  padding: '0.6rem 1.1rem',
                  background: 'transparent',
                  border: '1.5px solid rgba(147,186,212,0.25)',
                  borderRadius: 10,
                  color: '#93BAD4',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap' as const,
                  transition: 'border-color 0.2s',
                }}>Decline
              </button>
              <button
                onClick={acceptCookies}
                style={{
                  padding: '0.6rem 1.4rem',
                  background: 'linear-gradient(135deg,#F29337,#C4721E)',
                  border: 'none',
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap' as const,
                  boxShadow: '0 2px 12px rgba(242,147,55,0.35)',
                }}>Accept All
              </button>
            </div>
          </div>
        </div>
      )}
    {/* ══════════════════════════════════════════════
        SUBSCRIPTION MODAL
    ══════════════════════════════════════════════ */}
    {showSubscribeModal && (
      <>
        <div onClick={() => { setShowSubscribeModal(false); setBetaCode(''); setBetaError(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 900 }} />
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '92%', maxWidth: 460, background: '#fff', borderRadius: 20, zIndex: 901, boxShadow: '0 24px 80px rgba(0,0,0,0.35)', overflow: 'hidden' }}>

          {/* Modal header */}
          <div style={{ background: '#0A1C2E', padding: '1.5rem', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: '#F29337', color: '#fff', fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.1em', padding: '0.2rem 0.6rem', borderRadius: 4 }}>BETA</div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F29337', marginBottom: '0.4rem' }}>Full Residential Inspection</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>Subscribe for full access</div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>9-phase guided inspection · AI vision · 30-page PDF report</div>
          </div>

          {/* Modal body */}
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#0A1C2E', lineHeight: 1 }}>$38.99</div>
              <div style={{ fontSize: '0.9rem', color: '#5E7D9B' }}>/ month · Cancel anytime</div>
            </div>

            {/* Stripe CTA */}
            <a href="/api/stripe/checkout?product=inspection_subscription&returnTo=/?module=inspection"
              style={{ display: 'block', textAlign: 'center', padding: '1rem', background: 'linear-gradient(135deg,#F29337,#C4721E)', color: '#fff', borderRadius: 12, fontWeight: 800, fontSize: '1rem', textDecoration: 'none', boxShadow: '0 4px 18px rgba(242,147,55,0.4)' }}>
              Subscribe — $38.99/month →
            </a>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ flex: 1, height: 1, background: '#E5EBF2' }} />
              <span style={{ fontSize: '0.72rem', color: '#9DB4C5' }}>or enter a beta code</span>
              <div style={{ flex: 1, height: 1, background: '#E5EBF2' }} />
            </div>

            {/* Beta code */}
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#5E7D9B', marginBottom: '0.4rem' }}>Beta access code</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Enter beta code"
                  value={betaCode}
                  onChange={e => { setBetaCode(e.target.value); setBetaError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') handleBetaCode() }}
                  style={{ flex: 1, padding: '0.7rem 0.9rem', background: '#F4F7FB', border: `1px solid ${betaCode ? 'rgba(65,124,164,0.4)' : 'rgba(44,90,122,0.18)'}`, borderRadius: 9, fontSize: '0.9rem', color: '#0A1C2E', outline: 'none', fontFamily: 'inherit' }}
                />
                <button onClick={handleBetaCode} disabled={betaChecking || !betaCode.trim()}
                  style={{ padding: '0.7rem 1.1rem', background: betaCode.trim() ? '#0A1C2E' : 'rgba(44,90,122,0.1)', border: 'none', borderRadius: 9, color: betaCode.trim() ? '#fff' : '#9DB4C5', fontWeight: 700, fontSize: '0.85rem', cursor: betaCode.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                  {betaChecking ? '…' : 'Apply →'}
                </button>
              </div>
              {betaError && <div style={{ fontSize: '0.72rem', color: '#E84545', marginTop: '0.4rem', padding: '0.35rem 0.65rem', background: 'rgba(232,69,69,0.06)', borderRadius: 6, border: '1px solid rgba(232,69,69,0.2)' }}>{betaError}</div>}
            </div>

            <button onClick={() => { setShowSubscribeModal(false); setBetaCode(''); setBetaError(null) }}
              style={{ background: 'none', border: 'none', color: '#9DB4C5', fontSize: '0.75rem', cursor: 'pointer', padding: 0, textAlign: 'center' }}>
              Cancel
            </button>
          </div>
        </div>
      </>
    )}
    </>
  )
}
