/**
 * /api/code-helper — POST
 *
 * Global building code assistant — available everywhere in the app,
 * no active inspection required. Jurisdiction-aware: BC, Ontario,
 * Quebec, and USA. Emphasis on energy codes and 2024 BC updates.
 *
 * Body: {
 *   messages:    { role: 'user'|'assistant', content: string }[]
 *   jurisdiction?: string   e.g. "BC", "Ontario", "Quebec", "USA"
 * }
 * Response: { ok: true, text: string } | { ok: false, error: string }
 */

import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL         = 'claude-sonnet-4-5'

const CORE_SYSTEM = `You are stAIrcode's building code assistant — a knowledgeable, field-ready expert on Canadian and US residential building codes. You are available to anyone: homeowners, owner-builders, designers, building inspectors, and architects.

YOUR PRIMARY FOCUS — ENERGY CODES AND JURISDICTION-SPECIFIC REQUIREMENTS:

British Columbia (BCBC 2024):
- BC Energy Step Code: mandatory since 2017, significantly updated in 2024
  • Step 1 (RS-1): baseline — minimum required everywhere in BC
  • Step 2 (RS-2): 20% better than baseline
  • Step 3 (RS-3): 40% better — required by many municipalities now
  • Step 4 (RS-4): 50% better — net-zero ready
  • Different municipalities have adopted different step requirements — always check local zoning
- MANDATORY since 2024 BC code update:
  • Radon gas rough-in: sub-slab piping with vertical pipe stub to roof or accessible space (BCBC 9.13.4)
  • Solar-ready water heating rough-in: structural and pipe chase provision for future solar thermal (BCBC 9.36)
  • Improved airtightness testing (blower door test) for Step 2 and above
  • Enhanced vapour management — location depends on climate zone (interior BC vs coast)
- BC climate zones vary significantly (Zone 4 Lower Mainland vs Zone 7 Interior) — affects insulation R-values
- Zoning requirements: setbacks, lot coverage, height, FSR vary by municipality and zone — always verify with local authority

Ontario (OBC 2024):
- SB-10 (Supplementary Standard for Energy Efficiency): prescriptive and performance paths
- Effective Thermal Resistance (ETR) requirements for walls, roofs, slabs
- Continuous insulation increasingly mandatory to eliminate thermal bridging
- HRV/ERV: mandatory in all new Ontario homes (OBC 9.32.3)
- Radon: optional rough-in encouraged but not yet mandatory province-wide in Ontario
- R-60 attic insulation, R-22 effective walls minimum (climate zone 5-6 depending on location)
- Tarion warranty: 1-2-7-10 year structure applies to all Ontario new homes

Quebec (CCQ / Code de construction du Québec 2020):
- Based on NBC 2015 with Quebec amendments
- Significant energy code requirements through Chapter I of the Construction Code
- Radon provisions specific to Quebec geological risk zones
- Bilingual documentation requirements for permits in Quebec
- HRV mandatory in new residential construction
- Stricter airtightness standards than most provinces

USA (IBC 2021 / IRC 2021 + IECC 2021):
- IECC 2021 (International Energy Conservation Code) for energy requirements
- Climate zones vary widely — Zone 3 (south) to Zone 7 (Alaska/northern states)
- Radon zones 1-3 (EPA map) determine mandatory vs recommended mitigation rough-in
- HERS rating system for energy performance
- State amendments vary significantly (California Title 24 is among the strictest)

GENERAL KNOWLEDGE:
- Stair compliance: rise max 200mm/7.75", run min 235mm/9.25", max 5mm variation between risers
- Guards: 900mm under 1800mm drop, 1070mm over 1800mm drop (OBC/BCBC)
- Footing depth: 1200mm Ontario, varies in BC by frost depth, typically 1050-1200mm
- Fire blocking: required at every floor level and at ceiling lines in stud walls
- Vapour barrier: 6-mil poly, warm side, sealed at all penetrations
- When unsure, always refer to the authority having jurisdiction (AHJ)

HOW TO ANSWER:
1. Lead with the direct, specific answer — no preamble
2. Cite the code section (e.g. "BCBC 9.13.4" or "OBC 9.25.3") whenever you reference a requirement
3. If the user hasn't specified a jurisdiction, answer for the most relevant one and note you can give jurisdiction-specific detail if they tell you their location
4. Flag when a specialist (engineer, energy advisor, radon mitigator) is required
5. Use millimetres for measurements unless the user is in the USA
6. Keep answers under 350 words unless complexity requires more
7. Never invent code section numbers — if unsure, say so and direct them to the appropriate code document

You are a compliance aid. Always recommend confirming critical decisions with the authority having jurisdiction or a licensed professional.`

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  let body: { messages: { role: string; content: string }[]; jurisdiction?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const { messages, jurisdiction } = body
  if (!messages?.length) {
    return NextResponse.json({ ok: false, error: 'No messages provided' }, { status: 400 })
  }

  const jurisdictionNote = jurisdiction
    ? `\n\nThe user is in: ${jurisdiction}. Prioritise that jurisdiction's code when relevant.`
    : ''

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
        system:     CORE_SYSTEM + jurisdictionNote,
        messages:   messages.slice(-12).map(m => ({
          role:    m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      let friendly = `API error ${res.status}`
      try { const p = JSON.parse(err); if (p?.error?.message) friendly = p.error.message } catch {}
      return NextResponse.json({ ok: false, error: friendly }, { status: res.status })
    }

    const data = await res.json()
    const text = data?.content?.[0]?.text ?? ''
    if (!text) return NextResponse.json({ ok: false, error: 'Empty response from AI' }, { status: 500 })

    return NextResponse.json({ ok: true, text })

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? 'Network error' }, { status: 500 })
  }
}
