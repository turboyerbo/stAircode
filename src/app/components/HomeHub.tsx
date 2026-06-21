'use client'
/**
 * HomeHub.tsx
 *
 * The app's home screen — a clear hub with three primary actions:
 *   1. Start New Inspection  → full multi-phase building inspection
 *   2. Quick Scan            → scan anything, get instant AI code-compliance feedback
 *   3. My Projects           → the saved projects list
 *
 * Replaces the old stair-demo-centric home. Works for trial and paid users alike.
 */
import { AppUser } from './AuthScreen'
import Logo from './Logo'

const NAVY  = '#0A1C2E'
const BLUE  = '#417CA4'
const GREEN = '#27A96B'
const ORANGE = '#F29337'

interface Props {
  user:               AppUser
  loc:                { city?: string; province?: string } | null
  locLoading:         boolean
  code:               { label?: string; links?: { label: string; url: string }[]; reason?: string; ref?: string } | null
  trialDaysLeft:      number | null
  onStartInspection:  () => void
  onQuickScan:        () => void
  onMyProjects:       () => void
}

export default function HomeHub({
  user, loc, locLoading, code, trialDaysLeft,
  onStartInspection, onQuickScan, onMyProjects,
}: Props) {
  const locStr = loc ? `${loc.city ?? ''}${loc.province ? ', ' + loc.province : ''}` : locLoading ? 'Detecting location…' : 'Location unavailable'
  const paid   = user.membership === 'subscription' || user.membership === 'pro'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#EBF3FA' }}>

      {/* ── Hero ── */}
      <div style={{ background: 'linear-gradient(160deg,#0D2B45 0%,#0A1F33 55%,#0D2B45 100%)', padding: 'max(env(safe-area-inset-top,0px),1.8rem) 1.4rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
        <Logo size="md" onDark />
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, lineHeight: 1.2, textAlign: 'center', margin: '0.25rem 0 0', color: '#fff' }}>What would you like to do?</h1>
        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', textAlign: 'center', margin: 0 }}>Welcome back, {user.name.split(' ')[0]}</p>
        {!paid && trialDaysLeft != null && trialDaysLeft > 0 && (() => {
          const urgent = trialDaysLeft <= 2
          return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: urgent ? 'rgba(242,147,55,0.15)' : 'rgba(39,169,107,0.15)', border: `1px solid ${urgent ? 'rgba(242,147,55,0.35)' : 'rgba(39,169,107,0.3)'}`, borderRadius: 20, padding: '0.2rem 0.75rem', marginTop: '0.25rem' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: urgent ? ORANGE : GREEN }} />
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: urgent ? ORANGE : GREEN, letterSpacing: '0.04em' }}>
                {trialDaysLeft === 1 ? 'TRIAL ENDS TODAY' : `${trialDaysLeft} DAYS LEFT IN FREE TRIAL`}
              </span>
            </div>
          )
        })()}
      </div>

      <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

        {/* ── Location card ── */}
        {!locLoading && code && (
          <div style={{ background: '#fff', border: '1px solid rgba(147,186,212,0.3)', borderRadius: 14, padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN }} />
              <span style={{ fontSize: '0.8rem', color: NAVY, fontWeight: 600 }}>{locStr}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {code.links?.length ? (
                <span style={{ fontSize: '0.68rem', color: '#2C4A6E', fontWeight: 500 }}>
                  Building Codes:{' '}
                  {code.links.map((l, i) => (
                    <span key={l.label}>{i > 0 && ' · '}<a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: BLUE, fontWeight: 600 }}>{l.label}</a></span>
                  ))}
                </span>
              ) : (
                <span style={{ fontSize: '0.68rem', color: '#2C4A6E', fontWeight: 500 }}>{code.reason} · {code.ref}</span>
              )}
              {code.label && <span style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', color: '#0D7A5F', background: '#E6F5F1', padding: '0.22rem 0.65rem', borderRadius: 8, border: '1px solid rgba(13,122,95,0.3)' }}>{code.label}</span>}
            </div>
          </div>
        )}

        {/* ── 1. Start New Inspection ── */}
        <button onClick={onStartInspection}
          style={{ width: '100%', padding: '1.15rem 1.25rem', background: 'linear-gradient(135deg,#0A1C2E,#1A3A58)', border: 'none', borderRadius: 14, display: 'flex', alignItems: 'center', gap: '0.9rem', cursor: 'pointer', textAlign: 'left', boxShadow: '0 4px 18px rgba(10,28,46,0.25)' }}>
          <div style={{ width: 46, height: 46, borderRadius: 11, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="16" height="16" rx="2" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" />
              <line x1="2" y1="7" x2="18" y2="7" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
              <line x1="6" y1="11" x2="14" y2="11" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
              <line x1="6" y1="14" x2="10" y2="14" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>Start New Inspection</div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', marginTop: '0.2rem', lineHeight: 1.5 }}>Full multi-phase building inspection — AI-guided, with a professional report.</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M6 3l5 5-5 5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        {/* ── 2. Quick Scan ── */}
        <button onClick={onQuickScan}
          style={{ width: '100%', padding: '1.15rem 1.25rem', background: '#fff', border: `1.5px solid ${GREEN}44`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: '0.9rem', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 12px rgba(39,169,107,0.1)' }}>
          <div style={{ width: 46, height: 46, borderRadius: 11, background: 'rgba(39,169,107,0.1)', border: '1px solid rgba(39,169,107,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" stroke={GREEN} strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="12" cy="12" r="3.5" stroke={GREEN} strokeWidth="1.6" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: NAVY, lineHeight: 1.2 }}>Quick Scan</div>
            <div style={{ fontSize: '0.72rem', color: '#5E7D9B', marginTop: '0.2rem', lineHeight: 1.5 }}>Scan anything — get instant AI feedback on code compliance. No project setup needed.</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M6 3l5 5-5 5" stroke="rgba(94,125,155,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        {/* ── 3. My Projects ── */}
        <button onClick={onMyProjects}
          style={{ width: '100%', padding: '1.15rem 1.25rem', background: '#fff', border: `1.5px solid ${BLUE}33`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: '0.9rem', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 12px rgba(65,124,164,0.08)' }}>
          <div style={{ width: 46, height: 46, borderRadius: 11, background: 'rgba(65,124,164,0.1)', border: '1px solid rgba(65,124,164,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke={BLUE} strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: NAVY, lineHeight: 1.2 }}>My Projects</div>
            <div style={{ fontSize: '0.72rem', color: '#5E7D9B', marginTop: '0.2rem', lineHeight: 1.5 }}>View, resume, and manage your saved inspection projects.</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M6 3l5 5-5 5" stroke="rgba(94,125,155,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        <p style={{ textAlign: 'center', fontSize: '0.58rem', color: '#9DB4C5', lineHeight: 1.5, margin: '0.5rem 0 0' }}>Compliance aid only · Not a substitute for professional inspection</p>
      </div>
    </div>
  )
}
