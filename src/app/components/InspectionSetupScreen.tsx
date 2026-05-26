'use client'
/**
 * InspectionSetupScreen.tsx
 *
 * Step 1: Collect address, property details, client and inspector info.
 * On submit → creates a new InspectionJob and navigates to the dashboard.
 */

import { useState } from 'react'
import { createNewJob, BuildingType, WeatherCondition } from '@/lib/inspection-types'
import type { InspectionJob, PropertyAddress } from '@/lib/inspection-types'
import { NavLogo } from './Logo'

interface Props {
  onJobCreated: (job: InspectionJob) => void
  onBack:       () => void
}

// ── Palette ────────────────────────────────────────────────────────────────────
const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const ORANGE = '#F29337'
const BORDER = 'rgba(44,90,122,0.18)'
const BG     = '#F4F7FB'
const WHITE  = '#fff'

// ── Reusable field components ─────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.3rem', letterSpacing:'0.01em' }}>
      {children}
    </div>
  )
}

function Input({
  value, onChange, placeholder, type = 'text', required,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      style={{
        width: '100%', padding: '0.7rem 0.85rem',
        background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8,
        fontSize: '0.875rem', color: '#0D1E2E', outline: 'none',
        boxSizing: 'border-box', fontFamily: 'inherit',
        transition: 'border-color 0.12s',
      }}
      onFocus={e  => (e.target.style.borderColor = BLUE)}
      onBlur={e   => (e.target.style.borderColor = BORDER)}
    />
  )
}

