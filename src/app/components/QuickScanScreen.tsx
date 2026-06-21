'use client'
/**
 * QuickScanScreen.tsx
 *
 * General-purpose AI-vision scan. Unlike the module captures, this assumes
 * NO specific component — the AI first identifies what it's looking at, then
 * assesses condition and building-code concerns.
 *
 * Flow:
 *   1. Capture / upload a photo, and/or type a description
 *   2. AI analyses → identification + observations + code commentary
 *   3. User chooses:
 *        • Save as a new project (seeds an inspection with this finding)
 *        • Generate a report to share (emails a PDF, then wipes everything)
 *        • Scan again / discard
 *
 * Privacy: when the user picks "generate report", the photo and analysis are
 * held in memory only, sent once to the report generator, then cleared — nothing
 * is written to Supabase or localStorage.
 */
import { useState, useRef } from 'react'
import { AppUser } from './AuthScreen'
import { NavLogo } from './Logo'

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const GREEN  = '#27A96B'
const ORANGE = '#F29337'
const RED    = '#E84545'

interface AnalysisResult {
  identification: string   // what the AI thinks it is
  observations:   string   // condition + visible details
  codeNotes:      string   // code-compliance commentary
  severity:       'none' | 'minor' | 'major' | 'critical'
}

interface Props {
  user:        AppUser
  codeLabel?:  string
  location?:   string
  onSaveAsProject: (photo: string | null, description: string, analysis: AnalysisResult) => void
  onBack:      () => void
}

type Stage = 'input' | 'analysing' | 'result' | 'reporting' | 'reported'

const SEV_COLOR: Record<string, string> = { none: GREEN, minor: ORANGE, major: '#E8740E', critical: RED }

