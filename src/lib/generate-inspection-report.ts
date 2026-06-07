/**
 * generate-inspection-report.ts — v3
 *
 * Generates a professional residential building inspection PDF.
 * All drawing uses PageWriter — a tracked cursor object — so content
 * ALWAYS goes to the correct page. The stale-page bug is impossible
 * with this pattern.
 *
 * Structure:
 *   p1:  Cover
 *   p2:  Table of Contents (with dot-leaders)
 *   p3:  Summary (significant findings)
 *   p4+: One section per completed phase (Descriptions / Observations & Recommendations)
 *   Last: Site Information
 */

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, RGB } from 'pdf-lib'
import type { InspectionJob, InspectionPhase, InspectionModule, ModuleFinding } from './inspection-types'
import { PHASE_META, MODULE_META } from './inspection-types'
import { getModuleStandard } from './inspection-standards'

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  navy:      rgb(0.039, 0.110, 0.180),
  blue:      rgb(0.255, 0.486, 0.643),
  orange:    rgb(0.949, 0.576, 0.216),
  green:     rgb(0.153, 0.663, 0.420),
  red:       rgb(0.910, 0.271, 0.271),
  amber:     rgb(0.769, 0.451, 0.000),
  white:     rgb(1, 1, 1),
  light:     rgb(0.957, 0.969, 0.984),
  text:      rgb(0.051, 0.118, 0.180),
  text2:     rgb(0.369, 0.490, 0.608),
  border:    rgb(0.898, 0.918, 0.945),
  darkgrey:  rgb(0.30, 0.30, 0.30),
  midgrey:   rgb(0.55, 0.55, 0.55),
  lightgrey: rgb(0.93, 0.93, 0.93),
}

const SECTION_COLORS: Record<string, RGB> = {
  property_setup:       rgb(0.25, 0.35, 0.45),
  pre_construction:     rgb(0.28, 0.38, 0.48),
  excavation_footings:  rgb(0.45, 0.35, 0.15),
  foundation:           rgb(0.30, 0.38, 0.25),
  framing_rough_in:     rgb(0.45, 0.38, 0.12),
  insulation:           rgb(0.38, 0.30, 0.15),
  occupancy_final:      rgb(0.18, 0.32, 0.52),
}

// ── Page layout ───────────────────────────────────────────────────────────────
const PW = 595.28, PH = 841.89
const ML = 52, MR = 52, MT = 52, MB = 62
const TW = PW - ML - MR

// ── PageWriter ────────────────────────────────────────────────────────────────
interface PW_State {
  doc:          PDFDocument
  page:         PDFPage
  y:            number
  sectionTitle: string
  sectionColor: RGB
  fonts:        Record<string, PDFFont>
  job:          InspectionJob
}

function newPage(state: PW_State): PW_State {
  const page = state.doc.addPage([PW, PH])
  // Section header
  page.drawRectangle({ x: ML - 5, y: PH - MT - 22, width: TW + 10, height: 26, color: state.sectionColor })
  page.drawText(state.sectionTitle.toUpperCase(), { x: ML, y: PH - MT - 16, font: state.fonts.bold, size: 11, color: C.white })
  // Address / date sub-line
  const addr = `${state.job.address.street}, ${state.job.address.city}, ${state.job.address.province}`
  page.drawText(sanitise(addr), { x: ML, y: PH - MT - 38, font: state.fonts.reg, size: 8.5, color: C.midgrey })
  const dt = fmtDate(state.job.inspectionDate)
  const dtW = state.fonts.reg.widthOfTextAtSize(dt, 8.5)
  page.drawText(sanitise(dt), { x: PW - MR - dtW, y: PH - MT - 38, font: state.fonts.reg, size: 8.5, color: C.midgrey })
  return { ...state, page, y: PH - MT - 52 }
}

function startSection(doc: PDFDocument, title: string, color: RGB, fonts: Record<string, PDFFont>, job: InspectionJob): PW_State {
  const state: PW_State = { doc, page: null as any, y: 0, sectionTitle: title, sectionColor: color, fonts, job }
  return newPage(state)
}

function need(s: PW_State, pts: number): PW_State {
  return s.y >= MB + pts ? s : newPage(s)
}

// ── Text helpers ──────────────────────────────────────────────────────────────
function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.replace(/\r?\n/g, ' \n ').split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if (w === '\n') { lines.push(cur.trim()); cur = ''; continue }
    const test = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(test, size) > maxW) { if (cur) lines.push(cur.trim()); cur = w }
    else cur = test
  }
  if (cur.trim()) lines.push(cur.trim())
  return lines
}

/**
 * sanitise — replace Unicode characters that WinAnsi (pdf-lib StandardFonts)
 * cannot encode. AI-generated text frequently contains these.
 * Must be called on ALL strings before passing to page.drawText().
 */
function sanitise(text: string): string {
  if (!text) return ''
  return text
    // Math / comparison
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/±/g, '+/-')
    .replace(/×/g, 'x').replace(/÷/g, '/').replace(/≠/g, '!=')
    .replace(/∞/g, 'inf').replace(/√/g, 'sqrt').replace(/∑/g, 'sum')
    .replace(/∆/g, 'delta').replace(/π/g, 'pi').replace(/°/g, ' deg')
    // Arrows
    .replace(/→/g, '->').replace(/←/g, '<-').replace(/↑/g, '^').replace(/↓/g, 'v')
    .replace(/⇒/g, '=>').replace(/⇐/g, '<=').replace(/↔/g, '<->')
    // Quotes / dashes
    .replace(/[""]/g, '"').replace(/['']/g, "'")
    .replace(/[–—]/g, '-').replace(/…/g, '...')
    // Bullets / symbols
    .replace(/•/g, '-').replace(/·/g, '.').replace(/◦/g, 'o')
    .replace(/✓/g, 'OK').replace(/✗/g, 'X').replace(/✘/g, 'X')
    .replace(/★/g, '*').replace(/☆/g, '*')
    // Fractions
    .replace(/½/g, '1/2').replace(/¼/g, '1/4').replace(/¾/g, '3/4')
    .replace(/⅓/g, '1/3').replace(/⅔/g, '2/3')
    // Units / super/subscript
    .replace(/²/g, '2').replace(/³/g, '3').replace(/¹/g, '1')
    .replace(/™/g, 'TM').replace(/®/g, 'R').replace(/©/g, 'C')
    .replace(/£/g, 'GBP').replace(/€/g, 'EUR').replace(/¥/g, 'JPY')
    // Remove any remaining non-ASCII characters that would crash WinAnsi
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\xFF]/g, '?')
    // Clean up multiple spaces/newlines
    .replace(/\s+/g, ' ').trim()
}

