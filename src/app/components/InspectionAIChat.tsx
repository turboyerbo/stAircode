'use client'
/**
 * InspectionAIChat.tsx
 *
 * Floating AI chat assistant during the inspection.
 * The AI has full context of the inspection job, phase progress,
 * and any captured findings. Inspector can ask questions, get
 * code references, defect interpretations, or recommendations.
 */

import { useState, useRef, useEffect } from 'react'
import type { InspectionJob, ChatMessage } from '@/lib/inspection-types'

interface Props {
  job:      InspectionJob
  onUpdate: (job: InspectionJob) => void
  onClose:  () => void
}

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const ORANGE = '#F29337'
const BORDER = 'rgba(44,90,122,0.15)'

function buildSystemPrompt(job: InspectionJob): string {
  const completedPhases = job.phases
    .filter(p => p.status === 'complete')
    .map(p => p.id.replace(/_/g,' '))
    .join(', ')

  const findings = job.phases
    .flatMap(p => p.modules)
    .flatMap(m => m.findings)
    .filter(f => f.severity !== 'none')
    .map(f => `${f.label}: ${f.condition} (${f.severity}) — ${(f.notes ?? '').slice(0, 120)}`)
    .slice(0, 20)
    .join('\n')

  const activePhase = job.phases.find(p => p.status === 'in_progress')

  return `Property: ${job.address.street}, ${job.address.city}, ${job.address.province}
Building type: ${job.buildingType?.replace(/_/g,' ') || 'Residential'}
Project type: ${job.projectType === 'renovation' ? 'Renovation' : 'New Construction'}
Estimated age: ${job.estimatedAge || 'Not recorded'}
Wall construction: ${job.wallConstruction?.replace(/_/g,' ') || 'Not recorded'}
Foundation: ${job.footingType?.replace(/_/g,' ') || 'Not recorded'}
Inspector: ${job.inspectorName || 'Not recorded'}
Currently working on: ${activePhase ? activePhase.id.replace(/_/g,' ') : 'Not in a phase'}
Completed phases: ${completedPhases || 'None yet'}

Significant findings recorded so far:
${findings || 'No defects recorded yet'}

The inspector may ask about anything visible on-site, defect interpretation, code compliance, remediation steps, or when to call a specialist.`
}

