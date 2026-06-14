'use client'
/**
 * page.tsx — StairCode authenticated app shell
 */
import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Logo, { BetaLogo } from './components/Logo'
import MemberLoginScreen from './components/MemberLoginScreen'
import AuthScreen,      { AppUser, UserRole } from './components/AuthScreen'
import { initAnalytics, identifyUser, resetUser, Analytics } from '@/lib/analytics'
import { getSupabase } from '@/lib/supabase-client'
import HelpScreen                            from './components/HelpScreen'
import SettingsScreen                        from './components/SettingsScreen'
import ScanReadyScreen                       from './components/ScanReadyScreen'
import ReportScreen                          from './components/ReportScreen'
import PaymentSuccessScreen                  from './components/PaymentSuccessScreen'
import FoundationScanScreen                  from './components/FoundationScanScreen'
import FoundationReportScreen                from './components/FoundationReportScreen'
import type { FoundationMeasurements }       from './components/FoundationScanScreen'
import type { FoundationField }              from './components/FoundationReportScreen'
import AccessibilityScanScreen              from './components/AccessibilityScanScreen'
import AccessibilityReportScreen            from './components/AccessibilityReportScreen'
import type { AccessibilityMeasurements }   from './components/AccessibilityScanScreen'
import type { AccessibilityField }          from './components/AccessibilityReportScreen'
import InspectionSetupScreen                from './components/InspectionSetupScreen'
import InspectionDashboard                  from './components/InspectionDashboard'
import InspectionProjectList                from './components/InspectionProjectList'
import ProjectTypeScreen                    from './components/ProjectTypeScreen'
import InspectionPaywall                    from './components/InspectionPaywall'
import TrialExpiredScreen                   from './components/TrialExpiredScreen'
import type { ProjectType }                 from '@/lib/inspection-types'
import type { InspectionJob }               from '@/lib/inspection-types'
import CodeHelper                           from './components/CodeHelper'

const C = {
  dark:'#EEF3F9', card:'#FFFFFF', blue:'#007FFF', orange:'#FF7F00',
  pass:'#4A90E2', border:'rgba(44,90,122,0.16)', muted:'rgba(255,255,255,0.38)',
}

type Tab    = 'home'|'help'|'settings'
type Screen = 'home'|'scan_ready'|'scan_review'|'detect'|'capture'|'report'|'inspection_paywall'|'inspection_type'|'inspection_setup'|'inspection_dashboard'|'inspection_projects'
interface StairMeasurements {
  rise: number|null; run: number|null; width: number|null
  nosing: number|null; headroom: number|null|'clear'; guard: number|null
  confidence?: number; calibrated?: boolean
  riserCount?: number; handrailOneSide?: boolean; handrailBothSides?: boolean
  riserInconsistent?: number   // 1=inconsistent, 0=consistent, -1=could not assess
  riserVariationMm?: number    // max variation detected between risers
  tiltCorrected?: number       // 1 = perspective correction applied
  tiltAngleDeg?: number        // estimated camera tilt
  tapeMeasureRead?: number     // 1 = AI read from tape measure directly
  rawEstimateMm?: number       // uncorrected estimate before tilt correction
  guardrailAbsent?: number     // 1=explicitly absent from image
  guardrailLikelyRequired?: number  // 1=required by code for this stair, 0=not required
  occupancyType?: string       // "residential_single"|"residential_multi"|"commercial"|"industrial"|"mixed_use"|"unknown"
  occupancyConfidence?: number
  applicableCodePart?: string  // "Part 9" | "Part 3"
}

type CodeKey= 'NBC'|'OBC'|'QBC'|'NEN'|'IRC'|'IBC'|'BCBC'

interface Loc  { city:string; province:string; country:string; countryCode:string }
interface Code {
  code:CodeKey; label:string; ref:string; reason:string
  links?: {label:string; url:string}[]
  limits:{ riserMin:number; riserMax:number; runMin:number; nosingMin?:number; nosingMax?:number; widthMin:number; headMin:number; guardMin:number }
}

const IBC:Code={ code:'IBC',label:'IBC 2021',ref:'§1011',reason:'International Building Code',
  limits:{riserMin:102,riserMax:178,runMin:279,widthMin:1118,headMin:2032,guardMin:1067}}

function isOntario(l:Loc){
  const p=l.province.toLowerCase(),c=l.city.toLowerCase()
  return p.includes('ontario')||['toronto','ottawa','hamilton','london','brampton','mississauga','markham','vaughan','kitchener','windsor','kingston'].some(x=>c.includes(x))
}

function detectCode(l:Loc):Code{
  const cc  = l.countryCode.toUpperCase()
  const prov = l.province.toLowerCase()
  const city = l.city.toLowerCase()

  // ── Canada ────────────────────────────────────────────────────────────────
  if(isOntario(l))
    return{code:'OBC',label:'OBC 2024',ref:'s.9.8.4',reason:'Ontario Building Code',
      links:[{label:'OBC',url:'https://www.ontario.ca/laws/statute/92b23'},{label:'Toronto Bylaw',url:'https://www.toronto.ca/city-government/planning-development/official-plan-guidelines/zoning-by-law/'},{label:'AODA',url:'https://www.ontario.ca/laws/statute/05a11'}],
      limits:{riserMin:125,riserMax:200,runMin:235,nosingMin:15,nosingMax:25,widthMin:860,headMin:1950,guardMin:900}}

  if(cc==='CA'){
    if(prov.includes('quebec')||city.includes('montreal')||city.includes('québec'))
      return{code:'QBC',label:'QBC 2020',ref:'Art.3.4.6',reason:'Quebec Building Code',
        limits:{riserMin:125,riserMax:200,runMin:230,widthMin:900,headMin:1950,guardMin:900}}
    if(prov.includes('british columbia')||prov.includes('b.c.')||city.includes('vancouver'))
      return{code:'BCBC',label:'BCBC 2024',ref:'9.8.4',reason:'BC Building Code',
        limits:{riserMin:125,riserMax:200,runMin:235,widthMin:860,headMin:1950,guardMin:900}}
    // All other Canadian provinces — NBC
    return{code:'NBC',label:'NBC 2020',ref:'9.8.4',reason:'National Building Code of Canada',
      links:[{label:'NBC 2020',url:'https://www.nrc-cnrc.gc.ca/eng/publications/codes_centre/2020_national_building_code.html'}],
      limits:{riserMin:125,riserMax:200,runMin:235,widthMin:860,headMin:1950,guardMin:900}}
  }

  // ── United States ────────────────────────────────────────────────────────
  if(cc==='US'){
    // NY, CA, TX, FL + most states use IBC for commercial, IRC for residential
    return{code:'IBC',label:'IBC 2021',ref:'§1011',reason:'International Building Code',
      links:[{label:'IBC 2021',url:'https://codes.iccsafe.org/content/IBC2021'}],
      limits:{riserMin:100,riserMax:178,runMin:279,widthMin:914,headMin:2032,guardMin:914}}
  }

  // ── UK ────────────────────────────────────────────────────────────────────
  if(cc==='GB')
    return{code:'IBC',label:'UK Building Regs Part K',ref:'K1',reason:'UK Building Regulations',
      limits:{riserMin:150,riserMax:220,runMin:220,widthMin:800,headMin:2000,guardMin:900}}

  // ── Europe (EU) ───────────────────────────────────────────────────────────
  if(['DE','FR','IT','ES','NL','BE','AT','CH','SE','NO','DK','FI','PT','PL','IE'].includes(cc))
    return{code:'IBC',label:'IBC / Eurocode',ref:'EN 1991',reason:'European Standards',
      limits:{riserMin:140,riserMax:220,runMin:220,widthMin:800,headMin:2000,guardMin:900}}

  // ── Australia / NZ ────────────────────────────────────────────────────────
  if(cc==='AU'||cc==='NZ')
    return{code:'IBC',label:'NCC 2022',ref:'D2D3',reason:'National Construction Code',
      limits:{riserMin:115,riserMax:190,runMin:240,widthMin:1000,headMin:2000,guardMin:865}}

  // Default — IBC as global standard
  return IBC
}

function check(m:StairMeasurements,code:Code){
  const L=code.limits
  // Riser consistency: pass=variation ≤9.5mm, fail=>9.5mm, null=not assessed
  const riserConsistencyPass =
    m.riserInconsistent === 0 ? true
    : m.riserInconsistent === 1 ? false
    : null  // -1 or undefined = not assessed
  const riserVariationDisplay = m.riserVariationMm != null ? m.riserVariationMm : null

  return[
    {label:'Riser Height',    icon:'',value:m.rise,   min:L.riserMin,max:L.riserMax,
     pass:m.rise?m.rise>=L.riserMin&&m.rise<=L.riserMax:null},
    {label:'Rise Consistency', icon:'', value: riserVariationDisplay, max: 9.5,
     pass: riserConsistencyPass,
     note: m.riserInconsistent === -1 ? 'Could not assess — professional inspection required' : undefined,
    } as any,
    {label:'Tread Depth',     icon:'',value:m.run,    min:L.runMin,
     pass:m.run?m.run>=L.runMin:null},
    {label:'Nosing',          icon:'',value:m.nosing, min:L.nosingMin,max:L.nosingMax,
     pass:m.nosing&&L.nosingMin?(+m.nosing)>=(L.nosingMin||0)&&(+m.nosing)<=(L.nosingMax||99):null},
    {label:'Stair Width',     icon:'',value:m.width,  min:L.widthMin,
     pass:m.width?m.width>=L.widthMin:null},
    {label:'Headroom',        icon:'',value:m.headroom==='clear'?null:m.headroom,min:L.headMin,clearAbove:m.headroom==='clear',
     pass:m.headroom==='clear'?true:m.headroom?(+m.headroom)>=L.headMin:null} as any,
    {label:'Guardrail Height',icon:'',value:m.guard,  min:L.guardMin,
     // Absent guardrail: fail only if it's likely required; N/A if not required
     pass: m.guardrailAbsent === 1
       ? (m.guardrailLikelyRequired === 0 ? null : false)  // null=N/A, false=FAIL
       : m.guard ? m.guard >= L.guardMin : null,
     note: m.guardrailAbsent === 1
       ? (m.guardrailLikelyRequired === 0
           ? 'No guardrail — not required for this stair height'
           : 'No guardrail detected — required where total rise > 600mm')
       : undefined,
    } as any,
  ]
}

