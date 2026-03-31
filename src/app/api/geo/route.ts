/**
 * GET /api/geo
 *
 * Server-side IP geolocation — avoids browser CSP restrictions.
 * Called from the client; this route fetches from third-party APIs
 * on the server where CSP doesn't apply.
 *
 * Returns: { city, province, country, countryCode, lat, lon }
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  // If GPS coords provided — do reverse geocode via Nominatim
  if (lat && lon) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { 'User-Agent': 'stAIrcode/1.0 (info@staircode.app)' } }
      )
      if (res.ok) {
        const d = await res.json()
        const a = d.address ?? {}
        return NextResponse.json({
          city:        a.city ?? a.town ?? a.village ?? a.municipality ?? 'Unknown',
          province:    a.state ?? a.province ?? a.region ?? '',
          country:     a.country ?? '',
          countryCode: (a.country_code ?? 'CA').toUpperCase(),
          lat: parseFloat(lat), lon: parseFloat(lon),
          source: 'nominatim-gps',
        })
      }
    } catch {}
  }

  // Get the real client IP from headers
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '8.8.8.8'

  // Don't geolocate localhost/private IPs
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168') || ip.startsWith('10.')) {
    return NextResponse.json({
      city: 'Toronto', province: 'Ontario',
      country: 'Canada', countryCode: 'CA', lat: 43.65, lon: -79.38,
      source: 'default',
    })
  }

  // Try ip-api.com (free, 45 req/min, HTTPS)
  try {
    const res = await fetch(
      `https://ip-api.com/json/${ip}?fields=status,city,regionName,country,countryCode,lat,lon`,
      { next: { revalidate: 3600 } }  // cache 1h per IP
    )
    if (res.ok) {
      const d = await res.json()
      if (d.status === 'success' && d.city) {
        return NextResponse.json({
          city:        d.city,
          province:    d.regionName ?? '',
          country:     d.country ?? '',
          countryCode: (d.countryCode ?? 'CA').toUpperCase(),
          lat:         d.lat,
          lon:         d.lon,
          source:      'ip-api',
        })
      }
    }
  } catch {}

  // Try ipapi.co as fallback
  try {
    const res2 = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { 'User-Agent': 'stAIrcode/1.0' },
    })
    if (res2.ok) {
      const d2 = await res2.json()
      if (d2.city && !d2.error) {
        return NextResponse.json({
          city:        d2.city,
          province:    d2.region ?? '',
          country:     d2.country_name ?? '',
          countryCode: (d2.country_code ?? 'CA').toUpperCase(),
          lat:         d2.latitude,
          lon:         d2.longitude,
          source:      'ipapi.co',
        })
      }
    }
  } catch {}

  // Final fallback — Toronto (most likely Canadian user)
  return NextResponse.json({
    city: 'Unknown', province: '', country: '', countryCode: 'CA',
    lat: null, lon: null, source: 'fallback',
  })
}
