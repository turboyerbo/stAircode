/**
 * /api/drawings-chat — POST
 *
 * Multi-turn AI chat grounded in uploaded architectural drawings.
 * Supports both initial extraction (extract structured fields from drawings)
 * and follow-up chat (answer questions about the drawings).
 *
 * Body:
 *   {
 *     mode:         'extract' | 'chat'
 *     pages:        string[]          // base64 JPEG pages (max 20)
 *     messages?:    {role,content}[]  // conversation history for 'chat' mode
 *     userMessage?: string            // latest user message for 'chat' mode
 *     jobContext?:  {address, buildingType, province}
 *   }
 *
 * Response:
 *   {
 *     text:    string              // AI response text
 *     fields?: DrawingsFields      // populated on mode:'extract'
 *   }
 *
 * DrawingsFields (all extracted from drawings):
 *   permitNumber, permitDate, applicant, architect, engineer,
 *   projectAddress, zoneClass, lotArea, buildingArea, grossFloorArea,
 *   lotCoverage, frontSetback, rearSetback, sideSetbackLeft,
 *   sideSetbackRight, buildingHeight, stories, parkingSpaces,
 *   fireSeparation, occupancyClass, constructionType, notes
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'

export const maxDuration = 60

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL   = 'claude-sonnet-4-5'

// System prompt for the drawings analysis assistant
function buildSystemPrompt(jobContext?: { address?: string; buildingType?: string; province?: string }) {
  const location = jobContext?.address ?? 'Not specified'
  const prov = (jobContext?.province ?? '').toLowerCase()
  const code =
    prov.includes('ontario') || prov === 'on' ? 'Ontario Building Code 2024' :
    prov.includes('quebec') || prov.includes('québec') || prov === 'qc' ? 'Code de construction du Québec (CCQ 2015 / RBQ)' :
    prov.includes('british columbia') || prov === 'bc' ? 'BC Building Code 2024' :
    prov.includes('alberta') || prov === 'ab' ? 'Alberta Building Code 2019' :
    jobContext?.province ? `${jobContext.province} Building Code (NBC 2020 base)` :
    'applicable building code'

  return `You are an expert building inspector and code compliance consultant specialising in residential construction documentation. You are analysing approved architectural drawings for a building inspection.

PROPERTY: ${location}
APPLICABLE CODE: ${code}

You have been given the approved drawings submitted to and approved by the Authority Having Jurisdiction (AHJ) / municipality. These drawings represent the design intention that was legally approved. During the inspection, field conditions will be checked against these drawings.

YOUR ROLE:
1. Extract key compliance data from the drawings: permit numbers, setbacks, lot coverage, building height, occupancy class, construction type, etc.
2. Answer specific questions about the drawings: "What is the approved ceiling height?", "What fire separation is required between the garage and house?"
3. Flag any code compliance issues visible in the approved drawings
4. When field conditions are later described, compare them to these drawings

Be precise. Quote section numbers, dimension callouts, and note titles from the drawings directly. If information is not visible in the provided pages, say so clearly.

IMPORTANT: These are APPROVED drawings. Differences between these and field conditions are deficiencies that must be documented.`
}

// Extraction prompt — pulls structured fields from drawings
const EXTRACTION_PROMPT = `Analyse these architectural drawings and extract all available information. Look at:
- Title block (permit number, date, applicant, architect, engineer, address)
- Site plan (setbacks, lot coverage, lot area, building area, parking)
- Building sections and elevations (heights, stories)
- Occupancy classification notes
- Construction type notes
- Any code compliance tables or summaries

Reply ONLY with valid JSON, no markdown:
{
  "permitNumber": "string or null",
  "permitDate": "string or null",
  "applicant": "string or null",
  "architect": "string or null",
  "engineer": "string or null",
  "projectAddress": "string or null",
  "zoneClass": "string or null",
  "lotArea": "number in m² or null",
  "buildingArea": "number in m² or null",
  "grossFloorArea": "number in m² or null",
  "lotCoverage": "percentage string or null",
  "frontSetback": "number in metres or null",
  "rearSetback": "number in metres or null",
  "sideSetbackLeft": "number in metres or null",
  "sideSetbackRight": "number in metres or null",
  "buildingHeight": "number in metres or null",
  "stories": "number or null",
  "parkingSpaces": "number or null",
  "fireSeparation": "string describing fire separation requirements or null",
  "occupancyClass": "string e.g. Group C — Residential or null",
  "constructionType": "string e.g. Part 9 — Wood Frame or null",
  "drawingSheets": "array of sheet names/numbers found",
  "revisionDate": "string or null",
  "codeNotes": "array of important code compliance notes from the drawings",
  "summary": "2-3 sentence description of what these drawings show"
}`

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) return NextResponse.json({ error: rl.reason }, { status: 429 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 503 })

  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const { mode = 'extract', pages = [], messages = [], userMessage = '', jobContext } = body

  if (!pages?.length) return NextResponse.json({ error: 'No drawing pages provided' }, { status: 400 })
  if (pages.length > 20) return NextResponse.json({ error: 'Maximum 20 pages per upload' }, { status: 400 })

  // Build image content blocks (up to 8 pages for the API call to stay within limits)
  const pagesToSend = pages.slice(0, 8)
  const imageBlocks = pagesToSend.map((b64: string) => ({
    type:   'image',
    source: {
      type:       'base64',
      media_type: b64.startsWith('/9j/') ? 'image/jpeg' : 'image/png',
      data:       b64,
    },
  }))

  try {
    if (mode === 'extract') {
      // One-shot extraction of structured fields
      const response = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model:      MODEL,
          max_tokens: 4096,
          system:     buildSystemPrompt(jobContext),
          messages: [{
            role:    'user',
            content: [
              ...imageBlocks,
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          }],
        }),
      })
      if (!response.ok) {
        const err = await response.text()
        console.error('[drawings-chat/extract]', response.status, err)
        return NextResponse.json({ error: 'AI extraction failed' }, { status: 502 })
      }
      const data = await response.json()
      const raw  = data.content?.[0]?.text ?? ''
      let fields = null
      try {
        const m = raw.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
        if (m) fields = JSON.parse(m[0])
      } catch {}
      return NextResponse.json({ text: raw, fields })

    } else {
      // Chat mode — multi-turn conversation with drawings in context
      // First message always includes the drawings; subsequent messages are text-only
      const isFirstMessage = messages.length === 0

      const conversationMessages = [
        // If this is the first message, include drawings in the first turn
        ...(isFirstMessage ? [{
          role:    'user',
          content: [
            ...imageBlocks,
            { type: 'text', text: `I have uploaded the approved architectural drawings. ${userMessage || 'Please introduce yourself and give me a brief summary of what you can see in these drawings.'}` },
          ],
        }] : [
          // Include first turn with drawings context summary, then continue
          {
            role:    'user',
            content: [
              ...imageBlocks,
              { type: 'text', text: 'These are the approved architectural drawings.' },
            ],
          },
          { role: 'assistant', content: 'I have reviewed the approved architectural drawings. I can answer questions about the design, dimensions, code compliance requirements, setbacks, and any other information shown in the documents.' },
          ...messages,
          { role: 'user', content: userMessage },
        ]),
      ]

      const response = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model:      MODEL,
          max_tokens: 2048,
          system:     buildSystemPrompt(jobContext),
          messages:   conversationMessages,
        }),
      })
      if (!response.ok) {
        const err = await response.text()
        console.error('[drawings-chat/chat]', response.status, err)
        return NextResponse.json({ error: 'AI chat failed' }, { status: 502 })
      }
      const data = await response.json()
      const text = data.content?.[0]?.text ?? ''
      return NextResponse.json({ text })
    }

  } catch (err) {
    console.error('[drawings-chat] Error:', err)
    return NextResponse.json({ error: 'Service error' }, { status: 503 })
  }
}