function drawWrappedText(s: PW_State, text: string, x: number, font: PDFFont, size: number, color: RGB, maxW: number, lineH: number): PW_State {
  if (!text) return s
  const lines = wrap(sanitise(text), font, size, maxW)
  let cur = s
  for (const line of lines) {
    cur = need(cur, lineH + 4)
    cur.page.drawText(sanitise(line), { x, y: cur.y, font, size, color })
    cur = { ...cur, y: cur.y - lineH }
  }
  return cur
}

function subHeader(s: PW_State, title: string): PW_State {
  s = need(s, 30)
  const dim = rgb(s.sectionColor.red * 0.82, s.sectionColor.green * 0.82, s.sectionColor.blue * 0.82)
  s.page.drawRectangle({ x: ML - 5, y: s.y - 18, width: TW + 10, height: 22, color: dim })
  s.page.drawText(sanitise(title), { x: ML, y: s.y - 13, font: s.fonts.bold, size: 9.5, color: C.white })
  return { ...s, y: s.y - 26 }
}

function hRule(s: PW_State, indent = 0, opacity = 0.3): PW_State {
  s.page.drawRectangle({ x: ML + indent, y: s.y + 2, width: TW - indent, height: 0.4, color: C.border })
  return { ...s, y: s.y - 6 }
}

// ── Severity / condition helpers ──────────────────────────────────────────────
function sevColor(sev: string): RGB {
  if (sev === 'critical') return C.red
  if (sev === 'major')    return rgb(0.80, 0.20, 0.20)
  if (sev === 'moderate') return C.amber
  if (sev === 'minor')    return rgb(0.60, 0.48, 0.05)
  return C.green
}
function condColor(c: string): RGB {
  if (c === 'poor' || c === 'below_average') return C.red
  if (c === 'fair' || c === 'average')       return C.amber
  if (c === 'good' || c === 'above_average') return C.green
  return C.blue
}

// ── Technical reference diagrams (SVG-like drawn in pdf-lib) ─────────────────
// These illustrate correct vs deficient conditions for common findings.

function drawDrainTileDiagram(s: PW_State): PW_State {
  s = need(s, 130)
  const x0 = ML, y0 = s.y - 5, w2 = TW / 2 - 10
  // Box outline
  s.page.drawRectangle({ x: x0, y: y0 - 110, width: w2, height: 115, color: C.light, borderColor: C.border, borderWidth: 0.5 })
  // Gravel bed (dots pattern)
  for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) {
    s.page.drawCircle({ x: x0 + 10 + col * 14, y: y0 - 85 + row * 12, size: 3, color: rgb(0.7, 0.65, 0.5) })
  }
  // Pipe circle (cross-section)
  s.page.drawCircle({ x: x0 + w2/2, y: y0 - 60, size: 16, color: rgb(0.2, 0.2, 0.8), borderColor: rgb(0.1, 0.1, 0.6), borderWidth: 1.5 })
  s.page.drawCircle({ x: x0 + w2/2, y: y0 - 60, size: 11, color: rgb(0.4, 0.4, 0.9) })
  // Perforation dots on pipe
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    s.page.drawCircle({ x: x0 + w2/2 + Math.cos(angle) * 14, y: y0 - 60 + Math.sin(angle) * 14, size: 1.5, color: C.white })
  }
  // Filter fabric (dashed line above gravel)
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) s.page.drawRectangle({ x: x0 + 5 + i * (w2-10)/8, y: y0 - 30, width: (w2-10)/8 - 2, height: 1.5, color: C.green })
  }
  // Labels
  s.page.drawText('Filter fabric (geotextile)', { x: x0 + 4, y: y0 - 22, font: s.fonts.obl, size: 6, color: C.green })
  s.page.drawText('100mm perforated pipe', { x: x0 + 4, y: y0 - 52, font: s.fonts.obl, size: 6, color: C.white })
  s.page.drawText('Granular A / clear stone bed', { x: x0 + 4, y: y0 - 100, font: s.fonts.obl, size: 6, color: C.text2 })
  s.page.drawText('OBC 9.14.3 — Drain tile installation', { x: x0 + 2, y: y0 - 112, font: s.fonts.bold, size: 6.5, color: C.navy })
  return { ...s, y: s.y - 120 }
}

function drawFootingDiagram(s: PW_State): PW_State {
  s = need(s, 130)
  const x0 = ML, y0 = s.y - 5, w2 = TW / 2 - 10
  s.page.drawRectangle({ x: x0, y: y0 - 110, width: w2, height: 115, color: C.light, borderColor: C.border, borderWidth: 0.5 })
  // Foundation wall
  const wallX = x0 + w2/2 - 15, wallW = 30
  s.page.drawRectangle({ x: wallX, y: y0 - 70, width: wallW, height: 60, color: rgb(0.75, 0.75, 0.75) })
  // Footing
  s.page.drawRectangle({ x: wallX - 25, y: y0 - 90, width: wallW + 50, height: 22, color: rgb(0.65, 0.65, 0.65) })
  // Dimension arrows
  s.page.drawRectangle({ x: wallX - 25, y: y0 - 78, width: 25, height: 0.8, color: C.orange })
  s.page.drawRectangle({ x: wallX + wallW, y: y0 - 78, width: 25, height: 0.8, color: C.orange })
  // Labels
  s.page.drawText('Min. projection', { x: x0 + 2, y: y0 - 75, font: s.fonts.obl, size: 5.5, color: C.orange })
  s.page.drawText('= wall thickness', { x: x0 + 2, y: y0 - 83, font: s.fonts.obl, size: 5.5, color: C.orange })
  s.page.drawText('Foundation wall', { x: wallX + 2, y: y0 - 30, font: s.fonts.obl, size: 5.5, color: C.text })
  s.page.drawText('Footing', { x: wallX + 2, y: y0 - 95, font: s.fonts.obl, size: 5.5, color: C.text })
  s.page.drawText('OBC 9.15.3 — Minimum footing width', { x: x0 + 2, y: y0 - 112, font: s.fonts.bold, size: 6.5, color: C.navy })
  return { ...s, y: s.y - 120 }
}

