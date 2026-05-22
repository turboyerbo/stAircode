'use client'
/**
 * FoundationReportScreen.tsx
 *
 * Displays pass/fail compliance results for a foundation inspection.
 * Visual language mirrors ReportScreen — same colour system, same card layout.
 */

import { useState } from 'react'
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

export interface FoundationField {
  label:    string
  value:    string | number | null
  unit?:    string
  pass:     boolean | null     // null = informational / N/A
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

// ── Wall type minimum thickness (mm) per code ─────────────────────────────────
const WALL_TYPE_LABELS: Record<string, string> = {
  poured_concrete: 'Poured Concrete',
  concrete_block:  'Concrete Block (CMU)',
  stone:           'Stone / Rubble',
  brick:           'Brick Masonry',
  icf:             'Insulated Concrete Form (ICF)',
  unknown:         'Unknown / Not Determined',
}

// ── Crack type labels and severity ────────────────────────────────────────────
const CRACK_INFO: Record<string, { label: string; structural: string; severity: 'info' | 'warning' | 'critical' }> = {
  none:       { label: 'None detected',      structural: 'No cracks observed.',                                                    severity: 'info'     },
  hairline:   { label: 'Hairline',           structural: 'Surface shrinkage. Usually not structurally significant — monitor.',    severity: 'info'     },
  vertical:   { label: 'Vertical',           structural: 'Thermal/shrinkage movement. Monitor for progression over time.',        severity: 'info'     },
  diagonal:   { label: 'Diagonal',           structural: 'Possible differential settlement. Professional assessment recommended.', severity: 'warning'  },
  stair_step: { label: 'Stair-step pattern', structural: 'Differential settlement along mortar joints. Professional assessment recommended.',  severity: 'warning' },
  horizontal: { label: 'HORIZONTAL',         structural: 'Indicates lateral earth pressure potentially exceeding wall capacity. STRUCTURAL EMERGENCY — immediate professional assessment required.', severity: 'critical' },
  multiple:   { label: 'Multiple types',     structural: 'Several crack types present. Professional assessment required.',         severity: 'warning'  },
}

// ── Dampproofing requirement note ─────────────────────────────────────────────
function DampproofingNote({ visible }: { visible: boolean | null }) {
  if (visible === true)  return <span style={{ color: GREEN }}>Visible — present</span>
  if (visible === false) return <span style={{ color: AMBER }}>Not detected — may be absent or on interior</span>
  return <span style={{ color: WHITE2 }}>Not assessable from this view</span>
}

// ── Pass/Fail badge ───────────────────────────────────────────────────────────
function ResultBadge({ pass, severity }: { pass: boolean | null; severity: 'info' | 'warning' | 'critical' }) {
  if (pass === null) return <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(147,186,212,0.15)', color: WHITE2, padding: '0.2rem 0.65rem', borderRadius: 6, letterSpacing: '0.08em' }}>N/A</span>
  if (pass) return <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(39,169,107,0.15)', color: GREEN, padding: '0.2rem 0.65rem', borderRadius: 6, border: '1px solid rgba(39,169,107,0.3)', letterSpacing: '0.08em' }}>PASS</span>
  const bg  = severity === 'critical' ? 'rgba(232,69,69,0.15)'  : 'rgba(250,116,31,0.15)'
  const col = severity === 'critical' ? '#ff7070'                : AMBER
  const bdr = severity === 'critical' ? 'rgba(232,69,69,0.45)'  : 'rgba(250,116,31,0.4)'
  const lbl = severity === 'critical' ? 'CRITICAL'              : 'FLAG'
  return <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700, background: bg, color: col, padding: '0.2rem 0.65rem', borderRadius: 6, border: `1px solid ${bdr}`, letterSpacing: '0.08em' }}>{lbl}</span>
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FoundationReportScreen({ measurements: m, fields, codeLabel, location, onStartOver, onRetake }: Props) {
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  const passCount     = fields.filter(f => f.pass === true).length
  const flagCount     = fields.filter(f => f.pass === false).length
  const hasCritical   = fields.some(f => f.pass === false && f.severity === 'critical')
  const overallBg     = hasCritical ? 'linear-gradient(135deg,#3a0a0a,#1a0505)' : flagCount > 0 ? 'linear-gradient(135deg,#2a1800,#1a0f00)' : 'linear-gradient(135deg,#0a1a0f,#0a1a2e)'
  const overallColor  = hasCritical ? '#ff7070' : flagCount > 0 ? AMBER : GREEN
  const overallLabel  = hasCritical ? 'CRITICAL ISSUE' : flagCount > 0 ? 'FLAGS RAISED' : 'NO FLAGS'

  const crackInfo = CRACK_INFO[m.crackType] ?? CRACK_INFO.none

  const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div style={{ minHeight: '100dvh', background: '#EBF3FA', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* ── Report Header ── */}
      <div style={{ background: NAVY, padding: 'max(env(safe-area-inset-top,0px),1.5rem) 1.25rem 0', position: 'relative', overflow: 'hidden' }}>
        {/* Safety-stripe top accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: `repeating-linear-gradient(45deg,${AMBER},${AMBER} 10px,${NAVY} 10px,${NAVY} 20px)` }} />
        <div style={{ paddingTop: '0.75rem', paddingBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', letterSpacing: '0.14em', marginBottom: '0.4rem' }}>STAIRCODE · BETA · FOUNDATION INSPECTION REPORT</div>
          <div style={{ fontSize: 'clamp(1.5rem,5vw,2rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '0.5rem' }}>Foundation<br />Inspection Report</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace', marginBottom: '1rem' }}>
            <span>{codeLabel}</span><span>·</span><span>{location || 'Location not set'}</span><span>·</span><span>{today}</span>
          </div>

          {/* Overall badge */}
          <div style={{ background: overallBg, border: `1.5px solid ${overallColor}44`, borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', color: overallColor, fontWeight: 700, letterSpacing: '0.12em', marginBottom: '0.2rem' }}>OVERALL ASSESSMENT</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: overallColor, fontFamily: 'monospace' }}>{overallLabel}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', fontFamily: 'monospace', lineHeight: 1 }}>{passCount}<span style={{ fontSize: '0.7rem', color: WHITE2, display: 'block', fontWeight: 400 }}>PASS</span></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: flagCount > 0 ? overallColor : WHITE2, fontFamily: 'monospace', lineHeight: 1 }}>{flagCount}<span style={{ fontSize: '0.7rem', color: WHITE2, display: 'block', fontWeight: 400 }}>FLAG{flagCount !== 1 ? 'S' : ''}</span></div>
            </div>
          </div>

          {/* Wall classification */}
          <div style={{ background: 'rgba(65,124,164,0.12)', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', color: WHITE2, letterSpacing: '0.1em', marginBottom: '0.3rem' }}>WALL CLASSIFICATION</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: WHITE }}>{WALL_TYPE_LABELS[m.wallType] ?? m.wallTypeLabel ?? m.wallType}</div>
            {m.wallTypeConfidence != null && <div style={{ fontSize: '0.65rem', color: WHITE2, marginTop: '0.2rem', fontFamily: 'monospace' }}>AI confidence: {Math.round(m.wallTypeConfidence * 100)}%</div>}
          </div>
        </div>
      </div>

      {/* ── CRITICAL WARNING — horizontal cracks ── */}
      {m.horizontalCrack && (
        <div style={{ background: 'rgba(232,69,69,0.12)', border: '2px solid rgba(232,69,69,0.5)', margin: '1rem', borderRadius: 14, padding: '1rem 1.1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#ff7070', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>CRITICAL — HORIZONTAL CRACK DETECTED</div>
          <div style={{ fontSize: '0.8rem', color: '#ffaaaa', lineHeight: 1.65 }}>
            Horizontal cracks in foundation walls indicate that lateral earth pressure may be exceeding the wall&apos;s structural capacity. This is a serious structural condition.
          </div>
          <div style={{ fontSize: '0.72rem', color: '#ff9999', lineHeight: 1.65, marginTop: '0.5rem' }}>
            Immediate action required: engage a licensed structural engineer before this building is occupied or any remediation is performed.
          </div>
        </div>
      )}

      {/* ── Compliance Fields ── */}
      <div style={{ padding: '1rem' }}>
        <div style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: BLUE, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.75rem' }}>COMPLIANCE CHECK RESULTS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {fields.map((f, i) => (
            <div key={i} style={{ background: '#fff', border: `1px solid ${f.pass === false ? (f.severity === 'critical' ? 'rgba(232,69,69,0.4)' : 'rgba(250,116,31,0.35)') : 'rgba(44,90,122,0.12)'}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(44,74,110,0.06)' }}>
              <div style={{ padding: '0.7rem 0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0D1E2E', marginBottom: '0.15rem' }}>{f.label}</div>
                  {f.value != null && (
                    <div style={{ fontSize: '0.72rem', color: '#5E7D9B', fontFamily: 'monospace' }}>
                      {f.value}{f.unit ? ` ${f.unit}` : ''}
                    </div>
                  )}
                  {f.note && <div style={{ fontSize: '0.68rem', color: f.severity === 'critical' ? '#E84545' : f.severity === 'warning' ? '#D97B1F' : '#5E7D9B', lineHeight: 1.55, marginTop: '0.2rem' }}>{f.note}</div>}
                </div>
                <ResultBadge pass={f.pass} severity={f.severity} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Crack Report ── */}
      <div style={{ padding: '0 1rem 1rem' }}>
        <div style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: BLUE, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.75rem' }}>CRACK DOCUMENTATION</div>
        <div style={{ background: '#fff', border: `1px solid ${crackInfo.severity === 'critical' ? 'rgba(232,69,69,0.4)' : crackInfo.severity === 'warning' ? 'rgba(250,116,31,0.3)' : 'rgba(44,90,122,0.12)'}`, borderRadius: 12, padding: '0.9rem 1rem', boxShadow: '0 1px 4px rgba(44,74,110,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0D1E2E' }}>{m.crackPresent ? `Crack Type: ${crackInfo.label}` : 'No Cracks Detected'}</div>
            {m.crackPresent && <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700, background: crackInfo.severity === 'critical' ? 'rgba(232,69,69,0.12)' : crackInfo.severity === 'warning' ? 'rgba(250,116,31,0.12)' : 'rgba(39,169,107,0.12)', color: crackInfo.severity === 'critical' ? '#E84545' : crackInfo.severity === 'warning' ? '#D97B1F' : GREEN, padding: '0.2rem 0.65rem', borderRadius: 6, border: `1px solid ${crackInfo.severity === 'critical' ? 'rgba(232,69,69,0.35)' : crackInfo.severity === 'warning' ? 'rgba(250,116,31,0.3)' : 'rgba(39,169,107,0.3)'}`, letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>{crackInfo.severity}</span>}
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

      {/* ── Moisture Report ── */}
      <div style={{ padding: '0 1rem 1rem' }}>
        <div style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: BLUE, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.75rem' }}>MOISTURE & DAMPPROOFING</div>
        <div style={{ background: '#fff', border: '1px solid rgba(44,90,122,0.12)', borderRadius: 12, padding: '0.9rem 1rem', boxShadow: '0 1px 4px rgba(44,74,110,0.06)', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {[
            { label: 'Moisture / staining present', value: m.moisturePresent ? 'Yes — detected' : 'None detected', flagged: m.moisturePresent },
            { label: 'Efflorescence', value: m.efflorescence ? 'Yes — white mineral deposits present' : 'None detected', flagged: m.efflorescence },
            { label: 'Dampproofing', element: <DampproofingNote visible={m.dampproofingVisible} /> },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', paddingBottom: i < 2 ? '0.55rem' : 0, borderBottom: i < 2 ? '1px solid #EEF3F9' : 'none' }}>
              <div style={{ fontSize: '0.8rem', color: '#0D1E2E', fontWeight: 600 }}>{row.label}</div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700, color: row.flagged ? AMBER : row.element ? '#5E7D9B' : GREEN, textAlign: 'right', maxWidth: '55%' }}>
                {row.element ?? row.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Code Reference ── */}
      <div style={{ padding: '0 1rem 1rem' }}>
        <div style={{ background: NAVY, borderRadius: 12, padding: '0.9rem 1rem' }}>
          <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', color: WHITE2, letterSpacing: '0.1em', marginBottom: '0.35rem' }}>APPLICABLE CODE</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: WHITE, marginBottom: '0.25rem' }}>{codeLabel}</div>
          <div style={{ fontSize: '0.7rem', color: WHITE2, lineHeight: 1.6 }}>
            Foundation wall thickness requirements: OBC/NBC Part 9 s.9.15 (residential); IBC §1807 (all occupancies). Crack assessment per ACI 224R, CCMPA, and local standards. Dampproofing: OBC s.9.13 / IBC §1805.
          </div>
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <div style={{ padding: '0 1rem 1rem' }}>
        <button onClick={() => setShowDisclaimer(v => !v)} style={{ width: '100%', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '0.6rem 1rem', color: '#9DB4C5', fontSize: '0.72rem', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
          <span>Disclaimer & Limitations</span><span>{showDisclaimer ? '−' : '+'}</span>
        </button>
        {showDisclaimer && (
          <div style={{ background: '#fff', border: '1px solid rgba(44,90,122,0.1)', borderRadius: 10, padding: '0.9rem 1rem', marginTop: '0.35rem', fontSize: '0.72rem', color: '#5E7D9B', lineHeight: 1.7 }}>
            This report is an AI-assisted visual screening tool only. All measurements are estimates from camera images with typical accuracy of ±15–40mm. Foundation assessments require physical access, probing, and professional engineering judgment. This report does not substitute for inspection by a licensed structural engineer, geotechnical engineer, or certified home inspector. Crack width measurements from photos are approximate and subject to lighting, angle, and resolution limitations. Always confirm findings with qualified professionals before making structural, occupancy, or renovation decisions.
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ padding: '0 1rem', paddingBottom: 'max(env(safe-area-inset-bottom,0px),1.5rem)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <button onClick={onRetake} style={{ width: '100%', padding: '1rem', background: `linear-gradient(135deg,#27A96B,#1A7A50)`, border: 'none', borderRadius: 14, color: '#fff', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 18px rgba(39,169,107,0.38)' }}>
          ↺ Rescan Foundation
        </button>
        <button onClick={onStartOver} style={{ width: '100%', padding: '0.85rem', background: 'rgba(65,124,164,0.1)', border: '1px solid rgba(65,124,164,0.25)', borderRadius: 14, color: BLUE, fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
          ← Module Select
        </button>
      </div>

    </div>
  )
}
