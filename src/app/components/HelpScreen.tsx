'use client'
/**
 * HelpScreen.tsx — ARAI_10
 * How-to guide with illustrated scanning steps, FAQ accordion, and contact.
 */

import { useState } from 'react'
import FeedbackButton from './FeedbackButton'

// ── Design tokens ──────────────────────────────────────────────────────────────
const BG     = '#0A1C2E'
const BG2    = '#0F2438'
const BG3    = '#152D46'
const BORDER = 'rgba(147,186,212,0.12)'
const TEXT   = '#E8F4FF'
const TEXT2  = '#93BAD4'
const TEXT3  = '#4E7A9B'
const BLUE   = '#417CA4'
const ORANGE = '#F29337'
const GREEN  = '#3DB88A'
const AMBER  = '#F29337'
const PURPLE = '#A78BFA'

// ── Scanning steps ─────────────────────────────────────────────────────────────
// Each step maps to one of the three provided illustrations
const SCAN_STEPS = [
  {
    id:    'riser-tread',
    image: '/Girl_measuring.png',
    step:  '01',
    color: GREEN,
    title: 'Riser Height & Tread Depth',
    what:  'The AI will first guide you to measure the riser (vertical face) and tread (horizontal surface) of the steps.',
    how: [
      'Stand about 1 metre directly in front of the staircase, facing the riser face.',
      'Hold your phone upright at chest height, camera pointing straight at the vertical face of the steps.',
      'The AI coach will tell you if you need to move closer, farther, or adjust your angle.',
      'Once the riser is locked, the AI will ask you to tilt the phone downward to capture tread depth from above.',
      'A green measurement line will appear across the riser face or along the tread to confirm the reading.',
    ],
    tip: 'Keep the phone steady for 2–3 seconds after repositioning — the AI analyses a fresh frame every few seconds.',
  },
  {
    id:    'headroom-width',
    image: '/Lady_measuring_clearance.png',
    step:  '02',
    color: AMBER,
    title: 'Headroom & Stair Width',
    what:  'The AI will then assess headroom clearance and the full width of the staircase.',
    how: [
      'Step back so the full staircase is visible — both left and right sides in frame.',
      'The AI will measure the clear width between the two stringers or walls.',
      'For headroom, it looks for any ceiling, beam, or soffit above the nosing line.',
      'If no ceiling is visible, it will note "open above" — no action needed from you.',
      'A warning will appear on screen if the stair or headroom appears to be non-compliant.',
    ],
    tip: 'If the AI seems stuck, walk around to a position where both edges of the stair are clearly visible.',
  },
  {
    id:    'handrail',
    image: '/Man_measuring_handrail.png',
    step:  '03',
    color: PURPLE,
    title: 'Handrail Height',
    what:  'Finally, the AI guides you to measure the handrail height from the tread surface to the top of the rail.',
    how: [
      'Face the handrail from the side — you need to see both the tread surface at the bottom and the top of the rail.',
      'Crouch or kneel so the camera is level with the tread surface, as shown in the illustration.',
      'The phone should be horizontal, pointing straight at the handrail from the side.',
      'The AI will draw a vertical measurement line from the tread level up to the top of the rail.',
      'Once locked, confirm the reading — the app will show the full measurements summary.',
    ],
    tip: 'Baluster spacing and nosing measurements are captured automatically in the background — no extra steps needed.',
  },
]

// ── FAQ ────────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: 'How does the AI guidance work?',
    a: 'As soon as you enter the scan screen, the camera opens and the AI coach starts analysing what it sees every few seconds. It describes what\'s in frame and tells you — conversationally — how to reposition your phone. You don\'t tap a button for each measurement: just follow the instructions and the app advances automatically when it has a confident reading.',
  },
  {
    q: 'How accurate are the measurements?',
    a: 'Typical accuracy is ±9–20mm using AI camera analysis. On ARCore/ARKit devices the AI uses plane detection for improved accuracy. All measurements are preliminary — always confirm with a qualified inspector for regulatory submissions.',
  },
  {
    q: 'Which building codes are supported?',
    a: 'OBC 2024 (Ontario), NBC 2020 (Canada), QBC/CCQ (Québec), BCBC 2024 (BC), IBC 2021, IRC 2021 (USA), RCNYS 2020 (New York), ADA/ABA 2010, and Bbl 2024 (Netherlands). Your jurisdiction is detected automatically from GPS.',
  },
  {
    q: 'What if the AI keeps repeating the same instruction?',
    a: 'Try moving to a slightly different position or angle — even a small shift of 20–30cm can help. Make sure the lighting is adequate (turn on nearby lights if needed). If you\'re stuck after 3–4 attempts, tap "Rescan" in the confirm tray to restart that measurement.',
  },
  {
    q: 'Does the app save my photos?',
    a: 'No. Frames are analysed in memory during the session and discarded immediately. Nothing is saved to your camera roll or stored on our servers.',
  },
  {
    q: 'What phone do I need?',
    a: 'Any modern smartphone with a rear camera. Best results on iPhone 12+ or Android 2019+. For AR plane detection (higher accuracy), ARCore is required on Android or ARKit on iOS Safari.',
  },
  {
    q: 'What does the $11.99 Full Report include?',
    a: 'A detailed professional report generated by AI including: full stair description, compliance analysis for each dimension with code citations, occupancy type classification, applicable bylaw notes, and a pre-inspection summary suitable for a building official. The report is printable and can be shared as a PDF.',
  },
  {
    q: 'How do I upgrade to Pro?',
    a: 'Tap "Get Full Report" on the results screen, then choose the Pro option at $38.99/month. Pro gives 20 scans/month, unlimited full reports, AR plane detection, and coverage across all supported codes.',
  },
]