// ── Foundation compliance check ──────────────────────────────────────────────
function checkFoundation(m: FoundationMeasurements, codeLabel: string): FoundationField[] {
  const fields: FoundationField[] = []

  // 1. Wall type — informational
  fields.push({
    label: 'Wall Type Identified',
    value: m.wallTypeLabel ?? m.wallType,
    pass: m.wallType !== 'unknown' ? null : null,
    note: m.wallType === 'unknown' ? 'Wall type could not be determined from images — physical inspection required.' : undefined,
    severity: 'info',
  })

  // 2. Wall thickness vs code minimums
  const thicknessMin: Record<string, number> = {
    poured_concrete: 150,
    concrete_block: 190,
    stone: 300,
    brick: 190,
    icf: 250,
  }
  const minThick = thicknessMin[m.wallType]
  if (m.wallThickness != null && minThick != null) {
    fields.push({
      label: 'Wall Thickness',
      value: m.wallThickness,
      unit: 'mm',
      pass: m.wallThickness >= minThick,
      note: m.wallThickness < minThick
        ? `Measured ${m.wallThickness}mm is below the typical ${minThick}mm minimum for ${m.wallTypeLabel ?? m.wallType} under ${codeLabel}.`
        : `${m.wallThickness}mm meets the typical ${minThick}mm minimum for ${m.wallTypeLabel ?? m.wallType}.`,
      severity: m.wallThickness < minThick ? 'warning' : 'info',
    })
  } else if (m.wallThickness != null) {
    fields.push({ label: 'Wall Thickness', value: m.wallThickness, unit: 'mm', pass: null, note: 'Minimum not determined for this wall type.', severity: 'info' })
  }

  // 3. Wall height — check height/thickness ratio
  if (m.wallHeight != null && m.wallThickness != null && m.wallThickness > 0) {
    const ratio = m.wallHeight / m.wallThickness
    const maxRatio = m.wallType === 'concrete_block' ? 11 : m.wallType === 'poured_concrete' ? 20 : 10
    fields.push({
      label: 'Height / Thickness Ratio',
      value: ratio.toFixed(1),
      pass: ratio <= maxRatio,
      note: `${ratio.toFixed(1)}:1 — maximum is ${maxRatio}:1 for ${m.wallTypeLabel ?? m.wallType}. ${ratio > maxRatio ? 'Wall may require pilasters or additional lateral support.' : 'Within allowable limits.'}`,
      severity: ratio > maxRatio ? 'warning' : 'info',
    })
  } else if (m.wallHeight != null) {
    fields.push({ label: 'Exposed Wall Height', value: m.wallHeight, unit: 'mm', pass: null, note: 'Thickness not captured — height/ratio check not possible.', severity: 'info' })
  }

  // 4. Horizontal cracks — CRITICAL
  fields.push({
    label: 'Horizontal Cracks',
    value: m.horizontalCrack ? 'Detected' : 'None detected',
    pass: !m.horizontalCrack,
    note: m.horizontalCrack
      ? 'Horizontal cracks indicate lateral earth pressure potentially exceeding wall capacity. Immediate structural engineering assessment required.'
      : 'No horizontal cracks observed.',
    severity: m.horizontalCrack ? 'critical' : 'info',
  })

  // 5. Crack width classification
  if (m.crackPresent && m.crackWidthMm != null) {
    const crackPass =
      m.crackWidthMm < 0.1 ? true   // hairline — acceptable
      : m.crackWidthMm < 0.3 ? null  // fine — monitor (informational)
      : false                         // medium/wide — flag
    fields.push({
      label: 'Crack Width',
      value: m.crackWidthMm,
      unit: 'mm',
      pass: crackPass,
      note: m.crackWidthMm < 0.1 ? 'Hairline — normal surface shrinkage, monitor for progression.'
          : m.crackWidthMm < 0.3 ? 'Fine crack — monitor. Repair if progression observed.'
          : m.crackWidthMm < 1.0 ? 'Medium crack — professional assessment and repair recommended.'
          : 'Wide crack — structural assessment required before occupancy.',
      severity: m.crackWidthMm >= 1.0 ? 'critical' : m.crackWidthMm >= 0.3 ? 'warning' : 'info',
    })
  } else if (!m.crackPresent) {
    fields.push({ label: 'Crack Width', value: 'No cracks detected', pass: true, note: 'No cracks observed in the scanned area.', severity: 'info' })
  }

  // 6. Footing width
  if (m.footingWidth != null && m.wallThickness != null) {
    const footingMin = m.wallThickness * 2
    fields.push({
      label: 'Footing Width',
      value: m.footingWidth,
      unit: 'mm',
      pass: m.footingWidth >= footingMin,
      note: m.footingWidth >= footingMin
        ? `${m.footingWidth}mm meets minimum (2× wall thickness = ${footingMin}mm).`
        : `${m.footingWidth}mm is below typical minimum of ${footingMin}mm (2× wall thickness). Engineering review recommended.`,
      severity: m.footingWidth < footingMin ? 'warning' : 'info',
    })
  } else if (m.footingWidth != null) {
    fields.push({ label: 'Footing Width', value: m.footingWidth, unit: 'mm', pass: null, note: 'Wall thickness not captured — ratio check not possible.', severity: 'info' })
  }

  // 7. Dampproofing
  if (m.dampproofingVisible !== null) {
    fields.push({
      label: 'Dampproofing',
      value: m.dampproofingVisible ? 'Present' : 'Not detected',
      pass: m.dampproofingVisible === true ? true : m.dampproofingVisible === false ? false : null,
      note: m.dampproofingVisible
        ? 'Dampproofing coating visible on exterior surface.'
        : 'Dampproofing not detected. All below-grade walls require dampproofing under OBC s.9.13 / IBC §1805.',
      severity: m.dampproofingVisible === false ? 'warning' : 'info',
    })
  }

  // 8. Overall condition
  fields.push({
    label: 'Overall Condition',
    value: m.overallCondition ? m.overallCondition.charAt(0).toUpperCase() + m.overallCondition.slice(1) : 'Not assessed',
    pass: m.overallCondition === 'good' ? true : m.overallCondition === 'critical' ? false : null,
    note: m.overallCondition === 'critical' ? 'Critical condition — professional assessment required before occupancy.'
        : m.overallCondition === 'poor'     ? 'Poor condition — repairs required and professional review recommended.'
        : m.overallCondition === 'fair'     ? 'Fair condition — minor issues noted, monitor and repair as needed.'
        : 'Good overall condition — no significant issues observed.',
    severity: m.overallCondition === 'critical' ? 'critical' : m.overallCondition === 'poor' ? 'warning' : 'info',
  })

  return fields
}

