'use client'
/**
 * InspectionPhaseScreen.tsx
 *
 * Shows all modules within a single inspection phase.
 * Each module can be:
 *   - A standard capture (photo + notes + condition picker)
 *   - A built-in scan (routes to existing stAIrcode scan screens)
 * Tapping a module opens InspectionModuleCapture.
 */

import { useState } from 'react'
import type { InspectionJob, PhaseId, ModuleId, InspectionModule } from '@/lib/inspection-types'
import { PHASE_META, MODULE_META, getPhaseProgress } from '@/lib/inspection-types'
import InspectionModuleCapture from './InspectionModuleCapture'
import DrawingsReviewModule    from './DrawingsReviewModule'
import PhaseCompleteSummary   from './PhaseCompleteSummary'

import type { UserRole } from './AuthScreen'

interface Props {
  job:        InspectionJob
  phaseId:    PhaseId
  onUpdate:   (job: InspectionJob) => void
  onBack:     () => void
  userRole?:  UserRole
  userEmail?: string
}

// Modules that use the specialised DrawingsReviewModule instead of generic capture
const DRAWINGS_MODULES = new Set(['drawings_review', 'permit_issuance', 'site_plan_review'])

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const GREEN  = '#27A96B'
const ORANGE = '#F29337'
const RED    = '#E84545'
const BORDER = 'rgba(44,90,122,0.14)'
const BG     = '#F4F7FB'

// Condition colour
const CONDITION_COLORS: Record<string, string> = {
  good: GREEN, above_average: GREEN,
  typical: BLUE, average: BLUE, fair: ORANGE,
  below_average: RED, poor: RED,
}

function ModuleStatusDot({ status, condition }: { status: string; condition?: string }) {
  const color = status === 'complete' ? (condition ? (CONDITION_COLORS[condition] ?? GREEN) : GREEN)
              : status === 'skipped'  ? '#9DB4C5'
              : status === 'in_progress' ? ORANGE
              : 'transparent'
  const borderColor = status === 'pending' ? BORDER : color
  return (
    <div style={{ width:10, height:10, borderRadius:'50%', background:color, border:`2px solid ${borderColor}`, flexShrink:0, transition:'all 0.2s' }}/>
  )
}

