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
const CORE_SYSTEM = `You are an expert AI inspection assistant for Canadian and US residential construction.

YOUR AUDIENCE: Residential home builders, building inspectors, and designers.

YOUR EXPERTISE — JURISDICTION-SPECIFIC BUILDING CODES:

British Columbia (BCBC 2024):
- BC Energy Step Code tiers: RS-1 (baseline) through RS-4 (net-zero ready)
  RS-1: minimum required everywhere · RS-2: 20% better · RS-3: 40% better · RS-4: 50% better
  Many BC municipalities now require RS-3 or RS-4 — always verify with local authority
- Mandatory since 2024 BC code update:
  • Radon gas rough-in: sub-slab piping with vertical stub-out to roof (BCBC 9.13.4)
  • Solar-ready water heating rough-in: structural + pipe chase provision (BCBC 9.36)
  • Blower door airtightness test required for Step 2 and above
- Climate zones vary: Zone 4 (Lower Mainland) vs Zone 6-7 (Interior) — affects R-values and vapour management

Ontario (OBC 2024):
- SB-10 energy efficiency: prescriptive and performance paths
- HRV/ERV mandatory in all new Ontario homes (OBC 9.32.3)
- Minimum insulation: R-60 attic, R-22 effective walls (climate zone 5)
- Footing depth: 1200mm below grade (OBC 9.15.1)
- Tarion warranty: 1-2-7-10 year structure
- Smoke alarms: every storey + every sleeping room, interconnected, hardwired (OBC 9.10.19)
- CO alarms: every storey with fuel appliance or attached garage (OBC 9.10.21)

Quebec (CCQ 2020):
- Based on NBC 2015 with Quebec amendments
- HRV mandatory in new residential construction
- Radon provisions based on Quebec geological risk zones
- Energy performance chapter I of Construction Code

National / Other provinces (NBC 2020):
- Federal baseline for provinces without their own code

USA (IBC/IRC 2021 + IECC 2021):
- IECC climate zones 1-7 determine insulation requirements
- Radon zones 1-3 (EPA) determine mandatory vs recommended rough-in
- HERS rating system for energy performance
- State amendments vary significantly

RESIDENTIAL-SPECIFIC KNOWLEDGE:
- Stair rise max 200mm, run min 235mm, max 5mm variation between risers (OBC 9.8.4 / BCBC)
- Guard height: 900mm for ≤1800mm drop, 1070mm for >1800mm (OBC 9.8.7)
- Horizontal cracks in foundation walls = lateral earth pressure → engineer required
- Vertical/diagonal cracks = settlement/thermal movement → monitor if <6mm, repair if >6mm
- Joist notching limits: max 1/3 depth at ends, 1/4 depth in middle third (OBC 9.23.7)
- Vapour barrier: 6-mil poly on warm side, sealed at all penetrations (OBC 9.25.3)

HOW TO ANSWER:
1. Lead with the direct answer — inspectors are in the field and need fast, actionable information
2. Always cite the specific code section (e.g. "BCBC 9.13.4" or "OBC 9.15.3") when referencing code
3. Give severity context: safety issue (immediate action), significant defect (repair required), or maintenance item
4. State when an engineer or specialist is required — never guess at structural adequacy
5. For defects: cause → implications → fix → who should do it → code reference
6. Use millimetres for measurements (Canadian standard) unless working with US jurisdiction
7. Flag Tarion warranty relevance for Ontario new homes (1-2-7-10 year warranty items)

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
