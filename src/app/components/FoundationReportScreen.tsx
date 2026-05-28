'use client'
/**
 * FoundationReportScreen.tsx
 *
 * Displays foundation inspection pass/flag/critical results with:
 *   - Blurred preview paywall identical to ReportScreen
 *   - "Included with subscription Generate Report" CTA
 *   - Free via testimonial OR discount code (betacode67)
 *   - PDF generation → Supabase storage → email delivery
 *   - Stored with module_type='foundation' for future multi-module combining
 */

import { useState, useEffect } from 'react'
import type { FoundationMeasurements } from './FoundationScanScreen'

// ── Palette ────────────────────────────────────────────────────────────────────
const NAVY   = '#0A1C2E'
const GREEN  = '#27A96B'
const AMBER  = '#F29337'
const RED    = '#E84545'
const WHITE  = '#E8F4FF'
const WHITE2 = '#93BAD4'
const BLUE   = '#417CA4'
const BORDER = 'rgba(147,186,212,0.15)'
const GOLD   = '#F5B942'

export interface FoundationField {
  label:    string
  value:    string | number | null
  unit?:    string
  pass:     boolean | null
  note?:    string
  severity: 'info' | 'warning' | 'critical'
}

interface Props {
  measurements: FoundationMeasurements
  fields:       FoundationField[]
  codeLabel:    string
  location:     string
  onStartOver:  () => void
  onRetake:     () => void
}

const WALL_TYPE_LABELS: Record<string, string> = {
  poured_concrete: 'Poured Concrete',
  concrete_block:  'Concrete Block (CMU)',
  stone:           'Stone / Rubble',
  brick:           'Brick Masonry',
  icf:             'Insulated Concrete Form (ICF)',
  unknown:         'Unknown / Not Determined',
}

const CRACK_INFO: Record<string, { label: string; structural: string; severity: 'info' | 'warning' | 'critical' }> = {
  none:       { label: 'None detected',      structural: 'No cracks observed.',                                                                        severity: 'info'     },
  hairline:   { label: 'Hairline',           structural: 'Surface shrinkage. Usually not structurally significant — monitor.',                          severity: 'info'     },
  vertical:   { label: 'Vertical',           structural: 'Thermal/shrinkage movement. Monitor for progression.',                                        severity: 'info'     },
  diagonal:   { label: 'Diagonal',           structural: 'Possible differential settlement. Professional assessment recommended.',                       severity: 'warning'  },
  stair_step: { label: 'Stair-step pattern', structural: 'Differential settlement along mortar joints. Professional assessment required.',               severity: 'warning'  },
  horizontal: { label: 'HORIZONTAL',         structural: 'Lateral earth pressure potentially exceeding wall capacity. STRUCTURAL EMERGENCY — immediate professional assessment required.', severity: 'critical' },
  multiple:   { label: 'Multiple types',     structural: 'Several crack types present. Professional assessment required.',                               severity: 'warning'  },
}

function ResultBadge({ pass, severity }: { pass: boolean | null; severity: 'info' | 'warning' | 'critical' }) {
  if (pass === null) return <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'rgba(147,186,212,0.15)', color: WHITE2, padding: '0.2rem 0.65rem', borderRadius: 6, letterSpacing: '0.08em' }}>N/A</span>
  if (pass) return <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'rgba(39,169,107,0.15)', color: GREEN, padding: '0.2rem 0.65rem', borderRadius: 6, border: '1px solid rgba(39,169,107,0.3)', letterSpacing: '0.08em' }}>PASS</span>
  const bg  = severity === 'critical' ? 'rgba(232,69,69,0.15)'  : 'rgba(250,116,31,0.15)'
  const col = severity === 'critical' ? '#ff7070'                : AMBER
  const bdr = severity === 'critical' ? 'rgba(232,69,69,0.45)'  : 'rgba(250,116,31,0.4)'
  const lbl = severity === 'critical' ? 'CRITICAL'              : 'FLAG'
  return <span style={{ fontSize: '0.65rem', fontWeight: 700, background: bg, color: col, padding: '0.2rem 0.65rem', borderRadius: 6, border: `1px solid ${bdr}`, letterSpacing: '0.08em' }}>{lbl}</span>
}

