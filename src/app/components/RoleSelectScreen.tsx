'use client'
/**
 * RoleSelectScreen.tsx — minimal 5-button role picker.
 * No preview cards — just a clean choice. The app adapts silently.
 */
import { useState } from 'react'
import type { UserRole } from './AuthScreen'

interface Props { onSelect: (role: UserRole) => void }

const ROLES: Array<{ id: UserRole; icon: string; label: string; sub: string; accent: string }> = [
  { id: 'architect',        icon: '📐', label: 'Architect',                  sub: 'Registered architect or designer',             accent: '#417CA4' },
  { id: 'building_manager', icon: '🏢', label: 'Building Manager',           sub: 'Facilities or property manager',               accent: '#A78BFA' },
  { id: 'contractor',       icon: '🔨', label: 'Contractor',                 sub: 'Builder or construction tradesperson',         accent: '#F29337' },
  { id: 'diy',              icon: '🏠', label: 'DIY Renovator',              sub: 'Homeowner — no construction background',       accent: '#3DB88A' },
  { id: 'realestate',       icon: '🔑', label: 'Real Estate Professional',   sub: 'Agent, broker, or property investor',         accent: '#F59E0B' },
]

export default function RoleSelectScreen({ onSelect }: Props) {
  const [active, setActive] = useState<UserRole | null>(null)

  function pick(id: UserRole) {
    setActive(id)
    setTimeout(() => onSelect(id), 180)
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#0A1C2E',backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px),repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem 1.25rem', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      <div style={{ fontSize:'0.52rem', fontFamily:'monospace', letterSpacing:'0.34em', color:'#F29337', marginBottom:'2rem', display:'flex', alignItems:'center', gap:'0.4rem' }}>▲ STAIRCODE <span style={{display:'inline-flex',alignItems:'center',background:'#F29337',color:'#fff',fontSize:'0.42rem',fontWeight:800,letterSpacing:'0.12em',padding:'0.15rem 0.5rem',borderRadius:20,marginLeft:'0.45rem',verticalAlign:'middle',fontFamily:'monospace',boxShadow:'0 1px 6px rgba(242,147,55,0.45)'}}>BETA</span></div>

      {/* Safety stripe */}
      <div style={{ width:'100%', maxWidth:420, height:5, borderRadius:3, background:'repeating-linear-gradient(-45deg,#F29337 0px,#F29337 5px,#0A1C2E 5px,#0A1C2E 12px)', backgroundSize:'20px 20px', marginBottom:'1.5rem' }} />

      <div style={{ textAlign:'center', marginBottom:'2rem', maxWidth:340 }}>
        <h1 style={{ fontSize:'1.5rem', fontWeight:900, color:'#E8F4FF', margin:0, letterSpacing:'-0.02em', lineHeight:1.2 }}>What best describes you?</h1>
        <p style={{ fontSize:'0.78rem', color:'#4E7A9B', margin:'0.5rem 0 0', lineHeight:1.55 }}>Staircode adjusts its language to match your background.</p>
      </div>

      <div style={{ width:'100%', maxWidth:400, display:'flex', flexDirection:'column', gap:'0.55rem' }}>
        {ROLES.map(r => {
          const isActive = active === r.id
          return (
            <button key={r.id} onClick={() => pick(r.id)}
              style={{
                width:'100%', textAlign:'left', cursor:'pointer', display:'flex', alignItems:'center', gap:'1rem',
                background: isActive ? `${r.accent}18` : 'rgba(147,186,212,0.05)',
                border: `1.5px solid ${isActive ? r.accent + '88' : 'rgba(147,186,212,0.12)'}`,
                borderRadius:16, padding:'0.95rem 1.1rem', transition:'all 0.15s',
              }}>
              <div style={{ width:40, height:40, borderRadius:12, background:`${r.accent}15`, border:`1px solid ${r.accent}33`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.15rem', flexShrink:0 }}>
                {r.icon}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'0.92rem', fontWeight:700, color:'#E8F4FF', lineHeight:1.2 }}>{r.label}</div>
                <div style={{ fontSize:'0.68rem', color:'#4E7A9B', marginTop:'0.15rem', lineHeight:1.3 }}>{r.sub}</div>
              </div>
              <div style={{ color: isActive ? r.accent : '#2A4060', fontSize:'1.1rem', flexShrink:0, transition:'color 0.15s' }}>
                {isActive ? '✓' : '›'}
              </div>
            </button>
          )
        })}
      </div>

      <p style={{ fontSize:'0.62rem', color:'#4E7A9B', textAlign:'center', marginTop:'1.5rem', lineHeight:1.6, maxWidth:280 }}>
        Not sure? Choose DIY Renovator.<br/>You can change this anytime in Settings.
      </p>
    </div>
  )
}
