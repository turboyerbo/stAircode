'use client'
/**
 * /try — Public, no-signin demo.
 *
 * The marketing page's "Try it now" entry. Lets a first-time visitor run a real
 * Stair Scan or Quick Scan with NO account, geolocated to their city, with the
 * AI code assistant available. After they complete a scan, they're funnelled to
 * sign-up to start their free trial.
 *
 * This page deliberately does NOT go through the auth/trial gate in page.tsx.
 */
import { useState, useEffect } from 'react'
import ScanReadyScreen from '@/app/components/ScanReadyScreen'
import QuickScanScreen from '@/app/components/QuickScanScreen'
import GlobalCodeAssistant from '@/app/components/GlobalCodeAssistant'
import { NavLogo } from '@/app/components/Logo'
import { Analytics, initAnalytics } from '@/lib/analytics'
import { resolveJurisdiction, getActiveJurisdiction, codeKeyToJurisdictionId, JURISDICTIONS, JURISDICTION_PICKER_ORDER, type JurisdictionId } from '@/lib/jurisdiction'
import type { AppUser } from '@/app/components/AuthScreen'

const NAVY = '#0A1C2E', BLUE = '#417CA4', GREEN = '#27A96B', ORANGE = '#F29337'

interface Loc { city: string; province: string; country: string; countryCode: string }

type Mode = 'choose' | 'stair' | 'quick'

// Minimal synthetic user so QuickScanScreen (which needs a user) works in the demo
const DEMO_USER: AppUser = {
  email: 'demo@staircode.app', name: 'Guest', provider: 'otp',
  membership: 'free', units: 'mm', role: 'diy',
}

