'use client'
/**
 * ProjectTypeScreen.tsx
 *
 * Multi-step project setup for a new Full Building Inspection.
 *
 * Step 1 — Project type: New Construction or Renovation
 * Step 2 (renovation) — Permit: "Do you have a building permit or construction
 *         documents?" → controls whether permit/drawings modules appear
 * Step 3 (renovation) — Scope funnel: Interior Only, Exterior Only, Foundations,
 *         Roof, Exterior Deck, or Whole Building
 *
 * The chosen scope + permit status drive which inspection modules appear, so the
 * inspector never scrolls past irrelevant modules.
 */

import { useState } from 'react'
import type { ProjectType, RenovationScope } from '@/lib/inspection-types'
import { RENOVATION_SCOPE_META } from '@/lib/inspection-types'
import { NavLogo } from './Logo'

export interface ProjectSetupResult {
  type:             ProjectType
  renovationScope?: RenovationScope
  hasPermit?:       boolean
}

interface Props {
  onSelect: (result: ProjectSetupResult) => void
  onBack:   () => void
}

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const ORANGE = '#F29337'
const BORDER = 'rgba(44,90,122,0.14)'

type Step = 'type' | 'permit' | 'scope'

function ScopeIcon({ kind, color }: { kind: string; color: string }) {
  const c = color
  switch (kind) {
    case 'interior':
      return <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="4" y="8" width="20" height="16" rx="1.5" stroke={c} strokeWidth="1.6"/><line x1="4" y1="16" x2="24" y2="16" stroke={c} strokeWidth="1.3"/><rect x="7" y="11" width="4" height="3" stroke={c} strokeWidth="1.2"/></svg>
    case 'exterior':
      return <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 12L14 5l10 7" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><rect x="6" y="12" width="16" height="11" stroke={c} strokeWidth="1.6"/><rect x="11" y="16" width="6" height="7" stroke={c} strokeWidth="1.3"/></svg>
    case 'foundation':
      return <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="4" y="16" width="20" height="8" stroke={c} strokeWidth="1.6"/><path d="M4 16h20M8 16v8M14 16v8M20 16v8" stroke={c} strokeWidth="1.1" strokeOpacity="0.6"/><path d="M6 11h16" stroke={c} strokeWidth="1.4" strokeDasharray="2 2"/></svg>
    case 'roof':
      return <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M3 15L14 6l11 9" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 12l7-5 7 5" stroke={c} strokeWidth="1.2" strokeOpacity="0.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="14" y1="6" x2="14" y2="3" stroke={c} strokeWidth="1.4"/></svg>
    case 'deck':
      return <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="4" y="13" width="20" height="4" stroke={c} strokeWidth="1.5"/><path d="M4 17v6M10 17v6M18 17v6M24 17v6" stroke={c} strokeWidth="1.4" strokeLinecap="round"/><path d="M6 13V8M22 13V8" stroke={c} strokeWidth="1.3"/><path d="M6 9h16" stroke={c} strokeWidth="1.2"/></svg>
    default:
      return <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 13L14 5l10 8" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><rect x="6" y="13" width="16" height="11" stroke={c} strokeWidth="1.6"/><rect x="9" y="17" width="4" height="7" stroke={c} strokeWidth="1.2"/><rect x="16" y="16" width="4" height="3" stroke={c} strokeWidth="1.2"/></svg>
  }
}

