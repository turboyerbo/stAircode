'use client'
/**
 * page.tsx — StairCode authenticated app shell
 */
import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Logo, { BetaLogo } from './components/Logo'
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

const C = {
  dark:'#EEF3F9', card:'#FFFFFF', blue:'#007FFF', orange:'#FF7F00',
  pass:'#4A90E2', border:'rgba(44,90,122,0.16)', muted:'rgba(255,255,255,0.38)',
}

type Tab    = 'home'|'help'|'settings'
type Screen = 'home'|'scan_ready'|'scan_review'|'detect'|'capture'|'report'
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
    // 1. Restore from localStorage (instant — no flash)
    try{const s=localStorage.getItem('sc_user');if(s)setUser(JSON.parse(s))}catch{}
    // 2. Check live Supabase session (handles OAuth redirect return + token refresh)
    const sb = getSupabase()
    if (sb) {
      sb.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          const su = data.session.user
          const u: AppUser = {
            email: su.email ?? su.phone ?? '',
            name:  su.user_metadata?.full_name ?? su.email?.split('@')[0] ?? 'User',
            provider: (su.app_metadata?.provider ?? 'otp') as AppUser['provider'],
            membership: 'free',
            units: 'mm',
          }
          setUser(u)
          try { localStorage.setItem('sc_user', JSON.stringify(u)) } catch {}
          // Fire welcome email on first OAuth sign-in return
          maybeSendWelcome(u.email, u.name)
        }
      }).catch(() => {})
      // Listen for auth state changes (OAuth callback, sign-out)
      sb.auth.onAuthStateChange((event, session) => {
        if (!session) {
          setUser(null)
          try { localStorage.removeItem('sc_user') } catch {}
        } else if (event === 'SIGNED_IN' && session.user) {
          // Fires on OAuth redirect return — send welcome if first time
          const su = session.user
          const email = su.email ?? su.phone ?? ''
          const name  = su.user_metadata?.full_name ?? email.split('@')[0] ?? 'User'
          maybeSendWelcome(email, name)
        }
      })
    }
  },[])
  function handleAuth(u:AppUser){
    setUser(u)
    try{localStorage.setItem('sc_user',JSON.stringify(u))}catch{}
    identifyUser(u.email, { provider: u.provider, membership: u.membership })
    Analytics.userSignedIn(u.provider === 'otp' ? 'otp' : u.provider)
  }

  // Handle Stripe payment return (?payment=success&product=report|pro)
  useEffect(()=>{
    if(typeof window==='undefined') return
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    const product = params.get('product')
    if(payment==='success'){
      Analytics.purchaseCompleted(product as 'report'|'pro')
      if(product==='pro' && user){
        const upgraded = {...user, membership:'pro' as const}
        setUser(upgraded)
        try{localStorage.setItem('sc_user', JSON.stringify(upgraded))}catch{}
      }
      // Show payment success screen for all products — handled by PaymentSuccessScreen below
      // photo_report: leave URL params for ReportScreen's PhotoReportUpsell to detect
      if(product === 'pro' && user){
        const upgraded = {...user, membership:'pro' as const}
        setUser(upgraded)
        try{localStorage.setItem('sc_user', JSON.stringify(upgraded))}catch{}
      }
    }
    if(payment==='cancelled'){
      if(product) Analytics.purchaseCancelled(product as 'report'|'pro')
      // Clear payment params from URL — keep user on whatever screen they're on
      // sessionStorage still has sc_fields so ReportScreen state is preserved
      window.history.replaceState({}, '', '/')
    }
  },[user])
  function handleLogout(){
    Analytics.userSignedOut()
    resetUser()
    setUser(null)
    try{localStorage.removeItem('sc_user')}catch{}
  }
  function handleUpdateUser(u:AppUser){setUser(u);try{localStorage.setItem('sc_user',JSON.stringify(u))}catch{}}
  // ── Marketing redirect ────────────────────────────────────────────────────
  // Unauthenticated visitors go to /marketing unless ?signin=1 is present.
  // We use a state+useEffect pattern to avoid SSR/hydration mismatch.
  const [redirectChecked, setRedirectChecked] = React.useState(false)
  const [isSigninFlow,    setIsSigninFlow]    = React.useState(false)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const signin = params.get('signin') === '1'
    const payment = params.get('payment')
    // Never redirect away if returning from Stripe payment
    const isPaymentReturn = payment === 'success' || payment === 'cancelled'
    setIsSigninFlow(signin || isPaymentReturn)
    setRedirectChecked(true)
    if (!signin && !isPaymentReturn && !user) {
      // Hard redirect to marketing — no flicker, no hydration issue
      window.location.replace('/marketing')
    }
  }, []) // eslint-disable-line

  // While checking (or while redirecting), render nothing to avoid flash
  if (!redirectChecked) return null
  if (!user && !isSigninFlow) return null  // redirect in progress

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
  return <AppShell user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser}/>
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
function AppShell({user,onLogout,onUpdateUser}:{user:AppUser;onLogout:()=>void;onUpdateUser:(u:AppUser)=>void}){
  const [tab,setTab]=useState<Tab>('home')
  const [screen,setScreen]=useState<Screen>('home')
  const [activeModule, setActiveModule] = useState<'stair'|'foundation'|'accessibility'>('stair')
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
    <div style={{minHeight:'100dvh',background:C.dark,color:'#fff',display:'flex',flexDirection:'column',maxWidth:430,margin:'0 auto',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}><div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>{tab==='home'&&<HomeTab user={user} loc={loc} locLoading={locLoading} code={code} onStartScan={(mod)=>{setTab('home');setActiveModule(mod);Analytics.scanStarted({role:user.role,codeLabel:code?.label,location:loc?`${loc.city}${loc.province?', '+loc.province:''}`:undefined,scanMode:mod});setScreen('scan_ready')}} onLogout={onLogout} activeModule={activeModule} onModuleChange={m=>{setActiveModule(m)}}/>}
        {tab==='help'&&<HelpScreen/>}
        {tab==='settings'&&<SettingsScreen user={user} onLogout={onLogout} onUpdateUser={onUpdateUser}/>}
      </div>
      <BottomNav active={tab} onChange={t=>{setTab(t);if(t!=='home')setScreen('home');if(t==='help')Analytics.helpViewed();if(t==='settings')Analytics.settingsViewed()}}/>
    </div>
  )
}

