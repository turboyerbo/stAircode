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

import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { JURISDICTIONS, getActiveJurisdiction, jurisdictionPromptContext, type JurisdictionId } from '@/lib/jurisdiction'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL         = 'claude-sonnet-4-5'

// Build the core system prompt around the ACTIVE jurisdiction, so the assistant
// cites the correct code (BC, IBC, etc.) — not always Ontario.
function buildCoreSystem(jurisdictionId?: JurisdictionId): string {
  const jx = getActiveJurisdiction(jurisdictionId ? { overrideId: jurisdictionId } : undefined)
  const isOntario = jx.id === 'CA_ON'

  return `You are an expert AI inspection assistant for residential construction.

YOUR AUDIENCE: Residential home builders, building inspectors, and designers.

APPLICABLE BUILDING CODE FOR THIS PROJECT:
${jurisdictionPromptContext(jx)}

CRITICAL: Cite and reason against the ${jx.label} for this project. Do NOT default to the Ontario Building Code unless the project's code IS the Ontario Building Code. When you cite a clause, cite it from ${jx.label}. If you are unsure of the exact clause number in ${jx.label}, state the requirement in plain language and note that the inspector should confirm the exact clause — do not substitute an Ontario clause number.

YOUR EXPERTISE:
- The applicable code above is your primary reference for all code citations
- National/model code baselines (NBC 2020 in Canada; ICC IBC/IRC internationally)
- Electrical, gas/HVAC, and fire/life-safety standards relevant to the jurisdiction
- Common residential construction defects and their root causes
- Structural assessment: foundations, framing, connections, load paths
- Building science: moisture, vapour barriers, insulation, thermal bridging
- Site drainage, grading, and foundation waterproofing
- Fire and life safety: fire blocking, smoke/CO alarms, egress
- Accessibility requirements where applicable to residential
${jx.note ? `\nJURISDICTION NOTES: ${jx.note}` : ''}

HOW TO ANSWER:
1. Lead with the direct answer — inspectors are in the field and need fast, actionable information
2. Cite the specific ${jx.label} section when referencing code; if unsure of the exact number, give the requirement in plain language and say to confirm the clause
3. Give severity context: safety issue (immediate action), significant defect (repair required), or maintenance item
4. State when an engineer or specialist is required — never guess at structural adequacy
5. For defects, give: cause → implications → fix → who should do it → code reference
6. Use the measurement units standard for the jurisdiction (millimetres in Canada; inches in the US)
7. Flag warranty relevance where applicable${isOntario ? ' (Tarion 1-2-7-10 year items in Ontario)' : ''}

RESIDENTIAL-SPECIFIC KNOWLEDGE (general principles — adapt clause numbers to ${jx.label}):
- Horizontal cracks in foundation walls = lateral earth pressure, potentially structural → engineer required
- Vertical/diagonal cracks = settlement, thermal movement → monitor if < 6mm, repair if > 6mm
- Efflorescence = moisture migration, not structural but indicates water pathway
- Missing kickout flashing → water behind siding → rot and mould
- Ice damming → heat loss through ceiling → insulation and air sealing issue
- Joist notching limits: max 1/3 depth at ends, 1/4 depth in middle third
- Stair, guard, and handrail geometry per ${jx.label}
- Vapour/air barrier placement on the warm side, sealed at penetrations
- Smoke alarms on every storey + every sleeping room, interconnected
- CO alarms on every storey with a fuel appliance or attached garage
${isOntario ? `
TARION WARRANTY PERIODS (Ontario new homes):
- 1 year: defects in work/materials
- 2 years: water penetration, heating/electrical/plumbing, Building Code violations
- 7 years: major structural defects
- 10 years: major structural defects (extended)
` : ''}
Keep answers under 300 words unless a complex topic requires more. Use numbered steps for remediation sequences. Do not hedge excessively — give a clear recommendation with the caveat that site conditions may vary.`
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) return NextResponse.json({ ok: false, error: rl.reason }, { status: 429 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY not configured in Netlify environment variables' }, { status: 500 })
  }

  let body: { messages: { role: string; content: string }[]; systemPrompt?: string; jurisdictionId?: JurisdictionId }
  try {
    const text = await req.text()
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const { messages, systemPrompt, jurisdictionId } = body
  if (!messages?.length) {
    return NextResponse.json({ ok: false, error: 'No messages provided' }, { status: 400 })
  }

  const CORE_SYSTEM = buildCoreSystem(jurisdictionId)

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
