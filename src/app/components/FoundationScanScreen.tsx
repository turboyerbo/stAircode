'use client'
/**
 * FoundationScanScreen.tsx — Foundation Inspection Module
 *
 * Stage flow (identical to ScanReadyScreen):
 *   position → countdown → ready (user tap) → hold (camera live) →
 *   capture (user tap) → analysing (AI) → result → next position
 *
 * 4 positions:
 *   1. wall_overview  — full exterior wall, classify type, detect cracks, moisture (required)
 *   2. crack_detail   — close-up crack measurement (optional)
 *   3. wall_thickness — at opening/edge, measure wall thickness (optional)
 *   4. base_footing   — base of wall, footing assessment (optional)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import MeasurementLineOverlay from './MeasurementLineOverlay'

// ── Palette (shared with ScanReadyScreen) ─────────────────────────────────────
const NAVY   = '#0A1C2E'
const GREEN  = '#27A96B'
const AMBER  = '#FA741F'
const WHITE  = '#E8F4FF'
const WHITE2 = '#93BAD4'
const BLUE   = '#4A90E2'
const BORDER = 'rgba(147,186,212,0.15)'

// ── Foundation measurement result ─────────────────────────────────────────────
export interface FoundationMeasurements {
  // Wall classification
  wallType:           string    // 'poured_concrete'|'concrete_block'|'stone'|'brick'|'icf'|'unknown'
  wallTypeConfidence: number
  wallTypeLabel:      string    // human-readable for report

  // Dimensions
  wallHeight:    number | null  // mm, exposed above grade
  wallThickness: number | null  // mm, measured at opening/edge
  footingWidth:  number | null  // mm

  // Crack assessment
  crackPresent:    boolean
  crackType:       string       // 'none'|'hairline'|'horizontal'|'diagonal'|'vertical'|'stair_step'|'multiple'
  crackWidthMm:    number | null
  crackLengthMm:   number | null
  horizontalCrack: boolean      // CRITICAL structural flag

  // Moisture
  moisturePresent:     boolean
  efflorescence:       boolean
  dampproofingVisible: boolean | null  // null = not assessable from this angle

  // Overall
  overallCondition: string  // 'good'|'fair'|'poor'|'critical'
  confidence:       number
  occupancyType:    string
}

// ── Position types ─────────────────────────────────────────────────────────────
type FoundationPosition = 'wall_overview' | 'crack_detail' | 'wall_thickness' | 'base_footing'
type Stage = 'position' | 'ready' | 'hold' | 'capture' | 'analysing' | 'result'

interface PosCfg {
  id:           FoundationPosition
  step:         number
  label:        string
  headline:     string
  detail:       string
  readyLabel:   string
  captureLabel: string
  holdSeconds:  number
  positionTime: number
  optional:     boolean
  color:        string
  aiPrompt:     (prior: Partial<FoundationMeasurements>) => string
}

// ── Intro slides (SVG-illustrated — no image file dependencies) ───────────────
const INTRO_SLIDES = [
  {
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="20" width="64" height="50" rx="3" stroke="#0A1C2E" strokeWidth="3"/>
        <rect x="8" y="20" width="64" height="50" fill="#EBF3FA"/>
        <line x1="8" y1="44" x2="72" y2="44" stroke="#417CA4" strokeWidth="1.5" strokeDasharray="3,2"/>
        <rect x="20" y="44" width="12" height="26" fill="#C5D8E8"/>
        <rect x="48" y="44" width="12" height="26" fill="#C5D8E8"/>
        <path d="M8 20 L40 8 L72 20" stroke="#0A1C2E" strokeWidth="2.5" fill="#0A1C2E" fillOpacity="0.08"/>
        <text x="40" y="37" textAnchor="middle" fontSize="9" fill="#417CA4" fontFamily="monospace" fontWeight="700">GRADE LINE</text>
      </svg>
    ),
    title: 'Step 1 — Full Wall View',
    desc: 'Stand back so the entire foundation wall height fits in frame — from grade level (soil surface) to the top of the wall. Include the corners if possible.',
  },
  {
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="10" width="60" height="60" rx="3" fill="#FFF3E0" stroke="#F29337" strokeWidth="2"/>
        <line x1="10" y1="30" x2="70" y2="30" stroke="#0A1C2E" strokeWidth="1" strokeDasharray="2,2"/>
        <line x1="10" y1="50" x2="70" y2="50" stroke="#0A1C2E" strokeWidth="1" strokeDasharray="2,2"/>
        <path d="M25 35 Q40 32 55 38" stroke="#E84545" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M20 52 L60 48" stroke="#FA741F" strokeWidth="2" strokeLinecap="round" strokeDasharray="3,2"/>
        <circle cx="40" cy="36" r="6" fill="none" stroke="#E84545" strokeWidth="2"/>
        <text x="40" y="72" textAnchor="middle" fontSize="8" fill="#E84545" fontFamily="monospace" fontWeight="700">CRACKS</text>
      </svg>
    ),
    title: 'Step 2 — Crack Close-Up',
    desc: 'If any cracks are visible, move close and photograph them directly. The AI will measure the crack width and classify the type. Horizontal cracks are the most serious.',
  },
  {
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="10" width="50" height="60" rx="2" fill="#EBF3FA" stroke="#417CA4" strokeWidth="2.5"/>
        <line x1="15" y1="10" x2="15" y2="70" stroke="#417CA4" strokeWidth="4"/>
        <line x1="65" y1="10" x2="65" y2="70" stroke="#417CA4" strokeWidth="4"/>
        <line x1="10" y1="40" x2="70" y2="40" stroke="#27A96B" strokeWidth="2"/>
        <line x1="10" y1="36" x2="10" y2="44" stroke="#27A96B" strokeWidth="2"/>
        <line x1="70" y1="36" x2="70" y2="44" stroke="#27A96B" strokeWidth="2"/>
        <text x="40" y="37" textAnchor="middle" fontSize="8" fill="#27A96B" fontFamily="monospace" fontWeight="700">THICKNESS</text>
        <text x="40" y="52" textAnchor="middle" fontSize="9" fill="#417CA4" fontFamily="monospace">190 mm</text>
      </svg>
    ),
    title: 'Step 3 — Wall Thickness',
    desc: 'At a window or door opening — or any exposed wall edge — photograph the cross-section so the full wall thickness is visible. Standard CMU blocks are 190mm wide.',
  },
  {
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="25" y="8" width="30" height="50" fill="#C5D8E8" stroke="#417CA4" strokeWidth="2"/>
        <rect x="10" y="58" width="60" height="16" rx="2" fill="#9DB4C5" stroke="#417CA4" strokeWidth="2"/>
        <line x1="10" y1="58" x2="70" y2="58" stroke="#27A96B" strokeWidth="2.5"/>
        <line x1="5" y1="54" x2="5" y2="76" stroke="#27A96B" strokeWidth="1.5"/>
        <line x1="75" y1="54" x2="75" y2="76" stroke="#27A96B" strokeWidth="1.5"/>
        <text x="40" y="52" textAnchor="middle" fontSize="8" fill="#417CA4" fontFamily="monospace">FOOTING</text>
        <text x="40" y="73" textAnchor="middle" fontSize="8" fill="#27A96B" fontFamily="monospace" fontWeight="700">WIDTH</text>
      </svg>
    ),
    title: 'Step 4 — Foundation Base',
    desc: 'Angle the camera down at the base of the wall where it meets the soil or floor. The AI will assess the footing projection and base condition.',
  },
  {
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="5" width="30" height="45" rx="2" fill="#EBF3FA" stroke="#417CA4" strokeWidth="1.5"/>
        <rect x="5" y="5" width="30" height="45" fill="none" stroke="#417CA4" strokeWidth="1.5"/>
        {/* CMU block pattern */}
        <line x1="5" y1="20" x2="35" y2="20" stroke="#417CA4" strokeWidth="1"/>
        <line x1="5" y1="32" x2="35" y2="32" stroke="#417CA4" strokeWidth="1"/>
        <line x1="5" y1="44" x2="35" y2="44" stroke="#417CA4" strokeWidth="1"/>
        <line x1="20" y1="5" x2="20" y2="20" stroke="#417CA4" strokeWidth="1"/>
        <line x1="12" y1="20" x2="12" y2="32" stroke="#417CA4" strokeWidth="1"/>
        <line x1="24" y1="20" x2="24" y2="32" stroke="#417CA4" strokeWidth="1"/>
        <text x="20" y="62" textAnchor="middle" fontSize="7" fill="#417CA4" fontFamily="monospace">CMU: 190mm</text>
        <rect x="45" y="15" width="30" height="35" rx="2" fill="#F5F8FA" stroke="#9DB4C5" strokeWidth="1.5"/>
        <text x="60" y="30" textAnchor="middle" fontSize="7" fill="#5E7D9B" fontFamily="monospace">POURED</text>
        <text x="60" y="40" textAnchor="middle" fontSize="7" fill="#5E7D9B" fontFamily="monospace">CONC.</text>
        <text x="60" y="62" textAnchor="middle" fontSize="7" fill="#9DB4C5" fontFamily="monospace">150mm</text>
      </svg>
    ),
    title: 'Scale Reference — CMU Blocks',
    desc: 'Standard concrete blocks (CMU) are 190mm tall × 390mm long including mortar joints. Mortar joints are 10mm. The AI uses these as scale references — no measuring tape needed.',
  },
]

