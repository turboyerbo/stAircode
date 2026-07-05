'use client'
import React, { useState } from 'react'
import { NavLogo } from '@/app/components/Logo'

const SCREENS = [
  {
    src: '/screen_tread.jpg',
    title: 'Guided scan sequence',
    body: 'Each inspection module walks you through its measurements in sequence with on-screen instructions telling you where to point the camera. For a stair scan, that covers riser height, tread depth, stair width, handrail height, nosing, headroom, and riser consistency. Other modules cover their own elements. No experience needed.',
  },
  {
    src: '/screen_review.jpg',
    title: 'Review, adjust, and generate your report',
    body: 'After scanning, you review every captured measurement before generating the report. Values can be nudged up or down with the ± controls. Once confirmed, the app checks every dimension against your local building code and presents a pass/fail summary.',
  },
]

export default function PlatformOverviewPage() {
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleComment() {
    if (!comment.trim() || comment.trim().length < 10) {
      setError('Please write at least 10 characters.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/testimonial', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     name.trim() || 'Anonymous',
          title:    'Platform Overview visitor',
          business: email.trim() || 'Not provided',
          comment:  comment.trim(),
          email:    email.trim(),
        }),
      })
      if (res.ok) {
        setSent(true)
        setName(''); setEmail(''); setComment('')
      } else {
        const d = await res.json()
        setError(d.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Could not send. Please try again or email info@staircode.app directly.')
    }
    setSending(false)
  }

  const C = { bg: '#ffffff', bg2: '#F0F5FA', navy: '#0D1E2E', navy2: '#5E7D9B', orange: '#F29337', border: '#E5EBF2', pass: '#27A96B', fail: '#E84545' }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: C.navy }}><header style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', background: C.bg }}><a href="/marketing" style={{ textDecoration: 'none' }}><NavLogo height={28} /></a>
        <a href="/marketing" style={{ fontSize: '0.78rem', color: C.navy2, textDecoration: 'none', marginLeft: 'auto' }}>← Back</a>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 1.5rem' }}><div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em', color: C.orange, textTransform: 'uppercase' as const, marginBottom: '0.75rem' }}>Platform Overview</div>
        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '1rem' }}>How the app works</h1>
        <p style={{ fontSize: '1rem', color: C.navy2, lineHeight: 1.75, marginBottom: '3.5rem', maxWidth: 620 }}>stAIrcode is a Progressive Web App — it runs directly in your mobile browser with no download required. Here is what the experience looks like.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '5rem' }}>{SCREENS.map((s, i) => (
            <div key={i} style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '2.5rem', alignItems: 'center', flexDirection: (i % 2 === 1 ? 'row-reverse' : 'row') as any }}><div style={{ flex: '0 1 260px' }}>{/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt={s.title} style={{ width: '100%', borderRadius: 20, boxShadow: '0 8px 40px rgba(44,74,110,0.15)', border: `1px solid ${C.border}`, objectFit: 'cover' as const, objectPosition: '50% 10%' }} />
              </div>
              <div style={{ flex: '1 1 300px' }}><div style={{ fontSize: '0.68rem', fontWeight: 800, color: C.orange, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: '0.5rem' }}>Step {i + 1}</div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: C.navy, marginBottom: '0.75rem' }}>{s.title}</h2>
                <p style={{ fontSize: '0.9rem', color: C.navy2, lineHeight: 1.8, margin: 0 }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Feature grid */}
        <div style={{ marginTop: '5rem', padding: '2.5rem', background: C.bg2, borderRadius: 20 }}><h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: C.navy, marginBottom: '1.5rem', textAlign: 'center' as const }}>What&apos;s included</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>{[
              ['', 'No app download required', 'Runs in any mobile browser as a PWA'],
              ['', 'AI Vision measurement',     'Camera-based dimension estimation'],
              ['', 'Building code check',        'Location-aware — matches your local code automatically'],
              ['', 'PDF compliance report',      'Photos, citations, pass/fail table'],
              ['', 'Location-aware',             'Auto-detects your jurisdiction'],
              ['', 'Secure & private',           'Images processed and deleted immediately after scan'],
            ].map(([icon, title, desc]) => (
              <div key={String(title)} style={{ background: C.bg, borderRadius: 12, padding: '1rem', boxShadow: '0 1px 8px rgba(44,74,110,0.07)' }}><div style={{ fontSize: '1.4rem', marginBottom: '0.35rem' }}>{icon}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.navy, marginBottom: '0.2rem' }}>{title}</div>
                <div style={{ fontSize: '0.75rem', color: C.navy2, lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial policy */}
        <div style={{ marginTop: '4rem', padding: '2rem', border: `1.5px solid rgba(242,147,55,0.3)`, borderRadius: 16, background: 'rgba(242,147,55,0.04)' }}><div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.12em', color: C.orange, textTransform: 'uppercase' as const, marginBottom: '0.6rem' }}>Testimonial &amp; Feedback Policy</div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: C.navy, marginBottom: '0.75rem' }}>How we use your feedback</h2>
          <p style={{ fontSize: '0.88rem', color: C.navy2, lineHeight: 1.8, margin: '0 0 0.75rem' }}>During the Beta period, users who submit feedback through the in-app testimonial form may have their comments, name, title, and business name featured on staircode.app or in promotional materials. This helps us share real experiences from building professionals using the tool.
          </p>
          <p style={{ fontSize: '0.88rem', color: C.navy2, lineHeight: 1.8, margin: '0 0 0.75rem' }}>By submitting feedback, you grant stAIrcode a non-exclusive, royalty-free licence to display your testimonial publicly. Your email address is never published — only your name, title, business name, and written comment may appear.
          </p>
          <p style={{ fontSize: '0.88rem', color: C.navy2, lineHeight: 1.8, margin: 0 }}><strong style={{ color: C.navy }}>You can request removal at any time.</strong>{' '}
            Email <a href="mailto:info@staircode.app" style={{ color: C.orange, fontWeight: 600, textDecoration: 'none' }}>info@staircode.app</a>{' '}
            with the subject <em>&ldquo;Remove my testimonial&rdquo;</em> and we will remove it within 5 business days.
          </p>
        </div>

        {/* Developer contact */}
        <div style={{ marginTop: '4rem', padding: '2rem', background: C.bg2, borderRadius: 16 }}><div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.12em', color: C.orange, textTransform: 'uppercase' as const, marginBottom: '0.6rem' }}>Developer</div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: C.navy, marginBottom: '0.75rem' }}>About the developer</h2>
          <p style={{ fontSize: '0.88rem', color: C.navy2, lineHeight: 1.8, margin: '0 0 0.75rem' }}>stAIrcode is an independent software product built to make building code compliance accessible from a smartphone. It was designed with input from building professionals, architects, and contractors across Canada and the United States.
          </p>
          <p style={{ fontSize: '0.88rem', color: C.navy2, lineHeight: 1.8, margin: '0 0 1.25rem' }}>The product is in active Beta. Feedback directly shapes future versions — for suggestions, bug reports, partnership enquiries, or testimonial removal requests, email the developer directly.
          </p>
          <a href="mailto:info@staircode.app" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', background: C.navy, color: '#fff', borderRadius: 10, textDecoration: 'none', fontSize: '0.88rem', fontWeight: 700 }}>&nbsp; Contact — info@staircode.app
          </a>
          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' as const }}><a href="https://www.instagram.com/staircode/" target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'rgba(131,58,180,0.08)', border: '1px solid rgba(131,58,180,0.2)', borderRadius: 8, textDecoration: 'none', color: C.navy, fontSize: '0.8rem', fontWeight: 600 }}>Instagram
            </a>
            <a href="https://www.facebook.com/people/Staircode/61589350702805/" target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'rgba(24,119,242,0.08)', border: '1px solid rgba(24,119,242,0.2)', borderRadius: 8, textDecoration: 'none', color: '#1877F2', fontSize: '0.8rem', fontWeight: 600 }}>Facebook
            </a>
          </div>
        </div>

        {/* Comments section */}
        <div style={{ marginTop: '4rem' }}><div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.12em', color: C.orange, textTransform: 'uppercase' as const, marginBottom: '0.6rem' }}>Comments</div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: C.navy, marginBottom: '0.35rem' }}>Questions or feedback?</h2>
          <p style={{ fontSize: '0.85rem', color: C.navy2, lineHeight: 1.7, marginBottom: '1.5rem' }}>Leave a comment below — questions, suggestions, bug reports, or general feedback. We read everything.
            You can also email <a href="mailto:info@staircode.app" style={{ color: C.orange, fontWeight: 600, textDecoration: 'none' }}>info@staircode.app</a> directly.
          </p>

          {sent ? (
            <div style={{ padding: '1.25rem', background: 'rgba(39,169,107,0.08)', border: '1.5px solid rgba(39,169,107,0.25)', borderRadius: 14, textAlign: 'center' as const }}><div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}></div>
              <div style={{ fontWeight: 700, color: C.pass, marginBottom: '0.25rem' }}>Comment received — thank you!</div>
              <div style={{ fontSize: '0.8rem', color: C.navy2 }}>We&apos;ll follow up by email if you left one.</div>
              <button onClick={() => setSent(false)} style={{ marginTop: '0.85rem', background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.4rem 1rem', fontSize: '0.78rem', cursor: 'pointer', color: C.navy2 }}>Leave another comment
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.85rem' }}><div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' as const }}><input type="text" placeholder="Your name (optional)" value={name} onChange={e => setName(e.target.value)}
                  style={{ flex: '1 1 180px', padding: '0.75rem 1rem', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: '0.88rem', color: C.navy, outline: 'none', background: C.bg }} />
                <input type="email" placeholder="Email (optional — for follow-up)" value={email} onChange={e => setEmail(e.target.value)}
                  style={{ flex: '2 1 240px', padding: '0.75rem 1rem', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: '0.88rem', color: C.navy, outline: 'none', background: C.bg }} />
              </div>
              <textarea placeholder="Write your comment, question, or suggestion here…" value={comment} onChange={e => { setComment(e.target.value); setError(null) }} rows={5}
                style={{ width: '100%', boxSizing: 'border-box' as const, padding: '0.85rem 1rem', border: `1px solid ${comment.length >= 10 ? C.pass : C.border}`, borderRadius: 10, fontSize: '0.88rem', color: C.navy, outline: 'none', background: C.bg, resize: 'vertical' as const, lineHeight: 1.65 }} />
              {error && <div style={{ fontSize: '0.78rem', color: C.fail, padding: '0.5rem 0.75rem', background: 'rgba(232,69,69,0.06)', borderRadius: 8, border: '1px solid rgba(232,69,69,0.2)' }}>{error}</div>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: '0.5rem' }}><p style={{ fontSize: '0.72rem', color: C.navy2, margin: 0, maxWidth: 480, lineHeight: 1.55 }}>Comments may be featured as testimonials on staircode.app. Your email is never published. To request removal, email{' '}
                  <a href="mailto:info@staircode.app" style={{ color: C.orange, textDecoration: 'none' }}>info@staircode.app</a>.
                </p>
                <button onClick={handleComment} disabled={sending}
                  style={{ padding: '0.8rem 1.75rem', background: sending ? 'rgba(242,147,55,0.4)' : `linear-gradient(135deg,${C.orange},#C4721E)`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: sending ? 'not-allowed' : 'pointer' }}>{sending ? 'Sending…' : 'Send Comment →'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center' as const, marginTop: '4rem', paddingTop: '3rem', borderTop: `1px solid ${C.border}` }}><a href="/?signin=1" style={{ display: 'inline-block', background: `linear-gradient(135deg,${C.orange},#C4721E)`, color: '#fff', fontWeight: 800, fontSize: '1rem', textDecoration: 'none', padding: '0.9rem 2.5rem', borderRadius: 14, letterSpacing: '0.04em', boxShadow: '0 4px 20px rgba(242,147,55,0.4)' }}>Try it now — free →
          </a>
        </div>

      </div>
    </div>
  )
}
