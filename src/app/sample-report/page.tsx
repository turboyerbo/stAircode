'use client'
import React from 'react'
import { NavLogo } from '@/app/components/Logo'

const MEASUREMENTS = [
  { id: 'overview',  label: 'Full Stair View',    value: '9 risers',  unit: '',    pass: true,  src: '/sample/stair_overview.jpg',  code: 'OBC 9.8.4.1',  detail: 'Stair flight captured. 9 risers confirmed. Closed riser profile observed.' },
  { id: 'rise',      label: 'Riser Height',       value: '195',       unit: 'mm',  pass: true,  src: '/sample/rise_195mm.jpg',      code: 'OBC 9.8.4.3',  detail: 'Measured at 195mm. OBC 2024 requires 125–200mm. Within tolerance.' },
  { id: 'run',       label: 'Tread Depth (Run)',  value: '250',       unit: 'mm',  pass: true,  src: '/sample/run_250mm.jpg',       code: 'OBC 9.8.4.3',  detail: 'Measured at 250mm. OBC 2024 requires minimum 235mm. Compliant.' },
  { id: 'width',     label: 'Stair Width',        value: '1100',      unit: 'mm',  pass: true,  src: '/sample/width_1100mm.jpg',    code: 'OBC 9.8.4.2',  detail: 'Clear width measured at 1100mm. OBC 2024 requires minimum 860mm. Compliant.' },
  { id: 'nosing',    label: 'Nosing Projection',  value: '0',         unit: 'mm',  pass: null,  src: '/sample/nosing_0mm.jpg',      code: 'OBC 9.8.4.3',  detail: 'No significant nosing projection detected. OBC 2024 permits 0–25mm. Verify during formal inspection if renovation is planned.' },
  { id: 'headroom',  label: 'Headroom',           value: '1800',      unit: 'mm',  pass: false, src: '/sample/headroom_1800mm.jpg', code: 'OBC 9.8.4.4',  detail: 'Clearance measured at approximately 1800mm. OBC 2024 requires minimum 1950mm vertical clearance above stair nosing. Deficient by ~150mm. Requires attention.' },
  { id: 'handrail',  label: 'Handrail Height',    value: '900',       unit: 'mm',  pass: true,  src: '/sample/handrail_900mm.jpg',  code: 'OBC 9.8.8',   detail: 'Measured at 900mm above stair nosing. OBC 2024 requires 865–1070mm. Compliant.' },
]

const PASSED  = MEASUREMENTS.filter(m => m.pass === true).length
const FAILED  = MEASUREMENTS.filter(m => m.pass === false).length
const REVIEW  = MEASUREMENTS.filter(m => m.pass === null).length

