'use client'
/**
 * InspectionPaywall.tsx
 *
 * Shown when a user without a subscription taps "Full Building Inspection".
 * Two paths to access:
 *   1. Start Free Trial — No Card Required via Stripe Checkout
 *   2. Access code — enter betacode67 for free access during beta
 *
 * On success: calls onAccess() and the inspection flow continues.
 * On back:    calls onBack() and returns to the home screen.
 */

import { useState } from 'react'
import { NavLogo } from './Logo'

interface Props {
  onAccess:  () => void   // called when access is granted
  onBack:    () => void
  userEmail: string
}

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const ORANGE = '#F29337'
const GREEN  = '#27A96B'
const RED    = '#E84545'
const BORDER = 'rgba(44,90,122,0.14)'

export default function InspectionPaywall({ onAccess, onBack, userEmail }: Props) {
  const [accessCode,    setAccessCode]    = useState('')
  const [codeError,     setCodeError]     = useState<string | null>(null)
  const [loading,       setLoading]       = useState(false)
  const [stripeLoading, setStripeLoading] = useState(false)

  async function handleCodeSubmit() {
    if (!accessCode.trim()) return
    setLoading(true); setCodeError(null)
    try {
      const res  = await fetch('/api/discount/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code: accessCode.trim(), email: userEmail }),
      })
      const data = await res.json()
      if (data.valid) {
        const trialEnd = data.trialEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        try {
          localStorage.setItem('sc_trial_end',    trialEnd)
          localStorage.setItem('sc_beta_access',  '1')
          sessionStorage.setItem('sc_beta_access','1')
        } catch {}
        setTimeout(() => onAccess(), 300)
      } else {
        setCodeError(data.error ?? 'That code is not valid. Please try again.')
        setLoading(false)
      }
    } catch {
      setCodeError('Connection error. Please check your network and try again.')
      setLoading(false)
    }
  }

  async function handleStripe() {
    setStripeLoading(true)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ product: 'subscription', email: userEmail }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setCodeError('Could not start checkout. Please try again.')
        setStripeLoading(false)
      }
    } catch {
      setCodeError('Connection error. Please try again.')
      setStripeLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:     '100dvh',
      background:    '#F4F7FB',
      fontFamily:    "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color:         '#0D1E2E',
      display:       'flex',
      flexDirection: 'column',
    }}>

      {/* Header */}
      <div style={{ background: NAVY, paddingTop: 'max(env(safe-area-inset-top,0px),1rem)', paddingBottom: '1.5rem', paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.5rem' }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:'0.85rem', cursor:'pointer', padding:0 }}>Back</button>
          <div style={{ flex:1, display:'flex', justifyContent:'center' }}><NavLogo height={22} /></div>
          <div style={{ width:32 }}/>
        </div>

        <div style={{ fontSize:'0.62rem', fontWeight:700, color:'rgba(255,255,255,0.4)', letterSpacing:'0.09em', textTransform:'uppercase', marginBottom:'0.4rem' }}>Full Inspection Platform</div>
        <h1 style={{ fontSize:'1.35rem', fontWeight:700, color:'#fff', margin:'0 0 0.35rem', lineHeight:1.2 }}>Start your 30-day free trial</h1>
        <p style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.5)', margin:0, lineHeight:1.65 }}>
          6-phase guided inspection, AI vision analysis, photo documentation, and a 30-page compliance report.
        </p>
      </div>

      {/* Content */}
      <div style={{ flex:1, padding:'1.5rem 1.25rem', display:'flex', flexDirection:'column', gap:'1rem' }}>

        {/* What's included */}
        <div style={{ background:'#fff', border:`1px solid ${BORDER}`, borderRadius:12, padding:'1rem 1.1rem' }}>
          <div style={{ fontSize:'0.68rem', fontWeight:700, color:BLUE, letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:'0.6rem' }}>Included with subscription</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.45rem' }}>
            {[
              '6 OBC inspection phases with hold-point guidance',
              'AI vision analysis for every module',
              'Live camera or photo upload per module',
              'Drawings review with AI field extraction',
              'AI inspection assistant chat',
              '30-page PDF compliance report',
              'Projects saved and resumable across sessions',
              'All building codes: OBC, NBC, IBC, IRC',
            ].map(item => (
              <div key={item} style={{ display:'flex', alignItems:'flex-start', gap:'0.55rem', fontSize:'0.8rem', color:'#3A5A78', lineHeight:1.5 }}>
                <div style={{ width:14, height:14, borderRadius:'50%', background:'rgba(39,169,107,0.15)', border:'1px solid rgba(39,169,107,0.4)', flexShrink:0, marginTop:1 }}/>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Stripe CTA */}
        <div>
          <button
            onClick={handleStripe}
            disabled={stripeLoading}
            style={{ width:'100%', padding:'1.1rem', background: stripeLoading ? 'rgba(242,147,55,0.5)' : `linear-gradient(135deg, ${ORANGE}, #C4721E)`, border:'none', borderRadius:13, color:'#fff', fontSize:'1rem', fontWeight:800, cursor: stripeLoading ? 'default':'pointer', boxShadow:'0 4px 20px rgba(242,147,55,0.4)', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem' }}>
            {stripeLoading ? (
              <>
                <div style={{ width:16, height:16, borderRadius:'50%', border:'2.5px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.7s linear infinite' }}/>
                Opening checkout…
              </>
            ) : (
              <>Subscribe — $38.99 / month</>
            )}
          </button>
          <p style={{ fontSize:'0.68rem', color:'#9DB4C5', textAlign:'center', margin:'0.5rem 0 0', lineHeight:1.5 }}>
            Cancel anytime. Charged automatically every 30 days.
          </p>
        </div>

        {/* Divider */}
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <div style={{ flex:1, height:1, background:BORDER }}/>
          <span style={{ fontSize:'0.72rem', color:'#9DB4C5', flexShrink:0 }}>or use an access code</span>
          <div style={{ flex:1, height:1, background:BORDER }}/>
        </div>

        {/* Access code */}
        <div>
          <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.4rem' }}>Beta access code</div>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <input
              id="beta-code"
              name="beta-code"
              type="text"
              value={accessCode}
              onChange={e => { setAccessCode(e.target.value); setCodeError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') handleCodeSubmit() }}
              placeholder="Enter code"
              style={{ flex:1, padding:'0.75rem 0.9rem', background:'#fff', border:`1.5px solid ${codeError ? RED : accessCode ? BLUE : BORDER}`, borderRadius:10, fontSize:'0.9rem', color:'#0D1E2E', outline:'none', fontFamily:'inherit', transition:'border-color 0.12s' }}
            />
            <button
              onClick={handleCodeSubmit}
              disabled={loading || !accessCode.trim()}
              style={{ padding:'0.75rem 1.1rem', background: accessCode.trim() ? NAVY : 'rgba(44,90,122,0.1)', border:'none', borderRadius:10, color: accessCode.trim() ? '#fff' : '#9DB4C5', fontWeight:700, fontSize:'0.88rem', cursor: accessCode.trim() ? 'pointer':'not-allowed', transition:'all 0.15s', whiteSpace:'nowrap' as const }}>
              {loading ? '…' : 'Apply'}
            </button>
          </div>
          {codeError && (
            <div style={{ fontSize:'0.72rem', color:RED, marginTop:'0.4rem', padding:'0.35rem 0.65rem', background:'rgba(232,69,69,0.06)', borderRadius:6, border:'1px solid rgba(232,69,69,0.2)' }}>
              {codeError}
            </div>
          )}
        </div>

        {/* Free demo note */}
        <div style={{ background:'rgba(65,124,164,0.06)', border:`1px solid rgba(65,124,164,0.2)`, borderRadius:10, padding:'0.8rem 1rem' }}>
          <div style={{ fontSize:'0.75rem', color:'#3A5A78', lineHeight:1.65 }}>
            <strong>Stair Compliance Demo is free</strong> — no subscription required. The demo lets you scan and measure a staircase against OBC, NBC, IBC and more.
          </div>
        </div>

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