// ── Splash Screen ─────────────────────────────────────────────────────────────
function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'image' | 'fading'>('image')

  useEffect(() => {
    // Hold image for 4.5s then fade over 1.2s into auth
    const hold = setTimeout(() => {
      setPhase('fading')
      const fade = setTimeout(() => onDone(), 1200)
      return () => clearTimeout(fade)
    }, 4500)
    return () => clearTimeout(hold)
  }, [onDone])

  return (
    <div
      onClick={() => { setPhase('fading'); setTimeout(onDone, 600) }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0A1C2E',
        cursor: 'pointer',
        opacity: phase === 'fading' ? 0 : 1,
        transition: phase === 'fading' ? 'opacity 1.2s ease' : 'none',
      }}
    >
      {/* AR hero image — fills full screen */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/AR_guided_inspection.jpg"
        alt="stAIrcode — AR-guided stair inspection"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center top',
          display: 'block',
        }}
      />
      {/* Bottom gradient + tap hint */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 'env(safe-area-inset-bottom, 0px)',
        background: 'linear-gradient(to top, rgba(10,28,46,0.95) 0%, rgba(10,28,46,0.4) 60%, transparent 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingBottom: 'max(env(safe-area-inset-bottom,0px), 2.5rem)',
        paddingTop: '3rem',
      }}><div style={{
          fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)',
          letterSpacing: '0.04em',
          animation: 'pulse 2s ease-in-out infinite',
        }}>TAP TO CONTINUE
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50%       { opacity: 0.9; }
          }
        `}</style>
      </div>
    </div>
  )
}


// ── Root ──────────────────────────────────────────────────────────────────────

// ── Trial access helper ────────────────────────────────────────────────────
// Returns true if the user has active trial OR paid subscription.
// A trial is active if sc_beta_access='1' AND sc_trial_end is in the future
// (or sc_trial_end was never set, for legacy users).
function checkTrialAccess(): boolean {
  try {
    const hasBeta = localStorage.getItem('sc_beta_access') === '1'
    if (!hasBeta) return false
    const trialEnd = localStorage.getItem('sc_trial_end')
    if (!trialEnd) return true  // Legacy users without expiry date — grant access
    return new Date() < new Date(trialEnd)
  } catch { return false }
}

function getTrialDaysLeft(): number {
  try {
    const trialEnd = localStorage.getItem('sc_trial_end')
    if (!trialEnd) return 7
    const ms = new Date(trialEnd).getTime() - Date.now()
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
  } catch { return 0 }
}
// ────────────────────────────────────────────────────────────────────────────

export default function Home(){
  const [user,setUser]=useState<AppUser|null>(null)
  // Splash screen — shows the AR image on first load, fades into auth
  const [splashDone, setSplashDone] = useState(false)
  // Legal disclaimer agreement — must be declared here (before any early returns)
  const [legalAgreed, setLegalAgreed] = useState<boolean>(()=>{
    try{ return typeof window !== 'undefined' && localStorage.getItem('sc_legal_agreed') === '1' }
    catch{ return false }
  })
  // Send welcome email once per new account (OTP + OAuth)
  const maybeSendWelcome = (emailAddr: string, userName: string) => {
    if (!emailAddr || !emailAddr.includes('@')) return
    try {
      if (localStorage.getItem('sc_welcomed')) return
      localStorage.setItem('sc_welcomed', '1')
    } catch { return }
    fetch('/api/welcome', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: emailAddr, name: userName }),
    }).catch(() => {})
  }
  useEffect(()=>{
    // Init PostHog analytics
    initAnalytics()

    // ── Session restoration ──────────────────────────────────────────────────
    // Rule: a live Supabase session is required to be authenticated.
    // localStorage caches profile data (name, membership tier) for instant restore.
    // Supabase handles token refresh automatically — we just trust its session validity.
    const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

    function isSessionExpired(): boolean {
      try {
        const stored = localStorage.getItem('sc_user')
        if (!stored) return true
        const u = JSON.parse(stored)
        if (!u?.signedInAt) return false // no timestamp = legacy user, don't expire them
        return Date.now() - u.signedInAt > SESSION_TTL_MS
      } catch { return true }
    }

    const sb = getSupabase()
    if (sb) {
      // Always check live session — localStorage only used for profile cache
      sb.auth.getSession().then(({ data }) => {
        if (data.session?.user && !isSessionExpired()) {
          const su = data.session.user
          const email = su.email ?? su.phone ?? ''
          let membership: AppUser['membership'] = 'free'
          try {
            const stored = localStorage.getItem('sc_user')
            if (stored) {
              const prev = JSON.parse(stored)
              if (prev?.email === email && prev?.membership && prev.membership !== 'free') {
                membership = prev.membership
              }
            }
          } catch {}
          const u: AppUser = {
            email,
            name:  su.user_metadata?.full_name ?? email.split('@')[0] ?? 'User',
            provider: (su.app_metadata?.provider ?? 'otp') as AppUser['provider'],
            membership,
            units: 'mm',
            signedInAt: (() => {
              try { return JSON.parse(localStorage.getItem('sc_user') ?? '{}')?.signedInAt ?? Date.now() } catch { return Date.now() }
            })(),
          }
          setUser(u)
          try { localStorage.setItem('sc_user', JSON.stringify(u)) } catch {}
          maybeSendWelcome(u.email, u.name)
        } else {
          // No valid session or session expired — clear any stale cache and require sign-in
          try { localStorage.removeItem('sc_user') } catch {}
          setUser(null)
        }
      }).catch(() => {
        // Network error checking session — allow cached session as fallback ONLY if fresh
        if (!isSessionExpired()) {
          try {
            const s = localStorage.getItem('sc_user')
            if (s) { const u = JSON.parse(s); if (u?.email) setUser(u) }
          } catch {}
        }
      })

      // Listen for auth state changes (OAuth callback, sign-out, token refresh)
      sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          try { localStorage.removeItem('sc_user') } catch {}
          try { localStorage.removeItem('sc_beta_access') } catch {}
        } else if (event === 'SIGNED_IN' && session?.user) {
          const su = session.user
          const email = su.email ?? su.phone ?? ''
          const name  = su.user_metadata?.full_name ?? email.split('@')[0] ?? 'User'
          let membership: AppUser['membership'] = 'free'
          try {
            const stored = localStorage.getItem('sc_user')
            if (stored) {
              const prev = JSON.parse(stored)
              if (prev?.membership && prev.membership !== 'free') membership = prev.membership
            }
          } catch {}
          const u: AppUser = {
            email, name,
            provider: (su.app_metadata?.provider ?? 'otp') as AppUser['provider'],
            membership, units: 'mm',
            signedInAt: Date.now(), // stamp the time of this sign-in
          }
          setUser(u)
          try { localStorage.setItem('sc_user', JSON.stringify(u)) } catch {}
          maybeSendWelcome(email, name)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Silent token refresh — update timestamp to extend session TTL
          try {
            const stored = localStorage.getItem('sc_user')
            if (stored) {
              const u = JSON.parse(stored)
              u.signedInAt = Date.now()
              localStorage.setItem('sc_user', JSON.stringify(u))
            }
          } catch {}
        }
      })
    } else {
      // No Supabase (dev/demo env) — allow localStorage cache as before
      try { const s=localStorage.getItem('sc_user'); if(s) setUser(JSON.parse(s)) } catch {}
    }
  },[])
  function handleAuth(u:AppUser, fromMemberLogin = false){
    const authedUser = { ...u, signedInAt: Date.now() }
    setUser(authedUser)
    try{localStorage.setItem('sc_user',JSON.stringify(authedUser))}catch{}
    identifyUser(authedUser.email, { provider: authedUser.provider, membership: authedUser.membership })
    Analytics.userSignedIn(authedUser.provider === 'otp' ? 'otp' : authedUser.provider)
    const hasBeta   = checkTrialAccess()
    const hasAccess = hasBeta || authedUser.membership === 'subscription' || authedUser.membership === 'pro'
    if (fromMemberLogin || isSignoutFlow || hasAccess) {
      setGotoProjects(true)
    }
  }

  // Handle Stripe payment return (?payment=success&product=report|pro|subscription)
  useEffect(()=>{
    if(typeof window==='undefined') return
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    const product = params.get('product')
    const betaParam = params.get('beta')
    const scanModule = params.get('module')  // 'accessibility' | 'foundation'

    // beta=1 in URL means user came through beta access flow — grant immediately
    if(betaParam === '1'){
      try{localStorage.setItem('sc_beta_access','1')}catch{}
      try{sessionStorage.setItem('sc_beta_access','1')}catch{}
      window.history.replaceState({}, '', '/?signin=1')
    }

    // ?module= launches a specific AI scan after auth — set module and go to scan_ready
    if(scanModule === 'accessibility' || scanModule === 'foundation'){
      // Store in localStorage so the app reads it after auth completes
      try { localStorage.setItem('sc_launch_module', scanModule) } catch {}
      window.history.replaceState({}, '', '/?signin=1')
    }

    if(payment==='success'){
      Analytics.purchaseCompleted(product as 'report'|'pro')
      if((product==='pro' || product==='subscription') && user){
        const upgraded = {...user, membership:'subscription' as const}
        setUser(upgraded)
        try{localStorage.setItem('sc_user', JSON.stringify(upgraded))}catch{}
        // Grant access — persisted to localStorage so it survives page refresh
        try{localStorage.setItem('sc_beta_access','1')}catch{}
        try{sessionStorage.setItem('sc_beta_access','1')}catch{}
      }
    }
    if(payment==='cancelled'){
      if(product) Analytics.purchaseCancelled(product as 'report'|'pro')
      window.history.replaceState({}, '', '/')
    }
  },[user])
  function handleLogout(){
    Analytics.userSignedOut()
    resetUser()
    setUser(null)
    try{localStorage.removeItem('sc_user')}catch{}
    try{localStorage.removeItem('sc_beta_access')}catch{}
    setIsSignoutFlow(true)   // show member login, not marketing or splash
    setSplashDone(true)      // skip splash for returning users signing out
  }
  function handleUpdateUser(u:AppUser){setUser(u);try{localStorage.setItem('sc_user',JSON.stringify(u))}catch{}}
  // ── Marketing redirect ────────────────────────────────────────────────────
  // Unauthenticated visitors go to /marketing unless ?signin=1 is present.
  // We use a state+useEffect pattern to avoid SSR/hydration mismatch.
  const [redirectChecked, setRedirectChecked] = React.useState(false)
  const [isSigninFlow,    setIsSigninFlow]    = React.useState(false)
  // Store goto param for post-auth routing
  const [gotoProjects,   setGotoProjects]   = React.useState(false)
  const [gotoProjectId,  setGotoProjectId]  = React.useState<string|null>(null)
  const [isSignoutFlow,  setIsSignoutFlow]  = React.useState(false)  // after sign-out → member login

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const signin  = params.get('signin') === '1'
    const member  = params.get('member') === '1'   // explicit member login (from "Sign In" button)
    const payment = params.get('payment')
    const goto    = params.get('goto')
    const project = params.get('project')
    const scanParam = params.get('module')         // e.g. ?module=accessibility or ?module=foundation
    const isPaymentReturn = payment === 'success' || payment === 'cancelled'

    // ?module= always implies signin flow — prevents redirect to marketing
    setIsSigninFlow(signin || isPaymentReturn || !!scanParam)
    if (member) setIsSignoutFlow(true)  // treat ?member=1 same as post-signout flow
    if (goto === 'projects') setGotoProjects(true)
    if (project) setGotoProjectId(project)
    setRedirectChecked(true)

    // Check localStorage synchronously — React state hasn't hydrated yet
    if (!signin && !isPaymentReturn && !member) {
      let hasSession = false
      try {
        const stored = localStorage.getItem('sc_user')
        if (stored) {
          const u = JSON.parse(stored)
          if (u?.email) hasSession = true
        }
      } catch {}
      if (!hasSession) {
        window.location.replace('/marketing')
      }
    }
  }, []) // eslint-disable-line

  // While redirect check runs, render nothing to avoid flash
  if (!redirectChecked) return null
  // Allow through if: signin flow, member flow, signout flow, or has localStorage session
  if (!user && !isSigninFlow && !isSignoutFlow) {
    try {
      const stored = localStorage.getItem('sc_user')
      if (!stored || !JSON.parse(stored)?.email) return null
    } catch { return null }
  }

  // ── Payment success screen ────────────────────────────────────────────────
  if (typeof window !== 'undefined') {
    const _params = new URLSearchParams(window.location.search)
    const _payment = _params.get('payment')
    const _product = _params.get('product')
    if (_payment === 'success' && (_product === 'report' || _product === 'photo_report')) {
      return <PaymentSuccessScreen />
    }
  }

  // Show splash on first visit (when coming from marketing via ?signin=1)
  if(!user && !splashDone) return (
    <SplashScreen onDone={() => setSplashDone(true)} />
  )
  // Sign-out path → Member login (no splash, no upsell)
  if(!user && isSignoutFlow) return (
    <MemberLoginScreen
      onAuth={(u) => handleAuth(u, true)}
      onNotAMember={() => window.location.href = '/marketing'}
    />
  )
  if(!user)return <AuthScreen onAuth={handleAuth}/>
  // Auto-assign default role if not set — role screen removed, user picks Individual/Professional instead
  if(!user.role){
    const defaulted={...user,role:'diy' as UserRole}
    handleUpdateUser(defaulted)
  }
  // Show legal disclaimer if user hasn't agreed yet
  const legalKey = 'sc_legal_agreed'
  if(!legalAgreed)return <LegalDisclaimerScreen onAgree={()=>{
    try{localStorage.setItem(legalKey,'1')}catch{}
    setLegalAgreed(true)
  }}/>
  // ── Trial expiry check — show expired screen if trial has run out ──────────
  if (user) {
    const trialBeta = (()=>{ try { return localStorage.getItem('sc_beta_access') === '1' } catch { return false }})()
    const paid      = user.membership === 'subscription' || user.membership === 'pro'
    if (trialBeta && !paid) {
      // User has trial access (no paid sub) — check if it has expired
      const trialExpired = !checkTrialAccess()
      if (trialExpired) {
        return <TrialExpiredScreen
          userEmail={user.email}
          onSubscribe={() => {/* Stripe opens in TrialExpiredScreen */}}
          onSignOut={handleLogout}
        />
      }
    }
  }

  return <AppShell user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} initialScreen={gotoProjects ? 'inspection_projects' : undefined} initialProjectId={gotoProjectId} navigateToProjects={gotoProjects}/>
}

// ── Legal Disclaimer Screen ───────────────────────────────────────────────────
function LegalDisclaimerScreen({onAgree}:{onAgree:()=>void}){
  const [checked,setChecked]=useState(false)
  return(
    <div style={{minHeight:'100dvh',background:'#0A1C2E',backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px),repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem 1.25rem',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}><div style={{display:'flex',justifyContent:'center',marginBottom:'1.25rem'}}><Logo size="md" onDark /></div>
      <div style={{width:'100%',maxWidth:420,background:'#0F2438',border:'1px solid rgba(65,124,164,0.20)',borderRadius:20,overflow:'hidden'}}>{/* Header */}
        <div style={{background:'#F29337',padding:'1rem 1.25rem',display:'flex',alignItems:'center',gap:'0.6rem'}}><div>
            <div style={{fontSize:'0.95rem',fontWeight: 700,color:'#fff',letterSpacing:'-0.01em'}}>Terms of Use & Disclaimer</div>
            <div style={{fontSize:'0.65rem',color:'rgba(255,255,255,0.8)',marginTop:'0.1rem'}}>Please read before continuing</div>
          </div>
        </div>
        {/* Body */}
        <div style={{padding:'1.25rem',maxHeight:'55dvh',overflowY:'auto'}}><p style={{fontSize:'0.75rem',color:'#E8F4FF',lineHeight:1.75,margin:'0 0 0.85rem'}}><strong style={{color:'#F29337'}}>stAIrcode is a visual aid only</strong> — it is not a building inspection tool and does not determine whether any staircase is legally compliant with any building code.
          </p>
          <p style={{fontSize:'0.75rem',color:'#93BAD4',lineHeight:1.75,margin:'0 0 0.85rem'}}>All measurements are AI estimates from camera images. Accuracy is limited by lighting, angle, and image quality — typical error is <strong style={{color:'#E8F4FF'}}>±10–25mm or greater</strong>. Results must not be used for construction, permit applications, safety certification, or legal proceedings.
          </p>
          <p style={{fontSize:'0.75rem',color:'#93BAD4',lineHeight:1.75,margin:'0 0 0.85rem'}}>Only a <strong style={{color:'#E8F4FF'}}>licensed building inspector, professional engineer, or registered architect</strong> using calibrated equipment can produce legally valid measurements. Always consult a qualified professional before making compliance decisions.
          </p>
          <p style={{fontSize:'0.75rem',color:'#93BAD4',lineHeight:1.75,margin:'0 0 0.85rem'}}>Building codes referenced are indicative only. Consult the applicable Authority Having Jurisdiction (AHJ) for binding requirements.
          </p>
          <p style={{fontSize:'0.7rem',color:'#4E7A9B',lineHeight:1.6,margin:0}}><strong style={{color:'#93BAD4'}}>Limitation of Liability:</strong> Just Open Technologies Inc., its officers, directors, and employees accept no liability for any loss, damage, injury, or consequence arising from use of this application. Use is entirely at your own risk.
          </p>
        </div>
        {/* Agree checkbox */}
        <div style={{padding:'1rem 1.25rem',borderTop:'1px solid rgba(65,124,164,0.15)',display:'flex',alignItems:'flex-start',gap:'0.75rem',cursor:'pointer'}} onClick={()=>setChecked(v=>!v)}>
          <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${checked?'#27A96B':'rgba(147,186,212,0.4)'}`,background:checked?'#27A96B':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2,transition:'all 0.15s'}}>{checked && <span style={{color:'#fff',fontSize:'0.85rem',fontWeight: 700,lineHeight:1}}>&#10003;</span>}
          </div>
          <span style={{fontSize:'0.76rem',color:'#E8F4FF',lineHeight:1.55}}>I understand that stAIrcode is a visual aid only and not a professional compliance tool. I agree to the{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:'#F29337',fontWeight:600}}>Terms of Service</a>.
          </span>
        </div>
        {/* CTA */}
        <div style={{padding:'0 1.25rem 1.25rem'}}><button
            onClick={()=>{ if(checked)onAgree() }}
            disabled={!checked}
            style={{width:'100%',padding:'1rem',background:checked?'linear-gradient(135deg,#27A96B,#1A7A50)':'rgba(255,255,255,0.06)',border:'none',borderRadius:14,color:checked?'#fff':'#4E7A9B',fontSize:'0.95rem',fontWeight:800,letterSpacing:'0.06em',cursor:checked?'pointer':'not-allowed',boxShadow:checked?'0 4px 20px rgba(39,169,107,0.4)':'none',transition:'all 0.2s'}}
          >
            {checked?' I Agree — Continue →':'Check the box above to continue'}
          </button>
        </div>
        <div style={{padding:'0 1.25rem 1rem',textAlign:'center'}}><span style={{fontSize:'0.6rem',color:'#4E7A9B'}}>stAIrcode — Just Open Technologies Inc. · info@staircode.app</span>
        </div>
      </div>
    </div>
  )
}