// ── Position definitions ───────────────────────────────────────────────────────
const POSITIONS: PosCfg[] = [
  {
    id: 'wall_overview', step: 1, label: 'Foundation Overview', color: BLUE,
    headline: 'Step back — full wall height in frame',
    detail: 'Stand back so the entire exposed foundation wall is visible — from the grade line (soil surface) at the bottom to the top of the wall. Include any visible cracks or moisture staining. Good even lighting works best.',
    readyLabel: 'Wall is framed — Start',
    captureLabel: 'Tap to capture foundation overview',
    holdSeconds: 5, positionTime: 12, optional: false,
    aiPrompt: (_p) => `You are a building inspection AI analysing a foundation wall image.

STEP 1 — WALL TYPE CLASSIFICATION:
Identify the wall material from visual evidence:
- Poured/cast concrete: smooth or lightly textured surface, form tie holes, construction joints, monolithic
- Concrete masonry units (CMU/block): regular rectangular blocks 190mm tall × 390mm long, 10mm mortar joints, may be hollow or solid
- Stone/rubble: irregular natural stone of varying sizes and shapes
- Brick: smaller units ~65mm tall × 215mm long face with 10mm mortar joints
- ICF (Insulated Concrete Form): smooth finish, foam edge strips visible, no block pattern
Set wallType to: "poured_concrete" | "concrete_block" | "stone" | "brick" | "icf" | "unknown"

STEP 2 — SCALE CALIBRATION (critical):
Use these known dimension references in order of priority:
1. CMU block face: 190mm tall × 390mm long (includes one mortar joint each direction)
2. CMU mortar joint: 10mm
3. Full brick face: 65mm tall × 215mm long
4. Brick mortar joint: 10mm
5. Standard window/door frame width: 838mm (33") or 914mm (36")
6. Standard door height: 2032mm (80")
7. Electrical outlet/switch plate: 86×86mm (North America standard)
8. Human adult in frame: ~1750mm total height

STEP 3 — EXPOSED WALL HEIGHT:
Measure from finished grade (soil surface line) to top of visible foundation wall.
If grade line is not clearly visible, estimate from context clues.
Report in mm. null if cannot determine.

STEP 4 — CRACK ASSESSMENT:
Scan the ENTIRE visible wall surface systematically for cracks.
Classify each crack type:
- "horizontal": runs parallel to mortar courses/grade — CRITICAL, indicates lateral soil pressure
- "diagonal": runs at ~45° from corners or openings — settlement or bearing failure
- "stair_step": follows mortar joints diagonally in CMU/brick — differential settlement
- "vertical": runs vertically, usually thermal/shrinkage, less structurally significant
- "hairline": very fine (<0.1mm), surface only, usually normal
- "multiple": more than one type present
- "none": no cracks visible

For the most significant crack found, estimate width:
- Hairline: < 0.1mm (thinner than a credit card edge at 0.76mm)
- Fine: 0.1–0.3mm
- Medium: 0.3–1.0mm
- Wide: > 1.0mm (wider than a 1mm drill bit)

CRITICAL FLAG: Set "horizontalCrack" to true if ANY horizontal cracks are visible.
Horizontal cracks in foundation walls indicate lateral earth pressure potentially exceeding
wall capacity — this is a structural emergency requiring immediate professional assessment.

STEP 5 — MOISTURE INDICATORS:
- Efflorescence: white chalky mineral deposits on wall surface — indicates water migration
- Active moisture: wet areas, dripping, dark wet patches
- Staining: rust-coloured, grey, or black tide marks from past water events
- Dampproofing: black bituminous/asphalt coating visible on exterior surface

STEP 6 — OVERALL CONDITION:
- "good": no cracks, no moisture, wall intact
- "fair": minor hairline cracks or minor efflorescence, wall structurally sound
- "poor": medium cracks (0.3–1mm), significant moisture, repairs needed
- "critical": horizontal cracks, wide cracks (>1mm), active moisture ingress, immediate attention required

Reply ONLY with valid JSON (no markdown, no backticks):
{
  "wallType": "poured_concrete"|"concrete_block"|"stone"|"brick"|"icf"|"unknown",
  "wallTypeLabel": "human-readable name e.g. Concrete Masonry Units (CMU)",
  "wallTypeConfidence": 0.0-1.0,
  "wallHeight": number|null,
  "crackPresent": true|false,
  "crackType": "none"|"hairline"|"horizontal"|"diagonal"|"vertical"|"stair_step"|"multiple",
  "crackWidthMm": number|null,
  "crackLengthMm": number|null,
  "horizontalCrack": true|false,
  "moisturePresent": true|false,
  "efflorescence": true|false,
  "dampproofingVisible": true|false|null,
  "overallCondition": "good"|"fair"|"poor"|"critical",
  "occupancyType": "residential_single"|"residential_multi"|"commercial"|"industrial"|"unknown",
  "scaleRef": "what you used for scale",
  "confident": true|false,
  "message": "one-sentence summary for the inspector"
}`,
  },

  {
    id: 'crack_detail', step: 2, label: 'Crack Documentation', color: '#E84545',
    headline: 'Move close — crack fills the frame',
    detail: 'Move close enough so the crack fills most of the frame. Include nearby mortar joints or block edges for scale. A coin or credit card placed beside the crack gives the most accurate width measurement.',
    readyLabel: 'Crack is framed — Start measuring',
    captureLabel: 'Tap to document crack',
    holdSeconds: 5, positionTime: 12, optional: true,
    aiPrompt: (p) => `Close-up foundation crack documentation. Measure crack width and length precisely.

STEP 1 — SCALE CALIBRATION (critical for crack width):
In this close-up view, look carefully for:
1. Credit/debit card: 0.76mm thick (edge-on), 85.6mm × 54mm face
2. CMU mortar joint: 10mm wide
3. CMU block face height: 190mm
4. Brick mortar joint: 10mm
5. Coin (if visible): typical coin 1.5–3mm thick, 18–28mm diameter depending on denomination
6. Human finger width: ~18mm
7. Pencil width: ~7mm
Crack widths are very small — use the thinnest reference available.

STEP 2 — CRACK CHARACTERISATION:
a) TYPE: Classify the crack type precisely:
   - "horizontal": runs parallel to mortar courses — lateral pressure, CRITICAL
   - "diagonal": 30–60° angle — shear/settlement
   - "stair_step": follows mortar joints in CMU/brick diagonally — differential settlement
   - "vertical": plumb crack — shrinkage/thermal (usually less critical)
   - "hairline": very fine surface crack, <0.1mm

b) WIDTH: Measure at the widest point in mm.
   Use comparison: credit card edge = 0.76mm; mortar joint = 10mm
   Typical crack widths: hairline 0.05–0.1mm, fine 0.1–0.3mm, medium 0.3–1mm, wide 1–5mm

c) LENGTH: Estimate total visible length in mm.

d) EDGES: Are crack edges sharp (fresh, recent) or rounded/stained (old, stable)?

e) PATTERN: Single clean crack or network of cracks?

f) STRUCTURAL SIGNIFICANCE:
   - Hairline vertical in poured concrete: normal shrinkage, low concern
   - Diagonal from corners: moderate — monitor for progression
   - Stair-step in CMU: differential settlement — professional assessment
   - Horizontal in CMU: CRITICAL — lateral pressure, immediate assessment required
   - Horizontal in poured: CRITICAL — serious structural concern

Prior scan data: wallType=${p.wallType ?? 'unknown'}, overallCondition=${p.overallCondition ?? 'unknown'}

Reply ONLY with valid JSON:
{
  "crackType": "horizontal"|"diagonal"|"stair_step"|"vertical"|"hairline"|"multiple",
  "crackWidthMm": number,
  "crackLengthMm": number|null,
  "horizontalCrack": true|false,
  "crackEdges": "sharp"|"rounded"|"stained",
  "structuralSignificance": "low"|"moderate"|"high"|"critical",
  "scaleRef": "what was used",
  "message": "one sentence for the inspector"
}`,
  },

  {
    id: 'wall_thickness', step: 3, label: 'Wall Thickness', color: GREEN,
    headline: 'Frame the wall edge — full thickness visible',
    detail: 'Photograph the wall at a window or door opening, or any exposed end where the full wall cross-section is visible from face to face. A reference object on the wall edge improves accuracy significantly.',
    readyLabel: 'Wall edge in frame — Start measuring',
    captureLabel: 'Tap to measure wall thickness',
    holdSeconds: 5, positionTime: 12, optional: true,
    aiPrompt: (p) => `Measure FOUNDATION WALL THICKNESS — the horizontal distance from one face of the wall to the other, measured at a window/door opening or exposed wall end.

STEP 1 — SCALE CALIBRATION:
Use these references in this order of priority:
1. Known wall type from prior scan: ${p.wallType ?? 'unknown'}
   - If concrete_block (CMU): a standard block is 190mm wide (8" nominal)
   - If poured_concrete: look for form tie holes — typically spaced 600mm apart
   - If stone: irregular, use mortar joints ~10mm as reference
2. Window/door frame dimensions: frame depth typically 100–140mm in residential
3. Brick: standard 90mm for one wythe, 190mm for double wythe
4. Credit card in frame: 0.76mm thick / 85.6×54mm face if placed on wall
5. Standard framing lumber beside opening: 38×89mm (2×4 nominal)
6. Electrical conduit in wall: typically 20–25mm

STEP 2 — WALL THICKNESS MEASUREMENT:
Measure from the exterior face to the interior face of the wall.
If only the exterior or interior is visible, note which face is shown.
Provide the total wall thickness in mm.

Typical values by wall type:
- CMU (concrete block): 190mm (8"), 140mm (6"), or 240mm (10") — look at block width
- Poured concrete: 150mm (6") to 300mm (12")
- Stone/rubble: 300–600mm
- Brick (residential): 90mm (single wythe) or 190mm (double wythe)
- ICF: 250–350mm (foam + concrete combined)

STEP 3 — WALL HEIGHT (if full wall visible):
If the full height from grade to top is visible at this angle, re-confirm height.

Reply ONLY with valid JSON:
{
  "wallThicknessMm": number,
  "wallFaceVisible": "exterior"|"interior"|"both",
  "confidence": 0.0-1.0,
  "scaleRef": "what you used",
  "message": "one sentence"
}`,
  },

  {
    id: 'base_footing', step: 4, label: 'Foundation Base', color: AMBER,
    headline: 'Angle down — base of wall and footing',
    detail: 'Aim the camera at the base of the foundation wall where it meets the soil or floor slab. Include as much of the footing width as possible. A view from slightly to the side works best.',
    readyLabel: 'Base in frame — Start',
    captureLabel: 'Tap to assess foundation base',
    holdSeconds: 5, positionTime: 12, optional: true,
    aiPrompt: (p) => `Assess the FOUNDATION BASE and FOOTING at the base of the wall.

STEP 1 — SCALE CALIBRATION:
Known context: wallType=${p.wallType ?? 'unknown'}, wallThickness=${p.wallThickness ?? 'unknown'}mm
Reference objects in priority order:
1. Wall thickness (from prior scan): ${p.wallThickness ?? 190}mm — use this as primary scale
2. CMU block: 190mm tall × 390mm long if block visible
3. Gravel aggregate size: typically 20mm (3/4") in concrete
4. Rebar diameter visible at footing edge: typically 15M (16mm) in residential
5. Mortar joint if block present: 10mm

STEP 2 — FOOTING ASSESSMENT:
A) Is a distinct footing visible (wider base projecting beyond the wall)?
   Standard footing projection: each side extends wall_thickness/2 to wall_thickness beyond the wall face.
   OBC/NBC minimum: footing width = 2× wall thickness minimum for residential.
   
B) Footing width in mm (full width, face to face):
   Typical values:
   - Residential CMU wall: 400–600mm footing (for 190mm wall)
   - Residential poured: 350–500mm (for 150mm wall)
   - Commercial: 600mm+ depending on loads

C) Footing condition:
   - Visible cracking in footing?
   - Footing-wall separation (crack between wall and footing)?
   - Footing sitting on stable bearing surface?

STEP 3 — BASE CONDITION:
- Soil contact: is soil pressing against wall uniformly?
- Evidence of undermining or erosion at base?
- Any gaps between wall and footing?
- Efflorescence or moisture at base?

Reply ONLY with valid JSON:
{
  "footingVisible": true|false,
  "footingWidthMm": number|null,
  "footingProjectionMm": number|null,
  "footingCondition": "good"|"fair"|"poor"|"not_visible",
  "wallFootingSeparation": true|false,
  "baseErosion": true|false,
  "moistureAtBase": true|false,
  "scaleRef": "what you used",
  "message": "one sentence for the inspector"
}`,
  },
]

