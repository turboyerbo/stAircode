'use client'
/**
 * /unlock — Report unlock page
 *
 * Users land here after clicking "Get Full Report" in their teaser email.
 * URL: /unlock?token=abc123  OR  /unlock?email=x&code=OBC+2024&loc=Toronto
 *
 * Shows:
 *  - Pass/fail summary (loaded from token or URL params)
 *  - Clear $2.99 payment button → Stripe
 *  - After payment → full PDF with photos, analysis, code refs
 *  - Links to find building inspector, architect, contractor
 *  - Links to further reading
 */

import React, { useState, useEffect } from 'react'

const C = {
  bg:     '#0A1C2E',
  bg2:    '#0F2336',
  bg3:    'rgba(65,124,164,0.12)',
  border: 'rgba(65,124,164,0.2)',
  orange: '#F29337',
  green:  '#27A96B',
  red:    '#E84545',
  blue:   '#417CA4',
  text:   '#FFFFFF',
  text2:  'rgba(255,255,255,0.72)',
  text3:  'rgba(255,255,255,0.4)',
}

interface Field {
  label: string
  icon?: string
  value: number | null
  pass: boolean | null
  clearAbove?: boolean
  min?: number
  max?: number
}

export default function UnlockPage() {
  const [fields,    setFields]    = useState<Field[]>([])
  const [codeLabel, setCodeLabel] = useState('Building Code')
  const [location,  setLocation]  = useState('')
  const [email,     setEmail]     = useState('')
  const [loading,   setLoading]   = useState(true)
  const [paying,    setPaying]    = useState(false)
  const [paid,       setPaid]       = useState(false)
  const [downloading,setDownloading] = useState(false)
  const [downloaded, setDownloaded]  = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token  = params.get('token')
    const emailP = params.get('email')
    const codeP  = params.get('code')
    const locP   = params.get('loc')

    // Check if returning from successful Stripe payment
    const isPaymentSuccess = params.get('payment') === 'success'
    if (isPaymentSuccess) setPaid(true)

    // Priority 1: sessionStorage (same device/tab — most common mobile flow)
    const storedFields = (() => { try { return JSON.parse(sessionStorage.getItem('sc_fields') || '[]') } catch { return [] } })()
    const storedCode   = sessionStorage.getItem('sc_code_label') || ''
    const storedLoc    = sessionStorage.getItem('sc_location')   || ''
    const storedEmail  = (() => { try { const u = JSON.parse(localStorage.getItem('sc_user') || '{}'); return u.email || '' } catch { return '' } })()

    if (storedFields.length > 0) {
      setFields(storedFields)
      setCodeLabel(storedCode || codeP || 'Building Code')
      setLocation(storedLoc  || locP  || '')
      setEmail(storedEmail   || emailP || '')
      setLoading(false)
      return
    }

    // Priority 2: token from URL (set by checkout success_url — survives cross-device)
    const urlToken = token || params.get('token')
    if (urlToken) {
      fetch(`/api/report/save?token=${urlToken}`)
        .then(r => r.json())
        .then(d => {
          if (d.ok && d.fields?.length > 0) {
            setFields(d.fields)
            setCodeLabel(d.codeLabel || codeP || 'Building Code')
            setLocation(d.location  || locP  || '')
            setEmail(d.email        || storedEmail || emailP || '')
          } else {
            // Token exists but no data — use URL params as fallback
            setCodeLabel(codeP || 'Building Code')
            setLocation(locP   || '')
            setEmail(storedEmail || emailP || '')
          }
        })
        .catch(() => {
          setCodeLabel(codeP || 'Building Code')
          setLocation(locP   || '')
          setEmail(storedEmail || emailP || '')
        })
        .finally(() => setLoading(false))
      return
    }

    // Priority 3: URL params only (minimal fallback)
    setCodeLabel(codeP || 'Building Code')
    setLocation(locP   || '')
    setEmail(storedEmail || emailP || '')
    setLoading(false)
  }, [])

  const passed  = fields.filter(f => f.pass === true  || f.clearAbove)
  const failed  = fields.filter(f => f.pass === false)
  const overall = fields.length > 0 && failed.length === 0

  async function handlePay() {
    setPaying(true)
    setError('')
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: 'report', userEmail: email }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setError('Payment setup failed — please try again.')
    } catch {
      setError('Could not connect to payment. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: C.text2, fontSize: '0.9rem' }}>Loading your report…</div>
    </div>
  )

  // No scan data available — link was opened on a different device or session expired
  if (fields.length === 0) return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}><div style={{ maxWidth: 380, textAlign: 'center' }}><div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}></div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.6rem' }}>Report link expired or opened on a new device</h2>
        <p style={{ fontSize: '0.88rem', color: C.text2, lineHeight: 1.7, marginBottom: '1.5rem' }}>Report links are tied to your scan session. To get your report, open staircode.app on the same device where you scanned — or run a new scan (it only takes a minute).
        </p>
        <p style={{ fontSize: '0.78rem', color: C.text2, lineHeight: 1.6, marginBottom: '1.5rem' }}>If you think this is an error, email us at{' '}
          <a href="mailto:info@staircode.app" style={{ color: C.orange }}>info@staircode.app</a>
          {email ? ` (include your email: ${email})` : ''} and we&apos;ll help you retrieve it.
        </p>
        <a href="https://staircode.app" style={{ display: 'inline-block', background: C.orange, color: '#000', fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none', padding: '0.85rem 2rem', borderRadius: 12 }}>Start a New Scan →
        </a>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: C.text }}>{/* Safety stripe */}
      <div style={{ height: 4, background: 'repeating-linear-gradient(-45deg,#F29337 0,#F29337 5px,#0A1C2E 5px,#0A1C2E 12px)' }} />

      {/* Header */}
      <div style={{ background: C.bg2, borderBottom: `1px solid ${C.border}`, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><a href="/marketing" style={{ textDecoration: 'none' }}><span style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em' }}>st<span style={{ color: C.orange }}>AI</span>rcode
          </span>
        </a>
        <span style={{ color: C.text3, fontSize: '0.75rem', marginLeft: 'auto' }}>{codeLabel}{location ? ` · ${location}` : ''}
        </span>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>{/* Verdict banner */}
        <div style={{
          background: overall ? 'rgba(39,169,107,0.1)' : 'rgba(232,69,69,0.1)',
          border: `1.5px solid ${overall ? 'rgba(39,169,107,0.4)' : 'rgba(232,69,69,0.4)'}`,
          borderRadius: 16, padding: '1.25rem', textAlign: 'center', marginBottom: '1.5rem',
        }}><div style={{ fontSize: '1.4rem', marginBottom: '0.3rem' }}>{overall ? '' : ''}</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: overall ? C.green : C.red, marginBottom: '0.25rem' }}>{fields.length === 0 ? 'Scan results' : overall ? 'No issues detected' : `${failed.length} item${failed.length > 1 ? 's' : ''} flagged`}
          </div>
          <div style={{ fontSize: '0.8rem', color: C.text2 }}>{passed.length} passed · {failed.length} failed · {fields.length} measured
          </div>
        </div>

        {/* Pass/fail table */}
        {fields.length > 0 && (
          <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: '1.5rem' }}><div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${C.border}`, fontSize: '0.65rem', color: C.orange, fontWeight: 800, letterSpacing: '0.12em' }}>MEASUREMENT SUMMARY
            </div>
            {fields.map((f, i) => {
              const st = f.pass === true || f.clearAbove ? 'PASS'
                       : f.pass === false ? 'FAIL' : 'N/A'
              const col = st === 'PASS' ? C.green : st === 'FAIL' ? C.red : C.text3
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '0.7rem 1rem', borderBottom: i < fields.length - 1 ? `1px solid ${C.border}` : 'none', gap: '0.6rem' }}><span style={{ fontSize: '0.85rem', width: 20 }}>{f.icon || ''}</span>
                  <span style={{ flex: 1, fontSize: '0.82rem', color: C.text }}>{f.label}</span>
                  <span style={{ fontSize: '0.78rem', color: f.pass === false ? 'rgba(255,255,255,0.3)' : C.text2 }}>{f.pass === false ? '████' : f.value != null ? `${f.value}mm` : f.clearAbove ? 'Clear' : '—'}
                  </span>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: col, width: 34, textAlign: 'right' }}>{st}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Failed items urgency */}
        {failed.length > 0 && (
          <div style={{ background: 'rgba(232,69,69,0.07)', border: '1px solid rgba(232,69,69,0.25)', borderRadius: 12, padding: '0.9rem 1rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: C.text2, lineHeight: 1.7 }}><strong style={{ color: C.red }}> {failed.length} item{failed.length > 1 ? 's' : ''} require attention.</strong> Exact measurements, applicable code sections, and recommended remediation are in the full report. A building inspector or contractor will ask for this documentation.
          </div>
        )}

        {/* ── PAYWALL ── */}
        <div style={{ background: C.bg2, border: `1.5px solid rgba(242,147,55,0.4)`, borderRadius: 18, padding: '1.5rem', marginBottom: '1.5rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}><div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>Full compliance report</div>
              <div style={{ fontSize: '0.72rem', color: C.text2 }}>Photos · Code citations · Pre-inspection summary</div>
            </div>
          </div>

          {/* What's included */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>{[
              ' Measurement photographs from every scan',
              ' Full pass/fail analysis with exact values',
              ' Building code citations per dimension',
              ' Occupancy classification & bylaw notes',
              ' Pre-inspection summary for your inspector',
              ' Recommended remediation for failed items',
            ].map(item => (
              <div key={item} style={{ fontSize: '0.78rem', color: C.text2, display: 'flex', gap: '0.5rem' }}><span style={{ flexShrink: 0 }}>{item.split(' ')[0]}</span>
                <span>{item.split(' ').slice(1).join(' ')}</span>
              </div>
            ))}
          </div>

          {/* Beta pricing */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}><span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' }}>$38.99</span>
            <span style={{ fontSize: '1.6rem', fontWeight: 700, color: C.orange }}>$2.99</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: C.green, background: 'rgba(39,169,107,0.12)', border: '1px solid rgba(39,169,107,0.3)', borderRadius: 12, padding: '0.15rem 0.5rem', letterSpacing: '0.06em' }}>BETA DISCOUNT</span>
          </div>

          <button
            onClick={handlePay}
            disabled={paying}
            style={{ width: '100%', padding: '1.1rem', background: paying ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg,${C.orange},#C4721E)`, border: 'none', borderRadius: 13, color: paying ? C.text3 : '#000', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.06em', cursor: paying ? 'wait' : 'pointer', boxShadow: paying ? 'none' : '0 4px 24px rgba(242,147,55,0.4)', marginBottom: '0.65rem' }}
          >
            {paying ? '⏳ Redirecting to checkout…' : 'Pay $2.99 — Unlock Full Report →'}
          </button>

          {error && <div style={{ fontSize: '0.75rem', color: C.red, textAlign: 'center', marginBottom: '0.5rem' }}>{error}</div>}

          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>One-time payment · Secure checkout via Stripe · PDF delivered to your email instantly
          </div>
        </div>

        {/* Find a professional */}
        <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1rem', marginBottom: '1.5rem' }}><div style={{ fontSize: '0.65rem', color: C.orange, fontWeight: 800, letterSpacing: '0.12em', marginBottom: '0.75rem' }}>FIND A PROFESSIONAL</div>
          {[
            { icon: '', label: 'Find a Building Inspector', q: 'building inspector near me' },
            { icon: '', label: 'Find a Licensed Architect',  q: 'licensed architect near me' },
            { icon: '', label: 'Find a Stair Contractor',    q: 'stair renovation contractor near me' },
          ].map(({ icon, label, q }) => (
            <a key={label}
              href={`https://www.google.com/maps/search/${encodeURIComponent(q)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 0.75rem', background: C.bg3, borderRadius: 10, textDecoration: 'none', color: C.text, fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}
            >
              <span>{icon}</span><span style={{ flex: 1 }}>{label}</span><span style={{ fontSize: '0.7rem', color: C.text3 }}>↗ Maps</span>
            </a>
          ))}
        </div>

        {/* Learn more links */}
        <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1rem', marginBottom: '1.5rem' }}><div style={{ fontSize: '0.65rem', color: C.blue, fontWeight: 800, letterSpacing: '0.12em', marginBottom: '0.75rem' }}>LEARN MORE</div>
          {[
            { label: 'Ontario Building Code 2024 — Stair requirements', href: 'https://www.ontario.ca/laws/statute/92b23' },
            { label: 'CMHC — Housing accessibility guidelines', href: 'https://www.cmhc-schl.gc.ca/en/professionals/industry-innovation-and-leadership/industry-expertise/housingresearch' },
            { label: 'CTV News — Stairway safety and homeowner liability', href: 'https://www.ctvnews.ca/ottawa/video/2026/03/02/ask-the-expert-stairway-safety-and-homeowner-liability/' },
            { label: 'Global News — B.C. stairwell safety concerns', href: 'https://globalnews.ca/news/10729529/firefighters-raise-concerns-about-b-c-s-new-single-stairwell-apartment-rules/' },
            { label: 'stAIrcode Research & References', href: '/research' },
          ].map(({ label, href }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(65,124,164,0.1)', textDecoration: 'none', color: C.text2, fontSize: '0.78rem', lineHeight: 1.5 }}
            >
              <span style={{ color: C.orange, flexShrink: 0, marginTop: '0.1rem' }}>→</span>
              <span>{label}</span>
            </a>
          ))}
        </div>

        {/* Scan again */}
        <div style={{ textAlign: 'center' }}><a href="/?signin=1" style={{ fontSize: '0.78rem', color: C.text3, textDecoration: 'none' }}>← Scan different stairs
          </a>
        </div>
      </div>
    </div>
  )
}
