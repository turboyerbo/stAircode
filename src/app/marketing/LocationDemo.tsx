'use client'
import { useState, useEffect, useRef } from 'react'

// ── Animated phone demo: detecting location → codes appear → Start Scan ──────

const NAVY  = '#0A1C2E'
const BLUE  = '#417CA4'
const GREEN = '#27A96B'

// Phases of the animation
type Phase = 'detecting' | 'detected' | 'codes' | 'ready'

export default function LocationDemo() {
  const [phase, setPhase] = useState<Phase>('detecting')
  const [dotCount, setDotCount] = useState(1)
  const [codeVisible, setCodeVisible] = useState(false)
  const [badgeVisible, setBadgeVisible] = useState(false)
  const [readyVisible, setReadyVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([])

  function push(fn: () => void, ms: number) {
    timerRef.current.push(setTimeout(fn, ms))
  }

  function runSequence() {
    setPhase('detecting')
    setDotCount(1)
    setCodeVisible(false)
    setBadgeVisible(false)
    setReadyVisible(false)

    // Animate the dots: 1 → 2 → 3
    push(() => setDotCount(2), 600)
    push(() => setDotCount(3), 1200)
    push(() => setDotCount(1), 1800)
    push(() => setDotCount(2), 2400)
    push(() => setDotCount(3), 3000)

    // Location confirmed
    push(() => { setPhase('detected') }, 3600)

    // Codes slide in
    push(() => { setPhase('codes'); setCodeVisible(true) }, 4600)

    // OBC badge pops
    push(() => setBadgeVisible(true), 5400)

    // Ready screen
    push(() => { setPhase('ready'); setReadyVisible(true) }, 7000)

    // Loop
    push(() => runSequence(), 10500)
  }

  useEffect(() => {
    runSequence()
    return () => { timerRef.current.forEach(clearTimeout) }
  }, []) // eslint-disable-line

  const dots = '.'.repeat(dotCount)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      margin: '0 auto 3.5rem',
      maxWidth: 340,
    }}>
      {/* Phone shell */}
      <div style={{
        width: 270,
        borderRadius: 46,
        background: 'linear-gradient(160deg,#1a1a1c,#2c2c2e)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1.5px rgba(255,255,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.06)',
        padding: '14px 13px 22px',
        position: 'relative',
      }}>
        {/* Side buttons */}
        <div style={{ position:'absolute', left:-3, top:88, width:3, height:30, borderRadius:'2px 0 0 2px', background:'rgba(255,255,255,0.12)' }}/>
        <div style={{ position:'absolute', left:-3, top:128, width:3, height:54, borderRadius:'2px 0 0 2px', background:'rgba(255,255,255,0.12)' }}/>
        <div style={{ position:'absolute', left:-3, top:190, width:3, height:54, borderRadius:'2px 0 0 2px', background:'rgba(255,255,255,0.12)' }}/>
        <div style={{ position:'absolute', right:-3, top:128, width:3, height:80, borderRadius:'0 2px 2px 0', background:'rgba(255,255,255,0.12)' }}/>

        {/* Dynamic island */}
        <div style={{
          width: 96, height: 30,
          background: '#111', borderRadius: 18,
          margin: '0 auto 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#1a1a1a' }}/>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#222' }}/>
        </div>

        {/* Screen */}
        <div style={{
          borderRadius: 28,
          overflow: 'hidden',
          background: '#F0F4F8',
          aspectRatio: '9/19.5',
          position: 'relative',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        }}>

          {/* Status bar */}
          <div style={{ background: NAVY, padding: '10px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.52rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em' }}>9:41</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {[3,2,1].map(h => <div key={h} style={{ width: 3, height: 3 * h, background: 'rgba(255,255,255,0.6)', borderRadius: 1 }}/>)}
              <div style={{ width: 10, height: 6, border: '1px solid rgba(255,255,255,0.5)', borderRadius: 1.5, marginLeft: 2, position: 'relative' }}>
                <div style={{ width: '65%', height: '60%', background: 'rgba(255,255,255,0.6)', margin: '1px 1px', borderRadius: 1 }}/>
                <div style={{ position:'absolute', right:-2, top:'50%', transform:'translateY(-50%)', width:1.5, height:4, background:'rgba(255,255,255,0.4)', borderRadius:1 }}/>
              </div>
            </div>
          </div>

          {/* App nav bar */}
          <div style={{ background: NAVY, padding: '0 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
              st<span style={{ color: '#F29337' }}>AI</span>rcode
            </div>
          </div>

          {/* Content area */}
          <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: '#F0F4F8', height: 'calc(100% - 78px)', boxSizing: 'border-box' }}>

            {/* ── PHASE: detecting / detected ── */}
            {(phase === 'detecting' || phase === 'detected') && (
              <div style={{
                background: '#fff',
                borderRadius: 12,
                padding: '14px 14px',
                border: '1px solid rgba(44,90,122,0.14)',
                boxShadow: '0 2px 8px rgba(44,74,110,0.06)',
                transition: 'all 0.4s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {/* Location dot */}
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: phase === 'detected' ? GREEN : '#F29337',
                    boxShadow: phase === 'detected'
                      ? `0 0 0 3px rgba(39,169,107,0.2)`
                      : `0 0 0 3px rgba(242,147,55,0.2)`,
                    flexShrink: 0,
                    transition: 'background 0.5s, box-shadow 0.5s',
                  }}/>
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 700, color: NAVY,
                    transition: 'all 0.4s',
                  }}>
                    {phase === 'detecting' ? `Detecting location${dots}` : 'Toronto, Ontario'}
                  </span>
                </div>

                {phase === 'detected' && (
                  <div style={{
                    fontSize: '0.52rem', color: '#5E7D9B', fontWeight: 500,
                    animation: 'fadeInUp 0.4s ease forwards',
                  }}>
                    Building Codes:{' '}
                    <span style={{ color: BLUE, fontWeight: 700 }}>OBC</span>
                    {' · '}
                    <span style={{ color: BLUE, fontWeight: 700 }}>Toronto Bylaw</span>
                    {' · '}
                    <span style={{ color: BLUE, fontWeight: 700 }}>AODA</span>
                  </div>
                )}
              </div>
            )}

            {/* ── PHASE: codes ── */}
            {(phase === 'codes' || phase === 'ready') && (
              <>
                {/* Location confirmed card */}
                <div style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: '12px 14px',
                  border: `1px solid rgba(39,169,107,0.3)`,
                  boxShadow: '0 2px 8px rgba(39,169,107,0.07)',
                  opacity: codeVisible ? 1 : 0,
                  transform: codeVisible ? 'none' : 'translateY(8px)',
                  transition: 'all 0.5s ease',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, boxShadow: '0 0 0 2px rgba(39,169,107,0.25)', flexShrink: 0 }}/>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: NAVY }}>Toronto, Ontario</span>
                    </div>
                    <div style={{
                      fontSize: '0.46rem', fontWeight: 800, color: '#0D7A5F',
                      background: '#E6F5F1', border: '1px solid rgba(13,122,95,0.3)',
                      padding: '2px 7px', borderRadius: 5,
                      opacity: badgeVisible ? 1 : 0,
                      transform: badgeVisible ? 'scale(1)' : 'scale(0.7)',
                      transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                    }}>OBC 2024</div>
                  </div>
                  <div style={{
                    marginTop: 8, fontSize: '0.52rem', color: '#5E7D9B', fontWeight: 500,
                    opacity: codeVisible ? 1 : 0,
                    transition: 'opacity 0.6s ease 0.2s',
                  }}>
                    Building Codes:{' '}
                    <span style={{ color: BLUE, fontWeight: 700 }}>OBC</span>
                    {' · '}
                    <span style={{ color: BLUE, fontWeight: 700 }}>Toronto Bylaw</span>
                    {' · '}
                    <span style={{ color: BLUE, fontWeight: 700 }}>AODA</span>
                  </div>
                </div>

                {/* Codes pop in as pills */}
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 5,
                  opacity: codeVisible ? 1 : 0,
                  transform: codeVisible ? 'none' : 'translateY(6px)',
                  transition: 'all 0.5s ease 0.15s',
                }}>
                  {[
                    { code: 'OBC 2024', color: '#417CA4', bg: 'rgba(65,124,164,0.1)', border: 'rgba(65,124,164,0.25)' },
                    { code: 'NBC 2020', color: '#5E7D9B', bg: 'rgba(94,125,155,0.08)', border: 'rgba(94,125,155,0.2)' },
                    { code: 'IBC 2021', color: '#5E7D9B', bg: 'rgba(94,125,155,0.08)', border: 'rgba(94,125,155,0.2)' },
                    { code: 'AODA',     color: '#27A96B', bg: 'rgba(39,169,107,0.08)', border: 'rgba(39,169,107,0.2)' },
                  ].map((c, i) => (
                    <div key={c.code} style={{
                      fontSize: '0.48rem', fontWeight: 700, color: c.color,
                      background: c.bg, border: `1px solid ${c.border}`,
                      padding: '3px 8px', borderRadius: 5,
                      opacity: codeVisible ? 1 : 0,
                      transform: codeVisible ? 'none' : 'scale(0.8)',
                      transition: `all 0.4s cubic-bezier(0.34,1.56,0.64,1) ${0.15 + i * 0.1}s`,
                    }}>{c.code}</div>
                  ))}
                </div>

                {/* ── PHASE: ready ── */}
                {phase === 'ready' && (
                  <div style={{
                    background: NAVY,
                    borderRadius: 12,
                    padding: '16px 14px',
                    display: 'flex', flexDirection: 'column', gap: 10,
                    marginTop: 4,
                    opacity: readyVisible ? 1 : 0,
                    transform: readyVisible ? 'none' : 'translateY(12px)',
                    transition: 'all 0.55s cubic-bezier(0.22,1,0.36,1)',
                  }}>
                    <div style={{ fontSize: '0.56rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Building Code Compliance</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.02em' }}>Ready to start your scan</div>
                    <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                      AI-Vision will guide you through each measurement and check compliance against OBC 2024.
                    </div>
                    <div style={{
                      background: 'linear-gradient(135deg,#27A96B,#1A7A50)',
                      borderRadius: 9, padding: '9px 12px',
                      fontSize: '0.58rem', fontWeight: 800, color: '#fff',
                      textAlign: 'center' as const,
                      letterSpacing: '0.02em',
                      boxShadow: '0 4px 14px rgba(39,169,107,0.4)',
                    }}>
                      Start Scan →
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 5, paddingTop: 2 }}>
                      {['Demo', 'My Inspections'].map((label, i) => (
                        <div key={label} style={{
                          flex: 1, padding: '7px 0',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 8,
                          fontSize: '0.48rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)',
                          textAlign: 'center' as const,
                        }}>{label}</div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>

        {/* Home bar */}
        <div style={{ width: 88, height: 4, background: 'rgba(255,255,255,0.22)', borderRadius: 4, margin: '14px auto 0' }}/>
      </div>

      {/* Phase indicator dots */}
      <div style={{ display: 'flex', gap: 6, marginTop: 16, alignItems: 'center' }}>
        {(['detecting','detected','codes','ready'] as Phase[]).map(p => (
          <div key={p} style={{
            width: phase === p ? 18 : 6,
            height: 6, borderRadius: 3,
            background: phase === p ? '#F29337' : 'rgba(44,90,122,0.2)',
            transition: 'all 0.35s ease',
          }}/>
        ))}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
