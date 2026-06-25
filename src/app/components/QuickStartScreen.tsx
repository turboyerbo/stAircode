'use client'
/**
 * QuickStartScreen.tsx
 *
 * Low-friction start for a new inspection. Asks ONLY for the property address,
 * shows it on an embedded map, then jumps straight into the modules dashboard.
 *
 * All the building-detail questions (type, age, materials, client info) are
 * deferred until the user generates a report — so they can start scanning in
 * seconds. The created job is a full-building inspection by default.
 */
import { useState, useRef, useCallback } from 'react'
import { createNewJob } from '@/lib/inspection-types'
import type { InspectionJob } from '@/lib/inspection-types'
import { NavLogo } from './Logo'

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const GREEN  = '#27A96B'
const BORDER = 'rgba(44,90,122,0.14)'

interface Suggestion {
  displayName: string; street: string; city: string; province: string
  postalCode: string; country: string; countryCode: string; lat: number; lon: number
}

interface Props {
  onStart: (job: InspectionJob) => void
  onBack:  () => void
}

export default function QuickStartScreen({ onStart, onBack }: Props) {
  const [street,      setStreet]      = useState('')
  const [city,        setCity]        = useState('')
  const [province,    setProvince]    = useState('')
  const [postalCode,  setPostalCode]  = useState('')
  const [country,     setCountry]     = useState('')
  const [lat,         setLat]         = useState<number | null>(null)
  const [lon,         setLon]         = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [busy,        setBusy]        = useState(false)
  const acTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); return }
    try {
      const params = new URLSearchParams({ q })
      const res  = await fetch(`/api/address-search?${params}`)
      const data = await res.json()
      setSuggestions(data.results ?? [])
      setShowSuggest(true)
    } catch { setSuggestions([]) }
  }, [])

  function handleStreetChange(v: string) {
    setStreet(v); setLat(null); setLon(null)
    if (acTimer.current) clearTimeout(acTimer.current)
    acTimer.current = setTimeout(() => fetchSuggestions(v), 300)
  }

  function applySuggestion(s: Suggestion) {
    setStreet(s.street || s.displayName)
    if (s.city)       setCity(s.city)
    if (s.province)   setProvince(s.province)
    if (s.postalCode) setPostalCode(s.postalCode)
    if (s.country)    setCountry(s.country)
    if (s.lat)        setLat(s.lat)
    if (s.lon)        setLon(s.lon)
    setSuggestions([]); setShowSuggest(false)
  }

  function startInspection() {
    setBusy(true)
    const job = createNewJob({
      projectType: 'new_construction',
      status: 'active',
      address: {
        street: street.trim(),
        city:   city.trim(),
        province: province.trim() || 'Ontario',
        postalCode: postalCode.trim(),
        country: country.trim() || 'Canada',
      },
      clientName:    'Homeowner',
      inspectorName: '',
    })
    onStart(job)
  }

  const hasAddress = street.trim().length > 2
  // Map embed — Google Maps embed works without an API key for basic place/coords
  const mapQuery = lat && lon
    ? `${lat},${lon}`
    : encodeURIComponent([street, city, province, country].filter(Boolean).join(', '))
  const mapSrc = `https://maps.google.com/maps?q=${mapQuery}&t=&z=16&ie=UTF8&iwloc=&output=embed`

  return (
    <div style={{ minHeight: '100dvh', background: '#F4F7FB', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: NAVY, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: NAVY, paddingTop: 'max(env(safe-area-inset-top,0px),1rem)', paddingBottom: '1.25rem', paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>← Back</button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><NavLogo height={22} /></div>
          <div style={{ width: 40 }} />
        </div>
        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>New Inspection</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: '0 0 0.3rem', lineHeight: 1.2 }}>Where are you inspecting?</h1>
        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5 }}>Just the address to start — you can add all the details later when you generate your report.</p>
      </div>

      <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {/* Address input */}
        <div style={{ position: 'relative' }}>
          <input
            value={street}
            onChange={e => handleStreetChange(e.target.value)}
            placeholder="Start typing the property address…"
            autoFocus
            style={{ width: '100%', padding: '0.95rem 1rem', background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 12, fontSize: '0.95rem', color: NAVY, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          {showSuggest && suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.3rem', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(10,28,46,0.15)', zIndex: 10, overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => applySuggestion(s)}
                  style={{ width: '100%', padding: '0.8rem 1rem', background: 'none', border: 'none', borderBottom: i < suggestions.length - 1 ? `1px solid ${BORDER}` : 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.82rem', color: NAVY, lineHeight: 1.4 }}>
                  {s.displayName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map preview */}
        {hasAddress && (
          <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${BORDER}`, height: 240, background: '#E8EEF4' }}>
            <iframe
              title="Property location"
              src={mapSrc}
              width="100%" height="100%"
              style={{ border: 0, display: 'block' }}
              loading="lazy"
            />
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Start button */}
        <button
          onClick={startInspection}
          disabled={!hasAddress || busy}
          style={{ width: '100%', padding: '1.05rem', background: !hasAddress || busy ? 'rgba(65,124,164,0.35)' : `linear-gradient(135deg,${NAVY},#1A3A58)`, border: 'none', borderRadius: 13, color: '#fff', fontSize: '0.98rem', fontWeight: 800, cursor: !hasAddress || busy ? 'default' : 'pointer', boxShadow: hasAddress && !busy ? '0 4px 18px rgba(10,28,46,0.25)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          {busy ? 'Starting…' : 'Start Inspecting →'}
        </button>
        <p style={{ fontSize: '0.66rem', color: '#9DB4C5', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
          Jump straight to capturing photos. We&apos;ll ask for building details, client info, and materials when you&apos;re ready to generate the report.
        </p>
      </div>
    </div>
  )
}