// ── Accessibility compliance field builder ────────────────────────────────────
function buildAccessibilityFields(m: AccessibilityMeasurements): AccessibilityField[] {
  const fields: AccessibilityField[] = []
  const bp = m.barrierFreePath as any
  const vf = m.visualFireSafety as any
  const wc = m.washrooms as any
  const ps = m.poolSpaAccess as any
  const as_ = m.accessibleSeating as any

  const addField = (label: string, measured: any, required: any, pass: boolean|null, note: string|undefined, severity: 'info'|'warning'|'critical', obcRef?: string) => {
    fields.push({ label, measured: measured ?? null, required: required ?? null, pass, note, severity, obcRef })
  }

  // Barrier-free path
  if (bp?.doorClearMm != null)     addField('Doorway Clear Width',   bp.doorClearMm,   860,  bp.doorClearMm >= 860, bp.doorClearMm < 860 ? `${bp.doorClearMm}mm is below minimum 860mm` : undefined, bp.doorClearMm < 860 ? 'warning' : 'info', 'OBC §3.8.1.4')
  if (bp?.corridorWidthMm != null) addField('Corridor Width',        bp.corridorWidthMm, 900, bp.corridorWidthMm >= 900, bp.corridorWidthMm < 900 ? `${bp.corridorWidthMm}mm is below minimum 900mm` : undefined, bp.corridorWidthMm < 900 ? 'warning' : 'info', 'OBC §3.8.1.6')
  if (bp?.turningSpaceMm != null)  addField('Turning Space Diameter', bp.turningSpaceMm, 1500, bp.turningSpaceMm >= 1500, bp.turningSpaceMm < 1500 ? `${bp.turningSpaceMm}mm is below 1500mm turning circle requirement` : undefined, bp.turningSpaceMm < 1500 ? 'warning' : 'info', 'OBC §3.8.1.5')
  if (bp?.rampWidthMm != null)     addField('Ramp Clear Width',      bp.rampWidthMm,   900,  bp.rampWidthMm >= 900, bp.rampWidthMm < 900 ? 'Below minimum ramp width' : undefined, bp.rampWidthMm < 900 ? 'warning' : 'info', 'OBC §3.8.3.3')
  if (bp?.slopeRatio != null)      addField('Ramp Slope',            `1:${bp.slopeRatio}`, '1:10 max', bp.slopeRatio >= 10, bp.slopeRatio < 10 ? `1:${bp.slopeRatio} slope exceeds maximum 1:10` : undefined, bp.slopeRatio < 10 ? 'warning' : 'info', 'OBC §3.8.3.1')
  // Visual fire safety
  if (vf?.alarmsObservedCount != null) addField('Visual Alarms Observed', vf.alarmsObservedCount, null, null, undefined, 'info', 'OBC §3.2.4')
  if (vf?.coverageAdequate != null)    addField('Alarm Coverage Adequate', vf.coverageAdequate ? 'Yes' : 'No', 'All areas', vf.coverageAdequate, vf.coverageAdequate ? undefined : 'Visual alarms must cover all areas of the floor', vf.coverageAdequate ? 'info' : 'warning', 'NFPA 72')
  if (vf?.strobePresent != null)       addField('Sleeping Room Strobe',    vf.strobePresent ? 'Present' : 'Not detected', 'Required', vf.strobePresent, vf.strobePresent ? undefined : 'Visual strobe required in all sleeping rooms', vf.strobePresent ? 'info' : 'critical', 'OBC §3.2.4')
  // Washrooms
  if (wc?.doorClearMm != null)          addField('Washroom Door Width',   wc.doorClearMm,   860,  wc.doorClearMm >= 860, wc.doorClearMm < 860 ? 'Below minimum washroom entry width' : undefined, wc.doorClearMm < 860 ? 'warning' : 'info', 'OBC §3.8.4')
  if (wc?.turningSpaceMm != null)       addField('Washroom Turning Space', wc.turningSpaceMm, 1500, wc.turningSpaceMm >= 1500, wc.turningSpaceMm < 1500 ? 'Insufficient turning radius for wheelchair' : undefined, wc.turningSpaceMm < 1500 ? 'critical' : 'info', 'OBC §3.8.4.5')
  if (wc?.sideGrabBarPresent != null)   addField('Side Grab Bar',          wc.sideGrabBarPresent ? 'Present' : 'Absent', 'Required', wc.sideGrabBarPresent, wc.sideGrabBarPresent ? undefined : 'Side grab bar required at accessible WC', wc.sideGrabBarPresent ? 'info' : 'critical', 'OBC §3.8.4.7')
  if (wc?.sideGrabBarHeightMm != null)  addField('Grab Bar Height',        wc.sideGrabBarHeightMm, '840–920mm', wc.sideGrabBarHeightMm >= 840 && wc.sideGrabBarHeightMm <= 920, undefined, 'info', 'OBC §3.8.4.7')
  if (wc?.counterHeightMm != null)      addField('Counter/Sink Height',    wc.counterHeightMm, '≤865mm', wc.counterHeightMm <= 865, wc.counterHeightMm > 865 ? 'Counter height exceeds accessible maximum' : undefined, wc.counterHeightMm > 865 ? 'warning' : 'info', 'OBC §3.8.4')
  // Pool/spa
  if (ps?.deckWidthMm != null)          addField('Pool Deck Width',        ps.deckWidthMm,   1200, ps.deckWidthMm >= 1200, ps.deckWidthMm < 1200 ? 'Barrier-free deck zone too narrow' : undefined, ps.deckWidthMm < 1200 ? 'warning' : 'info', 'OBC §3.8.5')
  if (ps?.barrierFreeApproach != null)  addField('Barrier-Free Approach',  ps.barrierFreeApproach ? 'Present' : 'Not present', 'Required', ps.barrierFreeApproach, ps.barrierFreeApproach ? undefined : 'No barrier-free path from entrance to pool deck', ps.barrierFreeApproach ? 'info' : 'critical', 'OBC §3.8.5')
  if (ps?.poolLiftPresent != null)      addField('Pool Lift',               ps.poolLiftPresent ? 'Present' : 'Not observed', 'Required for public pools', ps.poolLiftPresent ?? null, ps.poolLiftPresent ? undefined : 'Pool lift or alternative barrier-free water entry required', ps.poolLiftPresent ? 'info' : 'warning', 'OBC §3.8.5')
  // Accessible seating
  if (as_?.wheelchairSpacesCount != null) addField('Wheelchair Spaces Count', as_.wheelchairSpacesCount, null, null, undefined, 'info', 'OBC §3.8.6.1')
  if (as_?.spaceWidthMm != null)          addField('Wheelchair Space Width',  as_.spaceWidthMm,   900,  as_.spaceWidthMm >= 900, as_.spaceWidthMm < 900 ? 'Below 900mm minimum width' : undefined, as_.spaceWidthMm < 900 ? 'warning' : 'info', 'OBC §3.8.6.1')
  if (as_?.spaceDepthMm != null)          addField('Wheelchair Space Depth',  as_.spaceDepthMm,   1400, as_.spaceDepthMm >= 1400, as_.spaceDepthMm < 1400 ? 'Below 1400mm minimum depth' : undefined, as_.spaceDepthMm < 1400 ? 'warning' : 'info', 'OBC §3.8.6.1')
  if (as_?.companionSeatsPresent != null) addField('Companion Seating',       as_.companionSeatsPresent ? 'Present' : 'Not found', 'Required', as_.companionSeatsPresent, as_.companionSeatsPresent ? undefined : 'Companion seat required adjacent to each wheelchair space', as_.companionSeatsPresent ? 'info' : 'warning', 'OBC §3.8.6.3')
  if (as_?.aisleWidthMm != null)          addField('Approach Aisle Width',    as_.aisleWidthMm,   900,  as_.aisleWidthMm >= 900, as_.aisleWidthMm < 900 ? 'Approach aisle below 900mm minimum' : undefined, as_.aisleWidthMm < 900 ? 'warning' : 'info', 'OBC §3.8.6')

  return fields
}

