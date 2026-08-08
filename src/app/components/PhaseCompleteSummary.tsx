'use client'
/**
 * PhaseCompleteSummary.tsx
 *
 * Shown when a phase is 100% complete (green). Replaces the plain module list
 * with a proper mini-report: all findings, photos, conditions, and actions.
 *
 * Per module:
 *   - Condition badge (coloured)
 *   - Severity indicator
 *   - Observations
 *   - Recommendations
 *   - Photo thumbnails
 *   - Actions: Edit | Add Photos | Re-analyze
 *
 * Phase-level actions:
 *   - Edit phase notes
 *   - Reopen phase (un-complete)
 *   - Generate Phase Report
 */

import { useState } from 'react'
import type { InspectionJob, InspectionPhase, InspectionModule, PhaseId, ModuleId } from '@/lib/inspection-types'
import { PHASE_META, MODULE_META } from '@/lib/inspection-types'

interface Props {
  job:          InspectionJob
  phase:        InspectionPhase
  onUpdate:     (job: InspectionJob) => void
  onBack:       () => void
  onEditModule: (moduleId: ModuleId) => void  // opens module capture for editing
}

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const GREEN  = '#27A96B'
const ORANGE = '#F29337'
const RED    = '#E84545'
const BORDER = 'rgba(44,90,122,0.14)'
const BG     = '#F4F7FB'

// Turn a stored photo value into a usable <img src>. Handles data URIs, http
// URLs, and raw base64 (detecting PNG/JPEG/GIF/webp). Returns '' for [photo-N]
// placeholders that the save step substitutes for stripped full images.
function imgSrc(v: string): string {
  if (!v) return ''
  if (v.startsWith('data:') || v.startsWith('http')) return v
  if (v.startsWith('[') || v.startsWith('photo-') || v.length < 100) return ''
  const raw  = v.includes('base64,') ? v.split('base64,')[1] : v
  const head = raw.slice(0, 8)
  const mime = head.startsWith('iVBOR') ? 'image/png'
             : head.startsWith('/9j/')  ? 'image/jpeg'
             : head.startsWith('R0lGO') ? 'image/gif'
             : head.startsWith('UklGR') ? 'image/webp'
             : 'image/jpeg'
  return `data:${mime};base64,${raw}`
}

const CONDITION_COLORS: Record<string, string> = {
  above_average: '#1A7A50', good: '#27A96B', typical: '#417CA4',
  fair: '#C4780A', average: '#C4720A', below_average: '#C44000', poor: '#E84545', na: '#9DB4C5',
}

const SEVERITY_COLORS: Record<string, string> = {
  none: GREEN, minor: '#C4780A', moderate: ORANGE, major: '#C44000', critical: RED,
}

function ConditionBadge({ condition }: { condition: string }) {
  const color = CONDITION_COLORS[condition] ?? BLUE
  const label = condition.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <span style={{ fontSize:'0.62rem', fontWeight:700, color, background:`${color}14`, padding:'0.18rem 0.6rem', borderRadius:5, border:`1px solid ${color}33` }}>
      {label}
    </span>
  )
}

function SeverityDot({ severity }: { severity: string }) {
  if (!severity || severity === 'none') return null
  const color = SEVERITY_COLORS[severity] ?? BLUE
  const label = severity.charAt(0).toUpperCase() + severity.slice(1)
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', fontSize:'0.62rem', fontWeight:600, color }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0 }}/>
      {label}
    </span>
  )
}