function drawVapourBarrierDiagram(s: PW_State): PW_State {
  s = need(s, 120)
  const x0 = ML, y0 = s.y - 5, w2 = TW / 2 - 10
  s.page.drawRectangle({ x: x0, y: y0 - 105, width: w2, height: 110, color: C.light, borderColor: C.border, borderWidth: 0.5 })
  // Stud wall
  for (let i = 0; i < 4; i++) {
    s.page.drawRectangle({ x: x0 + 8 + i * 22, y: y0 - 90, width: 8, height: 78, color: rgb(0.85, 0.78, 0.65) })
  }
  // Insulation (pink fill between studs)
  for (let i = 0; i < 3; i++) {
    s.page.drawRectangle({ x: x0 + 16 + i * 22, y: y0 - 90, width: 14, height: 78, color: rgb(1.0, 0.75, 0.8) })
  }
  // Poly (warm side — inside = right)
  s.page.drawRectangle({ x: x0 + w2 - 8, y: y0 - 90, width: 3, height: 78, color: C.blue })
  // Labels
  s.page.drawText('Insulation', { x: x0 + 20, y: y0 - 50, font: s.fonts.obl, size: 5.5, color: rgb(0.7, 0.1, 0.3) })
  s.page.drawText('Polyethylene', { x: x0 + w2 - 30, y: y0 - 35, font: s.fonts.obl, size: 5.5, color: C.blue })
  s.page.drawText('on WARM side', { x: x0 + w2 - 30, y: y0 - 43, font: s.fonts.obl, size: 5.5, color: C.blue })
  s.page.drawText('INTERIOR', { x: x0 + w2 - 25, y: y0 - 10, font: s.fonts.bold, size: 6, color: C.navy })
  s.page.drawText('EXTERIOR', { x: x0 + 5, y: y0 - 10, font: s.fonts.bold, size: 6, color: C.navy })
  s.page.drawText('OBC 9.25.3 — Vapour barrier on warm side', { x: x0 + 2, y: y0 - 108, font: s.fonts.bold, size: 6.5, color: C.navy })
  return { ...s, y: s.y - 118 }
}

function drawGuardrailDiagram(s: PW_State): PW_State {
  s = need(s, 140)
  const x0 = ML + TW/2 + 10, y0 = s.y - 5, w2 = TW / 2 - 10
  s.page.drawRectangle({ x: x0, y: y0 - 130, width: w2, height: 135, color: C.light, borderColor: C.border, borderWidth: 0.5 })
  // Floor line
  s.page.drawRectangle({ x: x0 + 5, y: y0 - 120, width: w2 - 10, height: 8, color: rgb(0.75, 0.75, 0.75) })
  // Posts
  s.page.drawRectangle({ x: x0 + 15, y: y0 - 115, width: 8, height: 100, color: rgb(0.5, 0.5, 0.55) })
  s.page.drawRectangle({ x: x0 + w2 - 25, y: y0 - 115, width: 8, height: 100, color: rgb(0.5, 0.5, 0.55) })
  // Top rail
  s.page.drawRectangle({ x: x0 + 12, y: y0 - 18, width: w2 - 26, height: 6, color: C.navy })
  // Balusters (max 100mm gap)
  for (let i = 0; i < 5; i++) {
    s.page.drawRectangle({ x: x0 + 22 + i * 18, y: y0 - 112, width: 5, height: 90, color: rgb(0.6, 0.6, 0.65) })
  }
  // 900mm dimension arrow
  s.page.drawRectangle({ x: x0 + 5, y: y0 - 115, width: 0.8, height: 100, color: C.orange })
  s.page.drawText('900mm', { x: x0 + 8, y: y0 - 65, font: s.fonts.bold, size: 6.5, color: C.orange })
  s.page.drawText('min.', { x: x0 + 8, y: y0 - 74, font: s.fonts.obl, size: 6, color: C.orange })
  s.page.drawText('Max. 100mm', { x: x0 + 22, y: y0 - 128, font: s.fonts.obl, size: 5.5, color: C.text2 })
  s.page.drawText('baluster gap', { x: x0 + 22, y: y0 - 135, font: s.fonts.obl, size: 5.5, color: C.text2 })
  s.page.drawText('OBC 9.8.7 — Guards & handrails', { x: x0 + 2, y: y0 - 143, font: s.fonts.bold, size: 6.5, color: C.navy })
  return s // diagram is beside text, don't advance y
}

function drawFireBlockingDiagram(s: PW_State): PW_State {
  s = need(s, 120)
  const x0 = ML, y0 = s.y - 5, w2 = TW / 2 - 10
  s.page.drawRectangle({ x: x0, y: y0 - 110, width: w2, height: 115, color: C.light, borderColor: C.border, borderWidth: 0.5 })
  // Studs
  for (let i = 0; i < 4; i++) s.page.drawRectangle({ x: x0 + 8 + i * 22, y: y0 - 95, width: 8, height: 82, color: rgb(0.85, 0.78, 0.65) })
  // Floor plate
  s.page.drawRectangle({ x: x0 + 5, y: y0 - 100, width: w2 - 10, height: 8, color: rgb(0.75, 0.65, 0.45) })
  // Fire block (horizontal blocking between studs mid-height)
  s.page.drawRectangle({ x: x0 + 5, y: y0 - 48, width: w2 - 10, height: 7, color: C.orange })
  // Arrow pointing to block
  s.page.drawText('Fire blocking', { x: x0 + w2/2 - 18, y: y0 - 38, font: s.fonts.bold, size: 6, color: C.orange })
  s.page.drawText('OBC 9.10.17 — Fire blocking required at', { x: x0 + 2, y: y0 - 104, font: s.fonts.obl, size: 5.5, color: C.text2 })
  s.page.drawText('all floor/ceiling lines & concealed spaces', { x: x0 + 2, y: y0 - 112, font: s.fonts.bold, size: 6.5, color: C.navy })
  return { ...s, y: s.y - 118 }
}

// Map module IDs to their reference diagram function
const DIAGRAMS: Partial<Record<string, (s: PW_State) => PW_State>> = {
  drain_tile:       drawDrainTileDiagram,
  footing_width:    drawFootingDiagram,
  footing_depth:    drawFootingDiagram,
  vapour_barrier:   drawVapourBarrierDiagram,
  insulation_walls: drawVapourBarrierDiagram,
  guardrails_handrails: drawGuardrailDiagram,
  fire_blocking:    drawFireBlockingDiagram,
}

