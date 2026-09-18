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
import InspectionReportScreen from './InspectionReportScreen'

import type { UserRole } from './AuthScreen'
import { uploadPhoto, isStorageRef } from '@/lib/photo-refs'

interface Props {
  job:       InspectionJob
  onUpdate:  (job: InspectionJob) => void
  onBack:    () => void
  userEmail: string
  userRole?: UserRole
}

// Auto-save debounce: save to Supabase 3s after last update
// Also exposes forceSave for immediate writes (e.g. phase complete, exit)
function useAutoSave(job: InspectionJob, userEmail: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSave = useCallback(async (j: InspectionJob) => {
    if (!userEmail) {
      console.warn('[AutoSave] No userEmail — cannot save to Supabase')
      return
    }
    // Strip all base64 photos before sending — they make the payload too large
    // Photos are kept in localStorage/sessionStorage; we only need the job structure in Supabase
    const slim = {
      ...j,
      propertyThumbnail: j.propertyThumbnail && j.propertyThumbnail.length < 20000
        ? j.propertyThumbnail : undefined,
      drawingsData: j.drawingsData ? { ...j.drawingsData, pages: [] } : undefined,
      phases: j.phases.map(phase => ({
        ...phase,
        reportPdfB64: undefined,
        modules: phase.modules.map(mod => ({
          ...mod,
          photos:   keepRefs(mod.photos),
          findings: (mod.findings || []).map((f: any) => ({
            ...f,
            photos: keepRefs(f.photos),
          })),
        })),
      })),
    }
    try {
      const res = await fetch('/api/inspection/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: slim, userId: userEmail }),
      })
      if (!res.ok) {
        const text = await res.text()
        console.warn(`[AutoSave] HTTP ${res.status}: ${text.slice(0, 200)}`)
        return
      }
      const data = await res.json()
      if (data.cloud) {
        console.log(`[AutoSave] ✓ Saved to Supabase: ${j.id}`)
      } else {
        console.warn(`[AutoSave] ⚠ Not saved to cloud: ${data.error || 'unknown'}`)
      }
    } catch (e) {
      console.warn('[AutoSave] Network error:', e)
    }
  }, [userEmail])

  // Debounced auto-save on any job change
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSave(job), 3000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [job, doSave])

  // Immediate save when a phase becomes complete
  const prevPhasesRef = useRef(job.phases)
  useEffect(() => {
    const prev = prevPhasesRef.current
    const justCompleted = job.phases.some((p, i) =>
      p.status === 'complete' && prev[i]?.status !== 'complete'
    )
    if (justCompleted) {
      if (timerRef.current) clearTimeout(timerRef.current)
      doSave(job)
    }
    prevPhasesRef.current = job.phases
  }, [job.phases, doSave])

  return doSave
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
function PhaseCard({
  phase, seqNum, onClick, onToggleNA,
}: {
  phase: InspectionJob['phases'][0]
  seqNum: number | null     // null when N/A
  onClick: () => void
  onToggleNA: () => void
}) {
  const meta    = PHASE_META[phase.id]
  const pct     = getPhaseProgress(phase)
  const isNA    = phase.status === 'not_applicable'
  const done    = phase.status === 'complete'
  const active  = phase.status === 'in_progress'
  const modCount  = phase.modules.length
  const doneCount = phase.modules.filter(m => m.status === 'complete' || m.status === 'skipped').length

  const borderColor = isNA  ? 'rgba(44,90,122,0.08)'
                    : done  ? 'rgba(39,169,107,0.4)'
                    : active ? 'rgba(65,124,164,0.45)' : BORDER
  const accentColor = isNA  ? '#C4CBD6'
                    : done  ? GREEN
                    : active ? BLUE : '#9DB4C5'
  const bgColor     = isNA  ? 'rgba(44,90,122,0.02)'
                    : done  ? 'rgba(39,169,107,0.03)'
                    : active ? 'rgba(65,124,164,0.04)' : '#fff'

  return (
    <div style={{ display:'flex', alignItems:'stretch', gap:'0.4rem' }}>
      {/* Phase card — not clickable when N/A */}
      <button
        onClick={isNA ? undefined : onClick}
        style={{ flex:1, padding:'0.85rem 1rem', background:bgColor, border:`1.5px solid ${borderColor}`, borderRadius:11, display:'flex', alignItems:'center', gap:'0.85rem', cursor: isNA ? 'default':'pointer', textAlign:'left', transition:'all 0.12s', opacity: isNA ? 0.5 : 1, boxShadow: active && !isNA ? '0 2px 8px rgba(65,124,164,0.1)' : 'none' }}>

        {/* Sequence number or N/A badge */}
        <div style={{ width:38, height:38, borderRadius:9, background: isNA ? 'rgba(44,90,122,0.05)' : 'rgba(65,124,164,0.07)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative' }}>
          {isNA ? (
            <span style={{ fontSize:'0.55rem', fontWeight:700, color:'#C4CBD6', letterSpacing:'0.03em' }}>N/A</span>
          ) : (
            <>
              <PhaseIcon type={meta.icon} size={20} color={accentColor} />
              {seqNum !== null && (
                <div style={{ position:'absolute', top:-4, right:-4, width:15, height:15, borderRadius:'50%', background: done ? GREEN : BLUE, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.48rem', fontWeight:800, color:'#fff', border:'1.5px solid #fff' }}>
                  {seqNum}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:'0.875rem', fontWeight:600, color: isNA ? '#9DB4C5' : '#0D1E2E', marginBottom:'0.1rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textDecoration: isNA ? 'line-through' : 'none' }}>
            {meta.label}
          </div>
          <div style={{ fontSize:'0.68rem', color: isNA ? '#C4CBD6' : '#5E7D9B' }}>
            {isNA ? 'Not applicable to this inspection' : done ? 'Complete' : active ? `${doneCount} of ${modCount} modules done` : `${modCount} modules`}
          </div>
        </div>

        {!isNA && (
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
        )}
      </button>

      {/* N/A toggle button */}
      <button
        onClick={e => { e.stopPropagation(); onToggleNA() }}
        title={isNA ? 'Reinstate this phase' : 'Mark as Not Applicable'}
        style={{ width:36, flexShrink:0, background: isNA ? 'rgba(39,169,107,0.08)' : 'rgba(44,90,122,0.04)', border:`1.5px solid ${isNA ? 'rgba(39,169,107,0.3)' : BORDER}`, borderRadius:11, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s' }}>
        {isNA ? (
          // Reinstate icon (plus)
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke={GREEN} strokeWidth="1.3"/>
            <line x1="7" y1="4" x2="7" y2="10" stroke={GREEN} strokeWidth="1.3" strokeLinecap="round"/>
            <line x1="4" y1="7" x2="10" y2="7" stroke={GREEN} strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        ) : (
          // N/A icon (slash through circle)
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#9DB4C5" strokeWidth="1.3"/>
            <line x1="3.5" y1="10.5" x2="10.5" y2="3.5" stroke="#9DB4C5" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        )}
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

/**
 * Photos saved to the server must stay small. Durable Supabase Storage
 * references (sb:…) ARE small and must be preserved so photos load on any
 * device and embed in reports. Only legacy inline base64 is replaced with a
 * placeholder, since it is far too large to send.
 */
function keepRefs(list?: string[]): string[] {
  return (list || []).map((p, i) =>
    typeof p === 'string' && (p.startsWith('sb:') || p.startsWith('http')) ? p : `[photo-${i}]`
  )
}

export default function InspectionDashboard({ job, onUpdate, onBack, userEmail, userRole = 'diy' }: Props) {
  useAutoSave(job, userEmail)
  const [activePhase,  setActivePhase]  = useState<PhaseId | null>(null)
  const [saveStatus,   setSaveStatus]   = useState<'idle'|'saving'|'saved_cloud'|'saved_local'|'error'>('idle')
  const [saveError,    setSaveError]    = useState<string>('')
  const [showReport,   setShowReport]    = useState(false)
  const [showTeam,     setShowTeam]      = useState(false)
  const [teamEmail,    setTeamEmail]     = useState('')
  const [teamRole,     setTeamRole]      = useState<'co-inspector'|'viewer'|'client'>('co-inspector')
  const [teamSending,  setTeamSending]   = useState(false)
  const [teamMsg,      setTeamMsg]       = useState<string|null>(null)
  const [teamError,    setTeamError]     = useState<string|null>(null)
  const [reportStatus, setReportStatus] = useState<'idle'|'generating'|'done'|'error'>('idle')
  const [reportB64,    setReportB64]    = useState<string|null>(null)
  const [reportMsg,    setReportMsg]    = useState<string>('')
  const [chatOpen,    setChatOpen]    = useState(false)

  const overallPct = getJobProgress(job)
  const phaseDone  = job.phases.filter(p => p.status === 'complete').length
  const phaseTotal = job.phases.length

  // ── Toggle phase N/A ──────────────────────────────────────────────────────
  function handleToggleNA(phaseId: PhaseId) {
    const phase = job.phases.find(p => p.id === phaseId)
    if (!phase) return
    const newStatus = phase.status === 'not_applicable' ? 'pending' : 'not_applicable'
    const newJob: InspectionJob = {
      ...job,
      updatedAt: new Date().toISOString(),
      phases: job.phases.map(p =>
        p.id !== phaseId ? p : { ...p, status: newStatus }
      ),
    }
    onUpdate(newJob)
    try { sessionStorage.setItem(`insp_${job.id}`, JSON.stringify(newJob)) } catch {}
  }

  // ── Explicit save ────────────────────────────────────────────────────────
  async function handleManualSave() {
    setSaveStatus('saving'); setSaveError('')
    try {
      // Upload the property thumbnail to Storage and keep the short `sb:`
      // reference. Inline base64 over ~20KB used to be dropped here, which is
      // why project thumbnails disappeared for most phone photos: a reference
      // is tiny, so it survives the save.
      let thumbRef = job.propertyThumbnail
      if (thumbRef && !isStorageRef(thumbRef) && !thumbRef.startsWith('[')) {
        try { thumbRef = await uploadPhoto(thumbRef, job.id, 'property') } catch {}
      }

      // Strip base64 photos before sending — keeps the row small and prevents
      // res.json() from throwing an opaque DOMException on large/odd responses.
      const slimJob = {
        ...job,
        propertyThumbnail: isStorageRef(thumbRef) ? thumbRef
          : (thumbRef && thumbRef.length < 20000 ? thumbRef : undefined),
        drawingsData: job.drawingsData ? { ...job.drawingsData, pages: [] } : undefined,
        phases: job.phases.map(phase => ({
          ...phase,
          reportPdfB64: undefined,
          modules: phase.modules.map(mod => ({
            ...mod,
            photos:   keepRefs(mod.photos),
            findings: (mod.findings || []).map((f: any) => ({
              ...f,
              photos: keepRefs(f.photos),
            })),
          })),
        })),
      }

      // Keep the FULL job (with photos) locally so thumbnails survive reloads.
      try { localStorage.setItem(`insp_${job.id}`, JSON.stringify(job)) } catch {}
      try { sessionStorage.setItem(`insp_${job.id}`, JSON.stringify(job)) } catch {}

      const res = await fetch('/api/inspection/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: slimJob, userId: userEmail }),
      })

      // Parse defensively — read text, then JSON.parse, so an empty/non-JSON body
      // cannot throw "The string did not match the expected pattern".
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { data = {} }

      if (data.cloud) {
        setSaveStatus('saved_cloud')
      } else if (data.ok || res.ok) {
        setSaveStatus('saved_local')
        setSaveError('Saved on this device')
      } else {
        setSaveStatus('error')
        setSaveError(data.error || data.hint || `Save failed (HTTP ${res.status})`)
      }
      setTimeout(() => setSaveStatus('idle'), 4000)
    } catch (e: any) {
      // The job is already in local storage above — never show the raw exception.
      setSaveStatus('saved_local')
      setSaveError('Saved on this device — will sync when online')
      setTimeout(() => setSaveStatus('idle'), 4000)
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
  // If report screen is open
  if (showReport) {
    return (
      <InspectionReportScreen
        job={job}
        onUpdate={onUpdate}
        onBack={() => setShowReport(false)}
      />
    )
  }

  if (activePhase) {
    return (
      <InspectionPhaseScreen
        job={job}
        phaseId={activePhase}
        userRole={userRole}
        userEmail={userEmail}
        onUpdate={onUpdate}
        onBack={() => setActivePhase(null)}
      />
    )
  }

  return (
    <div style={{ minHeight:'100dvh', background:BG, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:'#0D1E2E' }}>

      {/* ── Trial days remaining banner ── */}
      {(()=>{
        try {
          const paid = userEmail ? (()=>{ try { const u = JSON.parse(localStorage.getItem('sc_user') ?? '{}'); return u.membership === 'subscription' || u.membership === 'pro' } catch { return false }})() : false
          if (paid) return null
          const hasTrial = localStorage.getItem('sc_beta_access') === '1'
          if (!hasTrial) return null
          const trialEnd = localStorage.getItem('sc_trial_end')
          if (!trialEnd) return null
          const daysLeft = Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000*60*60*24)))
          if (daysLeft > 7) return null // Only show when close to expiry
          return (
            <div style={{ background: daysLeft <= 3 ? '#E84545' : '#C4780A', color: '#fff', fontSize: '0.72rem', fontWeight: 600, textAlign: 'center', padding: '0.4rem 1rem', letterSpacing: '0.02em' }}>
              {daysLeft === 0 ? 'Your free trial has expired — subscribe to continue' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your free trial`}
            </div>
          )
        } catch { return null }
      })()}

      {/* ── Header ── */}
      <div style={{ background:NAVY, paddingTop:'max(env(safe-area-inset-top,0px),1rem)', paddingBottom:'1.25rem', paddingLeft:'1.25rem', paddingRight:'1.25rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem' }}>
          <button onClick={async () => {
            // Force-save to Supabase before navigating away
            try {
              await fetch('/api/inspection/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job, userId: userEmail }),
              })
            } catch {}
            onBack()
          }} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.55)', fontSize:'0.85rem', cursor:'pointer', padding:0 }}>← Exit</button>
          <div style={{ flex:1, display:'flex', justifyContent:'center' }}><NavLogo height={22} /></div>
          {/* Team button */}
          <button onClick={() => { setShowTeam(true); setTeamMsg(null); setTeamError(null) }}
            style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:7, padding:'5px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', color:'rgba(255,255,255,0.8)', fontSize:'0.72rem', fontWeight:600 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M1.5 13c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M12 8v4M10 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Team{(job.collaborators?.length ?? 0) > 0 ? ` (${job.collaborators!.length})` : ''}
          </button>
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
        {/* N/A phases don't count in sequence numbering */}
        {(() => {
          let seqCounter = 0
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {job.phases.map(phase => {
                const isNA = phase.status === 'not_applicable'
                // property_setup doesn't get a sequence number
                const isSetup = phase.id === 'property_setup'
                if (!isNA && !isSetup) seqCounter++
                return (
                  <PhaseCard
                    key={phase.id}
                    phase={phase}
                    seqNum={isNA || isSetup ? null : seqCounter}
                    onClick={() => setActivePhase(phase.id as PhaseId)}
                    onToggleNA={() => handleToggleNA(phase.id as PhaseId)}
                  />
                )
              })}
            </div>
          )
        })()}

        {/* Report — open review screen */}
        <div style={{ marginTop:'1.25rem' }}>
          <button onClick={() => setShowReport(true)}
            style={{ width:'100%', padding:'1rem', background:`linear-gradient(135deg,${ORANGE},#C4721E)`, border:'none', borderRadius:11, fontSize:'0.9rem', fontWeight:700, color:'#fff', cursor:'pointer', transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem', boxShadow:'0 4px 18px rgba(242,147,55,0.35)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="1" width="9" height="14" rx="1" stroke="#fff" strokeWidth="1.3"/>
              <line x1="4" y1="5" x2="8" y2="5" stroke="#fff" strokeWidth="1"/>
              <line x1="4" y1="7.5" x2="8" y2="7.5" stroke="#fff" strokeWidth="1"/>
              <line x1="4" y1="10" x2="6.5" y2="10" stroke="#fff" strokeWidth="1"/>
              <path d="M11 8l3 3-3 3M11 11h-4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {overallPct >= 100 ? 'Review & Send Final Report →' : `Generate Report (${overallPct}% complete) →`}
          </button>
          {job.reportGenerated && (
            <div style={{ fontSize:'0.65rem', color:GREEN, textAlign:'center', marginTop:'0.35rem' }}>
              Final report generated · {job.reportUrl ? 'Stored in cloud' : ''}
            </div>
          )}
          <div style={{ fontSize:'0.65rem', color:'#9DB4C5', textAlign:'center', marginTop:'0.25rem' }}>
            Generates per-phase sections independently, then assembles into one report
          </div>
        </div>
      </div>

      {/* ── Save button ── */}
      <button
        onClick={handleManualSave}
        style={{
          position:'fixed', bottom:'max(env(safe-area-inset-bottom,0px),1.25rem)', left:'1.25rem',
          minHeight:44, paddingLeft:'1rem', paddingRight:'1rem', paddingTop:'0.45rem', paddingBottom:'0.45rem',
          borderRadius:22,
          background: saveStatus==='saved_cloud'?GREEN
                    : saveStatus==='saved_local'?'#C4780A'
                    : saveStatus==='error'?'#E84545'
                    : saveStatus==='saving'?'rgba(65,124,164,0.8)'
                    : BLUE,
          border:'none', boxShadow:'0 2px 10px rgba(65,124,164,0.35)', cursor:'pointer',
          display:'flex', flexDirection:'column', alignItems:'center', gap:'0.15rem', zIndex:40, transition:'all 0.2s'
        }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
          {saveStatus === 'saving' ? (
            <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.7s linear infinite' }}/>
          ) : saveStatus === 'saved_cloud' ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7l3.5 3.5 6.5-7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : saveStatus === 'saved_local' ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v7M4 6l3 3 3-3M2 12h10" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : saveStatus === 'error' ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="#fff" strokeWidth="1.3"/>
              <path d="M7 4v4M7 9.5v.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 9V11.5a0.5 0.5 0 000.5 0.5h9a0.5 0.5 0 000.5-0.5V9M7 2v7M4.5 5l2.5-3 2.5 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          <span style={{ fontSize:'0.75rem', fontWeight:700, color:'#fff', whiteSpace:'nowrap' as const }}>
            {saveStatus==='saving'?'Saving…'
            :saveStatus==='saved_cloud'?'Saved to cloud ✓'
            :saveStatus==='saved_local'?'Local only ⚠'
            :saveStatus==='error'?'Save failed ✗'
            :'Save'}
          </span>
        </div>
        {(saveStatus === 'saved_local' || saveStatus === 'error') && saveError && (
          <div style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.9)', maxWidth:160, textAlign:'center' as const, lineHeight:1.3 }}>
            {saveError.length > 60 ? saveError.slice(0,57)+'…' : saveError}
          </div>
        )}
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

      {/* ══ TEAM SHEET ══════════════════════════════════════════════════════ */}
      {showTeam && (
        <>
          {/* Backdrop */}
          <div onClick={() => setShowTeam(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200 }}/>

          {/* Sheet */}
          <div style={{
            position:'fixed', bottom:0, left:0, right:0, zIndex:201,
            background:'#fff', borderRadius:'18px 18px 0 0',
            boxShadow:'0 -8px 40px rgba(0,0,0,0.18)',
            maxHeight:'80dvh', display:'flex', flexDirection:'column',
            fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
          }}>
            {/* Handle */}
            <div style={{ display:'flex', justifyContent:'center', padding:'0.65rem 0 0' }}>
              <div style={{ width:36, height:4, borderRadius:2, background:'rgba(44,90,122,0.18)' }}/>
            </div>

            {/* Header */}
            <div style={{ padding:'0.75rem 1.25rem 0.5rem', borderBottom:'1px solid rgba(44,90,122,0.1)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:'1rem', fontWeight:700, color:NAVY }}>Project Team</div>
                <div style={{ fontSize:'0.68rem', color:'#5E7D9B', marginTop:'0.1rem' }}>
                  {job.address.street}, {job.address.city}
                </div>
              </div>
              <button onClick={() => setShowTeam(false)}
                style={{ background:'none', border:'none', fontSize:'1.3rem', color:'#9DB4C5', cursor:'pointer', padding:'0.25rem' }}>×</button>
            </div>

            {/* Body */}
            <div style={{ flex:1, overflowY:'auto', padding:'1rem 1.25rem', display:'flex', flexDirection:'column', gap:'1rem' }}>

              {/* Current team */}
              <div>
                <div style={{ fontSize:'0.68rem', fontWeight:700, color:'#5E7D9B', letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:'0.5rem' }}>Members</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                  {/* Owner */}
                  <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.65rem 0.85rem', background:'rgba(65,124,164,0.05)', borderRadius:9, border:'1px solid rgba(65,124,164,0.12)' }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:BLUE, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ fontSize:'0.7rem', fontWeight:800, color:'#fff' }}>{(userEmail[0] ?? '?').toUpperCase()}</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'0.78rem', fontWeight:600, color:NAVY, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{userEmail}</div>
                      <div style={{ fontSize:'0.62rem', color:'#9DB4C5' }}>Owner</div>
                    </div>
                  </div>

                  {/* Collaborators */}
                  {(job.collaborators ?? []).map((c, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.65rem 0.85rem', background:'#F7FAFC', borderRadius:9, border:'1px solid rgba(44,90,122,0.1)' }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(44,90,122,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ fontSize:'0.7rem', fontWeight:800, color:BLUE }}>{(c.email[0] ?? '?').toUpperCase()}</span>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'0.78rem', fontWeight:600, color:NAVY, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{c.email}</div>
                        <div style={{ fontSize:'0.62rem', color:'#9DB4C5', textTransform:'capitalize' as const }}>{c.role.replace('-', ' ')}</div>
                      </div>
                      <button
                        onClick={async () => {
                          await fetch(`/api/inspection/invite?jobId=${job.id}&ownerEmail=${encodeURIComponent(userEmail)}&inviteeEmail=${encodeURIComponent(c.email)}`, { method: 'DELETE' })
                          const updated = { ...job, collaborators: (job.collaborators ?? []).filter((_,j) => j !== i) }
                          onUpdate(updated)
                        }}
                        style={{ background:'none', border:'none', color:'#E84545', fontSize:'0.72rem', cursor:'pointer', padding:'4px 8px', borderRadius:5, fontWeight:600 }}>
                        Remove
                      </button>
                    </div>
                  ))}

                  {(job.collaborators?.length ?? 0) === 0 && (
                    <div style={{ fontSize:'0.75rem', color:'#9DB4C5', padding:'0.5rem 0' }}>No team members added yet.</div>
                  )}
                </div>
              </div>

              {/* Add new member */}
              <div>
                <div style={{ fontSize:'0.68rem', fontWeight:700, color:'#5E7D9B', letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:'0.5rem' }}>Add Team Member</div>

                <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                  <input
                    type="email"
                    value={teamEmail}
                    onChange={e => { setTeamEmail(e.target.value); setTeamMsg(null); setTeamError(null) }}
                    placeholder="colleague@firm.com"
                    style={{ width:'100%', padding:'0.75rem 0.9rem', background:'#F7FAFC', border:'1.5px solid rgba(65,124,164,0.25)', borderRadius:9, fontSize:'0.88rem', color:NAVY, outline:'none', boxSizing:'border-box' as const, fontFamily:'inherit' }}
                  />
                  <div style={{ display:'flex', gap:'0.4rem' }}>
                    {(['co-inspector','viewer','client'] as const).map(r => (
                      <button key={r} onClick={() => setTeamRole(r)}
                        style={{ flex:1, padding:'0.5rem 0', borderRadius:7, border:`1.5px solid ${teamRole===r ? BLUE : 'rgba(44,90,122,0.18)'}`, background: teamRole===r ? 'rgba(65,124,164,0.08)' : '#fff', color: teamRole===r ? BLUE : '#9DB4C5', fontSize:'0.65rem', fontWeight: teamRole===r ? 700 : 500, cursor:'pointer', textTransform:'capitalize' as const }}>
                        {r.replace('-',' ')}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize:'0.62rem', color:'#9DB4C5', lineHeight:1.5 }}>
                    {teamRole==='co-inspector' && 'Can view and edit all phases and modules.'}
                    {teamRole==='viewer' && 'Can view the project but cannot edit.'}
                    {teamRole==='client' && 'Receives the final report — read-only access.'}
                  </div>
                </div>

                {teamMsg && <div style={{ fontSize:'0.75rem', color:'#27A96B', marginTop:'0.4rem', fontWeight:600 }}>✓ {teamMsg}</div>}
                {teamError && <div style={{ fontSize:'0.75rem', color:'#E84545', marginTop:'0.4rem' }}>{teamError}</div>}
              </div>
            </div>

            {/* Send invite button */}
            <div style={{ padding:'0.75rem 1.25rem', paddingBottom:'max(env(safe-area-inset-bottom,0px),0.75rem)', borderTop:'1px solid rgba(44,90,122,0.1)' }}>
              <button
                disabled={teamSending || !teamEmail.trim()}
                onClick={async () => {
                  setTeamSending(true); setTeamMsg(null); setTeamError(null)
                  try {
                    const res = await fetch('/api/inspection/invite', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        jobId: job.id,
                        ownerEmail: userEmail,
                        inviteeEmail: teamEmail.trim(),
                        role: teamRole,
                        jobAddress: `${job.address.street}, ${job.address.city}`,
                      }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error ?? 'Invite failed')
                    const updated = { ...job, collaborators: data.collaborators }
                    onUpdate(updated)
                    setTeamMsg(`Invite sent to ${teamEmail.trim()}`)
                    setTeamEmail('')
                  } catch (err: any) {
                    setTeamError(err.message)
                  }
                  setTeamSending(false)
                }}
                style={{ width:'100%', padding:'0.9rem', background: teamSending || !teamEmail.trim() ? 'rgba(65,124,164,0.3)' : `linear-gradient(135deg,${BLUE},#2A5F8A)`, border:'none', borderRadius:10, fontSize:'0.88rem', fontWeight:800, color:'#fff', cursor: teamSending || !teamEmail.trim() ? 'default' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', boxShadow: teamEmail.trim() ? '0 3px 12px rgba(65,124,164,0.3)' : 'none' }}>
                {teamSending
                  ? <><div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.7s linear infinite' }}/> Sending…</>
                  : '📨 Send Invite'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
