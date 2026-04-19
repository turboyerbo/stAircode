'use client'
/**
 * /marketing — stAIrcode landing page
 * Design reference: chronoinnovation.com/chrono-rd/features/sred-automation/
 * Font: DM Sans (Google Fonts) — same as Chrono
 */

import { useState, useEffect } from 'react'

export default function MarketingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled,  setScrolled] = useState(false)
  const [openFaq,   setOpenFaq]  = useState<number | null>(null)

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
      {/* ── Google Fonts ── */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; background: #fff; color: #0D1E2E; -webkit-font-smoothing: antialiased; }

        /* Nav */
        .nav-link { font-size: 0.9rem; font-weight: 500; color: #0D1E2E; text-decoration: none; transition: color 0.15s; }
        .nav-link:hover { color: #F29337; }
        .nav-cta {
          display: inline-flex; align-items: center; gap: 6px;
          background: #F29337; color: #fff; font-weight: 700;
          font-size: 0.88rem; padding: 10px 22px; border-radius: 6px;
          text-decoration: none; transition: background 0.15s, transform 0.1s;
          white-space: nowrap; letter-spacing: -0.01em;
        }
        .nav-cta:hover { background: #d97b1f; transform: translateY(-1px); }

        /* Hamburger */
        .ham-line { display: block; width: 22px; height: 2px; background: #0D1E2E; border-radius: 2px; transition: all 0.2s; }
        .ham-open .ham-line:nth-child(1) { transform: translateY(8px) rotate(45deg); }
        .ham-open .ham-line:nth-child(2) { opacity: 0; }
        .ham-open .ham-line:nth-child(3) { transform: translateY(-8px) rotate(-45deg); }

        /* Mobile menu */
        .mob-menu { display: none; }
        @media (max-width: 860px) {
          .desktop-nav { display: none !important; }
          .mob-menu { display: block; }
        }
        @media (min-width: 861px) {
          .mob-menu-panel { display: none !important; }
          .ham-btn { display: none !important; }
        }

        /* Hero */
        .hero-stat { font-size: clamp(2.6rem, 7vw, 5rem); font-weight: 800; line-height: 1; letter-spacing: -0.04em; color: #0D1E2E; }
        .hero-stat span { color: #F29337; }

        /* Cards */
        .feature-card { background: #F7FAFC; border: 1px solid #E2EAF0; border-radius: 12px; padding: 1.5rem; }
        .feature-card h3 { font-size: 1rem; font-weight: 700; margin-bottom: 0.4rem; color: #0D1E2E; }
        .feature-card p  { font-size: 0.875rem; color: #5E7D9B; line-height: 1.6; }

        /* Stats bar */
        .stat-pill { background: rgba(242,147,55,0.1); border: 1px solid rgba(242,147,55,0.25); border-radius: 10px; padding: 1.25rem 1.5rem; }
        .stat-pill .num { font-size: 2rem; font-weight: 800; color: #F29337; letter-spacing: -0.03em; }
        .stat-pill .lbl { font-size: 0.78rem; color: #5E7D9B; margin-top: 2px; line-height: 1.4; }

        /* Pricing */
        .price-card { border: 1px solid #E2EAF0; border-radius: 14px; padding: 2rem; flex: 1; min-width: 260px; }
        .price-card.featured { border-color: #F29337; background: #FFF8F0; }

        /* FAQ */
        .faq-item { border-bottom: 1px solid #E2EAF0; }
        .faq-q { width: 100%; background: none; border: none; text-align: left; padding: 1.1rem 0; font-size: 0.95rem; font-weight: 600; color: #0D1E2E; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 1rem; font-family: 'DM Sans', sans-serif; }
        .faq-a { font-size: 0.88rem; color: #5E7D9B; line-height: 1.7; padding-bottom: 1rem; }

        /* Section */
        .section { padding: 5rem 1.25rem; max-width: 1080px; margin: 0 auto; }
        .section-label { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #F29337; margin-bottom: 0.75rem; }
        .section-title { font-size: clamp(1.6rem, 3.5vw, 2.4rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.15; color: #0D1E2E; margin-bottom: 1rem; }
        .section-sub { font-size: 1rem; color: #5E7D9B; line-height: 1.6; max-width: 600px; }

        /* Dark section */
        .dark-section { background: #0A1C2E; color: #fff; }
        .dark-section .section-title { color: #fff; }
        .dark-section .section-sub   { color: rgba(255,255,255,0.65); }

        /* Orange badge */
        .obadge { display: inline-block; background: #F29337; color: #fff; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 10px; border-radius: 4px; margin-bottom: 1rem; }

        /* Step numbers */
        .step-num { width: 40px; height: 40px; border-radius: 50%; background: #F29337; color: #fff; font-size: 1rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

        /* Testimonial */
        .testimonial { background: #F7FAFC; border-left: 4px solid #F29337; border-radius: 0 12px 12px 0; padding: 1.5rem 1.75rem; }

        /* Footer */
        footer { background: #0A1C2E; color: rgba(255,255,255,0.5); font-size: 0.8rem; padding: 2rem 1.25rem; text-align: center; }
        footer a { color: rgba(255,255,255,0.5); text-decoration: none; }
        footer a:hover { color: #F29337; }
      `}</style>

      {/* ══════════════════════════════════════════════
          NAV
      ══════════════════════════════════════════════ */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'rgba(255,255,255,0.97)' : '#fff',
        borderBottom: '1px solid #E2EAF0',
        backdropFilter: 'blur(8px)',
        transition: 'box-shadow 0.2s',
        boxShadow: scrolled ? '0 2px 16px rgba(0,0,0,0.06)' : 'none',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 1.25rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <a href="/marketing" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/logo_icon_blue.png" alt="stAIrcode" style={{ height: 30, width: 'auto' }} />
            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0D1E2E', letterSpacing: '-0.02em' }}>
              st<span style={{ color: '#F29337' }}>AI</span>rcode
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
            {navLinks.slice(0, 4).map(l => (
              <a key={l.label} href={l.href} className="nav-link">{l.label}</a>
            ))}
            <a href="/?signin=1" className="nav-link">Sign In</a>
            <a href="/?signin=1" className="nav-cta">Try stAIrcode FREE →</a>
          </nav>

          {/* Hamburger */}
          <button
            className={`ham-btn mob-menu${menuOpen ? ' ham-open' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, padding: 4 }}
            aria-label="Menu"
          >
            <span className="ham-line" />
            <span className="ham-line" />
            <span className="ham-line" />
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="mob-menu-panel" style={{
            background: '#fff', borderTop: '1px solid #E2EAF0',
            padding: '1rem 1.25rem 1.5rem',
            display: 'flex', flexDirection: 'column', gap: '0.25rem',
          }}>
            {navLinks.map(l => (
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)}
                style={{ padding: '0.75rem 0', fontSize: '1rem', fontWeight: 500, color: '#0D1E2E', textDecoration: 'none', borderBottom: '1px solid #F0F5FA' }}
              >{l.label}</a>
            ))}
            <a href="/?signin=1" className="nav-cta" style={{ marginTop: '1rem', justifyContent: 'center' }}>
              Try stAIrcode FREE →
            </a>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════ */}
      <section style={{ paddingTop: 'calc(64px + 4rem)', paddingBottom: '4rem', paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div className="obadge">AI-Powered Stair Compliance</div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, maxWidth: 800, marginBottom: '1.5rem' }}>
            Know if your stairs are safe.<br />
            <span style={{ color: '#F29337' }}>Before someone gets hurt.</span>
          </h1>

          {/* Problem statement */}
          <div style={{ maxWidth: 720, marginBottom: '2rem' }}>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.7, color: '#2C4A68', marginBottom: '1rem' }}>
              The direct medical costs of non-fatal stair fall injuries in the US are estimated at{' '}
              <strong>over $92 billion annually.</strong>
            </p>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.75, color: '#2C4A68', marginBottom: '0.75rem' }}>
              Unintentional falls result in almost <strong>1,800 emergency department visits</strong> and{' '}
              <strong>417 hospital admissions every day</strong> in Canada alone.
            </p>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.75, color: '#2C4A68', marginBottom: '0.75rem' }}>
              Falls on stairs account for roughly{' '}
              <strong>20% of fall-related injury hospitalizations</strong> among seniors. Dimensional inconsistency in risers larger than 3/8 inch{' '}
              <strong>increases trip risk by over 50%.</strong>
            </p>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.75, color: '#2C4A68' }}>
              Non-compliant stairs injure and kill people. The regulatory requirement to check stairs against building codes is real.{' '}
              The gap between <em>&ldquo;I have stairs&rdquo;</em> and <em>&ldquo;I know if they&apos;re compliant&rdquo;</em> is real.{' '}
              <strong>stAIrcode addresses that gap.</strong>
            </p>
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '2.5rem' }}>
            <a href="/?signin=1" className="nav-cta" style={{ fontSize: '1rem', padding: '13px 28px' }}>
              Try stAIrcode FREE →
            </a>
            <a href="#how-it-works" style={{ fontSize: '0.9rem', color: '#5E7D9B', textDecoration: 'none', fontWeight: 500 }}>
              See how it works ↓
            </a>
          </div>

          {/* ── Video placeholder ── */}
          <div style={{
            width: '100%', maxWidth: 800,
            aspectRatio: '16 / 9',
            background: '#0A1C2E',
            borderRadius: 14,
            border: '1px solid rgba(65,124,164,0.25)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
            position: 'relative', overflow: 'hidden',
            backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(65,124,164,0.06) 27px,rgba(65,124,164,0.06) 28px),repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(65,124,164,0.06) 27px,rgba(65,124,164,0.06) 28px)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#F29337',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 24px rgba(242,147,55,0.4)',
              cursor: 'pointer',
            }}>
              {/* Play triangle */}
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M7 4L18 11L7 18V4Z" fill="white"/>
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Demo Video
              </div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', marginTop: 4, letterSpacing: '0.1em' }}>
                COMING SOON
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          AS SEEN IN / TRUST BAR
      ══════════════════════════════════════════════ */}
      <div style={{ borderTop: '1px solid #E2EAF0', borderBottom: '1px solid #E2EAF0', padding: '1.25rem 1.25rem', background: '#F7FAFC' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.5rem', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5E7D9B', flexShrink: 0 }}>Checks compliance against</span>
          {['OBC 2024', 'NBC 2020', 'BCBC 2024', 'QBC 2020', 'IBC 2021', 'IRC 2021'].map(code => (
            <span key={code} style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0D1E2E', background: '#fff', border: '1px solid #E2EAF0', borderRadius: 6, padding: '5px 12px' }}>
              {code}
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          TESTIMONIAL
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '4rem 1.25rem', background: '#fff' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="testimonial">
            <div style={{ fontSize: '1.4rem', color: '#F29337', marginBottom: '0.75rem' }}>★★★★★</div>
            <blockquote style={{ fontSize: '1.05rem', lineHeight: 1.7, color: '#0D1E2E', fontStyle: 'italic', fontWeight: 500, marginBottom: '1rem' }}>
              &ldquo;I scanned the staircase at a listing I was about to put an offer on. stAIrcode flagged two risers with a 12mm height inconsistency — well above the 9.5mm (3/8 inch) threshold. I brought it to my building inspector, who confirmed it. It saved me from waiving an inspection on a compliance issue that would&apos;ve cost $6,000 to fix.&rdquo;
            </blockquote>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F29337', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>J</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0D1E2E' }}>Jordan M.</div>
                <div style={{ fontSize: '0.78rem', color: '#5E7D9B' }}>Real Estate Agent, Toronto — RE/MAX</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          WHY CHOOSE
      ══════════════════════════════════════════════ */}
      <section style={{ background: '#F7FAFC', padding: '5rem 1.25rem' }}>
        <div className="section" style={{ padding: 0 }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <div className="section-label">Why stAIrcode</div>
            <h2 className="section-title" style={{ marginBottom: '2.5rem' }}>Why teams choose stAIrcode</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
              {[
                { icon: '📐', title: 'AI Vision Measurement', body: 'Claude Vision reads your photos and extracts riser height, tread depth, stair width, headroom, nosing, and guardrail measurements — no tape measure needed.' },
                { icon: '⚖️', title: 'Code-Accurate Results', body: 'Automatically detects your jurisdiction and checks every measurement against OBC, NBC, IBC, and 6 other codes. Pass/fail shown per dimension.' },
                { icon: '📄', title: 'PDF Compliance Report', body: 'Generate a shareable, cited compliance report in minutes. Useful for real estate disclosure, pre-inspection screening, or contractor briefings.' },
                { icon: '🔵', title: 'AR Measurement Line', body: 'A blue measurement line animates across the screen as the AI reads each dimension — clear visual feedback showing exactly what\'s being measured.' },
              ].map(f => (
                <div key={f.title} className="feature-card">
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
          STATS
      ══════════════════════════════════════════════ */}
      <section className="dark-section" style={{ padding: '4.5rem 1.25rem' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div className="section-label" style={{ color: '#F29337' }}>The Data</div>
          <h2 className="section-title" style={{ marginBottom: '2rem', color: '#fff' }}>The problem is real</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
            {[
              { num: '$92B+', lbl: 'Annual US medical costs from non-fatal stair falls' },
              { num: '1,800', lbl: 'ER visits per day from falls in Canada' },
              { num: '20%',   lbl: 'Of senior fall hospitalizations involve stairs' },
              { num: '+50%',  lbl: 'Increased trip risk from riser inconsistency >3/8"' },
            ].map(s => (
              <div key={s.num} className="stat-pill">
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
          HOW IT WORKS
      ══════════════════════════════════════════════ */}
      <section id="how-it-works" style={{ padding: '5rem 1.25rem' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div className="section-label">How It Works</div>
          <h2 className="section-title" style={{ marginBottom: '3rem' }}>Three steps to a compliance scan</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: 680 }}>
            {[
              { n: '1', title: 'Sign up — free, no credit card', body: 'Create your account with just an email. stAIrcode is free to scan. A full PDF compliance report is available for a one-time purchase.' },
              { n: '2', title: 'Photograph your stairs', body: 'Follow the guided positions on screen. Place a credit card in frame for ±10mm accuracy. stAIrcode walks you through riser, tread, width, headroom, nosing, and guardrail.' },
              { n: '3', title: 'Get your results', body: 'Each dimension is checked against your local building code and shown as pass/fail. Download your report or share it with your inspector, agent, or contractor.' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                <div className="step-num">{s.n}</div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0D1E2E' }}>{s.title}</h3>
                  <p style={{ fontSize: '0.88rem', color: '#5E7D9B', lineHeight: 1.65 }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          PRICING
      ══════════════════════════════════════════════ */}
      <section id="pricing" style={{ background: '#F7FAFC', padding: '5rem 1.25rem' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div className="section-label">Pricing</div>
          <h2 className="section-title" style={{ marginBottom: '2.5rem' }}>Simple, transparent pricing</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
            {/* Free */}
            <div className="price-card">
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

            {/* Pro Report */}
            <div className="price-card featured">
              <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F29337', marginBottom: '0.5rem' }}>Full Report</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#0D1E2E', marginBottom: '0.25rem' }}>$12.99</div>
              <div style={{ fontSize: '0.82rem', color: '#5E7D9B', marginBottom: '1.5rem' }}>One-time per report</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.75rem' }}>
                {['Everything in Free', 'PDF compliance report', 'Cited measurements & code references', 'Shareable with inspector or agent', 'Email delivery within minutes'].map(f => (
                  <li key={f} style={{ fontSize: '0.875rem', color: '#0D1E2E', display: 'flex', gap: '0.5rem' }}>
                    <span style={{ color: '#F29337', fontWeight: 700 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <a href="/?signin=1" className="nav-cta" style={{ display: 'block', textAlign: 'center', padding: '11px' }}>
                Get Full Report →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '5rem 1.25rem' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="section-label">FAQ</div>
          <h2 className="section-title" style={{ marginBottom: '2rem' }}>Frequently asked questions</h2>
          {faqs.map((f, i) => (
            <div key={i} className="faq-item">
              <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                {f.q}
                <span style={{ fontSize: '1.1rem', color: '#F29337', flexShrink: 0 }}>{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && <p className="faq-a">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════ */}
      <section id="about" className="dark-section" style={{ padding: '5rem 1.25rem', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', marginBottom: '1rem' }}>
            Ready to check your stairs?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem', lineHeight: 1.65, marginBottom: '2rem' }}>
            Scan for free in under 5 minutes. No app download. No tape measure.<br />
            Just your phone and the stairs in question.
          </p>
          <a href="/?signin=1" className="nav-cta" style={{ fontSize: '1rem', padding: '14px 32px' }}>
            Try stAIrcode FREE →
          </a>
          <p style={{ marginTop: '1rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
            Pre-screening tool. Always confirm with a licensed inspector before renovation or real estate transaction.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════ */}
      <footer>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo_icon_blue.png" alt="stAIrcode" style={{ height: 22, opacity: 0.6 }} />
            <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>stAIrcode</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>— Just Open Technologies Inc.</span>
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