// ── Formatting helpers ────────────────────────────────────────────────────────
function fmtDate(d: string): string {
  if (!d) return new Date().toLocaleDateString('en-CA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
  try { return new Date(d).toLocaleDateString('en-CA', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) } catch { return d }
}
function fmtBuildingType(t: string) {
  const m: Record<string,string> = { single_storey_residential:'Single Storey Detached Residential', two_storey_residential:'Two Storey Detached Residential', semi_detached:'Semi-Detached Residential', townhouse:'Townhouse', multi_unit_residential:'Multi-Unit Residential', commercial:'Commercial', industrial:'Industrial', mixed_use:'Mixed Use' }
  return m[t] ?? t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
}
function fmtConstruction(t: string) { const m: Record<string,string> = { brick_veneer:'Brick Veneer',double_brick:'Double Brick',timber_frame:'Wood Frame',concrete_block:'Concrete Block (CMU)',icf:'ICF',steel_frame:'Steel Frame' }; return m[t]??t.replace(/_/g,' ') }
function fmtRoof(t: string) { const m: Record<string,string> = { concrete_tiles:'Concrete Tiles',clay_tiles:'Clay Tiles',metal_deck:'Metal Deck',asphalt_shingles:'Asphalt Shingles',flat_membrane:'Flat/Membrane' }; return m[t]??t.replace(/_/g,' ') }
function fmtFooting(t: string) { const m: Record<string,string> = { concrete_slab:'Concrete Footings & Slab',piers_stumps:'Piers / Stumps',strip_footing:'Strip Footing' }; return m[t]??t.replace(/_/g,' ') }
function fmtCond(c: string) { const m: Record<string,string> = { above_average:'Above Average',good:'Good',typical:'Typical',fair:'Fair',average:'Average',below_average:'Below Average',poor:'Poor',na:'Not Applicable' }; return m[c]??c }
function fmtWeather(w: string) { const m: Record<string,string>={fine:'Fine',overcast:'Overcast',light_rain:'Light Rain',heavy_rain:'Heavy Rain',windy:'Windy'}; return m[w]??w }

// ── Collect findings across all phases ────────────────────────────────────────
type FindingRow = { phase: string; phaseId: string; module: string; moduleId: string; finding: ModuleFinding }

function collectFindings(job: InspectionJob): FindingRow[] {
  const rows: FindingRow[] = []
  for (const phase of job.phases) {
    if (phase.status === 'pending' || phase.status === 'not_applicable') continue
    for (const mod of phase.modules) {
      if (mod.status === 'pending') continue
      for (const finding of mod.findings) {
        if (['major','critical','moderate'].includes(finding.severity)) {
          rows.push({
            phase:    PHASE_META[phase.id]?.label ?? phase.id,
            phaseId:  phase.id,
            module:   MODULE_META[mod.id]?.label  ?? mod.id,
            moduleId: mod.id,
            finding,
          })
        }
      }
    }
  }
  return rows
}

// ── Page numbers ──────────────────────────────────────────────────────────────
function stampPageNumbers(pdfDoc: PDFDocument, reg: PDFFont, totalPages: number) {
  pdfDoc.getPages().forEach((page, i) => {
    if (i === 0) return // skip cover
    const txt = `Page ${i} of ${totalPages - 1}`
    const tw  = reg.widthOfTextAtSize(txt, 7.5)
    page.drawText(txt, { x: PW/2 - tw/2, y: 22, font: reg, size: 7.5, color: C.midgrey })
    page.drawText('stAIrcode · Just Open Technologies Inc.', { x: ML, y: 22, font: reg, size: 7, color: C.midgrey })
    page.drawRectangle({ x: ML, y: 36, width: TW, height: 0.3, color: C.lightgrey })
  })
}

// ── buildDescriptions ────────────────────────────────────────────────────────
function buildDescriptions(job: InspectionJob, phase: InspectionPhase): Array<{label:string;value:string}> {
  const d: Array<{label:string;value:string}> = []
  const id = phase.id
  if (['property_setup','pre_construction'].includes(id)) {
    if (job.buildingType)     d.push({ label:'Building type',          value:fmtBuildingType(job.buildingType) })
    if (job.estimatedAge)     d.push({ label:'Estimated age',          value:job.estimatedAge })
    if (job.wallConstruction) d.push({ label:'Wall construction',      value:fmtConstruction(job.wallConstruction) })
    if (job.roofCovering)     d.push({ label:'Roof covering',          value:fmtRoof(job.roofCovering) })
    if (job.footingType)      d.push({ label:'Foundation / footings',  value:fmtFooting(job.footingType) })
    if (job.permitNumber)     d.push({ label:'Building permit',        value:job.permitNumber })
    if (job.drawingsData?.fields?.occupancyClass)   d.push({ label:'Occupancy class', value:job.drawingsData.fields.occupancyClass! })
    if (job.drawingsData?.fields?.constructionType) d.push({ label:'Construction type', value:job.drawingsData.fields.constructionType! })
    if (job.drawingsData?.fields?.lotCoverage)      d.push({ label:'Lot coverage', value:job.drawingsData.fields.lotCoverage! })
  }
  if (id === 'excavation_footings' && job.footingType) d.push({ label:'Footing type', value:fmtFooting(job.footingType) })
  if (id === 'foundation'          && job.wallConstruction) d.push({ label:'Foundation wall', value:fmtConstruction(job.wallConstruction) })
  if (['framing_rough_in','insulation','occupancy_final'].includes(id)) {
    if (job.wallConstruction) d.push({ label:'Wall construction', value:fmtConstruction(job.wallConstruction) })
    if (job.roofCovering)     d.push({ label:'Roof covering',     value:fmtRoof(job.roofCovering) })
    if (job.internalWalls)    d.push({ label:'Interior finishes', value:job.internalWalls })
    if (job.windows)          d.push({ label:'Windows',           value:job.windows })
  }
  // Add standard descriptions for modules that have them, if not already captured
  if (d.length === 0) {
    for (const mod of phase.modules) {
      const std = getModuleStandard(mod.id)
      if (std?.descriptions) {
        for (const desc of std.descriptions) {
          const parts = desc.split(':')
          if (parts.length >= 2) {
            d.push({ label: parts[0].trim(), value: parts.slice(1).join(':').trim() })
          }
        }
        break // Only use the first module's standards descriptions
      }
    }
  }
  return d.filter(r => r.value && r.value !== 'unknown')
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function generatePhaseSection(job: InspectionJob, phaseId: string): Promise<Buffer> {
  const phase = job.phases.find(p => p.id === phaseId)
  if (!phase) throw new Error(`Phase ${phaseId} not found`)

  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`${PHASE_META[phaseId as keyof typeof PHASE_META]?.reportSection ?? phaseId} — ${job.address.street}`)
  pdfDoc.setCreator('stAIrcode')

  const fonts = {
    reg:  await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    obl:  await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
  }

  await buildPhaseSection(pdfDoc, job, phase, fonts)
  stampPageNumbers(pdfDoc, fonts.reg, pdfDoc.getPageCount() + 1)
  return Buffer.from(await pdfDoc.save())
}

export async function collatePhasePdfs(job: InspectionJob, coverNotes?: string): Promise<Buffer> {
  const final = await PDFDocument.create()
  final.setTitle(`Building Inspection Report — ${job.address.street}, ${job.address.city}`)
  final.setAuthor(job.inspectorName || 'stAIrcode Inspector')
  final.setCreator('stAIrcode by Just Open Technologies Inc.')

  const fonts = {
    reg:  await final.embedFont(StandardFonts.Helvetica),
    bold: await final.embedFont(StandardFonts.HelveticaBold),
    obl:  await final.embedFont(StandardFonts.HelveticaOblique),
  }

  await buildCoverPage(final, { ...job, purposeNote: coverNotes || job.purposeNote }, fonts)
  await buildTOCPage(final, job, fonts)

  const allFindings = collectFindings(job)
  if (allFindings.length > 0) await buildSummaryPage(final, job, allFindings, fonts)

  for (const phase of job.phases) {
    if (phase.status === 'pending' || phase.status === 'not_applicable') continue
    const hasContent = phase.modules.some(m => m.status === 'complete' && (m.findings.length > 0 || m.notes))
    if (!hasContent && phase.id !== 'property_setup') continue

    if (phase.reportPdfB64) {
      try {
        const secDoc = await PDFDocument.load(Buffer.from(phase.reportPdfB64, 'base64'))
        const pages  = await final.copyPages(secDoc, secDoc.getPageIndices())
        pages.forEach(p => final.addPage(p))
      } catch { await buildPhaseSection(final, job, phase, fonts) }
    } else {
      await buildPhaseSection(final, job, phase, fonts)
    }
  }

  await buildSiteInfoPage(final, job, fonts)
  stampPageNumbers(final, fonts.reg, final.getPageCount())
  return Buffer.from(await final.save())
}

export async function generateInspectionReport(job: InspectionJob): Promise<Buffer> {
  return collatePhasePdfs(job)
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE BUILDERS — all use PageWriter (PW_State)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Cover ─────────────────────────────────────────────────────────────────────
async function buildCoverPage(pdfDoc: PDFDocument, job: InspectionJob, fonts: Record<string, PDFFont>) {
  const page = pdfDoc.addPage([PW, PH])
  const { bold, reg, obl } = fonts

  // Navy header band
  page.drawRectangle({ x:0, y:PH-210, width:PW, height:210, color:C.navy })
  // Orange accent
  page.drawRectangle({ x:0, y:PH-215, width:PW, height:8, color:C.orange })
  // Brand
  page.drawText('YOUR INSPECTION', { x:ML+8, y:PH-80,  font:bold, size:30, color:C.white })
  page.drawText('REPORT',          { x:ML+8, y:PH-118, font:bold, size:30, color:C.orange })

  // Address
  const addr1 = job.address.street + (job.address.unit ? ` #${job.address.unit}` : '')
  const addr2 = `${job.address.city}, ${job.address.province}`
  page.drawText(sanitise(addr1), { x:ML, y:PH-290, font:bold, size:20, color:C.navy })
  page.drawText(sanitise(addr2), { x:ML, y:PH-316, font:bold, size:16, color:C.navy })
  page.drawRectangle({ x:ML, y:PH-330, width:TW, height:1, color:C.border })

  // Info grid
  const rows = [
    { label:'PREPARED FOR',    value:job.clientName || 'Not specified' },
    { label:'INSPECTION DATE', value:fmtDate(job.inspectionDate) },
    { label:'INSPECTED BY',    value:job.inspectorName || 'Not specified' },
    { label:'COMPANY',         value:job.company || 'Just Open Technologies Inc.' },
    { label:'LICENCE NO.',     value:job.licenceNumber || '' },
    { label:'PURPOSE',         value:job.purposeNote || 'Building Inspection' },
    { label:'BUILDING TYPE',   value:fmtBuildingType(job.buildingType) },
    { label:'ESTIMATED AGE',   value:job.estimatedAge || 'Not recorded' },
  ]
  let y = PH - 375
  for (const row of rows) {
    if (!row.value) continue
    page.drawText(sanitise(row.label), { x:ML, y, font:obl, size:8, color:C.orange })
    page.drawText(sanitise(row.value), { x:ML, y:y-14, font:bold, size:11, color:C.navy })
    y -= 40
  }

  // Footer
  page.drawRectangle({ x:0, y:0, width:PW, height:75, color:C.navy })
  page.drawRectangle({ x:0, y:0, width:PW, height:6, color:C.orange })
  page.drawText('stAIrcode', { x:ML, y:48, font:bold, size:16, color:C.orange })
  page.drawText('by Just Open Technologies Inc.', { x:ML, y:30, font:reg, size:9, color:C.white })
  page.drawText('staircode.app', { x:PW-MR-90, y:30, font:reg, size:9, color:C.white })
}

// ── Table of Contents ─────────────────────────────────────────────────────────
async function buildTOCPage(pdfDoc: PDFDocument, job: InspectionJob, fonts: Record<string, PDFFont>) {
  const page = pdfDoc.addPage([PW, PH])
  const { bold, reg, obl } = fonts

  page.drawRectangle({ x:ML-5, y:PH-MT-26, width:TW+10, height:30, color:C.navy })
  page.drawText('TABLE OF CONTENTS', { x:ML, y:PH-MT-18, font:bold, size:12, color:C.white })
  page.drawRectangle({ x:0, y:PH-MT-30, width:PW, height:4, color:C.orange })

  let y = PH - MT - 56

  const sections: Array<{title:string; subtitle:string; color:RGB}> = [
    { title:'Summary',         subtitle:'Significant findings requiring attention', color:C.darkgrey },
  ]

  const applicablePhases = job.phases.filter(p => p.status !== 'not_applicable')
  for (const phase of applicablePhases) {
    const meta = PHASE_META[phase.id]
    if (!meta) continue
    sections.push({
      title:    meta.reportSection,
      subtitle: meta.description,
      color:    SECTION_COLORS[phase.id] ?? C.navy,
    })
  }
  sections.push({ title:'Site Information', subtitle:'Property details, inspection conditions, disclaimer', color:C.darkgrey })

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]
    const num = i === 0 ? '—' : String(i)

    // Row background
    const rowH = 28
    if (i % 2 === 0) page.drawRectangle({ x:ML-5, y:y-rowH+4, width:TW+10, height:rowH, color:C.light })

    // Colour tab
    page.drawRectangle({ x:ML-5, y:y-rowH+4, width:6, height:rowH, color:sec.color })

    // Section number
    page.drawText(sanitise(num), { x:ML+8, y:y-14, font:bold, size:11, color:sec.color })

    // Title + subtitle
    page.drawText(sanitise(sec.title), { x:ML+28, y:y-8, font:bold, size:10, color:C.navy })
    page.drawText(sanitise(sec.subtitle), { x:ML+28, y:y-19, font:obl, size:8, color:C.text2 })

    // Dot leaders
    const titleW = bold.widthOfTextAtSize(sec.title, 10) + 30 + ML
    for (let dx = titleW + 4; dx < PW - MR - 20; dx += 5) {
      page.drawCircle({ x:dx, y:y-10, size:0.8, color:C.border })
    }

    y -= rowH + 4
  }

  // Note
  y -= 16
  page.drawRectangle({ x:ML, y:y-20, width:TW, height:26, color:rgb(0.96, 0.97, 0.99) })
  page.drawText('This report was generated by stAIrcode. Content is based on visual inspection only.', { x:ML+8, y:y-10, font:obl, size:8, color:C.text2 })
  page.drawText('All findings should be verified by a licensed inspector or qualified tradesperson.', { x:ML+8, y:y-20, font:obl, size:8, color:C.text2 })
}

