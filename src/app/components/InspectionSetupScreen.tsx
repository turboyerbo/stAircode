'use client'
/**
 * InspectionSetupScreen.tsx
 *
 * 3-step wizard:
 *   Step 1 — Location: address with geo-locate + autocomplete
 *   Step 2 — Property: AI site scan → pre-fills all construction fields
 *   Step 3 — Parties: client + inspector details
 *
 * Step 1: On load, geo-locates user (GPS → Nominatim reverse geocode, or IP → /api/geo).
 *         Street address input shows Nominatim autocomplete suggestions.
 *
 * Step 2: Opens PropertySiteScanScreen (full camera UI).
 *         AI fills building type, age, wall construction, roof, etc.
 *         User reviews and adjusts all fields.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { createNewJob, BuildingType, WeatherCondition } from '@/lib/inspection-types'
import type { InspectionJob, PropertyAddress, ProjectType } from '@/lib/inspection-types'
import { NavLogo } from './Logo'
import PropertySiteScanScreen from './PropertySiteScanScreen'
import type { PropertyScanResult } from './PropertySiteScanScreen'

interface Props {
  onJobCreated:  (job: InspectionJob) => void
  onBack:        () => void
  projectType?:  ProjectType
  existingJobId?: string   // if set, update this job rather than creating a new one
}

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const ORANGE = '#F29337'
const GREEN  = '#27A96B'
const BORDER = 'rgba(44,90,122,0.18)'
const BG     = '#F4F7FB'
const WHITE  = '#fff'

// ── Reusable field components ──────────────────────────────────────────────────
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.3rem' }}>
      {children}{required && <span style={{ color:ORANGE, marginLeft:'0.2rem' }}>*</span>}
    </div>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {children}
    </div>
  )
}

function inputStyle(focused?: boolean): React.CSSProperties {
  return {
    width:'100%', padding:'0.7rem 0.85rem',
    background:WHITE, border:`1px solid ${focused ? BLUE : BORDER}`, borderRadius:8,
    fontSize:'0.875rem', color:'#0D1E2E', outline:'none',
    boxSizing:'border-box', fontFamily:'inherit', transition:'border-color 0.12s',
  }
}

function selectStyle(): React.CSSProperties {
  return {
    ...inputStyle(),
    cursor:'pointer',
    appearance:'none',
    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235E7D9B' fill='none' strokeWidth='1.5' strokeLinecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat:'no-repeat', backgroundPosition:'right 0.85rem center',
  }
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:'0.7rem', fontWeight:700, color:BLUE, letterSpacing:'0.06em', textTransform:'uppercase' as const, padding:'0.6rem 0 0.4rem', borderTop:`1px solid ${BORDER}`, marginTop:'0.25rem' }}>{children}</div>
}

// ── Address suggestion row ────────────────────────────────────────────────────
interface Suggestion {
  displayName: string; street: string; city: string; province: string
  postalCode: string; country: string; countryCode: string; lat: number; lon: number
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function InspectionSetupScreen({ onJobCreated, onBack, projectType = 'new_construction', existingJobId }: Props) {
  // Step
  const [step, setStep] = useState<1|2|3>(1)

  // Address
  const [street,      setStreet]      = useState('')
  const [unit,        setUnit]        = useState('')
  const [city,        setCity]        = useState('')
  const [province,    setProvince]    = useState('Ontario')
  const [postalCode,  setPostalCode]  = useState('')
  const [country,     setCountry]     = useState('Canada')
  const [lat,         setLat]         = useState<number|null>(null)
  const [lon,         setLon]         = useState<number|null>(null)
  const [userLat,     setUserLat]     = useState<number|null>(null)  // device GPS
  const [userLon,     setUserLon]     = useState<number|null>(null)
  const [offSiteDismissed, setOffSiteDismissed] = useState(false)
  const [inspDate,    setInspDate]    = useState(new Date().toISOString().slice(0,10))
  const [weather,     setWeather]     = useState<WeatherCondition>('fine')
  const [occupied,    setOccupied]    = useState(false)
  const [secure,      setSecure]      = useState(true)

  // Autocomplete
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [geoLoading,  setGeoLoading]  = useState(false)
  const [geoStatus,   setGeoStatus]   = useState<string>('')
  const acTimer = useRef<ReturnType<typeof setTimeout>|null>(null)
  const streetRef = useRef<HTMLInputElement>(null)

  // Property details (AI or manual)
  const [buildingType,     setBuildingType]     = useState<BuildingType>('single_storey_residential')
  const [estimatedAge,     setEstimatedAge]     = useState('')
  const [roofCovering,     setRoofCovering]     = useState('unknown')
  const [footingType,      setFootingType]      = useState('unknown')
  const [wallConstruction, setWallConstruction] = useState('unknown')
  const [internalWalls,    setInternalWalls]    = useState('Plasterboard')
  const [windows,          setWindows]          = useState('')
  const [purposeNote,      setPurposeNote]      = useState('Pre-purchase building inspection')
  const [aiScanResult,     setAiScanResult]     = useState<PropertyScanResult|null>(null)
  const [showAIScan,       setShowAIScan]        = useState(false)
  const [aiConfidence,     setAiConfidence]      = useState<number|null>(null)

  // Parties
  const [clientName,    setClientName]    = useState('')
  const [clientEmail,   setClientEmail]   = useState('')
  const [clientPhone,   setClientPhone]   = useState('')
  const [inspectorName, setInspectorName] = useState('')
  const [licenceNumber, setLicenceNumber] = useState('')
  const [company,       setCompany]       = useState('')
  const [loading,       setLoading]       = useState(false)

  // Screening mode
  const [isPrescreen, setIsPrescreen] = useState(true) // default to pre-screening

  // ── On mount: geo-locate ────────────────────────────────────────────────────
  useEffect(() => {
    setGeoLoading(true)
    setGeoStatus('Locating…')

    // Try GPS first
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const { latitude, longitude } = pos.coords
          setUserLat(latitude); setUserLon(longitude)
          setLat(latitude); setLon(longitude)
          try {
            const res  = await fetch(`/api/geo?lat=${latitude}&lon=${longitude}`)
            const data = await res.json()
            if (data.city && data.city !== 'Unknown') {
              setCity(data.city)
              if (data.province) setProvince(data.province)
              if (data.country)  setCountry(data.country)
              setGeoStatus(`${data.city}, ${data.province}`)
            }
          } catch {}
          setGeoLoading(false)
        },
        async () => {
          // GPS denied or unavailable — fall back to IP
          try {
            const res  = await fetch('/api/geo')
            const data = await res.json()
            if (data.city && data.city !== 'Unknown') {
              setCity(data.city)
              if (data.province) setProvince(data.province)
              if (data.country)  setCountry(data.country)
              if (data.lat)      setLat(data.lat)
              if (data.lon)      setLon(data.lon)
              setGeoStatus(`${data.city}, ${data.province}`)
            }
          } catch {}
          setGeoLoading(false)
        },
        { timeout: 6000, maximumAge: 60000 }
      )
    } else {
      // No geolocation API — IP fallback
      fetch('/api/geo').then(r => r.json()).then(data => {
        if (data.city && data.city !== 'Unknown') {
          setCity(data.city)
          if (data.province) setProvince(data.province)
          if (data.country)  setCountry(data.country)
          if (data.lat)      setLat(data.lat)
          if (data.lon)      setLon(data.lon)
        }
        setGeoLoading(false)
        setGeoStatus('')
      }).catch(() => setGeoLoading(false))
    }
  }, [])

  // ── Address autocomplete ────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); return }
    try {
      const params = new URLSearchParams({ q })
      if (lat) params.set('lat', String(lat))
      if (lon) params.set('lon', String(lon))
      const res  = await fetch(`/api/address-search?${params}`)
      const data = await res.json()
      setSuggestions(data.results ?? [])
      setShowSuggest(true)
    } catch { setSuggestions([]) }
  }, [lat, lon])

  function handleStreetChange(v: string) {
    setStreet(v)
    if (acTimer.current) clearTimeout(acTimer.current)
    acTimer.current = setTimeout(() => fetchSuggestions(v), 300)
  }

  function applySuggestion(s: Suggestion) {
    setStreet(s.street)
    if (s.city)        setCity(s.city)
    if (s.province)    setProvince(s.province)
    if (s.postalCode)  setPostalCode(s.postalCode)
    if (s.country)     setCountry(s.country)
    if (s.lat)         setLat(s.lat)
    if (s.lon)         setLon(s.lon)
    setSuggestions([])
    setShowSuggest(false)
  }

  // ── AI scan result → pre-fill property fields ───────────────────────────────
  function applyAIScanResult(r: PropertyScanResult) {
    setBuildingType(r.buildingType)
    setEstimatedAge(r.estimatedAge)
    setWallConstruction(r.wallConstruction)
    setRoofCovering(r.roofCovering)
    setFootingType(r.footingType)
    if (r.internalWalls) setInternalWalls(r.internalWalls)
    if (r.windows)       setWindows(r.windows)
    setAiScanResult(r)
    setAiConfidence(r.confidence)
    setShowAIScan(false)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  function handleSubmit() {
    setLoading(true)
    const address: PropertyAddress = {
      street: street.trim(), unit: unit.trim() || undefined,
      city: city.trim(), province, postalCode: postalCode.trim(), country,
      lat: lat ?? undefined, lng: lon ?? undefined,
    }
    const job = createNewJob({
      projectType,
      ...(existingJobId ? { id: existingJobId } : {}),
      clientName:    clientName.trim() || (isPrescreen ? 'Homeowner' : ''),
      clientEmail:   clientEmail.trim() || undefined,
      clientPhone:   clientPhone.trim() || undefined,
      inspectorName: isPrescreen ? 'Pre-Screening' : inspectorName.trim(),
      licenceNumber: isPrescreen ? undefined : licenceNumber.trim() || undefined,
      company:       isPrescreen ? undefined : company.trim() || undefined,
      address, buildingType,
      estimatedAge:  estimatedAge.trim(),
      roofCovering:  roofCovering as any, footingType: footingType as any,
      wallConstruction: wallConstruction as any, internalWalls, windows,
      isOccupied: occupied, isSecure: secure, weather,
      purposeNote: isPrescreen ? 'Pre-screening — homeowner self-assessment' : purposeNote,
      inspectionDate: inspDate,
    })
    try { sessionStorage.setItem(`insp_${job.id}`, JSON.stringify(job)) } catch {}
    setLoading(false)
    onJobCreated(job)
  }

  const canStep1 = street.trim().length > 0 && city.trim().length > 0
  const canStep2 = true  // Step 2 is skippable — AI scan or skip both advance
  // Pre-screening: just needs an optional name; Professional: needs inspector name
  const canStep3 = isPrescreen ? true : inspectorName.trim().length > 0

  // ── AI scan overlay ─────────────────────────────────────────────────────────
  if (showAIScan) {
    return (
      <PropertySiteScanScreen
        address={`${street}, ${city}, ${province}`}
        onResult={applyAIScanResult}
        onSkip={() => setShowAIScan(false)}
      />
    )
  }

  return (
    <div style={{ minHeight:'100dvh', background:BG, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:'#0D1E2E' }}>

      {/* ── Header ── */}
      <div style={{ background:NAVY, padding:'max(env(safe-area-inset-top,0px),1rem) 1.25rem 0', position:'sticky', top:0, zIndex:30 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.85rem' }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.55)', fontSize:'0.85rem', cursor:'pointer', padding:0 }}>← Back</button>
          <div style={{ flex:1, display:'flex', justifyContent:'center' }}><NavLogo height={22} /></div>
          <div style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.35)' }}>New Project</div>
        </div>

        {/* Step indicator */}
        <div style={{ display:'flex', gap:'0.4rem', paddingBottom:'1rem' }}>
          {[{n:1,label:'Address'},{n:2,label:'Building'},{n:3,label:'About You'}].map(s => (
            <div key={s.n} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'0.3rem', cursor: s.n < step ? 'pointer' : 'default' }}
              onClick={() => { if (s.n < step) setStep(s.n as 1|2|3) }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:step===s.n?ORANGE:step>s.n?BLUE:'rgba(255,255,255,0.12)', border:`2px solid ${step===s.n?ORANGE:step>s.n?BLUE:'rgba(255,255,255,0.2)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.72rem', fontWeight:700, color:step>=s.n?'#fff':'rgba(255,255,255,0.4)', transition:'all 0.2s' }}>
                {step > s.n ? 'Done' : s.n}
              </div>
              <div style={{ fontSize:'0.6rem', color:step>=s.n?'rgba(255,255,255,0.7)':'rgba(255,255,255,0.3)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Form ── */}
      <div style={{ maxWidth:520, margin:'0 auto', padding:'1.25rem 1.25rem 6rem' }}>

        {/* ═══ STEP 1: Address ═══ */}
        {step === 1 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <div>
              <h2 style={{ fontSize:'1.2rem', fontWeight:700, margin:'0 0 0.2rem', color:NAVY }}>Property Address</h2>
              <p style={{ fontSize:'0.78rem', color:'#5E7D9B', margin:0, lineHeight:1.6 }}>Enter the address of the property being inspected.</p>
            </div>

            {/* Geo status */}
            {geoLoading && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.72rem', color:BLUE }}>
                <div style={{ width:10, height:10, borderRadius:'50%', border:`2px solid ${BLUE}`, borderTopColor:'transparent', animation:'spin 0.7s linear infinite' }}/>
                Finding your location…
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}
            {!geoLoading && geoStatus && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.72rem', color:GREEN }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:GREEN }}/>
                Your location: {geoStatus}
              </div>
            )}

            {/* Mini map — shows property pin when address has lat/lon */}
            {lat && lon && (
              <div style={{ borderRadius:12, overflow:'hidden', border:`1px solid ${BORDER}`, boxShadow:'0 2px 10px rgba(44,74,110,0.1)', height:160, position:'relative' }}>
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.006}%2C${lat-0.004}%2C${lon+0.006}%2C${lat+0.004}&layer=mapnik&marker=${lat}%2C${lon}`}
                  style={{ width:'100%', height:'160px', border:'none', display:'block' }}
                  loading="lazy"
                  title="Property location map"
                />
                <div style={{ position:'absolute', bottom:8, left:8, background:'rgba(10,28,46,0.82)', borderRadius:6, padding:'0.22rem 0.6rem', fontSize:'0.62rem', color:'rgba(255,255,255,0.9)', fontWeight:600, backdropFilter:'blur(4px)', pointerEvents:'none' }}>
                  📍 {city || 'Property location'}{province ? `, ${province}` : ''}
                </div>
              </div>
            )}

            {/* Off-site alert — when property province differs from user GPS province */}
            {!offSiteDismissed && lat && userLat && street.trim().length > 3 && province && city && geoStatus && !geoStatus.toLowerCase().includes(city.toLowerCase()) && (
              <div style={{ background:'rgba(242,147,55,0.08)', border:'1.5px solid rgba(242,147,55,0.4)', borderRadius:12, padding:'0.9rem 1rem', display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
                <span style={{ fontSize:'1.2rem', lineHeight:1, flexShrink:0 }}>📍</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'0.8rem', fontWeight:700, color:'#C4720E', marginBottom:'0.2rem' }}>Looks like you&apos;re not at the site</div>
                  <div style={{ fontSize:'0.72rem', color:'#7A4F1A', lineHeight:1.6 }}>
                    Your device is in <strong>{geoStatus}</strong>, but the property you&apos;re adding is in <strong>{city}, {province}</strong>. No problem — you can add a project for any location!
                  </div>
                </div>
                <button onClick={() => setOffSiteDismissed(true)} style={{ background:'none', border:'none', color:'rgba(196,114,30,0.6)', fontSize:'1.1rem', cursor:'pointer', lineHeight:1, flexShrink:0, padding:0 }}>×</button>
              </div>
            )}

            {/* Street address with autocomplete */}
            <div style={{ position:'relative' }}>
              <Label required>Street Address</Label>
              <input
                ref={streetRef}
                type="text"
                value={street}
                onChange={e => handleStreetChange(e.target.value)}
                onFocus={() => { if (suggestions.length) setShowSuggest(true) }}
                onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
                id="street" name="street" autoComplete="street-address" placeholder="123 Main Street"
                style={inputStyle()}
              />
              {/* Autocomplete dropdown */}
              {showSuggest && suggestions.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, background:WHITE, border:`1px solid ${BORDER}`, borderRadius:'0 0 8px 8px', boxShadow:'0 4px 16px rgba(44,74,110,0.12)', zIndex:50, overflow:'hidden', marginTop:2 }}>
                  {suggestions.map((s, i) => (
                    <button key={i} onMouseDown={() => applySuggestion(s)}
                      style={{ width:'100%', padding:'0.65rem 0.9rem', background:'none', border:'none', borderBottom:i < suggestions.length-1 ? `1px solid ${BORDER}` : 'none', textAlign:'left' as const, cursor:'pointer', display:'flex', flexDirection:'column', gap:'0.1rem' }}>
                      <div style={{ fontSize:'0.82rem', fontWeight:600, color:'#0D1E2E' }}>{s.street}</div>
                      <div style={{ fontSize:'0.68rem', color:'#5E7D9B' }}>{[s.city, s.province, s.country].filter(Boolean).join(', ')}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Field label="Unit / Suite">
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)} id="unit" name="unit" autoComplete="address-line2" placeholder="4B" style={inputStyle()}/>
            </Field>

            <Field label="City / Municipality" required>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} id="city" name="city" autoComplete="address-level2" placeholder="Toronto" style={inputStyle()}/>
            </Field>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              <Field label="Province / State" required>
                <select value={province} onChange={e => setProvince(e.target.value)} style={selectStyle()}>
                  {['Ontario','British Columbia','Alberta','Quebec','Nova Scotia','New Brunswick','Manitoba','Saskatchewan','Newfoundland','PEI','Yukon','NWT','Nunavut','New York','California','Other'].map(p => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Postal / ZIP Code">
                <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)} id="postal" name="postal" autoComplete="postal-code" placeholder="M5V 2T6" style={inputStyle()}/>
              </Field>
            </div>

            <Field label="Country">
              <select value={country} onChange={e => setCountry(e.target.value)} style={selectStyle()}>
                <option>Canada</option><option>United States</option><option>United Kingdom</option><option>Australia</option><option>Other</option>
              </select>
            </Field>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              <Field label="Inspection Date">
                <input id="inspection-date" name="inspection-date" type="date" value={inspDate} onChange={e => setInspDate(e.target.value)} style={inputStyle()}/>
              </Field>
              <Field label="Weather">
                <select value={weather} onChange={e => setWeather(e.target.value as WeatherCondition)} style={selectStyle()}>
                  <option value="fine">Fine</option>
                  <option value="overcast">Overcast</option>
                  <option value="light_rain">Light Rain</option>
                  <option value="heavy_rain">Heavy Rain</option>
                  <option value="windy">Windy</option>
                </select>
              </Field>
            </div>

            <div style={{ display:'flex', gap:'1.25rem' }}>
              <label style={{ display:'flex', alignItems:'center', gap:'0.45rem', fontSize:'0.82rem', cursor:'pointer' }}>
                <input id="occupied" name="occupied" type="checkbox" checked={occupied} onChange={e => setOccupied(e.target.checked)}/>
                Property occupied
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:'0.45rem', fontSize:'0.82rem', cursor:'pointer' }}>
                <input id="secure" name="secure" type="checkbox" checked={secure} onChange={e => setSecure(e.target.checked)}/>
                Property secure
              </label>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: Building — single action, AI does the rest ═══ */}
        {step === 2 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div>
              <h2 style={{ fontSize:'1.2rem', fontWeight:700, margin:'0 0 0.2rem', color:NAVY }}>Tell us about the building</h2>
              <p style={{ fontSize:'0.78rem', color:'#5E7D9B', margin:0, lineHeight:1.6 }}>
                Snap a photo and AI will identify the building type, age, and construction materials automatically. Or skip — you can add details anytime.
              </p>
            </div>

            {/* AI scan result success */}
            {aiScanResult && (
              <div style={{ background:'rgba(39,169,107,0.07)', border:'1.5px solid rgba(39,169,107,0.35)', borderRadius:12, padding:'0.9rem 1rem', display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink:0, marginTop:1 }}>
                  <circle cx="9" cy="9" r="8" stroke={GREEN} strokeWidth="1.4"/>
                  <path d="M5 9l3 3 5-5" stroke={GREEN} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div>
                  <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#1A7A50', marginBottom:'0.15rem' }}>AI scan complete — {Math.round((aiScanResult.confidence)*100)}% confidence</div>
                  <div style={{ fontSize:'0.7rem', color:'#5E7D9B', lineHeight:1.5 }}>
                    {buildingType.replace(/_/g,' ').replace(/w/g, c => c.toUpperCase())}
                    {estimatedAge ? ` · ${estimatedAge}` : ''}
                    {wallConstruction !== 'unknown' ? ` · ${wallConstruction.replace(/_/g,' ')}` : ''}
                  </div>
                </div>
                <button onClick={() => setShowAIScan(true)} style={{ marginLeft:'auto', padding:'0.3rem 0.65rem', background:'none', border:`1px solid rgba(39,169,107,0.4)`, borderRadius:7, fontSize:'0.68rem', fontWeight:700, color:GREEN, cursor:'pointer', flexShrink:0 }}>Rescan</button>
              </div>
            )}

            {/* Single main CTA card */}
            {!aiScanResult && (
              <button
                onClick={() => setShowAIScan(true)}
                style={{ width:'100%', padding:'1.5rem 1rem', background:'#fff', border:`1.5px solid ${BLUE}`, borderRadius:16, display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem', cursor:'pointer', boxShadow:'0 4px 18px rgba(65,124,164,0.15)', transition:'transform 0.1s' }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.transform='translateY(-1px)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.transform='none'}>
                <div style={{ width:56, height:56, borderRadius:14, background:'rgba(65,124,164,0.1)', border:`1.5px solid rgba(65,124,164,0.25)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="6" width="20" height="15" rx="2" stroke={BLUE} strokeWidth="1.5"/>
                    <circle cx="12" cy="13" r="4" stroke={BLUE} strokeWidth="1.5"/>
                    <path d="M8 6V4h8v2" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M18 10h1.5" stroke={ORANGE} strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'1rem', fontWeight:700, color:NAVY, marginBottom:'0.2rem' }}>AI Site Scan</div>
                  <div style={{ fontSize:'0.75rem', color:'#5E7D9B', lineHeight:1.5 }}>Take or upload a photo — AI identifies building type, age, materials, and construction details</div>
                </div>
                <div style={{ fontSize:'0.72rem', color:BLUE, fontWeight:600, padding:'0.3rem 0.9rem', background:'rgba(65,124,164,0.08)', borderRadius:7, border:`1px solid rgba(65,124,164,0.2)` }}>
                  Tap to scan or upload a photo →
                </div>
              </button>
            )}

            {/* Skip option */}
            <div style={{ textAlign:'center' }}>
              <button
                onClick={() => { setEstimatedAge('Unknown'); setStep(3) }}
                style={{ background:'none', border:'none', color:'#9DB4C5', fontSize:'0.75rem', cursor:'pointer', padding:'0.4rem 0.75rem', textDecoration:'underline', textDecorationColor:'rgba(147,180,197,0.4)', fontFamily:'inherit' }}>
                Skip — I&apos;ll fill in details later
              </button>
              <div style={{ fontSize:'0.62rem', color:'rgba(147,180,197,0.7)', marginTop:'0.2rem' }}>Building details can be added or updated any time inside the project</div>
            </div>
          </div>
        )}

        {/* ═══ STEP 3: Parties ═══ */}
        {step === 3 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <div>
              <h2 style={{ fontSize:'1.2rem', fontWeight:700, margin:'0 0 0.2rem', color:NAVY }}>Who is this for?</h2>
              <p style={{ fontSize:'0.78rem', color:'#5E7D9B', margin:0, lineHeight:1.6 }}>Choose how you&apos;ll use this inspection.</p>
            </div>

            {/* Mode toggle */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              <button
                onClick={() => setIsPrescreen(true)}
                style={{ padding:'0.9rem 0.75rem', borderRadius:10, border:`2px solid ${isPrescreen ? GREEN : BORDER}`, background: isPrescreen ? 'rgba(39,169,107,0.06)' : WHITE, cursor:'pointer', textAlign:'left' as const, transition:'all 0.12s' }}>
                <div style={{ fontSize:'0.78rem', fontWeight:700, color: isPrescreen ? GREEN : NAVY, marginBottom:'0.2rem' }}>Pre-Screening</div>
                <div style={{ fontSize:'0.65rem', color:'#5E7D9B', lineHeight:1.5 }}>Homeowner self-assessment. No licence required.</div>
              </button>
              <button
                onClick={() => setIsPrescreen(false)}
                style={{ padding:'0.9rem 0.75rem', borderRadius:10, border:`2px solid ${!isPrescreen ? BLUE : BORDER}`, background: !isPrescreen ? 'rgba(65,124,164,0.06)' : WHITE, cursor:'pointer', textAlign:'left' as const, transition:'all 0.12s' }}>
                <div style={{ fontSize:'0.78rem', fontWeight:700, color: !isPrescreen ? BLUE : NAVY, marginBottom:'0.2rem' }}>Professional</div>
                <div style={{ fontSize:'0.65rem', color:'#5E7D9B', lineHeight:1.5 }}>Licensed inspector or architect generating a formal report.</div>
              </button>
            </div>

            {/* Pre-screening path */}
            {isPrescreen && (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>

                {/* Info banner */}
                <div style={{ background:'rgba(39,169,107,0.06)', border:'1px solid rgba(39,169,107,0.25)', borderRadius:10, padding:'0.85rem 1rem', display:'flex', gap:'0.65rem', alignItems:'flex-start' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0, marginTop:1 }}>
                    <circle cx="8" cy="8" r="7" stroke={GREEN} strokeWidth="1.4"/>
                    <path d="M4.5 8l2.5 2.5 4.5-5" stroke={GREEN} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div style={{ fontSize:'0.75rem', color:'#1A7A50', lineHeight:1.6 }}>
                    <strong>Pre-screening mode:</strong> Walk through each inspection module using your phone camera. You&apos;ll get a preliminary assessment you can share with a professional. No licence number needed.
                  </div>
                </div>

                <Field label="Your Name (optional)">
                  <input type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                    id="client-name" name="client-name" autoComplete="name"
                    placeholder="e.g. Alex Smith" style={inputStyle()}/>
                </Field>

                <Field label="Your Email (optional — for report delivery)">
                  <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                    id="client-email" name="client-email" autoComplete="email"
                    placeholder="you@email.com" style={inputStyle()}/>
                </Field>

                {/* Find a Professional */}
                <div style={{ background:'rgba(65,124,164,0.05)', border:`1px solid rgba(65,124,164,0.2)`, borderRadius:10, padding:'0.9rem 1rem' }}>
                  <div style={{ fontSize:'0.72rem', fontWeight:700, color:BLUE, marginBottom:'0.4rem', letterSpacing:'0.02em' }}>Need a licensed inspector?</div>
                  <p style={{ fontSize:'0.72rem', color:'#3A5A78', lineHeight:1.65, margin:'0 0 0.65rem' }}>
                    Your pre-screening results can be shared directly with a certified building inspector or architect for a formal assessment.
                  </p>
                  <a
                    href={`https://www.google.com/search?q=certified+building+inspector+near+${encodeURIComponent(`${city || 'me'}, ${province}`)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display:'inline-flex', alignItems:'center', gap:'0.4rem', padding:'0.55rem 1rem', background:WHITE, border:`1.5px solid rgba(65,124,164,0.35)`, borderRadius:8, textDecoration:'none', color:BLUE, fontSize:'0.75rem', fontWeight:700 }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke={BLUE} strokeWidth="1.5"/>
                      <path d="M11 11l3 3" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Find a Professional Near Me →
                  </a>
                </div>

                <div style={{ fontSize:'0.65rem', color:'#9DB4C5', lineHeight:1.6, textAlign:'center' as const }}>
                  Pre-screening results are informational only and do not replace a formal inspection by a licensed professional.
                </div>
              </div>
            )}

            {/* Professional path */}
            {!isPrescreen && (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
                <SectionHeading>Commissioned By</SectionHeading>
                <Field label="Client Name" required>
                  <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} id="client-name" name="client-name" autoComplete="name" placeholder="Jane Smith" style={inputStyle()}/>
                </Field>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
                  <Field label="Email">
                    <input id="client-email" name="client-email" autoComplete="email" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="jane@email.com" style={inputStyle()}/>
                  </Field>
                  <Field label="Phone">
                    <input id="client-phone" name="client-phone" autoComplete="tel" type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(416) 555-0100" style={inputStyle()}/>
                  </Field>
                </div>

                <SectionHeading>Inspector</SectionHeading>
                <Field label="Inspector Name" required>
                  <input type="text" value={inspectorName} onChange={e => setInspectorName(e.target.value)} id="inspector-name" name="inspector-name" placeholder="Jordan Yerbury" style={inputStyle()}/>
                </Field>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
                  <Field label="Licence / Certificate No.">
                    <input type="text" value={licenceNumber} onChange={e => setLicenceNumber(e.target.value)} id="licence" name="licence" placeholder="OAA-123456" style={inputStyle()}/>
                  </Field>
                  <Field label="Company">
                    <input type="text" value={company} onChange={e => setCompany(e.target.value)} id="company" name="company" autoComplete="organization" placeholder="Just Open Technologies" style={inputStyle()}/>
                  </Field>
                </div>
                <Field label="Inspection Purpose">
                  <input type="text" value={purposeNote} onChange={e => setPurposeNote(e.target.value)} id="purpose" name="purpose" placeholder="Pre-purchase building inspection" style={inputStyle()}/>
                </Field>
              </div>
            )}

            {/* Summary card */}
            <div style={{ background:'rgba(65,124,164,0.06)', border:`1px solid rgba(65,124,164,0.2)`, borderRadius:10, padding:'0.9rem 1rem' }}>
              <div style={{ fontSize:'0.68rem', fontWeight:600, color:BLUE, marginBottom:'0.5rem' }}>Inspection Summary</div>
              <div style={{ fontSize:'0.78rem', color:'#3A5A78', lineHeight:1.8 }}>
                <strong>{street}{unit ? ` #${unit}` : ''}</strong><br/>
                {city}, {province} {postalCode}<br/>
                {buildingType.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}
                {estimatedAge && ` · ${estimatedAge}`}
                {aiScanResult && <span style={{ color:GREEN }}> · AI scanned</span>}
                {' · '}<span style={{ color: isPrescreen ? GREEN : BLUE }}>{isPrescreen ? 'Pre-Screening' : 'Professional'}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <div style={{ display:'flex', gap:'0.65rem', marginTop:'1.5rem' }}>
          {step > 1 && (
            <button onClick={() => setStep(s => (s-1) as 1|2|3)}
              style={{ flex:1, padding:'0.9rem', background:WHITE, border:`1.5px solid ${BORDER}`, borderRadius:10, fontSize:'0.875rem', fontWeight:600, cursor:'pointer', color:'#3A5A78' }}>
              ← Back
            </button>
          )}
          {step < 3 ? (
            <button onClick={() => setStep(s => (s+1) as 1|2|3)}
              disabled={step===1 ? !canStep1 : !canStep2}
              style={{ flex:2, padding:'0.9rem', background:(step===1?canStep1:canStep2)?`linear-gradient(135deg,${BLUE},#2C5A7A)`:'rgba(44,90,122,0.1)', border:'none', borderRadius:10, fontSize:'0.875rem', fontWeight:600, cursor:(step===1?canStep1:canStep2)?'pointer':'not-allowed', color:(step===1?canStep1:canStep2)?'#fff':'#9DB4C5', transition:'all 0.15s' }}>
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={!canStep3 || loading}
              style={{ flex:2, padding:'0.9rem', background:canStep3?`linear-gradient(135deg,${isPrescreen?GREEN:ORANGE},${isPrescreen?'#1A7A50':'#C4721E'})`:'rgba(242,147,55,0.15)', border:'none', borderRadius:10, fontSize:'0.875rem', fontWeight:700, cursor:canStep3?'pointer':'not-allowed', color:canStep3?'#fff':'rgba(242,147,55,0.5)', transition:'all 0.15s' }}>
              {loading ? 'Starting…' : isPrescreen ? 'Start Pre-Screening →' : 'Start Inspection →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
