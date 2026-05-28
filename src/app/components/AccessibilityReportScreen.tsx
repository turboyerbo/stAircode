'use client'
/**
 * AccessibilityReportScreen.tsx — Accessibility Compliance Report
 *
 * Paywall: Included with subscription via Stripe OR free via extended testimonial
 * Extended testimonial requires: name, email, phone, company, title, 50+ char comment
 *
 * Stores report with module_type = 'accessibility' for multi-module combining.
 */

import { useState, useEffect } from 'react'
import type { AccessibilityMeasurements } from './AccessibilityScanScreen'
import { CATEGORY_META, OBC_ACCESS }       from './AccessibilityScanScreen'

const NAVY   = '#0A1C2E'
const PURPLE = '#7B5EA7'
const GREEN  = '#27A96B'
const AMBER  = '#F29337'
const RED    = '#E84545'
const WHITE  = '#E8F4FF'
const WHITE2 = '#93BAD4'
const BLUE   = '#417CA4'
const BORDER = 'rgba(147,186,212,0.15)'
const GOLD   = '#F5B942'

export interface AccessibilityField {
  label:    string
  measured: number | string | null
  required: number | string | null
  pass:     boolean | null
  note?:    string
  severity: 'info' | 'warning' | 'critical'
  obcRef?:  string
}

interface Props {
  measurements: AccessibilityMeasurements
  fields:       AccessibilityField[]
  codeLabel:    string
  location:     string
  onStartOver:  () => void
  onRetake:     () => void
}

function ResultBadge({ pass, severity }: { pass: boolean | null; severity: string }) {
  if (pass === null) return <span style={{ fontSize:'0.65rem', fontWeight:700, background:'rgba(147,186,212,0.15)', color:WHITE2, padding:'0.2rem 0.65rem', borderRadius:6, letterSpacing:'0.08em' }}>N/A</span>
  if (pass) return <span style={{ fontSize:'0.65rem', fontWeight:700, background:'rgba(39,169,107,0.15)', color:GREEN, padding:'0.2rem 0.65rem', borderRadius:6, border:'1px solid rgba(39,169,107,0.3)', letterSpacing:'0.08em' }}>PASS</span>
  const isCrit = severity === 'critical'
  return <span style={{ fontSize:'0.65rem', fontWeight:700, background:isCrit?'rgba(232,69,69,0.15)':'rgba(250,116,31,0.15)', color:isCrit?'#ff7070':AMBER, padding:'0.2rem 0.65rem', borderRadius:6, border:`1px solid ${isCrit?'rgba(232,69,69,0.45)':'rgba(250,116,31,0.4)'}`, letterSpacing:'0.08em' }}>{isCrit?'CRITICAL':'FLAG'}</span>
}