// ── Summary ───────────────────────────────────────────────────────────────────
async function buildSummaryPage(
  pdfDoc: PDFDocument, job: InspectionJob,
  findings: FindingRow[], fonts: Record<string, PDFFont>
) {
  let s = startSection(pdfDoc, 'Summary', C.darkgrey, fonts, job)
  const { bold, reg } = fonts

  s = drawWrappedText(s,
    'This Summary outlines potentially significant issues identified during the inspection that may need to be addressed in the near term. Please read the complete report for full details. There may be additional observations not listed here.',
    ML, reg, 9, C.text, TW, 13)
  s = { ...s, y: s.y - 16 }

  if (findings.length === 0) {
    s = drawWrappedText(s, 'No significant issues identified at this stage of the inspection.', ML, reg, 10, C.text2, TW, 14)
    return
  }

  const byPhase: Record<string, FindingRow[]> = {}
  for (const f of findings) {
    if (!byPhase[f.phase]) byPhase[f.phase] = []
    byPhase[f.phase].push(f)
  }

  for (const [phase, pf] of Object.entries(byPhase)) {
    s = need(s, 50)
    s = { ...s, y: s.y - 6 }
    s.page.drawText(sanitise(phase), { x:ML, y:s.y, font:bold, size:12, color:C.navy })
    s.page.drawRectangle({ x:ML, y:s.y-2, width:bold.widthOfTextAtSize(phase,12), height:0.5, color:C.navy })
    s = { ...s, y: s.y - 18 }

    for (const { module, moduleId, finding } of pf) {
      s = need(s, 50)
      const dot = sevColor(finding.severity)

      // Dot + module name
      s.page.drawCircle({ x:ML+5, y:s.y-2, size:4.5, color:dot })
      s.page.drawText(sanitise(module), { x:ML+16, y:s.y, font:bold, size:10, color:C.navy })
      s.page.drawRectangle({ x:ML+16, y:s.y-1, width:bold.widthOfTextAtSize(module,10), height:0.5, color:C.navy })
      s = { ...s, y: s.y - 14 }

      // Condition line
      s = need(s, 13)
      const cW = bold.widthOfTextAtSize('Condition:  ', 9)
      s.page.drawText('Condition:  ', { x:ML+16, y:s.y, font:bold, size:9, color:C.text })
      s.page.drawText(sanitise(fmtCond(finding.condition as string)), { x:ML+16+cW, y:s.y, font:reg, size:9, color:condColor(finding.condition as string) })
      s = { ...s, y: s.y - 13 }

      // Observations (truncated — full in section)
      if (finding.notes) {
        const shortNote = finding.notes.length > 200 ? finding.notes.slice(0, 197) + '…' : finding.notes
        s = drawWrappedText(s, shortNote, ML+16, reg, 8.5, C.text, TW-16, 12)
      }

      // Implication
      if (finding.recommendation) {
        s = need(s, 14)
        s.page.drawText('Implication(s):', { x:ML+16, y:s.y, font:bold, size:9, color:C.text })
        s = { ...s, y: s.y - 12 }
        s = drawWrappedText(s, finding.recommendation.slice(0, 300), ML+22, reg, 8.5, C.text2, TW-22, 12)
      }

      // Task
      if (finding.severity !== 'none') {
        s = need(s, 13)
        const taskStr = finding.severity === 'critical' ? 'URGENT — Address immediately'
                      : finding.severity === 'major'    ? 'Repair or replace'
                      : 'Monitor and repair'
        const tW = bold.widthOfTextAtSize('Task:  ', 9)
        s.page.drawText('Task:  ', { x:ML+16, y:s.y, font:bold, size:9, color:C.text })
        s.page.drawText(sanitise(taskStr), { x:ML+16+tW, y:s.y, font:reg, size:9, color:dot })
        s = { ...s, y: s.y - 14 }
      }

      s = hRule(s, 16)
    }
  }
}

