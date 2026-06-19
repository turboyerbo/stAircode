'use client'
/**
 * WelcomeModal.tsx
 * Shown once on a user's first sign-in (gated by localStorage 'sc_welcome_seen').
 * Invites them to try the stair demo and explains flexible project creation.
 */
import { useState } from 'react'

const NAVY  = '#0A1C2E'
const BLUE  = '#417CA4'
const GREEN = '#27A96B'
const ORANGE = '#F29337'

interface Props {
  onTryDemo:    () => void
  onCreateProject: () => void
  onClose:      () => void
}

export default function WelcomeModal({ onTryDemo, onCreateProject, onClose }: Props) {
  const [closing, setClosing] = useState(false)

  function dismiss(then?: () => void) {
    try { localStorage.setItem('sc_welcome_seen', '1') } catch {}
    setClosing(true)
    setTimeout(() => { onClose(); then?.() }, 180)
  }

  return (
    <>
      <div onClick={() => dismiss()}
        style={{ position:'fixed', inset:0, background:'rgba(10,28,46,0.6)', zIndex:300, backdropFilter:'blur(2px)', opacity: closing ? 0 : 1, transition:'opacity 0.18s' }}/>
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:`translate(-50%,-50%) scale(${closing ? 0.96 : 1})`,
        zIndex:301, width:'calc(100% - 2.5rem)', maxWidth:380,
        background:'#fff', borderRadius:18, overflow:'hidden',
        boxShadow:'0 24px 70px rgba(0,0,0,0.4)',
        opacity: closing ? 0 : 1, transition:'all 0.18s',
        fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        maxHeight:'88dvh', display:'flex', flexDirection:'column',
      }}>
        {/* Header */}
        <div style={{ background:NAVY, padding:'1.5rem 1.5rem 1.25rem', textAlign:'center', position:'relative' }}>
          <button onClick={() => dismiss()} style={{ position:'absolute', top:'0.75rem', right:'1rem', background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:'1.4rem', cursor:'pointer', lineHeight:1 }}>×</button>
          <div style={{ fontSize:'1.4rem', fontWeight:800, letterSpacing:'-0.02em', color:'#fff', marginBottom:'0.3rem' }}>Welcome to st<span style={{ color:ORANGE }}>AI</span>rcode</div>
          <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.6)', lineHeight:1.5 }}>Building code compliance, measured and reported on site.</div>
        </div>

        {/* Body */}
        <div style={{ padding:'1.25rem 1.5rem', overflowY:'auto', display:'flex', flexDirection:'column', gap:'1.1rem' }}>

          {/* Quick demo callout */}
          <div style={{ background:'rgba(39,169,107,0.07)', border:'1px solid rgba(39,169,107,0.25)', borderRadius:12, padding:'1rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.4rem' }}>
              <div style={{ width:24, height:24, borderRadius:7, background:'rgba(39,169,107,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><rect x="1" y="12" width="5" height="7" rx="0.5" stroke={GREEN} strokeWidth="1.5"/><rect x="6" y="7" width="5" height="12" rx="0.5" stroke={GREEN} strokeWidth="1.5"/><rect x="11" y="1" width="8" height="18" rx="0.5" stroke={GREEN} strokeWidth="1.5"/></svg>
              </div>
              <div style={{ fontSize:'0.9rem', fontWeight:800, color:NAVY }}>Start with a quick stair scan</div>
            </div>
            <div style={{ fontSize:'0.76rem', color:'#5E7D9B', lineHeight:1.6, marginBottom:'0.85rem' }}>
              Point your camera at any staircase and watch stAIrcode measure the rise, run, headroom, nosing, and handrail — then check each against your local code in seconds. It&rsquo;s the fastest way to see how powerful and easy the tool is. No project setup needed.
            </div>
            <button onClick={() => dismiss(onTryDemo)}
              style={{ width:'100%', padding:'0.8rem', background:`linear-gradient(135deg,${GREEN},#1A7A50)`, border:'none', borderRadius:9, fontSize:'0.85rem', fontWeight:800, color:'#fff', cursor:'pointer', boxShadow:'0 3px 12px rgba(39,169,107,0.35)' }}>
              Try the Stair Demo →
            </button>
          </div>

          {/* Project creation explainer */}
          <div>
            <div style={{ fontSize:'0.9rem', fontWeight:800, color:NAVY, marginBottom:'0.4rem' }}>Then create a full project</div>
            <div style={{ fontSize:'0.76rem', color:'#5E7D9B', lineHeight:1.6, marginBottom:'0.6rem' }}>
              When you&rsquo;re ready, start a new inspection project. Add as much or as little as you need — just an address for a quick pre-screen, or full client, permit, and drawing details for a comprehensive multi-phase report. stAIrcode scales to any project, from a single stair to a complete residential build.
            </div>
            <button onClick={() => dismiss(onCreateProject)}
              style={{ width:'100%', padding:'0.8rem', background:'#fff', border:`1.5px solid ${BLUE}`, borderRadius:9, fontSize:'0.85rem', fontWeight:700, color:BLUE, cursor:'pointer' }}>
              Create a New Project
            </button>
          </div>
        </div>

        {/* Footer */}
        <button onClick={() => dismiss()}
          style={{ padding:'0.85rem', background:'#F7FAFC', border:'none', borderTop:'1px solid rgba(44,90,122,0.1)', fontSize:'0.78rem', fontWeight:600, color:'#9DB4C5', cursor:'pointer' }}>
          I&rsquo;ll explore on my own
        </button>
      </div>
    </>
  )
}
