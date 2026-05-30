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
export default function InspectionSetupScreen({ onJobCreated, onBack, projectType = 'new_construction' }: Props) {
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

  // ── On mount: geo-locate ────────────────────────────────────────────────────
  useEffect(() => {
    setGeoLoading(true)
    setGeoStatus('Locating…')

    // Try GPS first
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const { latitude, longitude } = pos.coords
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
      clientName: clientName.trim(), clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      inspectorName: inspectorName.trim(), licenceNumber: licenceNumber.trim() || undefined,
      company: company.trim() || undefined,
      address, buildingType,
      estimatedAge: estimatedAge.trim(),
      roofCovering: roofCovering as any, footingType: footingType as any,
      wallConstruction: wallConstruction as any, internalWalls, windows,
      isOccupied: occupied, isSecure: secure, weather, purposeNote,
      inspectionDate: inspDate,
    })
    try { sessionStorage.setItem(`insp_${job.id}`, JSON.stringify(job)) } catch {}
    setLoading(false)
    onJobCreated(job)
  }

  const canStep1 = street.trim().length > 0 && city.trim().length > 0
  const canStep2 = buildingType && estimatedAge.trim().length > 0
  const canStep3 = clientName.trim().length > 0 && inspectorName.trim().length > 0

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
          <div style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.35)' }}>New Inspection</div>
        </div>

        {/* Step indicator */}
        <div style={{ display:'flex', gap:'0.4rem', paddingBottom:'1rem' }}>
          {[{n:1,label:'Location'},{n:2,label:'Property'},{n:3,label:'Parties'}].map(s => (
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
                Locating…
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}
            {!geoLoading && geoStatus && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.72rem', color:GREEN }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:GREEN }}/>
                Located: {geoStatus}
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
                placeholder="123 Main Street"
                autoComplete="off"
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
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="4B" style={inputStyle()}/>
            </Field>

            <Field label="City / Municipality" required>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Toronto" style={inputStyle()}/>
            </Field>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              <Field label="Province / State" required>
                <select value={province} onChange={e => setProvince(e.target.value)} style={selectStyle()}>
                  {['Ontario','British Columbia','Alberta','Quebec','Nova Scotia','New Brunswick','Manitoba','Saskatchewan','Newfoundland','PEI','Yukon','NWT','Nunavut','New York','California','Other'].map(p => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Postal / ZIP Code">
                <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="M5V 2T6" style={inputStyle()}/>
              </Field>
            </div>

            <Field label="Country">
              <select value={country} onChange={e => setCountry(e.target.value)} style={selectStyle()}>
                <option>Canada</option><option>United States</option><option>United Kingdom</option><option>Australia</option><option>Other</option>
              </select>
            </Field>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              <Field label="Inspection Date">
                <input type="date" value={inspDate} onChange={e => setInspDate(e.target.value)} style={inputStyle()}/>
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
                <input type="checkbox" checked={occupied} onChange={e => setOccupied(e.target.checked)}/>
                Property occupied
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:'0.45rem', fontSize:'0.82rem', cursor:'pointer' }}>
                <input type="checkbox" checked={secure} onChange={e => setSecure(e.target.checked)}/>
                Property secure
              </label>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: Property ═══ */}
        {step === 2 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <div>
              <h2 style={{ fontSize:'1.2rem', fontWeight:700, margin:'0 0 0.2rem', color:NAVY }}>Building Details</h2>
              <p style={{ fontSize:'0.78rem', color:'#5E7D9B', margin:0, lineHeight:1.6 }}>Photograph the building and AI will fill in the details automatically.</p>
            </div>

            {/* AI Scan CTA */}
            <div style={{ background:aiScanResult ? 'rgba(39,169,107,0.06)' : 'rgba(65,124,164,0.06)', border:`1.5px solid ${aiScanResult ? 'rgba(39,169,107,0.35)' : 'rgba(65,124,164,0.3)'}`, borderRadius:12, padding:'1rem', display:'flex', alignItems:'center', gap:'0.85rem' }}>
              <div style={{ width:42, height:42, borderRadius:10, background:aiScanResult?'rgba(39,169,107,0.1)':'rgba(65,124,164,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <rect x="1" y="5" width="20" height="14" rx="2" stroke={aiScanResult?GREEN:BLUE} strokeWidth="1.5"/>
                  <circle cx="11" cy="12" r="4" stroke={aiScanResult?GREEN:BLUE} strokeWidth="1.5"/>
                  <path d="M7 5V3h8v2" stroke={aiScanResult?GREEN:BLUE} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div style={{ flex:1 }}>
                {aiScanResult ? (
                  <>
                    <div style={{ fontSize:'0.82rem', fontWeight:700, color:GREEN, marginBottom:'0.1rem' }}>
                      AI scan complete — {Math.round((aiScanResult.confidence)*100)}% confidence
                    </div>
                    <div style={{ fontSize:'0.68rem', color:'#5E7D9B' }}>Fields pre-filled below. Review and adjust as needed.</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#0D1E2E', marginBottom:'0.1rem' }}>AI Site Scan</div>
                    <div style={{ fontSize:'0.68rem', color:'#5E7D9B' }}>Photograph the building — AI fills in all construction details</div>
                  </>
                )}
              </div>
              <button onClick={() => setShowAIScan(true)}
                style={{ padding:'0.55rem 0.9rem', background:aiScanResult?`rgba(39,169,107,0.12)`:`rgba(65,124,164,0.12)`, border:`1px solid ${aiScanResult?'rgba(39,169,107,0.35)':'rgba(65,124,164,0.35)'}`, borderRadius:8, fontSize:'0.75rem', fontWeight:700, color:aiScanResult?GREEN:BLUE, cursor:'pointer', whiteSpace:'nowrap' as const }}>
                {aiScanResult ? 'Rescan' : 'Scan →'}
              </button>
            </div>

            {/* Confidence badge */}
            {aiConfidence != null && (
              <div style={{ fontSize:'0.68rem', color:'#5E7D9B', background:'rgba(39,169,107,0.05)', border:'1px solid rgba(39,169,107,0.15)', borderRadius:7, padding:'0.4rem 0.75rem' }}>
                AI pre-filled all fields below (confidence: {Math.round(aiConfidence*100)}%). Edit any field that needs correction.
              </div>
            )}

            <Field label="Building Type" required>
              <select value={buildingType} onChange={e => setBuildingType(e.target.value as BuildingType)} style={selectStyle()}>
                <option value="single_storey_residential">Single Storey Residential</option>
                <option value="two_storey_residential">Two Storey Residential</option>
                <option value="semi_detached">Semi-Detached</option>
                <option value="townhouse">Townhouse</option>
                <option value="multi_unit_residential">Multi-Unit Residential</option>
                <option value="commercial">Commercial</option>
                <option value="industrial">Industrial</option>
                <option value="mixed_use">Mixed Use</option>
                <option value="other">Other</option>
              </select>
            </Field>

            <Field label="Estimated Building Age" required>
              <input type="text" value={estimatedAge} onChange={e => setEstimatedAge(e.target.value)} placeholder="e.g. Approx. 1970s–1980s" style={inputStyle()}/>
            </Field>

            <SectionHeading>Construction Materials</SectionHeading>

            <Field label="External Wall Construction">
              <select value={wallConstruction} onChange={e => setWallConstruction(e.target.value)} style={selectStyle()}>
                <option value="unknown">Unknown / Not yet inspected</option>
                <option value="brick_veneer">Brick Veneer</option>
                <option value="double_brick">Double Brick</option>
                <option value="timber_frame">Timber Frame / Wood Frame</option>
                <option value="concrete_block">Concrete Block (CMU)</option>
                <option value="icf">ICF (Insulated Concrete Form)</option>
                <option value="steel_frame">Steel Frame</option>
                <option value="other">Other</option>
              </select>
            </Field>

            <Field label="Roof Covering">
              <select value={roofCovering} onChange={e => setRoofCovering(e.target.value)} style={selectStyle()}>
                <option value="unknown">Unknown / Not yet inspected</option>
                <option value="concrete_tiles">Concrete Tiles</option>
                <option value="clay_tiles">Clay Tiles</option>
                <option value="metal_deck">Metal Deck / Colorbond / Standing Seam</option>
                <option value="asphalt_shingles">Asphalt Shingles</option>
                <option value="flat_membrane">Flat / Membrane</option>
                <option value="fibreglass">Fibreglass</option>
                <option value="other">Other</option>
              </select>
            </Field>

            <Field label="Footings & Foundation">
              <select value={footingType} onChange={e => setFootingType(e.target.value)} style={selectStyle()}>
                <option value="unknown">Unknown</option>
                <option value="concrete_slab">Concrete Footings & Slab</option>
                <option value="piers_stumps">Piers / Stumps</option>
                <option value="strip_footing">Strip Footing</option>
              </select>
            </Field>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              <Field label="Internal Walls">
                <input type="text" value={internalWalls} onChange={e => setInternalWalls(e.target.value)} placeholder="Plasterboard" style={inputStyle()}/>
              </Field>
              <Field label="Windows">
                <input type="text" value={windows} onChange={e => setWindows(e.target.value)} placeholder="Aluminium double-hung" style={inputStyle()}/>
              </Field>
            </div>

            <Field label="Inspection Purpose">
              <input type="text" value={purposeNote} onChange={e => setPurposeNote(e.target.value)} placeholder="Pre-purchase building inspection" style={inputStyle()}/>
            </Field>
          </div>
        )}

        {/* ═══ STEP 3: Parties ═══ */}
        {step === 3 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <div>
              <h2 style={{ fontSize:'1.2rem', fontWeight:700, margin:'0 0 0.2rem', color:NAVY }}>Parties</h2>
              <p style={{ fontSize:'0.78rem', color:'#5E7D9B', margin:0, lineHeight:1.6 }}>Who commissioned the inspection and who is conducting it.</p>
            </div>

            <SectionHeading>Commissioned By</SectionHeading>
            <Field label="Client Name" required>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Jane Smith" style={inputStyle()}/>
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              <Field label="Email">
                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="jane@email.com" style={inputStyle()}/>
              </Field>
              <Field label="Phone">
                <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(416) 555-0100" style={inputStyle()}/>
              </Field>
            </div>

            <SectionHeading>Inspector</SectionHeading>
            <Field label="Inspector Name" required>
              <input type="text" value={inspectorName} onChange={e => setInspectorName(e.target.value)} placeholder="Jordan Yerbury" style={inputStyle()}/>
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              <Field label="Licence / Certificate No.">
                <input type="text" value={licenceNumber} onChange={e => setLicenceNumber(e.target.value)} placeholder="OAA-123456" style={inputStyle()}/>
              </Field>
              <Field label="Company">
                <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Just Open Technologies" style={inputStyle()}/>
              </Field>
            </div>

            {/* Summary card */}
            <div style={{ background:'rgba(65,124,164,0.06)', border:`1px solid rgba(65,124,164,0.2)`, borderRadius:10, padding:'0.9rem 1rem' }}>
              <div style={{ fontSize:'0.68rem', fontWeight:600, color:BLUE, marginBottom:'0.5rem' }}>Inspection Summary</div>
              <div style={{ fontSize:'0.78rem', color:'#3A5A78', lineHeight:1.8 }}>
                <strong>{street}{unit ? ` #${unit}` : ''}</strong><br/>
                {city}, {province} {postalCode}<br/>
                {buildingType.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}
                {estimatedAge && ` · ${estimatedAge}`}
                {aiScanResult && <span style={{ color:GREEN }}> · AI scanned</span>}
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
              style={{ flex:2, padding:'0.9rem', background:canStep3?`linear-gradient(135deg,${ORANGE},#C4721E)`:'rgba(242,147,55,0.15)', border:'none', borderRadius:10, fontSize:'0.875rem', fontWeight:700, cursor:canStep3?'pointer':'not-allowed', color:canStep3?'#fff':'rgba(242,147,55,0.5)', transition:'all 0.15s' }}>
              {loading ? 'Starting…' : 'Start Inspection →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