export default function TryPage() {
  const [mode, setMode]       = useState<Mode>('choose')
  const [loc, setLoc]         = useState<Loc | null>(null)
  const [locLoading, setLoad] = useState(true)
  const [manualOpen, setManualOpen] = useState(false)
  const [jurisdictionId, setJId] = useState<JurisdictionId>('INTL_IBC')

  // Top of funnel: record that someone reached the /try entry point.
  useEffect(() => {
    try { initAnalytics(); Analytics.landingViewed('try') } catch {}
  }, [])

  // Geolocate (IP first, GPS refines). Falls back gracefully.
  useEffect(() => {
    let done = false
    async function ipGeo() {
      try {
        const r = await fetch('/api/geo')
        if (!r.ok) return null
        const d = await r.json()
        if (!d.city || d.city === 'Unknown') return null
        return { city: d.city, province: d.province, country: d.country, countryCode: d.countryCode } as Loc
      } catch { return null }
    }
    ipGeo().then(l => {
      if (l && !done) { setLoc(l); setJId(resolveJurisdiction({ countryCode: l.countryCode, region: l.province }).id) }
      setLoad(false)
    })
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        try {
          const r = await fetch(`/api/geo?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`)
          if (r.ok) {
            const d = await r.json()
            if (d.city && d.city !== 'Unknown') {
              done = true
              const l: Loc = { city: d.city, province: d.province, country: d.country, countryCode: d.countryCode }
              setLoc(l); setJId(resolveJurisdiction({ countryCode: l.countryCode, region: l.province }).id)
            }
          }
        } catch {}
      }, () => {}, { timeout: 6000 })
    }
  }, [])

  const jx = getActiveJurisdiction({ overrideId: jurisdictionId })
  const cityLabel = loc ? `${loc.city}${loc.province ? ', ' + loc.province : ''}` : (locLoading ? 'Detecting your location…' : 'Location not detected')

  // Funnel to sign-up after a completed scan
  function toSignup() { window.location.href = '/?signin=1' }

  // ── STAIR SCAN ──
  if (mode === 'stair') {
    return (
      <>
        <ScanReadyScreen userRole="diy" onSuccess={toSignup} onBack={() => setMode('choose')} />
        <GlobalCodeAssistant codeLabel={jx.label} jurisdictionId={jurisdictionId} location={loc ? cityLabel : undefined} />
      </>
    )
  }

  // ── QUICK SCAN ──
  if (mode === 'quick') {
    return (
      <>
        <QuickScanScreen
          user={DEMO_USER}
          codeLabel={jx.label}
          location={loc ? cityLabel : undefined}
          onSaveAsProject={toSignup}
          onBack={() => setMode('choose')}
        />
        <GlobalCodeAssistant codeLabel={jx.label} jurisdictionId={jurisdictionId} location={loc ? cityLabel : undefined} />
      </>
    )
  }

  // ── CHOOSE SCREEN ──
  return (
    <div style={{ minHeight: '100dvh', background: '#EBF3FA', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg,#0D2B45,#0A1F33)', padding: 'max(env(safe-area-inset-top,0px),1.5rem) 1.4rem 1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <a href="/marketing" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', textDecoration: 'none' }}>← Home</a>
          <NavLogo height={22} />
          <a onClick={() => { window.location.href = '/?member=1' }} style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', textDecoration: 'none', cursor: 'pointer' }}>Sign In</a>
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: '0 0 0.4rem', lineHeight: 1.2, letterSpacing: '-0.02em' }}>Try it now — no account needed</h1>
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.55 }}>
          Run a real AI scan and see what an inspection could catch. We&apos;ll check against the building code for your city.
        </p>
      </div>

      <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {/* Location chip with manual override */}
        <div style={{ background: '#fff', border: '1px solid rgba(147,186,212,0.3)', borderRadius: 12, padding: '0.8rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: loc ? GREEN : ORANGE, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY }}>{cityLabel}</div>
              <div style={{ fontSize: '0.68rem', color: '#5E7D9B' }}>Checking against: {jx.label}</div>
            </div>
            <button onClick={() => setManualOpen(o => !o)} style={{ background: 'none', border: `1px solid ${BLUE}`, color: BLUE, borderRadius: 8, padding: '0.35rem 0.7rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              Change
            </button>
          </div>
          {manualOpen && (
            <div style={{ marginTop: '0.7rem', display: 'grid', gap: '0.35rem', maxHeight: 220, overflowY: 'auto' }}>
              {JURISDICTION_PICKER_ORDER.map(id => (
                <button key={id} onClick={() => { setJId(id); setManualOpen(false) }}
                  style={{ textAlign: 'left', padding: '0.55rem 0.7rem', background: id === jurisdictionId ? 'rgba(65,124,164,0.1)' : '#F7FAFC', border: '1px solid rgba(44,90,122,0.12)', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', color: NAVY, fontWeight: 600 }}>
                  {JURISDICTIONS[id].label}{JURISDICTIONS[id].region ? ` — ${JURISDICTIONS[id].region}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Value prop — the standout feature */}
        <div style={{ background: 'rgba(242,147,55,0.08)', border: '1px solid rgba(242,147,55,0.25)', borderRadius: 12, padding: '0.9rem 1rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#0A1C2E', lineHeight: 1.6, fontWeight: 600 }}>
            Catch what a walkthrough misses. stAIrcode&apos;s AI flags code issues and construction problems an inspection could overlook — then explains how to fix them.
          </div>
        </div>

        {/* Stair Scan */}
        <button onClick={() => { try { Analytics.demoStarted('stair') } catch {}; setMode('stair') }}
          style={{ width: '100%', padding: '1.15rem 1.25rem', background: `linear-gradient(135deg,${NAVY},#1A3A58)`, border: 'none', borderRadius: 14, display: 'flex', alignItems: 'center', gap: '0.9rem', cursor: 'pointer', textAlign: 'left', boxShadow: '0 4px 18px rgba(10,28,46,0.22)' }}>
          <div style={{ width: 46, height: 46, borderRadius: 11, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M3 20h4v-4h4v-4h4v-4h4V4" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>Try a Stair Scan</div>
            <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.2rem', lineHeight: 1.5 }}>AI-measure a staircase and check it against your local code — riser, run, headroom, guards.</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        {/* Quick Scan */}
        <button onClick={() => { try { Analytics.demoStarted('quick') } catch {}; setMode('quick') }}
          style={{ width: '100%', padding: '1.15rem 1.25rem', background: '#fff', border: `1.5px solid ${GREEN}44`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: '0.9rem', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 12px rgba(39,169,107,0.1)' }}>
          <div style={{ width: 46, height: 46, borderRadius: 11, background: 'rgba(39,169,107,0.1)', border: '1px solid rgba(39,169,107,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" stroke={GREEN} strokeWidth="1.7" strokeLinecap="round"/><circle cx="12" cy="12" r="3.5" stroke={GREEN} strokeWidth="1.7"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: NAVY }}>Try a Quick Scan</div>
            <div style={{ fontSize: '0.73rem', color: '#5E7D9B', marginTop: '0.2rem', lineHeight: 1.5 }}>Photograph any building component and get instant AI feedback on condition and code compliance.</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="rgba(94,125,155,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <div style={{ textAlign: 'center', marginTop: '0.4rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#5E7D9B', lineHeight: 1.5 }}>
            Tap the AI helper (bottom-right) any time to ask a building-code or construction question.
          </div>
        </div>
      </div>

      {/* AI assistant available right on the choose screen too */}
      <GlobalCodeAssistant codeLabel={jx.label} jurisdictionId={jurisdictionId} location={loc ? cityLabel : undefined} />
    </div>
  )
}