// ── Home Tab ──────────────────────────────────────────────────────────────────
function HomeTab({user,loc,locLoading,code,onStartScan,onLogout,activeModule,onModuleChange}:{user:AppUser;loc:Loc|null;locLoading:boolean;code:Code|null;onStartScan:(mod:'stair'|'foundation'|'accessibility')=>void;onLogout:()=>void;activeModule:'stair'|'foundation'|'accessibility';onModuleChange:(m:'stair'|'foundation'|'accessibility')=>void}){
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
    <div style={{flex:1,display:'flex',flexDirection:'column'}}>{/* Hero */}
      <div style={{background:'linear-gradient(160deg,#0D2B45 0%,#0A1F33 55%,#0D2B45 100%)',padding:'max(env(safe-area-inset-top,0px),1.8rem) 1.4rem 1.8rem',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.5rem',borderBottom:`1px solid ${C.border}`}}><div style={{display:'flex',justifyContent:'center'}}><BetaLogo size="md" onDark /></div>
        <h1 style={{fontSize:'1.5rem',fontWeight:700,lineHeight:1.2,textAlign:'center',margin:0,color:'#fff'}}>Building Compliance Scanner</h1>
        <p style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.55)',textAlign:'center',margin:0}}>Welcome back, {user.name.split(' ')[0]}</p>
      </div>

      <div style={{flex:1,padding:'1.25rem',display:'flex',flexDirection:'column',gap:'0.8rem',background:'#EBF3FA'}}>{/* Location card */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'0.9rem 1rem',display:'flex',flexDirection:'column',gap:'0.45rem'}}><div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}><div style={{width:8,height:8,borderRadius:'50%',background:locLoading?'#F29337':confirmed?C.pass:'rgba(167,177,194,0.4)',boxShadow:locLoading?'0 0 0 3px rgba(242,147,55,0.2)':confirmed?'0 0 0 3px rgba(74,144,226,0.2)':'none'}}/>
            <span style={{fontSize:'0.8rem',color:'#0A1C2E',fontWeight:600}}>{locLoading?'Detecting location…':locStr}</span>
          </div>
          {!locLoading&&code&&(
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontSize:'0.68rem',color:'#2C4A6E',fontWeight:500}}>{code.code==='OBC' && <>Building Codes: <a href="https://www.ontario.ca/laws/statute/92b23" target="_blank" rel="noopener noreferrer" style={{color:'#417CA4',fontWeight:600}}>OBC</a> · <a href="https://www.toronto.ca/city-government/planning-development/official-plan-guidelines/zoning-by-law/" target="_blank" rel="noopener noreferrer" style={{color:'#417CA4',fontWeight:600}}>Toronto Bylaw</a> · <a href="https://www.ontario.ca/laws/statute/05a11" target="_blank" rel="noopener noreferrer" style={{color:'#417CA4',fontWeight:600}}>AODA</a></>}
                {code.code==='NBC' && <>Building Codes: <a href="https://www.nrc-cnrc.gc.ca/eng/publications/codes_centre/2020_national_building_code.html" target="_blank" rel="noopener noreferrer" style={{color:'#417CA4',fontWeight:600}}>NBC 2020</a></>}
                {code.code==='IBC' && <>Building Codes: <a href="https://codes.iccsafe.org/content/IBC2021" target="_blank" rel="noopener noreferrer" style={{color:'#417CA4',fontWeight:600}}>IBC 2021</a></>}
                {code.code!=='OBC'&&code.code!=='NBC'&&code.code!=='IBC' && <span>{code.ref}</span>}
              </span>
              <span style={{fontSize:'0.65rem',fontWeight:600,letterSpacing:'0.08em',color:confirmed?'#0D7A5F':'#2C5A7A',background:confirmed?'#E6F5F1':'#EBF2FF',padding:'0.22rem 0.65rem',borderRadius:8,border:`1px solid ${confirmed?'rgba(13,122,95,0.3)':'rgba(44,90,122,0.25)'}`}}>{code.label}</span>
            </div>
          )}
        </div>

        {/* ── MODULE SELECTOR ── */}
        <div style={{display:'flex',flexDirection:'column',gap:'0.4rem'}}>
          <div style={{fontSize:'0.68rem',fontWeight:600,color:'#5E7D9B',marginBottom:'0.15rem',letterSpacing:'0.02em'}}>Inspection module</div>

          {/* Stair Compliance */}
          <button
            onClick={()=>{ if(!atLimit) onStartScan('stair') }}
            style={{width:'100%',padding:'0.85rem 1rem',background:activeModule==='stair'?'#F0FBF6':'#FFFFFF',border:`1.5px solid ${activeModule==='stair'?'#27A96B':'rgba(44,90,122,0.15)'}`,borderRadius:10,display:'flex',alignItems:'center',gap:'0.75rem',cursor:'pointer',textAlign:'left',transition:'all 0.12s'}}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{flexShrink:0,opacity:activeModule==='stair'?1:0.5}}>
              <rect x="1" y="12" width="5" height="7" rx="0.5" stroke="#27A96B" strokeWidth="1.5"/>
              <rect x="6" y="7" width="5" height="12" rx="0.5" stroke="#27A96B" strokeWidth="1.5"/>
              <rect x="11" y="1" width="8" height="18" rx="0.5" stroke="#27A96B" strokeWidth="1.5"/>
            </svg>
            <div style={{flex:1}}>
              <div style={{fontSize:'0.875rem',fontWeight:600,color:'#0D1E2E',lineHeight:1.3}}>Stair Compliance</div>
              <div style={{fontSize:'0.72rem',color:'#5E7D9B',marginTop:'0.1rem'}}>Rise, run, headroom, width, nosing, handrail</div>
            </div>
            <span style={{fontSize:'0.62rem',fontWeight:600,color:'#27A96B',padding:'0.2rem 0.5rem',borderRadius:4,border:'1px solid rgba(39,169,107,0.35)',flexShrink:0}}>Beta</span>
          </button>

          {/* Foundation Inspection */}
          <button
            onClick={()=>{ if(!atLimit) onStartScan('foundation') }}
            style={{width:'100%',padding:'0.85rem 1rem',background:activeModule==='foundation'?'#EEF4FB':'#FFFFFF',border:`1.5px solid ${activeModule==='foundation'?'#417CA4':'rgba(44,90,122,0.15)'}`,borderRadius:10,display:'flex',alignItems:'center',gap:'0.75rem',cursor:'pointer',textAlign:'left',transition:'all 0.12s'}}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{flexShrink:0,opacity:activeModule==='foundation'?1:0.5}}>
              <rect x="3" y="2" width="14" height="11" rx="0.5" stroke="#417CA4" strokeWidth="1.5"/>
              <rect x="1" y="13" width="18" height="6" rx="0.5" stroke="#417CA4" strokeWidth="1.5"/>
              <line x1="3" y1="6" x2="17" y2="6" stroke="#417CA4" strokeWidth="1"/>
              <line x1="3" y1="10" x2="17" y2="10" stroke="#417CA4" strokeWidth="1"/>
            </svg>
            <div style={{flex:1}}>
              <div style={{fontSize:'0.875rem',fontWeight:600,color:'#0D1E2E',lineHeight:1.3}}>Foundation Inspection</div>
              <div style={{fontSize:'0.72rem',color:'#5E7D9B',marginTop:'0.1rem'}}>Wall type, cracks, thickness, footing, moisture</div>
            </div>
            <span style={{fontSize:'0.62rem',fontWeight:600,color:'#417CA4',padding:'0.2rem 0.5rem',borderRadius:4,border:'1px solid rgba(65,124,164,0.35)',flexShrink:0}}>Beta</span>
          </button>

          {/* Accessibility Compliance */}
          <button
            onClick={()=>{ if(!atLimit) onStartScan('accessibility') }}
            style={{width:'100%',padding:'0.85rem 1rem',background:activeModule==='accessibility'?'#F4F1FA':'#FFFFFF',border:`1.5px solid ${activeModule==='accessibility'?'#7B5EA7':'rgba(44,90,122,0.15)'}`,borderRadius:10,display:'flex',alignItems:'center',gap:'0.75rem',cursor:'pointer',textAlign:'left',transition:'all 0.12s'}}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{flexShrink:0,opacity:activeModule==='accessibility'?1:0.5}}>
              <circle cx="10" cy="4" r="2" stroke="#7B5EA7" strokeWidth="1.5"/>
              <path d="M10 6.5v5.5l-3.5 3.5M10 12l3.5 3.5" stroke="#7B5EA7" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="5" y1="20" x2="5" y2="15" stroke="#7B5EA7" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="15" y1="20" x2="15" y2="15" stroke="#7B5EA7" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div style={{flex:1}}>
              <div style={{fontSize:'0.875rem',fontWeight:600,color:'#0D1E2E',lineHeight:1.3}}>Accessibility Compliance</div>
              <div style={{fontSize:'0.72rem',color:'#5E7D9B',marginTop:'0.1rem'}}>Paths, washrooms, alarms, seating — OBC 2024</div>
            </div>
            <span style={{fontSize:'0.62rem',fontWeight:600,color:'#7B5EA7',padding:'0.2rem 0.5rem',borderRadius:4,border:'1px solid rgba(123,94,167,0.35)',flexShrink:0}}>Beta</span>
          </button>

          {/* Coming-soon modules — greyed */}
          {[
            {name:'Guardrails & Handrails',desc:'Height, baluster spacing, graspability'},
            {name:'Windows',desc:'Egress openings, sill heights, well dimensions'},
            {name:'Smoke & CO Detectors',desc:'Placement, distance-to-ceiling, spacing'},
          ].map(mod=>(
            <div key={mod.name} style={{width:'100%',padding:'0.75rem 1rem',background:'rgba(0,0,0,0.02)',border:'1px solid rgba(44,90,122,0.1)',borderRadius:10,display:'flex',alignItems:'center',gap:'0.75rem',opacity:0.5}}>
              <div style={{width:20,height:20,borderRadius:4,background:'rgba(44,90,122,0.06)',flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:'0.82rem',fontWeight:500,color:'#7A96AF',lineHeight:1.2}}>{mod.name}</div>
                <div style={{fontSize:'0.68rem',color:'#9DB4C5',marginTop:'0.1rem'}}>{mod.desc}</div>
              </div>
              <span style={{fontSize:'0.62rem',fontWeight:500,color:'#9DB4C5',padding:'0.18rem 0.5rem',borderRadius:4,border:'1px solid rgba(147,186,212,0.2)',flexShrink:0}}>Soon</span>
            </div>
          ))}
        </div>

        {/* Limit warning */}
        {atLimit && (
          <div style={{background:'rgba(232,69,69,0.08)',border:'1.5px solid rgba(232,69,69,0.3)',borderRadius:12,padding:'0.75rem 1rem',display:'flex',gap:'0.65rem',alignItems:'flex-start'}}><div>
              <div style={{fontSize:'0.82rem',fontWeight:800,color:'#E84545',marginBottom:'0.2rem'}}>Free scans used up</div>
              <div style={{fontSize:'0.68rem',color:'#2C4A6E',lineHeight:1.55}}>You&apos;ve used all 3 free scans. Upgrade to Pro for unlimited inspections, or complete one more scan to generate a report first.
              </div>
            </div>
          </div>
        )}

        <div style={{flex:1}}/>

        <p style={{textAlign:'center',fontSize:'0.6rem',color:'#2C5A7A',lineHeight:1.5,margin:0}}>Compliance aid only · Not a substitute for professional inspection
        </p>

        {/* Social + store buttons — official logos */}
        <div style={{display:'flex',flexDirection:'column',gap:'0.55rem',marginTop:'0.9rem',width:'100%',maxWidth:340,alignSelf:'center'}}>{/* Row 1: Instagram + Facebook */}
          <div style={{display:'flex',gap:'0.5rem'}}><a href="https://www.instagram.com/staircode/" target="_blank" rel="noopener noreferrer"
              style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'0.45rem',padding:'0.55rem 0.75rem',background:'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)',border:'none',borderRadius:12,textDecoration:'none',color:'#fff',fontSize:'0.72rem',fontWeight:700}}><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              Instagram
            </a>
            <a href="https://www.facebook.com/people/Staircode/61589350702805/" target="_blank" rel="noopener noreferrer"
              style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'0.45rem',padding:'0.55rem 0.75rem',background:'#1877F2',border:'none',borderRadius:12,textDecoration:'none',color:'#fff',fontSize:'0.72rem',fontWeight:700}}><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook
            </a>
          </div>

          {/* Row 2: Google Play */}
          <a href="https://play.google.com/store/apps/details?id=app.staircode.android&pcampaignid=web_share" target="_blank" rel="noopener noreferrer"
            style={{display:'flex',alignItems:'center',gap:'0.65rem',padding:'0.6rem 1rem',background:'#000',border:'1px solid rgba(255,255,255,0.12)',borderRadius:12,textDecoration:'none'}}><svg width="22" height="24" viewBox="0 0 22 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.5 0.8L12.7 12L1.5 23.2V0.8Z" fill="#4285F4"/>
              <path d="M16.5 8L2.5 0L12.7 12L16.5 8Z" fill="#34A853"/>
              <path d="M16.5 16L12.7 12L2.5 24L16.5 16Z" fill="#FBBC04"/>
              <path d="M21.5 12C21.5 11.1 21.1 10.3 20.4 9.8L16.5 8L12.7 12L16.5 16L20.4 14.2C21.1 13.7 21.5 12.9 21.5 12Z" fill="#EA4335"/>
            </svg>
            <div>
              <div style={{fontSize:'0.5rem',color:'rgba(255,255,255,0.6)',letterSpacing:'0.05em',lineHeight:1}}>GET IT ON</div>
              <div style={{fontSize:'0.88rem',fontWeight:700,color:'#fff',lineHeight:1.3,letterSpacing:'-0.01em'}}>Google Play</div>
            </div>
          </a>

          {/* Row 3: App Store */}
          <a href="https://apps.apple.com/app/staircode/id6744870260" target="_blank" rel="noopener noreferrer"
            style={{display:'flex',alignItems:'center',gap:'0.65rem',padding:'0.6rem 1rem',background:'#000',border:'1px solid rgba(255,255,255,0.12)',borderRadius:12,textDecoration:'none'}}><svg width="20" height="24" viewBox="0 0 20 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M16.93 12.62c-.02-2.45 2-3.63 2.09-3.69-1.14-1.67-2.91-1.9-3.54-1.93-1.51-.15-2.96.89-3.73.89-.78 0-1.97-.87-3.24-.85C6.79 7.07 5.2 8 4.35 9.43 2.59 12.33 3.89 16.63 5.59 19c.85 1.17 1.85 2.48 3.16 2.43 1.27-.05 1.75-.82 3.28-.82s1.97.82 3.3.79c1.36-.02 2.22-1.19 3.05-2.37.97-1.36 1.36-2.69 1.38-2.76-.03-.01-2.64-1.01-2.67-4.02l.04.37zM14.51 4.91c.7-.86 1.17-2.05 1.04-3.25-1.01.04-2.23.67-2.95 1.52-.65.74-1.22 1.94-1.07 3.08 1.13.09 2.28-.58 2.98-1.35z"/>
            </svg>
            <div>
              <div style={{fontSize:'0.5rem',color:'rgba(255,255,255,0.6)',letterSpacing:'0.05em',lineHeight:1}}>DOWNLOAD ON THE</div>
              <div style={{fontSize:'0.88rem',fontWeight:700,color:'#fff',lineHeight:1.3,letterSpacing:'-0.01em'}}>App Store</div>
            </div>
          </a>

          {/* About link */}
          <a href="/marketing"
            style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.4rem',padding:'0.45rem 0.9rem',background:'rgba(65,124,164,0.08)',border:'1px solid rgba(65,124,164,0.2)',borderRadius:20,textDecoration:'none',color:'#2C5A7A',fontSize:'0.65rem',fontWeight:600,alignSelf:'center'}}>About stAIrcode
          </a>
        </div>

        <button onClick={onLogout} style={{display:'block',margin:'0.6rem auto 0',background:'rgba(65,124,164,0.10)',border:'1px solid rgba(65,124,164,0.25)',color:'#2C5A7A',fontSize:'0.65rem',cursor:'pointer',letterSpacing:'0.08em',padding:'0.3rem 1rem',borderRadius:20,fontWeight:600}}>↩ Sign out
        </button>
      </div>
    </div>
  )
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({active,onChange}:{active:Tab;onChange:(t:Tab)=>void}){
  return(
    <div style={{borderTop:'1.5px solid rgba(147,186,212,0.18)',background:'#FFFFFF',paddingBottom:'env(safe-area-inset-bottom,0px)',display:'flex'}}>
      {([
        {id:'home'     as Tab, label:'Welcome'},
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
