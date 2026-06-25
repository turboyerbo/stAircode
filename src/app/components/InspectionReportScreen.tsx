'use client'
/**
 * InspectionReportScreen.tsx
 *
 * Final report review screen. Flow:
 *   1. Shows each phase with status: has section / needs generating
 *   2. Per-phase "Generate" button — calls /api/report/generate-phase
 *   3. Inspector cover notes editor
 *   4. AHJ email field + client email field
 *   5. "Assemble Final Report" — calls /api/report/collate
 *   6. Shows final PDF preview info + Download + Send buttons
 */

import { useState, useCallback } from 'react'
import type { InspectionJob, PhaseId } from '@/lib/inspection-types'
import { PHASE_META, getPhaseProgress } from '@/lib/inspection-types'

// Strip photos and phase PDFs from job before sending over the wire.
// Photos are already embedded in phase PDFs; sending them again doubles payload size.
// Phase PDFs are sent as a separate phasePdfs map in the collate call.
function stripJobForTransport(job: InspectionJob, keepPhaseId?: string): Omit<InspectionJob, 'drawingsData'> & { drawingsData?: undefined } {
  return {
    ...job,
    drawingsData: undefined,          // drawing pages can be 2-5MB alone
    phases: job.phases.map(phase => ({
      ...phase,
      reportPdfB64:      undefined,   // sent separately in phasePdfs map
      reportGeneratedAt: phase.reportGeneratedAt,
      modules: phase.modules.map(mod => ({
        ...mod,
        // Keep photos only for the phase we're currently generating
        photos:   phase.id === keepPhaseId ? (mod.photos  || []).slice(0, 2) : [],
        findings: mod.findings.map(f => ({
          ...f,
          photos: phase.id === keepPhaseId ? (f.photos || []).slice(0, 2) : [],
        })),
      })),
    })),
  } as any
}

interface Props {
  job:      InspectionJob
  onUpdate: (job: InspectionJob) => void
  onBack:   () => void
}

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const ORANGE = '#F29337'
const GREEN  = '#27A96B'
const RED    = '#E84545'
const BORDER = 'rgba(44,90,122,0.14)'
const BG     = '#F4F7FB'

type PhaseGenStatus = 'idle' | 'generating' | 'done' | 'error'
type FinalStatus    = 'idle' | 'assembling' | 'done' | 'error'