// ── App Shell ─────────────────────────────────────────────────────────────────
function AppShell({user,onLogout,onUpdateUser,initialScreen,initialProjectId,navigateToProjects}:{user:AppUser;onLogout:()=>void;onUpdateUser:(u:AppUser)=>void;initialScreen?:Screen;initialProjectId?:string|null;navigateToProjects?:boolean}){
  const [tab,setTab]=useState<Tab>('home')
  const [screen,setScreen]=useState<Screen>(() => {
    if (initialScreen) return initialScreen
    // Check localStorage directly here (synchronous) — user prop may not be hydrated yet
    try {
      const hasBeta = checkTrialAccess()
      const stored  = localStorage.getItem('sc_user')
      const storedUser = stored ? JSON.parse(stored) : null
      const mem = storedUser?.membership
      if (hasBeta || mem === 'subscription' || mem === 'pro') return 'inspection_projects'
    } catch {}
    // Fall back to React prop
    if (user.membership === 'subscription' || user.membership === 'pro') {
      try { if (checkTrialAccess()) return 'inspection_projects' } catch {}
    }
    return 'home'
  })

  // Navigate to projects when parent signals it (e.g. after sign-in from MemberLoginScreen)
  React.useEffect(() => {
    if (navigateToProjects) setScreen('inspection_projects')
  }, [navigateToProjects])

  const [inspectionJob,setInspectionJob]=useState<InspectionJob|null>(null)

  // Auto-load specific project if opened via magic link (?project=JOB_ID)
  React.useEffect(() => {
    if (!initialProjectId) return
    // Try sessionStorage first (instant)
    try {
      const raw = sessionStorage.getItem(`insp_${initialProjectId}`)
      if (raw) { const j = JSON.parse(raw); setInspectionJob(j); setScreen('inspection_dashboard'); return }
    } catch {}
    // Fall back to server
    fetch(`/api/inspection/load?id=${initialProjectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.ok && data.job) { setInspectionJob(data.job); setScreen('inspection_dashboard') }
        else setScreen('inspection_projects') // fallback to list
      })
      .catch(() => setScreen('inspection_projects'))
  }, [initialProjectId]) // eslint-disable-line
  const [projectType,setProjectType]=useState<ProjectType>('new_construction')
  const [activeModule, setActiveModule] = useState<'stair'|'foundation'|'accessibility'>('stair')

  // Launch specific scan if coming from /?module=accessibility or /?module=foundation
  React.useEffect(() => {
    try {
      const pending = localStorage.getItem('sc_launch_module')
      if (pending === 'accessibility' || pending === 'foundation') {
        localStorage.removeItem('sc_launch_module')
        setActiveModule(pending as 'accessibility'|'foundation')
        setScreen('scan_ready')
      }
    } catch {}
  }, []) // eslint-disable-line
  const [foundationMeasurements, setFoundationMeasurements] = useState<FoundationMeasurements|null>(null)
  const [accessibilityMeasurements, setAccessibilityMeasurements] = useState<AccessibilityMeasurements|null>(null)
  const [loc,setLoc]=useState<Loc|null>(null)
  const [locLoading,setLocLoading]=useState(true)
  const [code,setCode]=useState<Code|null>(null)
  const [latLng,setLatLng]=useState<{lat:number;lng:number}|null>(null)
  const [measurements,setMeasurements]=useState<StairMeasurements|null>(null)

  useEffect(()=>{
    // ── Server-side IP geolocation — no CSP issues, no permission needed ────
    // Hits /api/geo which calls ip-api.com / ipapi.co from the server
    async function fetchServerGeo() {
      try {
        const r = await fetch('/api/geo')
        if (!r.ok) return null
        const d = await r.json()
        if (!d.city || d.city === 'Unknown') return null
        return {
          city:        d.city        as string,
          province:    d.province    as string,
          country:     d.country     as string,
          countryCode: d.countryCode as string,
        } as Loc
      } catch { return null }
    }

    // Fire immediately — no permission dialog, resolves in ~200ms
    fetchServerGeo().then(ipLoc => {
      if (ipLoc) {
        setLoc(ipLoc)
        setCode(detectCode(ipLoc))
        // Store lat/lon if returned
      }
      setLocLoading(false)
    })

    // Also try browser GPS for higher accuracy (overrides IP if it resolves)
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async pos => {
        setLatLng({lat:pos.coords.latitude, lng:pos.coords.longitude})
        try {
          const r = await fetch(
            `/api/geo?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
          )
          if (r.ok) {
            const d = await r.json()
            if (d.city && d.city !== 'Unknown') {
              const l:Loc = {
                city: d.city, province: d.province,
                country: d.country, countryCode: d.countryCode,
              }
              setLoc(l); setCode(detectCode(l))
            }
          }
        } catch {}
      },
      () => {},  // GPS denied — IP result already set above
      { timeout: 15000, maximumAge: 300000, enableHighAccuracy: false }
    )
  },[])

  const handleScanSuccess=useCallback((raw: Record<string,number|string>)=>{
    const n = (k: string, fallback: number|null = null) => {
      const v = raw[k]
      return typeof v === 'number' ? v : fallback
    }
    const m: StairMeasurements = {
      rise:       n('rise'),
      run:        n('run'),
      width:      n('width'),
      nosing:     raw.nosing === 'none' ? null : n('nosing'),
      headroom:   raw.headroom === 'clear' ? 'clear' : n('headroom'),
      guard:      n('guard'),
      confidence: 0.88,
      calibrated: true,
      riserCount: n('riserCount') ?? undefined,
      riserInconsistent: n('riserInconsistent') ?? undefined,
      riserVariationMm:  n('riserVariationMm')  ?? undefined,
      tiltCorrected:     n('tiltCorrected')      ?? undefined,
      tiltAngleDeg:      n('tiltAngleDeg')       ?? undefined,
      tapeMeasureRead:   n('tapeMeasureRead')    ?? undefined,
      rawEstimateMm:     n('rawEstimateMm')      ?? undefined,
      guardrailAbsent:   n('guardrailAbsent')    ?? undefined,
      guardrailLikelyRequired: n('guardrailLikelyRequired') ?? undefined,
      occupancyType:     typeof raw.occupancyType === 'string' ? raw.occupancyType : undefined,
      occupancyConfidence: n('occupancyConfidence') ?? undefined,
      applicableCodePart: typeof raw.applicableCodePart === 'string' ? raw.applicableCodePart : undefined,
    }
    const measurementCount = (['rise','run','width','guard'] as const).filter(k => n(k) !== null).length
    Analytics.scanCompleted({ role: user?.role ?? 'diy', measurementCount, hasFailed: false })
    // Persist captured frames for report email embedding
    // _frames arrives as a JSON string from ScanReadyScreen — parse it to object first
    if (raw._frames) {
      try {
        const u = JSON.parse(localStorage.getItem('sc_user') || '{}')
        u._frames = typeof raw._frames === 'string' ? JSON.parse(raw._frames) : raw._frames
        localStorage.setItem('sc_user', JSON.stringify(u))
        // Also write directly to sessionStorage for immediate access
        sessionStorage.setItem('sc_frames', typeof raw._frames === 'string' ? raw._frames : JSON.stringify(raw._frames))
      } catch {}
    }
    setMeasurements(m)
    setScreen('report')
  },[user])
  // handleDetectComplete removed — detect/capture screens deprecated,[])
  // handleCaptureComplete removed — capture screen deprecated
  const handleFoundationScan = useCallback((m: FoundationMeasurements) => {
    setFoundationMeasurements(m)
    setScreen('report')
  }, [])
  const handleAccessibilityScan = useCallback((m: AccessibilityMeasurements) => {
    setAccessibilityMeasurements(m)
    setScreen('report')
  }, [])
  const handleStartOver=useCallback(()=>{setMeasurements(null);setScreen('home')},[])
  const handleRetake=useCallback(()=>{
    // Full retake — clears measurements, shows intro
    setMeasurements(null)
    setScreen('scan_ready')
  },[])
  const handleRetakeToReview=useCallback(()=>{
    // Partial — keeps measurements, jumps straight to Review screen (no intro)
    setScreen('scan_review')
  },[])

  // Full-screen flows (no bottom nav)

  // Inspection dashboard routing
  // Check if user has beta access or subscription
  function hasInspectionAccess(): boolean {
    if (user.membership === 'pro' || user.membership === 'subscription') return true
    // Check all storage locations — betacode67 grants full session access
    try { if (checkTrialAccess()) return true } catch {}
    // Also check stored user object for membership
    try {
      const stored = localStorage.getItem('sc_user')
      if (stored) {
        const u = JSON.parse(stored)
        if (u?.membership === 'subscription' || u?.membership === 'pro') return true
      }
    } catch {}
    return false
  }

  // Auto-skip paywall if user already has access
  React.useEffect(() => {
    if (screen === 'inspection_paywall' && hasInspectionAccess()) {
      setScreen('inspection_projects')
    }
  }, [screen]) // eslint-disable-line

  if(screen==='inspection_paywall'){
    // hasInspectionAccess redirects via useEffect above; show nothing while it fires
    if(hasInspectionAccess()) return null
    return <InspectionPaywall
      userEmail={user.email??''}
      onBack={()=>setScreen('home')}
      onAccess={()=>setScreen('inspection_projects')}
      onSignIn={()=>{ window.location.href = '/?member=1' }}
    />
  }
  if(screen==='inspection_type')
    return <ProjectTypeScreen onSelect={async t=>{
      setProjectType(t)
      // Create a stub job immediately and save to Supabase so it appears in My Inspections right away
      const { createNewJob } = await import('@/lib/inspection-types')
      const stubJob = createNewJob({ projectType: t, status: 'active' })
      setInspectionJob(stubJob)
      try { sessionStorage.setItem(`insp_${stubJob.id}`, JSON.stringify(stubJob)) } catch {}
      try { localStorage.setItem(`insp_${stubJob.id}`, JSON.stringify(stubJob)) } catch {}
      try { localStorage.setItem('sc_last_job_id', stubJob.id) } catch {}
      // Fire-and-forget save to Supabase
      fetch('/api/inspection/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: stubJob, userId: user.email }),
      }).catch(() => {})
      // Send project magic link email so user can return directly without re-signing-in
      if (user.email) {
        fetch('/api/inspection/magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email:         user.email,
            jobId:         stubJob.id,
            address:       '(new project)',
            inspectorName: user.name || 'Inspector',
          }),
        }).catch(() => {})
      }
      setScreen('inspection_setup')
    }} onBack={()=>setScreen('inspection_projects')}/>
  if(screen==='inspection_projects')
    return <InspectionProjectList
      userEmail={user.email??''}
      onBack={()=>setScreen('home')}
      onStartNew={()=>{
        // Always allow new projects — pre-screening doesn't require membership
        setScreen('inspection_type')
      }}
      onResumeJob={job=>{setInspectionJob(job);setScreen('inspection_dashboard')}}
    />
  if(screen==='inspection_setup')
    return <InspectionSetupScreen
      projectType={projectType}
      existingJobId={inspectionJob?.id}
      onJobCreated={job=>{
        setInspectionJob(job)
        // Save + send updated magic link with real address
        fetch('/api/inspection/save', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({job, userId:user.email}),
        }).catch(()=>{})
        if (user.email && job.address?.street) {
          fetch('/api/inspection/magic-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email:         user.email,
              jobId:         job.id,
              address:       `${job.address.street}, ${job.address.city}`,
              inspectorName: job.inspectorName || user.name || 'Inspector',
            }),
          }).catch(()=>{})
        }
        setScreen('inspection_dashboard')
      }}
      onBack={()=>setScreen('inspection_type')}
    />
  if(screen==='inspection_dashboard'&&inspectionJob)
    return <InspectionDashboard job={inspectionJob} onUpdate={j=>{
      setInspectionJob(j)
      // Persist to BOTH sessionStorage (fast) AND localStorage (survives reload)
      try { sessionStorage.setItem(`insp_${j.id}`, JSON.stringify(j)) } catch {}
      try { localStorage.setItem(`insp_${j.id}`, JSON.stringify(j)) } catch {}
    }} onBack={()=>setScreen('inspection_projects')} userEmail={user.email??''} userRole={user.role}/>

  // Accessibility module routing
  if(screen==='scan_ready' && activeModule==='accessibility')
    return <AccessibilityScanScreen onSuccess={handleAccessibilityScan} onBack={()=>setScreen('home')}/>
  if(screen==='report' && activeModule==='accessibility' && accessibilityMeasurements) {
    const activeCodeAcc = code ?? {code:'OBC' as const,label:'OBC 2024',ref:'§3.8',reason:'Ontario Building Code',links:[],limits:{riserMin:125,riserMax:200,runMin:235,nosingMin:15,nosingMax:25,widthMin:860,headMin:1950,guardMin:900}}
    const aFields = buildAccessibilityFields(accessibilityMeasurements)
    return <AccessibilityReportScreen measurements={accessibilityMeasurements} fields={aFields} codeLabel={activeCodeAcc.label} location={loc?`${loc.city}${loc.province?', '+loc.province:''}`:''}  onRetake={()=>{setAccessibilityMeasurements(null);setScreen('scan_ready')}} onStartOver={()=>{setAccessibilityMeasurements(null);setActiveModule('stair');setScreen('home')}}/>
  }

  // Foundation module routing
  if(screen==='scan_ready' && activeModule==='foundation')
    return <FoundationScanScreen onSuccess={handleFoundationScan} onBack={()=>setScreen('home')}/>
  if(screen==='report' && activeModule==='foundation' && foundationMeasurements) {
    const activeCode2 = code ?? {code:'IBC' as const,label:'IBC 2021',ref:'§1011',reason:'International Building Code',limits:{riserMin:100,riserMax:178,runMin:279,widthMin:914,headMin:2032,guardMin:914}}
    const fFields = checkFoundation(foundationMeasurements, activeCode2.label)
    return <FoundationReportScreen measurements={foundationMeasurements} fields={fFields} codeLabel={activeCode2.label} location={loc?`${loc.city}${loc.province?', '+loc.province:''}`:''}  onRetake={()=>{setFoundationMeasurements(null);setScreen('scan_ready')}} onStartOver={()=>{setFoundationMeasurements(null);setActiveModule('stair');setScreen('home')}}/>
  }
  if(screen==='scan_ready')return <ScanReadyScreen userRole={user.role} onSuccess={handleScanSuccess as (m:Record<string,number|string>)=>void} onBack={()=>setScreen('home')}/>
  if(screen==='scan_review')return <ScanReadyScreen userRole={user.role} onSuccess={handleScanSuccess as (m:Record<string,number|string>)=>void} onBack={()=>setScreen('report')} startAtReview={true}/>
  // Use IBC as fallback if code not yet detected (location loading)
  const activeCode = code ?? {code:'IBC',label:'IBC 2021',ref:'§1011',reason:'International Building Code',limits:{riserMin:100,riserMax:178,runMin:279,widthMin:914,headMin:2032,guardMin:914}}
  if(screen==='report'&&measurements)return <ReportScreen measurements={measurements} fields={check(measurements,activeCode)} codeLabel={activeCode.label} codeRef={activeCode.ref} location={loc?`${loc.city}${loc.province?', '+loc.province:''}`:''}  userLatLng={latLng} isOntario={loc?isOntario(loc):false} userRole={user?.role} onRetake={handleRetakeToReview} onStartOver={handleStartOver}/>

  return(
    <div style={{minHeight:'100dvh',background:C.dark,color:'#fff',display:'flex',flexDirection:'column',maxWidth:430,margin:'0 auto',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}><div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>{tab==='home'&&<HomeTab user={user} loc={loc} locLoading={locLoading} code={code} onStartScan={(mod)=>{setTab('home');setActiveModule(mod);Analytics.scanStarted({role:user.role,codeLabel:code?.label,location:loc?`${loc.city}${loc.province?', '+loc.province:''}`:undefined,scanMode:mod});setScreen('scan_ready')}} onStartInspection={()=>{ if(hasInspectionAccess()) setScreen('inspection_projects'); else setScreen('inspection_paywall') }} onLogout={onLogout} activeModule={activeModule} onModuleChange={m=>{setActiveModule(m)}}/>}
        {tab==='help'&&<HelpScreen/>}
        {tab==='settings'&&<SettingsScreen user={user} onLogout={onLogout} onUpdateUser={onUpdateUser}/>}
      </div>
      <BottomNav active={tab} onChange={t=>{setTab(t);if(t!=='home')setScreen('home');if(t==='help')Analytics.helpViewed();if(t==='settings')Analytics.settingsViewed()}}/>
      <CodeHelper />
    </div>
  )
}

