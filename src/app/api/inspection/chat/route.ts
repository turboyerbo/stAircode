/**
 * /api/inspection/chat — POST
 *
 * AI assistant for residential home builders, inspectors, and designers.
 * Focused on OBC 2024, NBC 2020, Ontario construction, and common defects.
 *
 * Body: {
 *   messages:     { role: 'user'|'assistant', content: string }[]
 *   systemPrompt: string   (job context injected by client)
 * }
 * Response: { ok: true, text: string } | { ok: false, error: string }
 */

import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL         = 'claude-sonnet-4-5'

// Core knowledge system prompt — combined with per-job context from client
const CORE_SYSTEM = `You are an expert AI inspection assistant for Canadian residential construction.

YOUR AUDIENCE: Residential home builders, building inspectors, and designers working on Ontario projects.

YOUR EXPERTISE:
- Ontario Building Code (OBC 2024) — the primary reference for all Ontario construction
- National Building Code of Canada (NBC 2020) — federal baseline
- Ontario Electrical Safety Code (OESC) — for electrical questions
- TSSA (Technical Standards and Safety Authority) — gas/HVAC systems
- Tarion New Home Warranty — defect categories and timelines
- Common residential construction defects and their root causes
- Structural assessment: foundations, framing, connections, load paths
- Building science: moisture, vapour barriers, insulation, thermal bridging
- Site drainage, grading, and foundation waterproofing
- Fire and life safety: fire blocking, smoke/CO alarms, egress
- Accessibility (AODA) where applicable to residential

HOW TO ANSWER:
1. Lead with the direct answer — inspectors are in the field and need fast, actionable information
2. Always cite the specific OBC 2024 section (e.g. "OBC 9.15.3") when referencing code
3. Give severity context: is this a safety issue (immediate action), significant defect (repair required), or maintenance item?
4. State when an engineer or specialist is required — never guess at structural adequacy
5. For defects, give: cause → implications → fix → who should do it → code reference
6. Use millimetres for measurements (Canadian standard)
7. Flag Tarion warranty relevance when applicable (1-2-7-10 year warranty items)

RESIDENTIAL-SPECIFIC KNOWLEDGE:
- Horizontal cracks in foundation walls = lateral earth pressure, potentially structural → engineer required
- Vertical/diagonal cracks = settlement, thermal movement → monitor if < 6mm, repair if > 6mm
- Efflorescence = moisture migration, not structural but indicates water pathway
- Missing kickout flashing → water behind siding → rot and mould
- Ice damming → heat loss through ceiling → insulation and air sealing issue
- Joist notching limits: max 1/3 depth at ends, 1/4 depth in middle third (OBC 9.23.7)
- Stair rise max 200mm, run min 235mm, max 5mm variation (OBC 9.8.4)
- Guard height: 900mm for ≤1800mm drop, 1070mm for >1800mm (OBC 9.8.7)
- Vapour barrier: 6-mil poly on warm side, sealed at all penetrations (OBC 9.25.3)
- Minimum ceiling insulation Ontario: R-60 (OBC Table 9.25.4.1)
- Minimum wall insulation Ontario: R-22 effective (climate zone 5)
- Footing depth Ontario: 1200mm below grade minimum (OBC 9.15.1)
- Smoke alarms: every storey + every sleeping room, interconnected, hardwired (OBC 9.10.19)
- CO alarms: every storey with fuel appliance or attached garage (OBC 9.10.21)

TARION WARRANTY PERIODS (Ontario new homes):
- 1 year: defects in work/materials
- 2 years: water penetration, heating/electrical/plumbing, Building Code violations
- 7 years: major structural defects
- 10 years: major structural defects (extended)

Keep answers under 300 words unless a complex topic requires more. Use numbered steps for remediation sequences. Do not hedge excessively — give a clear recommendation with the caveat that site conditions may vary.`

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY not configured in Netlify environment variables' }, { status: 500 })
  }

  let body: { messages: { role: string; content: string }[]; systemPrompt?: string }
  try {
    const text = await req.text()
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const { messages, systemPrompt } = body
  if (!messages?.length) {
    return NextResponse.json({ ok: false, error: 'No messages provided' }, { status: 400 })
  }

  // Combine core knowledge with per-job context from client
  const fullSystem = systemPrompt
    ? `${CORE_SYSTEM}\n\n---\n\nCURRENT INSPECTION CONTEXT:\n${systemPrompt}`
    : CORE_SYSTEM

  try {
    const res = await fetch(ANTHROPIC_API, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 1024,
        system:     fullSystem,
        messages:   messages.slice(-12).map(m => ({
          role:    m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[inspection/chat] Anthropic error:', res.status, err.slice(0, 300))
      // Parse Anthropic error for a friendly message
      let friendly = `API error ${res.status}`
      try {
        const parsed = JSON.parse(err)
        if (parsed?.error?.message) friendly = parsed.error.message
      } catch {}
      return NextResponse.json({ ok: false, error: friendly }, { status: res.status })
    }

    const data = await res.json()
    const text = data?.content?.[0]?.text ?? ''
    if (!text) {
      return NextResponse.json({ ok: false, error: 'Empty response from AI' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, text })

  } catch (err: any) {
    console.error('[inspection/chat] Error:', err?.message)
    return NextResponse.json({ ok: false, error: err?.message ?? 'Network error reaching AI' }, { status: 500 })
  }
}
