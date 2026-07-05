/**
 * enrich-phase-findings.ts
 *
 * Stage 2 of the pro report: deepens the analysis for a single inspection phase.
 *
 * Takes the raw findings captured during the scan (which are often terse) and
 * calls Claude ONCE per phase to produce Horizon-quality analysis for each
 * finding: a detailed observation, the implication(s), a code reference, the
 * recommended task, a timeframe, and a specific recommendation.
 *
 * Processing one phase per call keeps each request small and fast — the
 * generate-phase pipeline already calls this per phase as each one completes,
 * so the work is spread out in manageable chunks rather than one rushed call.
 *
 * Fails safe: if the API key is missing or the call fails, it returns the
 * findings unchanged so the report still generates.
 */

import type { InspectionJob, InspectionPhase, ModuleFinding } from './inspection-types'
import { PHASE_META, MODULE_META } from './inspection-types'
import { resolveJurisdiction, jurisdictionPromptContext } from './jurisdiction'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL         = 'claude-sonnet-4-5'

export interface EnrichedFinding {
  id:             string
  observation:    string   // detailed, specific description of what was found
  implications:   string   // what it means / why it matters (may be "A | B")
  codeReference:  string   // specific clause in the applicable code
  task:           string   // Repair / Replace / Improve / Monitor / Correct
  timeframe:      string   // Immediate / Less than 1 year / Monitor / etc.
  recommendation: string   // specific, actionable next step
}

/**
 * Enrich all findings in a phase. Returns a map keyed by finding id.
 * Returns an empty map (no enrichment) on any failure — caller falls back to raw.
 */
export async function enrichPhaseFindings(
  job: InspectionJob,
  phase: InspectionPhase,
): Promise<Record<string, EnrichedFinding>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return {}

  // Collect all findings across the phase's completed modules
  const items: Array<{ id: string; module: string; label: string; condition: string; severity: string; notes: string; codeRef: string }> = []
  for (const mod of phase.modules) {
    if (mod.status !== 'complete') continue
    const modMeta = MODULE_META[mod.id]
    for (const f of mod.findings ?? []) {
      items.push({
        id:        f.id,
        module:    modMeta?.label ?? mod.id,
        label:     f.label,
        condition: String(f.condition ?? ''),
        severity:  String(f.severity ?? ''),
        notes:     f.notes ?? '',
        codeRef:   f.codeRef ?? modMeta?.codeRef ?? '',
      })
    }
  }
  if (items.length === 0) return {}

  const jx = resolveJurisdiction({
    countryCode: job.address?.country,
    region:      job.address?.province,
    isResidential: true,
  })
  const phaseMeta = PHASE_META[phase.id]
  const buildingType = job.buildingType ?? 'residential'
  const age = job.estimatedAge ? `approximately ${job.estimatedAge}` : 'unknown age'

  const system = `You are a senior building inspector writing the analysis section of a professional inspection report. ${jurisdictionPromptContext(jx)}

You write like a seasoned home/building inspector: precise, defensible, and useful to the client and their contractor. For each finding you are given, produce a deeper analysis with these fields:
- observation: 1-3 sentences describing specifically what the condition is and why it occurs. Add professional context a layperson wouldn't know. Do not just restate the label.
- implications: what this means in practice — the risk or consequence if not addressed. Use "A | B" to separate multiple implications.
- codeReference: the specific clause of the ${jx.label} that applies, if one clearly does. If you are not certain of the exact clause number, give the requirement in plain language and note it should be confirmed. Never invent a precise clause number.
- task: one of Repair, Replace, Improve, Monitor, Correct.
- timeframe: one of "Immediate", "Less than 1 year", "1-2 years", "Monitor", based on severity and safety.
- recommendation: a specific, actionable next step, including who should do it (e.g. licensed electrician, structural engineer) when specialist work is required.

Be accurate and conservative. Never overstate. If a finding is minor or cosmetic, say so plainly. Safety issues (electrical, structural, combustion, fall hazards) must be flagged clearly with an Immediate timeframe.

Respond ONLY with a JSON array, no prose, no markdown fences. Each element: {"id": "<finding id>", "observation": "...", "implications": "...", "codeReference": "...", "task": "...", "timeframe": "...", "recommendation": "..."}`

  const userMsg = `Building: ${buildingType}, ${age}. Inspection phase: ${phaseMeta?.reportSection ?? phase.id}.

Findings to analyze:
${items.map((it, i) => `${i + 1}. [id: ${it.id}] Module: ${it.module}. Finding: "${it.label}". Condition: ${it.condition || 'n/a'}. Severity: ${it.severity || 'n/a'}. Inspector notes: ${it.notes || '(none)'}. Suggested code area: ${it.codeRef || '(none)'}.`).join('\n')}

Return the JSON array now.`

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 3000,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    })
    if (!res.ok) {
      console.error('[enrich-phase] API error', res.status)
      return {}
    }
    const data = await res.json()
    const text = (data.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const arr = JSON.parse(clean) as EnrichedFinding[]

    const map: Record<string, EnrichedFinding> = {}
    for (const e of arr) {
      if (e && e.id) map[e.id] = e
    }
    return map
  } catch (err) {
    console.error('[enrich-phase] failed:', err)
    return {}
  }
}
