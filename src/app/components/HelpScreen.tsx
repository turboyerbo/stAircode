'use client'
/**
 * HelpScreen.tsx — ARAI_11
 * AR/AI guide, measurement explainer (5-image sequence), FAQ, support.
 */

import { useState } from 'react'
import { BetaLogo } from '@/app/components/Logo'
import FeedbackButton from './FeedbackButton'

// ── Design tokens ──────────────────────────────────────────────────────────────
const BG     = '#0A1C2E'
const BG2    = '#0F2438'
const BORDER = 'rgba(147,186,212,0.12)'
const TEXT   = '#E8F4FF'
const TEXT2  = '#93BAD4'
const TEXT3  = '#4E7A9B'
const BLUE   = '#417CA4'
const ORANGE = '#F29337'
const GREEN  = '#3DB88A'
const AMBER  = '#F29337'
const PURPLE = '#A78BFA'
const RED    = '#E84545'

// ── How-the-phone-measures sequence ───────────────────────────────────────────
const MEASURE_STEPS = [
  {
    id: 'detect', image: '/Measure_01_detect.png', badge: '01', label: 'Detect & Measure', color: BLUE,
    title: 'AR sensor fires at the riser — riser height locked',
    desc: 'The phone acts like a precision laser rangefinder. A red AR beam fires from the camera directly at the vertical riser face. Two red anchor points appear — one where the beam hits the riser, one at the base. The dashed line between them is the riser height measured to the millimetre.',
    detail: 'This happens automatically as soon as the riser fills the frame. No tapping required — hold still for 2–3 seconds and the reading locks.',
    icon: '📡',
  },
  {
    id: 'ar_check', image: '/Measure_02_ar_check.png', badge: '02', label: 'AI Cross-Check', color: AMBER,
    title: 'AI Vision checks your camera position before measuring',
    desc: 'Before locking a reading, the AI coach analyses the camera frame to confirm the angle is correct. The orange atom icon means the AI is actively reviewing your position. If the camera is slightly off-axis, the AI tells you exactly how to adjust — before the measurement fires.',
    detail: "The dotted line shows the AI's line-of-sight assessment to the nosing. AR gives distance; AI gives confidence — together they catch angle errors that either system would miss alone.",
    icon: '🤖',
  },
  {
    id: 'fail', image: '/Measure_03_fail.png', badge: '03', label: 'Measurement Failed', color: RED,
    title: 'Measurement failed — the AI guides you to reposition',
    desc: "When the phone screen shows a ⊘ symbol, the current frame cannot be measured reliably. This usually means the phone is too close, too far, or at an angle greater than 15° from the riser face. Do not move yet — wait for the AI's spoken instruction.",
    detail: 'The AI will tell you precisely what to change: step back, move left, or improve the lighting. Usually a small shift of 20–30cm resolves it. The ⊘ clears automatically when the position is good.',
    icon: '⚠️',
  },
  {
    id: 'confirmed', image: '/Measure_04_confirmed.png', badge: '04', label: 'Confirmed ✓', color: GREEN,
    title: 'AI confirms position — measurement re-fires in blue',
    desc: 'Once you reposition correctly, the AR ray re-fires and the beam turns blue. Blue means the AI has verified the camera is square to the riser face, the distance is plausible, and the reading is trustworthy. The blue anchor dots and dashed line show the confirmed measurement.',
    detail: 'You will see the measurement value on screen before you tap Confirm. If it looks wrong, tap Retry — the AI will guide you through another attempt from scratch.',
    icon: '✅',
  },
  {
    id: 'width', image: '/Measure_05_width.png', badge: '05', label: 'Stair Width', color: BLUE,
    title: 'Two rays triangulate the full stair width',
    desc: 'For stair width, the AR system fires two rays simultaneously — one to the left edge and one to the right edge of the stair. The two blue lines converge from the phone to each stringer. The dashed line between the two blue anchor points is the measured stair width.',
    detail: 'Firing two rays at once gives a more accurate width reading than a single ray, even if you are not standing perfectly centred. The prior riser measurement is used as a built-in scale check.',
    icon: '📐',
  },
]

