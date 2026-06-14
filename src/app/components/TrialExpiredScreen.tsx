'use client'
import React from 'react'

interface Props {
  onSubscribe:   () => void
  onSignOut:     () => void
  userEmail?:    string
}

export default function TrialExpiredScreen({ onSubscribe, onSignOut, userEmail }: Props) {
  const [stripeLoading, setStripeLoading] = React.useState(false)
  const [error,         setError]         = React.useState<string | null>(null)

  async function handleSubscribe() {
    setStripeLoading(true); setError(null)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ product: 'subscription', email: userEmail ?? '' }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Could not start checkout. Please try again.')
        setStripeLoading(false)
      }
    } catch {
      setError('Connection error. Please try again.')
      setStripeLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:     '100dvh',
      background:    'linear-gradient(160deg, #071522 0%, #0A1C2E 60%, #0D2B45 100%)',
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      justifyContent:'center',
      padding:       '2rem 1.25rem',
      fontFamily:    "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      textAlign:     'center',
    }}>

      {/* Icon */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'rgba(242,147,55,0.12)',
        border: '2px solid rgba(242,147,55,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '1.75rem',
        fontSize: '2rem',
      }}>
        ⏱
      </div>

      {/* Headline */}
      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#F29337', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
        Your 7-day free trial has ended
      </div>
      <h1 style={{ fontSize: 'clamp(1.6rem, 5vw, 2.2rem)', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: '1rem', maxWidth: 400 }}>
        Continue with stAIrcode
      </h1>
      <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: 360, marginBottom: '2.5rem' }}>
        Your inspections, reports, and data are all saved. Subscribe to continue generating
        OBC 2024 compliance reports and using all inspection features.
      </p>

      {/* Pricing */}
      <div style={{
        background:    'rgba(255,255,255,0.04)',
        border:        '1px solid rgba(255,255,255,0.1)',
        borderRadius:  16,
        padding:       '1.5rem',
        width:         '100%',
        maxWidth:      360,
        marginBottom:  '1.25rem',
      }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: '#F29337', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Full Residential Inspection</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>$38.99</div>
          <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)' }}>/month</div>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginBottom: '1.25rem' }}>Cancel anytime · No long-term commitment</div>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
          {[
            '6-phase OBC 2024 hold-point workflow',
            'AI vision measurements from your phone',
            'Professional PDF compliance reports',
            'AI inspection assistant — OBC knowledge',
            'Cross-device sync — desktop and mobile',
            'Unlimited projects and inspections',
          ].map(f => (
            <li key={f} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>
              <span style={{ color: '#27A96B', flexShrink: 0, marginTop: 1 }}>✓</span>
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={handleSubscribe}
          disabled={stripeLoading}
          style={{
            width:        '100%',
            padding:      '1rem',
            background:   stripeLoading ? 'rgba(242,147,55,0.5)' : 'linear-gradient(135deg,#F29337,#C4721E)',
            color:        '#fff',
            border:       'none',
            borderRadius: 12,
            fontWeight:   800,
            fontSize:     '1rem',
            cursor:       stripeLoading ? 'not-allowed' : 'pointer',
            fontFamily:   'inherit',
            boxShadow:    '0 4px 18px rgba(242,147,55,0.4)',
          }}>
          {stripeLoading ? 'Opening checkout…' : 'Subscribe — $38.99/month →'}
        </button>

        {error && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#E84545', background: 'rgba(232,69,69,0.08)', padding: '0.5rem 0.75rem', borderRadius: 8 }}>
            {error}
          </div>
        )}
      </div>

      {/* Sign out link */}
      <button
        onClick={onSignOut}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', padding: '0.5rem' }}>
        Sign out
      </button>

      {/* Footer note */}
      <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)', marginTop: '1.5rem', maxWidth: 320, lineHeight: 1.6 }}>
        Questions? Email us at info@staircode.app — we&apos;ll get back to you within one business day.
      </p>
    </div>
  )
}