// ── Vision helpers (shared pattern with ScanReadyScreen) ──────────────────────
async function callVision(b64: string, prompt: string, ms = 20000): Promise<string | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch('/api/vision', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageB64: b64, prompt }), signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!r.ok) return null
    const d = await r.json()
    return d.text ?? null
  } catch { clearTimeout(t); return null }
}

function parseJSON(s: string | null): any {
  if (!s) return null
  try {
    const m = s.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
    return m ? JSON.parse(m[0]) : null
  } catch { return null }
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  onSuccess: (m: FoundationMeasurements) => void
  onBack:    () => void
  startAtReview?: boolean
}

// ── Inline SVG illustrations for position instructions ────────────────────────
function PositionIllustration({ posId }: { posId: FoundationPosition }) {
  const svgs: Record<FoundationPosition, React.ReactNode> = {
    wall_overview: (
      <svg width="100%" height="180" viewBox="0 0 320 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="320" height="180" fill="#0A1C2E"/>
        {/* Foundation wall — CMU block pattern */}
        {[0,1,2,3].map(row => [0,1,2,3,4].map(col => (
          <rect key={`${row}-${col}`}
            x={20 + col * 58} y={20 + row * 34}
            width={54} height={30} rx="1"
            fill={`rgba(65,124,164,${0.15 + (row + col) % 2 * 0.08})`}
            stroke="rgba(65,124,164,0.4)" strokeWidth="1"
          />
        )))}
        {/* Grade line */}
        <line x1="0" y1="156" x2="320" y2="156" stroke="#F29337" strokeWidth="2" strokeDasharray="8,4"/>
        <text x="8" y="170" fontSize="9" fill="#F29337" fontFamily="monospace" fontWeight="700">GRADE LINE</text>
        {/* Height arrow */}
        <line x1="295" y1="24" x2="295" y2="154" stroke="#4A90E2" strokeWidth="1.5"/>
        <path d="M290 28 L295 18 L300 28" fill="#4A90E2"/>
        <path d="M290 150 L295 160 L300 150" fill="#4A90E2"/>
        <text x="308" y="92" fontSize="9" fill="#4A90E2" fontFamily="monospace" fontWeight="700" textAnchor="middle" transform="rotate(90, 308, 92)">HEIGHT</text>
        {/* Camera indicator */}
        <rect x="130" y="130" width="60" height="40" rx="6" fill="rgba(39,169,107,0.2)" stroke="#27A96B" strokeWidth="2"/>
        <circle cx="160" cy="150" r="8" fill="rgba(39,169,107,0.3)" stroke="#27A96B" strokeWidth="1.5"/>
        <text x="160" y="175" textAnchor="middle" fontSize="8" fill="#27A96B" fontFamily="monospace">STAND HERE</text>
      </svg>
    ),
    crack_detail: (
      <svg width="100%" height="180" viewBox="0 0 320 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="320" height="180" fill="#0A1C2E"/>
        {/* Block background */}
        <rect x="30" y="20" width="260" height="140" fill="rgba(65,124,164,0.12)" stroke="rgba(65,124,164,0.3)" strokeWidth="1"/>
        <line x1="30" y1="67" x2="290" y2="67" stroke="rgba(65,124,164,0.35)" strokeWidth="1"/>
        <line x1="30" y1="114" x2="290" y2="114" stroke="rgba(65,124,164,0.35)" strokeWidth="1"/>
        {/* Crack lines */}
        <path d="M120 20 Q125 44 118 67 Q122 90 116 114 Q120 137 118 160" stroke="#E84545" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M200 20 L220 67 L205 114 L215 160" stroke="#FA741F" strokeWidth="2" strokeLinecap="round"/>
        {/* Width indicator */}
        <line x1="120" y1="90" x2="140" y2="90" stroke="#27A96B" strokeWidth="1.5"/>
        <text x="148" y="94" fontSize="9" fill="#27A96B" fontFamily="monospace">WIDTH</text>
        {/* Labels */}
        <text x="100" y="175" textAnchor="middle" fontSize="8" fill="#E84545" fontFamily="monospace" fontWeight="700">VERTICAL</text>
        <text x="215" y="175" textAnchor="middle" fontSize="8" fill="#FA741F" fontFamily="monospace" fontWeight="700">DIAGONAL</text>
        <rect x="50" y="50" width="60" height="18" rx="3" fill="rgba(232,69,69,0.2)" stroke="#E84545" strokeWidth="1.5"/>
        <text x="80" y="62" textAnchor="middle" fontSize="8" fill="#E84545" fontFamily="monospace" fontWeight="700">MOVE CLOSE</text>
      </svg>
    ),
    wall_thickness: (
      <svg width="100%" height="180" viewBox="0 0 320 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="320" height="180" fill="#0A1C2E"/>
        {/* Wall cross-section at opening */}
        <rect x="40" y="20" width="90" height="140" fill="rgba(65,124,164,0.2)" stroke="rgba(65,124,164,0.5)" strokeWidth="2"/>
        {/* Block detail in wall */}
        <line x1="40" y1="54" x2="130" y2="54" stroke="rgba(65,124,164,0.4)" strokeWidth="1"/>
        <line x1="40" y1="88" x2="130" y2="88" stroke="rgba(65,124,164,0.4)" strokeWidth="1"/>
        <line x1="40" y1="122" x2="130" y2="122" stroke="rgba(65,124,164,0.4)" strokeWidth="1"/>
        {/* Thickness arrow */}
        <line x1="40" y1="90" x2="130" y2="90" stroke="#27A96B" strokeWidth="2.5"/>
        <path d="M46 84 L36 90 L46 96" fill="#27A96B"/>
        <path d="M124 84 L134 90 L124 96" fill="#27A96B"/>
        <text x="85" y="108" textAnchor="middle" fontSize="11" fill="#27A96B" fontFamily="monospace" fontWeight="900">190mm</text>
        {/* Opening */}
        <rect x="150" y="30" width="80" height="120" fill="rgba(10,28,46,0.6)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeDasharray="4,3"/>
        <text x="190" y="95" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.45)" fontFamily="monospace">OPENING</text>
        {/* Camera position */}
        <text x="270" y="95" textAnchor="middle" fontSize="9" fill="#4A90E2" fontFamily="monospace">VIEW</text>
        <text x="270" y="107" textAnchor="middle" fontSize="9" fill="#4A90E2" fontFamily="monospace">FROM</text>
        <text x="270" y="119" textAnchor="middle" fontSize="9" fill="#4A90E2" fontFamily="monospace">SIDE</text>
      </svg>
    ),
    base_footing: (
      <svg width="100%" height="180" viewBox="0 0 320 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="320" height="180" fill="#0A1C2E"/>
        {/* Wall */}
        <rect x="110" y="10" width="100" height="95" fill="rgba(65,124,164,0.2)" stroke="rgba(65,124,164,0.5)" strokeWidth="2"/>
        {/* Block lines */}
        <line x1="110" y1="44" x2="210" y2="44" stroke="rgba(65,124,164,0.4)" strokeWidth="1"/>
        <line x1="110" y1="78" x2="210" y2="78" stroke="rgba(65,124,164,0.4)" strokeWidth="1"/>
        {/* Footing */}
        <rect x="60" y="105" width="200" height="40" rx="2" fill="rgba(65,124,164,0.35)" stroke="rgba(65,124,164,0.6)" strokeWidth="2.5"/>
        {/* Footing width arrow */}
        <line x1="60" y1="155" x2="260" y2="155" stroke="#F29337" strokeWidth="2"/>
        <path d="M66 149 L56 155 L66 161" fill="#F29337"/>
        <path d="M254 149 L264 155 L254 161" fill="#F29337"/>
        <text x="160" y="172" textAnchor="middle" fontSize="9" fill="#F29337" fontFamily="monospace" fontWeight="700">FOOTING WIDTH</text>
        {/* Projection labels */}
        <line x1="60" y1="105" x2="60" y2="145" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3,2"/>
        <line x1="260" y1="105" x2="260" y2="145" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3,2"/>
        <text x="85" y="100" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)" fontFamily="monospace">PROJ.</text>
        <text x="240" y="100" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)" fontFamily="monospace">PROJ.</text>
        {/* Camera angle indicator */}
        <path d="M160 60 L160 105" stroke="rgba(39,169,107,0.6)" strokeWidth="1.5" strokeDasharray="4,3"/>
        <text x="225" y="65" textAnchor="middle" fontSize="8" fill="#27A96B" fontFamily="monospace">CAMERA</text>
        <text x="225" y="77" textAnchor="middle" fontSize="8" fill="#27A96B" fontFamily="monospace">ANGLES</text>
        <text x="225" y="89" textAnchor="middle" fontSize="8" fill="#27A96B" fontFamily="monospace">DOWN</text>
      </svg>
    ),
  }
  return (
    <div style={{ width: '100%', borderRadius: 10, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
      {svgs[posId]}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function FoundationScanScreen({ onSuccess, onBack, startAtReview = false }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const captureRef = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const busyRef    = useRef(false)
  const capturedFrames = useRef<Record<string, string>>({})

  const [posIdx,    setPosIdx]    = useState(0)
  const [stage,     setStage]     = useState<Stage>('position')
  const [countdown, setCountdown] = useState(0)
  const [camReady,  setCamReady]  = useState(false)
  const [camWarm,   setCamWarm]   = useState(false)
  const [camError,  setCamError]  = useState(false)
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const [results,   setResults]   = useState<Partial<FoundationMeasurements>>({})
  const resultsRef  = useRef<Partial<FoundationMeasurements>>({})
  const [reviewVals, setReviewVals] = useState<Partial<FoundationMeasurements>>({})
  const [showIntro,  setShowIntro]  = useState(!startAtReview)
  const [showReview, setShowReview] = useState(startAtReview)
  const [introSlide, setIntroSlide] = useState(0)
  const [showBackMenu, setShowBackMenu] = useState(false)
  const [showMeasureLine,  setShowMeasureLine]  = useState(false)
  const [measureLineValue, setMeasureLineValue] = useState<string | null>(null)
  const [measureLineLabel, setMeasureLineLabel] = useState('MEASURING')
  const [measureLineAxis,  setMeasureLineAxis]  = useState<'horizontal' | 'vertical'>('horizontal')

  const currentPos = POSITIONS[posIdx] ?? POSITIONS[0]
  const progressPct = (posIdx / POSITIONS.length) * 100
  const IMAGE_TOP   = 88
  const BOTTOM_PANEL = 220

  // ── Camera init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    async function startCamera(attempt = 0) {
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
      if (attempt > 0) await new Promise(r => setTimeout(r, 300 * attempt))
      let backDeviceId: string | undefined
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cams    = devices.filter(d => d.kind === 'videoinput')
        const back    = cams.find(d => /back|rear|environment/i.test(d.label)) ?? cams[cams.length - 1]
        if (back?.deviceId) backDeviceId = back.deviceId
      } catch {}
      const constraints: MediaStreamConstraints[] = [
        ...(backDeviceId ? [{ video: { deviceId: { exact: backDeviceId } }, audio: false }] : []),
        { video: { facingMode: 'environment' }, audio: false },
        { video: true, audio: false },
      ]
      let stream: MediaStream | null = null
      for (const constraint of constraints) {
        try { stream = await navigator.mediaDevices.getUserMedia(constraint); break }
        catch (e: any) {
          if (e?.name === 'NotReadableError' && attempt < 3) return startCamera(attempt + 1)
          continue
        }
      }
      if (!stream) { if (alive) setCamError(true); return }
      if (!alive)  { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      const attach = () => {
        const v = videoRef.current; if (!v) return
        v.srcObject = stream!; v.muted = true; v.playsInline = true; v.play().catch(() => {})
      }
      attach()
      let waited = 0
      const poll = setInterval(() => {
        if (!alive) { clearInterval(poll); return }
        waited += 100
        const v = videoRef.current
        if (v && !v.srcObject && streamRef.current) attach()
        if (v && v.videoWidth > 0 && v.videoHeight > 0) { clearInterval(poll); if (alive) setCamReady(true) }
        if (waited > 8000) { clearInterval(poll); if (alive) setCamReady(true) }
      }, 100)
    }
    startCamera()
    return () => { alive = false; streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  // ── Re-attach stream on active stages ───────────────────────────────────────
  useEffect(() => {
    if (stage === 'hold' || stage === 'capture' || stage === 'analysing' || stage === 'result') {
      const v = videoRef.current
      if (v && streamRef.current && !v.srcObject) {
        v.srcObject = streamRef.current; v.muted = true; v.play().catch(() => {})
      }
    }
  }, [stage])

  // ── Capture helpers ───────────────────────────────────────────────────────────
  function captureB64(scale = 1.0): string | null {
    const v = videoRef.current, c = captureRef.current
    if (!v || !c) return null
    if (streamRef.current && !v.srcObject) { v.srcObject = streamRef.current; v.muted = true; v.play().catch(() => {}) }
    if (v.videoWidth === 0 || v.videoHeight === 0 || v.readyState < 2) return null
    const MAX = 1600
    const ratio = Math.min(1, MAX / Math.max(v.videoWidth, v.videoHeight)) * scale
    c.width  = Math.round(v.videoWidth  * ratio)
    c.height = Math.round(v.videoHeight * ratio)
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(v, 0, 0, c.width, c.height)
    const probe = ctx.getImageData(c.width >> 1, c.height >> 1, 4, 4).data
    const isBlack = Array.from(probe).every((_, i) => i % 4 === 3 || probe[i] < 8)
    if (isBlack) return null
    return c.toDataURL('image/jpeg', 0.88).split(',')[1]
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  const goTo = useCallback((idx: number) => {
    if (idx >= POSITIONS.length) { finishScan(); return }
    busyRef.current = false
    setPosIdx(idx); setAiMessage(null); setStage('position')
    setCountdown(POSITIONS[idx].positionTime); setShowMeasureLine(false); setMeasureLineValue(null)
  }, []) // eslint-disable-line

  useEffect(() => { if (camReady) goTo(0) }, [camReady]) // eslint-disable-line

  // ── Stage: position countdown ─────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'position') return
    if (countdown <= 0) { setStage('ready'); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [stage, countdown])

  // ── Stage: hold countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'hold') return
    if (countdown <= 0) { setStage('capture'); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [stage, countdown])

  function handleReady() {
    setCamWarm(false); setStage('hold'); setCountdown(currentPos.holdSeconds)
    setTimeout(() => setCamWarm(true), 2000)
  }

  // ── Stage: capture ────────────────────────────────────────────────────────────
  function handleCapture() {
    const b64Full = captureB64(1.0)
    if (b64Full) {
      capturedFrames.current[currentPos.id] = b64Full
      try {
        const existing = JSON.parse(sessionStorage.getItem('sc_frames_foundation') || '{}')
        existing[currentPos.id] = b64Full
        sessionStorage.setItem('sc_frames_foundation', JSON.stringify(existing))
      } catch {}
    }
    busyRef.current = false; setStage('analysing')
  }

  // ── Stage: analysing ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'analysing' || busyRef.current) return
    busyRef.current = true

    async function run() {
      let b64: string | null = null
      for (let i = 0; i < 6; i++) { b64 = captureB64(); if (b64) break; await new Promise(r => setTimeout(r, 250)) }
      if (!b64) { busyRef.current = false; setStage('capture'); return }

      const priorSnap = { ...resultsRef.current }
      const raw = await callVision(b64, currentPos.aiPrompt(priorSnap))
      busyRef.current = false
      const r = parseJSON(raw)
      if (!r) { setAiMessage('Could not read the image clearly — tap Retry to try again.'); setStage('result'); return }

      // ── Extract measurements per position ──────────────────────────────────
      setResults(prev => {
        const next = { ...prev }
        const p = currentPos.id

        if (p === 'wall_overview') {
          if (r.wallType)             next.wallType             = r.wallType
          if (r.wallTypeLabel)        next.wallTypeLabel        = r.wallTypeLabel
          if (r.wallTypeConfidence != null) next.wallTypeConfidence = r.wallTypeConfidence
          if (r.wallHeight != null)   next.wallHeight           = r.wallHeight
          next.crackPresent    = r.crackPresent ?? false
          next.crackType       = r.crackType ?? 'none'
          next.crackWidthMm    = r.crackWidthMm ?? null
          next.crackLengthMm   = r.crackLengthMm ?? null
          next.horizontalCrack = r.horizontalCrack ?? false
          next.moisturePresent = r.moisturePresent ?? false
          next.efflorescence   = r.efflorescence ?? false
          if (r.dampproofingVisible != null) next.dampproofingVisible = r.dampproofingVisible
          next.overallCondition = r.overallCondition ?? 'fair'
          next.occupancyType    = r.occupancyType ?? 'unknown'
          next.confidence       = r.confident ? 0.85 : 0.60
        }

        if (p === 'crack_detail') {
          if (r.crackType)    next.crackType    = r.crackType
          if (r.crackWidthMm) next.crackWidthMm = r.crackWidthMm
          if (r.crackLengthMm) next.crackLengthMm = r.crackLengthMm
          if (r.horizontalCrack) next.horizontalCrack = r.horizontalCrack
        }

        if (p === 'wall_thickness') {
          if (r.wallThicknessMm) next.wallThickness = r.wallThicknessMm
        }

        if (p === 'base_footing') {
          if (r.footingWidthMm) next.footingWidth = r.footingWidthMm
        }

        resultsRef.current = next
        return next
      })

      setAiMessage(r.message ?? null)

      // Measurement line for numeric values
      const numericResults: Record<string, { label: string; axis: 'horizontal' | 'vertical' }> = {
        wall_overview:  { label: 'WALL HEIGHT',  axis: 'vertical'   },
        wall_thickness: { label: 'THICKNESS',    axis: 'horizontal' },
        base_footing:   { label: 'FOOTING WIDTH', axis: 'horizontal' },
      }
      const lineInfo = numericResults[currentPos.id]
      const lineVal  = currentPos.id === 'wall_overview'  ? r.wallHeight     :
                       currentPos.id === 'wall_thickness' ? r.wallThicknessMm :
                       currentPos.id === 'base_footing'   ? r.footingWidthMm : null
      if (lineInfo && lineVal) {
        setMeasureLineLabel(lineInfo.label); setMeasureLineAxis(lineInfo.axis)
        setMeasureLineValue(`${Math.round(lineVal)}mm`); setShowMeasureLine(true)
      }

      setStage('result')
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // ── Finish scan ───────────────────────────────────────────────────────────────
  function finishScan() {
    const final = { ...resultsRef.current }
    setResults(final); resultsRef.current = final; setReviewVals(final); setShowReview(true)
  }

  function submitReview() {
    try {
      const stored = JSON.parse(sessionStorage.getItem('sc_frames_foundation') || '{}')
      const merged = { ...stored, ...capturedFrames.current }
      sessionStorage.setItem('sc_frames_foundation', JSON.stringify(merged))
    } catch {}
    const complete: FoundationMeasurements = {
      wallType:            reviewVals.wallType            ?? 'unknown',
      wallTypeConfidence:  reviewVals.wallTypeConfidence  ?? 0.5,
      wallTypeLabel:       reviewVals.wallTypeLabel       ?? 'Unknown',
      wallHeight:          reviewVals.wallHeight          ?? null,
      wallThickness:       reviewVals.wallThickness       ?? null,
      footingWidth:        reviewVals.footingWidth        ?? null,
      crackPresent:        reviewVals.crackPresent        ?? false,
      crackType:           reviewVals.crackType           ?? 'none',
      crackWidthMm:        reviewVals.crackWidthMm        ?? null,
      crackLengthMm:       reviewVals.crackLengthMm       ?? null,
      horizontalCrack:     reviewVals.horizontalCrack     ?? false,
      moisturePresent:     reviewVals.moisturePresent     ?? false,
      efflorescence:       reviewVals.efflorescence       ?? false,
      dampproofingVisible: reviewVals.dampproofingVisible ?? null,
      overallCondition:    reviewVals.overallCondition    ?? 'fair',
      confidence:          reviewVals.confidence          ?? 0.75,
      occupancyType:       reviewVals.occupancyType       ?? 'unknown',
    }
    onSuccess(complete)
  }

  // ── Camera error ──────────────────────────────────────────────────────────────
  if (camError) return (
    <div style={{ position: 'fixed', inset: 0, background: NAVY, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <p style={{ color: WHITE, textAlign: 'center' }}>Camera access is required to scan the foundation.</p>
      <button onClick={onBack} style={{ padding: '0.8rem 2rem', background: AMBER, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Back</button>
    </div>
  )

  // ── Intro slideshow ───────────────────────────────────────────────────────────
  if (showIntro) {
    const slide  = INTRO_SLIDES[introSlide]
    const isLast = introSlide === INTRO_SLIDES.length - 1
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', zIndex: 9999, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
        <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.85rem', cursor: 'pointer', padding: '0.25rem 0' }}>← Exit</button>
          <span style={{ fontSize: '0.72rem', color: '#9ca3af', letterSpacing: '0.1em' }}>FOUNDATION SCAN GUIDE</span>
          <button onClick={() => setShowIntro(false)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer' }}>Skip →</button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', gap: '1rem', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{slide.icon}</div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0A1C2E', textAlign: 'center' }}>{slide.title}</div>
          <div style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.65, textAlign: 'center', maxWidth: 340 }}>{slide.desc}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.45rem', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 0.75rem)', paddingTop: '0.5rem', flexShrink: 0 }}>
          {INTRO_SLIDES.map((_, i) => (
            <div key={i} onClick={() => setIntroSlide(i)} style={{ width: i === introSlide ? 22 : 8, height: 8, borderRadius: i === introSlide ? 4 : '50%', background: i === introSlide ? '#0A1C2E' : '#d1d5db', cursor: 'pointer', transition: 'all 0.25s ease' }} />
          ))}
        </div>
        <div style={{ padding: '0 1.25rem', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 1rem)', display: 'flex', gap: '0.6rem', flexShrink: 0 }}>
          {introSlide > 0 && <button onClick={() => setIntroSlide(i => i - 1)} style={{ flex: 1, padding: '0.9rem', background: 'rgba(10,28,46,0.08)', border: 'none', borderRadius: 14, color: '#0A1C2E', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>‹ Back</button>}
          <button onClick={() => { if (isLast) setShowIntro(false); else setIntroSlide(i => i + 1) }}
            style={{ flex: 2, padding: '0.9rem', background: isLast ? 'linear-gradient(135deg,#0A1C2E,#1a3a5c)' : 'linear-gradient(135deg,#27A96B,#1A7A50)', border: 'none', borderRadius: 14, color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' }}>
            {isLast ? 'Start Foundation Scan →' : 'Next →'}
          </button>
        </div>
      </div>
    )
  }

  // ── Review screen ─────────────────────────────────────────────────────────────
  if (showReview) {
    const wallTypeOptions = [
      { value: 'poured_concrete', label: 'Poured Concrete' },
      { value: 'concrete_block',  label: 'Concrete Block (CMU)' },
      { value: 'stone',           label: 'Stone / Rubble' },
      { value: 'brick',           label: 'Brick' },
      { value: 'icf',             label: 'ICF' },
      { value: 'unknown',         label: 'Unknown' },
    ]
    return (
      <div style={{ position: 'fixed', inset: 0, background: NAVY, overflowY: 'auto', padding: 'max(env(safe-area-inset-top,0px),2.5rem) 1.25rem 3rem', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
        <div style={{ maxWidth: 440, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: WHITE }}>Review Foundation Data</div>
            <div style={{ fontSize: '0.72rem', color: WHITE2, marginTop: '0.25rem', lineHeight: 1.5 }}>Tap any field to edit. Tap ↺ to rescan a position.</div>
          </div>

          {/* Wall Type */}
          <div style={{ borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '0.7rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, color: WHITE2, letterSpacing: '0.08em' }}>WALL TYPE</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', padding: '0 0.9rem 0.8rem' }}>
              {wallTypeOptions.map(opt => (
                <button key={opt.value} onClick={() => setReviewVals(p => ({ ...p, wallType: opt.value, wallTypeLabel: opt.label }))}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, background: reviewVals.wallType === opt.value ? `${BLUE}33` : 'rgba(255,255,255,0.07)', color: reviewVals.wallType === opt.value ? BLUE : WHITE2 }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Numeric fields with per-step rescan buttons */}
          {([
            { key: 'wallHeight',    label: 'Exposed Wall Height', unit: 'mm', posIdx: 0, posLabel: 'Wall Overview'   },
            { key: 'wallThickness', label: 'Wall Thickness',      unit: 'mm', posIdx: 2, posLabel: 'Wall Thickness'  },
            { key: 'footingWidth',  label: 'Footing Width',       unit: 'mm', posIdx: 3, posLabel: 'Foundation Base' },
            { key: 'crackWidthMm',  label: 'Crack Width',         unit: 'mm', posIdx: 1, posLabel: 'Crack Detail'    },
          ] as const).map(({ key, label, unit, posIdx: scanIdx, posLabel }) => {
            const val = reviewVals[key as keyof typeof reviewVals] as number | null | undefined
            const isMissing = val == null
            return (
              <div key={key} style={{ borderRadius: 14, border: `1.5px solid ${isMissing ? 'rgba(250,116,31,0.3)' : BORDER}`, background: isMissing ? 'rgba(250,116,31,0.04)' : 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0.65rem 0.9rem', gap: '0.6rem' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: isMissing ? AMBER : GREEN, boxShadow: `0 0 5px ${isMissing ? AMBER : GREEN}`, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: '0.82rem', fontWeight: 700, color: WHITE }}>{label}</div>
                  <button
                    onClick={() => { setShowReview(false); busyRef.current = false; goTo(scanIdx) }}
                    style={{ padding: '0.25rem 0.6rem', background: 'rgba(255,255,255,0.07)', border: `1px solid ${BORDER}`, borderRadius: 8, color: WHITE2, fontSize: '0.65rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    title={`Re-scan ${posLabel}`}
                  >↺ {posLabel}</button>
                </div>
                <div style={{ padding: '0 0.9rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="number" inputMode="numeric"
                    value={val != null ? String(val) : ''}
                    placeholder={isMissing ? 'Not captured' : '—'}
                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setReviewVals(p => ({ ...p, [key]: v })) }}
                    style={{ flex: 1, padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.06)', border: `1px solid ${isMissing ? 'rgba(250,116,31,0.3)' : BORDER}`, borderRadius: 10, color: isMissing ? 'rgba(255,255,255,0.3)' : WHITE, fontWeight: 700, fontSize: '0.95rem' }} />
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>{unit}</span>
                </div>
              </div>
            )
          })}

          {/* Boolean fields */}
          <div style={{ borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'rgba(255,255,255,0.04)', padding: '0.75rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: WHITE2, letterSpacing: '0.08em' }}>CONDITIONS</div>
            {([
              { key: 'crackPresent',     label: 'Cracks present' },
              { key: 'horizontalCrack',  label: 'Horizontal crack (CRITICAL)' },
              { key: 'moisturePresent',  label: 'Moisture / water staining' },
              { key: 'efflorescence',    label: 'Efflorescence (white deposits)' },
            ] as const).map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: key === 'horizontalCrack' ? '#ff9999' : WHITE }}>{label}</span>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {(['Yes', 'No'] as const).map(opt => (
                    <button key={opt} onClick={() => setReviewVals(p => ({ ...p, [key]: opt === 'Yes' }))}
                      style={{ padding: '0.3rem 0.7rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, background: (reviewVals[key] === true && opt === 'Yes') || (reviewVals[key] === false && opt === 'No') ? (opt === 'Yes' ? '#E8454522' : `${GREEN}22`) : 'rgba(255,255,255,0.07)', color: (reviewVals[key] === true && opt === 'Yes') ? '#ff9999' : (reviewVals[key] === false && opt === 'No') ? GREEN : WHITE2 }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Horizontal crack critical warning */}
          {reviewVals.horizontalCrack && (
            <div style={{ background: 'rgba(232,69,69,0.12)', border: '2px solid rgba(232,69,69,0.5)', borderRadius: 12, padding: '0.85rem 1rem', display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ff6b6b', marginBottom: '0.3rem' }}>CRITICAL — HORIZONTAL CRACK DETECTED</div>
                <div style={{ fontSize: '0.72rem', color: WHITE2, lineHeight: 1.6 }}>Horizontal cracks in foundation walls indicate lateral earth pressure potentially exceeding wall capacity. Immediate professional structural assessment is required before this building is occupied.</div>
              </div>
            </div>
          )}

          <button onClick={submitReview} style={{ width: '100%', padding: '1.1rem', background: `linear-gradient(135deg,${AMBER},#C4721E)`, border: 'none', borderRadius: 16, color: '#fff', fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer', boxShadow: '0 4px 24px rgba(242,147,55,0.4)', marginTop: '0.25rem' }}>
            Generate Report →
          </button>
        </div>
      </div>
    )
  }

  // ── Main scan UI ───────────────────────────────────────────────────────────────
  const col = currentPos.color
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <video ref={videoRef} autoPlay playsInline muted
        // @ts-ignore
        webkit-playsinline="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 1 }} />
      <canvas ref={captureRef} style={{ display: 'none' }} />

      {/* Measurement line overlay */}
      <MeasurementLineOverlay
        isActive={showMeasureLine && stage === 'result'}
        measurement={measureLineValue}
        label={measureLineLabel}
        axis={measureLineAxis}
        onComplete={() => setShowMeasureLine(false)}
        sweepDuration={1600}
      />

      {/* ── TOP BAR ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, paddingTop: 'max(env(safe-area-inset-top,0px),1.5rem)', paddingBottom: '0.6rem', paddingLeft: '1rem', paddingRight: '1rem', background: 'linear-gradient(to bottom,rgba(10,28,46,0.95),rgba(10,28,46,0.6))', display: 'flex', alignItems: 'center', gap: '0.75rem', height: IMAGE_TOP, boxSizing: 'border-box' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setShowBackMenu(v => !v)} style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: `1px solid ${BORDER}`, color: WHITE, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          {showBackMenu && (
            <div style={{ position: 'absolute', top: 40, left: 0, background: 'rgba(10,28,46,0.97)', backdropFilter: 'blur(12px)', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '0.4rem', zIndex: 200, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 160, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
              <button onClick={() => { setShowBackMenu(false); if (posIdx > 0) goTo(posIdx - 1) }} style={{ padding: '0.65rem 0.9rem', background: 'transparent', border: 'none', borderRadius: 10, color: WHITE, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>← Go back one step</button>
              <button onClick={() => { setShowBackMenu(false); finishScan() }} style={{ padding: '0.65rem 0.9rem', background: 'transparent', border: 'none', borderRadius: 10, color: GREEN, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>View Report</button>
              <div style={{ height: 1, background: BORDER, margin: '0.15rem 0' }} />
              <button onClick={() => { setShowBackMenu(false); onBack() }} style={{ padding: '0.65rem 0.9rem', background: 'transparent', border: 'none', borderRadius: 10, color: 'rgba(255,100,100,0.85)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>Exit</button>
              <button onClick={() => setShowBackMenu(false)} style={{ padding: '0.5rem 0.9rem', background: 'transparent', border: 'none', borderRadius: 10, color: WHITE2, fontSize: '0.72rem', cursor: 'pointer', textAlign: 'center' }}>Cancel</button>
            </div>
          )}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: WHITE2 }}>STEP {currentPos.step} / {POSITIONS.length}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: WHITE }}>{currentPos.label}</span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: `linear-gradient(90deg,${col},${BLUE})`, borderRadius: 2, transition: 'width 0.4s ease' }} />
          </div>
        </div>
        <button onClick={() => { if (posIdx < POSITIONS.length - 1) goTo(posIdx + 1) }} disabled={posIdx >= POSITIONS.length - 1}
          style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: `1px solid ${BORDER}`, color: WHITE, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>→</button>
        <div style={{ background: 'rgba(65,124,164,0.15)', border: `1px solid rgba(65,124,164,0.4)`, borderRadius: 10, padding: '0.18rem 0.6rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: BLUE, boxShadow: `0 0 4px ${BLUE}` }} />
          <span style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: BLUE, fontWeight: 700 }}>FOUNDATION</span>
        </div>
      </div>

      {/* ── BOTTOM PANEL ── */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, minHeight: BOTTOM_PANEL, zIndex: 50, background: (stage === 'hold' || stage === 'capture') ? 'linear-gradient(to top,rgba(0,0,0,0.85) 60%,transparent)' : 'linear-gradient(to top,rgba(10,28,46,0.99) 80%,rgba(10,28,46,0.6))', paddingBottom: 'max(env(safe-area-inset-bottom,0px),1.25rem)', paddingLeft: '1.25rem', paddingRight: '1.25rem', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', boxSizing: 'border-box' }}>

        {/* POSITION — show illustration + instruction */}
        {stage === 'position' && <>
          <PositionIllustration posId={currentPos.id} />
          <div style={{ background: `${col}11`, borderRadius: 12, padding: '0.75rem 1rem', border: `1px solid ${col}33` }}>
            <div style={{ fontSize: '0.78rem', color: WHITE2, lineHeight: 1.6 }}>{currentPos.detail}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            {currentPos.optional && <button onClick={() => goTo(posIdx + 1)} style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 13, color: WHITE2, fontSize: '0.75rem', cursor: 'pointer' }}>Skip →</button>}
            <button onClick={finishScan} style={{ flex: currentPos.optional ? 1 : 2, padding: '0.75rem', background: 'rgba(250,116,31,0.12)', border: `1px solid rgba(250,116,31,0.3)`, borderRadius: 13, color: AMBER, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>View Report →</button>
          </div>
        </>}

        {/* READY */}
        {stage === 'ready' && <>
          <div style={{ background: `${col}11`, borderRadius: 14, padding: '0.75rem 1rem', border: `1px solid ${col}33` }}>
            <div style={{ fontSize: '0.72rem', color: col, fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.3rem' }}>STEP {currentPos.step} / {POSITIONS.length} — {currentPos.label.toUpperCase()}</div>
            <div style={{ fontSize: '0.78rem', color: WHITE2, lineHeight: 1.55 }}>{currentPos.detail}</div>
          </div>
          <button onClick={handleReady} style={{ width: '100%', padding: '1.15rem', background: `linear-gradient(135deg,${GREEN},#1A7A50)`, border: 'none', borderRadius: 16, color: '#fff', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer', boxShadow: '0 6px 28px rgba(39,169,107,0.5)' }}>{currentPos.readyLabel}</button>
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            {currentPos.optional && <button onClick={() => goTo(posIdx + 1)} style={{ flex: 1, padding: '0.65rem', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 12, color: WHITE2, fontSize: '0.72rem', cursor: 'pointer' }}>Skip →</button>}
            <button onClick={finishScan} style={{ flex: 1, padding: '0.65rem', background: 'rgba(250,116,31,0.12)', border: `1px solid rgba(250,116,31,0.3)`, borderRadius: 12, color: AMBER, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>View Report →</button>
          </div>
        </>}

        {/* HOLD */}
        {stage === 'hold' && <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
              <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4.5" />
                <circle cx="32" cy="32" r="26" fill="none" stroke={GREEN} strokeWidth="4.5"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * (countdown / currentPos.holdSeconds)}`}
                  strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 700, color: WHITE }}>{countdown}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: GREEN, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>HOLD STILL</div>
              <div style={{ fontSize: '0.72rem', color: WHITE2, lineHeight: 1.4 }}>Keep the phone steady for a clear capture</div>
            </div>
          </div>
          <button onClick={finishScan} style={{ width: '100%', padding: '0.72rem', background: `linear-gradient(135deg,${AMBER},#C4721E)`, border: 'none', borderRadius: 13, color: '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>View Report →</button>
        </>}

        {/* CAPTURE */}
        {stage === 'capture' && <>
          <div style={{ fontSize: '0.78rem', color: WHITE2, lineHeight: 1.5 }}>Phone is steady — tap the button to capture.</div>
          <button onClick={camWarm ? handleCapture : undefined} style={{ width: '100%', padding: '1.15rem', background: camWarm ? `linear-gradient(135deg,${col},#2C6FBF)` : 'rgba(255,255,255,0.07)', border: camWarm ? 'none' : `1px solid ${BORDER}`, borderRadius: 16, color: camWarm ? '#fff' : WHITE2, fontSize: '1rem', fontWeight: 700, letterSpacing: '0.06em', cursor: camWarm ? 'pointer' : 'default', boxShadow: camWarm ? `0 6px 28px ${col}80` : 'none', transition: 'all 0.4s ease' }}>
            {camWarm ? currentPos.captureLabel : 'Camera focusing…'}
          </button>
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            <button onClick={() => { busyRef.current = false; setCamWarm(false); setStage('hold'); setCountdown(currentPos.holdSeconds); setTimeout(() => setCamWarm(true), 2000) }} style={{ flex: 1, padding: '0.65rem', background: 'rgba(255,255,255,0.07)', border: `1px solid ${BORDER}`, borderRadius: 12, color: WHITE2, fontSize: '0.72rem', cursor: 'pointer' }}>↺ Re-steady</button>
            <button onClick={finishScan} style={{ flex: 1, padding: '0.65rem', background: 'rgba(250,116,31,0.12)', border: `1px solid rgba(250,116,31,0.3)`, borderRadius: 12, color: AMBER, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>View Report →</button>
          </div>
        </>}

        {/* ANALYSING */}
        {stage === 'analysing' && <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid rgba(74,144,226,0.2)`, borderTopColor: col, animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.88rem', color: WHITE, fontWeight: 700, marginBottom: '0.15rem' }}>Analysing image…</div>
              <div style={{ fontSize: '0.7rem', color: WHITE2 }}>Reading {currentPos.label.toLowerCase()}</div>
            </div>
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </>}

        {/* RESULT */}
        {stage === 'result' && (() => {
          const r = results
          const isOverview  = currentPos.id === 'wall_overview'
          const isCrack     = currentPos.id === 'crack_detail'
          const isThickness = currentPos.id === 'wall_thickness'
          const isFooting   = currentPos.id === 'base_footing'

          return <>
            {/* Result summary card */}
            <div style={{ background: `${col}11`, borderRadius: 14, padding: '0.9rem 1rem', border: `1px solid ${col}33` }}>
              {isOverview && r.wallType && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: col, background: `${col}22`, padding: '0.2rem 0.6rem', borderRadius: 6, border: `1px solid ${col}44` }}>{r.wallTypeLabel ?? r.wallType}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: r.overallCondition === 'critical' ? '#ff6b6b' : r.overallCondition === 'poor' ? AMBER : GREEN, background: r.overallCondition === 'critical' ? 'rgba(232,69,69,0.15)' : r.overallCondition === 'poor' ? 'rgba(250,116,31,0.15)' : 'rgba(39,169,107,0.15)', padding: '0.2rem 0.6rem', borderRadius: 6, border: `1px solid ${r.overallCondition === 'critical' ? 'rgba(232,69,69,0.4)' : r.overallCondition === 'poor' ? 'rgba(250,116,31,0.4)' : 'rgba(39,169,107,0.4)'}`, textTransform: 'uppercase' }}>{r.overallCondition ?? 'assessing'}</span>
                  {r.horizontalCrack && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ff6b6b', background: 'rgba(232,69,69,0.18)', padding: '0.2rem 0.6rem', borderRadius: 6, border: '1px solid rgba(232,69,69,0.5)' }}>HORIZ. CRACK</span>}
                </div>
              )}
              {isOverview && r.wallHeight && <div style={{ fontSize: '1.8rem', fontWeight: 700, color: WHITE, marginBottom: '0.2rem' }}>{r.wallHeight}<span style={{ fontSize: '0.9rem', color: WHITE2 }}>mm</span> <span style={{ fontSize: '0.7rem', color: WHITE2, fontWeight: 400 }}>wall height</span></div>}
              {isCrack  && r.crackWidthMm != null && <div style={{ fontSize: '1.8rem', fontWeight: 700, color: r.crackType === 'horizontal' ? '#ff6b6b' : AMBER }}>{r.crackWidthMm}<span style={{ fontSize: '0.9rem', color: WHITE2 }}>mm</span> <span style={{ fontSize: '0.7rem', color: WHITE2, fontWeight: 400 }}>crack width · {r.crackType ?? 'crack'}</span></div>}
              {isThickness && r.wallThickness != null && <div style={{ fontSize: '1.8rem', fontWeight: 700, color: WHITE }}>{r.wallThickness}<span style={{ fontSize: '0.9rem', color: WHITE2 }}>mm</span> <span style={{ fontSize: '0.7rem', color: WHITE2, fontWeight: 400 }}>wall thickness</span></div>}
              {isFooting  && r.footingWidth  != null && <div style={{ fontSize: '1.8rem', fontWeight: 700, color: WHITE }}>{r.footingWidth}<span style={{ fontSize: '0.9rem', color: WHITE2 }}>mm</span> <span style={{ fontSize: '0.7rem', color: WHITE2, fontWeight: 400 }}>footing width</span></div>}
              {aiMessage && <div style={{ fontSize: '0.72rem', color: WHITE2, lineHeight: 1.5, marginTop: '0.35rem' }}>{aiMessage}</div>}
            </div>

            {/* Critical warning */}
            {r.horizontalCrack && (
              <div style={{ background: 'rgba(232,69,69,0.15)', border: '2px solid rgba(232,69,69,0.55)', borderRadius: 10, padding: '0.7rem 0.9rem', fontSize: '0.72rem', color: '#ff9999', lineHeight: 1.55 }}>
                <strong style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.75rem' }}>CRITICAL — HORIZONTAL CRACK</strong>
                Lateral earth pressure may exceed wall capacity. Immediate structural assessment required.
              </div>
            )}

            <button onClick={() => goTo(posIdx + 1)} style={{ width: '100%', padding: '0.85rem', background: `linear-gradient(135deg,${GREEN},#1A7A50)`, border: 'none', borderRadius: 14, color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', boxShadow: '0 4px 18px rgba(39,169,107,0.45)' }}>Confirm & Next →</button>
            <div style={{ display: 'flex', gap: '0.45rem' }}>
              <button onClick={() => { busyRef.current = false; setCamWarm(false); setStage('hold'); setCountdown(currentPos.holdSeconds); setTimeout(() => setCamWarm(true), 2000) }} style={{ flex: 1, padding: '0.65rem', background: 'rgba(255,255,255,0.07)', border: `1px solid ${BORDER}`, borderRadius: 12, color: WHITE2, fontSize: '0.72rem', cursor: 'pointer' }}>↺ Retry</button>
              <button onClick={finishScan} style={{ flex: 1, padding: '0.65rem', background: 'rgba(250,116,31,0.12)', border: `1px solid rgba(250,116,31,0.3)`, borderRadius: 12, color: AMBER, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>View Report →</button>
            </div>
          </>
        })()}

      </div>
    </div>
  )
}
