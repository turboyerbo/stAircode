'use client'
/**
 * ScanModeSelect.tsx
 *
 * Replaces the role-select screen with a two-option scan mode choice:
 *   SPEED    — ~90 seconds, auto-fills if uncertain, good for quick pre-checks
 *   ACCURACY — full coached flow, waits for clean frames, best for reports
 */

import { BetaLogo } from '@/app/components/Logo'

export type ScanMode = 'speed' | 'accuracy'

interface Props {
  onSelect: (mode: ScanMode) => void
}

const ORANGE    = '#FA741F'
const DARK_BLUE = '#0D2B52'
const BG        = '#0A1C2E'
const BG2       = '#0F2438'
const BG3       = '#152D46'
const BORDER    = 'rgba(65,124,164,0.18)'
const TEXT      = '#E8F4FF'
const TEXT2     = '#93BAD4'
const TEXT3     = '#4E7A9B'
const GREEN     = '#27A96B'
const STRIPE    = 'repeating-linear-gradient(-45deg,#F29337 0px,#F29337 5px,#0A1C2E 5px,#0A1C2E 12px)'

export default function ScanModeSelect({ onSelect }: Props) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: BG,
      backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px),repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 'max(env(safe-area-inset-top,0px),2.5rem) 1.25rem 2.5rem',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>{/* Logo */}
      <div style={{ marginBottom: '1.5rem' }}><BetaLogo size="md" onDark />
      </div>

      {/* Safety stripe */}
      <div style={{ width: '100%', maxWidth: 420, height: 5, background: STRIPE, borderRadius: 2, marginBottom: '1.5rem' }} />

      {/* Heading */}
      <h1 style={{ fontSize: '1.55rem', fontWeight: 900, color: TEXT, textAlign: 'center', margin: '0 0 0.4rem', letterSpacing: '-0.02em' }}>Who is this scan for?
      </h1>
      <p style={{ fontSize: '0.78rem', color: TEXT2, textAlign: 'center', margin: '0 0 2rem', lineHeight: 1.55, maxWidth: 320 }}>Choose based on your situation. Both modes produce a full compliance report.
      </p>

      {/* Cards */}
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>{/* ── SPEED card ── */}
        <button
          onClick={() => onSelect('speed')}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            background: `linear-gradient(135deg, ${BG2} 0%, rgba(250,116,31,0.08) 100%)`,
            border: `2px solid ${ORANGE}55`,
            borderRadius: 20, padding: '1.25rem 1.25rem 1.1rem',
            position: 'relative', overflow: 'hidden',
            boxShadow: `0 4px 24px rgba(250,116,31,0.15)`,
            transition: 'all 0.15s',
          }}
        >
          {/* Top accent bar */}
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${ORANGE},#FFB347)`, borderRadius:'20px 20px 0 0' }} />

          <div style={{ display:'flex', alignItems:'flex-start', gap:'1rem' }}>{/* Icon */}
            <div style={{ width:54, height:54, borderRadius:14, background:`rgba(250,116,31,0.15)`, border:`1.5px solid ${ORANGE}55`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'1.6rem' }}></div>

            <div style={{ flex:1 }}><div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem' }}><span style={{ fontSize:'1.1rem', fontWeight:900, color:TEXT }}>Individual</span>
                <span style={{ fontSize:'0.6rem', background:`rgba(250,116,31,0.2)`, color:ORANGE, fontFamily:'monospace', fontWeight:800, letterSpacing:'0.1em', padding:'0.15rem 0.5rem', borderRadius:6 }}>~90 SEC</span>
              </div>
              <p style={{ fontSize:'0.78rem', color:TEXT2, margin:0, lineHeight:1.65 }}>Quick and simple — good for a personal check.
              </p>
            </div>
          </div>


        </button>

        {/* ── ACCURACY card ── */}
        <button
          onClick={() => onSelect('accuracy')}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            background: `linear-gradient(135deg, ${BG2} 0%, rgba(39,169,107,0.08) 100%)`,
            border: `2px solid ${GREEN}55`,
            borderRadius: 20, padding: '1.25rem 1.25rem 1.1rem',
            position: 'relative', overflow: 'hidden',
            boxShadow: `0 4px 24px rgba(39,169,107,0.12)`,
            transition: 'all 0.15s',
          }}
        >
          {/* Top accent bar */}
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${GREEN},#4ADE80)`, borderRadius:'20px 20px 0 0' }} />

          <div style={{ display:'flex', alignItems:'flex-start', gap:'1rem' }}>{/* Icon */}
            <div style={{ width:54, height:54, borderRadius:14, background:`rgba(39,169,107,0.15)`, border:`1.5px solid ${GREEN}55`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'1.6rem' }}>‍
            </div>

            <div style={{ flex:1 }}><div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem' }}><span style={{ fontSize:'1.1rem', fontWeight:900, color:TEXT }}>Professional</span>
                <span style={{ fontSize:'0.6rem', background:`rgba(39,169,107,0.2)`, color:GREEN, fontFamily:'monospace', fontWeight:800, letterSpacing:'0.1em', padding:'0.15rem 0.5rem', borderRadius:6 }}>3–5 MIN</span>
              </div>
              <p style={{ fontSize:'0.78rem', color:TEXT2, margin:0, lineHeight:1.65 }}>For architects, contractors, building managers, and real estate. AI coaches each frame for best accuracy.
              </p>
            </div>
          </div>


        </button>
      </div>

      {/* Footer note */}
      <p style={{ fontSize:'0.62rem', color:TEXT3, textAlign:'center', marginTop:'1.5rem', lineHeight:1.6, maxWidth:320 }}>Both modes produce the same full compliance report.
      </p>
    </div>
  )
}