export default function QuickScanScreen({ user, codeLabel, location, onSaveAsProject, onBack }: Props) {
  const [stage,    setStage]    = useState<Stage>('input')
  const [photo,    setPhoto]    = useState<string | null>(null)   // base64 (data URL stripped)
  const [preview,  setPreview]  = useState<string | null>(null)   // full data URL for <img>
  const [desc,     setDesc]     = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function pickFile(capture: boolean) {
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = 'image/*'
    if (capture) inp.setAttribute('capture', 'environment')
    inp.onchange = (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        setPreview(dataUrl)
        setPhoto(dataUrl.split(',')[1] ?? null) // strip data: prefix
      }
      reader.readAsDataURL(file)
    }
    inp.click()
  }

  async function runScan() {
    if (!photo && !desc.trim()) { setError('Add a photo or a description first.'); return }
    setError(null); setStage('analysing')

    const codeCtx = codeLabel ? ` Applicable building code: ${codeLabel}.` : ''
    const locCtx  = location  ? ` Location: ${location}.` : ''
    const descCtx = desc.trim() ? `\n\nThe user also described it as: "${desc.trim()}"` : ''

    const prompt = `You are an expert building inspector with deep knowledge of residential building codes.${codeCtx}${locCtx}

You are shown a photo of an unidentified building component or area${desc.trim() ? ' along with a user description' : ''}. First IDENTIFY what it is, then assess its visible condition and any building-code or safety concerns.${descCtx}

Return ONLY a JSON object with these fields:
- "identification": string — a plain-language statement of what this is (e.g. "This is an exterior wood deck with a guardrail and stairs").
- "observations": string — visible condition, materials, defects, and notable details. Be specific about what you can see.
- "codeNotes": string — building-code or safety commentary. Cite the relevant code clause where possible (e.g. guardrail opening limits, stair geometry). If there are concerns, state them clearly; if it looks compliant, say so.
- "severity": "none"|"minor"|"major"|"critical" — overall concern level based on what's visible.

If no image is provided, base your analysis on the description alone and note that a photo would improve accuracy. Return ONLY valid JSON.`

    try {
      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageB64: photo ?? '', prompt }),
      })
      if (!res.ok) throw new Error('Analysis failed. Please try again.')
      const data = await res.json()
      const raw  = (data.text ?? '').replace(/```json|```/g, '').trim()
      const m    = raw.match(/\{[\s\S]*\}/)
      if (!m) throw new Error('Could not read the analysis. Please try again.')
      const parsed: AnalysisResult = JSON.parse(m[0])
      setAnalysis(parsed)
      setStage('result')
    } catch (err: any) {
      setError(err.message ?? 'Analysis failed.')
      setStage('input')
    }
  }

  async function generateReport() {
    if (!analysis) return
    setStage('reporting'); setError(null)

    // Build a one-component report payload. Held in memory only.
    const fields = [{
      label:          analysis.identification,
      status:         analysis.severity === 'none' ? 'pass' : 'review',
      observations:   analysis.observations,
      recommendation: analysis.codeNotes,
      severity:       analysis.severity,
    }]

    try {
      const res = await fetch('/api/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:        user.email,
          measurements: { quickScan: true },
          fields,
          codeLabel:    codeLabel ?? 'Local building code',
          codeRef:      '',
          location:     location ?? '',
          isOntario:    false,
          quickScan:    true,
          identification: analysis.identification,
          observations:   analysis.observations,
          codeNotes:      analysis.codeNotes,
        }),
      })
      if (!res.ok) throw new Error('Could not generate the report. Please try again.')
      // PRIVACY: wipe the photo and analysis from memory — nothing persisted.
      setPhoto(null); setPreview(null); setDesc(''); setAnalysis(null)
      setStage('reported')
    } catch (err: any) {
      setError(err.message ?? 'Report failed.')
      setStage('result')
    }
  }

  function reset() {
    setPhoto(null); setPreview(null); setDesc(''); setAnalysis(null); setError(null); setStage('input')
  }

  // ── Header (shared) ──
  const header = (
    <div style={{ background: NAVY, paddingTop: 'max(env(safe-area-inset-top,0px),1rem)', paddingBottom: '1.25rem', paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>← Back</button>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><NavLogo height={22} /></div>
        <div style={{ width: 40 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" stroke={GREEN} strokeWidth="1.6" strokeLinecap="round"/><circle cx="12" cy="12" r="3.5" stroke={GREEN} strokeWidth="1.6"/></svg>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>Quick Scan</h1>
      </div>
      <p style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)', margin: '0.35rem 0 0', lineHeight: 1.5 }}>Scan or describe any building component — get instant AI condition and code feedback.</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: '#EBF3FA', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: NAVY, display: 'flex', flexDirection: 'column' }}>
      {header}
      <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

        {/* ── INPUT ── */}
        {stage === 'input' && (
          <>
            {preview ? (
              <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1.5px solid rgba(65,124,164,0.25)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="scan" style={{ width: '100%', display: 'block', maxHeight: 280, objectFit: 'cover' }} />
                <button onClick={() => { setPhoto(null); setPreview(null) }} style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%', background: 'rgba(220,50,50,0.9)', border: '1.5px solid #fff', color: '#fff', fontSize: '1rem', cursor: 'pointer', fontWeight: 700 }}>×</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <button onClick={() => pickFile(true)} style={{ padding: '1.1rem', background: NAVY, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="12" cy="13" r="3.5" stroke="#fff" strokeWidth="1.5"/></svg>
                  Live Capture
                </button>
                <button onClick={() => pickFile(false)} style={{ padding: '1.1rem', background: '#fff', border: '1.5px solid rgba(65,124,164,0.3)', borderRadius: 12, color: BLUE, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 16V4M8 8l4-4 4 4" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Upload Photo
                </button>
              </div>
            )}

            {/* Description */}
            <div style={{ background: '#fff', border: '1px solid rgba(147,186,212,0.3)', borderRadius: 14, padding: '0.85rem 1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5E7D9B', marginBottom: '0.4rem' }}>Describe it (optional)</div>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="e.g. Back deck guardrail — not sure if the spacing is up to code"
                rows={3}
                style={{ width: '100%', border: 'none', outline: 'none', resize: 'vertical', fontSize: '0.85rem', color: NAVY, fontFamily: 'inherit', background: 'transparent', boxSizing: 'border-box' }}
              />
            </div>

            {error && <div style={{ color: RED, fontSize: '0.8rem' }}>{error}</div>}

            <button onClick={runScan} disabled={!photo && !desc.trim()}
              style={{ width: '100%', padding: '1rem', background: (!photo && !desc.trim()) ? 'rgba(39,169,107,0.35)' : `linear-gradient(135deg,${GREEN},#1A7A50)`, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: '0.92rem', cursor: (!photo && !desc.trim()) ? 'default' : 'pointer', boxShadow: (photo || desc.trim()) ? '0 4px 16px rgba(39,169,107,0.3)' : 'none' }}>
              Run AI Analysis
            </button>
            <p style={{ fontSize: '0.62rem', color: '#9DB4C5', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>The AI identifies the component, assesses its condition, and flags code concerns.</p>
          </>
        )}

        {/* ── ANALYSING ── */}
        {stage === 'analysing' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '3rem 0' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: GREEN, opacity: 0.4, animation: 'qspulse 1.2s ease infinite', animationDelay: `${i * 0.2}s` }} />)}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#5E7D9B', fontWeight: 600 }}>Analysing…</div>
            <style>{`@keyframes qspulse{0%,100%{opacity:0.3;transform:scale(0.9)}50%{opacity:1;transform:scale(1.1)}}`}</style>
          </div>
        )}

        {/* ── RESULT ── */}
        {stage === 'result' && analysis && (
          <>
            {preview && (
              <div style={{ borderRadius: 14, overflow: 'hidden', border: '1.5px solid rgba(65,124,164,0.2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="scan" style={{ width: '100%', display: 'block', maxHeight: 200, objectFit: 'cover' }} />
              </div>
            )}

            {/* Identification */}
            <div style={{ background: '#fff', border: '1px solid rgba(147,186,212,0.3)', borderRadius: 14, padding: '1rem 1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: SEV_COLOR[analysis.severity] ?? GREEN }} />
                <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.06em', color: SEV_COLOR[analysis.severity] ?? GREEN, textTransform: 'uppercase' }}>
                  {analysis.severity === 'none' ? 'No major concerns' : `${analysis.severity} concern`}
                </div>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: NAVY, lineHeight: 1.4 }}>{analysis.identification}</div>
            </div>

            {/* Observations */}
            <div style={{ background: '#fff', border: '1px solid rgba(147,186,212,0.3)', borderRadius: 14, padding: '1rem 1.1rem' }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#5E7D9B', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Observations</div>
              <div style={{ fontSize: '0.85rem', color: '#2C4A6E', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{analysis.observations}</div>
            </div>

            {/* Code notes */}
            <div style={{ background: '#fff', border: '1px solid rgba(242,147,55,0.25)', borderRadius: 14, padding: '1rem 1.1rem' }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 800, color: ORANGE, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Code Commentary</div>
              <div style={{ fontSize: '0.85rem', color: '#2C4A6E', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{analysis.codeNotes}</div>
            </div>

            {error && <div style={{ color: RED, fontSize: '0.8rem' }}>{error}</div>}

            {/* Actions */}
            <button onClick={() => onSaveAsProject(photo, desc, analysis)}
              style={{ width: '100%', padding: '0.95rem', background: `linear-gradient(135deg,${NAVY},#1A3A58)`, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              Save as a New Project
            </button>
            <button onClick={generateReport}
              style={{ width: '100%', padding: '0.95rem', background: '#fff', border: `1.5px solid ${BLUE}`, borderRadius: 12, color: BLUE, fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}>
              Generate a Report to Share
            </button>
            <button onClick={reset}
              style={{ width: '100%', padding: '0.7rem', background: 'transparent', border: 'none', color: '#9DB4C5', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
              Discard &amp; scan again
            </button>
            <p style={{ fontSize: '0.6rem', color: '#9DB4C5', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>Choosing &ldquo;Generate a Report&rdquo; emails you a PDF and then permanently deletes this photo and analysis.</p>
          </>
        )}

        {/* ── REPORTING ── */}
        {stage === 'reporting' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '3rem 0' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: BLUE, opacity: 0.4, animation: 'qspulse 1.2s ease infinite', animationDelay: `${i * 0.2}s` }} />)}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#5E7D9B', fontWeight: 600 }}>Generating your report…</div>
            <style>{`@keyframes qspulse{0%,100%{opacity:0.3;transform:scale(0.9)}50%{opacity:1;transform:scale(1.1)}}`}</style>
          </div>
        )}

        {/* ── REPORTED ── */}
        {stage === 'reported' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2.5rem 1rem', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(39,169,107,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: NAVY }}>Report on its way</div>
            <div style={{ fontSize: '0.82rem', color: '#5E7D9B', lineHeight: 1.6, maxWidth: 300 }}>
              Your report is being generated and emailed to {user.email}. The photo and analysis have been permanently deleted.
            </div>
            <button onClick={reset} style={{ marginTop: '0.5rem', padding: '0.8rem 1.5rem', background: NAVY, border: 'none', borderRadius: 11, color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
              Run another scan
            </button>
            <button onClick={onBack} style={{ padding: '0.6rem', background: 'transparent', border: 'none', color: '#9DB4C5', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
              Back to home
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
