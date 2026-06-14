'use client'
/**
 * DrawingsReviewModule.tsx
 *
 * Specialised module for the Pre-Construction phase drawings review.
 * Handles: drawings_review, permit_issuance, site_plan_review modules.
 *
 * Flow:
 *   1. Onboarding — explains purpose (approved plans referenced throughout inspection)
 *   2. Upload — PDF/image drop zone (10MB limit per file, up to 20 pages)
 *   3. Auto-extract — AI reads all pages, populates structured fields
 *   4. Chat — inspector can ask questions about the drawings
 *   5. Fields — editable extracted data, Analyze button to re-run
 *   6. Save — stores drawings on InspectionJob for cross-phase reference
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type { InspectionJob, InspectionModule, DrawingsFields } from '@/lib/inspection-types'

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const GREEN  = '#27A96B'
const ORANGE = '#F29337'
const RED    = '#E84545'
const BORDER = 'rgba(44,90,122,0.14)'
const BG     = '#F4F7FB'

// ── File size limit ────────────────────────────────────────────────────────────
const MAX_FILE_MB   = 10
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

// ── Helper: convert file page to base64 JPEG ──────────────────────────────────
async function fileToBase64Pages(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      // For PDFs: read as base64 string and pass to the API
      // (Claude can read PDFs natively via base64 — we send as image/jpeg approximation
      //  by rendering to canvas via FileReader → img → canvas)
      // Simpler approach for now: send PDF as base64 data URI, Claude reads it
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        // Strip data URI prefix to get raw base64
        const b64 = result.includes(',') ? result.split(',')[1] : result
        resolve([b64])
      }
      reader.onerror = () => reject(new Error('Could not read file'))
      reader.readAsDataURL(file)
    } else {
      // Images: read directly
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        const b64 = result.includes(',') ? result.split(',')[1] : result
        resolve([b64])
      }
      reader.onerror = () => reject(new Error('Could not read image'))
      reader.readAsDataURL(file)
    }
  })
}

// ── Field row ──────────────────────────────────────────────────────────────────
function FieldRow({
  label, value, onChange, unit, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; unit?: string; placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.55rem 0', borderBottom:`1px solid ${BORDER}` }}>
      <div style={{ width:'44%', fontSize:'0.75rem', fontWeight:600, color:'#5E7D9B', flexShrink:0 }}>{label}</div>
      <div style={{ flex:1, display:'flex', alignItems:'center', gap:'0.35rem' }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '—'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ flex:1, padding:'0.3rem 0.5rem', background: focused ? '#fff' : 'transparent', border:`1px solid ${focused ? BLUE : 'transparent'}`, borderRadius:5, fontSize:'0.82rem', color:'#0D1E2E', outline:'none', fontFamily:'inherit', transition:'all 0.12s', minWidth:0 }}
        />
        {unit && <span style={{ fontSize:'0.68rem', color:'#9DB4C5', flexShrink:0 }}>{unit}</span>}
      </div>
    </div>
  )
}

// ── Chat message ───────────────────────────────────────────────────────────────
interface ChatMsg { role: 'user'|'assistant'; content: string }

function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display:'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth:'88%',
        padding:'0.7rem 0.9rem',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: isUser ? NAVY : '#fff',
        border: isUser ? 'none' : `1px solid ${BORDER}`,
        fontSize:'0.82rem', lineHeight:1.65,
        color: isUser ? '#E8F4FF' : '#0D1E2E',
        whiteSpace:'pre-wrap',
        boxShadow: isUser ? '0 2px 8px rgba(10,28,46,0.2)' : '0 1px 4px rgba(44,74,110,0.06)',
      }}>
        {msg.content}
      </div>
    </div>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  job:    InspectionJob
  module: InspectionModule
  onSave: (module: InspectionModule, drawingsData?: InspectionJob['drawingsData']) => void
  onBack: () => void
}

// ── Main component ──────────────────────────────────────────────────────────────
export default function DrawingsReviewModule({ job, module, onSave, onBack }: Props) {
  // ── Tabs: 'upload' | 'chat' | 'fields' ───────────────────────────────────
  type Tab = 'upload' | 'chat' | 'fields'
  const [tab,        setTab]        = useState<Tab>('upload')

  // ── Upload state ─────────────────────────────────────────────────────────
  const [pages,      setPages]      = useState<string[]>(job.drawingsData?.pages ?? [])
  const [fileNames,  setFileNames]  = useState<string[]>(job.drawingsData?.fileNames ?? [])
  const [uploading,  setUploading]  = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)  // 0-100
  const [uploadStage,    setUploadStage]    = useState('')  // human-readable stage label
  const [uploadErr,  setUploadErr]  = useState<string|null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dropRef   = useRef<HTMLDivElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  // ── Extraction state ─────────────────────────────────────────────────────
  const [extracting,  setExtracting]  = useState(false)
  const [extractDone, setExtractDone] = useState(!!job.drawingsData?.fields)
  const [extractErr,  setExtractErr]  = useState<string|null>(null)

  // ── Fields state (editable) ───────────────────────────────────────────────
  const [f, setF] = useState<DrawingsFields>(job.drawingsData?.fields ?? {})
  const setField  = useCallback(<K extends keyof DrawingsFields>(key: K, val: DrawingsFields[K]) => {
    setF(prev => ({ ...prev, [key]: val }))
  }, [])

  // ── Chat state ────────────────────────────────────────────────────────────
  const [msgs,       setMsgs]       = useState<ChatMsg[]>(
    job.drawingsData?.chatMessages?.map((m: any) => ({ role: m.role, content: m.content })) ?? []
  )
  const [chatInput,  setChatInput]  = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [msgs])

  // Auto-switch to fields tab after extraction
  useEffect(() => {
    if (extractDone && tab === 'upload') setTab('fields')
  }, [extractDone]) // eslint-disable-line

  // ── File handling ────────────────────────────────────────────────────────
  async function processFiles(files: FileList | File[]) {
    setUploadErr(null)
    const arr = Array.from(files)

    // Validate
    for (const file of arr) {
      if (file.size > MAX_FILE_BYTES) {
        setUploadErr(`"${file.name}" exceeds ${MAX_FILE_MB}MB limit. For larger drawings, reduce PDF quality or split into smaller files.`)
        return
      }
      const ok = file.type.startsWith('image/') || file.type === 'application/pdf'
      if (!ok) {
        setUploadErr(`"${file.name}" is not a supported format. Upload PDF or image files (JPG, PNG).`)
        return
      }
    }

    setUploading(true)
    setUploadProgress(5)
    setUploadStage('Reading file…')
    const newPages: string[] = []
    const newNames: string[] = []

    for (let i = 0; i < arr.length; i++) {
      const file = arr[i]
      setUploadStage(`Reading ${file.name}…`)
      setUploadProgress(10 + Math.round((i / arr.length) * 40))
      try {
        const filePagesB64 = await fileToBase64Pages(file)
        newPages.push(...filePagesB64)
        newNames.push(file.name)
      } catch {
        setUploadErr(`Could not read "${file.name}". Please try again.`)
      }
    }

    setUploadProgress(55)
    setUploadStage('Preparing for AI analysis…')

    setUploading(false)
    setUploadProgress(0)
    setUploadStage('')
    if (!newPages.length) return

    const allPages = [...pages, ...newPages]
    const allNames = [...fileNames, ...newNames]
    setPages(allPages)
    setFileNames(allNames)
    setExtractDone(false)
    setExtracting(false)

    // Auto-extract after upload
    await runExtraction(allPages, allNames)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files?.length) processFiles(files)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false)
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files)
  }

  // ── AI Extraction ────────────────────────────────────────────────────────
  async function runExtraction(pagesToUse = pages, namesToUse = fileNames) {
    if (!pagesToUse.length) return
    setExtracting(true); setExtractErr(null)
    setUploadProgress(60); setUploadStage('Sending to AI…')
    try {
      const res  = await fetch('/api/drawings-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode:       'extract',
          pages:      pagesToUse.slice(0, 8), // API limit
          jobContext: {
            address:      `${job.address.street}, ${job.address.city}, ${job.address.province}`,
            buildingType: job.buildingType,
            province:     job.address.province,
          },
        }),
      })
      setUploadProgress(85); setUploadStage('AI reading drawings…')

      // Safe JSON parse — handle empty or truncated responses gracefully
      let data: any = {}
      try {
        const rawText = await res.text()
        if (rawText && rawText.trim()) {
          data = JSON.parse(rawText)
        }
      } catch {
        throw new Error('The drawing analysis timed out or the file was too large. Try a smaller PDF (under 5MB) or upload individual pages as images.')
      }

      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status} — try again or upload a smaller file.`)

      if (data.fields) {
        setF(data.fields)
        setExtractDone(true)
        setUploadProgress(100); setUploadStage('Done!')
        setTimeout(() => { setUploadProgress(0); setUploadStage('') }, 1200)

        // Auto-send welcome message to chat
        const welcome = data.fields.summary
          ? `I've analysed the uploaded drawings. ${data.fields.summary}\n\nI found ${data.fields.drawingSheets?.length ?? 0} sheets. Ask me anything about the approved design, dimensions, setbacks, or code compliance requirements.`
          : `I've reviewed the uploaded drawings. I can answer questions about the approved design, setbacks, occupancy, construction type, and any other information shown in the documents. What would you like to know?`

        setMsgs([{ role:'assistant', content: welcome }])
        setTab('fields')
      }
    } catch (err: any) {
      setExtractErr(err.message ?? 'Could not analyse drawings — check your connection and try again.')
      setUploadProgress(0); setUploadStage('')
    }
    setExtracting(false)
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  async function sendChatMessage() {
    const text = chatInput.trim()
    if (!text || chatLoading || !pages.length) return
    setChatInput('')
    const userMsg: ChatMsg = { role:'user', content:text }
    const newMsgs = [...msgs, userMsg]
    setMsgs(newMsgs)
    setChatLoading(true)
    try {
      const res  = await fetch('/api/drawings-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode:        'chat',
          pages:       pages.slice(0, 4), // fewer pages in chat for speed
          messages:    msgs.slice(-6),     // last 6 turns for context
          userMessage: text,
          jobContext: {
            address:      `${job.address.street}, ${job.address.city}, ${job.address.province}`,
            buildingType: job.buildingType,
            province:     job.address.province,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const reply: ChatMsg = { role:'assistant', content: data.text }
      setMsgs([...newMsgs, reply])
    } catch {
      setMsgs(prev => [...prev, { role:'assistant', content:'Connection error. Please try again.' }])
    }
    setChatLoading(false)
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  function handleSave(status: 'complete'|'skipped'|'in_progress' = 'complete') {
    const updatedModule: InspectionModule = {
      ...module,
      status,
      notes:      f.summary ?? '',
      findings:   f.summary ? [{
        id:        `find-${Date.now()}`,
        label:     'Drawings Review',
        condition: 'typical' as any,
        severity:  'none' as any,
        notes:     f.summary ?? '',
        photos:    [],
      }] : [],
      capturedAt: new Date().toISOString(),
    }
    const drawingsData: InspectionJob['drawingsData'] = pages.length ? {
      pages,
      fields:       f,
      chatMessages: msgs,
      uploadedAt:   new Date().toISOString(),
      pageCount:    pages.length,
      fileNames,
    } : undefined
    onSave(updatedModule, drawingsData)
  }

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100dvh', background:BG, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:'#0D1E2E', display:'flex', flexDirection:'column' }}>

      {/* ── Header ── */}
      <div style={{ background:NAVY, padding:'max(env(safe-area-inset-top,0px),1rem) 1.25rem 0', flexShrink:0 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.55)', fontSize:'0.85rem', cursor:'pointer', padding:'0 0 0.75rem' }}>← Back to phase</button>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', paddingBottom:'0.85rem' }}>
          <div>
            <h2 style={{ fontSize:'1.1rem', fontWeight:700, color:'#fff', margin:'0 0 0.2rem', lineHeight:1.2 }}>Drawings Review</h2>
            <p style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.5)', margin:0 }}>Approved drawings · AI-extracted compliance data</p>
          </div>
          {pages.length > 0 && (
            <div style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.5)', background:'rgba(255,255,255,0.08)', padding:'0.2rem 0.6rem', borderRadius:5, marginTop:'0.15rem', flexShrink:0 }}>
              {pages.length} page{pages.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ display:'flex', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          {(['upload','chat','fields'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex:1, padding:'0.65rem 0', background:'none', border:'none', borderBottom: tab===t ? `2px solid ${ORANGE}` : '2px solid transparent', color: tab===t ? '#fff' : 'rgba(255,255,255,0.45)', fontSize:'0.75rem', fontWeight: tab===t ? 700 : 500, cursor:'pointer', textTransform:'capitalize', transition:'all 0.15s' }}>
              {t === 'upload' ? `Plans${pages.length ? ` (${pages.length})` : ''}` : t === 'chat' ? `Chat${msgs.length ? ` (${msgs.length})` : ''}` : 'Data Fields'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>

        {/* ══ UPLOAD TAB ══ */}
        {tab === 'upload' && (
          <div style={{ flex:1, overflowY:'auto', padding:'1.25rem', display:'flex', flexDirection:'column', gap:'1rem' }}>

            {/* Onboarding card */}
            <div style={{ background:'rgba(65,124,164,0.06)', border:`1.5px solid rgba(65,124,164,0.3)`, borderRadius:14, padding:'1.15rem 1.25rem' }}>
              <div style={{ display:'flex', gap:'0.65rem', alignItems:'flex-start' }}>
                <div style={{ width:36, height:36, borderRadius:9, background:'rgba(65,124,164,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="2" y="1" width="10" height="16" rx="1.5" stroke={BLUE} strokeWidth="1.4"/>
                    <line x1="5" y1="5" x2="9" y2="5" stroke={BLUE} strokeWidth="1.1"/>
                    <line x1="5" y1="8" x2="9" y2="8" stroke={BLUE} strokeWidth="1.1"/>
                    <line x1="5" y1="11" x2="7.5" y2="11" stroke={BLUE} strokeWidth="1.1"/>
                    <circle cx="13" cy="13" r="4" fill="rgba(65,124,164,0.15)" stroke={BLUE} strokeWidth="1.4"/>
                    <path d="M11.5 13l1 1 2-2" stroke={BLUE} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#0D1E2E', marginBottom:'0.3rem' }}>Approved drawings will be referenced throughout the inspection</div>
                  <div style={{ fontSize:'0.75rem', color:'#5E7D9B', lineHeight:1.7 }}>
                    Upload the drawings that were approved by the AHJ (Authority Having Jurisdiction) or municipality. The AI will extract permit numbers, setbacks, lot coverage, occupancy class, and all other design data from the drawings automatically.
                  </div>
                  <div style={{ fontSize:'0.75rem', color:'#5E7D9B', lineHeight:1.7, marginTop:'0.4rem' }}>
                    As you move through each inspection phase, the AI inspector will compare field conditions against these approved drawings — flagging any deviations from the approved design.
                  </div>
                </div>
              </div>
            </div>

            {/* Existing files */}
            {fileNames.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
                <div style={{ fontSize:'0.7rem', fontWeight:600, color:'#5E7D9B' }}>Uploaded files</div>
                {fileNames.map((name, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.6rem 0.75rem', background:'#fff', border:`1px solid ${BORDER}`, borderRadius:8 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="2" y="1" width="9" height="14" rx="1" stroke={BLUE} strokeWidth="1.3"/>
                      <line x1="4" y1="5" x2="8" y2="5" stroke={BLUE} strokeWidth="1"/>
                      <line x1="4" y1="7.5" x2="8" y2="7.5" stroke={BLUE} strokeWidth="1"/>
                    </svg>
                    <span style={{ flex:1, fontSize:'0.78rem', color:'#0D1E2E' }}>{name}</span>
                    <button onClick={() => {
                      const newPages = pages.filter((_,j) => j !== i)
                      const newNames = fileNames.filter((_,j) => j !== i)
                      setPages(newPages); setFileNames(newNames)
                    }} style={{ background:'none', border:'none', color:'#9DB4C5', cursor:'pointer', fontSize:'1rem', lineHeight:1, padding:'0 0.15rem' }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Drop zone */}
            <div
              ref={dropRef}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${isDragging ? BLUE : 'rgba(65,124,164,0.3)'}`,
                borderRadius: 14,
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                background: isDragging ? 'rgba(65,124,164,0.06)' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              {uploading || extracting ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem', padding:'0.5rem 0' }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', border:`3px solid rgba(65,124,164,0.2)`, borderTopColor:BLUE, animation:'spin 0.8s linear infinite' }}/>
                  <div style={{ fontSize:'0.85rem', color:BLUE, fontWeight:600 }}>
                    {uploadStage || (uploading ? 'Reading file…' : 'AI analysing drawings…')}
                  </div>
                  {/* Progress bar */}
                  {uploadProgress > 0 && (
                    <div style={{ width:'80%', maxWidth:240 }}>
                      <div style={{ height:5, background:'rgba(65,124,164,0.12)', borderRadius:10, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${uploadProgress}%`, background:`linear-gradient(90deg,${BLUE},#2C7AAF)`, borderRadius:10, transition:'width 0.4s ease' }}/>
                      </div>
                      <div style={{ fontSize:'0.62rem', color:'#9DB4C5', textAlign:'center', marginTop:'0.3rem' }}>{uploadProgress}%</div>
                    </div>
                  )}
                  <div style={{ fontSize:'0.72rem', color:'#5E7D9B', textAlign:'center' as const, lineHeight:1.5 }}>
                    {extracting ? 'Extracting permit data, setbacks, and compliance information…' : 'Large files may take a moment — please keep this screen open'}
                  </div>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              ) : (
                <>
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ margin:'0 auto 0.75rem', display:'block' }}>
                    <rect x="8" y="5" width="18" height="26" rx="2" stroke={BLUE} strokeWidth="1.5" fill="rgba(65,124,164,0.06)"/>
                    <line x1="12" y1="12" x2="22" y2="12" stroke={BLUE} strokeWidth="1.2"/>
                    <line x1="12" y1="16" x2="22" y2="16" stroke={BLUE} strokeWidth="1.2"/>
                    <line x1="12" y1="20" x2="18" y2="20" stroke={BLUE} strokeWidth="1.2"/>
                    <circle cx="29" cy="29" r="9" fill="rgba(65,124,164,0.1)" stroke={BLUE} strokeWidth="1.5"/>
                    <line x1="29" y1="25" x2="29" y2="33" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="25" y1="29" x2="33" y2="29" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <div style={{ fontSize:'0.88rem', fontWeight:700, color:'#0D1E2E', marginBottom:'0.3rem' }}>
                    {pages.length ? 'Add more drawings' : 'Upload approved drawings'}
                  </div>
                  <div style={{ fontSize:'0.75rem', color:'#5E7D9B', lineHeight:1.6 }}>
                    PDF, JPG, or PNG · Max {MAX_FILE_MB}MB per file
                  </div>
                  <div style={{ fontSize:'0.72rem', color:'#9DB4C5', marginTop:'0.25rem' }}>
                    Drag & drop or tap to browse
                  </div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,image/*" multiple onChange={handleFileInput} style={{ display:'none' }}/>

            {/* Errors */}
            {(uploadErr || extractErr) && (
              <div style={{ background:'rgba(232,69,69,0.07)', border:'1px solid rgba(232,69,69,0.25)', borderRadius:9, padding:'0.75rem 1rem', fontSize:'0.78rem', color:RED, lineHeight:1.55, display:'flex', gap:'0.65rem', alignItems:'flex-start' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0, marginTop:1 }}>
                  <circle cx="8" cy="8" r="7" stroke={RED} strokeWidth="1.3"/>
                  <line x1="8" y1="4.5" x2="8" y2="9" stroke={RED} strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="11.5" r="0.8" fill={RED}/>
                </svg>
                <div style={{ flex:1 }}>{uploadErr || extractErr}</div>
                <button onClick={() => { setUploadErr(null); setExtractErr(null) }}
                  style={{ background:'none', border:'none', color:RED, cursor:'pointer', fontSize:'1rem', lineHeight:1, flexShrink:0, padding:0, opacity:0.7 }}>×</button>
              </div>
            )}

            {/* Analyze button */}
            {pages.length > 0 && !extracting && (
              <button onClick={() => runExtraction()}
                style={{ width:'100%', padding:'0.9rem', background:`linear-gradient(135deg,${BLUE},#2C5A7A)`, border:'none', borderRadius:11, color:'#fff', fontWeight:700, fontSize:'0.88rem', cursor:'pointer', boxShadow:'0 4px 16px rgba(65,124,164,0.35)' }}>
                {extractDone ? '↺ Re-analyze Drawings' : 'Analyze Drawings →'}
              </button>
            )}
          </div>
        )}

        {/* ══ CHAT TAB ══ */}
        {tab === 'chat' && (
          <>
            {!pages.length ? (
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', gap:'0.75rem', textAlign:'center' }}>
                <div style={{ fontSize:'0.88rem', color:'#5E7D9B' }}>Upload drawings first to chat with the AI about the approved plans.</div>
                <button onClick={() => setTab('upload')}
                  style={{ padding:'0.7rem 1.5rem', background:BLUE, border:'none', borderRadius:9, color:'#fff', fontWeight:700, fontSize:'0.82rem', cursor:'pointer' }}>
                  Upload Drawings →
                </button>
              </div>
            ) : (
              <>
                <div style={{ flex:1, overflowY:'auto', padding:'1rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                  {msgs.length === 0 && (
                    <div style={{ textAlign:'center', padding:'2rem 1rem' }}>
                      <div style={{ fontSize:'0.82rem', color:'#9DB4C5', lineHeight:1.7, marginBottom:'0.85rem' }}>Ask the AI about the approved drawings</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem', justifyContent:'center' }}>
                        {[
                          'What is the approved front setback?',
                          'What occupancy class is this building?',
                          'What are the approved building dimensions?',
                          'Are there any fire separation requirements?',
                          'What is the approved lot coverage percentage?',
                          'What construction type is specified?',
                        ].map(q => (
                          <button key={q} onClick={() => { setChatInput(q) }}
                            style={{ padding:'0.35rem 0.75rem', background:'rgba(65,124,164,0.08)', border:`1px solid rgba(65,124,164,0.2)`, borderRadius:20, fontSize:'0.7rem', color:BLUE, cursor:'pointer', fontFamily:'inherit' }}>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {msgs.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
                  {chatLoading && (
                    <div style={{ display:'flex', justifyContent:'flex-start' }}>
                      <div style={{ padding:'0.65rem 1rem', borderRadius:'14px 14px 14px 4px', background:'#fff', border:`1px solid ${BORDER}`, display:'flex', gap:'0.3rem', alignItems:'center' }}>
                        {[0,1,2].map(i => <div key={i} style={{ width:5, height:5, borderRadius:'50%', background:BLUE, opacity:0.4, animation:'pulse 1.2s ease infinite', animationDelay:`${i*0.2}s` }}/>)}
                        <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef}/>
                </div>

                {/* Chat input */}
                <div style={{ padding:'0.75rem 1rem', paddingBottom:'max(env(safe-area-inset-bottom,0px),0.75rem)', borderTop:`1px solid ${BORDER}`, background:'#fff', display:'flex', gap:'0.5rem', alignItems:'flex-end', flexShrink:0 }}>
                  <textarea
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
                    placeholder="Ask about setbacks, occupancy, fire separation, dimensions…"
                    rows={1}
                    style={{ flex:1, padding:'0.6rem 0.85rem', background:BG, border:`1px solid ${BORDER}`, borderRadius:20, fontSize:'0.82rem', outline:'none', resize:'none', fontFamily:'inherit', lineHeight:1.5, maxHeight:100, overflowY:'auto' }}
                  />
                  <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatLoading}
                    style={{ width:36, height:36, borderRadius:'50%', background: chatInput.trim()&&!chatLoading ? ORANGE : 'rgba(242,147,55,0.2)', border:'none', cursor: chatInput.trim()&&!chatLoading?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 13L13 7 1 1v5l8 1-8 1v5z" fill={chatInput.trim()&&!chatLoading?'#fff':'rgba(242,147,55,0.5)'}/>
                    </svg>
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ══ FIELDS TAB ══ */}
        {tab === 'fields' && (
          <div style={{ flex:1, overflowY:'auto', padding:'1.25rem 1.25rem 6rem', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {!extractDone && !pages.length ? (
              <div style={{ textAlign:'center', padding:'2rem', color:'#5E7D9B', fontSize:'0.85rem', lineHeight:1.7 }}>
                Upload and analyze drawings to populate these fields automatically.
                <br/>
                <button onClick={() => setTab('upload')} style={{ marginTop:'0.75rem', padding:'0.65rem 1.25rem', background:BLUE, border:'none', borderRadius:9, color:'#fff', fontWeight:700, cursor:'pointer', display:'block', margin:'0.75rem auto 0' }}>Upload Drawings →</button>
              </div>
            ) : (
              <>
                {!extractDone && pages.length > 0 && (
                  <div style={{ background:'rgba(242,147,55,0.08)', border:'1px solid rgba(242,147,55,0.25)', borderRadius:9, padding:'0.75rem 1rem', fontSize:'0.78rem', color:'#C4721E', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem' }}>
                    <span>Drawings uploaded but not yet analysed.</span>
                    <button onClick={() => runExtraction()} style={{ padding:'0.35rem 0.75rem', background:ORANGE, border:'none', borderRadius:6, color:'#fff', fontWeight:700, fontSize:'0.72rem', cursor:'pointer', whiteSpace:'nowrap' as const }}>
                      Analyze →
                    </button>
                  </div>
                )}

                {/* Summary */}
                {f.summary && (
                  <div style={{ background:'rgba(39,169,107,0.06)', border:'1px solid rgba(39,169,107,0.2)', borderRadius:10, padding:'0.75rem 1rem', fontSize:'0.78rem', color:'#1A7A50', lineHeight:1.65 }}>
                    {f.summary}
                  </div>
                )}

                {/* Sections */}
                <FieldSection title="Permit Information">
                  <FieldRow label="Permit Number"  value={f.permitNumber  ?? ''} onChange={v => setField('permitNumber', v)} placeholder="e.g. 22-123456" />
                  <FieldRow label="Issue Date"      value={f.permitDate    ?? ''} onChange={v => setField('permitDate', v)} placeholder="e.g. March 15, 2024" />
                  <FieldRow label="Revision Date"   value={f.revisionDate  ?? ''} onChange={v => setField('revisionDate', v)} />
                  <FieldRow label="Applicant"        value={f.applicant     ?? ''} onChange={v => setField('applicant', v)} />
                  <FieldRow label="Architect"        value={f.architect     ?? ''} onChange={v => setField('architect', v)} />
                  <FieldRow label="Engineer"         value={f.engineer      ?? ''} onChange={v => setField('engineer', v)} />
                </FieldSection>

                <FieldSection title="Site / Zoning">
                  <FieldRow label="Zone Class"       value={f.zoneClass      ?? ''} onChange={v => setField('zoneClass', v)} />
                  <FieldRow label="Lot Area"          value={f.lotArea != null ? String(f.lotArea) : ''} onChange={v => setField('lotArea', v?parseFloat(v):null)} unit="m²" />
                  <FieldRow label="Building Area"     value={f.buildingArea != null ? String(f.buildingArea) : ''} onChange={v => setField('buildingArea', v?parseFloat(v):null)} unit="m²" />
                  <FieldRow label="Gross Floor Area"  value={f.grossFloorArea != null ? String(f.grossFloorArea) : ''} onChange={v => setField('grossFloorArea', v?parseFloat(v):null)} unit="m²" />
                  <FieldRow label="Lot Coverage"      value={f.lotCoverage   ?? ''} onChange={v => setField('lotCoverage', v)} placeholder="e.g. 35%" />
                </FieldSection>

                <FieldSection title="Setbacks (m)">
                  <FieldRow label="Front Setback"     value={f.frontSetback      != null ? String(f.frontSetback) : ''} onChange={v => setField('frontSetback', v?parseFloat(v):null)} unit="m" />
                  <FieldRow label="Rear Setback"      value={f.rearSetback       != null ? String(f.rearSetback) : ''} onChange={v => setField('rearSetback', v?parseFloat(v):null)} unit="m" />
                  <FieldRow label="Side Setback (L)"  value={f.sideSetbackLeft   != null ? String(f.sideSetbackLeft) : ''} onChange={v => setField('sideSetbackLeft', v?parseFloat(v):null)} unit="m" />
                  <FieldRow label="Side Setback (R)"  value={f.sideSetbackRight  != null ? String(f.sideSetbackRight) : ''} onChange={v => setField('sideSetbackRight', v?parseFloat(v):null)} unit="m" />
                </FieldSection>

                <FieldSection title="Building">
                  <FieldRow label="Building Height"   value={f.buildingHeight != null ? String(f.buildingHeight) : ''} onChange={v => setField('buildingHeight', v?parseFloat(v):null)} unit="m" />
                  <FieldRow label="Stories"           value={f.stories != null ? String(f.stories) : ''} onChange={v => setField('stories', v?parseInt(v):null)} />
                  <FieldRow label="Parking Spaces"    value={f.parkingSpaces != null ? String(f.parkingSpaces) : ''} onChange={v => setField('parkingSpaces', v?parseInt(v):null)} />
                  <FieldRow label="Occupancy Class"   value={f.occupancyClass  ?? ''} onChange={v => setField('occupancyClass', v)} placeholder="e.g. Group C — Residential" />
                  <FieldRow label="Construction Type" value={f.constructionType ?? ''} onChange={v => setField('constructionType', v)} placeholder="e.g. Part 9 — Wood Frame" />
                  <FieldRow label="Fire Separation"   value={f.fireSeparation  ?? ''} onChange={v => setField('fireSeparation', v)} />
                </FieldSection>

                {/* Code notes */}
                {f.codeNotes && f.codeNotes.length > 0 && (
                  <div>
                    <div style={{ fontSize:'0.7rem', fontWeight:700, color:BLUE, letterSpacing:'0.04em', textTransform:'uppercase' as const, margin:'0.75rem 0 0.5rem' }}>Code Compliance Notes</div>
                    {f.codeNotes.map((note, i) => (
                      <div key={i} style={{ fontSize:'0.78rem', color:'#3A5A78', padding:'0.5rem 0.75rem', background:'rgba(65,124,164,0.05)', borderRadius:7, marginBottom:'0.35rem', lineHeight:1.55, borderLeft:`3px solid rgba(65,124,164,0.3)` }}>
                        {note}
                      </div>
                    ))}
                  </div>
                )}

                {/* Drawing sheets */}
                {f.drawingSheets && f.drawingSheets.length > 0 && (
                  <div>
                    <div style={{ fontSize:'0.7rem', fontWeight:700, color:BLUE, letterSpacing:'0.04em', textTransform:'uppercase' as const, margin:'0.75rem 0 0.5rem' }}>Drawing Sheets</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'0.35rem' }}>
                      {f.drawingSheets.map((s, i) => (
                        <div key={i} style={{ fontSize:'0.72rem', color:'#417CA4', background:'rgba(65,124,164,0.08)', padding:'0.25rem 0.6rem', borderRadius:5, border:'1px solid rgba(65,124,164,0.2)' }}>{s}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Re-analyze */}
                {pages.length > 0 && (
                  <button onClick={() => runExtraction()} disabled={extracting}
                    style={{ width:'100%', marginTop:'0.5rem', padding:'0.75rem', background: extracting ? 'rgba(65,124,164,0.1)' : 'rgba(65,124,164,0.08)', border:`1px solid rgba(65,124,164,0.3)`, borderRadius:10, color: extracting ? BLUE : BLUE, fontWeight:700, fontSize:'0.82rem', cursor: extracting ? 'default':'pointer' }}>
                    {extracting ? 'Analysing…' : '↺ Re-analyze Drawings'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom actions ── */}
      <div style={{ padding:'0.75rem 1.25rem', paddingBottom:'max(env(safe-area-inset-bottom,0px),0.75rem)', borderTop:`1px solid ${BORDER}`, background:'#fff', display:'flex', gap:'0.5rem', flexShrink:0 }}>
        <button onClick={() => handleSave('skipped')}
          style={{ flex:1, padding:'0.8rem', background:'#fff', border:`1.5px solid ${BORDER}`, borderRadius:10, fontSize:'0.82rem', fontWeight:600, color:'#9DB4C5', cursor:'pointer' }}>
          Skip
        </button>
        <button onClick={() => handleSave('in_progress')}
          style={{ flex:1, padding:'0.8rem', background:'rgba(65,124,164,0.08)', border:`1.5px solid rgba(65,124,164,0.25)`, borderRadius:10, fontSize:'0.82rem', fontWeight:600, color:BLUE, cursor:'pointer' }}>
          Save Draft
        </button>
        <button onClick={() => handleSave('complete')}
          style={{ flex:2, padding:'0.8rem', background:`linear-gradient(135deg,${GREEN},#1A7A50)`, border:'none', borderRadius:10, fontSize:'0.82rem', fontWeight:700, color:'#fff', cursor:'pointer' }}>
          Mark Complete →
        </button>
      </div>
    </div>
  )
}

// ── Field section wrapper ──────────────────────────────────────────────────────
function FieldSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background:'#fff', border:`1px solid ${BORDER}`, borderRadius:11, padding:'0 0.9rem', overflow:'hidden' }}>
      <div style={{ fontSize:'0.7rem', fontWeight:700, color:BLUE, letterSpacing:'0.04em', textTransform:'uppercase' as const, padding:'0.6rem 0 0.35rem' }}>{title}</div>
      {children}
    </div>
  )
}