export default function PhaseCompleteSummary({ job, phase, onUpdate, onBack, onEditModule }: Props) {
  const meta = PHASE_META[phase.id]
  const [phaseNotes, setPhaseNotes] = useState(phase.phaseNotes || '')
  const [editingNotes, setEditingNotes] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [reportDone, setReportDone] = useState(false)
  const [reportB64, setReportB64] = useState<string|null>(null)

  // Photos are stripped to [photo-N] placeholders when a job is saved, but the
  // full base64 survives in session/local storage under insp_<id>. Recover the
  // real photos per module so thumbnails render instead of broken tiles.
  const recoveredPhotos: Record<string, string[]> = (() => {
    const map: Record<string, string[]> = {}
    try {
      const raw = sessionStorage.getItem(`insp_${job.id}`) || localStorage.getItem(`insp_${job.id}`)
      if (!raw) return map
      const full = JSON.parse(raw)
      const fullPhase = full?.phases?.find((p: any) => p.id === phase.id)
      for (const m of fullPhase?.modules ?? []) {
        const real = [...(m.photos || []), ...(m.findings || []).flatMap((f: any) => f.photos || [])]
          .filter((p: string) => imgSrc(p))
        if (real.length) map[m.id] = real
      }
    } catch {}
    return map
  })()

  const completedModules = phase.modules.filter(m =>
    m.status === 'complete' && (m.findings.length > 0 || m.notes || m.photos.length > 0)
  )
  const skippedModules = phase.modules.filter(m => m.status === 'skipped')

  function saveNotes() {
    const newJob: InspectionJob = {
      ...job,
      phases: job.phases.map(p => p.id === phase.id ? { ...p, phaseNotes } : p),
    }
    onUpdate(newJob)
    setEditingNotes(false)
  }

  function reopenPhase() {
    const newJob: InspectionJob = {
      ...job,
      phases: job.phases.map(p => p.id === phase.id ? { ...p, status: 'in_progress' } : p),
    }
    onUpdate(newJob)
    onBack()
  }

  async function generatePhaseReport() {
    setGeneratingReport(true)
    try {
      const res  = await fetch('/api/report/generate-phase', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job: { ...job, phases: job.phases.map(p => p.id === phase.id ? { ...p, phaseNotes } : p) },
          phaseId: phase.id,
        }),
      })
      const data = await res.json()
      if (data.ok && data.pdfB64) {
        setReportB64(data.pdfB64)
        setReportDone(true)
        // Store on phase
        const newJob: InspectionJob = {
          ...job,
          phases: job.phases.map(p => p.id === phase.id
            ? { ...p, reportPdfB64: data.pdfB64, reportGeneratedAt: new Date().toISOString() }
            : p
          ),
        }
        onUpdate(newJob)
      }
    } catch {}
    setGeneratingReport(false)
  }

  function downloadReport() {
    const b64 = reportB64 || phase.reportPdfB64
    if (!b64) return
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const blob  = new Blob([bytes], { type: 'application/pdf' })
    const url   = URL.createObjectURL(blob)
    const a     = document.createElement('a')
    a.href = url; a.download = `${meta?.shortLabel ?? phase.id}-report.pdf`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ minHeight:'100dvh', background:BG, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:'#0D1E2E' }}>

      {/* ── Header ── */}
      <div style={{ background:NAVY, paddingTop:'max(env(safe-area-inset-top,0px),1rem)', paddingBottom:'1.25rem', paddingLeft:'1.25rem', paddingRight:'1.25rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:'0.85rem', cursor:'pointer', padding:0 }}>← Dashboard</button>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:GREEN }}/>
            <span style={{ fontSize:'0.68rem', fontWeight:600, color:GREEN }}>Complete</span>
          </div>
        </div>
        <h2 style={{ fontSize:'1.15rem', fontWeight:700, color:'#fff', margin:'0 0 0.2rem' }}>{meta?.label}</h2>
        <p style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.45)', margin:0 }}>
          {completedModules.length} module{completedModules.length !== 1 ? 's' : ''} complete
          {skippedModules.length > 0 ? ` · ${skippedModules.length} skipped` : ''}
        </p>
      </div>

      <div style={{ padding:'1.25rem 1.25rem 6rem', display:'flex', flexDirection:'column', gap:'0.85rem' }}>

        {/* ── No findings yet ── */}
        {completedModules.length === 0 && (
          <div style={{ textAlign:'center', padding:'2rem 1rem', color:'#5E7D9B', fontSize:'0.85rem', lineHeight:1.65 }}>
            Phase marked complete. No observations recorded yet.
            <br/>
            <button onClick={reopenPhase} style={{ marginTop:'0.75rem', padding:'0.65rem 1.25rem', background:BLUE, border:'none', borderRadius:9, color:'#fff', fontWeight:700, cursor:'pointer', display:'block', margin:'0.75rem auto 0' }}>
              Add observations →
            </button>
          </div>
        )}

        {/* ── Module findings ── */}
        {completedModules.map(mod => {
          const modMeta = MODULE_META[mod.id]
          const mainFinding = mod.findings[0]
          const livePhotos = [...(mod.photos || []), ...mod.findings.flatMap(f => f.photos || [])].filter(p => imgSrc(p))
          const allPhotos = (livePhotos.length > 0 ? livePhotos : (recoveredPhotos[mod.id] || [])).slice(0, 4)

          return (
            <div key={mod.id} style={{ background:'#fff', border:`1px solid ${mainFinding?.severity && mainFinding.severity !== 'none' ? `${SEVERITY_COLORS[mainFinding.severity]}33` : BORDER}`, borderRadius:12, overflow:'hidden' }}>

              {/* Module header */}
              <div style={{ padding:'0.85rem 1rem', display:'flex', alignItems:'center', gap:'0.65rem', borderBottom:`1px solid ${BORDER}` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'0.88rem', fontWeight:700, color:'#0D1E2E', marginBottom:'0.25rem' }}>
                    {modMeta?.label ?? mod.id.replace(/_/g,' ')}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
                    {mainFinding?.condition && <ConditionBadge condition={mainFinding.condition as string}/>}
                    {mainFinding?.severity && mainFinding.severity !== 'none' && <SeverityDot severity={mainFinding.severity}/>}
                    {modMeta?.codeRef && <span style={{ fontSize:'0.6rem', color:'#9DB4C5' }}>{modMeta.codeRef}</span>}
                  </div>
                </div>
                {/* Action buttons */}
                <div style={{ display:'flex', gap:'0.35rem', flexShrink:0 }}>
                  <button
                    onClick={() => onEditModule(mod.id as ModuleId)}
                    style={{ padding:'0.35rem 0.7rem', background:'rgba(65,124,164,0.08)', border:`1px solid rgba(65,124,164,0.25)`, borderRadius:7, fontSize:'0.68rem', fontWeight:600, color:BLUE, cursor:'pointer' }}>
                    Edit
                  </button>
                </div>
              </div>

              {/* Findings detail */}
              {mod.findings.map((finding, i) => (
                <div key={i} style={{ padding:'0.75rem 1rem', borderBottom: i < mod.findings.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                  {finding.notes && (
                    <div style={{ fontSize:'0.8rem', color:'#0D1E2E', lineHeight:1.65, marginBottom:'0.4rem' }}>
                      <span style={{ fontSize:'0.65rem', fontWeight:700, color:'#5E7D9B', textTransform:'uppercase', letterSpacing:'0.04em' }}>Observations </span>
                      {finding.notes}
                    </div>
                  )}
                  {finding.recommendation && (
                    <div style={{ fontSize:'0.78rem', color:'#3A5A78', lineHeight:1.6, background:'rgba(65,124,164,0.05)', borderRadius:7, padding:'0.55rem 0.75rem', borderLeft:`3px solid rgba(65,124,164,0.3)` }}>
                      <span style={{ fontSize:'0.62rem', fontWeight:700, color:BLUE, textTransform:'uppercase', letterSpacing:'0.04em', display:'block', marginBottom:'0.15rem' }}>Recommendation</span>
                      {finding.recommendation}
                    </div>
                  )}
                </div>
              ))}

              {/* Module notes */}
              {mod.notes && mod.findings.length === 0 && (
                <div style={{ padding:'0.75rem 1rem', fontSize:'0.8rem', color:'#3A5A78', lineHeight:1.65 }}>
                  {mod.notes}
                </div>
              )}

              {/* Photos */}
              {allPhotos.length > 0 && (
                <div style={{ padding:'0.65rem 1rem', borderTop:`1px solid ${BORDER}`, display:'flex', gap:'0.4rem', overflowX:'auto' }}>
                  {allPhotos.map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={imgSrc(p)} alt={`Photo ${i+1}`}
                      style={{ width:72, height:72, borderRadius:7, objectFit:'cover', flexShrink:0, border:`1px solid ${BORDER}` }}/>
                  ))}
                  <button
                    onClick={() => onEditModule(mod.id as ModuleId)}
                    style={{ width:72, height:72, borderRadius:7, background:BG, border:`1.5px dashed rgba(65,124,164,0.3)`, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.2rem', flexShrink:0 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke={BLUE} strokeWidth="1.3"/>
                      <line x1="8" y1="5" x2="8" y2="11" stroke={BLUE} strokeWidth="1.3" strokeLinecap="round"/>
                      <line x1="5" y1="8" x2="11" y2="8" stroke={BLUE} strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    <span style={{ fontSize:'0.58rem', color:BLUE }}>Add</span>
                  </button>
                </div>
              )}
              {allPhotos.length === 0 && (
                <div style={{ padding:'0.5rem 1rem', borderTop:`1px solid ${BORDER}` }}>
                  <button onClick={() => onEditModule(mod.id as ModuleId)}
                    style={{ fontSize:'0.7rem', color:BLUE, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>
                    + Add photos or re-analyze
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* ── Skipped modules ── */}
        {skippedModules.length > 0 && (
          <div style={{ background:'rgba(44,90,122,0.04)', border:`1px solid rgba(44,90,122,0.1)`, borderRadius:10, padding:'0.75rem 1rem' }}>
            <div style={{ fontSize:'0.65rem', fontWeight:700, color:'#9DB4C5', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'0.4rem' }}>Skipped</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.3rem' }}>
              {skippedModules.map(m => (
                <span key={m.id} style={{ fontSize:'0.7rem', color:'#9DB4C5', background:'rgba(44,90,122,0.07)', padding:'0.2rem 0.6rem', borderRadius:5 }}>
                  {MODULE_META[m.id]?.label ?? m.id}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Phase notes ── */}
        <div style={{ background:'#fff', border:`1px solid ${BORDER}`, borderRadius:12, padding:'0.9rem 1rem' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.45rem' }}>
            <div style={{ fontSize:'0.68rem', fontWeight:700, color:BLUE, letterSpacing:'0.04em', textTransform:'uppercase' as const }}>Phase Notes</div>
            {!editingNotes && (
              <button onClick={() => setEditingNotes(true)} style={{ fontSize:'0.7rem', color:BLUE, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>Edit</button>
            )}
          </div>
          {editingNotes ? (
            <>
              <textarea value={phaseNotes} onChange={e => setPhaseNotes(e.target.value)} rows={3}
                placeholder="General observations for this phase…"
                style={{ width:'100%', padding:'0.6rem 0.8rem', background:BG, border:`1px solid ${BORDER}`, borderRadius:8, fontSize:'0.82rem', color:'#0D1E2E', outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.55 }}/>
              <div style={{ display:'flex', gap:'0.4rem', marginTop:'0.5rem' }}>
                <button onClick={saveNotes} style={{ padding:'0.45rem 1rem', background:GREEN, border:'none', borderRadius:7, color:'#fff', fontWeight:700, fontSize:'0.78rem', cursor:'pointer' }}>Save</button>
                <button onClick={() => { setPhaseNotes(phase.phaseNotes || ''); setEditingNotes(false) }} style={{ padding:'0.45rem 0.75rem', background:BG, border:`1px solid ${BORDER}`, borderRadius:7, color:'#5E7D9B', fontSize:'0.78rem', cursor:'pointer' }}>Cancel</button>
              </div>
            </>
          ) : (
            <div style={{ fontSize:'0.82rem', color: phaseNotes ? '#3A5A78' : '#C4CBD6', lineHeight:1.65, fontStyle: phaseNotes ? 'normal' : 'italic' }}>
              {phaseNotes || 'No phase notes. Tap Edit to add.'}
            </div>
          )}
        </div>

        {/* ── Phase actions ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          {/* Phase report */}
          <button onClick={generatePhaseReport} disabled={generatingReport}
            style={{ width:'100%', padding:'0.85rem', background: generatingReport ? 'rgba(65,124,164,0.4)' : `linear-gradient(135deg,${BLUE},#2C5A7A)`, border:'none', borderRadius:11, color:'#fff', fontWeight:700, fontSize:'0.85rem', cursor: generatingReport ? 'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem' }}>
            {generatingReport ? (
              <><div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.7s linear infinite' }}/> Generating…</>
            ) : (
              phase.reportPdfB64 ? '↺ Re-generate Phase Report' : 'Generate Phase Report →'
            )}
          </button>

          {(reportDone || phase.reportPdfB64) && (
            <button onClick={downloadReport}
              style={{ width:'100%', padding:'0.8rem', background:'rgba(39,169,107,0.1)', border:`1.5px solid rgba(39,169,107,0.35)`, borderRadius:11, color:GREEN, fontWeight:700, fontSize:'0.82rem', cursor:'pointer' }}>
              Download Phase PDF
            </button>
          )}

          {/* Reopen phase */}
          <button onClick={reopenPhase}
            style={{ width:'100%', padding:'0.8rem', background:'#fff', border:`1.5px solid ${BORDER}`, borderRadius:11, color:'#5E7D9B', fontWeight:600, fontSize:'0.82rem', cursor:'pointer' }}>
            Reopen phase to edit
          </button>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
