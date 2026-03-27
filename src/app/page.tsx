'use client'
/**
 * page.tsx — StairCode authenticated app shell
 */
import { useState, useEffect, useCallback } from 'react'
import AuthScreen,      { AppUser, UserRole } from './components/AuthScreen'
import RoleSelectScreen                        from './components/RoleSelectScreen'
import { initAnalytics, identifyUser, resetUser, Analytics } from '@/lib/analytics'
import HelpScreen                            from './components/HelpScreen'
import SettingsScreen                        from './components/SettingsScreen'
import ScanReadyScreen                       from './components/ScanReadyScreen'
import StairDetect,     { DetectResult }     from './components/StairDetect'
import MeasureWalk,     { StairMeasurements }from './components/MeasureWalk'
import ReportScreen                          from './components/ReportScreen'

const C = {
  dark:'#EEF3F9', card:'#FFFFFF', blue:'#007FFF', orange:'#FF7F00',
  pass:'#4A90E2', border:'rgba(44,90,122,0.16)', muted:'rgba(255,255,255,0.38)',
}

type Tab    = 'home'|'help'|'settings'
type Screen = 'home'|'scan_ready'|'detect'|'capture'|'report'
type CodeKey= 'NBC'|'OBC'|'QBC'|'NEN'|'IRC'|'IBC'|'BCBC'

interface Loc  { city:string; province:string; country:string; countryCode:string }
interface Code {
  code:CodeKey; label:string; ref:string; reason:string
  limits:{ riserMin:number; riserMax:number; runMin:number; nosingMin?:number; nosingMax?:number; widthMin:number; headMin:number; guardMin:number }
}

const IBC:Code={ code:'IBC',label:'IBC 2021',ref:'§1011',reason:'International Building Code',
  limits:{riserMin:102,riserMax:178,runMin:279,widthMin:1118,headMin:2032,guardMin:1067}}

function isOntario(l:Loc){
  const p=l.province.toLowerCase(),c=l.city.toLowerCase()
  return p.includes('ontario')||['toronto','ottawa','hamilton','london','brampton','mississauga','markham','vaughan','kitchener','windsor','kingston'].some(x=>c.includes(x))
}