// ── Position steps (how-to) ────────────────────────────────────────────────────
const SCAN_STEPS = [
  {
    id: 'overview', step: '01', image: '/Clear_headroom.png', color: BLUE,
    title: 'Full Stair View — Step Count & Headroom',
    what: 'Stand back so the full staircase fits in frame. The AI counts steps and checks headroom clearance.',
    how: [
      'Stand 2–3 metres from the base of the stair.',
      'Hold the phone level at chest height — the full flight should be visible top to bottom.',
      'Hold still for 3 seconds. AI counts risers and checks for ceiling or soffit above.',
      'If headroom is clear and open, it is logged automatically. If a ceiling is visible, the AI estimates the clearance in mm.',
    ],
    tip: 'Make sure the top and bottom of the stair are both in frame. If the stair is very long, step back further.',
  },
  {
    id: 'riser', step: '02', image: '/Measure_Riser_front.png', color: GREEN,
    title: 'Riser Height — Phone on the Nosing',
    what: 'Place the phone on the nosing with the camera pointing at the vertical riser face.',
    how: [
      'Set the phone upright on the tread nosing, standing on its bottom edge.',
      'The camera should point straight at the riser face (the vertical kickplate).',
      'Centre the riser in the frame so it fills the screen width.',
      'Hold still for 3 seconds while the AR sensor measures the riser height.',
    ],
    tip: "The phone's own width (~70mm) acts as a built-in scale reference — the AI uses it to double-check the measurement.",
  },
  {
    id: 'rotate', step: '03', image: '/Rotate_Phone_90.png', color: AMBER,
    title: 'Rotate 90° — Nosing & Tread Edge',
    what: 'Without moving, rotate the phone 90° so it lies flat on the tread, camera looking along the surface.',
    how: [
      'Keeping the phone in the same spot on the nosing, rotate it flat (landscape).',
      'The camera now faces along the tread surface toward the front edge.',
      'Hold still for 2 seconds — the AI checks for a nosing overhang.',
      'A nosing is a lip that projects more than ~15mm beyond the riser face below.',
    ],
    tip: "You don't need to move your feet — this is the same position as Step 02, just rotated.",
  },
  {
    id: 'handrail', step: '04', image: '/Handrail_height_offset.png', color: PURPLE,
    title: 'Handrail Height & Offset',
    what: 'Frame both the tread surface and the top of the handrail in a single shot.',
    how: [
      'Stand beside the stair, facing the handrail from the side.',
      'Hold the phone so both the tread surface at bottom and the rail top are visible.',
      'The AI measures the vertical height from nosing to rail top.',
      'It also estimates the handrail offset — horizontal distance from the wall to the rail centre.',
    ],
    tip: "If the full rail isn't visible, the AI extrapolates from what it can see and defaults to a standard height (915mm) if needed.",
  },
  {
    id: 'width', step: '05', image: '/Change_angles.png', color: BLUE,
    title: 'Stair Width — Both Edges in Frame',
    what: 'Step back or reposition until both left and right edges of the stair are visible.',
    how: [
      'Move to a position where both stringers (or walls) on each side are clearly visible.',
      'Hold the phone level so the stair width runs horizontally in frame.',
      'Hold still for 3 seconds. Two AR rays fire to each edge simultaneously.',
      'The measured distance between the two anchor points is the stair width.',
    ],
    tip: 'The riser height you already measured is used as a scale reference — so even if you\'ve moved, the AI can calibrate the width accurately.',
  },
  {
    id: 'tread', step: '06', image: '/Measure_tread.png', color: GREEN,
    title: 'Tread Depth — Phone Above the Step',
    what: 'Hold the phone flat above the step with the camera facing straight down.',
    how: [
      'Hold the phone parallel to the tread surface, about 20–30cm above it.',
      'Camera faces straight down — as if taking a photo of the top of the step.',
      'Keep it as steady as possible for 3 seconds.',
      'AI measures from the front nosing edge to the back riser — this is the tread depth.',
    ],
    tip: 'This is the last position. After the AI reads the tread, you move straight to reviewing your measurements and generating your report.',
  },
]