function ModuleCard({ module, onClick }: { module: InspectionModule; onClick: () => void }) {
  const meta      = MODULE_META[module.id]
  const isBuiltIn = module.isBuiltIn
  const done      = module.status === 'complete'
  const skipped   = module.status === 'skipped'
  const active    = module.status === 'in_progress'
  const condition = module.findings[0]?.condition

  const borderColor = done    ? 'rgba(39,169,107,0.35)'
                    : active  ? `rgba(65,124,164,0.4)`
                    : skipped ? 'rgba(147,186,212,0.2)'
                    : BORDER

  const bgColor = done   ? 'rgba(39,169,107,0.03)'
                : active ? 'rgba(65,124,164,0.04)'
                : '#fff'

  return (
    <button onClick={onClick}
      style={{ width:'100%', padding:'0.8rem 0.9rem', background:bgColor, border:`1px solid ${borderColor}`, borderRadius:9, display:'flex', alignItems:'center', gap:'0.75rem', cursor:'pointer', textAlign:'left', transition:'all 0.12s', opacity: skipped ? 0.55 : 1 }}>
      <ModuleStatusDot status={module.status} condition={condition as string|undefined} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'0.83rem', fontWeight:600, color:'#0D1E2E', marginBottom:'0.05rem' }}>
          {meta?.label ?? module.id.replace(/_/g,' ')}
          {isBuiltIn && <span style={{ marginLeft:'0.4rem', fontSize:'0.58rem', fontWeight:600, color:BLUE, background:'rgba(65,124,164,0.1)', padding:'0.1rem 0.4rem', borderRadius:4, border:`1px solid rgba(65,124,164,0.25)` }}>AI Scan</span>}
          {meta?.required && !done && <span style={{ marginLeft:'0.35rem', fontSize:'0.58rem', color:ORANGE }}>*</span>}
        </div>
        <div style={{ fontSize:'0.68rem', color:'#5E7D9B', lineHeight:1.4 }}>
          {done && condition ? `${condition.replace(/_/g,' ')} · ` : ''}{meta?.description ?? ''}
        </div>
        {module.notes && done && <div style={{ fontSize:'0.65rem', color:'#7A96AF', marginTop:'0.2rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{module.notes}</div>}
      </div>
      <div style={{ color:'#9DB4C5', fontSize:'0.85rem', flexShrink:0 }}>
        {done ? 'Done' : skipped ? 'Skip' : '>'}
      </div>
    </button>
  )
}

export default function InspectionPhaseScreen({ job, phaseId, onUpdate, onBack, userRole = 'diy', userEmail = '' }: Props) {
  const [activeModule, setActiveModule] = useState<ModuleId | null>(null)
  const [editMode,     setEditMode]     = useState(false)  // force edit mode on complete phase
  const [saveStatus,  setSaveStatus]  = useState<'idle'|'saving'|'saved'|'error'>('idle')

  const phase   = job.phases.find(p => p.id === phaseId)!
  const meta_ph = PHASE_META[phaseId]

  // ── Not Applicable screen ────────────────────────────────────────────────
  if (phase?.status === 'not_applicable') {
    return (
      <div style={{ minHeight:'100dvh', background:'#F4F7FB', fontFamily:"inherit", color:'#0D1E2E' }}>
        <div style={{ background:'#0A1C2E', padding:'max(env(safe-area-inset-top,0px),1rem) 1.25rem 1.25rem' }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:'0.85rem', cursor:'pointer', padding:0 }}>← Back</button>
          <h2 style={{ fontSize:'1.1rem', fontWeight:700, color:'#fff', margin:'0.5rem 0 0.1rem' }}>{meta_ph?.label}</h2>
          <p style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.45)', margin:0 }}>Not applicable to this inspection</p>
        </div>
        <div style={{ padding:'2.5rem 1.25rem', display:'flex', flexDirection:'column', gap:'1.25rem', alignItems:'center', textAlign:'center' }}>
          <div style={{ width:60, height:60, borderRadius:'50%', background:'rgba(44,90,122,0.08)', border:'1.5px solid rgba(44,90,122,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <circle cx="13" cy="13" r="11" stroke="#C4CBD6" strokeWidth="1.5"/>
              <line x1="6" y1="20" x2="20" y2="6" stroke="#C4CBD6" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:'1rem', fontWeight:700, color:'#0D1E2E', marginBottom:'0.4rem' }}>Excluded from this inspection</div>
            <div style={{ fontSize:'0.82rem', color:'#5E7D9B', lineHeight:1.65, maxWidth:300 }}>
              This phase has been marked Not Applicable. It will be omitted from the report.
            </div>
          </div>
          <button
            onClick={() => {
              const newJob = {
                ...job, updatedAt: new Date().toISOString(),
                phases: job.phases.map(p => p.id !== phaseId ? p : { ...p, status: 'pending' as const })
              }
              onUpdate(newJob)
              try { sessionStorage.setItem(`insp_${newJob.id}`, JSON.stringify(newJob)) } catch {}
              onBack()
            }}
            style={{ padding:'0.85rem 1.75rem', background:'linear-gradient(135deg,#417CA4,#2C5A7A)', border:'none', borderRadius:11, color:'#fff', fontWeight:700, fontSize:'0.88rem', cursor:'pointer', boxShadow:'0 4px 14px rgba(65,124,164,0.3)' }}>
            Reinstate this phase →
          </button>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'#9DB4C5', fontSize:'0.8rem', cursor:'pointer' }}>Back to dashboard</button>
        </div>
      </div>
    )
  }
  const meta    = PHASE_META[phaseId]
  const pct     = getPhaseProgress(phase)
  const done    = phase.modules.filter(m => m.status === 'complete').length
  const total   = phase.modules.length

  function handleModuleUpdate(updatedModule: InspectionModule, drawingsData?: InspectionJob['drawingsData']) {
    // If this is the property_details module and has a photo, set it as the job thumbnail
    // so it shows on the project list across devices (survives Supabase photo stripping)
    const firstRealPhoto = updatedModule.photos?.find(p => p && !p.startsWith('['))
    const thumbnailUpdate = (updatedModule.id === 'property_details' && firstRealPhoto)
      ? { propertyThumbnail: firstRealPhoto }
      : {}

    const newJob: InspectionJob = {
      ...job,
      updatedAt: new Date().toISOString(),
      ...(drawingsData ? { drawingsData } : {}),
      ...thumbnailUpdate,
      phases: job.phases.map(p =>
        p.id !== phaseId ? p : {
          ...p,
          status: p.modules.every(m => m.status === 'complete' || m.status === 'skipped') ? 'complete'
                : p.modules.some(m => m.status === 'complete' || m.status === 'in_progress') ? 'in_progress'
                : 'pending',
          modules: p.modules.map(m => m.id === updatedModule.id ? updatedModule : m),
        }
      ),
    }
    onUpdate(newJob)
    try { sessionStorage.setItem(`insp_${job.id}`, JSON.stringify(newJob)) } catch {}
    setActiveModule(null)
  }

  async function handleManualSave() {
    setSaveStatus('saving')
    try {
      // Persist the job (including updated phases) to Supabase
      const res = await fetch('/api/inspection/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job, userId: userEmail || job.inspectorEmail || '' }),
      })
      const data = await res.json()
      setSaveStatus(data.ok ? 'saved' : 'error')
    } catch {
      setSaveStatus('error')
    }
    setTimeout(() => setSaveStatus('idle'), 2500)
  }

  function markPhaseComplete() {
    const newJob: InspectionJob = {
      ...job,
      updatedAt: new Date().toISOString(),
      phases: job.phases.map(p =>
        p.id !== phaseId ? p : {
          ...p,
          status: 'complete',
          completedAt: new Date().toISOString(),
          modules: p.modules.map(m => m.status === 'pending' ? { ...m, status: 'skipped' } : m),
        }
      ),
    }
    onUpdate(newJob)
    try { sessionStorage.setItem(`insp_${job.id}`, JSON.stringify(newJob)) } catch {}
    onBack()
  }

  // If a module is open, render that
  if (activeModule) {
    const mod = phase.modules.find(m => m.id === activeModule)!
    // Route pre-construction drawing modules to the specialised DrawingsReviewModule
    if (DRAWINGS_MODULES.has(activeModule)) {
      return (
        <DrawingsReviewModule
          job={job}
          module={mod}
          onSave={handleModuleUpdate}
          onBack={() => { setActiveModule(null); /* stay in edit mode so user can edit other modules */ }}
        />
      )
    }
    return (
      <InspectionModuleCapture
        job={job}
        phase={phase}
        module={mod}
        userRole={userRole}
        onSave={handleModuleUpdate}
        onBack={() => { setActiveModule(null); /* stay in edit mode so user can edit other modules */ }}
      />
    )
  }

  // ── Completed phase — show summary view unless in edit mode ────────────────
  if (phase.status === 'complete' && !editMode && !activeModule) {
    return (
      <PhaseCompleteSummary
        job={job}
        phase={phase}
        onUpdate={onUpdate}
        onBack={onBack}
        onEditModule={(moduleId) => {
          setEditMode(true)
          setActiveModule(moduleId)
        }}
      />
    )
  }

  const required    = phase.modules.filter(m => MODULE_META[m.id]?.required)
  const reqDone     = required.filter(m => m.status === 'complete').length
  const canComplete = reqDone >= required.length || done >= Math.ceil(total * 0.5)

  return (
    <div style={{ minHeight:'100dvh', background:BG, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:'#0D1E2E' }}>

      {/* ── Header ── */}
      <div style={{ background:NAVY, paddingTop:'max(env(safe-area-inset-top,0px),1rem)', paddingBottom:'1.25rem', paddingLeft:'1.25rem', paddingRight:'1.25rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.75rem' }}>
          <button onClick={() => { if (editMode) { setEditMode(false); setActiveModule(null) } else onBack() }} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.55)', fontSize:'0.85rem', cursor:'pointer', padding:0 }}>
            {editMode ? '← Summary' : '← Dashboard'}
          </button>
          <div style={{ flex:1 }}/>
          <div style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.4)', padding:'0.18rem 0.55rem', border:'1px solid rgba(255,255,255,0.12)', borderRadius:5 }}>
            {meta.reportSection}
          </div>
        </div>

        {/* Phase summary */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.4)', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', marginBottom:'0.2rem' }}>Phase</div>
            <h2 style={{ fontSize:'1.15rem', fontWeight:700, color:'#fff', margin:'0 0 0.25rem', lineHeight:1.2 }}>{meta.label}</h2>
            <p style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.5)', margin:0, lineHeight:1.5 }}>{meta.description}</p>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:'1.4rem', fontWeight:700, color: pct === 100 ? GREEN : ORANGE }}>{pct}%</div>
            <div style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.4)' }}>{done}/{total} done</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height:3, background:'rgba(255,255,255,0.1)', borderRadius:2, marginTop:'0.85rem', overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background: pct === 100 ? GREEN : ORANGE, transition:'width 0.4s ease', borderRadius:2 }}/>
        </div>
      </div>

      {/* ── Module list ── */}
      <div style={{ padding:'1.25rem 1.25rem 7rem' }}>
        <div style={{ fontSize:'0.68rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.6rem', letterSpacing:'0.03em' }}>
          Modules · <span style={{ color:ORANGE }}>* required</span>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
          {phase.modules.map(mod => (
            <ModuleCard key={mod.id} module={mod} onClick={() => setActiveModule(mod.id)} />
          ))}
        </div>

        {/* Phase notes */}
        <div style={{ marginTop:'1.25rem' }}>
          <div style={{ fontSize:'0.7rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.35rem' }}>Phase notes</div>
          <textarea
            value={phase.phaseNotes}
            onChange={e => {
              const newJob = { ...job, phases: job.phases.map(p => p.id === phaseId ? { ...p, phaseNotes: e.target.value } : p) }
              onUpdate(newJob)
            }}
            placeholder="General observations for this phase…"
            rows={3}
            style={{ width:'100%', padding:'0.7rem 0.85rem', background:'#fff', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:'0.82rem', color:'#0D1E2E', outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.55 }}
          />
        </div>

        {/* Complete phase */}
        <div style={{ marginTop:'1rem', display:'flex', gap:'0.6rem' }}>
          <button onClick={onBack}
            style={{ flex:1, padding:'0.85rem', background:'#fff', border:`1.5px solid ${BORDER}`, borderRadius:10, fontSize:'0.82rem', fontWeight:600, color:'#5E7D9B', cursor:'pointer' }}>
            Save & Back
          </button>
          <button onClick={markPhaseComplete} disabled={!canComplete}
            style={{ flex:2, padding:'0.85rem', background:canComplete?`linear-gradient(135deg,${GREEN},#1A7A50)`:'rgba(39,169,107,0.1)', border:'none', borderRadius:10, fontSize:'0.82rem', fontWeight:700, color:canComplete?'#fff':'rgba(39,169,107,0.4)', cursor:canComplete?'pointer':'not-allowed', transition:'all 0.15s' }}>
            {phase.status === 'complete' ? 'Phase Complete' : 'Mark Phase Complete →'}
          </button>
        </div>
        {!canComplete && (
          <div style={{ fontSize:'0.65rem', color:'#9DB4C5', textAlign:'center', marginTop:'0.35rem' }}>
            Complete required modules (*) or at least 50% to finish this phase
          </div>
        )}
        {phase.holdPoint && phase.status !== 'complete' && (
          <div style={{ fontSize:'0.68rem', color:'#C4721E', background:'rgba(242,147,55,0.08)', border:'1px solid rgba(242,147,55,0.25)', borderRadius:8, padding:'0.6rem 0.85rem', marginTop:'0.5rem', lineHeight:1.55 }}>
            OBC Hold Point — inspector sign-off required before proceeding to the next phase.
          </div>
        )}
      </div>
    </div>
  )
}
