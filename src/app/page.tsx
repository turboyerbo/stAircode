'use client'
/**
 * page.tsx — StairCode authenticated app shell
 */
import React, { useState, useEffect, useCallback } from 'react'
import Logo, { BetaLogo } from './components/Logo'
import AuthScreen,      { AppUser, UserRole } from './components/AuthScreen'
import { initAnalytics, identifyUser, resetUser, Analytics } from '@/lib/analytics'
import HelpScreen                            from './components/HelpScreen'
import SettingsScreen                        from './components/SettingsScreen'
import ScanReadyScreen                       from './components/ScanReadyScreen'
import ReportScreen                          from './components/ReportScreen'

const C = {
  dark:'#EEF3F9', card:'#FFFFFF', blue:'#007FFF', orange:'#FF7F00',
  pass:'#4A90E2', border:'rgba(44,90,122,0.16)', muted:'rgba(255,255,255,0.38)',
}

type Tab    = 'home'|'help'|'settings'
type Screen = 'home'|'scan_ready'|'detect'|'capture'|'report'
interface StairMeasurements {
  rise: number|null; run: number|null; width: number|null
  nosing: number|null; headroom: number|null|'clear'; guard: number|null
  confidence?: number; calibrated?: boolean
  riserCount?: number; handrailOneSide?: boolean; handrailBothSides?: boolean
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
  return[
    {label:'Rise',    icon:'↕',value:m.rise,   min:L.riserMin,max:L.riserMax,
     pass:m.rise?m.rise>=L.riserMin&&m.rise<=L.riserMax:null},
    {label:'Run',     icon:'↔',value:m.run,    min:L.runMin,
     pass:m.run?m.run>=L.runMin:null},
    {label:'Nosing',  icon:'⌐',value:m.nosing, min:L.nosingMin,max:L.nosingMax,
     pass:m.nosing&&L.nosingMin?(+m.nosing)>=(L.nosingMin||0)&&(+m.nosing)<=(L.nosingMax||99):null},
    {label:'Width',   icon:'⟺',value:m.width,  min:L.widthMin,
     pass:m.width?m.width>=L.widthMin:null},
    {label:'Headroom',icon:'⇳',value:m.headroom==='clear'?null:m.headroom,min:L.headMin,clearAbove:m.headroom==='clear',
     pass:m.headroom==='clear'?true:m.headroom?(+m.headroom)>=L.headMin:null} as any,
    {label:'Guard Ht',icon:'⊤',value:m.guard,  min:L.guardMin,
     pass:m.guard?m.guard>=L.guardMin:null},
  ]
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
      <img
        src="/AR_guided_inspection.png"
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
      }}>
        <div style={{
          fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)',
          fontFamily: 'monospace', letterSpacing: '0.2em',
          animation: 'pulse 2s ease-in-out infinite',
        }}>
          TAP TO CONTINUE
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
  const [splashFading, setSplashFading] = useState(false)
  // Legal disclaimer agreement — must be declared here (before any early returns)
  const [legalAgreed, setLegalAgreed] = useState<boolean>(()=>{
    try{ return typeof window !== 'undefined' && localStorage.getItem('sc_legal_agreed') === '1' }
    catch{ return false }
  })
  useEffect(()=>{
    // Init PostHog analytics
    initAnalytics()
    // 1. Restore from localStorage (instant — no flash)
    try{const s=localStorage.getItem('sc_user');if(s)setUser(JSON.parse(s))}catch{}
    // 2. Check live Supabase session (handles OAuth redirect return + token refresh)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supabaseUrl && supabaseKey) {
      import('@supabase/supabase-js').then(({ createClient }) => {
        const sb = createClient(supabaseUrl, supabaseKey)
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
          }
        })
        // Listen for auth state changes (OAuth callback, sign-out)
        sb.auth.onAuthStateChange((_event, session) => {
          if (!session) { setUser(null); try { localStorage.removeItem('sc_user') } catch {} }
        })
      }).catch(() => {})
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
      // Clean URL
      window.history.replaceState({}, '', '/')
      if(product==='pro' && user){
        // Upgrade user membership in state + localStorage
        const upgraded = {...user, membership:'pro' as const}
        setUser(upgraded)
        try{localStorage.setItem('sc_user', JSON.stringify(upgraded))}catch{}
      }
      // Show success toast (brief alert — replace with a toast component if desired)
      if(product==='report'){
        setTimeout(()=>alert('✅ Payment successful! Your full compliance report has been sent to your email.'), 500)
      } else if(product==='pro'){
        setTimeout(()=>alert('🎉 Welcome to Staircode Pro! Your subscription is now active.'), 500)
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
  }
  function handleUpdateUser(u:AppUser){setUser(u);try{localStorage.setItem('sc_user',JSON.stringify(u))}catch{}}
  // Show splash on first visit, then fade into auth
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
    <div style={{minHeight:'100dvh',background:'#0A1C2E',backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px),repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem 1.25rem',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{display:'flex',justifyContent:'center',marginBottom:'1.25rem'}}><Logo size="md" onDark /></div>
      <div style={{width:'100%',maxWidth:420,background:'#0F2438',border:'1px solid rgba(65,124,164,0.20)',borderRadius:20,overflow:'hidden'}}>
        {/* Header */}
        <div style={{background:'#F29337',padding:'1rem 1.25rem',display:'flex',alignItems:'center',gap:'0.6rem'}}>
          <span style={{fontSize:'1.2rem'}}>⚖️</span>
          <div>
            <div style={{fontSize:'0.95rem',fontWeight:900,color:'#fff',letterSpacing:'-0.01em'}}>Terms of Use & Disclaimer</div>
            <div style={{fontSize:'0.65rem',color:'rgba(255,255,255,0.8)',marginTop:'0.1rem'}}>Please read before continuing</div>
          </div>
        </div>
        {/* Body */}
        <div style={{padding:'1.25rem',maxHeight:'55dvh',overflowY:'auto'}}>
          <p style={{fontSize:'0.75rem',color:'#E8F4FF',lineHeight:1.75,margin:'0 0 0.85rem'}}>
            <strong style={{color:'#F29337'}}>stAIrcode is a visual aid only</strong> — it is not a building inspection tool and does not determine whether any staircase is legally compliant with any building code.
          </p>
          <p style={{fontSize:'0.75rem',color:'#93BAD4',lineHeight:1.75,margin:'0 0 0.85rem'}}>
            All measurements are AI estimates from camera images. Accuracy is limited by lighting, angle, and image quality — typical error is <strong style={{color:'#E8F4FF'}}>±10–25mm or greater</strong>. Results must not be used for construction, permit applications, safety certification, or legal proceedings.
          </p>
          <p style={{fontSize:'0.75rem',color:'#93BAD4',lineHeight:1.75,margin:'0 0 0.85rem'}}>
            Only a <strong style={{color:'#E8F4FF'}}>licensed building inspector, professional engineer, or registered architect</strong> using calibrated equipment can produce legally valid measurements. Always consult a qualified professional before making compliance decisions.
          </p>
          <p style={{fontSize:'0.75rem',color:'#93BAD4',lineHeight:1.75,margin:'0 0 0.85rem'}}>
            Building codes referenced are indicative only. Consult the applicable Authority Having Jurisdiction (AHJ) for binding requirements.
          </p>
          <p style={{fontSize:'0.7rem',color:'#4E7A9B',lineHeight:1.6,margin:0}}>
            <strong style={{color:'#93BAD4'}}>Limitation of Liability:</strong> Just Open Technologies Inc., its officers, directors, and employees accept no liability for any loss, damage, injury, or consequence arising from use of this application. Use is entirely at your own risk.
          </p>
        </div>
        {/* Agree checkbox */}
        <div style={{padding:'1rem 1.25rem',borderTop:'1px solid rgba(65,124,164,0.15)',display:'flex',alignItems:'flex-start',gap:'0.75rem',cursor:'pointer'}} onClick={()=>setChecked(v=>!v)}>
          <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${checked?'#27A96B':'rgba(147,186,212,0.4)'}`,background:checked?'#27A96B':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2,transition:'all 0.15s'}}>
            {checked&&<span style={{color:'#fff',fontSize:'0.75rem',lineHeight:1}}>✓</span>}
          </div>
          <span style={{fontSize:'0.76rem',color:'#E8F4FF',lineHeight:1.55}}>
            I understand that stAIrcode is a visual aid only and not a professional compliance tool. I agree to the{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:'#F29337',fontWeight:600}}>Terms of Service</a>.
          </span>
        </div>
        {/* CTA */}
        <div style={{padding:'0 1.25rem 1.25rem'}}>
          <button
            onClick={()=>{ if(checked)onAgree() }}
            disabled={!checked}
            style={{width:'100%',padding:'1rem',background:checked?'linear-gradient(135deg,#27A96B,#1A7A50)':'rgba(255,255,255,0.06)',border:'none',borderRadius:14,color:checked?'#fff':'#4E7A9B',fontSize:'0.95rem',fontWeight:800,fontFamily:'monospace',letterSpacing:'0.06em',cursor:checked?'pointer':'not-allowed',boxShadow:checked?'0 4px 20px rgba(39,169,107,0.4)':'none',transition:'all 0.2s'}}
          >
            {checked?'✓ I Agree — Continue →':'Check the box above to continue'}
          </button>
        </div>
        <div style={{padding:'0 1.25rem 1rem',textAlign:'center'}}>
          <span style={{fontSize:'0.6rem',color:'#4E7A9B'}}>stAIrcode — Just Open Technologies Inc. · info@staircode.app</span>
        </div>
      </div>
    </div>
  )
}

// ── App Shell ─────────────────────────────────────────────────────────────────
function AppShell({user,onLogout,onUpdateUser}:{user:AppUser;onLogout:()=>void;onUpdateUser:(u:AppUser)=>void}){
  const [tab,setTab]=useState<Tab>('home')
  const [screen,setScreen]=useState<Screen>('home')
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
    }
    const measurementCount = (['rise','run','width','guard'] as const).filter(k => n(k) !== null).length
    Analytics.scanCompleted({ role: user?.role ?? 'diy', measurementCount, hasFailed: false })
    // Persist captured frames for report email embedding
    if (raw._frames) {
      try {
        const u = JSON.parse(localStorage.getItem('sc_user') || '{}')
        u._frames = raw._frames
        localStorage.setItem('sc_user', JSON.stringify(u))
      } catch {}
    }
    setMeasurements(m)
    setScreen('report')
  },[user])
  // handleDetectComplete removed — detect/capture screens deprecated,[])
  // handleCaptureComplete removed — capture screen deprecated
  const handleStartOver=useCallback(()=>{setMeasurements(null);setScreen('home')},[])
  const handleRetake=useCallback(()=>{
    // Clear measurements and go back to scan
    // Small delay ensures old camera stream is fully released before new one requests it
    setMeasurements(null)
    setScreen('scan_ready')
  },[])

  // Full-screen flows (no bottom nav)

  if(screen==='scan_ready')return <ScanReadyScreen userRole={user.role} onSuccess={handleScanSuccess as (m:Record<string,number|string>)=>void} onBack={()=>setScreen('home')}/>
  // Use IBC as fallback if code not yet detected (location loading)
  const activeCode = code ?? {code:'IBC',label:'IBC 2021',ref:'§1011',reason:'International Building Code',limits:{riserMin:100,riserMax:178,runMin:279,widthMin:914,headMin:2032,guardMin:914}}
  if(screen==='report'&&measurements)return <ReportScreen measurements={measurements} fields={check(measurements,activeCode)} codeLabel={activeCode.label} codeRef={activeCode.ref} location={loc?`${loc.city}${loc.province?', '+loc.province:''}`:''}  userLatLng={latLng} isOntario={loc?isOntario(loc):false} userRole={user?.role} onRetake={handleRetake} onStartOver={handleStartOver}/>

  return(
    <div style={{minHeight:'100dvh',background:C.dark,color:'#fff',display:'flex',flexDirection:'column',maxWidth:430,margin:'0 auto',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>
        {tab==='home'&&<HomeTab user={user} loc={loc} locLoading={locLoading} code={code} onStartScan={()=>{setTab('home');Analytics.scanStarted({role:user.role,codeLabel:code?.label,location:loc?`${loc.city}${loc.province?', '+loc.province:''}`:undefined});setScreen('scan_ready')}} onLogout={onLogout}/>}
        {tab==='help'&&<HelpScreen/>}
        {tab==='settings'&&<SettingsScreen user={user} onLogout={onLogout} onUpdateUser={onUpdateUser}/>}
      </div>
      <BottomNav active={tab} onChange={t=>{setTab(t);if(t!=='home')setScreen('home');if(t==='help')Analytics.helpViewed();if(t==='settings')Analytics.settingsViewed()}}/>
    </div>
  )
}

// ── Home Tab ──────────────────────────────────────────────────────────────────
function HomeTab({user,loc,locLoading,code,onStartScan,onLogout}:{user:AppUser;loc:Loc|null;locLoading:boolean;code:Code|null;onStartScan:()=>void;onLogout:()=>void}){
  const confirmed=!locLoading&&loc!=null&&isOntario(loc)
  const locStr=loc?`${loc.city}${loc.province?', '+loc.province:''}`:locLoading?'Detecting location…':'Location unavailable'
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column'}}>
      {/* Hero */}
      <div style={{background:'linear-gradient(160deg,#0D2B45 0%,#0A1F33 55%,#0D2B45 100%)',padding:'max(env(safe-area-inset-top,0px),1.8rem) 1.4rem 1.8rem',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.5rem',borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',justifyContent:'center'}}><BetaLogo size="md" onDark /></div>
        <h1 style={{fontSize:'1.65rem',fontWeight:800,lineHeight:1.1,textAlign:'center',margin:0,letterSpacing:'-0.02em'}}>
          Stair <span style={{color:'#ffffff',textShadow:`0 0 28px ${C.orange}88`}}>Pre-Assessment</span>
        </h1>
        <p style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.55)',textAlign:'center',margin:0}}>Welcome back, {user.name.split(' ')[0]}</p>
      </div>

      <div style={{flex:1,padding:'1.25rem',display:'flex',flexDirection:'column',gap:'0.8rem',background:'#EBF3FA'}}>
        {/* Location card */}
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
              <span style={{fontSize:'0.65rem',fontFamily:'monospace',fontWeight:600,letterSpacing:'0.08em',color:confirmed?'#0D7A5F':'#2C5A7A',background:confirmed?'#E6F5F1':'#EBF2FF',padding:'0.22rem 0.65rem',borderRadius:8,border:`1px solid ${confirmed?'rgba(13,122,95,0.3)':'rgba(44,90,122,0.25)'}`}}>{code.label}</span>
            </div>
          )}
        </div>

        {/* Steps strip */}
        <div style={{display:'flex',gap:'0.4rem'}}>
          {[{n:'1',label:locLoading?'Detecting…':code?.label??'Code loaded',done:!locLoading},{n:'2',label:'AI measures stairs',done:false},{n:'3',label:'Compliance report',done:false}].map(({n,label,done})=>(
            <div key={n} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'0.3rem',padding:'0.6rem 0.3rem',background:'#FFFFFF',borderRadius:10,border:'1px solid rgba(44,90,122,0.15)',boxShadow:'0 1px 4px rgba(44,90,122,0.06)'}}>
              <div style={{width:24,height:24,borderRadius:'50%',background:done?C.pass:'#2C5A7A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.68rem',fontFamily:'monospace',fontWeight:700,color:'#fff',border:'none'}}>{done?'✓':n}</div>
              <span style={{fontSize:'0.62rem',color:'#2C4A6E',textAlign:'center',lineHeight:1.3,fontFamily:'monospace',fontWeight:500}}>{label}</span>
            </div>
          ))}
        </div>

        {/* Membership badge */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.65rem 0.9rem',background:'#EBF2FF',border:'1.5px solid rgba(44,90,122,0.22)',borderRadius:10}}>
          <span style={{fontSize:'0.75rem',color:'#2C5A7A',fontWeight:500}}>
            ⭐ &nbsp;{user.membership==='free'?'Beta':user.membership==='pro'?'Pro plan':'Enterprise'}
          </span>
          <span style={{fontSize:'0.65rem',color:'#2C4A6E',fontWeight:500}}>{user.units==='mm'?'mm':'ft/in'}</span>
        </div>

        <div style={{flex:1}}/>

        {/* CTA */}
        <button onClick={onStartScan} style={{width:'100%',padding:'1.15rem',background:'#F29337',border:'none',borderRadius:16,color:'#fff',fontSize:'1rem',fontFamily:"'Inter',sans-serif",fontWeight:800,letterSpacing:'0.06em',cursor:'pointer',boxShadow:'0 6px 32px rgba(242,147,55,0.45)',transition:'all 0.2s'}}>
          ● Start Scan
        </button>

        <p style={{textAlign:'center',fontSize:'0.6rem',color:'#2C5A7A',lineHeight:1.5,fontFamily:'monospace',margin:0}}>
          Pre-analysis only · Not a substitute for professional inspection
        </p>
        <button onClick={onLogout} style={{display:'block',margin:'0.75rem auto 0',background:'rgba(65,124,164,0.10)',border:'1px solid rgba(65,124,164,0.25)',color:'#2C5A7A',fontSize:'0.65rem',fontFamily:'monospace',cursor:'pointer',letterSpacing:'0.08em',padding:'0.3rem 1rem',borderRadius:20,fontWeight:600}}>
          ↩ Sign out
        </button>
      </div>
    </div>
  )
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({active,onChange}:{active:Tab;onChange:(t:Tab)=>void}){
  const tabs=[{id:'home' as Tab,icon:'logo',label:'Welcome'},{id:'help' as Tab,icon:'🤖',label:'AR / AI'},{id:'settings' as Tab,icon:'⚙️',label:'Settings'}]
  return(
    <div style={{borderTop:'1.5px solid rgba(147,186,212,0.18)',background:'#FFFFFF',paddingBottom:'env(safe-area-inset-bottom,0px)',display:'flex'}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>onChange(t.id)} style={{flex:1,padding:'0.7rem 0.4rem',background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.2rem'}}>
          <span style={{fontSize:'1.25rem',opacity:active===t.id?1:0.38,transition:'all 0.15s',display:'flex',alignItems:'center',justifyContent:'center'}}>
            {t.icon==='logo'
              ? <Logo iconOnly size="xs" style={{opacity: active==='home' ? 1 : 0.35}} />
              : t.icon}
          </span>
          <span style={{fontSize:'0.62rem',fontFamily:'monospace',fontWeight:active===t.id?700:400,color:active===t.id?'#2C5A7A':'rgba(44,74,110,0.5)',letterSpacing:'0.06em'}}>{t.label}</span>
          {active===t.id&&<div style={{width:4,height:4,borderRadius:'50%',background:C.blue,boxShadow:`0 0 6px ${C.blue}`}}/>}
        </button>
      ))}
    </div>
  )
}
