'use client'
/**
 * CodeHelper.tsx
 *
 * Global floating building code assistant — available on every screen.
 * Auto-opens on first visit with an intro message and energy code example.
 * Jurisdiction-aware: detects BC, Ontario, Quebec, USA from geolocation.
 *
 * Usage: <CodeHelper /> anywhere in the layout — renders a fixed FAB + panel.
 */

import { useState, useRef, useEffect, useCallback } from 'react'

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const ORANGE = '#F29337'
const GREEN  = '#27A96B'
const BORDER = 'rgba(44,90,122,0.15)'

interface Message {
  id:      string
  role:    'user' | 'assistant' | 'intro'
  content: string
}

// Opening message — introduces the assistant and leads with BC energy code
const INTRO_MESSAGE: Message = {
  id:      'intro-0',
  role:    'assistant',
  content: `Hi — I'm stAIrcode's building code assistant.

You can ask me anything about Canadian or US building code requirements: energy performance tiers, mandatory rough-ins, structural minimums, fire safety, egress, accessibility, and more.

For example — if you're building in BC, did you know the 2024 code now requires two things that are easy to miss on site?

1. **Radon gas rough-in**: a sub-slab pipe with a vertical stub-out must be installed in every new home — regardless of your Energy Step Code tier (BCBC 9.13.4).
2. **Solar-ready water heating**: structural provision and pipe chase for future solar thermal must be roughed in (BCBC 9.36).

And if your municipality requires Step 3 (RS-3) or Step 4 (RS-4), you'll also need a blower door airtightness test before occupancy.

What can I help you with?`,
}

// Suggested quick questions shown when chat is empty
const SUGGESTIONS = [
  { q: 'What Energy Step Code tier is required in Vancouver in 2025?', tag: 'BC Energy' },
  { q: 'Is radon rough-in mandatory in Ontario as well as BC?',         tag: 'Radon' },
  { q: 'What R-value do I need for walls in BC climate zone 5?',        tag: 'Insulation' },
  { q: 'When is a blower door test required in BC?',                     tag: 'Airtightness' },
  { q: 'What are the solar-ready rough-in requirements in BCBC 2024?',  tag: 'Solar' },
  { q: 'What is the minimum stair riser height under OBC 2024?',        tag: 'OBC Stairs' },
  { q: 'HRV requirements for new homes in Quebec?',                      tag: 'Quebec' },
  { q: 'What does RS-1 vs RS-4 mean in the BC Step Code?',              tag: 'Step Code' },
]

