'use client'
/**
 * src/app/components/JurisdictionPicker.tsx
 *
 * Manual code-jurisdiction override. Detection sets the default; this lets the
 * user confirm or change it. Drop it at project start and/or in settings.
 *
 * Usage:
 *   <JurisdictionPicker
 *     state={job.jurisdiction}
 *     onChange={next => onUpdate({ ...job, jurisdiction: next })}
 *   />
 */
import { useState } from 'react'
import {
  JURISDICTIONS,
  JURISDICTION_PICKER_ORDER,
  getActiveJurisdiction,
  setJurisdictionOverride,
  shouldPromptOverride,
  type JurisdictionId,
  type JurisdictionState,
} from '@/lib/jurisdiction'

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const ORANGE = '#F29337'
const GREEN  = '#27A96B'
const BORDER = 'rgba(44,90,122,0.16)'

interface Props {
  state:    JurisdictionState | undefined
  onChange: (next: JurisdictionState) => void
  /** compact = single row for headers; full = labelled block for setup/settings */
  variant?: 'compact' | 'full'
}

export default function JurisdictionPicker({ state, onChange, variant = 'full' }: Props) {
  const [open, setOpen] = useState(false)
  const active   = getActiveJurisdiction(state)
  const prompt   = shouldPromptOverride(state)   // true when on a fallback, unconfirmed

  const select = (id: JurisdictionId) => { onChange(setJurisdictionOverride(state, id)); setOpen(false) }

  // Group the picker list by country for readability
  const groups: { title: string; ids: JurisdictionId[] }[] = [
    { title: 'Canada',        ids: JURISDICTION_PICKER_ORDER.filter(id => JURISDICTIONS[id].country === 'CA') },
    { title: 'United States', ids: JURISDICTION_PICKER_ORDER.filter(id => JURISDICTIONS[id].country === 'US') },
    { title: 'International',  ids: JURISDICTION_PICKER_ORDER.filter(id => ['GB', 'INTL'].includes(JURISDICTIONS[id].country)) },
  ]

  return (
    <div style={{ position: 'relative' }}>
      {variant === 'full' && (
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5E7D9B', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Building Code
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: variant === 'compact' ? '0.5rem 0.75rem' : '0.85rem 1rem',
          background: '#fff', border: `1.5px solid ${prompt ? 'rgba(242,147,55,0.5)' : BORDER}`,
          borderRadius: 11, cursor: 'pointer', textAlign: 'left',
        }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: prompt ? ORANGE : GREEN, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: variant === 'compact' ? '0.8rem' : '0.9rem', fontWeight: 700, color: NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {active.label}
          </div>
          {variant === 'full' && (
            <div style={{ fontSize: '0.68rem', color: '#5E7D9B', marginTop: '0.1rem' }}>
              {prompt ? 'Auto-detected — tap to confirm or change' : (state?.overrideId ? 'Set manually' : 'Auto-detected')}
            </div>
          )}
        </div>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M4 6l4 4 4-4" stroke="#5E7D9B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {prompt && variant === 'full' && !open && (
        <div style={{ fontSize: '0.68rem', color: '#C4721E', marginTop: '0.4rem', lineHeight: 1.5 }}>
          We defaulted to the International Building Code for your location. If a local code applies, choose it here.
        </div>
      )}

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.35rem',
          background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
          boxShadow: '0 10px 30px rgba(10,28,46,0.18)', zIndex: 30,
          maxHeight: 340, overflowY: 'auto',
        }}>
          {groups.map(g => (
            <div key={g.title}>
              <div style={{ padding: '0.5rem 0.9rem 0.3rem', fontSize: '0.62rem', fontWeight: 800, color: '#9DB4C5', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {g.title}
              </div>
              {g.ids.map(id => {
                const j = JURISDICTIONS[id]
                const isActive = j.id === active.id
                return (
                  <button key={id} onClick={() => select(id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
                      padding: '0.7rem 0.9rem', background: isActive ? 'rgba(65,124,164,0.08)' : 'none',
                      border: 'none', borderTop: `1px solid ${BORDER}`, cursor: 'pointer', textAlign: 'left',
                    }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: NAVY }}>{j.label}</div>
                      {j.region && <div style={{ fontSize: '0.68rem', color: '#5E7D9B' }}>{j.region}</div>}
                    </div>
                    {isActive && (
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13 4L6 12 3 9" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
