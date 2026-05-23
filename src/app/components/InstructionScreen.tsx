'use client'

/**
 * InstructionScreen.tsx
 *
 * Full-screen instruction page shown after "Get Started".
 * Contains:
 *  - Animated SVG diagram: person standing in front of staircase, phone held up
 *  - Phone screen preview showing what the AR overlay looks like
 *  - 3 swipeable instruction cards
 *  - "Open Camera" CTA
 *
 * Design direction: Technical / precision-instrument aesthetic.
 * Dark background, fine grid lines, surgical green accents, monospace labels.
 * Feels like a professional survey tool, not a consumer app.
 */

import { useState, useEffect } from 'react'

interface Props {
  onOpenCamera: () => void
  onBack: () => void
  fieldLabel?: string
}

// ── SVG Staircase Diagram ─────────────────────────────────────────────────────
// Animated SVG showing person → staircase → phone screen preview
function StaircaseDiagram({ animStep }: { animStep: number }) {
  return (
    <svg
      viewBox="0 0 320 210"
      width="100%"
      style={{ maxWidth: 360, display: 'block', margin: '0 auto' }}
      aria-label="Person standing in front of staircase, holding phone"
    >
      {/* Background grid */}
      <defs>
        <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(74,144,226,0.08)" strokeWidth="0.5"/>
        </pattern>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="320" height="210" fill="url(#grid)"/>

      {/* ── STAIRCASE (right side) ── */}
      {/* Steps — 4 risers visible */}
      {[0,1,2,3].map(i => (
        <g key={i}>
          {/* Tread */}
          <rect
            x={178 + i * 22} y={150 - i * 22}
            width="22" height="3"
            fill="#4A90E2" opacity="0.85"
          />
          {/* Riser face */}
          <rect
            x={178 + i * 22} y={153 - i * 22}
            width="3" height="22"
            fill="#2563a8" opacity="0.75"
          />
        </g>
      ))}
      {/* Floor */}
      <line x1="160" y1="153" x2="290" y2="153" stroke="#4A90E2" strokeWidth="2" opacity="0.5"/>
      {/* Landing */}
      <rect x="266" y="64" width="40" height="3" fill="#4A90E2" opacity="0.7"/>

      {/* ── RISER HEIGHT ANNOTATION (animates in on step 0) ── */}
      {animStep >= 0 && (
        <g opacity={animStep >= 1 ? 0.35 : 1} style={{ transition: 'opacity 0.5s' }}>{/* Bracket */}
          <line x1="172" y1="131" x2="172" y2="153" stroke="#4A90E2" strokeWidth="1.5"
            strokeDasharray={animStep === 0 ? "0,100" : "100,0"}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
          <line x1="168" y1="131" x2="176" y2="131" stroke="#4A90E2" strokeWidth="1.5"/>
          <line x1="168" y1="153" x2="176" y2="153" stroke="#4A90E2" strokeWidth="1.5"/>
          {/* Label */}
          <rect x="140" y="137" width="28" height="11" rx="3" fill="rgba(14,70,160,0.9)"/>
          <text x="154" y="145.5" textAnchor="middle" fill="#fff" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
            RISE
          </text>
        </g>
      )}

      {/* ── TREAD ANNOTATION (step 1) ── */}
      {animStep >= 1 && (
        <g opacity={animStep >= 2 ? 0.35 : 1} style={{ transition: 'opacity 0.5s' }}><line x1="178" y1="158" x2="200" y2="158" stroke="#ffa726" strokeWidth="1.5"
            strokeDasharray={animStep === 1 ? "0,100" : "100,0"}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
          <line x1="178" y1="155" x2="178" y2="161" stroke="#ffa726" strokeWidth="1.5"/>
          <line x1="200" y1="155" x2="200" y2="161" stroke="#ffa726" strokeWidth="1.5"/>
          <rect x="181" y="162" width="16" height="9" rx="2" fill="rgba(230,81,0,0.9)"/>
          <text x="189" y="169" textAnchor="middle" fill="#fff" fontSize="5.5" fontFamily="monospace" fontWeight="bold">TREAD</text>
        </g>
      )}

      {/* ── HEADROOM ANNOTATION (step 2) ── */}
      {animStep >= 2 && (
        <g style={{ transition: 'opacity 0.5s' }}><line x1="160" y1="64" x2="160" y2="153" stroke="#42a5f5" strokeWidth="1"
            strokeDasharray="3,3"
          />
          <line x1="156" y1="64" x2="164" y2="64" stroke="#42a5f5" strokeWidth="1.5"/>
          <line x1="156" y1="153" x2="164" y2="153" stroke="#42a5f5" strokeWidth="1.5"/>
          <rect x="118" y="100" width="37" height="9" rx="2" fill="rgba(13,71,161,0.9)"/>
          <text x="136" y="107" textAnchor="middle" fill="#fff" fontSize="5.5" fontFamily="monospace" fontWeight="bold">HEADROOM</text>
        </g>
      )}

      {/* ── PERSON (left side) ── */}
      {/* Body */}
      <g transform="translate(62, 60)">
        {/* Head */}
        <circle cx="0" cy="0" r="9" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
        {/* Neck + torso */}
        <line x1="0" y1="9" x2="0" y2="45" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
        {/* Arms — right arm extended holding phone */}
        <line x1="0" y1="18" x2="-14" y2="30" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
        {/* Right arm toward staircase */}
        <line x1="0" y1="18" x2="18" y2="26" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
        {/* Legs */}
        <line x1="0" y1="45" x2="-9" y2="72" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
        <line x1="0" y1="45" x2="9" y2="72" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
        {/* Feet */}
        <line x1="-9" y1="72" x2="-14" y2="72" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
        <line x1="9" y1="72" x2="14" y2="72" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
      </g>

      {/* ── PHONE (held by person, pointing at stairs) ── */}
      <g transform="translate(82, 80)">
        {/* Phone body */}
        <rect x="0" y="0" width="28" height="46" rx="4"
          fill="rgba(20,20,20,0.95)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
        {/* Camera lens dot */}
        <circle cx="14" cy="6" r="2" fill="rgba(255,255,255,0.3)"/>
        {/* Screen area */}
        <rect x="3" y="11" width="22" height="30" rx="2" fill="rgba(13,43,69,0.6)"/>

        {/* Mini stair on phone screen */}
        {[0,1,2].map(i => (
          <g key={i}>
            <rect x={5 + i*6} y={35 - i*6} width="6" height="1.5" fill="#4A90E2" opacity="0.9"/>
            <rect x={5 + i*6} y={36.5 - i*6} width="1.5" height="6" fill="#2563a8" opacity="0.8"/>
          </g>
        ))}

        {/* Green measurement line on phone screen */}
        {animStep >= 0 && (
          <line x1="4" y1="29" x2="4" y2="41" stroke="#4A90E2" strokeWidth="1.2"
            strokeDasharray="2,1"
            style={{ transition: 'opacity 0.3s' }}
          />
        )}
        {/* Dot endpoints */}
        {animStep >= 0 && (
          <>
            <circle cx="4" cy="29" r="1.5" fill="#4A90E2"/>
            <circle cx="4" cy="41" r="1.5" fill="#4A90E2"/>
          </>
        )}

        {/* Scan line animation */}
        <rect x="3" y="11" width="22" height="2" rx="1"
          fill="rgba(74,144,226,0.25)"
          style={{ animation: 'scanline 2s linear infinite' }}
        />
      </g>

      {/* ── SIGHT LINE from phone to stairs ── */}
      <line x1="110" y1="103" x2="178" y2="131"
        stroke="rgba(74,144,226,0.3)" strokeWidth="1"
        strokeDasharray="4,3"
      />
      <line x1="110" y1="103" x2="178" y2="153"
        stroke="rgba(74,144,226,0.2)" strokeWidth="1"
        strokeDasharray="4,3"
      />

      {/* ── DISTANCE LABEL ── */}
      <text x="136" y="95" fill="rgba(255,255,255,0.4)" fontSize="6" fontFamily="monospace" textAnchor="middle">
        60–90 cm
      </text>
      <line x1="110" y1="92" x2="162" y2="92"
        stroke="rgba(21,101,192,0.25)" strokeWidth="0.75"
        markerEnd="url(#arr)"
      />

      {/* ── FLOOR LINE ── */}
      <line x1="30" y1="153" x2="160" y2="153" stroke="rgba(21,101,192,0.22)" strokeWidth="1"/>

      {/* ── LABELS ── */}
      <text x="62" y="200" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace" textAnchor="middle">STAND HERE</text>
      <text x="220" y="200" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace" textAnchor="middle">STAIRCASE</text>

      <style>{`
        @keyframes scanline {
          0%   { transform: translateY(0);  opacity: 0.6; }
          100% { transform: translateY(18px); opacity: 0; }
        }
      `}</style>
    </svg>
  )
}

