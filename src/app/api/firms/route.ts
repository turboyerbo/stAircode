/**
 * src/app/api/firms/route.ts
 *
 * GET /api/firms?lat=…&lng=…
 * Returns nearby architecture/engineering firms from OpenStreetMap Overpass API.
 * Firm query logic is server-side only — not exposed to the browser.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const RADIUS_M     = 5000
const MAX_RESULTS  = 12

function buildQuery(lat: number, lng: number) {
  return `
    [out:json][timeout:10];
    (
      node["office"="architect"](around:${RADIUS_M},${lat},${lng});
      node["office"="engineer"](around:${RADIUS_M},${lat},${lng});
      node["office"="structural_engineer"](around:${RADIUS_M},${lat},${lng});
      node["building"="office"]["office"~"architect|engineer"](around:${RADIUS_M},${lat},${lng});
    );
    out body ${MAX_RESULTS};
  `.trim()
}

interface OSMNode {
  id:   number
  lat:  number
  lon:  number
  tags: Record<string, string>
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.reason }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    `data=${encodeURIComponent(buildQuery(lat, lng))}`,
      signal:  AbortSignal.timeout(12_000),
    })

    if (!response.ok) throw new Error(`Overpass ${response.status}`)

    const data = await response.json()
    const elements: OSMNode[] = data.elements ?? []

    const firms = elements
      .filter(n => n.tags?.name)
      .map(n => ({
        id:      n.id,
        name:    n.tags.name,
        lat:     n.lat,
        lng:     n.lon,
        type:    n.tags.office ?? 'firm',
        phone:   n.tags.phone   ?? n.tags['contact:phone']   ?? null,
        website: n.tags.website ?? n.tags['contact:website'] ?? null,
        address: [
          n.tags['addr:housenumber'],
          n.tags['addr:street'],
          n.tags['addr:city'],
        ].filter(Boolean).join(' ') || null,
      }))
      .slice(0, MAX_RESULTS)

    return NextResponse.json({ firms })
  } catch (err) {
    console.error('[firms] Error:', err)
    return NextResponse.json({ firms: [] })
  }
}