export default function AccessibilityReportScreen({ measurements: m, fields, codeLabel, location, onStartOver, onRetake }: Props) {
  const passCount   = fields.filter(f => f.pass === true).length
  const flagCount   = fields.filter(f => f.pass === false).length
  const hasCritical = fields.some(f => f.pass === false && f.severity === 'critical')
  const categoryMeta = CATEGORY_META[m.category]
  const today = new Date().toLocaleDateString('en-CA', { year:'numeric', month:'long', day:'numeric' })

  // ── Paywall state ──────────────────────────────────────────────────────────
  type Sheet = 'hidden' | 'paywall' | 'testimonial' | 'generating' | 'done'
  const [sheet,            setSheet]            = useState<Sheet>('hidden')
  const [discountCode,     setDiscountCode]     = useState('')
  const [discountError,    setDiscountError]    = useState<string | null>(null)
  const [discountChecking, setDiscountChecking] = useState(false)
  const [discountApplied,  setDiscountApplied]  = useState(false)
  const [unlockToken,      setUnlockToken]      = useState<string | null>(null)
  const [genLoading,       setGenLoading]       = useState(false)
  const [genError,         setGenError]         = useState<string | null>(null)
  const [pdfUrl,           setPdfUrl]           = useState<string | null>(null)
  const [showDisclaimer,   setShowDisclaimer]   = useState(false)

  // ── Extended testimonial state ─────────────────────────────────────────────
  const [tName,    setTName]    = useState('')
  const [tEmail,   setTEmail]   = useState('')
  const [tPhone,   setTPhone]   = useState('')
  const [tCompany, setTCompany] = useState('')
  const [tTitle,   setTTitle]   = useState('')
  const [tComment, setTComment] = useState('')
  const [tSending, setTSending] = useState(false)
  const [tError,   setTError]   = useState<string | null>(null)

  // ── Load stored email ──────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const u = localStorage.getItem('sc_user')
      if (u) { const p = JSON.parse(u); if (p.email) setTEmail(p.email); if (p.name) setTName(p.name) }
    } catch {}
  }, [])

  // ── Derived testimonial validity ───────────────────────────────────────────
  const testimValid = tName.trim().length >= 2
    && tEmail.includes('@')
    && tPhone.replace(/\D/g,'').length >= 10
    && tCompany.trim().length >= 2
    && tTitle.trim().length >= 2
    && tComment.trim().length >= 50

  // ── Discount code handler ──────────────────────────────────────────────────
  async function handleApplyDiscount() {
    if (!discountCode.trim()) return
    setDiscountChecking(true); setDiscountError(null)
    try {
      const res  = await fetch('/api/discount/verify', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ code:discountCode.trim() }) })
      const data = await res.json()
      if (data.valid) { setDiscountApplied(true); setUnlockToken(data.unlockToken ?? 'discount-unlock') }
      else setDiscountError(data.error ?? 'Invalid code.')
    } catch { setDiscountError('Could not verify code.') }
    setDiscountChecking(false)
  }

  // ── Extended testimonial submit ────────────────────────────────────────────
  async function handleTestimonialSubmit() {
    setTSending(true); setTError(null)
    try {
      const res = await fetch('/api/testimonial', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          text:    tComment.trim(),
          email:   tEmail.trim(),
          name:    tName.trim(),
          phone:   tPhone.trim(),
          company: tCompany.trim(),
          title:   tTitle.trim(),
          module:  'accessibility',
          context: `Accessibility — ${categoryMeta.label}, ${codeLabel}, ${location}`,
        }),
      })
      const data = await res.json()
      if (res.ok && data.unlockToken) { setUnlockToken(data.unlockToken); setSheet('paywall') }
      else setTError(data.error ?? 'Could not submit testimonial. Please try again.')
    } catch { setTError('Could not submit. Check your connection.') }
    setTSending(false)
  }

  // ── Generate report ────────────────────────────────────────────────────────
  async function handleGenerate(isPaid: boolean) {
    const userEmail = tEmail.trim()
    if (!userEmail || !userEmail.includes('@')) { setGenError('Please enter your email so we can send you the report.'); return }
    setGenLoading(true); setGenError(null); setSheet('generating')
    try {
      const frames: Record<string,string> = (() => {
        try { const r = sessionStorage.getItem('sc_frames_accessibility'); return r ? JSON.parse(r) : {} } catch { return {} }
      })()
      const res = await fetch('/api/report/generate-accessibility', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email:userEmail, measurements:m, fields, codeLabel, location, paid:isPaid, testimonialToken:unlockToken, frames }),
      })
      const data = await res.json()
      if (res.ok && data.ok) { if (data.pdfUrl) setPdfUrl(data.pdfUrl); setSheet('done') }
      else { setGenError(data.error ?? 'Report generation failed.'); setSheet('paywall') }
    } catch { setGenError('Could not generate report. Check your connection.'); setSheet('paywall') }
    setGenLoading(false)
  }

  // ── Stripe checkout ────────────────────────────────────────────────────────
  async function handleStripeCheckout() {
    const userEmail = tEmail.trim()
    if (!userEmail || !userEmail.includes('@')) { setGenError('Please enter your email above.'); return }
    try {
      const res = await fetch('/api/stripe/checkout', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ product:'subscription', email:userEmail, module:'accessibility', returnTo:'/?module=accessibility&payment=success' }) })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setGenError('Could not start checkout. Please try again.')
    } catch { setGenError('Checkout unavailable.') }
  }

  // ── Summary items (always visible, not paywalled) ─────────────────────────
  const summaryItems = [
    { label:'Category',     value: categoryMeta.label },
    { label:'OBC Ref',      value: categoryMeta.obcRef.split('–')[0].trim() },
    { label:'Checks Run',   value: `${fields.length}` },
    { label:'Pass / Flag',  value: `${passCount} / ${flagCount}` },
  ]

  const overallColor = hasCritical ? '#ff7070' : flagCount > 0 ? AMBER : GREEN
  const overallLabel = hasCritical ? 'CRITICAL ISSUE' : flagCount > 0 ? 'FLAGS RAISED' : 'NO FLAGS'

  return (
    <div style={{ minHeight:'100dvh', background:'#EBF3FA', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ background:NAVY, padding:'max(env(safe-area-inset-top,0px),1.5rem) 1.25rem 0', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:6, background:`repeating-linear-gradient(45deg,${PURPLE},${PURPLE} 10px,${NAVY} 10px,${NAVY} 20px)` }} />
        <div style={{ paddingTop:'0.75rem', paddingBottom:'1.25rem' }}>
          <div style={{ fontSize:'0.55rem', color:'rgba(255,255,255,0.4)', letterSpacing: '0.04em', marginBottom:'0.4rem' }}>STAIRCODE · BETA · ACCESSIBILITY COMPLIANCE REPORT</div>
          <div style={{ fontSize:'clamp(1.4rem,5vw,1.9rem)', fontWeight: 700, color:'#fff', letterSpacing:'-0.03em', lineHeight:1.1, marginBottom:'0.4rem' }}>Accessibility<br />Compliance Report</div>
          <div style={{ display:'inline-flex', alignItems:'center', padding:'0.2rem 0.75rem', background:`${PURPLE}33`, border:`1px solid ${PURPLE}55`, borderRadius:999, marginBottom:'0.6rem' }}>
            <span style={{ fontSize:'0.68rem', fontWeight:700, color:PURPLE, letterSpacing:'0.08em' }}>{categoryMeta.label}</span>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem', fontSize:'0.72rem', color:'rgba(255,255,255,0.55)', marginBottom:'1rem' }}>
            <span>{codeLabel}</span><span>·</span><span>{location || 'Location not set'}</span><span>·</span><span>{today}</span>
          </div>

          {/* Overall badge */}
          <div style={{ background:hasCritical?'linear-gradient(135deg,#3a0a0a,#1a0505)':flagCount>0?'linear-gradient(135deg,#2a1800,#1a0f00)':'linear-gradient(135deg,#0a1a0f,#0a1a2e)', border:`1.5px solid ${overallColor}44`, borderRadius:12, padding:'1rem 1.25rem', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
            <div>
              <div style={{ fontSize:'0.6rem', color:overallColor, fontWeight:700, letterSpacing:'0.12em', marginBottom:'0.2rem' }}>OVERALL ASSESSMENT</div>
              <div style={{ fontSize:'1.3rem', fontWeight: 700, color:overallColor }}>{overallLabel}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:'1.5rem', fontWeight: 700, color:'#fff', lineHeight:1 }}>{passCount}<span style={{ fontSize:'0.7rem', color:WHITE2, display:'block', fontWeight:400 }}>PASS</span></div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:'1.5rem', fontWeight: 700, color:flagCount>0?overallColor:WHITE2, lineHeight:1 }}>{flagCount}<span style={{ fontSize:'0.7rem', color:WHITE2, display:'block', fontWeight:400 }}>FLAG{flagCount!==1?'S':''}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick summary (always visible) ── */}
      <div style={{ padding:'1rem 1rem 0' }}>
        <div style={{ fontSize:'0.65rem', color:PURPLE, fontWeight:700, letterSpacing:'0.1em', marginBottom:'0.6rem' }}>INSPECTION SUMMARY</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem', marginBottom:'0.5rem' }}>
          {summaryItems.map(item => (
            <div key={item.label} style={{ background:'#fff', border:'1px solid rgba(44,90,122,0.12)', borderRadius:10, padding:'0.6rem 0.8rem' }}>
              <div style={{ fontSize:'0.62rem', color:'#9DB4C5', letterSpacing:'0.08em', marginBottom:'0.15rem' }}>{item.label.toUpperCase()}</div>
              <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#0D1E2E' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Blurred preview ── */}
      {sheet === 'hidden' && (
        <div style={{ position:'relative', margin:'1rem', borderRadius:14, overflow:'hidden' }}>
          <div style={{ filter:'blur(4px)', pointerEvents:'none', userSelect:'none' as const }}>
            {fields.slice(0,4).map((f,i) => (
              <div key={i} style={{ background:i%2===0?'#fff':'#F4F7FB', border:'1px solid rgba(44,90,122,0.08)', padding:'0.75rem 0.9rem', display:'flex', justifyContent:'space-between', borderRadius:i===0?'12px 12px 0 0':i===3?'0 0 12px 12px':0 }}>
                <div>
                  <div style={{ fontSize:'0.8rem', fontWeight:700, color:'#0D1E2E', marginBottom:'0.1rem' }}>{f.label}</div>
                  {f.measured != null && <div style={{ fontSize:'0.72rem', color:'#5E7D9B' }}>{f.measured}{typeof f.measured==='number'?' mm':''}</div>}
                </div>
                <ResultBadge pass={f.pass} severity={f.severity} />
              </div>
            ))}
          </div>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(10,28,46,0.97) 0%,rgba(10,28,46,0.6) 55%,transparent 100%)', display:'flex', flexDirection:'column', justifyContent:'flex-end', alignItems:'center', padding:'1.25rem', gap:'0.65rem' }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'0.72rem', color:WHITE2, marginBottom:'0.35rem' }}>Your full accessibility report is ready</div>
              <div style={{ fontSize:'1rem', fontWeight: 700, color:WHITE, letterSpacing:'-0.02em', lineHeight:1.25 }}>Unlock with Subscription</div>
              <div style={{ fontSize:'0.68rem', color:WHITE2, marginTop:'0.2rem' }}>OBC citations · Compliance table · Recommendations · PDF by email</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <span style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.35)', textDecoration:'line-through' }}>$38.99</span>
              <span style={{ fontSize:'1.4rem', fontWeight: 700, color:GOLD }}>Included with subscription</span>
              <span style={{ fontSize:'0.6rem', fontWeight:800, background:'rgba(242,147,55,0.2)', color:GOLD, padding:'0.15rem 0.5rem', borderRadius:4, border:'1px solid rgba(242,147,55,0.3)' }}>BETA</span>
            </div>
            <button onClick={() => setSheet('paywall')}
              style={{ width:'100%', padding:'1rem', background:`linear-gradient(135deg,${AMBER},#C4721E)`, border:'none', borderRadius:14, color:'#fff', fontSize:'0.95rem', fontWeight: 700, cursor:'pointer', boxShadow:'0 6px 24px rgba(242,147,55,0.5)' }}>
              Generate Report — Included with subscription →
            </button>
            <button onClick={() => setSheet('testimonial')} style={{ background:'none', border:'none', color:WHITE2, fontSize:'0.75rem', cursor:'pointer' }}>
              or get it free — leave a testimonial →
            </button>
          </div>
        </div>
      )}

      {/* ── Done state ── */}
      {sheet === 'done' && (
        <div style={{ margin:'1rem', background:'#fff', border:'1.5px solid rgba(39,169,107,0.35)', borderRadius:14, padding:'1.25rem' }}>
          <div style={{ fontSize:'0.88rem', fontWeight:800, color:GREEN, marginBottom:'0.35rem' }}>Report sent!</div>
          <div style={{ fontSize:'0.78rem', color:'#5E7D9B', lineHeight:1.65 }}>Your accessibility compliance PDF has been sent to <strong>{tEmail}</strong>. Check your inbox.</div>
          {pdfUrl && <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ display:'inline-block', marginTop:'0.75rem', fontSize:'0.78rem', fontWeight:700, color:BLUE, textDecoration:'none' }}>Download PDF →</a>}
        </div>
      )}

      {/* ── Full results (after unlock) ── */}
      {sheet === 'done' && (
        <div style={{ padding:'1rem' }}>
          <div style={{ fontSize:'0.65rem', color:PURPLE, fontWeight:700, letterSpacing:'0.1em', marginBottom:'0.75rem' }}>COMPLIANCE CHECK RESULTS</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
            {fields.map((f,i) => (
              <div key={i} style={{ background:'#fff', border:`1px solid ${f.pass===false?(f.severity==='critical'?'rgba(232,69,69,0.4)':'rgba(250,116,31,0.35)'):'rgba(44,90,122,0.12)'}`, borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px rgba(44,74,110,0.06)' }}>
                <div style={{ padding:'0.7rem 0.9rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'0.8rem', fontWeight:700, color:'#0D1E2E', marginBottom:'0.15rem' }}>{f.label}</div>
                    {f.measured != null && <div style={{ fontSize:'0.72rem', color:'#5E7D9B' }}>Measured: {f.measured}{typeof f.measured==='number'?' mm':''}{f.required?` — Required: ${f.required}${typeof f.required==='number'?' mm':''}`:''}</div>}
                    {f.note && <div style={{ fontSize:'0.68rem', color:f.severity==='critical'?RED:f.severity==='warning'?'#D97B1F':'#5E7D9B', lineHeight:1.55, marginTop:'0.2rem' }}>{f.note}</div>}
                    {f.obcRef && <div style={{ fontSize:'0.62rem', color:'#9DB4C5', marginTop:'0.15rem' }}>{f.obcRef}</div>}
                  </div>
                  <ResultBadge pass={f.pass} severity={f.severity} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Generating state ── */}
      {sheet === 'generating' && (
        <div style={{ margin:'1rem', background:'#fff', border:'1px solid rgba(44,90,122,0.12)', borderRadius:14, padding:'1.5rem', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem' }}>
          <div style={{ width:36, height:36, borderRadius:'50%', border:`3px solid rgba(123,94,167,0.2)`, borderTopColor:PURPLE, animation:'spin 0.8s linear infinite' }} />
          <div style={{ fontSize:'0.88rem', fontWeight:700, color:'#0D1E2E' }}>Generating your accessibility report…</div>
          <div style={{ fontSize:'0.72rem', color:'#5E7D9B' }}>AI analysis in progress — about 20–30 seconds.</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* ── Disclaimer ── */}
      <div style={{ padding:'0 1rem 1rem' }}>
        <button onClick={() => setShowDisclaimer(v => !v)} style={{ width:'100%', background:'none', border:`1px solid ${BORDER}`, borderRadius:10, padding:'0.6rem 1rem', color:'#9DB4C5', fontSize:'0.72rem', cursor:'pointer', textAlign:'left' as const, display:'flex', justifyContent:'space-between' }}>
          <span>Disclaimer & Limitations</span><span>{showDisclaimer?'−':'+'}</span>
        </button>
        {showDisclaimer && (
          <div style={{ background:'#fff', border:'1px solid rgba(44,90,122,0.1)', borderRadius:10, padding:'0.9rem 1rem', marginTop:'0.35rem', fontSize:'0.72rem', color:'#5E7D9B', lineHeight:1.7 }}>
            AI-assisted visual compliance screening only. All measurements are estimates from camera images with typical accuracy of ±15–25mm. Accessibility assessments require physical measurement and professional review. This report does not substitute for inspection by a licensed architect, engineer, or certified accessibility consultant. Always confirm with the Authority Having Jurisdiction (AHJ) before construction, renovation, or occupancy decisions.
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ padding:'0 1rem', paddingBottom:'max(env(safe-area-inset-bottom,0px),1.5rem)', display:'flex', flexDirection:'column', gap:'0.6rem' }}>
        <button onClick={onRetake} style={{ width:'100%', padding:'1rem', background:`linear-gradient(135deg,${GREEN},#1A7A50)`, border:'none', borderRadius:14, color:'#fff', fontSize:'0.9rem', fontWeight: 700, cursor:'pointer', boxShadow:'0 4px 18px rgba(39,169,107,0.38)' }}>
          ↺ Rescan / Change Category
        </button>
        <button onClick={onStartOver} style={{ width:'100%', padding:'0.85rem', background:'rgba(123,94,167,0.1)', border:'1px solid rgba(123,94,167,0.25)', borderRadius:14, color:PURPLE, fontSize:'0.82rem', fontWeight:700, cursor:'pointer' }}>
          ← Module Select
        </button>
      </div>

      {/* ═══════ PAYWALL SHEET ═══════ */}
      {(sheet === 'paywall' || sheet === 'generating') && (
        <>
          <div onClick={() => { if (sheet !== 'generating') setSheet('hidden') }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', zIndex:90 }} />
          <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:430, zIndex:100, background:'#0F2438', borderRadius:'22px 22px 0 0', padding:'1.25rem 1.25rem 3rem', display:'flex', flexDirection:'column', gap:'0.85rem', boxShadow:'0 -8px 40px rgba(0,0,0,0.7)', maxHeight:'90dvh', overflowY:'auto' }}>
            <div style={{ width:36, height:4, borderRadius:2, background:'rgba(147,186,212,0.25)', alignSelf:'center', marginBottom:'0.1rem' }} />
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'0.72rem', color:WHITE2, marginBottom:'0.3rem' }}>Your accessibility report is ready</div>
              <div style={{ fontSize:'1.05rem', fontWeight: 700, color:WHITE, letterSpacing:'-0.02em', lineHeight:1.25 }}>Unlock with Subscription</div>
              <div style={{ fontSize:'0.68rem', color:WHITE2, marginTop:'0.2rem' }}>OBC citations · Compliance table · Recommendations · PDF by email</div>
            </div>
            <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'0.6rem' }}>
              <span style={{ fontSize:'0.9rem', color:'rgba(255,255,255,0.3)', textDecoration:'line-through' }}>$38.99</span>
              <span style={{ fontSize:'1.5rem', fontWeight: 700, color:GOLD }}>Included with subscription</span>
              <span style={{ fontSize:'0.6rem', fontWeight:800, background:'rgba(242,147,55,0.2)', color:GOLD, padding:'0.15rem 0.5rem', borderRadius:4, border:'1px solid rgba(242,147,55,0.3)' }}>BETA</span>
            </div>
            {/* Email */}
            <div>
              <div style={{ fontSize:'0.7rem', color:WHITE2, marginBottom:'0.3rem' }}>Send report to</div>
              <input type="email" inputMode="email" placeholder="your@email.com" value={tEmail} onChange={e => setTEmail(e.target.value)}
                style={{ width:'100%', padding:'0.75rem 0.9rem', background:'rgba(255,255,255,0.06)', border:`1px solid ${tEmail.includes('@')?'rgba(39,169,107,0.45)':BORDER}`, borderRadius:10, color:WHITE, fontSize:'0.9rem', outline:'none', boxSizing:'border-box' as const }} />
            </div>
            {/* Discount code */}
            {!discountApplied && !unlockToken ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                <div style={{ fontSize:'0.7rem', color:WHITE2, textAlign:'center' as const }}>Have a discount code?</div>
                <div style={{ display:'flex', gap:'0.4rem' }}>
                  <input type="text" placeholder="Enter code" value={discountCode} onChange={e => { setDiscountCode(e.target.value); setDiscountError(null) }} onKeyDown={e => { if (e.key==='Enter') handleApplyDiscount() }}
                    style={{ flex:1, padding:'0.7rem 0.9rem', background:'rgba(255,255,255,0.06)', border:`1px solid ${discountCode?'rgba(147,186,212,0.45)':BORDER}`, borderRadius:10, color:WHITE, fontSize:'0.88rem', outline:'none', letterSpacing:'0.04em' }} />
                  <button onClick={handleApplyDiscount} disabled={discountChecking || !discountCode.trim()}
                    style={{ padding:'0.7rem 1rem', background:discountCode.trim()?'rgba(242,147,55,0.15)':'rgba(255,255,255,0.04)', border:`1px solid ${discountCode.trim()?'rgba(242,147,55,0.4)':BORDER}`, borderRadius:10, color:discountCode.trim()?GOLD:WHITE2, fontSize:'0.8rem', fontWeight:700, cursor:discountCode.trim()?'pointer':'not-allowed', whiteSpace:'nowrap' as const }}>
                    {discountChecking?'…':'Apply →'}
                  </button>
                </div>
                {discountError && <div style={{ fontSize:'0.73rem', color:'#E85555', padding:'0.4rem 0.65rem', background:'rgba(232,85,85,0.08)', borderRadius:8, border:'1px solid rgba(232,85,85,0.2)' }}>{discountError}</div>}
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 0.9rem', background:'rgba(39,169,107,0.1)', border:'1px solid rgba(39,169,107,0.3)', borderRadius:10 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:GREEN }} />
                <span style={{ fontSize:'0.78rem', color:GREEN, fontWeight:700 }}>Code applied — report is free</span>
              </div>
            )}
            {/* CTA */}
            {unlockToken ? (
              <button onClick={() => handleGenerate(false)} disabled={genLoading}
                style={{ width:'100%', padding:'1.1rem', background:`linear-gradient(135deg,${GREEN},#1A7A50)`, border:'none', borderRadius:14, color:'#fff', fontSize:'0.95rem', fontWeight: 700, cursor:'pointer', boxShadow:'0 6px 24px rgba(39,169,107,0.45)', opacity:genLoading?0.7:1 }}>
                {genLoading?'Generating…':'Generate Accessibility Report — Free →'}
              </button>
            ) : (
              <button onClick={handleStripeCheckout}
                style={{ width:'100%', padding:'1.1rem', background:`linear-gradient(135deg,${AMBER},#C4721E)`, border:'none', borderRadius:14, color:'#fff', fontSize:'0.95rem', fontWeight: 700, cursor:'pointer', boxShadow:'0 6px 24px rgba(242,147,55,0.5)' }}>
                Unlock Full Report — Included with subscription →
              </button>
            )}
            {genError && <div style={{ fontSize:'0.75rem', color:'#E85555', textAlign:'center' as const, padding:'0.35rem 0' }}>{genError}</div>}
            {!unlockToken && <button onClick={() => setSheet('testimonial')} style={{ background:'none', border:'none', color:WHITE2, fontSize:'0.75rem', cursor:'pointer', lineHeight:1.5, textAlign:'center' as const }}>or leave a testimonial to get it free →</button>}
            <button onClick={() => setSheet('hidden')} style={{ background:'none', border:'none', color:'rgba(147,186,212,0.5)', fontSize:'0.68rem', cursor:'pointer', alignSelf:'center' }}>← Back to summary</button>
          </div>
        </>
      )}

      {/* ═══════ TESTIMONIAL SHEET ═══════ */}
      {sheet === 'testimonial' && (
        <>
          <div onClick={() => setSheet('paywall')} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', zIndex:90 }} />
          <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:430, zIndex:100, background:'#0F2438', borderRadius:'22px 22px 0 0', padding:'1.25rem 1.25rem 3rem', display:'flex', flexDirection:'column', gap:'0.75rem', boxShadow:'0 -8px 40px rgba(0,0,0,0.7)', maxHeight:'92dvh', overflowY:'auto' }}>
            <div style={{ width:36, height:4, borderRadius:2, background:'rgba(147,186,212,0.25)', alignSelf:'center', marginBottom:'0.1rem' }} />
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'1rem', fontWeight:800, color:WHITE, marginBottom:'0.2rem' }}>Get your report free</div>
              <div style={{ fontSize:'0.75rem', color:WHITE2, lineHeight:1.6 }}>Help us improve stAIrcode. Share your details and a brief testimonial — your full PDF report will be unlocked immediately.</div>
            </div>

            {/* Name */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              <div>
                <div style={{ fontSize:'0.65rem', color:WHITE2, marginBottom:'0.2rem' }}>First & Last Name *</div>
                <input type="text" placeholder="Jane Smith" value={tName} onChange={e => { setTName(e.target.value); setTError(null) }}
                  style={{ width:'100%', padding:'0.6rem 0.75rem', background:'rgba(255,255,255,0.06)', border:`1px solid ${tName.trim().length>=2?'rgba(39,169,107,0.45)':BORDER}`, borderRadius:9, color:WHITE, fontSize:'0.82rem', outline:'none', boxSizing:'border-box' as const }} />
              </div>
              <div>
                <div style={{ fontSize:'0.65rem', color:WHITE2, marginBottom:'0.2rem' }}>Job Title *</div>
                <input type="text" placeholder="Building Inspector" value={tTitle} onChange={e => { setTTitle(e.target.value); setTError(null) }}
                  style={{ width:'100%', padding:'0.6rem 0.75rem', background:'rgba(255,255,255,0.06)', border:`1px solid ${tTitle.trim().length>=2?'rgba(39,169,107,0.45)':BORDER}`, borderRadius:9, color:WHITE, fontSize:'0.82rem', outline:'none', boxSizing:'border-box' as const }} />
              </div>
            </div>

            {/* Email */}
            <div>
              <div style={{ fontSize:'0.65rem', color:WHITE2, marginBottom:'0.2rem' }}>Email *</div>
              <input type="email" inputMode="email" placeholder="your@email.com" value={tEmail} onChange={e => { setTEmail(e.target.value); setTError(null) }}
                style={{ width:'100%', padding:'0.6rem 0.75rem', background:'rgba(255,255,255,0.06)', border:`1px solid ${tEmail.includes('@')?'rgba(39,169,107,0.45)':BORDER}`, borderRadius:9, color:WHITE, fontSize:'0.82rem', outline:'none', boxSizing:'border-box' as const }} />
            </div>

            {/* Phone */}
            <div>
              <div style={{ fontSize:'0.65rem', color:WHITE2, marginBottom:'0.2rem' }}>Phone Number *</div>
              <input type="tel" inputMode="tel" placeholder="(416) 555-0100" value={tPhone} onChange={e => { setTPhone(e.target.value); setTError(null) }}
                style={{ width:'100%', padding:'0.6rem 0.75rem', background:'rgba(255,255,255,0.06)', border:`1px solid ${tPhone.replace(/\D/g,'').length>=10?'rgba(39,169,107,0.45)':BORDER}`, borderRadius:9, color:WHITE, fontSize:'0.82rem', outline:'none', boxSizing:'border-box' as const }} />
            </div>

            {/* Company */}
            <div>
              <div style={{ fontSize:'0.65rem', color:WHITE2, marginBottom:'0.2rem' }}>Company / Organization *</div>
              <input type="text" placeholder="City of Toronto" value={tCompany} onChange={e => { setTCompany(e.target.value); setTError(null) }}
                style={{ width:'100%', padding:'0.6rem 0.75rem', background:'rgba(255,255,255,0.06)', border:`1px solid ${tCompany.trim().length>=2?'rgba(39,169,107,0.45)':BORDER}`, borderRadius:9, color:WHITE, fontSize:'0.82rem', outline:'none', boxSizing:'border-box' as const }} />
            </div>

            {/* Comment */}
            <div>
              <div style={{ fontSize:'0.65rem', color:WHITE2, marginBottom:'0.2rem', display:'flex', justifyContent:'space-between' }}>
                <span>Testimonial * (min 50 characters)</span>
                <span style={{ color:tComment.trim().length>=50?GREEN:WHITE2 }}>{tComment.trim().length}/50</span>
              </div>
              <textarea
                placeholder="Tell us what you think about stAIrcode. What worked well? What could be improved? How does it compare to your usual workflow?"
                value={tComment} onChange={e => { setTComment(e.target.value); setTError(null) }}
                rows={4}
                style={{ width:'100%', padding:'0.7rem 0.75rem', background:'rgba(255,255,255,0.06)', border:`1px solid ${tComment.trim().length>=50?'rgba(39,169,107,0.45)':BORDER}`, borderRadius:9, color:WHITE, fontSize:'0.82rem', resize:'vertical' as const, outline:'none', boxSizing:'border-box' as const, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", lineHeight:1.55 }}
              />
            </div>

            {tError && <div style={{ fontSize:'0.73rem', color:'#E85555', padding:'0.4rem 0.65rem', background:'rgba(232,85,85,0.08)', borderRadius:8, border:'1px solid rgba(232,85,85,0.2)' }}>{tError}</div>}

            <button onClick={handleTestimonialSubmit} disabled={tSending || !testimValid}
              style={{ width:'100%', padding:'1rem', background:testimValid?`linear-gradient(135deg,${GREEN},#1A7A50)`:'rgba(255,255,255,0.06)', border:'none', borderRadius:14, color:testimValid?'#fff':WHITE2, fontSize:'0.88rem', fontWeight: 700, cursor:testimValid?'pointer':'not-allowed', transition:'all 0.2s' }}>
              {tSending ? 'Submitting…' : testimValid ? 'Submit & Unlock Report →' : 'Fill in all fields above'}
            </button>

            <button onClick={() => setSheet('paywall')} style={{ background:'none', border:'none', color:'rgba(147,186,212,0.5)', fontSize:'0.68rem', cursor:'pointer', alignSelf:'center' }}>← Back</button>
          </div>
        </>
      )}
    </div>
  )
}
