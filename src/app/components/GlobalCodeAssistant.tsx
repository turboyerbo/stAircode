'use client'
/**
 * GlobalCodeAssistant.tsx
 *
 * A floating AI building-code assistant available on every screen.
 * Unlike InspectionAIChat, this is NOT scoped to a specific job — it answers
 * general building code questions. Uses the same /api/inspection/chat endpoint
 * with a general system prompt (no job context required).
 */
import { useState, useRef, useEffect } from 'react'

const NAVY  = '#0A1C2E'
const BLUE  = '#417CA4'
const ORANGE = '#F29337'

interface Msg { role: 'user' | 'assistant'; content: string }

interface Props {
  codeLabel?: string   // e.g. 'OBC 2024' — current jurisdiction for context
  location?:  string   // e.g. 'Toronto, Ontario'
}

export default function GlobalCodeAssistant({ codeLabel, location }: Props) {
  const [open,    setOpen]    = useState(false)
  const [msgs,    setMsgs]    = useState<Msg[]>([])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, loading])

  const systemPrompt = `You are stAIrcode's building code assistant. Answer questions about residential building codes${location ? ` for ${location}` : ''}${codeLabel ? ` (applicable code: ${codeLabel})` : ''}. Give concise, practical answers with code references where relevant. If asked about a specific measurement or compliance question, cite the relevant code section.`

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const next = [...msgs, { role: 'user' as const, content: text }]
    setMsgs(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/inspection/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, systemPrompt }),
      })
      const data = await res.json()
      const reply = data?.content?.[0]?.text ?? data?.reply ?? data?.text
        ?? 'Sorry, I had trouble answering that. Please try again.'
      setMsgs(m => [...m, { role: 'assistant', content: reply }])
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: 'Network error — please try again.' }])
    }
    setLoading(false)
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open code assistant"
          style={{
            position: 'fixed', bottom: 'max(env(safe-area-inset-bottom,0px),1.25rem)', right: '1.25rem',
            width: 56, height: 56, borderRadius: '50%',
            background: `linear-gradient(135deg,${BLUE},#2C5A7A)`,
            border: 'none', boxShadow: '0 4px 20px rgba(65,124,164,0.5)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 90,
          }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="3" width="20" height="15" rx="2.5" stroke="#fff" strokeWidth="1.6"/>
            <line x1="6" y1="8" x2="18" y2="8" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="6" y1="12" x2="14" y2="12" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M7 18l-2 3 7-3" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
          {/* AI badge */}
          <div style={{ position:'absolute', top:-2, right:-2, background:ORANGE, color:'#fff', fontSize:'0.5rem', fontWeight:800, padding:'2px 5px', borderRadius:8, letterSpacing:'0.03em' }}>AI</div>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <>
          <div onClick={() => setOpen(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:99 }}/>
          <div style={{
            position:'fixed', bottom:0, left:0, right:0, zIndex:100,
            maxWidth:430, margin:'0 auto',
            height:'72dvh', background:'#F7FAFC', borderRadius:'18px 18px 0 0',
            boxShadow:'0 -8px 40px rgba(0,0,0,0.2)', display:'flex', flexDirection:'column',
            fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
          }}>
            {/* Header */}
            <div style={{ background:NAVY, padding:'0.9rem 1.1rem', borderRadius:'18px 18px 0 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
                <div style={{ width:32, height:32, borderRadius:9, background:`linear-gradient(135deg,${BLUE},#2C5A7A)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="15" rx="2.5" stroke="#fff" strokeWidth="1.6"/><line x1="6" y1="8" x2="18" y2="8" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/><line x1="6" y1="12" x2="14" y2="12" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <div style={{ fontSize:'0.85rem', fontWeight:700, color:'#fff' }}>Code Assistant</div>
                  {codeLabel && <div style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.5)' }}>{codeLabel}{location ? ` · ${location}` : ''}</div>}
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', fontSize:'1.4rem', cursor:'pointer', lineHeight:1, padding:'0.2rem' }}>×</button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'1rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {msgs.length === 0 && (
                <div style={{ textAlign:'center', padding:'1.5rem 1rem', color:'#9DB4C5' }}>
                  <div style={{ fontSize:'0.85rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.4rem' }}>Ask me anything about building codes</div>
                  <div style={{ fontSize:'0.72rem', lineHeight:1.6 }}>e.g. &ldquo;What&rsquo;s the max riser height for stairs?&rdquo; or &ldquo;Do I need a handrail on both sides?&rdquo;</div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role==='user' ? 'flex-end' : 'flex-start', maxWidth:'82%' }}>
                  <div style={{
                    padding:'0.65rem 0.85rem', borderRadius: m.role==='user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                    background: m.role==='user' ? BLUE : '#fff',
                    color: m.role==='user' ? '#fff' : '#0D1E2E',
                    fontSize:'0.82rem', lineHeight:1.55,
                    border: m.role==='user' ? 'none' : '1px solid rgba(44,90,122,0.12)',
                    whiteSpace:'pre-wrap',
                  }}>{m.content}</div>
                </div>
              ))}
              {loading && (
                <div style={{ alignSelf:'flex-start', padding:'0.65rem 0.85rem', background:'#fff', borderRadius:'12px 12px 12px 3px', border:'1px solid rgba(44,90,122,0.12)', display:'flex', gap:'0.3rem' }}>
                  {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:BLUE, opacity:0.4, animation:'gca-pulse 1.2s ease infinite', animationDelay:`${i*0.2}s` }}/>)}
                  <style>{`@keyframes gca-pulse{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ padding:'0.75rem', paddingBottom:'max(env(safe-area-inset-bottom,0px),0.75rem)', borderTop:'1px solid rgba(44,90,122,0.1)', background:'#fff', display:'flex', gap:'0.5rem' }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') send() }}
                placeholder="Ask a building code question…"
                style={{ flex:1, padding:'0.7rem 0.9rem', background:'#F7FAFC', border:'1.5px solid rgba(65,124,164,0.2)', borderRadius:10, fontSize:'0.85rem', color:'#0D1E2E', outline:'none', fontFamily:'inherit' }}
              />
              <button onClick={send} disabled={loading || !input.trim()}
                style={{ width:42, height:42, borderRadius:10, background: loading||!input.trim() ? 'rgba(65,124,164,0.3)' : BLUE, border:'none', cursor: loading||!input.trim() ? 'default' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 9l14-7-5 14-3-6-6-1z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