export default function InspectionAIChat({ job, onUpdate, onClose }: Props) {
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(job.chatMessages ?? [])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg: ChatMessage = {
      id:        `msg-${Date.now()}`,
      role:      'user',
      content:   text,
      timestamp: new Date().toISOString(),
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      const history = newMessages.slice(-12).map(m => ({
        role:    m.role as 'user' | 'assistant',
        content: m.content,
      }))

      const res = await fetch('/api/inspection/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages:     history,
          systemPrompt: buildSystemPrompt(job),
        }),
      })

      let reply: string
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        reply = data.error
          ? `Error: ${data.error}`
          : `Server error (${res.status}). Please try again.`
      } else {
        const data = await res.json()
        reply = data.text ?? 'No response received. Please try again.'
      }

      const assistantMsg: ChatMessage = {
        id:        `msg-${Date.now()}-a`,
        role:      'assistant',
        content:   reply,
        timestamp: new Date().toISOString(),
      }
      const withReply = [...newMessages, assistantMsg]
      setMessages(withReply)

      // Persist to job
      const updatedJob = { ...job, chatMessages: withReply, updatedAt: new Date().toISOString() }
      onUpdate(updatedJob)
      try { sessionStorage.setItem(`insp_${job.id}`, JSON.stringify(updatedJob)) } catch {}

    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`, role: 'assistant',
        content: `Network error: ${err?.message ?? 'Could not reach the server. Check your connection and try again.'}`,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errMsg])
    }
    setLoading(false)
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:50 }}/>

      {/* Panel */}
      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, zIndex:60, background:'#fff', borderRadius:'18px 18px 0 0', display:'flex', flexDirection:'column', maxHeight:'80dvh', boxShadow:'0 -6px 30px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ background:NAVY, borderRadius:'18px 18px 0 0', padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem', flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:BLUE, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#fff" strokeWidth="1.2"/>
              <path d="M5 7.5c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="8" y1="11" x2="8" y2="12.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'0.85rem', fontWeight:600, color:'#fff' }}>AI Inspection Assistant</div>
            <div style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.45)' }}>OBC 2024 · Residential construction · Defect analysis</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:'1.2rem', cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'0.85rem 1rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          {messages.length === 0 && (
            <div style={{ padding:'1rem 0.5rem' }}>
              <div style={{ fontSize:'0.8rem', color:'#9DB4C5', lineHeight:1.7, textAlign:'center', marginBottom:'1rem' }}>
                Ask about defect severity, code requirements, remediation steps, or when to call a specialist.
              </div>
              <div style={{ fontSize:'0.68rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.5rem', letterSpacing:'0.04em', textTransform:'uppercase' as const }}>Common questions</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
                {[
                  { q: 'What does horizontal cracking in a foundation wall indicate?', cat: 'Structural' },
                  { q: 'Minimum footing depth in Ontario and why?', cat: 'OBC Code' },
                  { q: 'Is missing filter fabric on weeping tile a major defect?', cat: 'Drainage' },
                  { q: 'What fire blocking is required at floor lines?', cat: 'Fire Safety' },
                  { q: 'When is a structural engineer required vs my recommendation?', cat: 'Escalation' },
                  { q: 'What are the Tarion warranty implications for this finding?', cat: 'Tarion' },
                  { q: 'What R-value is required for exterior walls in Ontario?', cat: 'Insulation' },
                  { q: 'Signs of improper vapour barrier installation to look for?', cat: 'Building Science' },
                ].map(({ q, cat }) => (
                  <button key={q} onClick={() => { setInput(q); inputRef.current?.focus() }}
                    style={{ padding:'0.55rem 0.8rem', background:'#F4F7FB', border:`1px solid rgba(65,124,164,0.18)`, borderRadius:10, fontSize:'0.75rem', color:'#0D1E2E', cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const, display:'flex', alignItems:'flex-start', gap:'0.5rem', lineHeight:1.4 }}>
                    <span style={{ fontSize:'0.58rem', fontWeight:700, color:'#fff', background:BLUE, padding:'0.1rem 0.45rem', borderRadius:4, flexShrink:0, marginTop:1, letterSpacing:'0.04em' }}>{cat}</span>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} style={{ display:'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth:'85%',
                padding:'0.65rem 0.9rem',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user' ? BLUE : '#F4F7FB',
                border: msg.role === 'user' ? 'none' : `1px solid ${BORDER}`,
                fontSize:'0.82rem',
                lineHeight:1.65,
                color: msg.role === 'user' ? '#fff' : '#0D1E2E',
                whiteSpace:'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display:'flex', justifyContent:'flex-start' }}>
              <div style={{ padding:'0.65rem 1rem', borderRadius:'14px 14px 14px 4px', background:'#F4F7FB', border:`1px solid ${BORDER}`, display:'flex', gap:'0.3rem', alignItems:'center' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:5, height:5, borderRadius:'50%', background:BLUE, opacity:0.4, animation:'pulse 1.2s ease-in-out infinite', animationDelay:`${i*0.2}s` }}/>
                ))}
                <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
              </div>
            </div>
          )}

          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{ padding:'0.75rem 1rem', paddingBottom:'max(env(safe-area-inset-bottom,0px),0.75rem)', borderTop:`1px solid ${BORDER}`, display:'flex', gap:'0.5rem', alignItems:'flex-end', flexShrink:0 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Ask about defects, codes, remediation, or Tarion warranty…"
            rows={1}
            style={{ flex:1, padding:'0.6rem 0.85rem', background:'#F4F7FB', border:`1px solid ${BORDER}`, borderRadius:20, fontSize:'0.82rem', outline:'none', resize:'none', fontFamily:'inherit', lineHeight:1.5, maxHeight:100, overflowY:'auto' }}
          />
          <button onClick={handleSend} disabled={!input.trim() || loading}
            style={{ width:36, height:36, borderRadius:'50%', background: input.trim() && !loading ? ORANGE : 'rgba(242,147,55,0.2)', border:'none', cursor: input.trim() && !loading ? 'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 13L13 7 1 1v5l8 1-8 1v5z" fill={input.trim() && !loading ? '#fff' : 'rgba(242,147,55,0.5)'} />
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