// ── Phase section ─────────────────────────────────────────────────────────────
async function buildPhaseSection(
  pdfDoc: PDFDocument, job: InspectionJob,
  phase: InspectionPhase, fonts: Record<string, PDFFont>
) {
  const meta = PHASE_META[phase.id]
  if (!meta) return

  const sectionColor = SECTION_COLORS[phase.id] ?? C.navy
  let s = startSection(pdfDoc, meta.reportSection, sectionColor, fonts, job)
  const { bold, reg, obl } = fonts

  // ── Descriptions ────────────────────────────────────────────────────────────
  const descs = buildDescriptions(job, phase)
  if (descs.length > 0) {
    s = subHeader(s, 'Descriptions')
    s = { ...s, y: s.y - 6 }
    for (const d of descs) {
      s = need(s, 14)
      const lw = bold.widthOfTextAtSize(d.label + ':  ', 9)
      s.page.drawText(sanitise(d.label + ':  '), { x:ML, y:s.y, font:bold, size:9, color:C.text })
      s.page.drawText(sanitise(d.value),          { x:ML+lw, y:s.y, font:reg, size:9, color:sectionColor })
      s = { ...s, y: s.y - 13 }
    }
    s = { ...s, y: s.y - 8 }
  }

  // ── Observations & Recommendations ──────────────────────────────────────────
  // Include completed modules (have findings/notes) AND pending modules (show standards/checklist as placeholder)
  const completedMods  = phase.modules.filter(m => m.status === 'complete' && (m.findings.length > 0 || m.notes))
  const standardsMods  = phase.modules.filter(m => (m.status === 'pending' || m.status === 'in_progress') && getModuleStandard(m.id))
  if (completedMods.length > 0) {
    s = subHeader(s, 'Observations & Recommendations')
    s = { ...s, y: s.y - 8 }

    let photoSeq = 1

    for (const mod of completedMods) {
      const modMeta = MODULE_META[mod.id]
      if (!modMeta) continue

      for (const finding of mod.findings) {
        s = need(s, 70)

        // Module heading (underlined bold)
        const modLabel = modMeta.label
        s.page.drawText(sanitise(modLabel), { x:ML, y:s.y, font:bold, size:10, color:C.navy })
        s.page.drawRectangle({ x:ML, y:s.y-1, width:bold.widthOfTextAtSize(modLabel,10), height:0.6, color:C.navy })
        s = { ...s, y: s.y - 14 }

        // Condition dot
        s = need(s, 13)
        const dot = condColor(finding.condition as string)
        s.page.drawCircle({ x:ML+5, y:s.y-2, size:4, color:dot })
        const condLabel = 'Condition:  '
        const cW = bold.widthOfTextAtSize(condLabel, 9)
        s.page.drawText(sanitise(condLabel), { x:ML+14, y:s.y, font:bold, size:9, color:C.text })
        s.page.drawText(sanitise(fmtCond(finding.condition as string)), { x:ML+14+cW, y:s.y, font:reg, size:9, color:dot })
        s = { ...s, y: s.y - 13 }

        // Observations
        if (finding.notes) {
          s = need(s, 13)
          s = drawWrappedText(s, finding.notes, ML+14, reg, 9, C.text, TW-14, 12.5)
        }

        // Implication
        if (finding.recommendation) {
          s = need(s, 14)
          const iL = 'Implication(s):  '
          s.page.drawText(sanitise(iL), { x:ML+14, y:s.y, font:bold, size:9, color:C.text })
          s = { ...s, y: s.y - 12 }
          s = drawWrappedText(s, finding.recommendation, ML+20, reg, 9, C.text, TW-20, 12.5)
        }

        // Code reference
        const cr = finding.codeRef || modMeta.codeRef
        if (cr) {
          s = need(s, 12)
          const crL = 'Code reference:  '
          const crW = bold.widthOfTextAtSize(crL, 9)
          s.page.drawText(sanitise(crL), { x:ML+14, y:s.y, font:bold, size:9, color:C.text })
          s.page.drawText(sanitise(cr),  { x:ML+14+crW, y:s.y, font:obl, size:9, color:C.blue })
          s = { ...s, y: s.y - 12 }
        }

        // Task (severity)
        if (finding.severity && finding.severity !== 'none') {
          s = need(s, 13)
          const sev    = finding.severity
          const sevC   = sevColor(sev)
          const taskStr = sev === 'critical' ? 'URGENT — Address immediately'
                        : sev === 'major'    ? 'Repair or replace'
                        : sev === 'moderate' ? 'Monitor and repair when possible'
                        : 'Improve'
          const tL = 'Task:  '
          const tW = bold.widthOfTextAtSize(tL, 9)
          s.page.drawText(sanitise(tL), { x:ML+14, y:s.y, font:bold, size:9, color:C.text })
          s.page.drawText(sanitise(taskStr), { x:ML+14+tW, y:s.y, font:bold, size:9, color:sevC })
          s = { ...s, y: s.y - 14 }
        }

        // Reference diagram (if applicable module)
        const drawDiagram = DIAGRAMS[mod.id]
        if (drawDiagram && (finding.severity === 'major' || finding.severity === 'critical' || finding.severity === 'moderate')) {
          s = need(s, 130)
          s = { ...s, y: s.y - 6 }
          const noteLabel = 'Reference diagram:'
          s.page.drawText(sanitise(noteLabel), { x:ML, y:s.y, font:bold, size:8, color:C.text2 })
          s = { ...s, y: s.y - 8 }
          s = drawDiagram(s)
          s = { ...s, y: s.y - 8 }
        }

        // Photos — use finding-level photos if present, otherwise fall back to module-level
        // Never merge both: findings already reference the same photos as module.photos
        const photos = (finding.photos?.length ? finding.photos : mod.photos ?? []).filter(Boolean).slice(0, 4)
        if (photos.length > 0) {
          const iW = Math.min(200, (TW - 10) / Math.min(photos.length, 2))
          const iH = 150
          s = need(s, iH + 28)
          let imgX = ML, rowMaxH = 0

          for (let pi = 0; pi < photos.length; pi++) {
            try {
              const bytes = Buffer.from(photos[pi], 'base64')
              // Detect image type from magic bytes: PNG starts with 0x89 0x50, JPEG with 0xFF 0xD8
              const isPng = bytes[0] === 0x89 && bytes[1] === 0x50
              const img   = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes)
              const scale = Math.min(iW / img.width, iH / img.height)
              const w2 = img.width * scale, h2 = img.height * scale

              if (pi > 0 && pi % 2 === 0) {
                s = { ...s, y: s.y - rowMaxH - 20 }
                s = need(s, iH + 25)
                imgX = ML; rowMaxH = 0
              }
              s.page.drawImage(img, { x:imgX, y:s.y-h2, width:w2, height:h2 })
              s.page.drawText(`${photoSeq}. ${finding.label || modMeta.label}`, { x:imgX, y:s.y-h2-11, font:obl, size:7.5, color:C.text })
              rowMaxH = Math.max(rowMaxH, h2)
              imgX += w2 + 12
              photoSeq++
            } catch {}
          }
          if (rowMaxH > 0) s = { ...s, y: s.y - rowMaxH - 20 }
        }

        s = hRule(s, 0)
      }

      // Module notes (no findings)
      if (mod.notes && mod.findings.length === 0) {
        s = need(s, 40)
        const mL = modMeta.label
        s.page.drawText(sanitise(mL), { x:ML, y:s.y, font:bold, size:10, color:C.navy })
        s.page.drawRectangle({ x:ML, y:s.y-1, width:bold.widthOfTextAtSize(mL,10), height:0.5, color:C.navy })
        s = { ...s, y: s.y - 14 }
        s = drawWrappedText(s, mod.notes, ML+14, reg, 9, C.text, TW-14, 12.5)
        s = hRule(s, 0)
      }
    }
  }

  // ── Standards reference for pending/not-yet-inspected modules ───────────────
  if (standardsMods.length > 0) {
    s = need(s, 40)
    s = subHeader(s, 'Inspection Standards & Requirements')
    s = { ...s, y: s.y - 8 }

    for (const mod of standardsMods) {
      const modMeta = MODULE_META[mod.id]
      const std     = getModuleStandard(mod.id)
      if (!modMeta || !std) continue

      s = need(s, 50)

      // Module name
      const modLabel = sanitise(modMeta.label)
      s.page.drawText(modLabel, { x: ML, y: s.y, font: s.fonts.bold, size: 10, color: C.navy })
      s.page.drawRectangle({ x: ML, y: s.y - 1, width: s.fonts.bold.widthOfTextAtSize(modLabel, 10), height: 0.5, color: C.navy })
      s = { ...s, y: s.y - 14 }

      // Status pill
      s = need(s, 12)
      s.page.drawText('Status: Not yet inspected', { x: ML + 14, y: s.y, font: s.fonts.obl, size: 8, color: C.midgrey })
      s = { ...s, y: s.y - 12 }

      // Standard description
      if (std.standard) {
        s = need(s, 14)
        s.page.drawText('Standard:  ', { x: ML + 14, y: s.y, font: s.fonts.bold, size: 8.5, color: C.text })
        s = { ...s, y: s.y - 11 }
        s = drawWrappedText(s, sanitise(std.standard), ML + 14, s.fonts.reg, 8.5, C.text, TW - 14, 11.5)
      }

      // Checklist items
      if (std.checkItems && std.checkItems.length > 0) {
        s = need(s, 14)
        s.page.drawText('Inspection checklist:', { x: ML + 14, y: s.y, font: s.fonts.bold, size: 8.5, color: C.text })
        s = { ...s, y: s.y - 12 }
        for (const item of std.checkItems) {
          s = need(s, 11)
          s.page.drawCircle({ x: ML + 18, y: s.y - 1.5, size: 2, color: C.blue })
          s = drawWrappedText(s, sanitise(item), ML + 24, s.fonts.reg, 8, C.text2, TW - 24, 11)
        }
      }

      // Code reference
      if (std.codeRef) {
        s = need(s, 11)
        const cr = 'Code reference:  '
        s.page.drawText(cr, { x: ML + 14, y: s.y, font: s.fonts.bold, size: 8, color: C.text })
        s.page.drawText(sanitise(std.codeRef), { x: ML + 14 + s.fonts.bold.widthOfTextAtSize(cr, 8), y: s.y, font: s.fonts.obl, size: 8, color: C.blue })
        s = { ...s, y: s.y - 11 }
      }

      // Limitations
      if (std.limitations) {
        s = need(s, 11)
        s.page.drawText('Limitations:  ', { x: ML + 14, y: s.y, font: s.fonts.bold, size: 8, color: C.text })
        s = { ...s, y: s.y - 10 }
        s = drawWrappedText(s, sanitise(std.limitations), ML + 14, s.fonts.obl, 8, C.midgrey, TW - 14, 11)
      }

      s = need(s, 10)
      s.page.drawRectangle({ x: ML, y: s.y + 2, width: TW, height: 0.3, color: C.lightgrey })
      s = { ...s, y: s.y - 10 }
    }
  }

  // ── Inspection Methods & Limitations ────────────────────────────────────────
  const hasLimitations = !!(phase.phaseNotes || phase.holdPoint || meta.obcRef)
  if (hasLimitations) {
    s = need(s, 60)
    s = subHeader(s, 'Inspection Methods & Limitations')
    s = { ...s, y: s.y - 8 }

    if (meta.obcRef || phase.holdPoint) {
      s = drawWrappedText(s, `OBC Hold Point: ${meta.obcRef || 'Inspector sign-off required before proceeding to next phase.'}`, ML, reg, 9, C.text, TW, 12.5)
    }
    if (phase.phaseNotes) {
      s = drawWrappedText(s, phase.phaseNotes, ML, reg, 9, C.text, TW, 12.5)
    }
  }
}