function detectCode(l:Loc):Code{
  if(isOntario(l))return{code:'OBC',label:'OBC 2024',ref:'s.9.8.4',reason:'Ontario Building Code',
    limits:{riserMin:125,riserMax:200,runMin:235,nosingMin:15,nosingMax:25,widthMin:860,headMin:1950,guardMin:900}}
  const cc=l.countryCode.toUpperCase()
  if(l.province.toLowerCase().includes('quebec')||l.city.toLowerCase().includes('montreal'))
    return{code:'QBC',label:'QBC 2020',ref:'Art.3.4.6',reason:'Quebec Building Code',
      limits:{riserMin:125,riserMax:200,runMin:230,widthMin:900,headMin:1950,guardMin:900}}
  if(cc==='CA')return{code:'NBC',label:'NBC 2020',ref:'9.8.4',reason:'National Building Code',
    limits:{riserMin:125,riserMax:200,runMin:235,widthMin:860,headMin:1950,guardMin:900}}
  if(cc==='NL')return{code:'NEN',label:'Bbl 2012',ref:'Art.2.83',reason:'Dutch Building Decree',
    limits:{riserMin:150,riserMax:220,runMin:230,widthMin:800,headMin:2300,guardMin:1000}}
  if(cc==='US')return{code:'IRC',label:'IRC 2021',ref:'R311.7',reason:'IRC',
    limits:{riserMin:0,riserMax:197,runMin:254,widthMin:914,headMin:2032,guardMin:914}}
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
     pass:m.nosing&&L.nosingMin?m.nosing>=(L.nosingMin||0)&&m.nosing<=(L.nosingMax||99):null},
    {label:'Width',   icon:'⟺',value:m.width,  min:L.widthMin,
     pass:m.width?m.width>=L.widthMin:null},
    {label:'Headroom',icon:'⇳',value:m.headroom==='clear'?null:m.headroom,min:L.headMin,clearAbove:m.headroom==='clear',
     pass:m.headroom==='clear'?true:m.headroom?m.headroom>=L.headMin:null} as any,
    {label:'Guard Ht',icon:'⊤',value:m.guard,  min:L.guardMin,
     pass:m.guard?m.guard>=L.guardMin:null},
  ]
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Home(){
  const [user,setUser]=useState<AppUser|null>(null)
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
  if(!user)return <AuthScreen onAuth={handleAuth}/>
  if(!user.role)return (
    <RoleSelectScreen onSelect={(role:UserRole)=>{
      Analytics.roleSelected(role)
      const updated={...user,role}
      handleUpdateUser(updated)
    }}/>
  )
  return <AppShell user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser}/>
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
  const [detectResult,setDetectResult]=useState<DetectResult|null>(null)

  useEffect(()=>{
    if(!navigator.geolocation){
      const fb={city:'Location unavailable',province:'',country:'',countryCode:'XX'}
      setLoc(fb);setCode(detectCode(fb));setLocLoading(false);return
    }
    navigator.geolocation.getCurrentPosition(async pos=>{
      setLatLng({lat:pos.coords.latitude,lng:pos.coords.longitude})
      try{
        const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
        const d=await r.json();const a=d.address??{}
        const l:Loc={city:a.city??a.town??a.village??'Unknown',province:a.state??a.province??'',
          country:a.country??'',countryCode:(a.country_code??'CA').toUpperCase()}
        setLoc(l);setCode(detectCode(l))
      }catch{const fb={city:'Unknown',province:'',country:'',countryCode:'XX'};setLoc(fb);setCode(detectCode(fb))}
      setLocLoading(false)
    },()=>{
      const fb={city:'Location unavailable',province:'',country:'',countryCode:'XX'}
      setLoc(fb);setCode(detectCode(fb));setLocLoading(false)
    },{timeout:6000})
  },[])

  const handleScanSuccess=useCallback((raw: Record<string,number|string>)=>{
    const n = (k: string, fallback: number|null = null) => {
      const v = raw[k]
      return typeof v === 'number' ? v : fallback
    }
    const m: StairMeasurements = {
      rise:      n('rise'),
      run:       n('run'),
      width:     n('width'),
      nosing:    n('nosing'),
      headroom:  raw.headroom === 'clear' ? 'clear' : n('headroom'),
      guard:     n('guard'),
      confidence: 0.88,
      calibrated: true,
    }
    const measurementCount = (['rise','run','width','guard'] as const).filter(k => n(k) !== null).length
    Analytics.scanCompleted({ role: user?.role ?? 'diy', measurementCount, hasFailed: false })
    setMeasurements(m)
    setScreen('report')
  },[user])
  const handleDetectComplete=useCallback((det:DetectResult)=>{setDetectResult(det);setScreen('capture')},[])
  const handleCaptureComplete=useCallback((m:StairMeasurements)=>{
    setMeasurements({...m,riserCount:detectResult?.riserCount??undefined,
      handrailOneSide:detectResult?.handrailOneSide??undefined,handrailBothSides:detectResult?.handrailBothSides??undefined})
    setScreen('report')
  },[detectResult])
  const handleStartOver=useCallback(()=>{setMeasurements(null);setDetectResult(null);setScreen('home')},[])
  const handleRetake=useCallback(()=>{setMeasurements(null);setDetectResult(null);setScreen('scan_ready')},[])

  // Full-screen flows (no bottom nav)
  if(screen==='scan_ready'){Analytics.scanStarted({role:user.role,codeLabel:code?.label,location:loc?`${loc.city}${loc.province?', '+loc.province:''}`:undefined})}
  if(screen==='scan_ready')return <ScanReadyScreen userRole={user.role} onSuccess={handleScanSuccess as (m:Record<string,number|string>)=>void} onBack={()=>setScreen('home')}/>
  if(screen==='detect')return <StairDetect onComplete={handleDetectComplete} onBack={()=>setScreen('scan_ready')} knownWidth={measurements?.width??null}/>
  if(screen==='capture')return <MeasureWalk onComplete={handleCaptureComplete} onBack={()=>setScreen('home')} codeLabel={code?.label??'Building Code'} jurisdiction={code?.code??'NBC'}/>
  if(screen==='report'&&measurements&&code)return <ReportScreen measurements={measurements} fields={check(measurements,code)} codeLabel={code.label} codeRef={code.ref} location={loc?`${loc.city}${loc.province?', '+loc.province:''}`:''}  userLatLng={latLng} isOntario={loc?isOntario(loc):false} userRole={user?.role} onRetake={handleRetake} onStartOver={handleStartOver}/>

  return(
    <div style={{minHeight:'100dvh',background:C.dark,color:'#fff',display:'flex',flexDirection:'column',maxWidth:430,margin:'0 auto',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>
        {tab==='home'&&<HomeTab user={user} loc={loc} locLoading={locLoading} code={code} onStartScan={()=>{setTab('home');setScreen('scan_ready')}} onLogout={onLogout}/>}
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
        <div style={{fontSize:'0.52rem',fontFamily:'monospace',letterSpacing:'0.32em',color:C.orange, display:'flex', alignItems:'center', gap:'0.3rem'}}>▲ STAIRCODE <span style={{display:'inline-flex',alignItems:'center',background:'#F29337',color:'#fff',fontSize:'0.42rem',fontWeight:800,letterSpacing:'0.12em',padding:'0.15rem 0.5rem',borderRadius:20,marginLeft:'0.45rem',verticalAlign:'middle',fontFamily:'monospace',boxShadow:'0 1px 6px rgba(242,147,55,0.45)'}}>BETA</span></div>
        <h1 style={{fontSize:'1.65rem',fontWeight:800,lineHeight:1.1,textAlign:'center',margin:0,letterSpacing:'-0.02em'}}>
          Stair Code <span style={{color:'#ffffff',textShadow:`0 0 28px ${C.orange}88`}}>Compliance</span>
        </h1>
        <p style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.55)',textAlign:'center',margin:0}}>Welcome back, {user.name.split(' ')[0]}</p>
      </div>

      <div style={{flex:1,padding:'1.25rem',display:'flex',flexDirection:'column',gap:'0.8rem',background:'#EBF3FA'}}>
        {/* Location card */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'0.9rem 1rem',display:'flex',flexDirection:'column',gap:'0.45rem'}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:locLoading?'#F29337':confirmed?C.pass:'rgba(167,177,194,0.4)',boxShadow:locLoading?'0 0 0 3px rgba(242,147,55,0.2)':confirmed?'0 0 0 3px rgba(74,144,226,0.2)':'none'}}/>
            <span style={{fontSize:'0.8rem',color:'#0A1C2E',fontWeight:600}}>{locLoading?'Detecting location…':confirmed?locStr:'Outside Ontario'}</span>
          </div>
          {!locLoading&&code&&(
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:'0.68rem',color:'#2C4A6E',fontFamily:'monospace',fontWeight:500}}>{code.ref}</span>
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
        <button onClick={onStartScan} disabled={locLoading} style={{width:'100%',padding:'1.15rem',background:locLoading?'rgba(65,124,164,0.15)':'#F29337',border:'none',borderRadius:16,color:'#fff',fontSize:'1rem',fontFamily:"'Inter',sans-serif",fontWeight:800,letterSpacing:'0.06em',cursor:locLoading?'not-allowed':'pointer',boxShadow:locLoading?'none':'0 6px 32px rgba(242,147,55,0.45)',transition:'all 0.2s',opacity:locLoading?0.45:1}}>
          {locLoading?'Loading…':'● Start Scan'}
        </button>

        <p style={{textAlign:'center',fontSize:'0.6rem',color:'rgba(44,74,110,0.38)',lineHeight:1.5,fontFamily:'monospace',margin:0}}>
          Pre-analysis only · Not a substitute for professional inspection
        </p>
        <button onClick={onLogout} style={{display:'block',margin:'0.75rem auto 0',background:'none',border:'none',color:'rgba(65,124,164,0.4)',fontSize:'0.65rem',fontFamily:'monospace',cursor:'pointer',letterSpacing:'0.08em',padding:'0.3rem 0.75rem'}}>
          ↩ Sign out
        </button>
      </div>
    </div>
  )
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({active,onChange}:{active:Tab;onChange:(t:Tab)=>void}){
  const tabs=[{id:'home' as Tab,icon:'🏠',label:'Welcome'},{id:'help' as Tab,icon:'🤖',label:'AI Guide'},{id:'settings' as Tab,icon:'⚙️',label:'Settings'}]
  return(
    <div style={{borderTop:'1.5px solid rgba(147,186,212,0.18)',background:'#FFFFFF',paddingBottom:'env(safe-area-inset-bottom,0px)',display:'flex'}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>onChange(t.id)} style={{flex:1,padding:'0.7rem 0.4rem',background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.2rem'}}>
          <span style={{fontSize:'1.25rem',opacity:active===t.id?1:0.38,filter:active===t.id?'none':'grayscale(1)',transition:'all 0.15s'}}>{t.icon}</span>
          <span style={{fontSize:'0.62rem',fontFamily:'monospace',fontWeight:active===t.id?700:400,color:active===t.id?'#2C5A7A':'rgba(44,74,110,0.5)',letterSpacing:'0.06em'}}>{t.label}</span>
          {active===t.id&&<div style={{width:4,height:4,borderRadius:'50%',background:C.blue,boxShadow:`0 0 6px ${C.blue}`}}/>}
        </button>
      ))}
    </div>
  )
}
