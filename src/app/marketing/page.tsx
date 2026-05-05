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
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled,  setScrolled] = useState(false)
  const [openFaq,   setOpenFaq]  = useState(null as number | null)
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
    { label: 'Research',     href: '/research' },
    { label: 'Pricing',      href: '#pricing' },
    { label: 'About',        href: '#about' },
    { label: 'Sign In',      href: '/' },
  ]

  const faqs = [
    {
      q: 'Is stAIrcode a replacement for a building inspector?',
      a: 'No. stAIrcode is a pre-screening tool. It helps you understand whether your stairs are likely compliant before you engage a licensed inspector — saving time and flagging issues early. Always confirm with a qualified professional before any renovation or real estate transaction.',
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
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 1.25rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <a href="/marketing" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <NavLogo height={28} />
          </a>

          {/* Desktop nav */}
          <nav className={styles.desktopNav} style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
            {navLinks.slice(0, 4).map(l => (
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
          }}>
            {navLinks.map(l => (
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)}
                style={{ padding: '0.75rem 0', fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.85)', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              >{l.label}</a>
            ))}
            <a href="/?signin=1" className={styles.navCta} style={{ marginTop: '1rem', justifyContent: 'center' }}>
              Get a compliance report →
            </a>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════ */}
      <section style={{ paddingTop: 'calc(64px + 4rem)', paddingBottom: '4.5rem', paddingLeft: '1.25rem', paddingRight: '1.25rem', background: '#0A1C2E' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '3rem', alignItems: 'center' }}>
          {/* ── Left: headline + CTAs ── */}
          <div style={{ flex: '1 1 320px' }}>
            <div className={styles.obadge}>Stair Compliance for Building Professionals</div>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, maxWidth: 680, marginBottom: '1.5rem', color: '#FFFFFF' }}>
              Check your stairs with live building code guidance — using any phone.
            </h1>
            <p style={{ fontSize: '1.1rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.82)', maxWidth: 520, marginBottom: '1.75rem' }}>
              A fast, documented stair compliance check — before the inspector shows up.
              No tape measure. No technical knowledge required.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              <a href="/?signin=1" className={styles.navCta} style={{ fontSize: '1rem', padding: '13px 28px' }}>
                Check Stairs Now →
              </a>
              <a href="/?signin=1" style={{ fontSize: '1rem', padding: '13px 28px', background: 'transparent', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 10, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>
                Stair Compliance Report
              </a>
            </div>
          </div>

          {/* ── Right: animated phone mockup ── */}
          <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'center' }}>
            <PhoneMockup />
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════
          AS SEEN IN / TRUST BAR
      ══════════════════════════════════════════════ */}
      <div style={{ borderTop: '1px solid #E2EAF0', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem 1.25rem', background: '#F7FAFC' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.1rem' }}>📍</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0D1E2E' }}>
            Checks compliance with local building codes specific to your location
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          WHY CHOOSE
      ══════════════════════════════════════════════ */}
      <section style={{ background: '#F7FAFC', padding: '5rem 1.25rem' }}>
        <div className={styles.section} style={{ padding: 0 }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <div className={styles.sectionLabel}>Why stAIrcode</div>
            <h2 className={styles.sectionTitle} style={{ marginBottom: '2.5rem' }}>See why building professionals choose stAIrcode</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
              {[
                { icon: '📐', title: 'AI Vision Measurement', body: 'Claude Vision reads your photos and extracts riser height, tread depth, stair width, headroom, nosing, and guardrail measurements — no tape measure needed.' },
                { icon: '⚖️', title: 'Code-Accurate Results', body: 'Automatically detects your jurisdiction and checks every measurement against OBC, NBC, IBC, and 6 other codes. Pass/fail shown per dimension.' },
                { icon: '📄', title: 'PDF Compliance Report', body: 'Generate a shareable, cited compliance report in minutes. Useful for real estate disclosure, pre-inspection screening, or contractor briefings.' },
                { icon: '🔵', title: 'AR Measurement Line', body: 'A blue measurement line animates across the screen as the AI reads each dimension — clear visual feedback showing exactly what\'s being measured.' },
              ].map(f => (
                <div key={f.title} className={styles.featureCard}>
                  <div style={{ fontSize: '1.6rem', marginBottom: '0.6rem' }}>{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════ */}
      <section id="how-it-works" style={{ padding: '5rem 1.25rem', background: '#ffffff' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div className={styles.sectionLabel}>How It Works</div>
          <h2 className={styles.sectionTitle} style={{ marginBottom: '3rem' }}>Three steps to a compliance scan</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3rem', alignItems: 'flex-start' }}>
            {/* Steps */}
            <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {[
                { n: '1', title: 'Complete a scan with any smartphone', body: 'Create a free account and start scanning immediately. AI-Vision guides you through the process — no technical knowledge or special equipment needed.' },
                { n: '2', title: 'Get instant pass/fail results', body: 'Follow the on-screen guided positions. stAIrcode walks you through each measurement automatically and checks every dimension against your local building code.' },
                { n: '3', title: 'Download a professional compliance report', body: 'For a detailed assessment, include a reference object for scale — no measuring tape required. Your PDF report includes measurement photos, code citations, and a full pass/fail analysis ready to share with your architect, contractor, or building inspector.' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                  <div className={styles.stepNum}>{s.n}</div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0D1E2E' }}>{s.title}</h3>
                    <p style={{ fontSize: '0.88rem', color: '#5E7D9B', lineHeight: 1.65 }}>{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* How it works image */}
            <div style={{ flex: '0 1 340px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
      <section className={styles.darkSection} style={{ padding: '4.5rem 1.25rem' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div className={styles.sectionLabel} style={{ color: '#F29337' }}>The Data</div>
          <h2 className={styles.sectionTitle} style={{ marginBottom: '2rem', color: '#fff' }}>Non-compliant stairs are a liability</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
            {[
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
          <a href="/research" style={{ fontSize: '0.85rem', color: '#F29337', fontWeight: 600, textDecoration: 'none' }}>
            View full research with sources →
          </a>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TESTIMONIAL
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '4rem 1.25rem', background: '#ffffff' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className={styles.testimonial}>
            <blockquote style={{ fontSize: '1.1rem', lineHeight: 1.75, color: '#0D1E2E', fontStyle: 'italic', fontWeight: 500, marginBottom: '1.2rem', borderLeft: '3px solid #F29337', paddingLeft: '1.25rem' }}>
              &ldquo;The app flagged inconsistent risers, and the building inspector later confirmed it. A quick check was all we needed, and this got things moving in the right direction.&rdquo;
            </blockquote>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#0A1C2E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F29337', fontWeight: 800, fontSize: '1rem', flexShrink: 0, border: '2px solid #F29337' }}>A</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0D1E2E' }}>Licensed Architect</div>
                <div style={{ fontSize: '0.78rem', color: '#5E7D9B' }}>Toronto, Ontario</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          PRICING
      ══════════════════════════════════════════════ */}
      <section id="pricing" style={{ background: '#F7FAFC', padding: '5rem 1.25rem' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div className={styles.sectionLabel}>Pricing</div>
          <h2 className={styles.sectionTitle} style={{ marginBottom: '2.5rem' }}>Simple, transparent pricing</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
            {/* Free */}
            <div className={styles.priceCard}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5E7D9B', marginBottom: '0.5rem' }}>Free</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#0D1E2E', marginBottom: '0.25rem' }}>$0</div>
              <div style={{ fontSize: '0.82rem', color: '#5E7D9B', marginBottom: '1.5rem' }}>No credit card required</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.75rem' }}>
                {['Full guided scan flow', 'AI vision measurement', 'Pass/fail per building code', 'Supports OBC, NBC, IBC + more'].map(f => (
                  <li key={f} style={{ fontSize: '0.875rem', color: '#0D1E2E', display: 'flex', gap: '0.5rem' }}>
                    <span style={{ color: '#4ade80', fontWeight: 700 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <a href="/?signin=1" style={{ display: 'block', textAlign: 'center', padding: '11px', background: '#0D1E2E', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>
                Start Free Scan
              </a>
            </div>

            {/* Full Report */}
            <div className={`${styles.priceCard} ${styles.priceCardFeatured}`}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F29337', marginBottom: '0.5rem' }}>Full Report</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 400, letterSpacing: '-0.02em', color: '#9BA8B4', textDecoration: 'line-through' }}>$38.99</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#0D1E2E' }}>$2.99</div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, fontFamily: 'monospace', color: '#F29337', background: 'rgba(242,147,55,0.1)', padding: '0.2rem 0.65rem', borderRadius: 4, border: '1px solid rgba(242,147,55,0.3)', letterSpacing: '0.08em' }}>BETA DISCOUNT</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#5E7D9B', marginBottom: '1.5rem' }}>One-time per report · Regular price $38.99</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.75rem' }}>
                {['Pass/fail compliance results', 'PDF compliance report', 'Cited measurements & code references', 'Shareable with inspector or agent', 'Email delivery within minutes'].map(f => (
                  <li key={f} style={{ fontSize: '0.875rem', color: '#0D1E2E', display: 'flex', gap: '0.5rem' }}>
                    <span style={{ color: '#F29337', fontWeight: 700 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <a href="/?signin=1" className={styles.navCta} style={{ display: 'block', textAlign: 'center', padding: '11px' }}>
                Get Full Report →
              </a>
            </div>
            {/* Pro Subscription */}
            <div className={styles.priceCard}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#27A96B', marginBottom: '0.5rem' }}>Pro Subscription</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
                
                <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#5E7D9B' }}>Coming Soon</div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, fontFamily: 'monospace', color: '#27A96B', background: 'rgba(39,169,107,0.1)', padding: '0.2rem 0.65rem', borderRadius: 4, border: '1px solid rgba(39,169,107,0.3)', letterSpacing: '0.08em' }}>COMING SOON</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#5E7D9B', marginBottom: '1.5rem' }}>20 stair reports/month · $199/mo after beta · Cancel anytime</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.75rem' }}>
                {['Everything in Full Report', '20 scans per month', 'All building codes included', 'Priority AI analysis', 'Full report history'].map(f => (
                  <li key={f} style={{ fontSize: '0.875rem', color: '#0D1E2E', display: 'flex', gap: '0.5rem' }}>
                    <span style={{ color: '#27A96B', fontWeight: 700 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <a href="/?signin=1" style={{ display: 'block', textAlign: 'center', padding: '11px', background: 'rgba(94,125,155,0.15)', color: '#5E7D9B', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', border: '1px solid rgba(94,125,155,0.3)', cursor: 'default' }}>
                Notify Me →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '5rem 1.25rem', background: '#ffffff' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className={styles.sectionLabel}>FAQ</div>
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

      {/* ══════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════ */}
      <section id="about" className={styles.darkSection} style={{ padding: '5rem 1.25rem', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', marginBottom: '1rem' }}>
            Ready to check your stairs?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem', lineHeight: 1.65, marginBottom: '2rem' }}>
            Scan for free in under 5 minutes. No app download. No tape measure.<br />
            Just your phone and the stairs in question.
          </p>
          <a href="/?signin=1" className={styles.navCta} style={{ fontSize: '1rem', padding: '14px 32px' }}>
            Get a compliance report →
          </a>
          <p style={{ marginTop: '1rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
            Pre-screening tool. Always confirm with a licensed inspector before renovation or real estate transaction.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          ARTICLES
      ══════════════════════════════════════════════ */}
      <section style={{ background: '#F0F5FA', padding: '4rem 1.25rem' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', color: '#F29337', textTransform: 'uppercase', marginBottom: '0.5rem' }}>In the news &amp; research</div>
          <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, color: '#0D1E2E', letterSpacing: '-0.02em', marginBottom: '2rem' }}>
            Stair safety matters
          </h2>

          {/* Scrollable article cards — with PC scroll support */}
          <div style={{ position: 'relative' }}>
            {/* Left arrow */}
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
              style={{ flexShrink: 0, width: 300, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(44,74,110,0.1)', textDecoration: 'none', border: '1px solid rgba(44,90,122,0.1)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: 'linear-gradient(135deg,#0A1C2E,#1a3a5c)', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '2rem' }}>⚖️</span>
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.1em' }}>CTV NEWS · OTTAWA</span>
              </div>
              <div style={{ padding: '1rem', flex: 1 }}>
                <div style={{ fontSize: '0.72rem', color: '#F29337', fontWeight: 700, marginBottom: '0.4rem' }}>CUSTOMER STORY</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0D1E2E', lineHeight: 1.3, marginBottom: '0.5rem' }}>Ask The Expert: Stairway safety and homeowner liability</div>
                <p style={{ fontSize: '0.78rem', color: '#5E7D9B', lineHeight: 1.55, margin: 0 }}>Personal injury lawyer Calla Rose discusses homeowner responsibilities regarding stairway maintenance and safety under the Ontario Building Code.</p>
              </div>
              <div style={{ padding: '0 1rem 1rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0D1E2E' }}>Read more →</span>
              </div>
            </a>

            {/* Article 2 — Global News */}
            <a href="https://globalnews.ca/news/10729529/firefighters-raise-concerns-about-b-c-s-new-single-stairwell-apartment-rules/" target="_blank" rel="noopener noreferrer"
              style={{ flexShrink: 0, width: 300, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(44,74,110,0.1)', textDecoration: 'none', border: '1px solid rgba(44,90,122,0.1)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: 'linear-gradient(135deg,#1a2a1a,#2d4a2d)', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '2rem' }}>🚒</span>
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.1em' }}>GLOBAL NEWS · B.C.</span>
              </div>
              <div style={{ padding: '1rem', flex: 1 }}>
                <div style={{ fontSize: '0.72rem', color: '#F29337', fontWeight: 700, marginBottom: '0.4rem' }}>INDUSTRY UPDATE</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0D1E2E', lineHeight: 1.3, marginBottom: '0.5rem' }}>Firefighters raise concerns about B.C.&apos;s new single-stairwell apartment rules</div>
                <p style={{ fontSize: '0.78rem', color: '#5E7D9B', lineHeight: 1.55, margin: 0 }}>Safety advocates question changes to stairwell requirements in new residential construction across British Columbia.</p>
              </div>
              <div style={{ padding: '0 1rem 1rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0D1E2E' }}>Read more →</span>
              </div>
            </a>

            {/* Article 5 — OBC Reference */}
            <a href="https://www.ontario.ca/laws/statute/92b23" target="_blank" rel="noopener noreferrer"
              style={{ flexShrink: 0, width: 300, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(44,74,110,0.1)', textDecoration: 'none', border: '1px solid rgba(44,90,122,0.1)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: 'linear-gradient(135deg,#0a1a0a,#1a3a1a)', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '2rem' }}>📋</span>
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.1em' }}>ONTARIO · BUILDING CODE</span>
              </div>
              <div style={{ padding: '1rem', flex: 1 }}>
                <div style={{ fontSize: '0.72rem', color: '#F29337', fontWeight: 700, marginBottom: '0.4rem' }}>REGULATORY</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0D1E2E', lineHeight: 1.3, marginBottom: '0.5rem' }}>Ontario Building Code 2024 — Stair and ramp requirements</div>
                <p style={{ fontSize: '0.78rem', color: '#5E7D9B', lineHeight: 1.55, margin: 0 }}>Official OBC 2024 provisions covering riser height, tread depth, handrail height, and stairway width for residential and commercial occupancies.</p>
              </div>
              <div style={{ padding: '0 1rem 1rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0D1E2E' }}>Read more →</span>
              </div>
            </a>

            {/* Article 6 — WSJ */}
            <a href="https://www.wsj.com/articles/construction-companies-see-promise-in-ai-agents-12dc2d60" target="_blank" rel="noopener noreferrer"
              style={{ flexShrink: 0, width: 300, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(44,74,110,0.1)', textDecoration: 'none', border: '1px solid rgba(44,90,122,0.1)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: 'linear-gradient(135deg,#1a1208,#3a2a10)', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '2rem' }}>🤖</span>
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.1em' }}>WALL STREET JOURNAL</span>
              </div>
              <div style={{ padding: '1rem', flex: 1 }}>
                <div style={{ fontSize: '0.72rem', color: '#F29337', fontWeight: 700, marginBottom: '0.4rem' }}>INDUSTRY · AI</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0D1E2E', lineHeight: 1.3, marginBottom: '0.5rem' }}>Construction Companies See Promise in AI Agents</div>
                <p style={{ fontSize: '0.78rem', color: '#5E7D9B', lineHeight: 1.55, margin: 0 }}>The Wall Street Journal examines how the construction industry is adopting AI agents to automate inspections, documentation, and compliance workflows on job sites.</p>
              </div>
              <div style={{ padding: '0 1rem 1rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0D1E2E' }}>Read more →</span>
              </div>
            </a>

          </div>
          </div>{/* end scroll wrapper */}
          <p style={{ fontSize: '0.72rem', color: '#5E7D9B', marginTop: '1.5rem', textAlign: 'center' }}>
            Use scroll wheel, drag, or the arrows to browse · Updated regularly
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SITE FOOTER (Procore-style)
      ══════════════════════════════════════════════ */}
      <section style={{ background: '#fff', borderTop: '1px solid #E5EBF2', padding: '3.5rem 1.25rem 2rem' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2.5rem', marginBottom: '3rem' }}>

            {/* Brand */}
            <div style={{ flex: '1 1 220px', minWidth: 180 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/staircode_logo.png" alt="stAIrcode" style={{ height: 32, marginBottom: '1rem', display: 'block' }} />
              <p style={{ fontSize: '0.82rem', color: '#5E7D9B', lineHeight: 1.7, marginBottom: '1rem' }}>
                stAIrcode is committed to improving building safety by making stair compliance accessible to everyone — from first-time homebuyers to professional building managers.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {[
                  { href: 'https://www.instagram.com/staircode/', label: '📸', title: 'Instagram' },
                  { href: 'https://www.facebook.com/people/Staircode/61589350702805/', label: '👥', title: 'Facebook' },
                  { href: 'https://play.google.com/store/apps/details?id=app.staircode.android&pcampaignid=web_share', label: '▶', title: 'Google Play' },
                  { href: 'mailto:info@staircode.app', label: '✉', title: 'Email us' },
                ].map(s => (
                  <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" title={s.title}
                    style={{ width: 36, height: 36, borderRadius: '50%', background: '#F0F5FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', textDecoration: 'none', color: '#0D1E2E' }}>
                    {s.label}
                  </a>
                ))}
              </div>
            </div>

            {/* New to stAIrcode? */}
            <div style={{ flex: '1 1 160px', minWidth: 140 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', color: '#0D1E2E', textTransform: 'uppercase', marginBottom: '0.85rem' }}>New to stAIrcode?</div>
                  {[
                { label: 'What is stAIrcode?',  href: '/what-is-staircode' },
                { label: 'Platform Overview',    href: '/platform-overview' },
                { label: 'Product Updates',      href: '#' },
                { label: 'Resource Center',      href: '/research' },
                { label: 'Trust & Security',     href: '/privacy' },
                { label: 'App Marketplace',      href: '#' },
                { label: 'Developers / API',     href: '#' },
              ].map(l => (
                <div key={l.label} style={{ marginBottom: '0.55rem' }}>
                  <a href={l.href} style={{ fontSize: '0.83rem', color: '#5E7D9B', textDecoration: 'none' }}>{l.label}</a>
                </div>
              ))}
            </div>

            {/* About */}
            <div style={{ flex: '1 1 160px', minWidth: 140 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', color: '#0D1E2E', textTransform: 'uppercase', marginBottom: '0.85rem' }}>About stAIrcode</div>
                  {[
                { label: 'Our Story',         href: '/our-story' },
                { label: 'Blog',              href: '#' },
                { label: 'Careers',           href: '#' },
                { label: 'Contact Us',        href: 'mailto:info@staircode.app' },
                { label: 'Legal',             href: '#' },
                { label: 'Privacy Policy',    href: '/privacy' },
                { label: 'Terms of Service',  href: '/terms' },
                { label: 'Unsubscribe',       href: 'mailto:info@staircode.app?subject=Unsubscribe' },
              ].map(l => (
                <div key={l.label} style={{ marginBottom: '0.55rem' }}>
                  <a href={l.href} style={{ fontSize: '0.83rem', color: '#5E7D9B', textDecoration: 'none' }}>{l.label}</a>
                </div>
              ))}
            </div>

            {/* Downloads */}
            <div style={{ flex: '1 1 160px', minWidth: 140 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', color: '#0D1E2E', textTransform: 'uppercase', marginBottom: '0.85rem' }}>Downloads</div>
              <a href="https://play.google.com/store/apps/details?id=app.staircode.android&pcampaignid=web_share" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#000', borderRadius: 8, padding: '0.5rem 0.85rem', textDecoration: 'none', marginBottom: '0.75rem', width: 'fit-content' }}>
                <span style={{ fontSize: '0.85rem' }}>▶</span>
                <div>
                  <div style={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1 }}>GET IT ON</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Google Play</div>
                </div>
              </a>
              <div style={{ fontSize: '0.75rem', color: '#9BB5C8', fontStyle: 'italic' }}>iOS — Coming soon</div>
            </div>

          </div>

          {/* Bottom strip */}
          <div style={{ borderTop: '1px solid #E5EBF2', paddingTop: '1.25rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#9BB5C8' }}>
              © {new Date().getFullYear()} Just Open Technologies Inc. · staircode.app
            </div>
            <div style={{ display: 'flex', gap: '1.25rem' }}>
              {[['Privacy', '/privacy'], ['Terms', '/terms'], ['Research', '/research'], ['Contact', 'mailto:info@staircode.app']].map(([l, h]) => (
                <a key={l} href={h} style={{ fontSize: '0.75rem', color: '#9BB5C8', textDecoration: 'none' }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FOOTER (minimal — keep for structure)
      ══════════════════════════════════════════════ */}
      <footer style={{ display: 'none' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <NavLogo height={20} style={{ opacity: 0.75 }} />
            <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>stAIrcode</span>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.8em' }}>staircode.app</span>
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="/research">Research</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="mailto:info@staircode.app">Contact</a>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.25)' }}>© {new Date().getFullYear()} Just Open Technologies Inc.</div>
        </div>
      </footer>
    </>
  )
}
