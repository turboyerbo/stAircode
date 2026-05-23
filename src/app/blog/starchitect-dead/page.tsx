'use client'
import React from 'react'
import { NavLogo } from '@/app/components/Logo'

export default function StarchitectDeadPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: '#0D1E2E' }}>
      <header style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5EBF2', display: 'flex', alignItems: 'center', background: '#fff' }}>
        <a href="/marketing" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <NavLogo height={28} />
        </a>
        <a href="/blog" style={{ fontSize: '0.78rem', color: '#5E7D9B', textDecoration: 'none', marginLeft: 'auto' }}>← Blog</a>
      </header>

      {/* Hero */}
      <div style={{ background: '#0A1C2E', padding: '5rem 1.5rem 4rem' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', color: '#F29337', textTransform: 'uppercase', marginBottom: '1rem' }}>
            Architecture + Technology
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#E8F4FF', marginBottom: '1.5rem' }}>
            The starchitect is dead.
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, maxWidth: 580, margin: '0 0 1.5rem', fontStyle: 'italic' }}>
            And we are left with the question of what comes next.
          </p>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
            <span>April 2026</span>
            <span>·</span>
            <span>6 min read</span>
            <span>·</span>
            <span>Just Open Technologies</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
        <section style={{ marginBottom: '4rem' }}>
          <p style={{ fontSize: '1rem', color: '#3A5A78', lineHeight: 1.95, marginBottom: '1.5rem' }}>
            Nietzsche&apos;s declaration &mdash; &ldquo;God is dead&rdquo; &mdash; was never a triumphant atheism. It was a warning. The structures of meaning that had organised Western culture had collapsed, and nothing had yet arrived to replace them. The vacancy was the problem. The murky water rushing in to fill a place that had not yet decided what it was.
          </p>
          <p style={{ fontSize: '1rem', color: '#3A5A78', lineHeight: 1.95, marginBottom: '1.5rem' }}>
            Architecture knows this moment well. The starchitect &mdash; the singular, visionary, patriarchal author of the built environment &mdash; has been put on trial. Rightly so. The cult of the individual architect, with its colonial assumptions about who gets to shape space and for whom, has been examined, contested, and found wanting. The pedestal is empty.
          </p>
          <p style={{ fontSize: '1rem', color: '#3A5A78', lineHeight: 1.95 }}>
            What fills it is the question. And it is not a comfortable one. Because the market &mdash; with its unlimited appetite and unlimited resources &mdash; is ready to answer it. If the profession does not.
          </p>
        </section>

        <div style={{ borderLeft: '3px solid #F29337', paddingLeft: '1.5rem', margin: '3rem 0' }}>
          <blockquote style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0D1E2E', lineHeight: 1.55, margin: 0, fontStyle: 'italic' }}>
            &ldquo;Pushing the profession forward &mdash; and not being consumed by market-driven forces &mdash; requires forward thinking and real contributions to the construction industry.&rdquo;
          </blockquote>
        </div>

        <section style={{ marginBottom: '4rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#0D1E2E', marginBottom: '1rem' }}>The research tradition</h2>
          <p style={{ fontSize: '1rem', color: '#3A5A78', lineHeight: 1.95, marginBottom: '1.5rem' }}>
            The greatest architecture practices of the twentieth century understood that design excellence and intellectual rigour were inseparable. The offices that pushed the profession furthest were those that ran a speculative, research-oriented counterpart alongside their built work &mdash; one arm engaged directly with clients, contractors, and construction; the other free to ask harder questions about where the discipline was going and what tools it would need when it arrived.
          </p>
          <p style={{ fontSize: '1rem', color: '#3A5A78', lineHeight: 1.95, marginBottom: '1.5rem' }}>
            Academic research remains as important today as it was when those offices were at their most generative. But its context has changed entirely. The threat to independent thought no longer comes only from ideology and capital. It comes from the technology sector &mdash; from AI systems, platforms, and tools built by companies with no particular interest in architecture, being adopted wholesale by a profession that does not yet have its own alternatives.
          </p>
          <p style={{ fontSize: '1rem', color: '#3A5A78', lineHeight: 1.95 }}>
            The vacancy left by the starchitect is being filled, quietly, by software. The question is whether that software will be designed by people who understand what gets built, how it gets regulated, who it is for, and what the stakes are &mdash; or by people who do not.
          </p>
        </section>

        <section style={{ marginBottom: '4rem', background: '#F7FAFC', borderRadius: 20, padding: '2.5rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#F29337', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            Just Open Architecture + Just Open Technologies
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#0D1E2E', marginBottom: '1rem' }}>Two disciplines. One position.</h2>
          <p style={{ fontSize: '0.95rem', color: '#3A5A78', lineHeight: 1.9, marginBottom: '1.25rem' }}>
            <a href="https://www.justopenarch.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#0D1E2E', fontWeight: 700, textDecoration: 'underline', textDecorationColor: '#F29337' }}>Just Open Architecture</a>{' '}
            is a licensed architecture practice: design, documentation, project delivery. Just Open Technologies is its research and development counterpart &mdash; purpose-built to develop digital tools that address real problems in construction, compliance, and the documentation of the built environment.
          </p>
          <p style={{ fontSize: '0.95rem', color: '#3A5A78', lineHeight: 1.9, marginBottom: '1.25rem' }}>
            The digital is not becoming an important feature of architecture. It already is architecture. It is symbiotic, integral, and foundational. Building information, compliance data, spatial measurement, material specification &mdash; these are digital processes that occasionally produce physical output. The two cannot be separated, and should not be treated as though they can.
          </p>
          <p style={{ fontSize: '0.95rem', color: '#3A5A78', lineHeight: 1.9 }}>
            Just Open Technologies exists to ensure that the technology being applied to the built environment is designed for it &mdash; by people who understand what is genuinely at stake. stAIrcode is its first product. It will not be the last.
          </p>
        </section>

        <section style={{ marginBottom: '4rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#0D1E2E', marginBottom: '1rem' }}>What fills the vacancy</h2>
          <p style={{ fontSize: '1rem', color: '#3A5A78', lineHeight: 1.95, marginBottom: '1.5rem' }}>
            Not another icon. Not a return to the pedestal with different occupants. What fills the vacancy is infrastructure &mdash; the unglamorous, essential, deeply consequential work of building the systems that make the built environment safer, more accountable, and more legible to the people who inhabit it.
          </p>
          <p style={{ fontSize: '1rem', color: '#3A5A78', lineHeight: 1.95 }}>
            A staircase that meets the building code is not a radical act. But knowing that it does &mdash; before the inspector arrives, before the lawsuit, before someone falls &mdash; is exactly the kind of contribution that a profession serious about its responsibilities to the public should be making. That is what stAIrcode is. A small, precise, useful tool. Built by architects, for the industry they are trying to serve.
          </p>
        </section>

        <div style={{ background: '#0A1C2E', borderRadius: 20, padding: '2.5rem', textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#E8F4FF', marginBottom: '0.5rem' }}>stAIrcode &mdash; built by architects, for the industry</h3>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: '1.5rem' }}>Free to scan. $2.99 to unlock the full compliance report.</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/?signin=1" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#F29337,#C4721E)', color: '#fff', fontWeight: 800, fontSize: '0.95rem', textDecoration: 'none', padding: '0.85rem 2rem', borderRadius: 12, letterSpacing: '0.04em' }}>
              Start a Compliance Scan &rarr;
            </a>
            <a href="/about" style={{ display: 'inline-block', background: 'transparent', border: '1.5px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.65)', fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none', padding: '0.85rem 2rem', borderRadius: 12 }}>
              About Just Open &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
