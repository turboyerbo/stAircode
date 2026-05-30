'use client'
/**
 * ProjectTypeScreen.tsx
 *
 * First screen shown when starting a new Full Building Inspection.
 * Inspector chooses: New Construction or Renovation.
 *
 * This choice affects:
 *   - Which phases are active (new construction follows OBC hold points;
 *     renovation focuses on final/occupancy inspection)
 *   - How the AI frames code compliance checks in each module
 *   - Report language and structure
 *
 * Design: clean, no emojis, two large distinct cards.
 */

import type { ProjectType } from '@/lib/inspection-types'
import { NavLogo }          from './Logo'

interface Props {
  onSelect: (type: ProjectType) => void
  onBack:   () => void
}

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const ORANGE = '#F29337'
const BORDER = 'rgba(44,90,122,0.14)'

export default function ProjectTypeScreen({ onSelect, onBack }: Props) {
  return (
    <div style={{
      minHeight:   '100dvh',
      background:  '#F4F7FB',
      fontFamily:  "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color:       '#0D1E2E',
      display:     'flex',
      flexDirection: 'column',
    }}>

      {/* Header */}
      <div style={{
        background:   NAVY,
        paddingTop:   'max(env(safe-area-inset-top, 0px), 1rem)',
        paddingBottom: '1.5rem',
        paddingLeft:  '1.25rem',
        paddingRight: '1.25rem',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.75rem' }}>
          <button
            onClick={onBack}
            style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:'0.85rem', cursor:'pointer', padding:0 }}>
            Back
          </button>
          <div style={{ flex:1, display:'flex', justifyContent:'center' }}>
            <NavLogo height={22} />
          </div>
          <div style={{ width:32 }} />
        </div>

        <div style={{ fontSize:'0.65rem', fontWeight:600, color:'rgba(255,255,255,0.4)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'0.5rem' }}>
          Full Building Inspection
        </div>
        <h1 style={{ fontSize:'1.4rem', fontWeight:700, color:'#fff', margin:'0 0 0.4rem', lineHeight:1.2 }}>
          What type of project is this?
        </h1>
        <p style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.5)', margin:0, lineHeight:1.6 }}>
          This determines which inspection phases apply and how the AI guides the assessment.
        </p>
      </div>

      {/* Cards */}
      <div style={{ flex:1, padding:'1.5rem 1.25rem', display:'flex', flexDirection:'column', gap:'0.85rem', justifyContent:'center' }}>

        {/* New Construction */}
        <button
          onClick={() => onSelect('new_construction')}
          style={{
            width:       '100%',
            padding:     '1.75rem 1.5rem',
            background:  '#fff',
            border:      `1.5px solid ${BORDER}`,
            borderRadius: 14,
            textAlign:   'left',
            cursor:      'pointer',
            transition:  'all 0.14s',
            boxShadow:   '0 2px 8px rgba(44,74,110,0.07)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = BLUE
            e.currentTarget.style.boxShadow   = '0 4px 18px rgba(65,124,164,0.18)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = BORDER
            e.currentTarget.style.boxShadow   = '0 2px 8px rgba(44,74,110,0.07)'
          }}>

          {/* Icon — construction frame */}
          <div style={{ marginBottom:'1rem' }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="34" height="34" rx="8" fill="rgba(65,124,164,0.08)" stroke="rgba(65,124,164,0.25)" strokeWidth="1"/>
              {/* House frame / studs */}
              <line x1="8"  y1="28" x2="8"  y2="14" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="28" y1="28" x2="28" y2="14" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="6"  y1="28" x2="30" y2="28" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round"/>
              {/* Roof */}
              <path d="M5 15L18 7L31 15" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              {/* Centre stud */}
              <line x1="18" y1="28" x2="18" y2="15" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2,2"/>
              {/* Cross brace */}
              <line x1="8" y1="21" x2="28" y2="21" stroke={BLUE} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.5"/>
            </svg>
          </div>

          <div style={{ fontSize:'1.1rem', fontWeight:700, color:'#0D1E2E', marginBottom:'0.35rem' }}>
            New Construction
          </div>
          <div style={{ fontSize:'0.82rem', color:'#5E7D9B', lineHeight:1.65 }}>
            Follows OBC mandatory hold points — excavation, foundation, framing, insulation, and occupancy. Includes permit and drawings review.
          </div>

          <div style={{ marginTop:'1rem', display:'flex', flexWrap:'wrap', gap:'0.35rem' }}>
            {['Drawings Review', 'Excavation Hold', 'Foundation Hold', 'Framing Inspection', 'Insulation', 'Occupancy'].map(tag => (
              <span key={tag} style={{ fontSize:'0.62rem', fontWeight:600, color:BLUE, background:'rgba(65,124,164,0.08)', padding:'0.18rem 0.55rem', borderRadius:4, border:'1px solid rgba(65,124,164,0.2)' }}>
                {tag}
              </span>
            ))}
          </div>
        </button>

        {/* Renovation */}
        <button
          onClick={() => onSelect('renovation')}
          style={{
            width:       '100%',
            padding:     '1.75rem 1.5rem',
            background:  '#fff',
            border:      `1.5px solid ${BORDER}`,
            borderRadius: 14,
            textAlign:   'left',
            cursor:      'pointer',
            transition:  'all 0.14s',
            boxShadow:   '0 2px 8px rgba(44,74,110,0.07)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = ORANGE
            e.currentTarget.style.boxShadow   = '0 4px 18px rgba(242,147,55,0.18)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = BORDER
            e.currentTarget.style.boxShadow   = '0 2px 8px rgba(44,74,110,0.07)'
          }}>

          {/* Icon — renovation/repair wrench */}
          <div style={{ marginBottom:'1rem' }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="34" height="34" rx="8" fill="rgba(242,147,55,0.08)" stroke="rgba(242,147,55,0.25)" strokeWidth="1"/>
              {/* Existing house */}
              <rect x="7" y="15" width="22" height="14" rx="1" stroke={ORANGE} strokeWidth="1.5"/>
              <path d="M5 16L18 8L31 16" stroke={ORANGE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              {/* Renovation indicator — window + repair mark */}
              <rect x="12" y="19" width="5" height="5" rx="0.5" stroke={ORANGE} strokeWidth="1.2"/>
              <rect x="19" y="19" width="5" height="5" rx="0.5" stroke={ORANGE} strokeWidth="1.2"/>
              {/* Door */}
              <rect x="14.5" y="23" width="7" height="6" rx="0.5" stroke={ORANGE} strokeWidth="1.2"/>
              {/* Repair/upgrade mark */}
              <circle cx="26" cy="11" r="4" fill="rgba(242,147,55,0.15)" stroke={ORANGE} strokeWidth="1.3"/>
              <line x1="26" y1="9" x2="26" y2="13" stroke={ORANGE} strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="24" y1="11" x2="28" y2="11" stroke={ORANGE} strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>

          <div style={{ fontSize:'1.1rem', fontWeight:700, color:'#0D1E2E', marginBottom:'0.35rem' }}>
            Renovation
          </div>
          <div style={{ fontSize:'0.82rem', color:'#5E7D9B', lineHeight:1.65 }}>
            Assessment of an existing building. Focuses on current conditions, deficiencies, code compliance of existing elements, and proposed works.
          </div>

          <div style={{ marginTop:'1rem', display:'flex', flexWrap:'wrap', gap:'0.35rem' }}>
            {['Existing Conditions', 'Deficiency Audit', 'Wet Areas', 'Structural', 'Services', 'Site'].map(tag => (
              <span key={tag} style={{ fontSize:'0.62rem', fontWeight:600, color:ORANGE, background:'rgba(242,147,55,0.08)', padding:'0.18rem 0.55rem', borderRadius:4, border:'1px solid rgba(242,147,55,0.25)' }}>
                {tag}
              </span>
            ))}
          </div>
        </button>

        <p style={{ fontSize:'0.68rem', color:'#9DB4C5', textAlign:'center', margin:'0.25rem 0 0', lineHeight:1.6 }}>
          You can add notes about the scope at any point during the inspection.
        </p>
      </div>
    </div>
  )
}