export default function CodeHelper() {
  const [open,         setOpen]         = useState(false)
  const [dismissed,    setDismissed]    = useState(false)
  const [messages,     setMessages]     = useState<Message[]>([INTRO_MESSAGE])
  const [input,        setInput]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [jurisdiction, setJurisdiction] = useState<string | null>(null)
  const [pulse,        setPulse]        = useState(false)
  const [badge,        setBadge]        = useState(false)  // unread dot
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const panelRef  = useRef<HTMLDivElement>(null)

  // Auto-open on first visit after a short delay
  useEffect(() => {
    try {
      const seen = localStorage.getItem('sc_helper_seen')
      if (!seen) {
        const t = setTimeout(() => {
          setOpen(true)
          localStorage.setItem('sc_helper_seen', '1')
        }, 2200)
        return () => clearTimeout(t)
      }
    } catch {}
    // If already seen, pulse the button after a moment to remind them it's there
    const t2 = setTimeout(() => { setPulse(true); setTimeout(() => setPulse(false), 1800) }, 4000)
    return () => clearTimeout(t2)
  }, [])

  // Show badge when closed and a new message arrives
  useEffect(() => {
    if (!open && messages.length > 1) setBadge(true)
  }, [messages, open])

  // Clear badge when opened
  useEffect(() => {
    if (open) setBadge(false)
  }, [open])

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  // Detect jurisdiction from geo API
  useEffect(() => {
    async function detect() {
      try {
        const res  = await fetch('/api/geo')
        const data = await res.json()
        const prov = data.province ?? ''
        const cc   = data.countryCode ?? 'CA'
        if (cc === 'US' || cc === 'USA') { setJurisdiction('USA'); return }
        if (prov.toLowerCase().includes('british columbia') || prov === 'BC') { setJurisdiction('BC'); return }
        if (prov.toLowerCase().includes('ontario') || prov === 'ON')           { setJurisdiction('Ontario'); return }
        if (prov.toLowerCase().includes('quebec')  || prov === 'QC')           { setJurisdiction('Quebec'); return }
        if (prov) setJurisdiction(prov)
      } catch {}
    }
    detect()
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setLoading(true)

    try {
      const history = next
        .filter(m => m.role !== 'intro')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const res  = await fetch('/api/code-helper', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: history, jurisdiction: jurisdiction ?? undefined }),
      })
      const data = await res.json()
      const reply = data.ok ? data.text : (data.error ?? 'Something went wrong. Please try again.')

      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'Network error. Please check your connection and try again.' }])
    }
    setLoading(false)
  }, [input, loading, messages, jurisdiction])

  // Render message content with basic **bold** support
  function renderContent(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    )
  }

  const jurisdictionLabel = jurisdiction
    ? { BC: 'BCBC 2024', Ontario: 'OBC 2024', Quebec: 'CCQ 2020', USA: 'IBC / IRC 2021' }[jurisdiction] ?? jurisdiction
    : 'CA / US codes'

  return (
    <>
      {/* ── FAB button ────────────────────────────────────────────── */}
      <button
        onClick={() => { setOpen(o => !o); setDismissed(false) }}
        aria-label="Building code assistant"
        style={{
          position:     'fixed',
          bottom:       'max(env(safe-area-inset-bottom,0px),1.5rem)',
          right:        '1.25rem',
          width:        54,
          height:       54,
          borderRadius: '50%',
          background:   `linear-gradient(135deg, ${NAVY}, #1a3a5c)`,
          border:       `2px solid ${open ? ORANGE : 'rgba(255,255,255,0.12)'}`,
          boxShadow:    `0 4px 20px rgba(10,28,46,0.45)${pulse ? ', 0 0 0 8px rgba(242,147,55,0.2)' : ''}`,
          cursor:       'pointer',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          zIndex:       200,
          transition:   'border-color 0.2s, box-shadow 0.3s',
          flexShrink:   0,
        }}
      >
        {open ? (
          // X when open
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <line x1="3" y1="3" x2="15" y2="15" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            <line x1="15" y1="3" x2="3" y2="15" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          // Book + sparkle icon when closed
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 4h7.5c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H3V4z" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M19 4h-6.5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H19V4z" stroke={ORANGE} strokeWidth="1.4" strokeLinejoin="round"/>
            <line x1="12.5" y1="9" x2="17" y2="9" stroke={ORANGE} strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="12.5" y1="12" x2="15.5" y2="12" stroke={ORANGE} strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        )}
        {/* Unread badge */}
        {badge && !open && (
          <div style={{
            position: 'absolute', top: 2, right: 2,
            width: 10, height: 10, borderRadius: '50%',
            background: ORANGE, border: '2px solid #fff',
          }}/>
        )}
      </button>

      {/* ── Tooltip label (shown only before first open) ──────────── */}
      {!open && pulse && (
        <div style={{
          position:   'fixed',
          bottom:     'max(env(safe-area-inset-bottom,0px),2.1rem)',
          right:      '5rem',
          background: NAVY,
          color:      '#fff',
          fontSize:   '0.72rem',
          fontWeight: 600,
          padding:    '0.4rem 0.75rem',
          borderRadius: 8,
          whiteSpace: 'nowrap',
          zIndex:     199,
          boxShadow:  '0 2px 12px rgba(0,0,0,0.25)',
          pointerEvents: 'none',
        }}>
          Ask a code question →
        </div>
      )}

      {/* ── Chat panel ────────────────────────────────────────────── */}
      {open && !dismissed && (
        <div
          ref={panelRef}
          style={{
            position:      'fixed',
            bottom:        'max(env(safe-area-inset-bottom,0px),5rem)',
            right:         '1.25rem',
            width:         'min(380px, calc(100vw - 2.5rem))',
            maxHeight:     'min(580px, calc(100dvh - 8rem))',
            background:    '#fff',
            borderRadius:  16,
            boxShadow:     '0 8px 48px rgba(10,28,46,0.28), 0 2px 8px rgba(10,28,46,0.12)',
            border:        `1px solid ${BORDER}`,
            zIndex:        199,
            display:       'flex',
            flexDirection: 'column',
            overflow:      'hidden',
            fontFamily:    "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          {/* Header */}
          <div style={{
            background:    NAVY,
            padding:       '0.9rem 1rem',
            display:       'flex',
            alignItems:    'center',
            gap:           '0.7rem',
            flexShrink:    0,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: `linear-gradient(135deg, ${BLUE}, #2C5A7A)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 2h5.5c.8 0 1.5.7 1.5 1.5v8c0 .8-.7 1.5-1.5 1.5H2V2z" stroke="#fff" strokeWidth="1.2"/>
                <path d="M14 2H8.5c-.8 0-1.5.7-1.5 1.5v8c0 .8.7 1.5 1.5 1.5H14V2z" stroke={ORANGE} strokeWidth="1.2"/>
                <line x1="9" y1="6" x2="13" y2="6" stroke={ORANGE} strokeWidth="1.1" strokeLinecap="round"/>
                <line x1="9" y1="8.5" x2="11.5" y2="8.5" stroke={ORANGE} strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                Code Assistant
              </div>
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
                {jurisdictionLabel} · Energy · Structural · Fire
              </div>
            </div>
            {jurisdiction && (
              <div style={{
                fontSize: '0.58rem', fontWeight: 700, color: ORANGE,
                background: 'rgba(242,147,55,0.15)', padding: '0.2rem 0.5rem',
                borderRadius: 5, border: '1px solid rgba(242,147,55,0.3)',
                letterSpacing: '0.04em', whiteSpace: 'nowrap',
              }}>
                {jurisdiction}
              </div>
            )}
            <button
              onClick={() => setDismissed(true)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: '0 0 0 0.25rem', flexShrink: 0 }}
            >×</button>
          </div>

          {/* Messages */}
          <div style={{
            flex:           1,
            overflowY:      'auto',
            padding:        '0.85rem 0.9rem',
            display:        'flex',
            flexDirection:  'column',
            gap:            '0.7rem',
            scrollBehavior: 'smooth',
          }}>
            {messages.map((msg, idx) => (
              <div key={msg.id}>
                {msg.role === 'assistant' || msg.role === 'intro' ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    {/* Avatar only on first message or after user message */}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: BLUE, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: 2,
                      opacity: (idx === 0 || messages[idx - 1]?.role === 'user') ? 1 : 0,
                    }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1 1h3.5c.5 0 .9.4.9.9v5c0 .5-.4.9-.9.9H1V1z" stroke="#fff" strokeWidth=".8"/>
                        <path d="M9 1H5.5c-.5 0-.9.4-.9.9v5c0 .5.4.9.9.9H9V1z" stroke={ORANGE} strokeWidth=".8"/>
                      </svg>
                    </div>
                    <div style={{
                      background:   '#F4F7FB',
                      border:       `1px solid ${BORDER}`,
                      borderRadius: '12px 12px 12px 3px',
                      padding:      '0.6rem 0.85rem',
                      fontSize:     '0.79rem',
                      lineHeight:   1.7,
                      color:        '#0D1E2E',
                      whiteSpace:   'pre-wrap',
                      maxWidth:     '90%',
                    }}>
                      {renderContent(msg.content)}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                      background:   BLUE,
                      borderRadius: '12px 12px 3px 12px',
                      padding:      '0.6rem 0.85rem',
                      fontSize:     '0.79rem',
                      lineHeight:   1.65,
                      color:        '#fff',
                      whiteSpace:   'pre-wrap',
                      maxWidth:     '85%',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                )}

                {/* Suggestion chips — only after the intro message */}
                {idx === 0 && msg.role === 'assistant' && messages.length === 1 && (
                  <div style={{ marginLeft: 30, marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#9DB4C5', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.1rem' }}>
                      Try asking
                    </div>
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s.q}
                        onClick={() => { setInput(s.q); inputRef.current?.focus() }}
                        style={{
                          display:    'flex',
                          alignItems: 'flex-start',
                          gap:        '0.4rem',
                          padding:    '0.45rem 0.65rem',
                          background: '#fff',
                          border:     `1px solid rgba(65,124,164,0.2)`,
                          borderRadius: 8,
                          fontSize:   '0.72rem',
                          color:      '#0D1E2E',
                          cursor:     'pointer',
                          fontFamily: 'inherit',
                          textAlign:  'left',
                          lineHeight: 1.45,
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F4F7FB')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                      >
                        <span style={{
                          fontSize: '0.55rem', fontWeight: 800, color: ORANGE,
                          background: 'rgba(242,147,55,0.12)', padding: '0.1rem 0.4rem',
                          borderRadius: 4, flexShrink: 0, marginTop: 1, letterSpacing: '0.04em',
                          whiteSpace: 'nowrap',
                        }}>{s.tag}</span>
                        {s.q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', paddingLeft: 30 }}>
                <div style={{ padding: '0.5rem 0.75rem', background: '#F4F7FB', border: `1px solid ${BORDER}`, borderRadius: '10px 10px 10px 3px', display: 'flex', gap: '0.28rem', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: BLUE, animation: 'chpulse 1.1s ease-in-out infinite', animationDelay: `${i * 0.18}s` }}/>
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef}/>
          </div>

          {/* Jurisdiction chips */}
          <div style={{ padding: '0.4rem 0.9rem 0', display: 'flex', gap: '0.35rem', flexWrap: 'wrap', flexShrink: 0 }}>
            {[
              { label: 'BC', sub: 'BCBC 2024' },
              { label: 'Ontario', sub: 'OBC 2024' },
              { label: 'Quebec', sub: 'CCQ 2020' },
              { label: 'USA', sub: 'IBC 2021' },
            ].map(j => (
              <button
                key={j.label}
                onClick={() => setJurisdiction(j.label)}
                style={{
                  padding:    '0.22rem 0.55rem',
                  background: jurisdiction === j.label ? NAVY : '#F4F7FB',
                  border:     `1px solid ${jurisdiction === j.label ? NAVY : 'rgba(44,90,122,0.18)'}`,
                  borderRadius: 6,
                  fontSize:   '0.62rem',
                  fontWeight: 700,
                  color:      jurisdiction === j.label ? '#fff' : '#5E7D9B',
                  cursor:     'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '0.03em',
                }}
              >
                {j.label} <span style={{ fontWeight: 400, opacity: 0.7 }}>{j.sub}</span>
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{
            padding:      '0.65rem 0.9rem',
            paddingBottom: 'max(env(safe-area-inset-bottom,0px),0.65rem)',
            borderTop:    `1px solid ${BORDER}`,
            display:      'flex',
            gap:          '0.45rem',
            alignItems:   'flex-end',
            flexShrink:   0,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Ask any building code question…"
              rows={1}
              style={{
                flex:        1,
                padding:     '0.55rem 0.8rem',
                background:  '#F4F7FB',
                border:      `1px solid ${BORDER}`,
                borderRadius: 20,
                fontSize:    '0.79rem',
                outline:     'none',
                resize:      'none',
                fontFamily:  'inherit',
                lineHeight:  1.5,
                maxHeight:   90,
                overflowY:   'auto',
                color:       '#0D1E2E',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              style={{
                width:      34, height: 34, borderRadius: '50%',
                background: input.trim() && !loading ? ORANGE : 'rgba(242,147,55,0.2)',
                border:     'none',
                cursor:     input.trim() && !loading ? 'pointer' : 'default',
                display:    'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.15s',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M1 13L13 7 1 1v5l8 1-8 1v5z" fill={input.trim() && !loading ? '#fff' : 'rgba(242,147,55,0.4)'}/>
              </svg>
            </button>
          </div>

          <div style={{ fontSize: '0.58rem', color: '#B0C8D8', textAlign: 'center', padding: '0 0.9rem 0.5rem', flexShrink: 0 }}>
            Compliance aid only · Always confirm with your authority having jurisdiction
          </div>
        </div>
      )}

      <style>{`
        @keyframes chpulse { 0%,100%{opacity:0.25} 50%{opacity:1} }
      `}</style>
    </>
  )
}
