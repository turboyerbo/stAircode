/**
 * /api/address-search — GET ?q=<query>&lat=<lat>&lon=<lon>
 *
 * Server-side Nominatim address search.
 * Returns up to 5 address suggestions for autocomplete.
 * Proxied server-side to avoid CORS restrictions.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q   = req.nextUrl.searchParams.get('q')?.trim()
  const lat = req.nextUrl.searchParams.get('lat')
  const lon = req.nextUrl.searchParams.get('lon')

  if (!q || q.length < 3) {
    return NextResponse.json({ results: [] })
  }

  const params = new URLSearchParams({
    q,
    format:          'json',
    addressdetails:  '1',
    limit:           '6',
    dedupe:          '1',
    // Bias toward current location if available
    ...(lat && lon ? { viewbox: `${parseFloat(lon)-0.5},${parseFloat(lat)-0.5},${parseFloat(lon)+0.5},${parseFloat(lat)+0.5}`, bounded: '0' } : {}),
  })

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: { 'User-Agent': 'stAIrcode/1.0 (info@staircode.app)' },
        next: { revalidate: 300 },   // cache 5 min
      }
    )

    if (!res.ok) return NextResponse.json({ results: [] })

    const data = await res.json()

    const results = (data as any[])
      .filter(r => r.address)
      .map(r => {
        const a = r.address
        const houseNumber = a.house_number ?? ''
        const road        = a.road ?? a.pedestrian ?? a.footway ?? ''
        const street      = [houseNumber, road].filter(Boolean).join(' ')
        const city        = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? ''
        const province    = a.state ?? a.province ?? a.region ?? ''
        const postalCode  = a.postcode ?? ''
        const country     = a.country ?? ''
        const countryCode = (a.country_code ?? '').toUpperCase()

        return {
          displayName: r.display_name as string,
          street:      street || r.display_name.split(',')[0],
          city,
          province,
          postalCode,
          country,
          countryCode,
          lat:         parseFloat(r.lat),
          lon:         parseFloat(r.lon),
        }
      })
      .filter(r => r.street)   // must have a street component
      .slice(0, 5)

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