export default function SampleReportPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FB', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: '#0D1E2E' }}>{/* Nav */}
      <header style={{ padding: '1rem 1.5rem', background: '#fff', borderBottom: '1px solid #E5EBF2', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}><a href="/marketing" style={{ textDecoration: 'none' }}><NavLogo height={26} /></a>
        <div style={{ marginLeft: '1rem', fontSize: '0.78rem', background: 'rgba(242,147,55,0.12)', color: '#C4721E', border: '1px solid rgba(242,147,55,0.3)', borderRadius: 6, padding: '0.2rem 0.65rem', fontWeight: 700, letterSpacing: '0.06em' }}>SAMPLE REPORT</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem', alignItems: 'center' }}><a href="/marketing" style={{ fontSize: '0.78rem', color: '#5E7D9B', textDecoration: 'none' }}>← Back</a>
          <a href="/?signin=1" style={{ fontSize: '0.82rem', fontWeight: 700, background: '#F29337', color: '#fff', borderRadius: 8, padding: '0.5rem 1.1rem', textDecoration: 'none' }}>Get Your Report →</a>
        </div>
      </header>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>{/* ── Report cover ─────────────────────────────────────────────────── */}
        <div style={{ background: 'linear-gradient(160deg,#0A1C2E 0%,#0F2E48 100%)', borderRadius: 20, overflow: 'hidden', marginBottom: '2rem', boxShadow: '0 8px 40px rgba(10,28,46,0.18)' }}>{/* Hazard stripe */}
          <div style={{ height: 10, background: 'repeating-linear-gradient(45deg,#F29337 0,#F29337 10px,#0A1C2E 10px,#0A1C2E 20px)' }} />
          <div style={{ padding: '2rem 2.5rem 2.5rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}><div>
                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>STAIRCODE · BETA · AI COMPLIANCE ANALYSIS</div>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>Stair Compliance Report</h1>
                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', marginTop: '0.4rem' }}>OBC 2024 · Toronto, Ontario · May 5, 2026</div>
              </div>
              <div style={{ textAlign: 'right' }}><div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: '0.35rem' }}>SAMPLE DOCUMENT</div>
                <div style={{ fontSize: '0.72rem', color: '#F29337', fontWeight: 700 }}>staircode.app</div>
              </div>
            </div>
            {/* Summary pills */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}><div style={{ background: 'rgba(39,169,107,0.15)', border: '1.5px solid rgba(39,169,107,0.35)', borderRadius: 12, padding: '0.7rem 1.25rem', textAlign: 'center' }}><div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#3DB88A', lineHeight: 1 }}>{PASSED}</div>
                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginTop: '0.2rem' }}>PASSED</div>
              </div>
              <div style={{ background: 'rgba(232,85,85,0.15)', border: '1.5px solid rgba(232,85,85,0.35)', borderRadius: 12, padding: '0.7rem 1.25rem', textAlign: 'center' }}><div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#E85555', lineHeight: 1 }}>{FAILED}</div>
                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginTop: '0.2rem' }}>FAILED</div>
              </div>
              <div style={{ background: 'rgba(242,147,55,0.12)', border: '1.5px solid rgba(242,147,55,0.3)', borderRadius: 12, padding: '0.7rem 1.25rem', textAlign: 'center' }}><div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#F29337', lineHeight: 1 }}>{REVIEW}</div>
                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginTop: '0.2rem' }}>REVIEW</div>
              </div>
              <div style={{ background: 'rgba(147,186,212,0.08)', border: '1px solid rgba(147,186,212,0.2)', borderRadius: 12, padding: '0.7rem 1.25rem', textAlign: 'center' }}><div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#93BAD4', lineHeight: 1 }}>{MEASUREMENTS.length}</div>
                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginTop: '0.2rem' }}>SCANNED</div>
              </div>
            </div>
          </div>
          <div style={{ height: 10, background: 'repeating-linear-gradient(45deg,#F29337 0,#F29337 10px,#0A1C2E 10px,#0A1C2E 20px)' }} />
        </div>

        {/* ── Report metadata ───────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem 2rem', marginBottom: '1.5rem', border: '1px solid #E5EBF2', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '1rem' }}>{[
            ['Property Location', 'Toronto, Ontario'],
            ['Applicable Code', 'Ontario Building Code 2024'],
            ['Code Section', 'Section 9.8.4'],
            ['Assessment Type', 'Pre-Inspection Dimensional Review'],
            ['Date of Assessment', 'May 5, 2026'],
            ['Occupancy Type', 'Part 9 Residential — Multi-Unit'],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: '0.62rem', color: '#9BB5C8', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{k}</div>
              <div style={{ fontSize: '0.85rem', color: '#0D1E2E', fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* ── Stair description ─────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem 2rem', marginBottom: '1.5rem', border: '1px solid #E5EBF2' }}><div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', color: '#F29337', textTransform: 'uppercase', marginBottom: '0.6rem' }}>1. Stair Description</div>
          <p style={{ fontSize: '0.9rem', color: '#0D1E2E', lineHeight: 1.8, margin: '0 0 0.75rem' }}>The staircase under review is a concrete-structure interior stair serving a multi-unit residential building in Toronto, Ontario. The stair consists of 9 risers with a measured rise of 195mm and a tread depth (run) of 250mm, consistent with a standard Part 9 residential configuration. The stair is equipped with a wall-mounted handrail on one side measuring 900mm in height and a metal guard rail system on the opposite side.
          </p>
          <p style={{ fontSize: '0.9rem', color: '#0D1E2E', lineHeight: 1.8, margin: 0 }}>The clear width of the stair is 1100mm, exceeding the minimum OBC requirement. A headroom concern was identified at approximately 1800mm, which falls below the OBC 2024 minimum of 1950mm and requires further assessment. No significant nosing projection was detected; this dimension should be verified during formal inspection. Risers appear closed. The stair surfaces show minor wear consistent with normal use.
          </p>
        </div>

        {/* ── Measurement photos + compliance table ─────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem 2rem', marginBottom: '1.5rem', border: '1px solid #E5EBF2' }}><div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', color: '#F29337', textTransform: 'uppercase', marginBottom: '1.25rem' }}>2. Measurement Photos &amp; Compliance Analysis</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>{MEASUREMENTS.map((m) => {
              const passColor  = m.pass === true ? '#27A96B' : m.pass === false ? '#E85555' : '#F29337'
              const passBg     = m.pass === true ? 'rgba(39,169,107,0.08)' : m.pass === false ? 'rgba(232,85,85,0.08)' : 'rgba(242,147,55,0.08)'
              const passBorder = m.pass === true ? 'rgba(39,169,107,0.25)' : m.pass === false ? 'rgba(232,85,85,0.25)' : 'rgba(242,147,55,0.25)'
              const passLabel  = m.pass === true ? ' PASS' : m.pass === false ? ' FAIL' : ' REVIEW'
              return (
                <div key={m.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-start', padding: '1.25rem', background: passBg, border: `1px solid ${passBorder}`, borderRadius: 14 }}>{/* Photo */}
                  <div style={{ flex: '0 0 160px', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', border: '1px solid #E5EBF2' }}>{/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.src} alt={m.label} style={{ width: '100%', height: 120, objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                    <div style={{ background: '#0A1C2E', padding: '0.35rem 0.6rem' }}><div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>{m.code}</div>
                    </div>
                  </div>
                  {/* Data */}
                  <div style={{ flex: '1 1 220px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}><span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0D1E2E' }}>{m.label}</span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: passColor, background: `${passColor}18`, border: `1px solid ${passColor}40`, borderRadius: 6, padding: '0.15rem 0.6rem', letterSpacing: '0.08em' }}>{passLabel}</span>
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: passColor, lineHeight: 1, marginBottom: '0.4rem' }}>{m.value}<span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#9BB5C8', marginLeft: '0.25rem' }}>{m.unit}</span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#5E7D9B', lineHeight: 1.65, margin: 0 }}>{m.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Code sections ─────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem 2rem', marginBottom: '1.5rem', border: '1px solid #E5EBF2' }}><div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', color: '#F29337', textTransform: 'uppercase', marginBottom: '1rem' }}>3. Applicable Code Sections</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>{[
              ['OBC 2024 Section 9.8.4.1', 'General stair requirements for residential occupancies, including dimensional standards for rise, run, and width.'],
              ['OBC 2024 Section 9.8.4.2', 'Stair width requirements. Minimum clear width of 860mm for stairs serving dwelling units in Part 9 buildings.'],
              ['OBC 2024 Section 9.8.4.3', 'Rise and run dimensions. Rise: 125mm–200mm. Run: minimum 235mm. Nosing: 0–25mm projection.'],
              ['OBC 2024 Section 9.8.4.4', 'Headroom clearance. Minimum 1950mm measured vertically from stair nosing to any overhead obstruction.'],
              ['OBC 2024 Section 9.8.8',   'Guards and handrails. Guards required where fall hazard exists. Handrail height: 865mm–1070mm above stair nosing.'],
            ].map(([section, text]) => (
              <div key={section} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', background: '#F4F7FB', borderRadius: 10 }}><div style={{ flexShrink: 0, fontSize: '0.72rem', fontWeight: 800, color: '#0D1E2E', minWidth: 190, paddingTop: '0.05rem' }}>{section}</div>
                <div style={{ fontSize: '0.82rem', color: '#5E7D9B', lineHeight: 1.6 }}>{text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Occupancy and risk ────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem 2rem', marginBottom: '1.5rem', border: '1px solid #E5EBF2' }}><div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', color: '#F29337', textTransform: 'uppercase', marginBottom: '0.75rem' }}>4. Probable Occupancy &amp; Risk Assessment</div>
          <p style={{ fontSize: '0.9rem', color: '#0D1E2E', lineHeight: 1.8, margin: '0 0 0.75rem' }}>Based on the dimensional profile, construction type, and Toronto location, this stair most likely serves a Part 9 multi-unit residential building. The measured rise of 195mm and run of 250mm are consistent with older residential construction common to mid-century Toronto apartment buildings.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}><div style={{ display: 'flex', gap: '0.6rem', padding: '0.75rem', background: 'rgba(232,85,85,0.06)', border: '1px solid rgba(232,85,85,0.2)', borderRadius: 10 }}><span style={{ color: '#E85555', fontWeight: 700, flexShrink: 0 }}>①</span>
              <div style={{ fontSize: '0.84rem', color: '#0D1E2E', lineHeight: 1.65 }}><strong>Headroom deficiency (1800mm vs 1950mm required).</strong> The most significant finding. Insufficient headroom creates a strike hazard and represents a code non-compliance that must be resolved before any permit application or occupancy change.</div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', padding: '0.75rem', background: 'rgba(242,147,55,0.06)', border: '1px solid rgba(242,147,55,0.2)', borderRadius: 10 }}><span style={{ color: '#F29337', fontWeight: 700, flexShrink: 0 }}>②</span>
              <div style={{ fontSize: '0.84rem', color: '#0D1E2E', lineHeight: 1.65 }}><strong>Nosing projection requires physical verification.</strong> No measurable nosing was detected by AI vision. A physical inspection is required to confirm whether nosing exists and meets the OBC requirement, as nosing impacts both safety and code compliance.</div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', padding: '0.75rem', background: 'rgba(39,169,107,0.06)', border: '1px solid rgba(39,169,107,0.2)', borderRadius: 10 }}><span style={{ color: '#27A96B', fontWeight: 700, flexShrink: 0 }}>③</span>
              <div style={{ fontSize: '0.84rem', color: '#0D1E2E', lineHeight: 1.65 }}><strong>Rise, run, width, and handrail all pass.</strong> The primary dimensional requirements under OBC 9.8.4 are met. These items do not require immediate remediation but should be documented in the formal inspection record.</div>
            </div>
          </div>
        </div>

        {/* ── Recommendation ────────────────────────────────────────────────── */}
        <div style={{ background: '#0A1C2E', borderRadius: 16, padding: '1.5rem 2rem', marginBottom: '1.5rem', border: '1px solid rgba(147,186,212,0.15)' }}><div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', color: '#F29337', textTransform: 'uppercase', marginBottom: '0.75rem' }}>5. Recommendation</div>
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.8, margin: '0 0 0.75rem' }}>A formal inspection by a licensed building inspector or qualified contractor is warranted before any real estate transaction, renovation permit application, or occupancy change proceeds. The headroom deficiency is the primary item requiring correction and likely requires structural assessment of the ceiling or soffit above the stair travel path.
          </p>
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.8, margin: 0 }}>Nosing dimensions must be physically verified and documented during that inspection. The property owner should obtain the appropriate building permit from the City of Toronto prior to commencing any remedial work. This AI pre-inspection report is suitable for use as a preliminary documentation reference but does not substitute for a certified inspection.
          </p>
        </div>

        {/* ── Disclaimer ────────────────────────────────────────────────────── */}
        <div style={{ background: 'rgba(242,147,55,0.06)', border: '1.5px solid rgba(242,147,55,0.2)', borderLeft: '4px solid #F29337', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '2rem', fontSize: '0.78rem', color: '#5E7D9B', lineHeight: 1.75 }}><strong style={{ color: '#C4721E' }}>Pre-Analysis Only.</strong>{' '}
          Accuracy ±9.5–25mm. This report is generated by AI vision analysis and does not constitute a certified building inspection or engineering assessment. It is intended as a preliminary reference only. Always verify all measurements against OBC 2024 with a licensed inspector or building authority having jurisdiction in Toronto, Ontario.
          Prepared by stAIrcode · staircode.app · © 2026 Just Open Technologies Inc.
        </div>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', textAlign: 'center', border: '1.5px solid #E5EBF2' }}><div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0D1E2E', marginBottom: '0.5rem' }}>Get a report like this for your stairs</div>
          <div style={{ fontSize: '0.88rem', color: '#5E7D9B', marginBottom: '1.5rem' }}>Free scan · Full report $2.99 · PDF emailed instantly</div>
          <a href="/?signin=1" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#F29337,#C4721E)', color: '#fff', fontWeight: 800, fontSize: '1rem', textDecoration: 'none', padding: '0.9rem 2.5rem', borderRadius: 14, letterSpacing: '0.04em', boxShadow: '0 4px 20px rgba(242,147,55,0.4)' }}>Scan My Stairs Now →
          </a>
        </div>

      </div>
    </div>
  )
}