// ── FAQ ────────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: 'How does the AR measurement actually work?',
    a: "Your phone fires an infrared ray from the camera — exactly like a laser tape measure. Where the ray hits a surface, it records the distance. The AR system (ARCore on Android, ARKit on iOS) does this in real time, many times per second. The AI Vision layer then verifies the reading, corrects for angle errors, and confirms the measurement is within the expected range for residential stairs.",
  },
  {
    q: 'What do the coloured beams and dots mean?',
    a: "Red beam with red dots = AR is actively measuring but not yet confirmed. Orange atom icon = AI is cross-checking the AR reading. Blue beam with blue dots = measurement confirmed and locked. No beam or a ⊘ symbol = the current frame can't be measured — reposition and try again.",
  },
  {
    q: 'How accurate are the measurements?',
    a: 'Typical accuracy is ±9–20mm using AR + AI analysis. On ARCore/ARKit devices the AR sensor alone achieves ±5–10mm; the AI layer adds angle correction on top. All measurements are preliminary estimates — always confirm with a qualified inspector for regulatory submissions.',
  },
  {
    q: 'Which building codes are supported?',
    a: 'OBC 2024 (Ontario), NBC 2020 (Canada), QBC/CCQ (Québec), BCBC 2024 (BC), IBC 2021, IRC 2021 (USA), ADA/ABA 2010. Your jurisdiction is detected automatically from GPS or IP location.',
  },
  {
    q: 'What if the AI keeps repeating the same instruction?',
    a: "Try a small shift — even 20–30cm can help the AR sensor find a better surface angle. Make sure the lighting is adequate. If you're stuck after 3 attempts, tap Retry on the result screen to re-take that position from scratch.",
  },
  {
    q: 'Does the app save my photos?',
    a: 'No. Camera frames are analysed in memory during the session and discarded immediately. Nothing is saved to your camera roll or stored on our servers.',
  },
  {
    q: 'What phone do I need?',
    a: 'Any modern smartphone with a rear camera. Best results on iPhone 12+ or Android 2019+. AR plane detection (higher accuracy) requires ARCore on Android or ARKit on iOS Safari.',
  },
  {
    q: 'What does the Full Report include?',
    a: 'A detailed AI-generated compliance report including: full stair description, compliance analysis per dimension with code citations, occupancy classification, applicable bylaw notes, and a pre-inspection summary for a building official. The report is emailed to you instantly.',
  },
]