export default function FoundationReportScreen({ measurements: m, fields, codeLabel, location, onStartOver, onRetake }: Props) {
  const passCount   = fields.filter(f => f.pass === true).length
  const flagCount   = fields.filter(f => f.pass === false).length
  const hasCritical = fields.some(f => f.pass === false && f.severity === 'critical')
  const overallBg   = hasCritical ? 'linear-gradient(135deg,#3a0a0a,#1a0505)' : flagCount > 0 ? 'linear-gradient(135deg,#2a1800,#1a0f00)' : 'linear-gradient(135deg,#0a1a0f,#0a1a2e)'
  const overallColor = hasCritical ? '#ff7070' : flagCount > 0 ? AMBER : GREEN
  const overallLabel = hasCritical ? 'CRITICAL ISSUE' : flagCount > 0 ? 'FLAGS RAISED' : 'NO FLAGS'

  const crackInfo = CRACK_INFO[m.crackType] ?? CRACK_INFO.none
  const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })

  // ── Paywall state ──────────────────────────────────────────────────────────
  type Sheet = 'hidden' | 'paywall' | 'testimonial' | 'generating' | 'done'
  const [sheet,            setSheet]            = useState<Sheet>('hidden')
  const [discountCode,     setDiscountCode]     = useState('')
  const [discountError,    setDiscountError]    = useState<string | null>(null)
  const [discountChecking, setDiscountChecking] = useState(false)
  const [discountApplied,  setDiscountApplied]  = useState(false)
  const [unlockToken,      setUnlockToken]      = useState<string | null>(null)
  const [emailInput,       setEmailInput]       = useState('')
  const [testimText,       setTestimText]       = useState('')
  const [testimSending,    setTestimSending]    = useState(false)
  const [genLoading,       setGenLoading]       = useState(false)
  const [genError,         setGenError]         = useState<string | null>(null)
  const [pdfUrl,           setPdfUrl]           = useState<string | null>(null)
  const [showDisclaimer,   setShowDisclaimer]   = useState(false)

  useEffect(() => {
    try {
      const u = localStorage.getItem('sc_user')
      if (u) { const parsed = JSON.parse(u); if (parsed.email) setEmailInput(parsed.email) }
    } catch {}
  }, [])

  // Persist email
  useEffect(() => {
    if (emailInput && emailInput.includes('@')) {
      try {
        const u = JSON.parse(localStorage.getItem('sc_user') || '{}')
        u.email = emailInput
        localStorage.setItem('sc_user', JSON.stringify(u))
      } catch {}
    }
  }, [emailInput])

  // ── Discount code handler ──────────────────────────────────────────────────
  async function handleApplyDiscount() {
    if (!discountCode.trim()) return
    setDiscountChecking(true); setDiscountError(null)
    try {
      const res  = await fetch('/api/discount/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCode.trim() }),
      })
      const data = await res.json()
      if (data.valid) {
        setDiscountApplied(true)
        setUnlockToken(data.unlockToken ?? 'discount-unlock')
      } else {
        setDiscountError(data.error ?? 'Invalid code. Please try again.')
      }
    } catch { setDiscountError('Could not verify code. Check your connection.') }
    setDiscountChecking(false)
  }

  // ── Testimonial handler ────────────────────────────────────────────────────
  async function handleTestimonialSubmit() {
    if (!testimText.trim() || testimText.trim().length < 20) {
      setDiscountError('Please write at least a sentence about your experience.'); return
    }
    setTestimSending(true); setDiscountError(null)
    try {
      const userEmail = emailInput.trim()
      const res = await fetch('/api/testimonial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text:    testimText.trim(),
          email:   userEmail,
          module:  'foundation',
          context: `Foundation inspection — wall type: ${m.wallTypeLabel ?? m.wallType}, condition: ${m.overallCondition}`,
        }),
      })
      const data = await res.json()
      if (res.ok && data.unlockToken) {
        setUnlockToken(data.unlockToken)
        setSheet('paywall')
      } else {
        setDiscountError(data.error ?? 'Could not submit testimonial. Please try again.')
      }
    } catch { setDiscountError('Could not submit testimonial. Check your connection.') }
    setTestimSending(false)
  }

  // ── Generate report ────────────────────────────────────────────────────────
  async function handleGenerate(isPaid: boolean) {
    const userEmail = emailInput.trim()
    if (!userEmail || !userEmail.includes('@')) {
      setGenError('Please enter your email address so we can send you the report.'); return
    }

    setGenLoading(true); setGenError(null); setSheet('generating')

    try {
      const frames: Record<string, string> = (() => {
        try {
          const raw = sessionStorage.getItem('sc_frames_foundation')
          if (!raw || raw === '{}') return {}
          const parsed = JSON.parse(raw)
          return typeof parsed === 'string' ? JSON.parse(parsed) : parsed
        } catch { return {} }
      })()

      const res = await fetch('/api/report/generate-foundation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:            userEmail,
          measurements:     m,
          fields,
          codeLabel,
          location,
          paid:             isPaid,
          testimonialToken: unlockToken,
          frames,
        }),
      })
      const data = await res.json()

      if (res.ok && data.ok) {
        if (data.pdfUrl) setPdfUrl(data.pdfUrl)
        setSheet('done')
      } else {
        setGenError(data.error ?? 'Report generation failed. Please try again.')
        setSheet('paywall')
      }
    } catch {
      setGenError('Could not generate report. Check your connection and try again.')
      setSheet('paywall')
    }
    setGenLoading(false)
  }

  // ── Stripe checkout ────────────────────────────────────────────────────────
  async function handleStripeCheckout() {
    const userEmail = emailInput.trim()
    if (!userEmail || !userEmail.includes('@')) {
      setGenError('Please enter your email above so we can send you the report.'); return
    }
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product:  'report',
          email:    userEmail,
          module:   'foundation',
          returnTo: '/?module=foundation&payment=success',
        }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setGenError('Could not start checkout. Please try again.')
    } catch { setGenError('Checkout unavailable. Please try again.') }
  }

  // ── Precomputed summary values ─────────────────────────────────────────────
  const summaryItems = [
    { label: 'Wall Type',       value: m.wallTypeLabel ?? m.wallType ?? '—' },
    { label: 'Condition',       value: m.overallCondition ?? '—'            },
    { label: 'Cracks',          value: m.crackPresent ? (m.crackType ?? 'present') : 'none'  },
    { label: 'Moisture',        value: m.moisturePresent ? 'detected' : 'none'               },
  ]

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: '#EBF3FA', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* ── Report Header ── */}
      <div style={{ background: NAVY, padding: 'max(env(safe-area-inset-top,0px),1.5rem) 1.25rem 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: `repeating-linear-gradient(45deg,${BLUE},${BLUE} 10px,${NAVY} 10px,${NAVY} 20px)` }} />
        <div style={{ paddingTop: '0.75rem', paddingBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>STAIRCODE · BETA · FOUNDATION INSPECTION REPORT</div>
          <div style={{ fontSize: 'clamp(1.5rem,5vw,2rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '0.5rem' }}>Foundation<br />Inspection Report</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', marginBottom: '1rem' }}>
            <span>{codeLabel}</span><span>·</span><span>{location || 'Location not set'}</span><span>·</span><span>{today}</span>
          </div>

          {/* Overall badge */}
          <div style={{ background: overallBg, border: `1.5px solid ${overallColor}44`, borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.6rem', color: overallColor, fontWeight: 700, letterSpacing: '0.12em', marginBottom: '0.2rem' }}>OVERALL ASSESSMENT</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: overallColor }}>{overallLabel}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{passCount}<span style={{ fontSize: '0.7rem', color: WHITE2, display: 'block', fontWeight: 400 }}>PASS</span></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: flagCount > 0 ? overallColor : WHITE2, lineHeight: 1 }}>{flagCount}<span style={{ fontSize: '0.7rem', color: WHITE2, display: 'block', fontWeight: 400 }}>FLAG{flagCount !== 1 ? 'S' : ''}</span></div>
            </div>
          </div>

          {/* Wall classification */}
          <div style={{ background: 'rgba(65,124,164,0.12)', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.6rem', color: WHITE2, letterSpacing: '0.1em', marginBottom: '0.3rem' }}>WALL CLASSIFICATION</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: WHITE }}>{WALL_TYPE_LABELS[m.wallType] ?? m.wallTypeLabel ?? m.wallType}</div>
            {m.wallTypeConfidence != null && <div style={{ fontSize: '0.65rem', color: WHITE2, marginTop: '0.2rem' }}>AI confidence: {Math.round(m.wallTypeConfidence * 100)}%</div>}
          </div>
        </div>
      </div>

      {/* ── CRITICAL WARNING ── */}
      {m.horizontalCrack && (
        <div style={{ background: 'rgba(232,69,69,0.12)', border: '2px solid rgba(232,69,69,0.5)', margin: '1rem', borderRadius: 14, padding: '1rem 1.1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ff7070', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>CRITICAL — HORIZONTAL CRACK DETECTED</div>
          <div style={{ fontSize: '0.8rem', color: '#ffaaaa', lineHeight: 1.65 }}>Horizontal cracks in foundation walls indicate that lateral earth pressure may be exceeding the wall&apos;s structural capacity. Engage a licensed structural engineer immediately.</div>
        </div>
      )}

      {/* ── Quick Summary (always visible — not paywalled) ── */}
      <div style={{ padding: '1rem 1rem 0' }}>
        <div style={{ fontSize: '0.65rem', color: BLUE, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.6rem' }}>QUICK SUMMARY</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {summaryItems.map(item => (
            <div key={item.label} style={{ background: '#fff', border: '1px solid rgba(44,90,122,0.12)', borderRadius: 10, padding: '0.6rem 0.8rem' }}>
              <div style={{ fontSize: '0.62rem', color: '#9DB4C5', letterSpacing: '0.08em', marginBottom: '0.15rem' }}>{item.label.toUpperCase()}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0D1E2E', textTransform: 'capitalize' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Blurred preview of detailed results ── */}
      {sheet === 'hidden' && (
        <div style={{ position: 'relative', margin: '1rem', borderRadius: 14, overflow: 'hidden' }}>
          {/* Faked blurred rows */}
          <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none' }}>
            {fields.slice(0, 4).map((f, i) => (
              <div key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F4F7FB', border: '1px solid rgba(44,90,122,0.08)', padding: '0.75rem 0.9rem', display: 'flex', justifyContent: 'space-between', borderRadius: i === 0 ? '12px 12px 0 0' : i === Math.min(3, fields.length - 1) ? '0 0 12px 12px' : 0 }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0D1E2E', marginBottom: '0.15rem' }}>{f.label}</div>
                  {f.note && <div style={{ fontSize: '0.68rem', color: '#5E7D9B' }}>{f.note?.slice(0, 50)}</div>}
                </div>
                <ResultBadge pass={f.pass} severity={f.severity} />
              </div>
            ))}
          </div>
          {/* Gradient overlay + CTA */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,28,46,0.97) 0%, rgba(10,28,46,0.6) 55%, transparent 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', padding: '1.25rem', gap: '0.65rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: WHITE2, marginBottom: '0.35rem' }}>Your full report is ready</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: WHITE, letterSpacing: '-0.02em', lineHeight: 1.25 }}>Unlock with Subscription</div>
              <div style={{ fontSize: '0.68rem', color: WHITE2, marginTop: '0.2rem' }}>Compliance analysis · Crack docs · Code citations · PDF delivered by email</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through' }}>$38.99</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: GOLD }}>Included with subscription</span>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, background: 'rgba(242,147,55,0.2)', color: GOLD, padding: '0.15rem 0.5rem', borderRadius: 4, border: '1px solid rgba(242,147,55,0.3)' }}>BETA</span>
            </div>
            <button
              onClick={() => setSheet('paywall')}
              style={{ width: '100%', padding: '1rem', background: `linear-gradient(135deg,${AMBER},#C4721E)`, border: 'none', borderRadius: 14, color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 24px rgba(242,147,55,0.5)' }}
            >
              Generate Report — Included with subscription →
            </button>
            <button onClick={() => setSheet('testimonial')} style={{ background: 'none', border: 'none', color: WHITE2, fontSize: '0.75rem', cursor: 'pointer' }}>
              or get it free — leave a testimonial →
            </button>
          </div>
        </div>
      )}

      {/* ── Done state ── */}
      {sheet === 'done' && (
        <div style={{ margin: '1rem', background: '#fff', border: '1.5px solid rgba(39,169,107,0.35)', borderRadius: 14, padding: '1.25rem' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: GREEN, marginBottom: '0.35rem' }}>Report sent!</div>
          <div style={{ fontSize: '0.78rem', color: '#5E7D9B', lineHeight: 1.65 }}>
            Your foundation inspection PDF has been emailed to <strong>{emailInput}</strong>. Check your inbox — it may take a few minutes.
          </div>
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.78rem', fontWeight: 700, color: BLUE, textDecoration: 'none' }}>
              Download PDF →
            </a>
          )}
        </div>
      )}

      {/* ── Generating state ── */}
      {sheet === 'generating' && (
        <div style={{ margin: '1rem', background: '#fff', border: '1px solid rgba(44,90,122,0.12)', borderRadius: 14, padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(65,124,164,0.2)', borderTopColor: BLUE, animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0D1E2E' }}>Generating your report…</div>
          <div style={{ fontSize: '0.72rem', color: '#5E7D9B' }}>AI analysis in progress. This takes about 20–30 seconds.</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* ── Full results (shown after unlock) ── */}
      {sheet === 'done' && (
        <>
          <div style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.65rem', color: BLUE, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.75rem' }}>COMPLIANCE CHECK RESULTS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {fields.map((f, i) => (
                <div key={i} style={{ background: '#fff', border: `1px solid ${f.pass === false ? (f.severity === 'critical' ? 'rgba(232,69,69,0.4)' : 'rgba(250,116,31,0.35)') : 'rgba(44,90,122,0.12)'}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(44,74,110,0.06)' }}>
                  <div style={{ padding: '0.7rem 0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0D1E2E', marginBottom: '0.15rem' }}>{f.label}</div>
                      {f.value != null && <div style={{ fontSize: '0.72rem', color: '#5E7D9B' }}>{f.value}{f.unit ? ` ${f.unit}` : ''}</div>}
                      {f.note && <div style={{ fontSize: '0.68rem', color: f.severity === 'critical' ? RED : f.severity === 'warning' ? '#D97B1F' : '#5E7D9B', lineHeight: 1.55, marginTop: '0.2rem' }}>{f.note}</div>}
                    </div>
                    <ResultBadge pass={f.pass} severity={f.severity} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Crack report */}
          <div style={{ padding: '0 1rem 1rem' }}>
            <div style={{ fontSize: '0.65rem', color: BLUE, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.75rem' }}>CRACK DOCUMENTATION</div>
            <div style={{ background: '#fff', border: `1px solid ${crackInfo.severity === 'critical' ? 'rgba(232,69,69,0.4)' : crackInfo.severity === 'warning' ? 'rgba(250,116,31,0.3)' : 'rgba(44,90,122,0.12)'}`, borderRadius: 12, padding: '0.9rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0D1E2E' }}>{m.crackPresent ? `Crack Type: ${crackInfo.label}` : 'No Cracks Detected'}</div>
                {m.crackPresent && <span style={{ fontSize: '0.65rem', fontWeight: 700, background: crackInfo.severity === 'critical' ? 'rgba(232,69,69,0.12)' : crackInfo.severity === 'warning' ? 'rgba(250,116,31,0.12)' : 'rgba(39,169,107,0.12)', color: crackInfo.severity === 'critical' ? RED : crackInfo.severity === 'warning' ? '#D97B1F' : GREEN, padding: '0.2rem 0.65rem', borderRadius: 6, border: `1px solid ${crackInfo.severity === 'critical' ? 'rgba(232,69,69,0.35)' : crackInfo.severity === 'warning' ? 'rgba(250,116,31,0.3)' : 'rgba(39,169,107,0.3)'}`, letterSpacing: '0.08em', textTransform: 'uppercase' as const, flexShrink: 0 }}>{crackInfo.severity}</span>}
              </div>
              {m.crackPresent && (
                <>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                    {m.crackWidthMm != null && <div style={{ fontSize: '0.75rem', color: '#5E7D9B' }}>Width: <strong style={{ color: '#0D1E2E' }}>{m.crackWidthMm}mm</strong></div>}
                    {m.crackLengthMm != null && <div style={{ fontSize: '0.75rem', color: '#5E7D9B' }}>Length: <strong style={{ color: '#0D1E2E' }}>~{m.crackLengthMm}mm</strong></div>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: crackInfo.severity === 'critical' ? '#C0392B' : '#5E7D9B', lineHeight: 1.65, borderLeft: `3px solid ${crackInfo.severity === 'critical' ? RED : crackInfo.severity === 'warning' ? AMBER : GREEN}`, paddingLeft: '0.65rem' }}>{crackInfo.structural}</div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Disclaimer ── */}
      <div style={{ padding: '0 1rem 1rem' }}>
        <button onClick={() => setShowDisclaimer(v => !v)} style={{ width: '100%', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '0.6rem 1rem', color: '#9DB4C5', fontSize: '0.72rem', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
          <span>Disclaimer & Limitations</span><span>{showDisclaimer ? '−' : '+'}</span>
        </button>
        {showDisclaimer && (
          <div style={{ background: '#fff', border: '1px solid rgba(44,90,122,0.1)', borderRadius: 10, padding: '0.9rem 1rem', marginTop: '0.35rem', fontSize: '0.72rem', color: '#5E7D9B', lineHeight: 1.7 }}>
            AI-assisted visual screening only. All measurements are estimates from camera images with typical accuracy of ±15–40mm. Foundation assessments require physical access, probing, and professional engineering judgment. This report does not substitute for inspection by a licensed structural engineer, geotechnical engineer, or certified home inspector.
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ padding: '0 1rem', paddingBottom: 'max(env(safe-area-inset-bottom,0px),1.5rem)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <button onClick={onRetake} style={{ width: '100%', padding: '1rem', background: `linear-gradient(135deg,#27A96B,#1A7A50)`, border: 'none', borderRadius: 14, color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 18px rgba(39,169,107,0.38)' }}>
          ↺ Rescan Foundation
        </button>
        <button onClick={onStartOver} style={{ width: '100%', padding: '0.85rem', background: 'rgba(65,124,164,0.1)', border: '1px solid rgba(65,124,164,0.25)', borderRadius: 14, color: BLUE, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
          ← Module Select
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAYWALL SHEET
      ═══════════════════════════════════════════════════════════════════════ */}
      {(sheet === 'paywall' || sheet === 'generating') && (
        <>
          <div onClick={() => { if (sheet !== 'generating') setSheet('hidden') }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 90 }} />
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, zIndex: 100, background: '#0F2438', borderRadius: '22px 22px 0 0', padding: '1.25rem 1.25rem 3rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', boxShadow: '0 -8px 40px rgba(0,0,0,0.7)', maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(147,186,212,0.25)', alignSelf: 'center', marginBottom: '0.1rem' }} />

            {/* Header */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: WHITE2, marginBottom: '0.3rem' }}>Your full report is ready</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: WHITE, letterSpacing: '-0.02em', lineHeight: 1.25 }}>Unlock with Subscription</div>
              <div style={{ fontSize: '0.68rem', color: WHITE2, marginTop: '0.2rem' }}>Code citations · Crack analysis · Moisture docs · PDF by email</div>
            </div>

            {/* Price */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' }}>$38.99</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: GOLD }}>Included with subscription</span>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, background: 'rgba(242,147,55,0.2)', color: GOLD, padding: '0.15rem 0.5rem', borderRadius: 4, border: '1px solid rgba(242,147,55,0.3)' }}>BETA</span>
            </div>

            {/* Email input */}
            <div>
              <div style={{ fontSize: '0.7rem', color: WHITE2, marginBottom: '0.3rem' }}>Send report to</div>
              <input
                type="email" inputMode="email" placeholder="your@email.com"
                value={emailInput} onChange={e => setEmailInput(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 0.9rem', background: 'rgba(255,255,255,0.06)', border: `1px solid ${emailInput.includes('@') ? 'rgba(39,169,107,0.45)' : BORDER}`, borderRadius: 10, color: WHITE, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' as const }}
              />
            </div>

            {/* Discount code */}
            {!discountApplied && !unlockToken ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ fontSize: '0.7rem', color: WHITE2, textAlign: 'center' }}>Have a discount code?</div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    type="text" placeholder="Enter code"
                    value={discountCode} onChange={e => { setDiscountCode(e.target.value); setDiscountError(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') handleApplyDiscount() }}
                    style={{ flex: 1, padding: '0.7rem 0.9rem', background: 'rgba(255,255,255,0.06)', border: `1px solid ${discountCode ? 'rgba(147,186,212,0.45)' : BORDER}`, borderRadius: 10, color: WHITE, fontSize: '0.88rem', outline: 'none', letterSpacing: '0.04em' }}
                  />
                  <button onClick={handleApplyDiscount} disabled={discountChecking || !discountCode.trim()}
                    style={{ padding: '0.7rem 1rem', background: discountCode.trim() ? 'rgba(242,147,55,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${discountCode.trim() ? 'rgba(242,147,55,0.4)' : BORDER}`, borderRadius: 10, color: discountCode.trim() ? GOLD : WHITE2, fontSize: '0.8rem', fontWeight: 700, cursor: discountCode.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                    {discountChecking ? '…' : 'Apply →'}
                  </button>
                </div>
                {discountError && <div style={{ fontSize: '0.73rem', color: '#E85555', padding: '0.4rem 0.65rem', background: 'rgba(232,85,85,0.08)', borderRadius: 8, border: '1px solid rgba(232,85,85,0.2)' }}>{discountError}</div>}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.9rem', background: 'rgba(39,169,107,0.1)', border: '1px solid rgba(39,169,107,0.3)', borderRadius: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN }} />
                <span style={{ fontSize: '0.78rem', color: GREEN, fontWeight: 700 }}>Code applied — report is free</span>
              </div>
            )}

            {/* Generate / Checkout CTA */}
            {unlockToken ? (
              <button
                onClick={() => handleGenerate(false)}
                disabled={genLoading}
                style={{ width: '100%', padding: '1.1rem', background: `linear-gradient(135deg,${GREEN},#1A7A50)`, border: 'none', borderRadius: 14, color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 24px rgba(39,169,107,0.45)', opacity: genLoading ? 0.7 : 1 }}>
                {genLoading ? 'Generating…' : 'Generate Foundation Report — Free →'}
              </button>
            ) : (
              <button
                onClick={handleStripeCheckout}
                style={{ width: '100%', padding: '1.1rem', background: `linear-gradient(135deg,${AMBER},#C4721E)`, border: 'none', borderRadius: 14, color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 24px rgba(242,147,55,0.5)' }}>
                Unlock Full Report — Included with subscription →
              </button>
            )}

            {genError && <div style={{ fontSize: '0.75rem', color: '#E85555', textAlign: 'center', padding: '0.35rem 0' }}>{genError}</div>}

            {/* Free via testimonial link */}
            {!unlockToken && (
              <button onClick={() => setSheet('testimonial')} style={{ background: 'none', border: 'none', color: WHITE2, fontSize: '0.75rem', cursor: 'pointer', lineHeight: 1.5, textAlign: 'center' }}>
                or leave a testimonial to get it free →
              </button>
            )}

            <button onClick={() => setSheet('hidden')} style={{ background: 'none', border: 'none', color: 'rgba(147,186,212,0.5)', fontSize: '0.68rem', cursor: 'pointer', alignSelf: 'center' }}>← Back to summary</button>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TESTIMONIAL SHEET
      ═══════════════════════════════════════════════════════════════════════ */}
      {sheet === 'testimonial' && (
        <>
          <div onClick={() => setSheet('paywall')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 90 }} />
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, zIndex: 100, background: '#0F2438', borderRadius: '22px 22px 0 0', padding: '1.25rem 1.25rem 3rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', boxShadow: '0 -8px 40px rgba(0,0,0,0.7)', maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(147,186,212,0.25)', alignSelf: 'center', marginBottom: '0.1rem' }} />

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: WHITE, marginBottom: '0.3rem' }}>Get your report free</div>
              <div style={{ fontSize: '0.78rem', color: WHITE2, lineHeight: 1.6 }}>Leave a short testimonial about your experience with stAIrcode and we&apos;ll unlock your full report for free.</div>
            </div>

            <input
              type="email" inputMode="email" placeholder="your@email.com (for delivery)"
              value={emailInput} onChange={e => setEmailInput(e.target.value)}
              style={{ width: '100%', padding: '0.75rem 0.9rem', background: 'rgba(255,255,255,0.06)', border: `1px solid ${emailInput.includes('@') ? 'rgba(39,169,107,0.45)' : BORDER}`, borderRadius: 10, color: WHITE, fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' as const }}
            />

            <textarea
              placeholder="Tell us what you think — what you found useful, what could be better, how it compared to your expectations..."
              value={testimText} onChange={e => { setTestimText(e.target.value); setDiscountError(null) }}
              rows={5}
              style={{ width: '100%', padding: '0.8rem 0.9rem', background: 'rgba(255,255,255,0.06)', border: `1px solid ${testimText.length >= 20 ? 'rgba(39,169,107,0.45)' : BORDER}`, borderRadius: 10, color: WHITE, fontSize: '0.88rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box' as const, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", lineHeight: 1.55 }}
            />

            {discountError && <div style={{ fontSize: '0.73rem', color: '#E85555', padding: '0.4rem 0.65rem', background: 'rgba(232,85,85,0.08)', borderRadius: 8, border: '1px solid rgba(232,85,85,0.2)' }}>{discountError}</div>}

            <button
              onClick={handleTestimonialSubmit}
              disabled={testimSending || testimText.trim().length < 20 || !emailInput.includes('@')}
              style={{ width: '100%', padding: '1rem', background: testimText.trim().length >= 20 && emailInput.includes('@') ? `linear-gradient(135deg,${GREEN},#1A7A50)` : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 14, color: testimText.trim().length >= 20 && emailInput.includes('@') ? '#fff' : WHITE2, fontSize: '0.88rem', fontWeight: 700, cursor: testimText.trim().length >= 20 && emailInput.includes('@') ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
              {testimSending ? 'Submitting…' : 'Submit Testimonial & Unlock Report →'}
            </button>

            <button onClick={() => setSheet('paywall')} style={{ background: 'none', border: 'none', color: 'rgba(147,186,212,0.5)', fontSize: '0.68rem', cursor: 'pointer', alignSelf: 'center' }}>← Back</button>
          </div>
        </>
      )}
    </div>
  )
}