// ── Small stair part indicator (shown in corner during camera view) ───────────
export function StairPartIndicator({ fieldKey }: { fieldKey: string }) {
  // Map field key → which part to highlight
  const highlights: Record<string, { part: string; color: string; label: string }> = {
    riser:     { part: 'riser',    color: '#4A90E2', label: 'RISE HEIGHT' },
    tread:     { part: 'tread',    color: '#ffa726', label: 'TREAD DEPTH' },
    nosing:    { part: 'nosing',   color: '#ef5350', label: 'NOSING' },
    headroom:  { part: 'headroom', color: '#42a5f5', label: 'HEADROOM' },
    width:     { part: 'width',    color: '#ab47bc', label: 'WIDTH' },
    handrail:  { part: 'rail',     color: '#ffca28', label: 'GUARD HEIGHT' },
    variation: { part: 'riser',    color: '#4A90E2', label: 'VARIATION' },
    landing:   { part: 'landing',  color: '#26c6da', label: 'LANDING' },
  }
  const h = highlights[fieldKey] || highlights.riser

  return (
    <div style={{
      position: 'absolute', bottom: 160, right: 14,
      background: 'rgba(13,43,69,0.82)', backdropFilter: 'blur(10px)',
      border: `1.5px solid ${h.color}40`,
      borderRadius: 10, padding: '6px 8px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      zIndex: 20,
    }}><svg viewBox="0 0 60 70" width="52" height="62">
        {/* Stair outline */}
        {[0,1,2,3].map(i => (
          <g key={i}>
            {/* Tread */}
            <rect
              x={2 + i*13} y={54 - i*13}
              width="13" height="2.5"
              fill={h.part === 'tread' ? h.color : 'rgba(21,101,192,0.25)'}
              opacity={h.part === 'tread' ? 1 : 0.5}
            />
            {/* Riser */}
            <rect
              x={2 + i*13} y={56.5 - i*13}
              width="2.5" height="13"
              fill={h.part === 'riser' ? h.color : 'rgba(21,101,192,0.22)'}
              opacity={h.part === 'riser' ? 1 : 0.4}
            />
          </g>
        ))}
        {/* Nosing highlight */}
        {h.part === 'nosing' && [0,1,2,3].map(i => (
          <rect key={i}
            x={13 + i*13} y={54 - i*13}
            width="2" height="2.5"
            fill={h.color}
          />
        ))}
        {/* Headroom bracket */}
        {h.part === 'headroom' && (
          <>
            <line x1="58" y1="2" x2="58" y2="56" stroke={h.color} strokeWidth="1.5"/>
            <line x1="55" y1="2" x2="58" y2="2" stroke={h.color} strokeWidth="1.5"/>
            <line x1="55" y1="56" x2="58" y2="56" stroke={h.color} strokeWidth="1.5"/>
          </>
        )}
        {/* Width bracket */}
        {h.part === 'width' && (
          <>
            <line x1="2" y1="62" x2="54" y2="62" stroke={h.color} strokeWidth="1.5"/>
            <line x1="2" y1="59" x2="2" y2="65" stroke={h.color} strokeWidth="1.5"/>
            <line x1="54" y1="59" x2="54" y2="65" stroke={h.color} strokeWidth="1.5"/>
          </>
        )}
        {/* Handrail */}
        {h.part === 'rail' && (
          <>
            <line x1="4" y1="18" x2="55" y2="4" stroke={h.color} strokeWidth="2" strokeLinecap="round"/>
            <line x1="4" y1="56" x2="4" y2="18" stroke={h.color} strokeWidth="1.2" strokeDasharray="2,2"/>
          </>
        )}
        {/* Landing */}
        {h.part === 'landing' && (
          <rect x="2" y="57" width="58" height="4" rx="1" fill={h.color} opacity="0.8"/>
        )}
        {/* Riser measurement bracket — always show for riser/variation */}
        {h.part === 'riser' && (
          <>
            <line x1="0" y1="41.5" x2="0" y2="54" stroke={h.color} strokeWidth="1.5"/>
            <line x1="-3" y1="41.5" x2="3" y2="41.5" stroke={h.color} strokeWidth="1.5"/>
            <line x1="-3" y1="54" x2="3" y2="54" stroke={h.color} strokeWidth="1.5"/>
          </>
        )}
      </svg>
      <span style={{
        fontSize: '0.48rem', letterSpacing: '0.08em',
        color: h.color, fontWeight: 700,
      }}>{h.label}
      </span>
    </div>
  )
}