// ── Site Information ──────────────────────────────────────────────────────────
async function buildSiteInfoPage(pdfDoc: PDFDocument, job: InspectionJob, fonts: Record<string, PDFFont>) {
  let s = startSection(pdfDoc, 'Site Information', C.darkgrey, fonts, job)
  const { bold, reg } = fonts

  s = subHeader(s, 'Descriptions')
  s = { ...s, y: s.y - 8 }

  const rows = [
    { label:'Weather at inspection',      value:fmtWeather(job.weather) },
    { label:'Property occupied',          value:job.isOccupied ? 'Yes' : 'No' },
    { label:'Property secured',           value:job.isSecure   ? 'Yes' : 'No' },
    { label:'Building type',              value:fmtBuildingType(job.buildingType) },
    { label:'Estimated age of building',  value:job.estimatedAge || 'Not recorded' },
    { label:'Wall construction',          value:fmtConstruction(job.wallConstruction) },
    { label:'Roof covering',              value:fmtRoof(job.roofCovering) },
    { label:'Foundation type',            value:fmtFooting(job.footingType) },
    { label:'Internal walls',             value:job.internalWalls || 'Not recorded' },
    { label:'Windows',                    value:job.windows || 'Not recorded' },
    { label:'Permit number',              value:job.permitNumber || 'Not recorded' },
    { label:'Inspection purpose',         value:job.purposeNote || 'Building Inspection' },
    { label:'Project type',               value:job.projectType === 'renovation' ? 'Renovation' : 'New Construction' },
    { label:'Inspector',                  value:(job.inspectorName || '') + (job.licenceNumber ? ` (Lic. ${job.licenceNumber})` : '') },
    { label:'Company',                    value:job.company || 'Just Open Technologies Inc.' },
    { label:'Client',                     value:job.clientName || 'Not specified' },
    { label:'Client email',               value:job.clientEmail || '' },
  ]

  for (const row of rows) {
    if (!row.value || ['unknown','Unknown','Not recorded Not recorded'].includes(row.value)) continue
    s = need(s, 16)
    const lw = bold.widthOfTextAtSize(row.label + ':  ', 9)
    const valMaxW = TW - lw
    s.page.drawText(sanitise(row.label + ':  '), { x:ML, y:s.y, font:bold, size:9, color:C.text })
    if (reg.widthOfTextAtSize(row.value, 9) <= valMaxW) {
      s.page.drawText(sanitise(row.value), { x:ML+lw, y:s.y, font:reg, size:9, color:C.darkgrey })
      s = { ...s, y: s.y - 14 }
    } else {
      s = { ...s, y: s.y - 12 }
      s = drawWrappedText(s, row.value, ML+10, reg, 9, C.darkgrey, TW-10, 12)
    }
  }

  s = need(s, 55)
  s = { ...s, y: s.y - 20 }
  s.page.drawRectangle({ x:ML, y:s.y, width:TW, height:0.6, color:C.border })
  s = { ...s, y: s.y - 16 }
  const endTxt = 'END OF REPORT'
  const endW   = fonts.bold.widthOfTextAtSize(endTxt, 11)
  s.page.drawText(endTxt, { x: PW/2 - endW/2, y: s.y, font: fonts.bold, size: 11, color: C.navy })
  s = { ...s, y: s.y - 26 }
  s = drawWrappedText(s,
    'This report was prepared using stAIrcode by Just Open Technologies Inc. It is a visual inspection aid only and does not replace a formal inspection by a licensed professional. All findings should be verified by qualified tradespeople before action is taken.',
    ML, reg, 7.5, C.midgrey, TW, 11)
}
