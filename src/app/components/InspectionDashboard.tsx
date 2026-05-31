'use client'
/**
 * InspectionDashboard.tsx
 *
 * Main inspection dashboard. Shows:
 *  - Property header (address, progress ring)
 *  - 9 inspection phase cards with per-phase progress
 *  - Floating AI chat button
 *  - Navigate into any phase → InspectionPhaseScreen
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { InspectionJob, PhaseId } from '@/lib/inspection-types'
import { PHASE_META, getPhaseProgress, getJobProgress } from '@/lib/inspection-types'
import { NavLogo } from './Logo'
import InspectionPhaseScreen from './InspectionPhaseScreen'
import InspectionAIChat      from './InspectionAIChat'

import type { UserRole } from './AuthScreen'

interface Props {
  job:       InspectionJob
  onUpdate:  (job: InspectionJob) => void
  onBack:    () => void
  userEmail: string
  userRole?: UserRole
}

// Auto-save debounce: save to Supabase 3s after last update
function useAutoSave(job: InspectionJob, userEmail: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const save = useCallback(async (j: InspectionJob) => {
    try {
      await fetch('/api/inspection/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: j, userId: userEmail }),
      })
    } catch (e) {
      console.warn('[InspectionDashboard] Auto-save failed:', e)
    }
  }, [userEmail])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(job), 3000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [job, save])
}

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const ORANGE = '#F29337'
const GREEN  = '#27A96B'
const BORDER = 'rgba(44,90,122,0.14)'
const BG     = '#F4F7FB'

// ── Phase icon SVGs ────────────────────────────────────────────────────────────
function PhaseIcon({ type, size = 20, color }: { type: string; size?: number; color: string }) {
  const s = { width: size, height: size, flexShrink: 0 }
  const icons: Record<string, React.ReactNode> = {
    drawings: (
      <svg {...s} viewBox="0 0 20 20" fill="none">
        <rect x="2" y="1" width="12" height="18" rx="1.5" stroke={color} strokeWidth="1.5"/>
        <line x1="5" y1="6" x2="11" y2="6" stroke={color} strokeWidth="1.2"/>
        <line x1="5" y1="9" x2="11" y2="9" stroke={color} strokeWidth="1.2"/>
        <line x1="5" y1="12" x2="9" y2="12" stroke={color} strokeWidth="1.2"/>
        <path d="M13 11l5 5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="16" cy="14" r="3" stroke={color} strokeWidth="1.5"/>
      </svg>
    ),
    footing: (
      <svg {...s} viewBox="0 0 20 20" fill="none">
        <rect x="3" y="13" width="14" height="5" rx="1" stroke={color} strokeWidth="1.5"/>
        <line x1="7" y1="13" x2="7" y2="8" stroke={color} strokeWidth="1.5"/>
        <line x1="13" y1="13" x2="13" y2="8" stroke={color} strokeWidth="1.5"/>
        <line x1="5" y1="8" x2="15" y2="8" stroke={color} strokeWidth="1.2"/>
      </svg>
    ),
    foundation: (
      <svg {...s} viewBox="0 0 20 20" fill="none">
        <rect x="4" y="2" width="12" height="10" rx="0.5" stroke={color} strokeWidth="1.5"/>
        <rect x="1" y="12" width="18" height="6" rx="1" stroke={color} strokeWidth="1.5"/>
        <line x1="4" y1="6" x2="16" y2="6" stroke={color} strokeWidth="1"/>
        <line x1="4" y1="9" x2="16" y2="9" stroke={color} strokeWidth="1"/>
      </svg>
    ),
    framing: (
      <svg {...s} viewBox="0 0 20 20" fill="none">
        <line x1="3" y1="18" x2="3" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="17" y1="18" x2="17" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M3 6L10 2l7 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="3" y1="11" x2="17" y2="11" stroke={color} strokeWidth="1.2"/>
        <line x1="3" y1="15" x2="17" y2="15" stroke={color} strokeWidth="1.2"/>
        <line x1="10" y1="6" x2="10" y2="18" stroke={color} strokeWidth="1.2"/>
      </svg>
    ),
    insulation: (
      <svg {...s} viewBox="0 0 20 20" fill="none">
        <rect x="2" y="5" width="16" height="10" rx="1" stroke={color} strokeWidth="1.5"/>
        <path d="M2 10 Q5 7 8 10 Q11 13 14 10 Q17 7 18 10" stroke={color} strokeWidth="1.2" fill="none"/>
      </svg>
    ),
    final: (
      <svg {...s} viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="16" height="16" rx="2" stroke={color} strokeWidth="1.5"/>
        <path d="M6 10l3 3 5-5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    setup: (
      <svg {...s} viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="16" height="16" rx="2" stroke={color} strokeWidth="1.5"/>
        <line x1="2" y1="7" x2="18" y2="7" stroke={color} strokeWidth="1.2"/>
        <line x1="6" y1="11" x2="14" y2="11" stroke={color} strokeWidth="1.2"/>
        <line x1="6" y1="14" x2="11" y2="14" stroke={color} strokeWidth="1.2"/>
      </svg>
    ),
    roof: (
      <svg {...s} viewBox="0 0 20 20" fill="none">
        <path d="M2 10L10 2l8 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="4" y="10" width="12" height="8" rx="0.5" stroke={color} strokeWidth="1.5"/>
      </svg>
    ),
    interior: (
      <svg {...s} viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="16" height="16" rx="1" stroke={color} strokeWidth="1.5"/>
        <line x1="10" y1="2" x2="10" y2="18" stroke={color} strokeWidth="1"/>
        <line x1="2" y1="10" x2="10" y2="10" stroke={color} strokeWidth="1"/>
        <circle cx="8" cy="14" r="1" fill={color}/>
      </svg>
    ),
    water: (
      <svg {...s} viewBox="0 0 20 20" fill="none">
        <path d="M10 3C10 3 4 9.5 4 13a6 6 0 0012 0C16 9.5 10 3 10 3z" stroke={color} strokeWidth="1.5"/>
      </svg>
    ),
    exterior: (
      <svg {...s} viewBox="0 0 20 20" fill="none">
        <rect x="2" y="5" width="16" height="14" rx="1" stroke={color} strokeWidth="1.5"/>
        <path d="M2 8h16" stroke={color} strokeWidth="1"/>
        <path d="M2 11h16" stroke={color} strokeWidth="1"/>
        <rect x="7" y="14" width="6" height="5" rx="0.5" stroke={color} strokeWidth="1"/>
      </svg>
    ),
    garage: (
      <svg {...s} viewBox="0 0 20 20" fill="none">
        <rect x="1" y="7" width="18" height="12" rx="1" stroke={color} strokeWidth="1.5"/>
        <path d="M1 10h18M1 13h18" stroke={color} strokeWidth="1"/>
        <path d="M4 7L10 2l6 5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    site: (
      <svg {...s} viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke={color} strokeWidth="1.5"/>
        <path d="M2 10h16M10 2v16" stroke={color} strokeWidth="1"/>
        <path d="M4.9 5C7 7 7 13 10 10s3 5 5.1 5" stroke={color} strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
    services: (
      <svg {...s} viewBox="0 0 20 20" fill="none">
        <path d="M3 14l4-4 3 3 7-7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="17" cy="3" r="2" stroke={color} strokeWidth="1.5"/>
        <circle cx="3" cy="17" r="2" stroke={color} strokeWidth="1.5"/>
      </svg>
    ),
  }
  return <>{icons[type] ?? icons.setup}</>
}

// ── Radial progress ring ───────────────────────────────────────────────────────
function ProgressRing({ pct, size = 44, stroke = 3.5, color = BLUE }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c - (pct / 100) * c
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(44,90,122,0.12)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        style={{ transition:'stroke-dashoffset 0.5s ease' }}/>
    </svg>
  )
}

// ── Phase card ─────────────────────────────────────────────────────────────────
function PhaseCard({ phase, onClick }: { phase: InspectionJob['phases'][0]; onClick: () => void }) {
  const meta    = PHASE_META[phase.id]
  const pct     = getPhaseProgress(phase)
  const done    = phase.status === 'complete'
  const active  = phase.status === 'in_progress'
  const pending = phase.status === 'pending'
  const modCount = phase.modules.length
  const doneCount = phase.modules.filter(m => m.status === 'complete' || m.status === 'skipped').length

  const borderColor = done ? 'rgba(39,169,107,0.4)' : active ? `rgba(65,124,164,0.45)` : BORDER
  const accentColor = done ? GREEN : active ? BLUE : '#9DB4C5'
  const bgColor     = done ? 'rgba(39,169,107,0.03)' : active ? 'rgba(65,124,164,0.04)' : '#fff'

  return (
    <button onClick={onClick}
      style={{ width:'100%', padding:'0.9rem 1rem', background:bgColor, border:`1.5px solid ${borderColor}`, borderRadius:11, display:'flex', alignItems:'center', gap:'0.85rem', cursor:'pointer', textAlign:'left', transition:'all 0.12s', boxShadow: active ? '0 2px 8px rgba(65,124,164,0.1)' : 'none' }}>
      <div style={{ width:38, height:38, borderRadius:9, background:`rgba(65,124,164,0.07)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <PhaseIcon type={meta.icon} size={20} color={accentColor} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'0.875rem', fontWeight:600, color:'#0D1E2E', marginBottom:'0.1rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{meta.label}</div>
        <div style={{ fontSize:'0.68rem', color:'#5E7D9B' }}>
          {done ? 'Complete' : active ? `${doneCount} of ${modCount} modules done` : `${modCount} modules`}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', flexShrink:0 }}>
        {(active || done) ? (
          <div style={{ position:'relative', width:36, height:36 }}>
            <ProgressRing pct={pct} size={36} stroke={3} color={accentColor}/>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.55rem', fontWeight:700, color:accentColor }}>{pct}%</div>
          </div>
        ) : (
          <div style={{ fontSize:'0.68rem', color:'#9DB4C5', padding:'0.2rem 0.5rem', border:`1px solid ${BORDER}`, borderRadius:5 }}>Start</div>
        )}
        <div style={{ color:'#9DB4C5', fontSize:'0.85rem' }}>›</div>
      </div>
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function InspectionDashboard({ job, onUpdate, onBack, userEmail, userRole = 'diy' }: Props) {
  useAutoSave(job, userEmail)
  const [activePhase,  setActivePhase]  = useState<PhaseId | null>(null)
  const [saveStatus,   setSaveStatus]   = useState<'idle'|'saving'|'saved'|'error'>('idle')
  const [reportStatus, setReportStatus] = useState<'idle'|'generating'|'done'|'error'>('idle')
  const [reportB64,    setReportB64]    = useState<string|null>(null)
  const [reportMsg,    setReportMsg]    = useState<string>('')
  const [chatOpen,    setChatOpen]    = useState(false)

  const overallPct = getJobProgress(job)
  const phaseDone  = job.phases.filter(p => p.status === 'complete').length
  const phaseTotal = job.phases.length

  // ── Explicit save ────────────────────────────────────────────────────────
  async function handleManualSave() {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/inspection/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job, userId: userEmail }),
      })
      const data = await res.json()
      setSaveStatus(data.ok ? 'saved' : 'error')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2500)
    }
  }

  // ── Generate report ──────────────────────────────────────────────────────
  async function handleGenerateReport() {
    setReportStatus('generating'); setReportMsg(''); setReportB64(null)
    try {
      const res  = await fetch('/api/report/generate-inspection', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ job }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Report generation failed')
      setReportB64(data.pdfBase64 ?? null)
      setReportMsg(data.message ?? 'Report generated.')
      setReportStatus('done')
      // Update job with report URL if returned
      if (data.reportUrl) {
        onUpdate({ ...job, reportGenerated: true, reportUrl: data.reportUrl, updatedAt: new Date().toISOString() })
      }
    } catch (err: any) {
      setReportMsg(err.message ?? 'Could not generate report.')
      setReportStatus('error')
    }
  }

  function downloadReport() {
    if (!reportB64) return
    const bytes = Uint8Array.from(atob(reportB64), c => c.charCodeAt(0))
    const blob  = new Blob([bytes], { type: 'application/pdf' })
    const url   = URL.createObjectURL(blob)
    const a     = document.createElement('a')
    a.href      = url
    a.download  = `inspection-report-${job.address.street.replace(/[^a-zA-Z0-9]/g,'-') || job.id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  // If a phase is open, render that screen
  if (activePhase) {
    return (
      <InspectionPhaseScreen
        job={job}
        phaseId={activePhase}
        userRole={userRole}
        onUpdate={onUpdate}
        onBack={() => setActivePhase(null)}
      />
    )
  }

  return (
    <div style={{ minHeight:'100dvh', background:BG, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:'#0D1E2E' }}>

      {/* ── Header ── */}
      <div style={{ background:NAVY, paddingTop:'max(env(safe-area-inset-top,0px),1rem)', paddingBottom:'1.25rem', paddingLeft:'1.25rem', paddingRight:'1.25rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem' }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.55)', fontSize:'0.85rem', cursor:'pointer', padding:0 }}>← Exit</button>
          <div style={{ flex:1, display:'flex', justifyContent:'center' }}><NavLogo height={22} /></div>
          <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.35)' }}>{job.inspectionDate}</div>
        </div>

        {/* Property summary */}
        <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:12, padding:'0.9rem 1rem', display:'flex', alignItems:'center', gap:'1rem' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.4)', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', marginBottom:'0.2rem' }}>Inspecting</div>
            <div style={{ fontSize:'0.95rem', fontWeight:700, color:'#fff', lineHeight:1.25 }}>
              {job.address.street}{job.address.unit ? ` #${job.address.unit}` : ''}
            </div>
            <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.55)', marginTop:'0.1rem' }}>
              {job.address.city}, {job.address.province}
            </div>
            {job.clientName && (
              <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.4)', marginTop:'0.25rem' }}>Client: {job.clientName}</div>
            )}
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ position:'relative', width:56, height:56 }}>
              <ProgressRing pct={overallPct} size={56} stroke={4.5} color={ORANGE}/>
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'0.9rem', fontWeight:700, color:'#fff' }}>{overallPct}%</div>
                </div>
              </div>
            </div>
            <div style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.45)', marginTop:'0.3rem' }}>{phaseDone}/{phaseTotal} phases</div>
          </div>
        </div>
      </div>

      {/* ── Phase list ── */}
      <div style={{ padding:'1.25rem 1.25rem 7rem' }}>
        <div style={{ fontSize:'0.7rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.75rem', letterSpacing:'0.03em' }}>Inspection phases</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          {job.phases.map(phase => (
            <PhaseCard key={phase.id} phase={phase} onClick={() => setActivePhase(phase.id)} />
          ))}
        </div>

        {/* Generate report — available at any time */}
        <div style={{ marginTop:'1.25rem', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          <button
            onClick={handleGenerateReport}
            disabled={reportStatus === 'generating'}
            style={{ width:'100%', padding:'1rem', background: reportStatus==='generating' ? 'rgba(242,147,55,0.5)' : `linear-gradient(135deg,${ORANGE},#C4721E)`, border:'none', borderRadius:11, fontSize:'0.9rem', fontWeight:700, color:'#fff', cursor: reportStatus==='generating' ? 'default':'pointer', transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem', boxShadow:'0 4px 18px rgba(242,147,55,0.35)' }}>
            {reportStatus === 'generating' ? (
              <>
                <div style={{ width:16, height:16, borderRadius:'50%', border:'2.5px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.7s linear infinite' }}/>
                Generating report…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="1" width="9" height="14" rx="1" stroke="#fff" strokeWidth="1.3"/>
                  <line x1="4" y1="5" x2="8" y2="5" stroke="#fff" strokeWidth="1"/>
                  <line x1="4" y1="7.5" x2="8" y2="7.5" stroke="#fff" strokeWidth="1"/>
                  <line x1="4" y1="10" x2="6.5" y2="10" stroke="#fff" strokeWidth="1"/>
                  <path d="M10 9l4 4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round"/>
                  <circle cx="11" cy="11" r="3" stroke="#fff" strokeWidth="1.3"/>
                </svg>
                {overallPct >= 100 ? 'Generate Final Report →' : `Generate Report (${overallPct}% complete) →`}
              </>
            )}
          </button>

          {reportStatus === 'done' && (
            <div style={{ background:'rgba(39,169,107,0.08)', border:'1px solid rgba(39,169,107,0.3)', borderRadius:10, padding:'0.75rem 1rem', display:'flex', gap:'0.75rem', alignItems:'center' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'0.78rem', fontWeight:700, color:GREEN, marginBottom:'0.15rem' }}>Report ready</div>
                <div style={{ fontSize:'0.68rem', color:'#5E7D9B', lineHeight:1.5 }}>{reportMsg}</div>
              </div>
              {reportB64 && (
                <button onClick={downloadReport}
                  style={{ padding:'0.55rem 1rem', background:GREEN, border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:'0.78rem', cursor:'pointer', whiteSpace:'nowrap' as const, flexShrink:0 }}>
                  Download PDF
                </button>
              )}
            </div>
          )}

          {reportStatus === 'error' && (
            <div style={{ fontSize:'0.72rem', color:'#E84545', background:'rgba(232,69,69,0.06)', border:'1px solid rgba(232,69,69,0.2)', borderRadius:8, padding:'0.5rem 0.75rem' }}>
              {reportMsg}
            </div>
          )}

          <div style={{ fontSize:'0.65rem', color:'#9DB4C5', textAlign:'center' }}>
            Report can be generated at any time. More complete data produces a more comprehensive report.
          </div>
          <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
        </div>
      </div>

      {/* ── Save button ── */}
      <button
        onClick={handleManualSave}
        style={{ position:'fixed', bottom:'max(env(safe-area-inset-bottom,0px),1.25rem)', left:'1.25rem', height:44, paddingLeft:'1rem', paddingRight:'1rem', borderRadius:22, background: saveStatus==='saved'?GREEN:saveStatus==='error'?'#E84545':saveStatus==='saving'?'rgba(65,124,164,0.8)':BLUE, border:'none', boxShadow:'0 2px 10px rgba(65,124,164,0.35)', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.4rem', zIndex:40, transition:'all 0.2s' }}>
        {saveStatus === 'saving' ? (
          <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.7s linear infinite' }}/>
        ) : saveStatus === 'saved' ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5 6.5-7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 9V11.5a0.5 0.5 0 000.5 0.5h9a0.5 0.5 0 000.5-0.5V9M7 2v7M4.5 5l2.5-3 2.5 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        )}
        <span style={{ fontSize:'0.75rem', fontWeight:700, color:'#fff', whiteSpace:'nowrap' }}>
          {saveStatus==='saving'?'Saving…':saveStatus==='saved'?'Saved':saveStatus==='error'?'Error':'Save'}
        </span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </button>

      {/* ── AI Chat button ── */}
      <button
        onClick={() => setChatOpen(true)}
        style={{ position:'fixed', bottom:'max(env(safe-area-inset-bottom,0px),1.25rem)', right:'1.25rem', width:52, height:52, borderRadius:'50%', background:`linear-gradient(135deg,${BLUE},#2C5A7A)`, border:'none', boxShadow:'0 4px 18px rgba(65,124,164,0.45)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:40 }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M2 2h18v14H2z" rx="2" stroke="#fff" strokeWidth="1.5"/>
          <rect x="2" y="2" width="18" height="14" rx="2" stroke="#fff" strokeWidth="1.5"/>
          <line x1="6" y1="7" x2="16" y2="7" stroke="#fff" strokeWidth="1.2"/>
          <line x1="6" y1="10" x2="13" y2="10" stroke="#fff" strokeWidth="1.2"/>
          <path d="M6 16l2 4 12-4" stroke="#fff" strokeWidth="1.2"/>
        </svg>
      </button>

      {/* ── AI Chat overlay ── */}
      {chatOpen && (
        <InspectionAIChat
          job={job}
          onUpdate={onUpdate}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  )
}