// ── Component ──────────────────────────────────────────────────────────────────
export default function HelpScreen() {
  const [activeMeasure, setActiveMeasure] = useState(0)
  const [expandedStep,  setExpandedStep]  = useState<string | null>(null)
  const [openFAQ,       setOpenFAQ]       = useState<number | null>(null)

  const ms = MEASURE_STEPS[activeMeasure]

  return (
    <div style={{ flex:1, overflowY:'auto', background:BG, backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px),repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px)', color:TEXT, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", paddingBottom:'2rem' }}>

      {/* HEADER */}
      <div style={{ padding:'1.4rem 1.25rem 1.1rem', backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px),repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px)' }}>
        <div style={{ marginBottom:'0.5rem' }}><BetaLogo size="sm" onDark /></div>
        <h1 style={{ fontSize:'1.5rem', fontWeight:900, color:TEXT, letterSpacing:'-0.02em', margin:0 }}>📷 🤖  AR / AI Guide</h1>
        <p style={{ fontSize:'0.78rem', color:TEXT2, margin:'0.4rem 0 0', lineHeight:1.55 }}>
          Your phone&apos;s AR sensor and Claude AI Vision work together to measure your staircase — no tape measure needed.
        </p>
      </div>
      <div style={{ height:5, background:'repeating-linear-gradient(-45deg,#F29337 0px,#F29337 5px,#0A1C2E 5px,#0A1C2E 12px)', backgroundSize:'20px 20px' }} />

      {/* ══ AR + AI INTERACTION EXPLAINER IMAGE ══ */}
      <div style={{ margin:'1rem 1rem 0.5rem', borderRadius:16, overflow:'hidden', border:'1.5px solid rgba(147,186,212,0.12)', boxShadow:'0 4px 24px rgba(0,0,0,0.3)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/AR_AI_guide_interaction.jpg"
          alt="AR and AI working together to measure stair dimensions"
          style={{ width:'100%', display:'block', objectFit:'cover' }}
        />
        <div style={{ background:BG2, padding:'0.75rem 1rem', borderTop:'1px solid rgba(147,186,212,0.12)' }}>
          <div style={{ fontSize:'0.72rem', fontWeight:700, color:ORANGE, marginBottom:'0.25rem', letterSpacing:'0.04em' }}>
            How AR + AI work together
          </div>
          <div style={{ fontSize:'0.72rem', color:TEXT2, lineHeight:1.6 }}>
            The phone fires an AR ray at the stair (red line). The AI Vision layer (orange atom) checks your camera angle before confirming the reading. When both agree, the measurement locks in blue. This dual-layer approach catches angle errors that either system would miss alone.
          </div>
        </div>
      </div>

      {/* ══ HOW YOUR PHONE MEASURES ══ */}
      <SectionHeader label="How Your Phone Measures" />

      {/* Pill tabs — no scrollbar */}
      <div style={{ display:'flex', gap:'0.4rem', padding:'0 1rem 0.75rem', overflowX:'auto', WebkitOverflowScrolling:'touch' as any, scrollbarWidth:'none', msOverflowStyle:'none' } as any}>
        {MEASURE_STEPS.map((s, i) => (
          <button key={s.id} onClick={() => setActiveMeasure(i)} style={{ flexShrink:0, padding:'0.32rem 0.75rem', borderRadius:20, border:`1.5px solid ${activeMeasure===i ? s.color : BORDER}`, background: activeMeasure===i ? `${s.color}22` : 'transparent', color: activeMeasure===i ? s.color : TEXT3, fontFamily:'monospace', fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', cursor:'pointer', transition:'all 0.15s' }}>
            {s.badge} {s.label}
          </button>
        ))}
      </div>

      {/* Active card — no image, nav arrows + text only */}
      <div style={{ margin:'0 1rem 1rem', borderRadius:18, overflow:'hidden', border:`1.5px solid ${ms.color}44` }}>
        {/* Step nav bar — large prominent arrows, no scrollbar */}
        <div style={{ background: `${ms.color}12`, borderBottom:`1px solid ${ms.color}22`, padding:'0.7rem 1rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.75rem' }}>
          <button onClick={() => setActiveMeasure(i => Math.max(0, i-1))} disabled={activeMeasure===0}
            style={{ width:44, height:44, borderRadius:12, background: activeMeasure===0 ? 'rgba(255,255,255,0.05)' : `${ms.color}22`, border:`2px solid ${activeMeasure===0 ? 'rgba(255,255,255,0.1)' : ms.color}`, color: activeMeasure===0 ? 'rgba(255,255,255,0.2)' : ms.color, fontSize:'1.5rem', fontWeight:700, cursor: activeMeasure===0 ? 'default' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s', flexShrink:0 }}>‹</button>
          {/* Dot progress — centred */}
          <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flex:1, justifyContent:'center' }}>
            {MEASURE_STEPS.map((_,i) => (
              <div key={i} onClick={() => setActiveMeasure(i)} style={{ width:i===activeMeasure?22:8, height:8, borderRadius:4, background:i===activeMeasure ? ms.color : 'rgba(255,255,255,0.18)', cursor:'pointer', transition:'all 0.25s', boxShadow: i===activeMeasure ? `0 0 8px ${ms.color}` : 'none' }} />
            ))}
          </div>
          <button onClick={() => setActiveMeasure(i => Math.min(MEASURE_STEPS.length-1, i+1))} disabled={activeMeasure===MEASURE_STEPS.length-1}
            style={{ width:44, height:44, borderRadius:12, background: activeMeasure===MEASURE_STEPS.length-1 ? 'rgba(255,255,255,0.05)' : `${ms.color}22`, border:`2px solid ${activeMeasure===MEASURE_STEPS.length-1 ? 'rgba(255,255,255,0.1)' : ms.color}`, color: activeMeasure===MEASURE_STEPS.length-1 ? 'rgba(255,255,255,0.2)' : ms.color, fontSize:'1.5rem', fontWeight:700, cursor: activeMeasure===MEASURE_STEPS.length-1 ? 'default' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s', flexShrink:0 }}>›</button>
        </div>
        {/* Step badge + counter */}
        <div style={{ background:BG2, padding:'0.65rem 1.1rem 0', display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <div style={{ background:ms.color, color: ms.id==='fail' ? '#fff' : '#000', fontFamily:'monospace', fontWeight:800, fontSize:'0.58rem', letterSpacing:'0.12em', borderRadius:8, padding:'0.2rem 0.6rem' }}>{ms.badge} / 05</div>
        </div>

        {/* Text */}
        <div style={{ background:BG2, padding:'0.75rem 1.1rem 1rem' }}>
          <div style={{ fontSize:'0.92rem', fontWeight:800, color:TEXT, lineHeight:1.3, marginBottom:'0.5rem' }}>{ms.title}</div>
          <div style={{ fontSize:'0.78rem', color:TEXT2, lineHeight:1.7, marginBottom:'0.65rem' }}>{ms.desc}</div>
          <div style={{ background:`${ms.color}0D`, border:`1px solid ${ms.color}30`, borderRadius:12, padding:'0.6rem 0.85rem', display:'flex', gap:'0.5rem', alignItems:'flex-start' }}>
            <span style={{ fontSize:'0.85rem', flexShrink:0 }}>{ms.icon}</span>
            <div style={{ fontSize:'0.72rem', color:TEXT2, lineHeight:1.65 }}>{ms.detail}</div>
          </div>
        </div>
      </div>

      {/* What you see on screen — legend */}
      <div style={{ margin:'0 1rem 1.25rem', background:BG2, border:`1.5px solid ${BORDER}`, borderRadius:14, padding:'0.85rem 1rem' }}>
        <div style={{ fontSize:'0.58rem', fontFamily:'monospace', letterSpacing:'0.15em', color:ORANGE, fontWeight:700, marginBottom:'0.7rem' }}>WHAT YOU SEE ON SCREEN</div>
        {[
          { color:'#E84545', dot:'●', line:'———', label:'Red beam + red dots',   desc:'AR is actively measuring — hold still' },
          { color:AMBER,     dot:'✦', line:'···',  label:'Orange atom icon',      desc:'AI is checking your camera position' },
          { color:'#E84545', dot:'⊘', line:'',     label:'Block / no beam',       desc:'Failed — reposition and wait for AI guidance' },
          { color:'#4A90E2', dot:'●', line:'———', label:'Blue beam + blue dots',  desc:'Measurement confirmed and locked ✓' },
          { color:'#4A90E2', dot:'◈', line:'△△',  label:'Two blue rays',         desc:'Dual-ray width capture — both edges measured' },
        ].map(({ color, dot, line, label, desc }) => (
          <div key={label} style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem', marginBottom:'0.55rem' }}>
            <div style={{ minWidth:36, display:'flex', alignItems:'center', gap:'0.2rem', paddingTop:'0.05rem' }}>
              <span style={{ color, fontSize:'0.85rem', fontFamily:'monospace', lineHeight:1 }}>{dot}</span>
              {line && <span style={{ color, fontSize:'0.62rem', fontFamily:'monospace', letterSpacing:'-0.05em', opacity:0.7 }}>{line}</span>}
            </div>
            <div style={{ fontSize:'0.75rem', color:TEXT2, lineHeight:1.45 }}>
              <span style={{ fontWeight:700, color, display:'block', marginBottom:'0.1rem' }}>{label}</span>
              {desc}
            </div>
          </div>
        ))}
      </div>

      {/* ══ SCANNING POSITIONS — Instagram link ══ */}
      <SectionHeader label="Scanning Positions" />

      <div style={{ margin:'0 1rem 1rem' }}>
        {/* Intro */}
        <div style={{ background:BG2, border:`1.5px solid ${BORDER}`, borderRadius:14, padding:'0.85rem 1rem', marginBottom:'0.75rem' }}>
          <div style={{ fontSize:'0.78rem', color:TEXT2, lineHeight:1.65 }}>
            Follow us on Instagram for <strong style={{ color:TEXT }}>step-by-step video guides</strong> showing exactly how to position your phone for each of the 6 scan positions — riser, tread, nosing, handrail, width, and headroom.
          </div>
        </div>
        {/* Instagram card */}
        <a href="https://www.instagram.com/staircode/" target="_blank" rel="noopener noreferrer"
          style={{ display:'flex', alignItems:'center', gap:'1rem', background:'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)', borderRadius:16, padding:'1.1rem 1.25rem', textDecoration:'none', boxShadow:'0 6px 24px rgba(131,58,180,0.35)' }}>
          <div style={{ width:48, height:48, borderRadius:14, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.8rem', flexShrink:0 }}>
            📸
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'0.92rem', fontWeight:800, color:'#fff', marginBottom:'0.2rem' }}>@staircode.app</div>
            <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.85)', lineHeight:1.5 }}>
              How-to videos · Scan guides · Tips & updates
            </div>
          </div>
          <div style={{ fontSize:'1.4rem', color:'rgba(255,255,255,0.8)', flexShrink:0 }}>→</div>
        </a>
      </div>

      {/* ══ FAQ ══ */}
      <SectionHeader label="Frequently Asked Questions" />
      <div style={{ margin:'0 1rem' }}>
        {FAQ.map((item, i) => (
          <div key={i} style={{ background:BG2, border:`1.5px solid ${BORDER}`, borderRadius:14, marginBottom:'0.45rem', overflow:'hidden' }}>
            <button onClick={() => setOpenFAQ(openFAQ===i ? null : i)} style={{ width:'100%', padding:'0.9rem 1rem', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' as const, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'0.6rem' }}>
              <span style={{ fontSize:'0.85rem', fontWeight:700, color:TEXT, lineHeight:1.4 }}>{item.q}</span>
              <span style={{ color:TEXT2, fontSize:'1.1rem', flexShrink:0, transition:'transform 0.2s', transform:openFAQ===i?'rotate(45deg)':'none' }}>+</span>
            </button>
            {openFAQ === i && (
              <div style={{ padding:'0 1rem 0.9rem', paddingTop:'0.6rem', fontSize:'0.78rem', color:TEXT2, lineHeight:1.7, borderTop:`1px solid ${BORDER}` }}>
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ══ SUPPORT ══ */}
      <SectionHeader label="Support" />
      <div style={{ margin:'0 1rem 1.5rem', background:BG2, border:`1.5px solid ${BORDER}`, borderRadius:16, padding:'1.2rem', display:'flex', flexDirection:'column', gap:'0.8rem' }}>
        <div>
          <div style={{ fontSize:'0.95rem', fontWeight:700, color:TEXT, marginBottom:'0.3rem' }}>Still have questions?</div>
          <div style={{ fontSize:'0.78rem', color:TEXT2, lineHeight:1.55 }}>Our team typically responds within one business day.</div>
        </div>
        <FeedbackButton source="help_screen" />
        <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
          <div style={{ flex:1, height:1, background:BORDER }} />
          <span style={{ fontSize:'0.62rem', color:TEXT3, fontFamily:'monospace' }}>OR</span>
          <div style={{ flex:1, height:1, background:BORDER }} />
        </div>
        <a href="mailto:info@staircode.app?subject=stAIrcode%20Support" style={{ display:'block', width:'100%', padding:'0.95rem', background:`linear-gradient(135deg, ${BLUE}, ${ORANGE})`, border:'none', borderRadius:12, color:'#fff', fontSize:'0.88rem', fontWeight:700, textAlign:'center', textDecoration:'none', boxShadow:`0 4px 20px rgba(65,124,164,0.3)`, letterSpacing:'0.06em', boxSizing:'border-box' } as any}>
          ✉️ &nbsp;Email info@staircode.app
        </a>
      </div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ padding:'1.1rem 1.25rem 0.4rem', display:'flex', alignItems:'center', gap:'0.6rem' }}>
      <div style={{ height:1, width:14, background:ORANGE, borderRadius:1 }} />
      <span style={{ fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.18em', color:ORANGE, fontFamily:'monospace', textTransform:'uppercase' as const }}>{label}</span>
    </div>
  )
}