// ── Instruction steps data ────────────────────────────────────────────────────
const STEPS = [
  {
    icon: '',
    title: 'Stand 60–90 cm away',
    body: 'Position yourself directly in front of the staircase. Hold your phone at chest height, camera facing the steps.',
    animStep: 0,
  },
  {
    icon: '',
    title: 'Aim at the riser edge',
    body: 'Point the camera so the full height of one riser is visible. The blue line will auto-detect the edge.',
    animStep: 1,
  },
  {
    icon: '',
    title: 'Tap to draw a measurement',
    body: 'Tap the top of the riser, then drag down to the bottom. A dotted line appears with the detected dimension.',
    animStep: 2,
  },
]

// ── Main component ─────────────────────────────────────────────────────────────
export default function InstructionScreen({ onOpenCamera, onBack, fieldLabel }: Props) {
  const [step, setStep]         = useState(0)
  const [animStep, setAnimStep] = useState(0)
  const [entering, setEntering] = useState(false)

  // Auto-advance through diagram animation states
  useEffect(() => {
    const iv = setInterval(() => {
      setAnimStep(prev => (prev + 1) % 3)
    }, 2200)
    return () => clearInterval(iv)
  }, [])

  function goStep(n: number) {
    setEntering(true)
    setTimeout(() => { setStep(n); setEntering(false) }, 180)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0a0f0a',
      display: 'flex', flexDirection: 'column',
      maxWidth: 430, margin: '0 auto',
      fontFamily: 'var(--sans)',
      overflowY: 'auto',
    }}>{/* Fine grid background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(74,144,226,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(74,144,226,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px',
      }}/>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '3rem 1.25rem 0.75rem',
        borderBottom: '1px solid rgba(74,144,226,0.12)',
        position: 'relative', zIndex: 2,
      }}><button onClick={onBack} style={{
          background: 'none', color: 'rgba(255,255,255,0.5)',
          fontSize: '0.75rem', cursor: 'pointer',
          letterSpacing: '0.1em', padding: '0.3rem 0.6rem',
          border: '1px solid rgba(21,101,192,0.22)', borderRadius: 6,
        }}>← BACK</button>
        <span style={{
          fontSize: '0.6rem', letterSpacing: '0.04em',
          color: 'rgba(74,144,226,0.7)', textTransform: 'uppercase',
        }}>HOW TO MEASURE
        </span>
        <span style={{
          fontSize: '0.6rem',
          color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em',
        }}>{fieldLabel ? fieldLabel.toUpperCase() : 'STAIRCASE'}
        </span>
      </div>

      {/* Diagram area */}
      <div style={{
        padding: '1.5rem 1rem 0.5rem',
        borderBottom: '1px solid rgba(74,144,226,0.1)',
        position: 'relative', zIndex: 2,
        background: 'rgba(0,0,0,0.3)',
      }}><StaircaseDiagram animStep={animStep} />

        {/* Animated dimension label underneath diagram */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '1rem',
          marginTop: '0.75rem', marginBottom: '0.25rem',
        }}>{[
            { key: 0, label: 'RISE', color: '#4A90E2' },
            { key: 1, label: 'TREAD', color: '#ffa726' },
            { key: 2, label: 'HEADROOM', color: '#42a5f5' },
          ].map(item => (
            <div key={item.key} style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              opacity: animStep === item.key ? 1 : 0.3,
              transition: 'opacity 0.4s',
            }}><div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }}/>
              <span style={{ fontSize: '0.55rem', color: item.color, letterSpacing: '0.1em' }}>{item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step cards */}
      <div style={{ padding: '1.25rem 1.25rem 0', position: 'relative', zIndex: 2 }}>{/* Step tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>{STEPS.map((s, i) => (
            <button key={i} onClick={() => goStep(i)} style={{
              flex: 1, padding: '0.4rem 0',
              background: step === i ? 'rgba(74,144,226,0.15)' : 'rgba(21,101,192,0.05)',
              border: `1px solid ${step === i ? 'rgba(74,144,226,0.5)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}><span style={{ fontSize: '1rem' }}>{s.icon}</span>
              <span style={{
                fontSize: '0.5rem', letterSpacing: '0.08em',
                color: step === i ? '#4A90E2' : 'rgba(255,255,255,0.35)',
                fontWeight: step === i ? 700 : 400,
              }}>STEP {i+1}</span>
            </button>
          ))}
        </div>

        {/* Active step card */}
        <div style={{
          background: 'rgba(21,101,192,0.05)',
          border: '1px solid rgba(74,144,226,0.18)',
          borderRadius: 12, padding: '1.1rem 1.1rem',
          minHeight: 90,
          opacity: entering ? 0 : 1,
          transform: entering ? 'translateY(6px)' : 'translateY(0)',
          transition: 'opacity 0.18s, transform 0.18s',
        }}><div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}><div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(74,144,226,0.15)',
              border: '1px solid rgba(74,144,226,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.72rem', color: '#4A90E2', fontWeight: 700,
              flexShrink: 0,
            }}>{step + 1}
            </div>
            <div>
              <p style={{
                fontFamily: 'var(--display)', fontSize: '0.95rem', fontWeight: 700, color: '#fff', margin: 0, marginBottom: '0.35rem',
              }}>{STEPS[step].title}
              </p>
              <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.65 }}>{STEPS[step].body}
              </p>
            </div>
          </div>
        </div>

        {/* Key tip panels */}
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem' }}>{[
            { icon: '', text: 'Type any value manually to override' },
            { icon: '↩', text: 'Skip a step if measurement is tricky' },
          ].map((tip, i) => (
            <div key={i} style={{
              flex: 1, background: 'rgba(21,101,192,0.04)',
              border: '1px solid rgba(21,101,192,0.09)', borderRadius: 8,
              padding: '0.6rem 0.65rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
            }}><span style={{ fontSize: '0.85rem' }}>{tip.icon}</span>
              <span style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{tip.text}
              </span>
            </div>
          ))}
        </div>

        {/* What you will see on screen */}
        <div style={{
          marginTop: '0.75rem',
          background: 'rgba(74,144,226,0.05)',
          border: '1px solid rgba(74,144,226,0.2)',
          borderRadius: 10, padding: '0.75rem 0.85rem',
          display: 'flex', gap: '0.75rem', alignItems: 'center',
        }}>{/* Mini phone mockup */}
          <div style={{
            width: 38, height: 62, background: '#111', border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: 6, flexShrink: 0, position: 'relative', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{/* Screen content: stair edges + line */}
            <svg viewBox="0 0 34 56" width="34" height="56">
              {/* Stair shapes */}
              {[0,1,2].map(i => (
                <g key={i}>
                  <rect x={3+i*9} y={38-i*9} width="9" height="2" fill="#2563a8" opacity="0.8"/>
                  <rect x={3+i*9} y={40-i*9} width="2" height="9" fill="#1d4e8a" opacity="0.7"/>
                </g>
              ))}
              {/* Detected edge lines */}
              <line x1="3" y1="38" x2="30" y2="38" stroke="#4A90E2" strokeWidth="0.8" strokeDasharray="2,1" opacity="0.7"/>
              <line x1="3" y1="47" x2="12" y2="47" stroke="#4A90E2" strokeWidth="0.8" strokeDasharray="2,1" opacity="0.5"/>
              {/* Measurement line (tap-to-draw style) */}
              <line x1="2" y1="38" x2="2" y2="47" stroke="#4A90E2" strokeWidth="1.2"/>
              <circle cx="2" cy="38" r="1.8" fill="#fff" stroke="#4A90E2" strokeWidth="0.8"/>
              <circle cx="2" cy="47" r="1.8" fill="#fff" stroke="#4A90E2" strokeWidth="0.8"/>
              {/* Dimension label */}
              <rect x="4" y="40" width="12" height="5" rx="1.5" fill="rgba(14,70,160,0.9)"/>
              <text x="10" y="44" textAnchor="middle" fill="#fff" fontSize="3.5" fontFamily="monospace">175mm</text>
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', color: '#93c5fd', fontWeight: 700, letterSpacing: '0.05em' }}>WHAT YOU&apos;LL SEE
            </p>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.68rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>Green dashed lines mark detected edges. Tap and drag to draw a measurement. The dimension appears instantly.
            </p>
          </div>
        </div>
      </div>

      {/* Spacer + CTA */}
      <div style={{ flex: 1 }}/>
      <div style={{
        padding: '1rem 1.25rem 2.5rem',
        borderTop: '1px solid rgba(74,144,226,0.12)',
        position: 'relative', zIndex: 2,
        background: 'linear-gradient(to top, rgba(13,43,69,0.8) 0%, transparent 100%)',
      }}><button onClick={onOpenCamera} style={{
          width: '100%', padding: '1.05rem',
          background: 'linear-gradient(135deg, #1565C0 0%, #1976D2 100%)',
          border: 'none', borderRadius: 14, cursor: 'pointer',
          fontSize: '0.85rem', fontWeight: 700,
          letterSpacing: '0.04em', color: '#fff', textTransform: 'uppercase',
          boxShadow: '0 4px 24px rgba(14,70,160,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
        }}>Open Camera
        </button>
        <p style={{
          textAlign: 'center', marginTop: '0.6rem',
          fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em',
        }}>CAMERA OPENS ON THE RISE HEIGHT FIRST
        </p>
      </div>
    </div>
  )
}