function Select({
  value, onChange, children,
}: {
  value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '0.7rem 0.85rem',
        background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8,
        fontSize: '0.875rem', color: '#0D1E2E', outline: 'none',
        boxSizing: 'border-box', fontFamily: 'inherit', cursor: 'pointer',
        appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235E7D9B' fill='none' strokeWidth='1.5' strokeLinecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.85rem center',
      }}
    >
      {children}
    </select>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.7rem', fontWeight: 700, color: BLUE,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '0.6rem 0 0.4rem',
      borderTop: `1px solid ${BORDER}`, marginTop: '0.25rem',
    }}>
      {children}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function InspectionSetupScreen({ onJobCreated, onBack }: Props) {
  // Client
  const [clientName,  setClientName]  = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')

  // Inspector
  const [inspectorName, setInspectorName] = useState('')
  const [licenceNumber, setLicenceNumber] = useState('')
  const [company,       setCompany]       = useState('')

  // Address
  const [street,     setStreet]     = useState('')
  const [unit,       setUnit]       = useState('')
  const [city,       setCity]       = useState('')
  const [province,   setProvince]   = useState('Ontario')
  const [postalCode, setPostalCode] = useState('')
  const [country,    setCountry]    = useState('Canada')

  // Property details
  const [buildingType,     setBuildingType]     = useState<BuildingType>('single_storey_residential')
  const [estimatedAge,     setEstimatedAge]     = useState('')
  const [roofCovering,     setRoofCovering]     = useState('unknown')
  const [footingType,      setFootingType]      = useState('unknown')
  const [wallConstruction, setWallConstruction] = useState('unknown')
  const [internalWalls,    setInternalWalls]    = useState('Plasterboard')
  const [windows,          setWindows]          = useState('Aluminium')

  // Inspection context
  const [weather,    setWeather]    = useState<WeatherCondition>('fine')
  const [occupied,   setOccupied]   = useState(false)
  const [secure,     setSecure]     = useState(true)
  const [purposeNote, setPurposeNote] = useState('Pre-purchase building inspection')

  // UI
  const [step,    setStep]    = useState<1|2|3>(1)
  const [loading, setLoading] = useState(false)

  const canAdvanceStep1 = street.trim() && city.trim() && province.trim()
  const canAdvanceStep2 = buildingType && estimatedAge.trim()
  const canSubmit       = clientName.trim() && inspectorName.trim()

  function handleSubmit() {
    setLoading(true)
    const address: PropertyAddress = { street: street.trim(), unit: unit.trim()||undefined, city: city.trim(), province, postalCode: postalCode.trim(), country }
    const job = createNewJob({
      clientName: clientName.trim(), clientEmail: clientEmail.trim()||undefined,
      clientPhone: clientPhone.trim()||undefined,
      inspectorName: inspectorName.trim(), licenceNumber: licenceNumber.trim()||undefined,
      company: company.trim()||undefined,
      address, buildingType: buildingType as BuildingType,
      estimatedAge: estimatedAge.trim(),
      roofCovering: roofCovering as any, footingType: footingType as any,
      wallConstruction: wallConstruction as any, internalWalls, windows,
      isOccupied: occupied, isSecure: secure, weather, purposeNote,
      inspectionDate: new Date().toISOString().slice(0,10),
    })
    // Persist to sessionStorage for now (Supabase wiring in next iteration)
    try { sessionStorage.setItem(`insp_${job.id}`, JSON.stringify(job)) } catch {}
    setLoading(false)
    onJobCreated(job)
  }

  return (
    <div style={{ minHeight:'100dvh', background:BG, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:'#0D1E2E' }}>

      {/* ── Header ── */}
      <div style={{ background:NAVY, padding:'max(env(safe-area-inset-top,0px),1rem) 1.25rem 1rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.55)', fontSize:'0.85rem', cursor:'pointer', padding:0, flexShrink:0 }}>← Back</button>
        <div style={{ flex:1, display:'flex', justifyContent:'center' }}>
          <NavLogo height={24} />
        </div>
        <div style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.35)', flexShrink:0 }}>New Inspection</div>
      </div>

      {/* ── Step indicator ── */}
      <div style={{ background:NAVY, padding:'0 1.25rem 1.25rem' }}>
        <div style={{ display:'flex', gap:'0.4rem' }}>
          {[
            { n:1, label:'Location' },
            { n:2, label:'Property' },
            { n:3, label:'Parties' },
          ].map(s => (
            <div key={s.n} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'0.3rem' }}>
              <div style={{
                width:28, height:28, borderRadius:'50%',
                background: step === s.n ? ORANGE : step > s.n ? BLUE : 'rgba(255,255,255,0.12)',
                border: `2px solid ${step === s.n ? ORANGE : step > s.n ? BLUE : 'rgba(255,255,255,0.2)'}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'0.72rem', fontWeight:700,
                color: step >= s.n ? '#fff' : 'rgba(255,255,255,0.4)',
                transition:'all 0.2s',
              }}>{step > s.n ? '✓' : s.n}</div>
              <div style={{ fontSize:'0.6rem', color: step >= s.n ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Form body ── */}
      <div style={{ maxWidth:500, margin:'0 auto', padding:'1.25rem 1.25rem 6rem' }}>

        {/* STEP 1: Address */}
        {step === 1 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <div>
              <h2 style={{ fontSize:'1.2rem', fontWeight:700, margin:'0 0 0.25rem', color:NAVY }}>Property Address</h2>
              <p style={{ fontSize:'0.78rem', color:'#5E7D9B', margin:0, lineHeight:1.6 }}>Enter the address of the property being inspected.</p>
            </div>

            <div style={{ display:'flex', gap:'0.5rem' }}>
              <div style={{ flex:3 }}>
                <Label>Street Address *</Label>
                <Input value={street} onChange={setStreet} placeholder="123 Main Street" required />
              </div>
              <div style={{ flex:1 }}>
                <Label>Unit / Suite</Label>
                <Input value={unit} onChange={setUnit} placeholder="4B" />
              </div>
            </div>

            <div>
              <Label>City / Municipality *</Label>
              <Input value={city} onChange={setCity} placeholder="Toronto" required />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              <div>
                <Label>Province / State *</Label>
                <Select value={province} onChange={setProvince}>
                  <option>Ontario</option>
                  <option>British Columbia</option>
                  <option>Alberta</option>
                  <option>Quebec</option>
                  <option>Nova Scotia</option>
                  <option>New Brunswick</option>
                  <option>Manitoba</option>
                  <option>Saskatchewan</option>
                  <option>Newfoundland</option>
                  <option>PEI</option>
                  <option>Yukon</option>
                  <option>NWT</option>
                  <option>Nunavut</option>
                  <option>New York</option>
                  <option>California</option>
                  <option>Other</option>
                </Select>
              </div>
              <div>
                <Label>Postal / ZIP Code</Label>
                <Input value={postalCode} onChange={setPostalCode} placeholder="M5V 2T6" />
              </div>
            </div>

            <div>
              <Label>Country</Label>
              <Select value={country} onChange={setCountry}>
                <option>Canada</option>
                <option>United States</option>
                <option>United Kingdom</option>
                <option>Australia</option>
                <option>Other</option>
              </Select>
            </div>

            <div>
              <Label>Inspection Date</Label>
              <Input type="date" value={new Date().toISOString().slice(0,10)} onChange={() => {}} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              <div>
                <Label>Weather at Inspection</Label>
                <Select value={weather} onChange={v => setWeather(v as WeatherCondition)}>
                  <option value="fine">Fine</option>
                  <option value="overcast">Overcast</option>
                  <option value="light_rain">Light Rain</option>
                  <option value="heavy_rain">Heavy Rain</option>
                  <option value="windy">Windy</option>
                </Select>
              </div>
              <div style={{ display:'flex', flexDirection:'column', justifyContent:'flex-end', gap:'0.5rem' }}>
                <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.82rem', cursor:'pointer' }}>
                  <input type="checkbox" checked={occupied} onChange={e => setOccupied(e.target.checked)} />
                  Property occupied
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.82rem', cursor:'pointer' }}>
                  <input type="checkbox" checked={secure} onChange={e => setSecure(e.target.checked)} />
                  Property secure
                </label>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Property details */}
        {step === 2 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <div>
              <h2 style={{ fontSize:'1.2rem', fontWeight:700, margin:'0 0 0.25rem', color:NAVY }}>Building Details</h2>
              <p style={{ fontSize:'0.78rem', color:'#5E7D9B', margin:0, lineHeight:1.6 }}>Describe the property&apos;s construction and age.</p>
            </div>

            <div>
              <Label>Building Type *</Label>
              <Select value={buildingType} onChange={v => setBuildingType(v as BuildingType)}>
                <option value="single_storey_residential">Single Storey Residential</option>
                <option value="two_storey_residential">Two Storey Residential</option>
                <option value="semi_detached">Semi-Detached</option>
                <option value="townhouse">Townhouse</option>
                <option value="multi_unit_residential">Multi-Unit Residential</option>
                <option value="commercial">Commercial</option>
                <option value="industrial">Industrial</option>
                <option value="mixed_use">Mixed Use</option>
                <option value="other">Other</option>
              </Select>
            </div>

            <div>
              <Label>Estimated Building Age *</Label>
              <Input value={estimatedAge} onChange={setEstimatedAge} placeholder="e.g. Approx. 30 years" required />
            </div>

            <SectionHeading>Construction</SectionHeading>

            <div>
              <Label>Roof Covering</Label>
              <Select value={roofCovering} onChange={setRoofCovering}>
                <option value="unknown">Unknown / Not yet inspected</option>
                <option value="concrete_tiles">Concrete Tiles</option>
                <option value="clay_tiles">Clay Tiles</option>
                <option value="metal_deck">Metal Deck / Colorbond</option>
                <option value="asphalt_shingles">Asphalt Shingles</option>
                <option value="flat_membrane">Flat / Membrane</option>
                <option value="other">Other</option>
              </Select>
            </div>

            <div>
              <Label>Footings & Flooring</Label>
              <Select value={footingType} onChange={setFootingType}>
                <option value="unknown">Unknown</option>
                <option value="concrete_slab">Concrete Footings & Slab</option>
                <option value="piers_stumps">Piers / Stumps</option>
                <option value="strip_footing">Strip Footing</option>
              </Select>
            </div>

            <div>
              <Label>External Wall Construction</Label>
              <Select value={wallConstruction} onChange={setWallConstruction}>
                <option value="unknown">Unknown</option>
                <option value="brick_veneer">Brick Veneer</option>
                <option value="double_brick">Double Brick</option>
                <option value="timber_frame">Timber Frame</option>
                <option value="concrete_block">Concrete Block (CMU)</option>
                <option value="icf">Insulated Concrete Form (ICF)</option>
                <option value="steel_frame">Steel Frame</option>
                <option value="other">Other</option>
              </Select>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              <div>
                <Label>Internal Walls</Label>
                <Input value={internalWalls} onChange={setInternalWalls} placeholder="Plasterboard" />
              </div>
              <div>
                <Label>Windows</Label>
                <Input value={windows} onChange={setWindows} placeholder="Aluminium" />
              </div>
            </div>

            <SectionHeading>Inspection Purpose</SectionHeading>

            <div>
              <Label>Purpose Note</Label>
              <Input value={purposeNote} onChange={setPurposeNote} placeholder="Pre-purchase building inspection" />
            </div>
          </div>
        )}

        {/* STEP 3: Client + Inspector */}
        {step === 3 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <div>
              <h2 style={{ fontSize:'1.2rem', fontWeight:700, margin:'0 0 0.25rem', color:NAVY }}>Parties</h2>
              <p style={{ fontSize:'0.78rem', color:'#5E7D9B', margin:0, lineHeight:1.6 }}>Who commissioned the inspection and who is conducting it.</p>
            </div>

            <SectionHeading>Commissioned By</SectionHeading>

            <div>
              <Label>Client Name *</Label>
              <Input value={clientName} onChange={setClientName} placeholder="Jane Smith" required />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              <div>
                <Label>Email</Label>
                <Input type="email" value={clientEmail} onChange={setClientEmail} placeholder="jane@email.com" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input type="tel" value={clientPhone} onChange={setClientPhone} placeholder="(416) 555-0100" />
              </div>
            </div>

            <SectionHeading>Inspector</SectionHeading>

            <div>
              <Label>Inspector Name *</Label>
              <Input value={inspectorName} onChange={setInspectorName} placeholder="Jordan Yerbury" required />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              <div>
                <Label>Licence / Certificate No.</Label>
                <Input value={licenceNumber} onChange={setLicenceNumber} placeholder="OAA-123456" />
              </div>
              <div>
                <Label>Company</Label>
                <Input value={company} onChange={setCompany} placeholder="Just Open Technologies" />
              </div>
            </div>

            {/* Summary card */}
            <div style={{ background:'rgba(65,124,164,0.06)', border:`1px solid rgba(65,124,164,0.2)`, borderRadius:10, padding:'0.9rem 1rem', marginTop:'0.25rem' }}>
              <div style={{ fontSize:'0.68rem', fontWeight:600, color:BLUE, marginBottom:'0.5rem' }}>Inspection Summary</div>
              <div style={{ fontSize:'0.78rem', color:'#3A5A78', lineHeight:1.8 }}>
                <strong>{street}{unit ? ` #${unit}` : ''}</strong><br/>
                {city}, {province} {postalCode}<br/>
                {buildingType.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}<br/>
                {estimatedAge && `Est. age: ${estimatedAge}`}
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation buttons ── */}
        <div style={{ display:'flex', gap:'0.65rem', marginTop:'1.5rem' }}>
          {step > 1 && (
            <button onClick={() => setStep(s => (s - 1) as 1|2|3)}
              style={{ flex:1, padding:'0.9rem', background:WHITE, border:`1.5px solid ${BORDER}`, borderRadius:10, fontSize:'0.875rem', fontWeight:600, cursor:'pointer', color:'#3A5A78' }}>
              ← Back
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep(s => (s + 1) as 1|2|3)}
              disabled={step === 1 ? !canAdvanceStep1 : !canAdvanceStep2}
              style={{ flex:2, padding:'0.9rem', background: (step===1 ? canAdvanceStep1 : canAdvanceStep2) ? `linear-gradient(135deg,${BLUE},#2C5A7A)` : 'rgba(44,90,122,0.1)', border:'none', borderRadius:10, fontSize:'0.875rem', fontWeight:600, cursor: (step===1 ? canAdvanceStep1 : canAdvanceStep2) ? 'pointer':'not-allowed', color: (step===1 ? canAdvanceStep1 : canAdvanceStep2) ? '#fff':'#9DB4C5', transition:'all 0.15s' }}>
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              style={{ flex:2, padding:'0.9rem', background:canSubmit?`linear-gradient(135deg,${ORANGE},#C4721E)`:'rgba(242,147,55,0.15)', border:'none', borderRadius:10, fontSize:'0.875rem', fontWeight:700, cursor:canSubmit?'pointer':'not-allowed', color:canSubmit?'#fff':'rgba(242,147,55,0.5)', transition:'all 0.15s' }}>
              {loading ? 'Starting…' : 'Start Inspection →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
