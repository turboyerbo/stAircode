'use client'
/**
 * InspectionModuleCapture.tsx
 *
 * Photo capture, condition rating, notes and defect findings for a single module.
 * For built-in modules (isBuiltIn=true), shows a card to launch the existing scan screen.
 */

import { useState, useRef, useCallback } from 'react'
import type { InspectionJob, InspectionPhase, InspectionModule, ModuleFinding, OverallCondition, DefectSeverity } from '@/lib/inspection-types'
import { MODULE_META } from '@/lib/inspection-types'

interface Props {
  job:    InspectionJob
  phase:  InspectionPhase
  module: InspectionModule
  onSave: (m: InspectionModule) => void
  onBack: () => void
}

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const GREEN  = '#27A96B'
const ORANGE = '#F29337'
const RED    = '#E84545'
const BORDER = 'rgba(44,90,122,0.14)'

const CONDITIONS: { value: OverallCondition|'good'|'fair'; label: string; color: string }[] = [
  { value:'above_average', label:'Above Average', color:'#1A7A50' },
  { value:'good',          label:'Good',          color:GREEN    },
  { value:'typical',       label:'Typical',       color:BLUE     },
  { value:'fair',          label:'Fair',          color:'#C48A00'},
  { value:'average',       label:'Average',       color:ORANGE   },
  { value:'below_average', label:'Below Average', color:'#C44000'},
  { value:'poor',          label:'Poor',          color:RED      },
]

const SEVERITIES: { value: DefectSeverity; label: string }[] = [
  { value:'none',     label:'None'     },
  { value:'minor',    label:'Minor'    },
  { value:'moderate', label:'Moderate' },
  { value:'major',    label:'Major'    },
  { value:'critical', label:'Critical' },
]