// ── Home Tab ──────────────────────────────────────────────────────────────────
function HomeTab({user,loc,locLoading,code,onStartScan,onStartInspection,onLogout,activeModule,onModuleChange}:{user:AppUser;loc:Loc|null;locLoading:boolean;code:Code|null;onStartScan:(mod:'stair'|'foundation'|'accessibility')=>void;onStartInspection:()=>void;onLogout:()=>void;activeModule:'stair'|'foundation'|'accessibility';onModuleChange:(m:'stair'|'foundation'|'accessibility')=>void}){
  const confirmed=!locLoading&&loc!=null&&isOntario(loc)
  const locStr=loc?`${loc.city}${loc.province?', '+loc.province:''}`:locLoading?'Detecting location…':'Location unavailable'

  // ── Scan usage counter ────────────────────────────────────────────────
  const FREE_LIMIT = 3
  const [scansUsed,  setScansUsed]  = React.useState<number|null>(null)
  const [isPro,      setIsPro]      = React.useState(user.membership === 'pro')

  React.useEffect(() => {
    if (!user.email || user.membership === 'pro') return
    // Fetch usage count from API
    fetch(`/api/scan-usage?email=${encodeURIComponent(user.email)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.scanCount != null) setScansUsed(d.scanCount)
        if (d?.isPro) setIsPro(true)
      })
      .catch(() => {}) // fail silently — don't block the UI
  }, [user.email, user.membership])

  const scansLeft  = isPro ? Infinity : Math.max(0, FREE_LIMIT - (scansUsed ?? 0))
  const atLimit    = !isPro && scansUsed != null && scansUsed >= FREE_LIMIT
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column'}}>

      {/* ── Hero ── */}
      <div style={{background:'linear-gradient(160deg,#0D2B45 0%,#0A1F33 55%,#0D2B45 100%)',padding:'max(env(safe-area-inset-top,0px),1.8rem) 1.4rem 1.5rem',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.4rem',borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',justifyContent:'center'}}><Logo size="md" onDark /></div>
        <h1 style={{fontSize:'1.35rem',fontWeight:700,lineHeight:1.2,textAlign:'center',margin:'0.25rem 0 0',color:'#fff'}}>Building Compliance Scanner</h1>
        <p style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.45)',textAlign:'center',margin:0}}>Welcome back, {user.name.split(' ')[0]}</p>
      </div>

      <div style={{flex:1,padding:'1.25rem',display:'flex',flexDirection:'column',gap:'0.75rem',background:'#EBF3FA'}}>

        {/* ── Location card ── */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'0.9rem 1rem',display:'flex',flexDirection:'column',gap:'0.45rem'}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:locLoading?'#F29337':confirmed?C.pass:'rgba(167,177,194,0.4)',boxShadow:locLoading?'0 0 0 3px rgba(242,147,55,0.2)':confirmed?'0 0 0 3px rgba(74,144,226,0.2)':'none'}}/>
            <span style={{fontSize:'0.8rem',color:'#0A1C2E',fontWeight:600}}>{locLoading?'Detecting location…':locStr}</span>
          </div>
          {!locLoading&&code&&(
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:'0.68rem',color:'#2C4A6E',fontWeight:500}}>
                {code.code==='OBC' && <>Building Codes: <a href="https://www.ontario.ca/laws/statute/92b23" target="_blank" rel="noopener noreferrer" style={{color:'#417CA4',fontWeight:600}}>OBC</a> · <a href="https://www.toronto.ca/city-government/planning-development/official-plan-guidelines/zoning-by-law/" target="_blank" rel="noopener noreferrer" style={{color:'#417CA4',fontWeight:600}}>Toronto Bylaw</a> · <a href="https://www.ontario.ca/laws/statute/05a11" target="_blank" rel="noopener noreferrer" style={{color:'#417CA4',fontWeight:600}}>AODA</a></>}
                {code.code==='NBC' && <>Building Codes: <a href="https://www.nrc-cnrc.gc.ca/eng/publications/codes_centre/2020_national_building_code.html" target="_blank" rel="noopener noreferrer" style={{color:'#417CA4',fontWeight:600}}>NBC 2020</a></>}
                {code.code==='IBC' && <>Building Codes: <a href="https://codes.iccsafe.org/content/IBC2021" target="_blank" rel="noopener noreferrer" style={{color:'#417CA4',fontWeight:600}}>IBC 2021</a></>}
                {code.code!=='OBC'&&code.code!=='NBC'&&code.code!=='IBC' && <span>{code.ref}</span>}
              </span>
              <span style={{fontSize:'0.65rem',fontWeight:600,letterSpacing:'0.08em',color:confirmed?'#0D7A5F':'#2C5A7A',background:confirmed?'#E6F5F1':'#EBF2FF',padding:'0.22rem 0.65rem',borderRadius:8,border:`1px solid ${confirmed?'rgba(13,122,95,0.3)':'rgba(44,90,122,0.25)'}`}}>{code.label}</span>
            </div>
          )}
        </div>

        {/* ── Primary action buttons ── */}
        {(() => {
          const hasAccess = isPro || user.membership === 'subscription' || user.membership === 'pro' || checkTrialAccess()
          // "Full Building Inspection" only shown on very first sign-in (before any project exists)
          let isFirstLogin = false
          try { isFirstLogin = localStorage.getItem('sc_first_login_done') !== '1' } catch {}

          return (
            <div style={{display:'flex',flexDirection:'column',gap:'0.75rem',alignItems:'center'}}>

              {/* Demo — compact centred card */}
              <div style={{width:'100%',maxWidth:320}}>
                <button
                  onClick={()=>{ if(!atLimit) onStartScan('stair') }}
                  style={{width:'100%',padding:'1.25rem 1rem',background:'#fff',border:'1.5px solid rgba(39,169,107,0.4)',borderRadius:16,display:'flex',flexDirection:'column',alignItems:'center',gap:'0.6rem',cursor:'pointer',boxShadow:'0 3px 14px rgba(39,169,107,0.12)',transition:'transform 0.1s, box-shadow 0.1s'}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.transform='translateY(-1px)';(e.currentTarget as HTMLButtonElement).style.boxShadow='0 6px 20px rgba(39,169,107,0.2)'}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform='none';(e.currentTarget as HTMLButtonElement).style.boxShadow='0 3px 14px rgba(39,169,107,0.12)'}}>
                  <div style={{width:52,height:52,borderRadius:14,background:'rgba(39,169,107,0.1)',border:'1.5px solid rgba(39,169,107,0.25)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <svg width="26" height="26" viewBox="0 0 20 20" fill="none">
                      <rect x="1" y="12" width="5" height="7" rx="0.5" stroke="#27A96B" strokeWidth="1.5"/>
                      <rect x="6" y="7" width="5" height="12" rx="0.5" stroke="#27A96B" strokeWidth="1.5"/>
                      <rect x="11" y="1" width="8" height="18" rx="0.5" stroke="#27A96B" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:'1.05rem',fontWeight:700,color:'#0D1E2E',lineHeight:1.2}}>Try the Demo</div>
                    <div style={{fontSize:'0.7rem',color:'#5E7D9B',marginTop:'0.2rem',lineHeight:1.5}}>Stair compliance scan — rise, run,{'\n'}headroom, nosing, handrail</div>
                  </div>
                  <span style={{fontSize:'0.65rem',fontWeight:700,color:'#27A96B',padding:'0.22rem 0.7rem',borderRadius:6,border:'1px solid rgba(39,169,107,0.35)',background:'rgba(39,169,107,0.07)'}}>Free — no account needed</span>
                </button>
              </div>

              {/* My Projects (always after first login) OR Full Building Inspection (first-timers without access) */}
              {hasAccess ? (
                <button onClick={()=>{
                  try{localStorage.setItem('sc_first_login_done','1')}catch{}
                  onStartInspection()
                }}
                  style={{width:'100%',maxWidth:320,padding:'1rem 1.25rem',background:`linear-gradient(135deg,#0A1C2E,#1A3A58)`,border:'none',borderRadius:14,display:'flex',alignItems:'center',gap:'0.85rem',cursor:'pointer',textAlign:'left',boxShadow:'0 4px 18px rgba(10,28,46,0.25)'}}>
                  <div style={{width:40,height:40,borderRadius:10,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <rect x="2" y="2" width="16" height="16" rx="2" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5"/>
                      <line x1="2" y1="7" x2="18" y2="7" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/>
                      <line x1="6" y1="11" x2="14" y2="11" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/>
                      <line x1="6" y1="14" x2="10" y2="14" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/>
                    </svg>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'1rem',fontWeight:700,color:'#fff',lineHeight:1.25}}>My Projects</div>
                    <div style={{fontSize:'0.7rem',color:'rgba(255,255,255,0.5)',marginTop:'0.1rem'}}>Building analysis · AI guidance · PDF report</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}>
                    <path d="M6 3l5 5-5 5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ) : isFirstLogin ? (
                <button onClick={()=>{
                  try{localStorage.setItem('sc_first_login_done','1')}catch{}
                  onStartInspection()
                }}
                  style={{width:'100%',maxWidth:320,padding:'1rem 1.25rem',background:`linear-gradient(135deg,#0A1C2E,#1A3A58)`,border:'none',borderRadius:14,display:'flex',alignItems:'center',gap:'0.85rem',cursor:'pointer',textAlign:'left',boxShadow:'0 4px 18px rgba(10,28,46,0.25)'}}>
                  <div style={{width:40,height:40,borderRadius:10,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <rect x="2" y="2" width="16" height="16" rx="2" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5"/>
                      <path d="M7 6v8M10 8v6M13 4v10" stroke="rgba(255,255,255,0.7)" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'1rem',fontWeight:700,color:'#fff',lineHeight:1.25}}>Full Building Analysis</div>
                    <div style={{fontSize:'0.7rem',color:'rgba(255,255,255,0.5)',marginTop:'0.1rem'}}>Members only · Request access</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}>
                    <path d="M6 3l5 5-5 5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ) : null}

            </div>
          )
        })()}

        {/* Limit warning */}
        {atLimit && (
          <div style={{background:'rgba(232,69,69,0.08)',border:'1.5px solid rgba(232,69,69,0.3)',borderRadius:12,padding:'0.75rem 1rem',display:'flex',gap:'0.65rem',alignItems:'flex-start'}}>
            <div>
              <div style={{fontSize:'0.82rem',fontWeight:800,color:'#E84545',marginBottom:'0.2rem'}}>Free scans used up</div>
              <div style={{fontSize:'0.68rem',color:'#2C4A6E',lineHeight:1.55}}>You&apos;ve used all 3 free scans. Contact us to request full member access.</div>
            </div>
          </div>
        )}

        {/* About + Sign out */}
        <div style={{display:'flex',gap:'0.5rem',marginTop:'0.25rem'}}>
          <a href="/marketing"
            style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'0.7rem',background:'rgba(65,124,164,0.07)',border:'1px solid rgba(65,124,164,0.18)',borderRadius:11,textDecoration:'none',color:'#2C5A7A',fontSize:'0.78rem',fontWeight:600}}>
            About
          </a>
          <button onClick={onLogout}
            style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'0.7rem',background:'rgba(65,124,164,0.07)',border:'1px solid rgba(65,124,164,0.18)',borderRadius:11,color:'#2C5A7A',fontSize:'0.78rem',fontWeight:600,cursor:'pointer'}}>
            Sign Out
          </button>
        </div>

        <p style={{textAlign:'center',fontSize:'0.58rem',color:'#9DB4C5',lineHeight:1.5,margin:'0.25rem 0 0'}}>Compliance aid only · Not a substitute for professional inspection</p>

        {/* ── Small social + store links ── */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.65rem',marginTop:'0.5rem',flexWrap:'wrap' as const}}>
          <a href="https://www.instagram.com/staircode/" target="_blank" rel="noopener noreferrer"
            style={{display:'flex',alignItems:'center',gap:'0.3rem',padding:'0.3rem 0.6rem',background:'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)',borderRadius:8,textDecoration:'none',color:'#fff',fontSize:'0.6rem',fontWeight:600}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            Instagram
          </a>
          <a href="https://www.facebook.com/people/Staircode/61589350702805/" target="_blank" rel="noopener noreferrer"
            style={{display:'flex',alignItems:'center',gap:'0.3rem',padding:'0.3rem 0.6rem',background:'#1877F2',borderRadius:8,textDecoration:'none',color:'#fff',fontSize:'0.6rem',fontWeight:600}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Facebook
          </a>
          <a href="https://play.google.com/store/apps/details?id=app.staircode.android&pcampaignid=web_share" target="_blank" rel="noopener noreferrer"
            style={{display:'flex',alignItems:'center',gap:'0.3rem',padding:'0.3rem 0.6rem',background:'#000',border:'1px solid rgba(255,255,255,0.12)',borderRadius:8,textDecoration:'none',color:'#fff',fontSize:'0.6rem',fontWeight:600}}>
            <svg width="12" height="12" viewBox="0 0 20 22" fill="none"><path d="M0.5 1.33L11.14 11L0.5 20.67V1.33Z" fill="#4285F4"/><path d="M14.5 7.5L2.5 0.5L11.14 11L14.5 7.5Z" fill="#34A853"/><path d="M14.5 14.5L11.14 11L2.5 21.5L14.5 14.5Z" fill="#FBBC04"/><path d="M19.5 11C19.5 10.17 19.07 9.43 18.41 9L14.5 7.5L11.14 11L14.5 14.5L18.41 13C19.07 12.57 19.5 11.83 19.5 11Z" fill="#EA4335"/></svg>
            Google Play
          </a>
          <a href="https://apps.apple.com/app/staircode/id6744870260" target="_blank" rel="noopener noreferrer"
            style={{display:'flex',alignItems:'center',gap:'0.3rem',padding:'0.3rem 0.6rem',background:'#000',border:'1px solid rgba(255,255,255,0.12)',borderRadius:8,textDecoration:'none',color:'#fff',fontSize:'0.6rem',fontWeight:600}}>
            <svg width="11" height="13" viewBox="0 0 18 22" fill="white"><path d="M14.93 11.62c-.02-2.45 2-3.63 2.09-3.69-1.14-1.67-2.91-1.9-3.54-1.93-1.51-.15-2.96.89-3.73.89-.78 0-1.97-.87-3.24-.85C4.79 6.07 3.2 7 2.35 8.43.59 11.33 1.89 15.63 3.59 18c.85 1.17 1.85 2.48 3.16 2.43 1.27-.05 1.75-.82 3.28-.82s1.97.82 3.3.79c1.36-.02 2.22-1.19 3.05-2.37.97-1.36 1.36-2.69 1.38-2.76-.03-.01-2.64-1.01-2.67-4.02l.04.37zM12.51 3.91c.7-.86 1.17-2.05 1.04-3.25-1.01.04-2.23.67-2.95 1.52-.65.74-1.22 1.94-1.07 3.08 1.13.09 2.28-.58 2.98-1.35z"/></svg>
            App Store
          </a>
        </div>

        {/* Return to marketing page — subtle */}
        <a href="/marketing"
          style={{display:'block',textAlign:'center',fontSize:'0.58rem',color:'rgba(44,90,122,0.4)',textDecoration:'none',marginTop:'0.35rem',letterSpacing:'0.03em'}}>
          ← staircode.app
        </a>

      </div>
    </div>
  )
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({active,onChange}:{active:Tab;onChange:(t:Tab)=>void}){
  return(
    <div style={{borderTop:'1.5px solid rgba(147,186,212,0.18)',background:'#FFFFFF',paddingBottom:'env(safe-area-inset-bottom,0px)',display:'flex'}}>
      {([
        {id:'home'     as Tab, label:'Home'},
        {id:'help'     as Tab, label:'AR / AI'},
        {id:'settings' as Tab, label:'Settings'},
      ] as {id:Tab;label:string}[]).map(t=>{
        const on=active===t.id
        return(
          <button key={t.id} onClick={()=>onChange(t.id)} style={{flex:1,padding:'0.7rem 0.4rem',background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.25rem'}}>
            <span style={{display:'flex',alignItems:'center',justifyContent:'center',opacity:on?1:0.38,transition:'opacity 0.15s'}}>
              {t.id==='home' && <Logo iconOnly size="xs" style={{opacity:on?1:0.35}} />}
              {t.id==='help' && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#2C5A7A" strokeWidth="1.8"/>
                  <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#2C5A7A" strokeWidth="1.8"/>
                  <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#2C5A7A" strokeWidth="1.8"/>
                  <circle cx="17.5" cy="17.5" r="3" stroke="#2C5A7A" strokeWidth="1.8"/>
                  <line x1="19.6" y1="19.6" x2="22" y2="22" stroke="#2C5A7A" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              )}
              {t.id==='settings' && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="3" stroke="#2C5A7A" strokeWidth="1.8"/>
                  <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#2C5A7A" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              )}
            </span>
            <span style={{fontSize:'0.62rem',fontWeight:on?700:400,color:on?'#2C5A7A':'rgba(44,74,110,0.5)',letterSpacing:'0.06em'}}>{t.label}</span>
            {on&&<div style={{width:4,height:4,borderRadius:'50%',background:C.blue,boxShadow:`0 0 6px ${C.blue}`}}/>}
          </button>
        )
      })}
    </div>
  )
}