export default function ProjectTypeScreen({ onSelect, onBack }: Props) {
  const [step, setStep] = useState<Step>('type')
  const [hasPermit, setHasPermit] = useState<boolean | null>(null)

  const shell = (inner: React.ReactNode, title: string, sub: string, kicker: string, headerBack: () => void) => (
    <div style={{ minHeight: '100dvh', background: '#F4F7FB', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: '#0D1E2E', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: NAVY, paddingTop: 'max(env(safe-area-inset-top,0px),1rem)', paddingBottom: '1.5rem', paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button onClick={headerBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>Back</button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><NavLogo height={22} /></div>
          <div style={{ width: 32 }} />
        </div>
        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{kicker}</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: '0 0 0.4rem', lineHeight: 1.2 }}>{title}</h1>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.6 }}>{sub}</p>
      </div>
      <div style={{ flex: 1, padding: '1.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>{inner}</div>
    </div>
  )

  if (step === 'type') {
    return shell(
      <>
        <button onClick={() => onSelect({ type: 'new_construction', hasPermit: true })}
          style={{ width: '100%', padding: '1.6rem 1.5rem', background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 14, textAlign: 'left', cursor: 'pointer', boxShadow: '0 2px 8px rgba(44,74,110,0.07)' }}>
          <div style={{ marginBottom: '0.85rem' }}>
            <svg width="34" height="34" viewBox="0 0 36 36" fill="none"><rect x="1" y="1" width="34" height="34" rx="8" fill="rgba(65,124,164,0.08)" stroke="rgba(65,124,164,0.25)" strokeWidth="1"/><line x1="8" y1="28" x2="8" y2="14" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round"/><line x1="28" y1="28" x2="28" y2="14" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round"/><line x1="6" y1="28" x2="30" y2="28" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round"/><path d="M5 15L18 7L31 15" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="18" y1="28" x2="18" y2="15" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2,2"/></svg>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0D1E2E', marginBottom: '0.35rem' }}>New Construction</div>
          <div style={{ fontSize: '0.82rem', color: '#5E7D9B', lineHeight: 1.65 }}>Follows code hold points — excavation, foundation, framing, insulation, and occupancy. Includes permit and drawings review.</div>
        </button>

        <button onClick={() => setStep('permit')}
          style={{ width: '100%', padding: '1.6rem 1.5rem', background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 14, textAlign: 'left', cursor: 'pointer', boxShadow: '0 2px 8px rgba(44,74,110,0.07)' }}>
          <div style={{ marginBottom: '0.85rem' }}>
            <svg width="34" height="34" viewBox="0 0 36 36" fill="none"><rect x="1" y="1" width="34" height="34" rx="8" fill="rgba(242,147,55,0.08)" stroke="rgba(242,147,55,0.25)" strokeWidth="1"/><rect x="7" y="15" width="22" height="14" rx="1" stroke={ORANGE} strokeWidth="1.5"/><path d="M5 16L18 8L31 16" stroke={ORANGE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="12" y="19" width="5" height="5" rx="0.5" stroke={ORANGE} strokeWidth="1.2"/><rect x="19" y="19" width="5" height="5" rx="0.5" stroke={ORANGE} strokeWidth="1.2"/></svg>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0D1E2E', marginBottom: '0.35rem' }}>Renovation</div>
          <div style={{ fontSize: '0.82rem', color: '#5E7D9B', lineHeight: 1.65 }}>Assessment of an existing building. We&apos;ll ask a couple of quick questions so your project only includes the modules you actually need.</div>
        </button>
      </>,
      'What type of project is this?',
      'This determines which inspection phases apply and how the AI guides the assessment.',
      'Full Building Inspection',
      onBack,
    )
  }

  if (step === 'permit') {
    return shell(
      <>
        <button onClick={() => { setHasPermit(true); setStep('scope') }}
          style={{ width: '100%', padding: '1.4rem 1.5rem', background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 14, textAlign: 'left', cursor: 'pointer', boxShadow: '0 2px 8px rgba(44,74,110,0.07)' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0D1E2E', marginBottom: '0.3rem' }}>Yes — I have a permit or drawings</div>
          <div style={{ fontSize: '0.8rem', color: '#5E7D9B', lineHeight: 1.6 }}>Your project will include permit and construction-document review modules.</div>
        </button>

        <button onClick={() => { setHasPermit(false); setStep('scope') }}
          style={{ width: '100%', padding: '1.4rem 1.5rem', background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 14, textAlign: 'left', cursor: 'pointer', boxShadow: '0 2px 8px rgba(44,74,110,0.07)' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0D1E2E', marginBottom: '0.3rem' }}>No — this is a DIY renovation</div>
          <div style={{ fontSize: '0.8rem', color: '#5E7D9B', lineHeight: 1.6 }}>We&apos;ll skip the permit and drawings modules — you won&apos;t need them for a DIY project.</div>
        </button>

        <p style={{ fontSize: '0.68rem', color: '#9DB4C5', textAlign: 'center', margin: '0.25rem 0 0', lineHeight: 1.6 }}>You can always add permit modules later from the project menu.</p>
      </>,
      'Do you have a building permit or construction documents?',
      'DIY renovations usually don\'t have these — so we\'ll leave those modules out unless you need them.',
      'Renovation Setup',
      () => setStep('type'),
    )
  }

  const scopes: RenovationScope[] = ['interior_only', 'exterior_only', 'foundations', 'roof', 'exterior_deck', 'full_building']
  return shell(
    <>
      {scopes.map(s => {
        const meta = RENOVATION_SCOPE_META[s]
        const isFull = s === 'full_building'
        const accent = isFull ? BLUE : ORANGE
        return (
          <button key={s}
            onClick={() => onSelect({ type: 'renovation', renovationScope: s, hasPermit: hasPermit ?? false })}
            style={{ width: '100%', padding: '1.1rem 1.25rem', background: '#fff', border: `1.5px solid ${isFull ? 'rgba(65,124,164,0.3)' : BORDER}`, borderRadius: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.9rem', boxShadow: '0 2px 8px rgba(44,74,110,0.06)' }}>
            <div style={{ width: 46, height: 46, borderRadius: 11, background: `${accent}14`, border: `1px solid ${accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ScopeIcon kind={meta.icon} color={accent} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0D1E2E' }}>{meta.label}</div>
              <div style={{ fontSize: '0.72rem', color: '#5E7D9B', marginTop: '0.15rem', lineHeight: 1.5 }}>{meta.description}</div>
            </div>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M6 3l5 5-5 5" stroke="rgba(94,125,155,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )
      })}
      <p style={{ fontSize: '0.68rem', color: '#9DB4C5', textAlign: 'center', margin: '0.25rem 0 0', lineHeight: 1.6 }}>Your project will only show modules relevant to this scope. You can add others anytime from the project menu.</p>
    </>,
    'What\'s the scope of this renovation?',
    'We\'ll build your checklist around this — no scrolling past modules you don\'t need.',
    'Renovation Setup',
    () => setStep('permit'),
  )
}