export default function InspectionReportScreen({ job, onUpdate, onBack }: Props) {
  const [phaseStatus,  setPhaseStatus]  = useState<Partial<Record<PhaseId, PhaseGenStatus>>>({})
  const [coverNotes,   setCoverNotes]   = useState(job.purposeNote || '')
  const [ahjEmail,     setAhjEmail]     = useState(job.ahjEmail || '')
  const [inspEmail,    setInspEmail]    = useState(job.inspectorEmail || job.clientEmail || '')
  const [sendClient,   setSendClient]   = useState(true)
  const [sendAhj,      setSendAhj]      = useState(false)
  const [extraEmails,  setExtraEmails]  = useState('')
  const [finalStatus,  setFinalStatus]  = useState<FinalStatus>('idle')
  const [finalPdfB64,  setFinalPdfB64]  = useState<string | null>(null)
  const [finalMsg,     setFinalMsg]     = useState('')
  const [emailsSent,   setEmailsSent]   = useState<string[]>([])

  // Property details — collected HERE (deferred from the low-friction start flow)
  const [pdClientName,   setPdClientName]   = useState(job.clientName === 'Homeowner' ? '' : (job.clientName || ''))
  const [pdBuildingType, setPdBuildingType] = useState(job.buildingType || 'single_storey_residential')
  const [pdAge,          setPdAge]          = useState(job.estimatedAge || '')
  const [pdStreet,       setPdStreet]       = useState(job.address?.street || '')
  const [pdCity,         setPdCity]         = useState(job.address?.city || '')
  const detailsIncomplete = !pdStreet.trim() || !pdClientName.trim()
  // Edit-before-send modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editSubject,   setEditSubject]   = useState('')
  const [editBody,      setEditBody]      = useState('')
  const [editRecipients,setEditRecipients]= useState('')

  // Relevant phases (not pending)
  const relevantPhases = job.phases.filter(p => p.status !== 'pending')
  const phasesWithSection = relevantPhases.filter(p => p.reportPdfB64).length
  const readyToAssemble   = relevantPhases.length > 0

  // ── Generate a single phase section ───────────────────────────────────────
  const generatePhase = useCallback(async (phaseId: PhaseId) => {
    setPhaseStatus(s => ({ ...s, [phaseId]: 'generating' }))
    try {
      const res  = await fetch('/api/report/generate-phase', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ job: stripJobForTransport(job, phaseId), phaseId }),
      })
      const rawPhaseText = await res.text()
      let data: any = {}
      try { data = JSON.parse(rawPhaseText) } catch {
        throw new Error(
          res.status === 504 ? 'Phase generation timed out — check your connection and try again.' :
          `Server error (${res.status}) — ${rawPhaseText.slice(0, 120)}`
        )
      }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Generation failed')

      // Store base64 section on the phase
      const updatedJob: InspectionJob = {
        ...job,
        ahjEmail:      ahjEmail.trim() || job.ahjEmail,
        inspectorEmail: inspEmail.trim() || job.inspectorEmail,
        updatedAt:     new Date().toISOString(),
        phases: job.phases.map(p =>
          p.id === phaseId
            ? { ...p, reportPdfB64: data.pdfB64, reportGeneratedAt: new Date().toISOString() }
            : p
        ),
      }
      onUpdate(updatedJob)
      setPhaseStatus(s => ({ ...s, [phaseId]: 'done' }))
    } catch (err: any) {
      console.error('[report-screen] Phase gen error:', err)
      setPhaseStatus(s => ({ ...s, [phaseId]: 'error' }))
    }
  }, [job, ahjEmail, inspEmail, onUpdate])

  // ── Generate all phases at once ────────────────────────────────────────────
  async function generateAll() {
    // Commit the property details collected on this screen into the job first,
    // so the generated report reflects the real building info (these were
    // deferred from the low-friction start flow).
    const withDetails: InspectionJob = {
      ...job,
      clientName:    pdClientName.trim() || job.clientName,
      buildingType:  pdBuildingType,
      estimatedAge:  pdAge.trim(),
      address: { ...job.address, street: pdStreet.trim() || job.address?.street, city: pdCity.trim() || job.address?.city },
      updatedAt:     new Date().toISOString(),
    }
    onUpdate(withDetails)
    for (const phase of relevantPhases) {
      if (!phase.reportPdfB64) await generatePhase(phase.id as PhaseId)
    }
  }

  // ── Assemble final report (no send yet — opens edit modal) ───────────────
  async function handleAssemble() {
    setFinalStatus('assembling'); setFinalMsg(''); setFinalPdfB64(null); setEmailsSent([])
    try {
      const phasePdfs: Record<string, string> = {}
      for (const phase of job.phases) {
        if (phase.reportPdfB64) phasePdfs[phase.id] = phase.reportPdfB64
      }
      const slimJob = {
        ...stripJobForTransport(job),
        ahjEmail:       ahjEmail.trim() || undefined,
        inspectorEmail: inspEmail.trim() || undefined,
        purposeNote:    coverNotes,
      }
      // Assemble PDF only — no send yet
      const res = await fetch('/api/report/collate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job: slimJob, phasePdfs,
          coverNotes: coverNotes.trim() || undefined,
          sendTo: { client: false, ahj: false, extras: [] }, // send separately after edit
        }),
      })
      const rawText = await res.text()
      let data: any = {}
      try { data = JSON.parse(rawText) } catch {
        throw new Error(
          res.status === 504 ? 'Report assembly timed out — try generating each phase section first, then assemble.' :
          res.status === 413 ? 'Payload too large — reduce photos per phase and try again.' :
          `Server error (${res.status}) — ${rawText.slice(0, 120)}`
        )
      }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Assembly failed')
      setFinalPdfB64(data.pdfB64)
      setFinalStatus('done')
      onUpdate({ ...job, reportGenerated: true, reportUrl: data.reportUrl || job.reportUrl, updatedAt: new Date().toISOString() })

      // Pre-fill edit modal
      const extras = extraEmails.split(',').map(e => e.trim()).filter(Boolean)
      const recipients = [
        ...(sendClient && job.clientEmail ? [job.clientEmail] : []),
        ...(sendAhj && ahjEmail.trim()   ? [ahjEmail.trim()]  : []),
        ...extras,
      ]
      setEditRecipients(recipients.join(', '))
      setEditSubject(`Building Inspection Report — ${job.address.street}, ${job.address.city}`)
      setEditBody(
        [
          coverNotes.trim() ? `Inspector's Note: ${coverNotes.trim()}\n` : '',
          `Property: ${job.address.street}, ${job.address.city}, ${job.address.province}`,
          `Inspection date: ${new Date(job.inspectionDate).toLocaleDateString('en-CA', { year:'numeric', month:'long', day:'numeric' })}`,
          `Inspected by: ${job.inspectorName || 'Inspector'}`,
          `Phases completed: ${job.phases.filter(p => p.status === 'complete').length} of ${job.phases.length}`,
          '',
          'The full compliance report PDF is attached to this email.',
          '',
          'This report is a visual inspection aid generated by stAIrcode. All findings should be verified by qualified tradespeople before action is taken.',
        ].filter(l => l !== null).join('\n')
      )
      setShowEditModal(true)
    } catch (err: any) {
      setFinalMsg(err.message ?? 'Assembly failed')
      setFinalStatus('error')
    }
  }

  // ── Send email after editing ───────────────────────────────────────────────
  const [sendingEmail, setSendingEmail] = useState(false)
  async function handleSend() {
    setSendingEmail(true)
    try {
      const extras = editRecipients.split(',').map(e => e.trim()).filter(Boolean)
      const phasePdfs: Record<string, string> = {}
      for (const phase of job.phases) {
        if (phase.reportPdfB64) phasePdfs[phase.id] = phase.reportPdfB64
      }
      const slimJob = {
        ...stripJobForTransport(job),
        ahjEmail:       ahjEmail.trim() || undefined,
        inspectorEmail: inspEmail.trim() || undefined,
        purposeNote:    editBody,
      }
      const res = await fetch('/api/report/collate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job: slimJob, phasePdfs,
          coverNotes: editBody.trim() || undefined,
          sendTo: { client: false, ahj: false, extras },
        }),
      })
      const rawText = await res.text()
      let data: any = {}
      try { data = JSON.parse(rawText) } catch { throw new Error(`Server error — ${rawText.slice(0, 120)}`) }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Send failed')
      setEmailsSent(data.emailsSent ?? extras)
      setFinalMsg(data.emailsSent?.length > 0
        ? `Report sent to: ${data.emailsSent.join(', ')}`
        : 'Report assembled. No emails sent.')
      setShowEditModal(false)
    } catch (err: any) {
      setFinalMsg(err.message ?? 'Send failed')
    }
    setSendingEmail(false)
  }

  function downloadFinal() {
    if (!finalPdfB64) return
    const bytes = Uint8Array.from(atob(finalPdfB64), c => c.charCodeAt(0))
    const blob  = new Blob([bytes], { type: 'application/pdf' })
    const url   = URL.createObjectURL(blob)
    const a     = document.createElement('a')
    a.href      = url
    a.download  = `inspection-report-${job.address.street.replace(/[^a-zA-Z0-9]/g, '-') || job.id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadPhase(phaseId: PhaseId) {
    const phase = job.phases.find(p => p.id === phaseId)
    if (!phase?.reportPdfB64) return
    const bytes = Uint8Array.from(atob(phase.reportPdfB64), c => c.charCodeAt(0))
    const blob  = new Blob([bytes], { type: 'application/pdf' })
    const url   = URL.createObjectURL(blob)
    const a     = document.createElement('a')
    a.href      = url
    a.download  = `${PHASE_META[phaseId]?.shortLabel?.replace(/\s/g,'-') || phaseId}-report.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
    <div style={{ minHeight:'100dvh', background:BG, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:'#0D1E2E' }}>

      {/* ── Header ── */}
      <div style={{ background:NAVY, paddingTop:'max(env(safe-area-inset-top,0px),1rem)', paddingBottom:'1.25rem', paddingLeft:'1.25rem', paddingRight:'1.25rem' }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:'0.85rem', cursor:'pointer', padding:'0 0 0.75rem' }}>← Back to dashboard</button>
        <h1 style={{ fontSize:'1.2rem', fontWeight:700, color:'#fff', margin:'0 0 0.2rem' }}>Generate Report</h1>
        <p style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.45)', margin:0 }}>{job.address.street}, {job.address.city} · {relevantPhases.length} phases · {phasesWithSection} sections generated</p>
      </div>

      <div style={{ padding:'1.25rem 1.25rem 6rem', display:'flex', flexDirection:'column', gap:'1rem' }}>

        {/* ── How it works ── */}
        <div style={{ background:'rgba(65,124,164,0.06)', border:`1px solid rgba(65,124,164,0.2)`, borderRadius:11, padding:'0.85rem 1rem', fontSize:'0.78rem', color:'#3A5A78', lineHeight:1.65 }}>
          <strong>How it works:</strong> Generate a report section for each phase independently — each is small and fast. When ready, assemble all sections into one final report. You can generate the final report at any time, even mid-inspection.
        </div>

        {/* ── Phase sections ── */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
            <div style={{ fontSize:'0.7rem', fontWeight:600, color:'#5E7D9B', letterSpacing:'0.03em' }}>Phase report sections</div>
            <button onClick={generateAll}
              style={{ fontSize:'0.72rem', fontWeight:700, color:BLUE, background:'rgba(65,124,164,0.08)', border:`1px solid rgba(65,124,164,0.25)`, borderRadius:6, padding:'0.25rem 0.65rem', cursor:'pointer' }}>
              Generate all
            </button>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
            {relevantPhases.map(phase => {
              const meta     = PHASE_META[phase.id]
              const pct      = getPhaseProgress(phase)
              const hasSection = !!phase.reportPdfB64
              const genSt    = phaseStatus[phase.id] ?? 'idle'
              const isBusy   = genSt === 'generating'

              return (
                <div key={phase.id} style={{ background:'#fff', border:`1px solid ${hasSection ? 'rgba(39,169,107,0.3)' : BORDER}`, borderRadius:10, padding:'0.7rem 0.9rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                  {/* Status dot */}
                  <div style={{ width:10, height:10, borderRadius:'50%', flexShrink:0, background: hasSection ? GREEN : genSt==='error' ? RED : genSt==='generating' ? ORANGE : 'rgba(44,90,122,0.15)', border: hasSection ? 'none' : `2px solid ${genSt==='error' ? RED : BORDER}` }}/>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'0.82rem', fontWeight:600, color:'#0D1E2E', marginBottom:'0.05rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {meta?.label ?? phase.id}
                    </div>
                    <div style={{ fontSize:'0.65rem', color:'#5E7D9B' }}>
                      {hasSection
                        ? `Section ready · ${new Date(phase.reportGeneratedAt!).toLocaleDateString()}`
                        : `${pct}% complete · ${phase.modules.filter(m => m.status === 'complete').length} modules`
                      }
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:'0.35rem', flexShrink:0 }}>
                    {hasSection && (
                      <button onClick={() => downloadPhase(phase.id as PhaseId)}
                        style={{ padding:'0.3rem 0.55rem', background:'rgba(39,169,107,0.08)', border:'1px solid rgba(39,169,107,0.25)', borderRadius:6, fontSize:'0.68rem', fontWeight:600, color:GREEN, cursor:'pointer' }}>
                        PDF
                      </button>
                    )}
                    <button onClick={() => generatePhase(phase.id as PhaseId)} disabled={isBusy}
                      style={{ padding:'0.3rem 0.65rem', background: isBusy ? 'rgba(65,124,164,0.1)' : hasSection ? 'rgba(65,124,164,0.06)' : `rgba(65,124,164,0.12)`, border:`1px solid ${isBusy ? 'rgba(65,124,164,0.15)' : 'rgba(65,124,164,0.3)'}`, borderRadius:6, fontSize:'0.68rem', fontWeight:700, color: isBusy ? BLUE : BLUE, cursor: isBusy ? 'default':'pointer', display:'flex', alignItems:'center', gap:'0.3rem' }}>
                      {isBusy && <div style={{ width:8, height:8, borderRadius:'50%', border:'1.5px solid rgba(65,124,164,0.3)', borderTopColor:BLUE, animation:'spin 0.7s linear infinite' }}/>}
                      {isBusy ? '…' : hasSection ? 'Regen' : 'Generate'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Property details (collected at report time) ── */}
        <div style={{ background:'#fff', border:`1px solid ${detailsIncomplete ? 'rgba(242,147,55,0.4)' : BORDER}`, borderRadius:11, padding:'1rem' }}>
          <div style={{ fontSize:'0.7rem', fontWeight:700, color:BLUE, letterSpacing:'0.04em', textTransform:'uppercase' as const, marginBottom:'0.2rem' }}>Property details</div>
          <div style={{ fontSize:'0.68rem', color:'#5E7D9B', marginBottom:'0.85rem', lineHeight:1.5 }}>Complete these for the report header. You can edit anything captured at the start.</div>

          <div style={{ display:'grid', gap:'0.6rem' }}>
            <div>
              <div style={{ fontSize:'0.66rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.25rem' }}>Client / owner name</div>
              <input value={pdClientName} onChange={e => setPdClientName(e.target.value)} placeholder="e.g. Jane Smith"
                style={{ width:'100%', padding:'0.6rem 0.8rem', background:'#F7FAFC', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:'0.82rem', color:'#0D1E2E', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.6rem' }}>
              <div>
                <div style={{ fontSize:'0.66rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.25rem' }}>Street address</div>
                <input value={pdStreet} onChange={e => setPdStreet(e.target.value)} placeholder="123 Main St"
                  style={{ width:'100%', padding:'0.6rem 0.8rem', background:'#F7FAFC', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:'0.82rem', color:'#0D1E2E', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
              </div>
              <div>
                <div style={{ fontSize:'0.66rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.25rem' }}>City</div>
                <input value={pdCity} onChange={e => setPdCity(e.target.value)} placeholder="Toronto"
                  style={{ width:'100%', padding:'0.6rem 0.8rem', background:'#F7FAFC', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:'0.82rem', color:'#0D1E2E', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.6rem' }}>
              <div>
                <div style={{ fontSize:'0.66rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.25rem' }}>Building type</div>
                <select value={pdBuildingType} onChange={e => setPdBuildingType(e.target.value as any)}
                  style={{ width:'100%', padding:'0.6rem 0.8rem', background:'#F7FAFC', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:'0.82rem', color:'#0D1E2E', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}>
                  <option value="single_storey_residential">Single-storey home</option>
                  <option value="two_storey_residential">Two-storey home</option>
                  <option value="semi_detached">Semi-detached</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="multi_unit_residential">Multi-unit residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="mixed_use">Mixed use</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize:'0.66rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.25rem' }}>Approx. age / year built</div>
                <input value={pdAge} onChange={e => setPdAge(e.target.value)} placeholder="e.g. 1985 or ~40 yrs"
                  style={{ width:'100%', padding:'0.6rem 0.8rem', background:'#F7FAFC', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:'0.82rem', color:'#0D1E2E', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
              </div>
            </div>
          </div>
          {detailsIncomplete && (
            <div style={{ fontSize:'0.66rem', color:'#C4721E', marginTop:'0.6rem' }}>Add at least the client name and street address for a complete report header.</div>
          )}
        </div>

        {/* ── Cover / inspector notes ── */}
        <div>
          <div style={{ fontSize:'0.7rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.35rem' }}>Cover letter / inspector notes</div>
          <textarea value={coverNotes} onChange={e => setCoverNotes(e.target.value)} rows={3}
            placeholder="Purpose of inspection, scope limitations, general conditions noted…"
            style={{ width:'100%', padding:'0.65rem 0.85rem', background:'#fff', border:`1px solid ${BORDER}`, borderRadius:9, fontSize:'0.82rem', color:'#0D1E2E', outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.55 }}/>
        </div>

        {/* ── Send options ── */}
        <div style={{ background:'#fff', border:`1px solid ${BORDER}`, borderRadius:11, padding:'1rem' }}>
          <div style={{ fontSize:'0.7rem', fontWeight:700, color:BLUE, letterSpacing:'0.04em', textTransform:'uppercase' as const, marginBottom:'0.85rem' }}>Send to</div>

          {/* Client */}
          <label style={{ display:'flex', alignItems:'flex-start', gap:'0.6rem', marginBottom:'0.75rem', cursor:'pointer' }}>
            <input type="checkbox" checked={sendClient} onChange={e => setSendClient(e.target.checked)} style={{ marginTop:2, flexShrink:0 }}/>
            <div>
              <div style={{ fontSize:'0.82rem', fontWeight:600, color:'#0D1E2E' }}>Client</div>
              <div style={{ fontSize:'0.7rem', color:'#5E7D9B' }}>{job.clientEmail || 'No client email on file — add in project setup'}</div>
            </div>
          </label>

          {/* AHJ */}
          <div style={{ borderTop:`1px solid ${BORDER}`, paddingTop:'0.75rem', marginBottom:'0.75rem' }}>
            <label style={{ display:'flex', alignItems:'flex-start', gap:'0.6rem', marginBottom:'0.4rem', cursor:'pointer' }}>
              <input type="checkbox" checked={sendAhj} onChange={e => setSendAhj(e.target.checked)} style={{ marginTop:2, flexShrink:0 }}/>
              <div>
                <div style={{ fontSize:'0.82rem', fontWeight:600, color:'#0D1E2E' }}>Authority Having Jurisdiction (AHJ)</div>
                <div style={{ fontSize:'0.7rem', color:'#5E7D9B' }}>Municipal building department or permit office</div>
              </div>
            </label>
            {sendAhj && (
              <input type="email" value={ahjEmail} onChange={e => setAhjEmail(e.target.value)}
                placeholder="ahj@municipality.ca" id="ahj-email" name="ahj-email" autoComplete="email"
                style={{ width:'100%', padding:'0.55rem 0.8rem', background:BG, border:`1px solid ${ahjEmail ? BLUE : BORDER}`, borderRadius:8, fontSize:'0.82rem', outline:'none', boxSizing:'border-box', fontFamily:'inherit', marginLeft:0 }}/>
            )}
          </div>

          {/* Additional */}
          <div style={{ borderTop:`1px solid ${BORDER}`, paddingTop:'0.75rem' }}>
            <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.3rem' }}>Additional recipients (comma-separated)</div>
            <input type="text" value={extraEmails} onChange={e => setExtraEmails(e.target.value)}
              placeholder="engineer@firm.com, contractor@co.ca" id="extra-emails" name="extra-emails"
              style={{ width:'100%', padding:'0.55rem 0.8rem', background:BG, border:`1px solid ${BORDER}`, borderRadius:8, fontSize:'0.82rem', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
          </div>
        </div>

        {/* ── Assemble button ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          <button onClick={handleAssemble} disabled={!readyToAssemble || finalStatus === 'assembling'}
            style={{ width:'100%', padding:'1.05rem', background: finalStatus==='assembling' ? 'rgba(242,147,55,0.5)' : `linear-gradient(135deg,${ORANGE},#C4721E)`, border:'none', borderRadius:12, color:'#fff', fontSize:'0.95rem', fontWeight:800, cursor: finalStatus==='assembling' ? 'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem', boxShadow:'0 4px 18px rgba(242,147,55,0.4)' }}>
            {finalStatus === 'assembling' ? (
              <>
                <div style={{ width:16, height:16, borderRadius:'50%', border:'2.5px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.7s linear infinite' }}/>
                Assembling final report…
              </>
            ) : finalStatus === 'done' ? 'Regenerate & Send' : 'Assemble Final Report →'}
          </button>

          {finalStatus === 'done' && (
            <div style={{ background:'rgba(39,169,107,0.07)', border:'1px solid rgba(39,169,107,0.3)', borderRadius:11, padding:'0.85rem 1rem', display:'flex', flexDirection:'column', gap:'0.65rem' }}>
              <div style={{ display:'flex', gap:'0.75rem', alignItems:'center', flexWrap:'wrap' as const }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'0.82rem', fontWeight:700, color:GREEN, marginBottom:'0.15rem' }}>✓ Report assembled</div>
                  <div style={{ fontSize:'0.7rem', color:'#5E7D9B', lineHeight:1.5 }}>
                    {emailsSent.length > 0 ? `Sent to: ${emailsSent.join(', ')}` : 'Ready to review and send.'}
                  </div>
                </div>
                {finalPdfB64 && (
                  <button onClick={downloadFinal}
                    style={{ padding:'0.55rem 1.1rem', background:'rgba(39,169,107,0.15)', border:'1px solid rgba(39,169,107,0.35)', borderRadius:8, color:GREEN, fontWeight:700, fontSize:'0.78rem', cursor:'pointer', whiteSpace:'nowrap' as const, flexShrink:0 }}>
                    Download PDF
                  </button>
                )}
              </div>
              <button onClick={() => setShowEditModal(true)}
                style={{ width:'100%', padding:'0.85rem', background:`linear-gradient(135deg,${BLUE},#2A5F8A)`, border:'none', borderRadius:10, color:'#fff', fontWeight:800, fontSize:'0.9rem', cursor:'pointer', boxShadow:'0 3px 12px rgba(65,124,164,0.3)' }}>
                📨 Review &amp; Send Report →
              </button>
            </div>
          )}

          {finalStatus === 'error' && (
            <div style={{ fontSize:'0.75rem', color:RED, background:'rgba(232,69,69,0.06)', border:'1px solid rgba(232,69,69,0.2)', borderRadius:8, padding:'0.6rem 0.85rem', lineHeight:1.55 }}>
              {finalMsg}
            </div>
          )}

          <div style={{ fontSize:'0.65rem', color:'#9DB4C5', textAlign:'center' }}>
            The final report includes cover page, summary of all findings, and all generated phase sections.
          </div>
        </div>

      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>

    {/* ══ EDIT BEFORE SEND MODAL ══════════════════════════════════════════ */}
    {showEditModal && (
      <>
        {/* Backdrop */}
        <div onClick={() => setShowEditModal(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:800 }}/>

        {/* Sheet */}
        <div style={{
          position:'fixed', bottom:0, left:0, right:0, zIndex:801,
          background:'#fff', borderRadius:'18px 18px 0 0',
          boxShadow:'0 -8px 40px rgba(0,0,0,0.2)',
          maxHeight:'92dvh', display:'flex', flexDirection:'column',
          fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        }}>
          {/* Handle */}
          <div style={{ display:'flex', justifyContent:'center', padding:'0.65rem 0 0' }}>
            <div style={{ width:36, height:4, borderRadius:2, background:'rgba(44,90,122,0.18)' }}/>
          </div>

          {/* Header */}
          <div style={{ padding:'0.75rem 1.25rem 0.5rem', borderBottom:'1px solid rgba(44,90,122,0.1)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:'1rem', fontWeight:700, color:NAVY }}>Review &amp; Send Report</div>
              <div style={{ fontSize:'0.68rem', color:'#5E7D9B', marginTop:'0.1rem' }}>Edit any field before sending — tap to change</div>
            </div>
            <button onClick={() => setShowEditModal(false)}
              style={{ background:'none', border:'none', fontSize:'1.3rem', color:'#9DB4C5', cursor:'pointer', lineHeight:1, padding:'0.25rem' }}>×</button>
          </div>

          {/* Scrollable fields */}
          <div style={{ flex:1, overflowY:'auto', padding:'1rem 1.25rem', display:'flex', flexDirection:'column', gap:'0.85rem' }}>

            {/* Recipients */}
            <div>
              <label style={{ display:'block', fontSize:'0.72rem', fontWeight:700, color:BLUE, textTransform:'uppercase' as const, letterSpacing:'0.04em', marginBottom:'0.35rem' }}>
                To (comma-separated)
              </label>
              <input
                type="text"
                value={editRecipients}
                onChange={e => setEditRecipients(e.target.value)}
                placeholder="client@email.com, ahj@city.ca"
                style={{ width:'100%', padding:'0.7rem 0.9rem', background:BG, border:`1.5px solid rgba(65,124,164,0.3)`, borderRadius:9, fontSize:'0.88rem', color:NAVY, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
              />
              <div style={{ fontSize:'0.65rem', color:'#9DB4C5', marginTop:'0.25rem' }}>Add or remove any email addresses</div>
            </div>

            {/* Subject */}
            <div>
              <label style={{ display:'block', fontSize:'0.72rem', fontWeight:700, color:BLUE, textTransform:'uppercase' as const, letterSpacing:'0.04em', marginBottom:'0.35rem' }}>
                Subject
              </label>
              <input
                type="text"
                value={editSubject}
                onChange={e => setEditSubject(e.target.value)}
                style={{ width:'100%', padding:'0.7rem 0.9rem', background:BG, border:`1.5px solid rgba(65,124,164,0.3)`, borderRadius:9, fontSize:'0.88rem', color:NAVY, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
              />
            </div>

            {/* Body / cover note */}
            <div>
              <label style={{ display:'block', fontSize:'0.72rem', fontWeight:700, color:BLUE, textTransform:'uppercase' as const, letterSpacing:'0.04em', marginBottom:'0.35rem' }}>
                Email body &amp; cover note
              </label>
              <textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                rows={10}
                style={{ width:'100%', padding:'0.75rem 0.9rem', background:BG, border:`1.5px solid rgba(65,124,164,0.3)`, borderRadius:9, fontSize:'0.85rem', color:NAVY, outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.65 }}
              />
              <div style={{ fontSize:'0.65rem', color:'#9DB4C5', marginTop:'0.25rem' }}>The PDF report is always attached automatically</div>
            </div>

            {/* Error */}
            {finalMsg && emailsSent.length === 0 && finalStatus !== 'done' && (
              <div style={{ fontSize:'0.75rem', color:RED, background:'rgba(232,69,69,0.06)', border:'1px solid rgba(232,69,69,0.2)', borderRadius:8, padding:'0.6rem 0.85rem' }}>
                {finalMsg}
              </div>
            )}
          </div>

          {/* Action bar */}
          <div style={{ padding:'0.75rem 1.25rem', paddingBottom:'max(env(safe-area-inset-bottom,0px),0.75rem)', borderTop:'1px solid rgba(44,90,122,0.1)', display:'flex', gap:'0.6rem' }}>
            {/* Download without sending */}
            {finalPdfB64 && (
              <button onClick={downloadFinal}
                style={{ flex:1, padding:'0.85rem', background:'#fff', border:`1.5px solid ${BORDER}`, borderRadius:10, fontSize:'0.82rem', fontWeight:600, color:'#5E7D9B', cursor:'pointer' }}>
                Download PDF
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={sendingEmail || !editRecipients.trim()}
              style={{ flex:2, padding:'0.85rem', background: sendingEmail ? 'rgba(65,124,164,0.4)' : `linear-gradient(135deg,${BLUE},#2A5F8A)`, border:'none', borderRadius:10, fontSize:'0.88rem', fontWeight:800, color:'#fff', cursor: sendingEmail || !editRecipients.trim() ? 'default' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', boxShadow:'0 3px 12px rgba(65,124,164,0.35)' }}>
              {sendingEmail
                ? <><div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.7s linear infinite' }}/> Sending…</>
                : '📨 Send Report'}
            </button>
          </div>
        </div>
      </>
    )}

    {/* Success toast after send */}
    {emailsSent.length > 0 && (
      <div style={{ position:'fixed', bottom:'max(env(safe-area-inset-bottom,0px),1rem)', left:'1rem', right:'1rem', zIndex:900, background:GREEN, color:'#fff', borderRadius:12, padding:'0.85rem 1.1rem', fontSize:'0.85rem', fontWeight:600, boxShadow:'0 4px 20px rgba(39,169,107,0.4)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
        <span>✓</span>
        <span>Sent to: {emailsSent.join(', ')}</span>
      </div>
    )}
  </>
  )
}