export default function InspectionModuleCapture({ job, phase, module, onSave, onBack }: Props) {
  const meta     = MODULE_META[module.id]
  const fileRef  = useRef<HTMLInputElement>(null)

  // State — initialise from existing module data
  const [photos,    setPhotos]    = useState<string[]>(module.photos ?? [])
  const [notes,     setNotes]     = useState(module.notes ?? '')
  const [condition, setCondition] = useState<string>(module.findings[0]?.condition ?? '')
  const [severity,  setSeverity]  = useState<DefectSeverity>(module.findings[0]?.severity ?? 'none')
  const [findNote,  setFindNote]  = useState(module.findings[0]?.notes ?? '')
  const [recommend, setRecommend] = useState(module.findings[0]?.recommendation ?? '')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult,  setAiResult]  = useState<string | null>(null)
  const [status,    setStatus]    = useState(module.status === 'pending' ? 'in_progress' : module.status)

  // ── Photo capture from file input ─────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        const b64 = (ev.target?.result as string).split(',')[1]
        if (b64) setPhotos(prev => [...prev, b64])
      }
      reader.readAsDataURL(file)
    })
  }

  // ── AI analysis of the latest photo ──────────────────────────────────────
  const analyseWithAI = useCallback(async () => {
    const latestPhoto = photos[photos.length - 1]
    if (!latestPhoto) return
    setAiLoading(true)
    setAiResult(null)
    try {
      const prompt = `You are a professional building inspector assessing ${meta?.label ?? module.id.replace(/_/g,' ')} for a residential property inspection in ${job.address.city}, ${job.address.province}.

Inspect the image and provide:
1. Overall condition (choose: above_average / good / typical / fair / average / below_average / poor)
2. Defect severity (choose: none / minor / moderate / major / critical)
3. Specific observations (2-3 sentences)
4. Recommendation for the client (1-2 sentences)

Reply ONLY with valid JSON:
{
  "condition": "string",
  "severity": "string",
  "observations": "string",
  "recommendation": "string"
}`

      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageB64: latestPhoto, prompt }),
      })
      if (!res.ok) throw new Error('Vision API error')
      const data = await res.json()
      const raw  = data.text ?? ''
      const m    = raw.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
      if (m) {
        const parsed = JSON.parse(m[0])
        if (parsed.condition) setCondition(parsed.condition)
        if (parsed.severity)  setSeverity(parsed.severity as DefectSeverity)
        if (parsed.observations)  setFindNote(parsed.observations)
        if (parsed.recommendation) setRecommend(parsed.recommendation)
        setAiResult(`Analysis complete. Condition: ${parsed.condition}, Severity: ${parsed.severity}.`)
      }
    } catch {
      setAiResult('AI analysis failed. Please fill in the fields manually.')
    }
    setAiLoading(false)
  }, [photos, module.id, meta, job])

  // ── Save ─────────────────────────────────────────────────────────────────
  function handleSave(newStatus: 'complete' | 'skipped' | 'in_progress' = 'complete') {
    const finding: ModuleFinding = {
      id:         `find-${Date.now()}`,
      label:      meta?.label ?? module.id,
      condition:  (condition as any) || 'typical',
      severity:   severity,
      notes:      findNote,
      recommendation: recommend || undefined,
      photos,
    }
    const updated: InspectionModule = {
      ...module,
      status:     newStatus,
      photos,
      notes,
      findings:   condition ? [finding] : [],
      capturedAt: new Date().toISOString(),
    }
    onSave(updated)
  }

  // ── Built-in module card ─────────────────────────────────────────────────
  if (meta?.isBuiltIn) {
    const scanLabels: Record<string, string> = {
      stair_compliance:      'Launch Stair Compliance Scan',
      foundation_inspection: 'Launch Foundation Scan',
      accessibility:         'Launch Accessibility Scan',
    }
    return (
      <div style={{ minHeight:'100dvh', background:'#F4F7FB', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:'#0D1E2E' }}>
        <div style={{ background:NAVY, padding:'max(env(safe-area-inset-top,0px),1rem) 1.25rem 1.25rem' }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.55)', fontSize:'0.85rem', cursor:'pointer', padding:0 }}>← Back to phase</button>
          <h2 style={{ fontSize:'1.1rem', fontWeight:700, color:'#fff', margin:'0.5rem 0 0.15rem' }}>{meta.label}</h2>
          <p style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.5)', margin:0 }}>{meta.description}</p>
        </div>
        <div style={{ padding:'1.5rem 1.25rem' }}>
          <div style={{ background:'#fff', border:`1.5px solid rgba(65,124,164,0.3)`, borderRadius:14, padding:'1.5rem', display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <div style={{ fontSize:'0.72rem', color:BLUE, fontWeight:600 }}>This module uses stAIrcode&apos;s guided AI scan.</div>
            <p style={{ fontSize:'0.82rem', color:'#5E7D9B', lineHeight:1.65, margin:0 }}>{meta.description}</p>
            <a
              href={module.id === 'stair_compliance' ? '/?module=stair' : module.id === 'foundation_inspection' ? '/?module=foundation' : '/?module=accessibility'}
              style={{ display:'block', padding:'0.9rem', background:`linear-gradient(135deg,${BLUE},#2C5A7A)`, borderRadius:10, color:'#fff', fontWeight:700, fontSize:'0.875rem', textDecoration:'none', textAlign:'center' }}>
              {scanLabels[module.id] ?? 'Launch Scan'} →
            </a>
            <div style={{ height:1, background:BORDER }}/>
            <div style={{ fontSize:'0.7rem', color:'#9DB4C5' }}>Or mark this module manually:</div>
            <div style={{ display:'flex', gap:'0.5rem' }}>
              <button onClick={() => handleSave('skipped')}
                style={{ flex:1, padding:'0.7rem', background:'rgba(44,90,122,0.07)', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:'0.78rem', fontWeight:600, color:'#5E7D9B', cursor:'pointer' }}>Skip</button>
              <button onClick={() => handleSave('complete')}
                style={{ flex:2, padding:'0.7rem', background:GREEN, border:'none', borderRadius:8, fontSize:'0.78rem', fontWeight:700, color:'#fff', cursor:'pointer' }}>Mark Complete</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#F4F7FB', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:'#0D1E2E' }}>

      {/* ── Header ── */}
      <div style={{ background:NAVY, padding:'max(env(safe-area-inset-top,0px),1rem) 1.25rem 1.25rem' }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.55)', fontSize:'0.85rem', cursor:'pointer', padding:'0 0 0.4rem' }}>← Back to phase</button>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.5rem' }}>
          <div>
            <h2 style={{ fontSize:'1.1rem', fontWeight:700, color:'#fff', margin:'0 0 0.15rem', lineHeight:1.2 }}>{meta?.label ?? module.id}</h2>
            <p style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.5)', margin:0 }}>{meta?.description}</p>
          </div>
          {meta?.required && (
            <span style={{ fontSize:'0.6rem', color:ORANGE, background:'rgba(242,147,55,0.12)', border:`1px solid rgba(242,147,55,0.3)`, padding:'0.18rem 0.5rem', borderRadius:5, flexShrink:0 }}>Required</span>
          )}
        </div>
      </div>

      {/* ── Form ── */}
      <div style={{ padding:'1rem 1.25rem 7rem', display:'flex', flexDirection:'column', gap:'1rem' }}>

        {/* Photo capture */}
        <div>
          <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.5rem' }}>Photos</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem', alignItems:'flex-start' }}>
            {photos.map((p, i) => (
              <div key={i} style={{ position:'relative', width:80, height:80, borderRadius:8, overflow:'hidden', border:`1px solid ${BORDER}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/jpeg;base64,${p}`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                <button onClick={() => setPhotos(prev => prev.filter((_,j) => j !== i))}
                  style={{ position:'absolute', top:2, right:2, width:18, height:18, borderRadius:'50%', background:'rgba(0,0,0,0.6)', border:'none', color:'#fff', fontSize:'0.6rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
              </div>
            ))}
            <button onClick={() => fileRef.current?.click()}
              style={{ width:80, height:80, borderRadius:8, background:'#fff', border:`1.5px dashed rgba(65,124,164,0.35)`, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.25rem' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" stroke={BLUE} strokeWidth="1.5"/>
                <line x1="10" y1="6" x2="10" y2="14" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="6" y1="10" x2="14" y2="10" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize:'0.58rem', color:BLUE }}>Add photo</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFileChange} style={{ display:'none' }}/>
          </div>

          {photos.length > 0 && (
            <button onClick={analyseWithAI} disabled={aiLoading}
              style={{ marginTop:'0.6rem', padding:'0.55rem 1rem', background: aiLoading ? 'rgba(65,124,164,0.1)' : `linear-gradient(135deg,${BLUE},#2C5A7A)`, border:'none', borderRadius:8, fontSize:'0.78rem', fontWeight:600, color: aiLoading ? BLUE : '#fff', cursor: aiLoading ? 'default':'pointer' }}>
              {aiLoading ? 'Analysing…' : 'Analyse with AI →'}
            </button>
          )}
          {aiResult && <div style={{ fontSize:'0.72rem', color: aiResult.includes('failed') ? RED : GREEN, marginTop:'0.4rem' }}>{aiResult}</div>}
        </div>

        {/* Condition */}
        <div>
          <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.5rem' }}>Condition</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'0.35rem' }}>
            {CONDITIONS.map(c => (
              <button key={c.value} onClick={() => setCondition(c.value)}
                style={{ padding:'0.35rem 0.75rem', borderRadius:6, border:`1.5px solid ${condition === c.value ? c.color : BORDER}`, background: condition === c.value ? `${c.color}14` : '#fff', fontSize:'0.75rem', fontWeight: condition === c.value ? 700 : 500, color: condition === c.value ? c.color : '#5E7D9B', cursor:'pointer', transition:'all 0.1s' }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Severity */}
        {condition && condition !== '' && (
          <div>
            <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.5rem' }}>Defect Severity</div>
            <div style={{ display:'flex', gap:'0.35rem' }}>
              {SEVERITIES.map(s => {
                const col = s.value === 'none' ? '#27A96B' : s.value === 'minor' ? '#C48A00' : s.value === 'moderate' ? ORANGE : s.value === 'major' ? '#C44000' : RED
                return (
                  <button key={s.value} onClick={() => setSeverity(s.value)}
                    style={{ flex:1, padding:'0.35rem 0.3rem', borderRadius:6, border:`1.5px solid ${severity === s.value ? col : BORDER}`, background: severity === s.value ? `${col}14` : '#fff', fontSize:'0.68rem', fontWeight: severity === s.value ? 700 : 500, color: severity === s.value ? col : '#9DB4C5', cursor:'pointer', transition:'all 0.1s' }}>
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Findings */}
        <div>
          <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.35rem' }}>Observations</div>
          <textarea value={findNote} onChange={e => setFindNote(e.target.value)} placeholder="Describe what was observed…" rows={3}
            style={{ width:'100%', padding:'0.7rem 0.85rem', background:'#fff', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:'0.82rem', color:'#0D1E2E', outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.55 }}/>
        </div>

        {/* Recommendation */}
        <div>
          <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.35rem' }}>Recommendation</div>
          <textarea value={recommend} onChange={e => setRecommend(e.target.value)} placeholder="Recommended action for the client…" rows={2}
            style={{ width:'100%', padding:'0.7rem 0.85rem', background:'#fff', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:'0.82rem', color:'#0D1E2E', outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.55 }}/>
        </div>

        {/* Inspector notes */}
        <div>
          <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.35rem' }}>Inspector notes (internal)</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Private notes — not included in client report" rows={2}
            style={{ width:'100%', padding:'0.7rem 0.85rem', background:'rgba(44,90,122,0.03)', border:`1px dashed rgba(44,90,122,0.2)`, borderRadius:8, fontSize:'0.78rem', color:'#5E7D9B', outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.55 }}/>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:'0.5rem' }}>
          <button onClick={() => handleSave('skipped')}
            style={{ flex:1, padding:'0.85rem', background:'#fff', border:`1.5px solid ${BORDER}`, borderRadius:10, fontSize:'0.82rem', fontWeight:600, color:'#9DB4C5', cursor:'pointer' }}>
            Skip
          </button>
          <button onClick={() => handleSave('in_progress')}
            style={{ flex:1, padding:'0.85rem', background:'rgba(65,124,164,0.08)', border:`1.5px solid rgba(65,124,164,0.25)`, borderRadius:10, fontSize:'0.82rem', fontWeight:600, color:BLUE, cursor:'pointer' }}>
            Save Draft
          </button>
          <button onClick={() => handleSave('complete')}
            style={{ flex:2, padding:'0.85rem', background:`linear-gradient(135deg,${GREEN},#1A7A50)`, border:'none', borderRadius:10, fontSize:'0.82rem', fontWeight:700, color:'#fff', cursor:'pointer' }}>
            Mark Complete →
          </button>
        </div>
      </div>
    </div>
  )
}