// ── Component ──────────────────────────────────────────────────────────────────
export default function HelpScreen() {
  const [expandedStep, setExpandedStep] = useState<string | null>('riser-tread')
  const [openFAQ,      setOpenFAQ]      = useState<number | null>(null)

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#F0F5FA', backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(65,124,164,0.04) 27px,rgba(65,124,164,0.04) 28px),repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(65,124,164,0.04) 27px,rgba(65,124,164,0.04) 28px)', color: '#0D1E2E', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", paddingBottom: '2rem' }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '1.6rem 1.25rem 0.5rem', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: '0.52rem', fontFamily: 'monospace', letterSpacing: '0.3em', color: ORANGE, marginBottom: '0.4rem' }}>▲ STAIRCODE</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#0D1E2E', letterSpacing: '-0.02em' }}>Help & How-To</h1>
        <p style={{ fontSize: '0.78rem', color: '#2C4A68', margin: '0.35rem 0 0', lineHeight: 1.55 }}>
          Follow the on-screen AI guidance and move around the stair to capture each measurement.
        </p>
      </div>

      {/* ── HOW TO SCAN ── */}
      <SectionHeader label="How to Scan Your Stairs" />

      {/* Intro card */}
      <div style={{ margin: '0 1rem 1rem', background: '#fff', border: '1.5px solid rgba(65,124,164,0.14)', borderRadius: 16, padding: '1rem 1.1rem' }}>
        <div style={{ fontSize: '0.82rem', color: '#2C4A68', lineHeight: 1.7 }}>
          The AI coach opens with your camera and guides you through <strong style={{ color: TEXT }}>three positions</strong> around the staircase. Follow its instructions — it will tell you exactly where to stand and how to angle your phone. Measurement lines appear on screen as each dimension is captured.
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Riser', color: GREEN },
            { label: 'Tread', color: GREEN },
            { label: 'Width', color: BLUE },
            { label: 'Headroom', color: AMBER },
            { label: 'Handrail', color: PURPLE },
            { label: 'Nosing ✦', color: '#5E7D9B' },
          ].map(({ label, color }) => (
            <div key={label} style={{ fontSize: '0.6rem', fontFamily: 'monospace', color, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: 10, padding: '0.2rem 0.6rem', fontWeight: 700 }}>
              {label}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.62rem', color: '#5E7D9B', marginTop: '0.5rem', fontStyle: 'italic' }}>
          ✦ Nosing and baluster spacing are measured automatically in the background.
        </div>
      </div>

      {/* Step cards with illustrations */}
      {SCAN_STEPS.map(step => {
        const isOpen = expandedStep === step.id
        return (
          <div key={step.id} style={{ margin: '0 1rem 0.75rem', borderRadius: 18, overflow: 'hidden', border: `1.5px solid ${isOpen ? step.color + '55' : BORDER}`, transition: 'border-color 0.2s' }}>

            {/* Illustration */}
            <div style={{ position: 'relative', background: '#F5F0EB' }}>
              <img
                src={step.image}
                alt={step.title}
                style={{ width: '100%', display: 'block', maxHeight: 240, objectFit: 'cover', objectPosition: 'center' }}
              />
              {/* Step number badge */}
              <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', background: step.color, color: '#000', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.65rem', letterSpacing: '0.1em', borderRadius: 8, padding: '0.25rem 0.65rem' }}>
                STEP {step.step}
              </div>
            </div>

            {/* Title row — tap to expand */}
            <button
              onClick={() => setExpandedStep(isOpen ? null : step.id)}
              style={{ width: '100%', padding: '0.9rem 1rem', background: BG2, border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.7rem', borderTop: `1px solid ${BORDER}` }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: step.color, boxShadow: `0 0 8px ${step.color}`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: TEXT }}>{step.title}</div>
                <div style={{ fontSize: '0.7rem', color: '#2C4A68', marginTop: '0.1rem', lineHeight: 1.4 }}>{step.what}</div>
              </div>
              <span style={{ color: '#5E7D9B', fontSize: '1.1rem', transition: 'transform 0.2s', transform: isOpen ? 'rotate(45deg)' : 'none', flexShrink: 0 }}>+</span>
            </button>

            {/* Expanded instructions */}
            {isOpen && (
              <div style={{ background: 'rgba(65,124,164,0.05)', borderTop: `1px solid ${BORDER}`, padding: '0.9rem 1rem 1rem' }}>
                <div style={{ fontSize: '0.62rem', fontFamily: 'monospace', letterSpacing: '0.12em', color: step.color, fontWeight: 700, marginBottom: '0.6rem' }}>
                  STEP-BY-STEP
                </div>
                {step.how.map((instruction, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.7rem', marginBottom: '0.55rem', alignItems: 'flex-start' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${step.color}22`, border: `1px solid ${step.color}44`, color: step.color, fontSize: '0.6rem', fontFamily: 'monospace', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.05rem' }}>
                      {i + 1}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#2C4A68', lineHeight: 1.6 }}>{instruction}</div>
                  </div>
                ))}
                {/* Tip */}
                <div style={{ marginTop: '0.75rem', background: `${step.color}0F`, border: `1px solid ${step.color}30`, borderRadius: 12, padding: '0.65rem 0.85rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>💡</span>
                  <div style={{ fontSize: '0.73rem', color: '#2C4A68', lineHeight: 1.6 }}>
                    <strong style={{ color: step.color }}>Tip: </strong>{step.tip}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* ── WHAT THE LINES MEAN ── */}
      <SectionHeader label="What the Measurement Lines Mean" />
      <div style={{ margin: '0 1rem 1rem', background: '#fff', border: '1.5px solid rgba(65,124,164,0.14)', borderRadius: 16, padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {[
          { color: GREEN,  line: '▬▬▬',  label: 'Riser Height',  desc: 'Vertical line on the riser face — measured from tread to tread' },
          { color: AMBER,  line: '  ║  ', label: 'Tread Depth',   desc: 'Vertical line (in top-down view) from the front nosing to the back riser — measures step depth' },
          { color: BLUE,   line: '◄────►', label: 'Stair Width',  desc: 'Wide horizontal line spanning both edges of the staircase' },
          { color: PURPLE, line: '▬▬▬',  label: 'Handrail Height', desc: 'Vertical line from tread level up to the top of the rail' },
          { color: '#5E7D9B',  line: '· · ·', label: 'Nosing',        desc: 'Short tick at the tread edge — or a note if none is detected' },
        ].map(({ color, line, label, desc }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 36, textAlign: 'center', fontSize: '0.75rem', color, fontFamily: 'monospace', flexShrink: 0 }}>{line}</div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: TEXT }}>{label}</div>
              <div style={{ fontSize: '0.68rem', color: '#2C4A68', lineHeight: 1.45 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── FAQ ── */}
      <SectionHeader label="Frequently Asked Questions" />
      <div style={{ margin: '0 1rem' }}>
        {FAQ.map((item, i) => (
          <div key={i} style={{ background: '#fff', border: '1.5px solid rgba(65,124,164,0.14)', borderRadius: 14, marginBottom: '0.45rem', overflow: 'hidden' }}>
            <button
              onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
              style={{ width: '100%', padding: '0.9rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem' }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0D1E2E', lineHeight: 1.4 }}>{item.q}</span>
              <span style={{ color: '#5E7D9B', fontSize: '1.1rem', flexShrink: 0, transition: 'transform 0.2s', transform: openFAQ === i ? 'rotate(45deg)' : 'none' }}>+</span>
            </button>
            {openFAQ === i && (
              <div style={{ padding: '0 1rem 0.9rem', paddingTop: '0.6rem', fontSize: '0.78rem', color: '#2C4A68', lineHeight: 1.7, borderTop: `1px solid ${BORDER}` }}>
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── SUPPORT ── */}
      <SectionHeader label="Support" />
      <div style={{ margin: '0 1rem 1.5rem', background: '#fff', border: '1.5px solid rgba(65,124,164,0.14)', borderRadius: 16, padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0D1E2E', marginBottom: '0.3rem' }}>Still have questions?</div>
          <div style={{ fontSize: '0.78rem', color: '#2C4A68', lineHeight: 1.55 }}>Our team typically responds within one business day.</div>
        </div>
        <FeedbackButton source="help_screen" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
          <span style={{ fontSize: '0.62rem', color: '#5E7D9B', fontFamily: 'monospace' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
        </div>
        <a
          href="mailto:info@staircode.app?subject=StairCode%20Support%20Request"
          style={{ display: 'block', width: '100%', padding: '0.95rem', background: `linear-gradient(135deg, ${BLUE}, ${ORANGE})`, border: 'none', borderRadius: 12, color: '#fff', fontSize: '0.88rem', fontWeight: 700, textAlign: 'center', textDecoration: 'none', boxShadow: `0 4px 20px rgba(65,124,164,0.3)`, letterSpacing: '0.06em', boxSizing: 'border-box' } as any}
        >
          ✉️ &nbsp;Email info@staircode.app
        </a>
      </div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ padding: '1.1rem 1.25rem 0.4rem', display:'flex', alignItems:'center', gap:'0.6rem' }}>
      <div style={{ height:1, width:14, background:ORANGE, borderRadius:1 }} />
      <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.18em', color: ORANGE, fontFamily: 'monospace', textTransform: 'uppercase' as const }}>{label}</span>
    </div>
  )
}
