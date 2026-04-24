'use client'
/**
 * ScanReadyScreen.tsx — ARAI_13  "Tap-to-Confirm Flow"
 *
 * EVERY transition requires an explicit user tap. No auto-advances.
 *
 * Stage flow per position:
 *   position  → countdown ticks (7-10s), illustration shown over camera
 *               When countdown hits 0: show "I'm Ready" tap prompt
 *   ready     → user taps big "I'm Ready" button → hold
 *   hold      → camera live, hold-still countdown (3-4s)
 *               When countdown hits 0: show "Tap to Capture" prompt
 *   capture   → user taps → analysing
 *   analysing → AI reads frame → result
 *   result    → AI message + locked values shown
 *               User taps "Next Position" (or Retry / View Report)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import MeasurementLineOverlay from './MeasurementLineOverlay'
import AngleGuidanceOverlay from './AngleGuidanceOverlay'
import { applyPerspectiveCorrection, getDeviceOrientation } from '@/lib/pose-validator'
import { checkXRSupport } from '@/lib/xr-measure'
import {
  startARSession, stopARSession, measureFromPlanes,
  isARSessionActive, type ScreenPlane,
} from '@/lib/arcore-session'
import type { UserRole } from './AuthScreen'
import { Analytics } from '@/lib/analytics'

// ── Palette ───────────────────────────────────────────────────────────────────
const NAVY   = '#0A1C2E'
const GREEN  = '#27A96B'
const AMBER  = '#FA741F'
const WHITE  = '#E8F4FF'
const WHITE2 = '#93BAD4'
const BLUE   = '#4A90E2'
const BORDER = 'rgba(147,186,212,0.15)'

// ── Measurement indicator labels ──────────────────────────────────────────────
const indicators: Record<string, { label: string; color: string }> = {
  overview:    { label: 'Step count + headroom', color: BLUE   },
  riser_front: { label: 'Riser height',          color: GREEN  },
  rotate_90:   { label: 'Nosing overhang',       color: AMBER  },
  nosing:      { label: 'Nosing close-up',       color: AMBER  },
  handrail:    { label: 'Handrail height',       color: '#A78BFA' },
  alt_angle:   { label: 'Stair width',           color: BLUE   },
  tread_top:   { label: 'Tread depth',           color: GREEN  },
}

// ── Position definitions ──────────────────────────────────────────────────────
type Position = 'overview'|'riser_front'|'handrail'|'alt_angle'|'tread_top'

interface Slide {
  image:   string
  caption: string
  seconds: number   // how long to show this slide (default 5)
}

interface PosConfig {
  id:           Position
  step:         number
  label:        string
  headline:     string
  detail:       string
  readyLabel:   string
  holdSeconds:  number
  captureLabel: string
  positionTime: number
  captures:     string[]
  optional:     boolean
  aiPrompt:     (prior: Record<string, number|string>) => string
}


// ── Pre-scan instruction slides ──────────────────────────────────────────────
// Shown ONCE before the scan sequence begins. Fully dismounted after user starts.
const INTRO_SLIDES = [
  {
    img:     '/Instr_01_overview.png',
    title:   'Step 1 — Full Stair View',
    desc:    'Stand back so the entire staircase fits in frame. Hold the phone level at chest height.',
  },
  {
    img:     '/Instr_02_headroom.png',
    title:   'Step 1b — Headroom Check',
    desc:    'If there is a ceiling or soffit above the stair, step back to include it. This checks clearance compliance.',
  },
  {
    img:     '/Instr_03_riser.png',
    title:   'Step 2 — Riser Height',
    desc:    'Place the phone upright on the tread nosing with the camera pointing directly at the riser face.',
  },
  {
    img:     '/Instr_04_handrail.png',
    title:   'Step 3 — Handrail Height',
    desc:    'Stand beside the stair. Frame both the tread surface and the top of the handrail in the same shot.',
  },
  {
    img:     '/Instr_05_tread_side.png',
    title:   'Step 4 — Tread Depth (side view)',
    desc:    'Hold the phone level beside the stair so the full tread depth is visible from nosing to riser.',
  },
  {
    img:     '/Instr_06_tread_top.png',
    title:   'Step 4b — Tread Depth (top view)',
    desc:    'Place the phone flat above the tread with the camera facing straight down. This gives the most accurate depth reading.',
  },
  {
    img:     '/Instr_07_riser_steady.png',
    title:   'Tip — Steady Your Phone',
    desc:    'Rest the phone against the riser or on the tread for a sharp, stable image. Motion blur reduces accuracy.',
  },
  {
    img:     '/Instr_08_width.png',
    title:   'Step 5 — Stair Width',
    desc:    'Step back until both left and right edges of the staircase are visible. The AI measures wall to wall.',
  },
  {
    img:     '/Instr_09_nosing.png',
    title:   'Nosing — Auto Detected',
    desc:    'Nosing is detected automatically during the riser scan. No extra step needed.',
  },
  {
    img:     '/Instr_10_card.jpg',
    title:   'Optional — Improve Accuracy',
    desc:    'Place any flat card (credit card, ID, transit card, loyalty card) on the tread before scanning. A standard card is 85.6 × 54mm — a known size the AI uses as a scale reference. This can improve accuracy from ±30mm to ±10–15mm. Any card works. No card? The scan still works — it just uses other visual cues.',
  },
]

const POSITIONS: PosConfig[] = [
  {
    id: 'overview', step: 1, label: 'Full Stair View',
    headline: 'Step back — fit the full staircase in frame',
    detail: 'Stand 2–3 metres from the stair. Hold the phone level at chest height. Make sure the full flight — top to bottom — is visible.',
    readyLabel: "I'm in position — Start",
    captureLabel: 'Tap to capture step count & headroom',
    holdSeconds: 3, positionTime: 4, optional: false,
    captures: ['riserCount','headroom'],
    aiPrompt: (_p) => `Analyse this staircase image for a building compliance inspection.

STEP 1 — SCALE CALIBRATION (critical — do this first):
Scan the entire scene for any of these known-dimension objects and use the BEST one found:
• Standard brick course: 75mm (brick 65mm + 10mm mortar joint)
• Door frame width: typically 838mm (2'9") or 914mm (3'0")
• Door frame height: typically 2032mm (6'8") or 2040mm
• Electrical outlet/switch plate: 86×86mm (North America standard)
• Standard timber stud: 38×89mm (2×4 nominal)
• Skirting/baseboard: typically 90–120mm tall
• Human adult standing height for scale: 1700–1800mm
• Handrail tube diameter: 38–50mm typical
• If none found, use stair riser stack: assume residential risers ~175mm each

STEP 2 — MEASUREMENTS:
1. Count visible steps/risers precisely
2. Headroom: "clear" (open above) or number in mm (ceiling/soffit visible)

STEP 3 — OCCUPANCY CLASSIFICATION (important for code selection):
Examine all visible visual cues to determine the most likely occupancy type.
This is NOT just about stair width — look at the entire scene context:

Visual cues suggesting RESIDENTIAL (Part 9 / IRC):
• Carpet, wood, or laminate treads; painted risers; domestic trim and baseboards
• Single-family interior finish; closet doors, residential light switches, house paint
• Narrow stair (≤900mm), wood construction, domestic handrail profile

Visual cues suggesting MULTI-UNIT RESIDENTIAL (Part 3 / IBC Group R):
• Fire exit signage, painted concrete or tile, common corridor, suite numbers on doors
• Corridor-width stairs (900–1500mm), painted steel handrails, fire-rated doors
• Apartment-style finish with carpet tiles or vinyl

Visual cues suggesting COMMERCIAL / RETAIL (Part 3 / IBC Group A or M):
• Terrazzo, polished concrete, or stone treads; commercial lighting; storefront signage
• Wide stairs (>1200mm), nosing edge strips (aluminium or contrasting), open atrium
• Retail fixtures, signage, display cases visible

Visual cues suggesting INDUSTRIAL / INSTITUTIONAL (Part 3 / IBC Group B, F, or I):
• Open-riser metal grating, steel checker-plate treads, factory or warehouse finishes
• Safety yellow paint on nosings, industrial handrail pipe, concrete masonry walls
• Exposed mechanical/electrical in background

Visual cues suggesting MIXED-USE (Part 3 with residential component):
• Ground floor commercial finish transitioning to residential above
• Lobby-style entrance with mail slots or intercoms

Set occupancyType to one of: "residential_single", "residential_multi", "commercial", "industrial", "mixed_use", "unknown"
Set occupancyConfidence to 0.0–1.0 (your certainty)
Set applicableCodePart to: "Part 9" (residential ≤3 storeys) or "Part 3" (all others)

STEP 4 — GUARDRAIL REQUIREMENT NOTE:
Under Part 9 (OBC/NBC), guardrails are required where a stair has more than 2 risers OR total rise exceeds 600mm.
Under Part 3, guardrails are required where total rise exceeds 600mm.
Indicate whether a guardrail is likely required based on step count.

Reply ONLY with valid JSON:
{
  "stepCount": number|null,
  "headroom": "clear"|number,
  "isResidential": true|false|null,
  "occupancyType": "residential_single"|"residential_multi"|"commercial"|"industrial"|"mixed_use"|"unknown",
  "occupancyConfidence": number,
  "applicableCodePart": "Part 9"|"Part 3",
  "guardrailLikelyRequired": true|false|null,
  "scaleRef": "what you used for scale",
  "confident": true|false,
  "message": "one sentence for the user"
}`,
  },
  {
    id: 'riser_front', step: 2, label: 'Riser Height',
    headline: 'Place phone on the nosing, camera facing the riser',
    detail: 'Set the phone upright on the tread nosing with the camera pointing directly at the vertical riser face. Centre the riser in frame.',
    readyLabel: 'Phone is placed — Start measuring',
    captureLabel: 'Tap to measure riser height',
    holdSeconds: 3, positionTime: 4, optional: false,
    captures: ['rise'],
    aiPrompt: (_p) => `Measure RISER HEIGHT and CHECK FOR DIMENSIONAL INCONSISTENCY. Phone is upright on the tread nosing, camera facing the riser face.

═══════════════════════════════════════════════════════
STEP 0 — TAPE MEASURE DETECTION (highest priority)
═══════════════════════════════════════════════════════
Before anything else: is a tape measure or ruler visible in the image?
- If YES: READ THE MARKINGS DIRECTLY. Do not estimate — read the actual numbers on the tape.
  The riser height = the distance from tread nosing (0 point) to the top of the riser.
  If the tape is showing ~190mm, report 190mm. Trust the tape above all other methods.
  State: "Tape measure read directly: Xmm"
- If NO: proceed to Step 1.

═══════════════════════════════════════════════════════
STEP 1 — PERSPECTIVE CORRECTION (critical)
═══════════════════════════════════════════════════════
DIAGNOSE THE CAMERA ANGLE before measuring:

A) FRONTAL VIEW (ideal): Camera is level, facing the riser face straight-on.
   The tread surface is NOT visible. The riser face fills the frame vertically.
   → No correction needed. Measure directly.

B) TOP-DOWN TILT (most common error source): Camera is angled downward.
   Signs: You can see the TOP SURFACE of the tread(s). The riser face appears
   foreshortened (shorter than it really is) due to perspective compression.
   → APPLY TILT CORRECTION: estimate tilt angle θ from how much tread is visible.
     If ~10% of tread depth is visible → θ ≈ 10° → multiply pixel height by 1/cos(10°) = 1.015
     If ~25% of tread visible → θ ≈ 20° → multiply by 1/cos(20°) = 1.064
     If ~50% of tread visible → θ ≈ 35° → multiply by 1/cos(35°) = 1.221
     If tread fills ~same as riser → θ ≈ 45° → multiply by 1/cos(45°) = 1.414
   In the screenshot example: tape shows ~190mm but naive pixel measurement gives ~178mm
   — that 12mm gap is exactly a ~10-15° downward tilt. Always correct upward when tread is visible.

C) LATERAL TILT: Phone is rotated slightly sideways.
   Signs: Vertical lines in scene are not perfectly vertical.
   → Apply similar cosine correction to the axis of tilt.

STATE WHICH CASE APPLIES and what correction factor you used.

═══════════════════════════════════════════════════════
STEP 2 — SCALE CALIBRATION (if tape not present)
═══════════════════════════════════════════════════════
Scan the scene for reference objects in this priority order:
1. Credit/debit card (85.6 × 54mm ISO standard) — if visible, use as primary reference
2. Phone body edges at frame border: smartphone width 68–80mm (typical 72mm)
3. Skirting/baseboard beside stair: typically 90–120mm tall
4. Tread nosing depth: typically 25–38mm overhang
5. Standard timber stringer: typically 235–286mm deep
6. Flooring planks: standard 90mm or 120mm wide
7. Electrical outlet plate: 86×86mm
8. Default: use typical residential riser (175mm) as last resort

USE THE BEST REFERENCE FOUND. State which one and the correction factor applied.

═══════════════════════════════════════════════════════
TASK A — PRIMARY RISER HEIGHT (after correction)
═══════════════════════════════════════════════════════
Report the CORRECTED vertical distance from tread nosing top to the tread above.
If you applied perspective correction, show your work:
  raw_px_height → scale_factor → corrected_mm → tilt_correction → final_mm

═══════════════════════════════════════════════════════
TASK B — INCONSISTENCY CHECK
═══════════════════════════════════════════════════════
Building codes (OBC, NBC, IBC) require no two adjacent risers vary by more than 9.5mm (3/8 inch).
If multiple risers visible: measure each, calculate max variation, flag if >9.5mm.
If only one riser visible: set inconsistencyFlag to null.

═══════════════════════════════════════════════════════
TASK C — NOSING DETECTION
═══════════════════════════════════════════════════════
Is there a nosing overhang? Estimate horizontal projection in mm if visible.

Reply ONLY with valid JSON:
{
  "estimatedMm": number,
  "rawEstimateMm": number,
  "tiltCorrected": true|false,
  "tiltAngleDeg": number|null,
  "tiltCorrectionFactor": number|null,
  "tapeMeasureRead": true|false,
  "confidence": 0.0-1.0,
  "scaleRef": "what was used — tape/card/phone/baseboard/etc",
  "hasNosing": true|false,
  "nosingMm": number|null,
  "riserHeights": [number, ...] | null,
  "maxVariationMm": number|null,
  "inconsistencyFlag": true|false|null,
  "message": "one sentence — mention if tape read directly or tilt correction applied"
}

Rules:
- estimatedMm: the FINAL corrected value. Range 125–220mm. Default 175mm if uncertain.
- rawEstimateMm: the uncorrected pixel-based estimate before tilt correction.
- tiltCorrected: true if you applied cosine correction for camera angle.
- tapeMeasureRead: true if you could read actual markings from a tape in the image.
- message: e.g. "Tape measure read directly: 190mm" or "178mm raw corrected to 191mm for 15° downward tilt"`,
  },

  {
    id: 'handrail', step: 3, label: 'Handrail Height',
    headline: 'Frame the handrail — tread to top of rail',
    detail: 'Stand beside the stair. Hold the phone so both the tread surface at the bottom and the very top of the handrail are in frame at the same time.',
    readyLabel: 'Handrail is framed — Start measuring',
    captureLabel: 'Tap to measure handrail height',
    holdSeconds: 3, positionTime: 4, optional: false,
    captures: ['guard'],
    aiPrompt: (_p) => `Measure HANDRAIL / GUARDRAIL HEIGHT — or confirm if none is present.

FIRST: Is there a handrail or guardrail visible in this image?
- If YES: measure vertical height from tread nosing to the top of the gripping surface.
- If NO handrail or guardrail exists: set noGuardrail: true and estimatedMm: null.
  Do NOT invent a measurement. Absence of a guardrail is a separate compliance issue
  that depends on stair height and occupancy — do not default to any number.

SCALE CALIBRATION (if measuring):
1. Handrail tube/profile diameter: round tube 38–50mm, square profile 40–50mm
2. Wall tiles or brick: standard brick 65mm + 10mm mortar = 75mm per course
3. Baluster/spindle spacing: typically 100mm clear gap (code maximum)
4. Baluster diameter: 32–44mm round or 25–38mm square
5. Skirting board at stair base: 90–120mm tall
6. Door or window in background: door height ~2032mm, width ~838mm
7. Wall switch/outlet plate: 86×86mm if visible

Also measure HORIZONTAL OFFSET if handrail present: distance from stringer/wall to handrail centreline.

Reply ONLY with valid JSON:
{"estimatedMm":number|null,"noGuardrail":true|false,"offsetMm":number|null,"confidence":0.0-1.0,"scaleRef":"object used","message":"one sentence"}

If no guardrail: {"estimatedMm":null,"noGuardrail":true,"offsetMm":null,"confidence":1.0,"scaleRef":"direct observation","message":"No handrail or guardrail visible in this image."}
If present: estimatedMm range 865–1070mm.`,
  },
  {
    id: 'alt_angle', step: 4, label: 'Stair Width',
    headline: 'Step back — both edges of the stair in frame',
    detail: 'Move until both the left and right edges of the staircase are clearly visible. A measurement line will appear across the full width.',
    readyLabel: 'Both edges visible — Start measuring',
    captureLabel: 'Tap to measure stair width',
    holdSeconds: 3, positionTime: 4, optional: true,
    captures: ['width'],
    aiPrompt: (p) => `Measure STAIR WIDTH — clear horizontal distance between both stringers, walls, or balustrades.
Both left AND right edges of the stair must be visible in frame.

SCALE CALIBRATION — use all visible references, combine for best estimate:
1. Riser height from prior scan: ${p.rise ?? 175}mm — count how many riser heights fit across the width
2. Handrail tube diameter: 38–50mm — if rail visible at left and right, centres-to-centres minus one diameter
3. Standard door width in background: 838mm (2'9") or 914mm (3'0") if any door is visible
4. Wall tiles: standard tiles 300mm or 600mm wide — count horizontal tiles across
5. Floor planks: typically 70–90mm wide — count planks visible at base of stair
6. Human figure if present: adult shoulder width ~450mm, total height ~1750mm
7. Brick courses on adjacent wall: 75mm per course (65mm brick + 10mm mortar)
8. Baluster spacing: 100mm clear gap (code max) — count balusters × 100mm + diameter

Measure the clear width at the narrowest point (usually top or bottom landing).

Reply ONLY with valid JSON — ALWAYS provide estimatedMm:
{"estimatedMm":number,"confidence":0.0-1.0,"scaleRef":"objects used","message":"one sentence"}

Range: 700–1500mm. Default 900mm if uncertain.`,
  },
  {
    id: 'tread_top', step: 5, label: 'Tread Depth',

    headline: 'Place phone flat on the tread — camera facing down',
    detail: 'Lay the phone face-down on the tread nosing. The camera fires a depth ray straight to the lower tread, measuring the exact riser height. Keep the phone still until you tap Capture.',
    readyLabel: 'Phone is flat on the tread — Start',
    captureLabel: 'Tap to measure tread depth',
    holdSeconds: 3, positionTime: 9, optional: false,
    captures: ['run'],
    aiPrompt: (p) => `Phone is face-down above a stair tread, camera pointing straight down at the tread surface.

Measure TREAD DEPTH — horizontal distance from front nosing edge to the back riser face.

SCALE CALIBRATION — look for ALL of these simultaneously in the top-down view:
1. Phone body edges at frame border: phone width 68–80mm (typically 72mm) — MOST RELIABLE for this position
2. Wood grain / floorboard planks: typically 70–90mm wide — count planks across the tread
3. Tile joints if tiled: standard tiles 300×300mm or 600×600mm — measure fraction visible
4. Carpet pile direction change at nosing — the nosing overhang is typically 25–38mm
5. Riser height (${p.rise ?? 175}mm) visible at back of tread if riser face is in frame
6. Screw or fixing holes in tread: typically 50–75mm from edge — can set minimum scale
7. Grout lines in tile: standard joint 2–5mm

USE MULTIPLE references and average/cross-check them. The phone body width is especially
reliable when the phone edges are visible at the sides of the frame.

Measure from front nosing lip to where the tread meets the back riser.

Reply ONLY with valid JSON — ALWAYS provide estimatedMm:
{"estimatedMm":number,"confidence":0.0-1.0,"scaleRef":"objects used","message":"one sentence"}

Range: 220–420mm. Default 280mm if uncertain.`,
  },
]

// ── AR Measurement Overlay ───────────────────────────────────────────────────
// Renders per-position measurement lines, endpoint markers, normal vectors,
// and animated tick marks directly over the live camera feed.
//
// Geometry per position:
//   riser_front  — vertical line centre-screen, normal vector pointing toward camera (Z-)
//   rotate_90    — horizontal line at tread edge, normal pointing up (Y+)
//   nosing       — short horizontal span at nose edge, normal pointing forward (Z-)
//   handrail     — vertical line right-side, normal pointing inward (X-)
//   alt_angle    — full-width horizontal line, normals on both endpoints pointing inward
//   tread_top    — depth line front-to-back, normal pointing up (Y+)
//   overview     — diagonal span across full stair, normal pointing toward camera

interface AROverlayProps {
  posId:   string
  color:   string
  valueMm: number
  label:   string
}

function ARMeasurementOverlay({ posId, color, valueMm, label }: AROverlayProps) {
  // All coordinates are percentages of the overlay container (0–100)
  // The overlay sits between top bar and bottom panel — portrait phone viewport

  type Config = {
    x1: number; y1: number   // line start (percent)
    x2: number; y2: number   // line end   (percent)
    // Normal vector: shown at midpoint, perpendicular to the measured plane
    // direction in SVG space: dx/dy unit vector, length in px
    nx: number; ny: number; nLen: number
    // Tick orientation: 'h' = horizontal ticks at endpoints, 'v' = vertical
    ticks: 'h' | 'v'
    // Extra annotation lines (e.g. parallel guide lines for riser face)
    guides?: Array<{x1:number;y1:number;x2:number;y2:number}>
  }

  const configs: Record<string, Config> = {
    riser_front: {
      x1:50, y1:20,  x2:50, y2:75,   // vertical centre
      nx:1,  ny:0,   nLen:40,         // normal points right (toward viewer)
      ticks:'h',
      guides:[
        {x1:20,y1:20,x2:80,y2:20},   // top edge of riser
        {x1:20,y1:75,x2:80,y2:75},   // bottom edge of riser
      ],
    },

    handrail: {
      x1:68, y1:18,  x2:68, y2:72,
      nx:-1, ny:0,   nLen:38,         // normal points left (toward stair)
      ticks:'h',
      guides:[
        {x1:50,y1:18,x2:85,y2:18},
        {x1:50,y1:72,x2:85,y2:72},
      ],
    },
    alt_angle: {
      x1:6,  y1:58,  x2:94, y2:58,
      nx:0,  ny:-1,  nLen:32,
      ticks:'v',
      guides:[
        {x1:6, y1:50,x2:6,  y2:66},  // left stringer
        {x1:94,y1:50,x2:94, y2:66},  // right stringer
      ],
    },
    tread_top: {
      x1:50, y1:28,  x2:50, y2:68,
      nx:1,  ny:0,   nLen:36,
      ticks:'h',
      guides:[
        {x1:20,y1:28,x2:80,y2:28},   // nosing line
        {x1:20,y1:68,x2:80,y2:68},   // back riser line
      ],
    },
    overview: {
      x1:18, y1:22,  x2:82, y2:72,
      nx:-1, ny:0.4, nLen:30,         // angled normal
      ticks:'v',
      guides:[],
    },
  }

  const cfg = configs[posId] ?? configs.riser_front
  const mid = { x: (cfg.x1+cfg.x2)/2, y: (cfg.y1+cfg.y2)/2 }

  // Normal vector tip (mid + normal direction * length, in %)
  // nLen is in px but we approximate as %, good enough for display
  const nTip = { x: mid.x + cfg.nx * cfg.nLen * 0.12, y: mid.y + cfg.ny * cfg.nLen * 0.12 }

  const tickSize = 6  // half-tick length in percent-ish (small)

  const hexAlpha = (a: number) => {
    const h = Math.round(a*255).toString(16).padStart(2,'0')
    return color + h
  }

  return (
    <svg
      width="100%" height="100%"
      style={{position:'absolute',inset:0,overflow:'visible'}}
    >
      <defs>
        {/* Glowing filter for measurement line */}
        <filter id={`glow-${posId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>

        {/* Animated line draw */}
        <style>{`
          @keyframes drawLine {
            from { stroke-dashoffset: 200; }
            to   { stroke-dashoffset: 0; }
          }
          @keyframes fadeInSVG {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes pulseRing {
            0%   { r: 3; opacity: 0.9; }
            50%  { r: 6; opacity: 0.3; }
            100% { r: 3; opacity: 0.9; }
          }
          @keyframes normalGrow {
            from { stroke-dashoffset: 60; opacity: 0; }
            to   { stroke-dashoffset: 0;  opacity: 1; }
          }
          .ar-line {
            stroke-dasharray: 200;
            stroke-dashoffset: 200;
            animation: drawLine 0.6s ease-out 0.1s forwards;
          }
          .ar-guide {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            animation: drawLine 0.5s ease-out 0.4s forwards;
            opacity: 0;
          }
          .ar-guide { animation: drawLine 0.5s ease-out 0.4s forwards, fadeInSVG 0.5s ease-out 0.4s forwards; }
          .ar-normal {
            stroke-dasharray: 60;
            stroke-dashoffset: 60;
            animation: normalGrow 0.5s ease-out 0.7s forwards;
          }
          .ar-label { animation: fadeInSVG 0.4s ease-out 0.65s both; }
          .ar-pulse  { animation: pulseRing 1.5s ease-in-out infinite; }
        `}</style>

        {/* Arrowhead marker for normal vector */}
        <marker id={`arrow-${posId}`} markerWidth="6" markerHeight="6"
          refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={color} opacity="0.95"/>
        </marker>

        {/* Tick marker */}
        <marker id={`tick-${posId}`} markerWidth="4" markerHeight="8"
          refX="2" refY="4" orient="auto-start-reverse">
          <line x1="2" y1="0" x2="2" y2="8" stroke={color} strokeWidth="1.5"/>
        </marker>
      </defs>

      {/* ── Guide lines (faint parallel lines showing the measured face) ── */}
      {cfg.guides.map((g, i) => (
        <line key={i}
          className="ar-guide"
          x1={`${g.x1}%`} y1={`${g.y1}%`}
          x2={`${g.x2}%`} y2={`${g.y2}%`}
          stroke={color} strokeWidth="0.4" strokeDasharray="2,2" opacity="0.45"
        />
      ))}

      {/* ── Main measurement line ── */}
      <line
        className="ar-line"
        x1={`${cfg.x1}%`} y1={`${cfg.y1}%`}
        x2={`${cfg.x2}%`} y2={`${cfg.y2}%`}
        stroke={color} strokeWidth="0.7" strokeLinecap="round"
        filter={`url(#glow-${posId})`}
        opacity="0.95"
      />

      {/* ── Tick marks at both endpoints ── */}
      {cfg.ticks === 'h' ? (
        <>
          <line x1={`${cfg.x1-tickSize*0.5}%`} y1={`${cfg.y1}%`}
                x2={`${cfg.x1+tickSize*0.5}%`} y2={`${cfg.y1}%`}
                stroke={color} strokeWidth="0.7" className="ar-label"/>
          <line x1={`${cfg.x2-tickSize*0.5}%`} y1={`${cfg.y2}%`}
                x2={`${cfg.x2+tickSize*0.5}%`} y2={`${cfg.y2}%`}
                stroke={color} strokeWidth="0.7" className="ar-label"/>
        </>
      ) : (
        <>
          <line x1={`${cfg.x1}%`} y1={`${cfg.y1-tickSize*0.5}%`}
                x2={`${cfg.x1}%`} y2={`${cfg.y1+tickSize*0.5}%`}
                stroke={color} strokeWidth="0.7" className="ar-label"/>
          <line x1={`${cfg.x2}%`} y1={`${cfg.y2-tickSize*0.5}%`}
                x2={`${cfg.x2}%`} y2={`${cfg.y2+tickSize*0.5}%`}
                stroke={color} strokeWidth="0.7" className="ar-label"/>
        </>
      )}

      {/* ── Endpoint dot + pulse ring ── */}
      {[{x:cfg.x1,y:cfg.y1},{x:cfg.x2,y:cfg.y2}].map((pt,i)=>(
        <g key={i} className="ar-label">
          {/* Pulse ring */}
          <circle cx={`${pt.x}%`} cy={`${pt.y}%`} r="2.5%"
            fill="none" stroke={color} strokeWidth="0.4" opacity="0.4"
            className="ar-pulse"
            style={{animationDelay: i===1 ? '0.75s' : '0s'}}
          />
          {/* Solid dot */}
          <circle cx={`${pt.x}%`} cy={`${pt.y}%`} r="1.2%"
            fill={color} opacity="0.95" filter={`url(#glow-${posId})`}
          />
        </g>
      ))}

      {/* ── Normal vector ── perpendicular arrow from plane midpoint ── */}
      {/* Shows which face is being measured (oriented outward from surface) */}
      <line
        className="ar-normal"
        x1={`${mid.x}%`} y1={`${mid.y}%`}
        x2={`${nTip.x}%`} y2={`${nTip.y}%`}
        stroke={color} strokeWidth="0.5" opacity="0.85"
        strokeDasharray="3,1.5"
        markerEnd={`url(#arrow-${posId})`}
      />
      {/* Normal label */}
      <text
        className="ar-normal"
        x={`${nTip.x + cfg.nx*2}%`} y={`${nTip.y + cfg.ny*2 + 1.5}%`}
        textAnchor="middle" fill={color} fontSize="12" opacity="0.8"
        fontFamily="monospace"
      >n̂</text>

      {/* ── Dimension label ── centred on line ── */}
      <g className="ar-label">
        {/* Background pill — inline rect avoids calc() which is invalid SVG */}
        <rect
          x={`${mid.x - 8}%`} y={`${mid.y - 3}%`}
          width="16%" height="6%"
          rx="3"
          fill="rgba(10,28,46,0.92)"
          stroke={color} strokeWidth="0.5"
        />
        <text
          x={`${mid.x}%`} y={`${mid.y + 1.8}%`}
          textAnchor="middle"
          fill="white" fontSize="14" fontFamily="monospace" fontWeight="bold"
        >{valueMm}mm</text>
      </g>

      {/* ── Measurement type label ── top of overlay ── */}
      <g className="ar-label">
        <rect x="1.5%" y="2.5%" width="45%" height="7%"
          rx="3" fill="rgba(10,28,46,0.88)" stroke={hexAlpha(0.5)} strokeWidth="0.5"/>
        <circle cx="4%" cy="6%" r="1.2%" fill={color}/>
        <text x="7%" y="7.5%" fill={color} fontSize="12" fontFamily="monospace" fontWeight="bold">{label}</text>
      </g>
    </svg>
  )
}

// ── Vision helper ─────────────────────────────────────────────────────────────
async function callVision(b64: string, prompt: string, ms = 18000): Promise<string|null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch('/api/vision', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({imageB64:b64, prompt}), signal:ctrl.signal,
    })
    clearTimeout(t)
    if (!r.ok) return null
    const d = await r.json()
    return d.text ?? null
  } catch { clearTimeout(t); return null }
}

function parseJSON(s: string|null): any {
  if (!s) return null
  try {
    const m = s.replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/)
    return m ? JSON.parse(m[0]) : null
  } catch { return null }
}

interface Props {
  userRole?: UserRole
  onSuccess: (m: Record<string,number|string>) => void
  onBack: () => void
}

// Stage: what is happening right now
// position  = illustration shown, countdown ticking
// ready     = countdown done, waiting for user tap to confirm ready
// hold      = camera live, hold-still countdown
// capture   = hold countdown done, waiting for user tap to capture
// analysing = AI call in flight
// result    = AI result shown, waiting for user action
// paused    = everything frozen
type Stage = 'position'|'ready'|'hold'|'capture'|'analysing'|'result'

export default function ScanReadyScreen({ userRole='diy', onSuccess, onBack }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const captureRef = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream|null>(null)
  const busyRef    = useRef(false)
  const timerRef   = useRef<ReturnType<typeof setTimeout>|null>(null)
  const rescanReturnRef   = useRef(false)   // when true, result 'Next' returns to review
  const pendingRescanRef  = useRef(-1)         // position index to jump to after review closes

  const [posIdx,     setPosIdx]     = useState(0)
  const [stage,      setStage]      = useState<Stage>('position')
  const [countdown,  setCountdown]  = useState(0)
  const [camReady,   setCamReady]   = useState(false)
  const [camError,   setCamError]   = useState(false)
  const [aiMessage,  setAiMessage]  = useState<string|null>(null)
  const [results,    setResults]    = useState<Record<string,number|string>>({})
  const resultsRef   = useRef<Record<string,number|string>>({})   // closure-safe mirror
  const [reviewVals, setReviewVals] = useState<Record<string,number|string>>({})
  const [nosingMm,   setNosingMm]   = useState(0)
  const [adjustVal,  setAdjustVal]  = useState<number|null>(null)  // user-adjusted value for current result
  const [camWarm,    setCamWarm]    = useState(false)  // true once camera has had 1.5s to auto-expose
  // ── Measurement line overlay state ────────────────────────────────────────
  const [showMeasureLine,    setShowMeasureLine]    = useState(false)
  const [measureLineValue,   setMeasureLineValue]   = useState<string|null>(null)
  const [measureLineLabel,   setMeasureLineLabel]   = useState('MEASURING')
  const [measureLineAxis,    setMeasureLineAxis]    = useState<'horizontal'|'vertical'>('horizontal')
  // ── Credit card scale reference ───────────────────────────────────────────
  // ── Device orientation for perspective correction ─────────────────────────
  const [deviceBeta,  setDeviceBeta]  = useState<number|null>(null)
  const [deviceGamma, setDeviceGamma] = useState<number|null>(null)
  // Captured frames: positionId → base64 JPEG (for report images)
  const capturedFrames = useRef<Record<string,string>>({})
  // ── Intro slideshow state (shown before scan begins) ─────────────────────
  const [showIntro,    setShowIntro]    = useState(true)   // true = show slideshow
  const [introSlide,   setIntroSlide]   = useState(0)      // current slide index
  // ── Back-to-guide state ────────────────────────────────────────────────────
  const [showGuide,    setShowGuide]    = useState(false)  // AI Guide overlay during scan

  const [arSupported,  setArSupported]  = useState(false)
  const [arPlanes,     setArPlanes]     = useState<ScreenPlane[]>([])
  const arOverlayRef = useRef<HTMLDivElement>(null)  // dom-overlay root for WebXR
  const [showReview, setShowReview] = useState(false)
  const [showBackMenu, setShowBackMenu] = useState(false)

  const currentPos = POSITIONS[posIdx] ?? POSITIONS[0]
  const indicator  = indicators[currentPos.id]

  // ── Camera init ───────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    async function startCamera(attempt = 0) {
      // Stop any existing stream first — prevents NotReadableError on retake
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      // Brief pause so hardware fully releases
      if (attempt > 0) await new Promise(r => setTimeout(r, 300 * attempt))

      // iOS Safari: never use { exact: 'environment' } — throws OverconstrainedError
      // iOS Safari: never request specific width/height — often returns degraded stream
      // Instead: enumerate devices and pick the back camera by deviceId
      let backDeviceId: string | undefined
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cams    = devices.filter(d => d.kind === 'videoinput')
        // On iOS, the back camera label contains 'back' or is the last in the list
        const back    = cams.find(d => /back|rear|environment/i.test(d.label)) ?? cams[cams.length - 1]
        if (back?.deviceId) backDeviceId = back.deviceId
      } catch {}

      const constraints: MediaStreamConstraints[] = [
        // Best: specific back camera by deviceId (most reliable on iOS)
        ...(backDeviceId ? [{ video: { deviceId: { exact: backDeviceId } }, audio: false }] : []),
        // Good: non-exact facingMode (iOS-safe)
        { video: { facingMode: 'environment' }, audio: false },
        // Fallback: any camera
        { video: true, audio: false },
      ]

      let stream: MediaStream | null = null
      for (const constraint of constraints) {
        try { stream = await navigator.mediaDevices.getUserMedia(constraint); break }
        catch (e: any) {
          if (e?.name === 'NotReadableError' && attempt < 3) {
            return startCamera(attempt + 1)
          }
          // OverconstrainedError or other — try next constraint
          continue
        }
      }

      if (!stream) { if (alive) setCamError(true); return }
      if (!alive)  { stream.getTracks().forEach(t => t.stop()); return }

      streamRef.current = stream

      // Attach to video element and play
      const attachAndPlay = () => {
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream!
        v.muted     = true
        v.playsInline = true
        v.play().catch(() => {})
      }
      attachAndPlay()

      // Poll until video has real dimensions
      let waited = 0
      const poll = setInterval(() => {
        if (!alive) { clearInterval(poll); return }
        waited += 100
        const v = videoRef.current
        // Re-attach if srcObject got lost (can happen on re-render)
        if (v && !v.srcObject && streamRef.current) attachAndPlay()
        if (v && v.videoWidth > 0 && v.videoHeight > 0) {
          clearInterval(poll)
          setCamReady(true)
        }
        if (waited > 8000) { clearInterval(poll); if (alive) setCamReady(true) }
      }, 100)
    }

    startCamera()
    checkXRSupport().then(async s => {
      const supported = s.immersiveAR && s.planeDetection
      setArSupported(supported)
      if (supported && arOverlayRef.current) {
        // Start session on first user gesture — WebXR requires gesture context.
        // We attach it to the first camera-ready event which happens after user
        // grants camera permission (itself a gesture).
        const started = await startARSession(
          arOverlayRef.current,
          (planes) => { if (alive) setArPlanes(planes) }
        )
        console.log('[ARCore] session started:', started)
      }
    }).catch(()=>{})
    return () => {
      alive = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      stopARSession()
    }
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────
  function captureB64(scale=1.0): string|null {
    const v = videoRef.current, c = captureRef.current
    if (!v || !c) return null

    // Re-attach stream if lost
    if (streamRef.current && !v.srcObject) {
      v.srcObject = streamRef.current
      v.muted     = true
      v.play().catch(() => {})
    }

    // iOS Safari: readyState must be HAVE_ENOUGH_DATA (4) for a valid frame
    // readyState 2 (HAVE_CURRENT_DATA) often gives a black frame on iPhone
    if (v.videoWidth === 0 || v.videoHeight === 0) return null
    if (v.readyState < 2) return null

    const srcW = v.videoWidth
    const srcH = v.videoHeight

    // Cap at 1600px — iOS JPEG encode is slow above this, and 1600px is plenty for Claude
    const MAX   = 1600
    const ratio = Math.min(1, MAX / Math.max(srcW, srcH)) * scale
    c.width     = Math.round(srcW * ratio)
    c.height    = Math.round(srcH * ratio)

    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(v, 0, 0, c.width, c.height)

    // Check for black frame — iOS sometimes returns an all-black canvas
    // Sample a few pixels; if all are 0,0,0 the frame hasn't decoded yet
    const probe = ctx.getImageData(c.width >> 1, c.height >> 1, 4, 4).data
    const isBlack = Array.from(probe).every((_,i) => i%4===3 || probe[i] < 8)
    if (isBlack) return null

    return c.toDataURL('image/jpeg', 0.88).split(',')[1]
  }

  function captureB64Small(): string|null {
    // Smaller version for email embedding only — 50% of native
    return captureB64(0.5)
  }

  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }

  // ── Go to a position — always starts at 'position' stage with full countdown ─
  const goTo = useCallback((idx: number) => {
    clearTimer()
    if (idx >= POSITIONS.length) { finishScan(); return }
    busyRef.current = false
    setPosIdx(idx)
    setAdjustVal(null)
    setAiMessage(null)
    setStage('position')
    setCountdown(POSITIONS[idx].positionTime)
    setShowMeasureLine(false)
    setMeasureLineValue(null)
  }, []) // eslint-disable-line

  // ── Device orientation listener (for perspective correction) ───────────────
  useEffect(() => {
    const handler = (e: DeviceOrientationEvent) => {
      setDeviceBeta(e.beta)
      setDeviceGamma(e.gamma)
    }
    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handler)
    }
    return () => window.removeEventListener('deviceorientation', handler)
  }, [])

  // Init on camera ready
  useEffect(() => { if (camReady) goTo(0) }, [camReady]) // eslint-disable-line

  // Re-attach stream whenever we enter camera-active stages (prevents black screen)
  useEffect(() => {
    if (stage === 'hold' || stage === 'capture' || stage === 'analysing' || stage === 'result') {
      const v = videoRef.current
      if (v && streamRef.current && !v.srcObject) {
        v.srcObject = streamRef.current
        v.muted = true
        v.play().catch(() => {})
      }
    }
  }, [stage])

  // When review screen closes AND there's a pending rescan, jump to that position
  useEffect(() => {
    if (!showReview && pendingRescanRef.current >= 0) {
      const idx = pendingRescanRef.current
      pendingRescanRef.current = -1
      busyRef.current = false

      // Poll until the video element is in the DOM and stream is attached
      // (showReview hides the entire scan UI so videoRef.current may be null briefly)
      let attempts = 0
      const attach = setInterval(() => {
        attempts++
        const v = videoRef.current
        const s = streamRef.current
        if (v && s) {
          clearInterval(attach)
          if (!v.srcObject || v.srcObject !== s) {
            v.srcObject = s
            v.muted = true
            v.playsInline = true
            v.play().catch(() => {})
          }
          // Wait for video to have real dimensions before starting countdown
          let waited = 0
          const waitDims = setInterval(() => {
            waited += 50
            if ((videoRef.current?.videoWidth ?? 0) > 0) {
              clearInterval(waitDims)
              goTo(idx)
            }
            if (waited > 2000) { clearInterval(waitDims); goTo(idx) }
          }, 50)
        }
        if (attempts > 40) { clearInterval(attach); goTo(idx) }  // 2s safety
      }, 50)
    }
  }, [showReview]) // eslint-disable-line

  // ── Stage: position — countdown ticking + slide cycling ─────────────────
  useEffect(() => {
    if (stage !== 'position') return
    if (countdown <= 0) {
      setStage('ready')
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [stage, countdown])

  // Slide cycle effect removed — intro slideshow handles all illustrations

  // ── Stage: ready — waiting for user tap (no timer) ────────────────────────
  // User taps "I'm Ready" → start hold countdown + warm-up timer
  function handleReady() {
    // Immediately hide illustration so camera gets full unobstructed view
    // BEFORE we start the hold countdown — critical for auto-exposure
    setCamWarm(false)
    setStage('hold')          // illustration disappears immediately (showIllustration becomes false)
    setCountdown(currentPos.holdSeconds)
    // Camera warm-up: 2s — iOS autofocus/exposure takes longer than Android
    setTimeout(() => setCamWarm(true), 2000)
  }

  // ── Stage: hold — camera live, hold-still countdown ───────────────────────
  useEffect(() => {
    if (stage !== 'hold') return
    if (countdown <= 0) {
      // Hold countdown done → show "Tap to Capture" prompt
      setStage('capture')
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [stage, countdown])

  // ── Stage: capture — user taps, save frame for report, then analyse ────────
  function handleCapture() {
    // Store FULL-res frame for photo PDF report
    const b64Full = captureB64(1.0)
    if (b64Full) {
      capturedFrames.current[currentPos.id] = b64Full
      // Persist to sessionStorage so it survives the payment redirect flow
      // sessionStorage is per-tab and up to ~5–10MB — safe for ~6 phone photos
      try {
        const existing = JSON.parse(sessionStorage.getItem('sc_frames') || '{}')
        existing[currentPos.id] = b64Full
        sessionStorage.setItem('sc_frames', JSON.stringify(existing))
      } catch { /* quota exceeded — in-memory fallback still works */ }
    }
    busyRef.current = false
    setStage('analysing')
  }

  // ── Stage: analysing — AI call ────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'analysing' || busyRef.current) return
    busyRef.current = true

    async function run() {
      // iOS Safari: video frame may not be decoded on first call
      // Retry up to 6 times with 250ms gap before giving up
      let b64: string|null = null
      for (let attempt = 0; attempt < 6; attempt++) {
        b64 = captureB64()
        if (b64) break
        await new Promise(r => setTimeout(r, 250))
      }
      if (!b64) {
        busyRef.current = false
        setStage('capture')
        return
      }

      // Read current results from ref (always fresh, no stale closure issue)
      const priorSnap = { ...resultsRef.current }

      // ── Try ARCore plane measurement first (Android only) ──────────────────
      const modeMap: Record<string, import('@/lib/arcore-session').ARMeasurementMode> = {
        riser_front: 'riser', tread_top: 'tread', alt_angle: 'width',
        handrail: 'handrail', overview: 'headroom',
      }
      const arMode = modeMap[currentPos.id]
      if (isARSessionActive() && arMode) {
        const arResult = measureFromPlanes(arMode, priorSnap)
        if (arResult) {
          busyRef.current = false
          // Inject as if it came from AI
          const fakeR = {
            estimatedMm: arResult.estimatedMm,
            confidence:  arResult.confidence,
            message:     arResult.message,
            hasNosing:   undefined,
          }
          // Fall through to extraction with fakeR
          extractMeasurements(fakeR)
          setAiMessage(arResult.message)
          setStage('result')
          return
        }
      }

      const raw = await callVision(b64, currentPos.aiPrompt(priorSnap))
      busyRef.current = false
      const r = parseJSON(raw)

      if (!r) {
        setAiMessage("Could not read the image clearly — tap Retry to try again.")
        setStage('result')
        return
      }

      extractMeasurements(r)
      setAiMessage(r.message ?? null)

      // ── Apply device-sensor perspective correction if AI didn't already ──
      // Only for riser — most affected by tilt. If AI already corrected (tiltCorrected=true)
      // or read a tape directly, skip sensor correction to avoid double-applying.
      if (currentPos.id === 'riser_front' && r.estimatedMm &&
          !r.tiltCorrected && !r.tapeMeasureRead &&
          (deviceBeta != null || deviceGamma != null)) {
        const modeMap: Record<string, import('@/lib/pose-validator').MeasurementMode> = {
          riser_front: 'riser', tread_top: 'tread', alt_angle: 'width',
          handrail: 'handrail', overview: 'headroom',
        }
        const pvMode = modeMap[currentPos.id] as import('@/lib/pose-validator').MeasurementMode
        const validated = applyPerspectiveCorrection(
          parseFloat(String(r.estimatedMm)),
          pvMode,
          deviceGamma,
          deviceBeta,
          r.tiltAngleDeg ?? null
        )
        // Only override if correction is meaningful (>5mm change) and angle is not too extreme
        if (Math.abs(validated.correctedMm - validated.rawMm) > 5 && validated.pose.score > 0.4) {
          setResultsKey('rise', validated.correctedMm)
          setAiMessage(`${r.message ?? ''} · Sensor: ${Math.round(validated.pose.angleDeg)}° tilt corrected (${validated.rawMm}→${validated.correctedMm}mm)`.trim())
        }
      }
      // ── Trigger animated measurement line ─────────────────────────────────
      const lineInfo = getMeasureLineInfo(currentPos.id, r)
      if (lineInfo) {
        setMeasureLineLabel(lineInfo.label)
        setMeasureLineAxis(lineInfo.axis)
        setMeasureLineValue(lineInfo.value)
        setShowMeasureLine(true)
      }
      setStage('result')
    }

    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // ── Helper: update a single field in results + resultsRef ─────────────────
  function setResultsKey(key: string, value: any) {
    setResults(prev => {
      const next = { ...prev, [key]: value }
      resultsRef.current = next
      return next
    })
  }

  // ── Measurement line: derive label + axis + display value from AI response ─
  function getMeasureLineInfo(posId: string, r: any): { label: string; axis: 'horizontal'|'vertical'; value: string } | null {
    const mm = (v: any) => { if (!v) return null; const n = parseFloat(String(v)); return isNaN(n)||n<=0?null:Math.round(n) }
    const est = mm(r.estimatedMm ?? r.estimated_mm)
    if (!est) return null
    const map: Record<string, { label: string; axis: 'horizontal'|'vertical' }> = {
      riser_front: { label: 'RISER HEIGHT',  axis: 'vertical'   },
      tread_top:   { label: 'TREAD DEPTH',   axis: 'horizontal' },
      alt_angle:   { label: 'STAIR WIDTH',   axis: 'horizontal' },
      handrail:    { label: 'GUARDRAIL HT',  axis: 'vertical'   },
      overview:    { label: 'HEADROOM',      axis: 'vertical'   },
    }
    const info = map[posId]
    if (!info) return null
    return { label: info.label, axis: info.axis, value: `${est}mm` }
  }

  // ── Shared measurement extraction (used by both AI Vision and ARCore) ─────
  function extractMeasurements(r: any) {
      // Extract measurements — coerce all values to numbers defensively
      const mm = (v: any): number | null => {
        if (v == null) return null
        const n = typeof v === 'number' ? v : parseFloat(String(v))
        return isNaN(n) || n <= 0 ? null : Math.round(n)
      }
      const p = currentPos.id

      setResults(prev => {
        const next = { ...prev }

        if (p === 'overview') {
          const sc = mm(r.stepCount)
          if (sc)                      next.riserCount    = sc
          if (r.headroom != null)      next.headroom      = r.headroom === 'clear' ? 'clear' : (mm(r.headroom) ?? 'clear')
          if (r.isResidential != null) next.isResidential = r.isResidential ? 1 : 0
          // Occupancy classification from visual context
          if (r.occupancyType)        next.occupancyType        = r.occupancyType
          if (r.occupancyConfidence != null) next.occupancyConfidence = parseFloat(String(r.occupancyConfidence))
          if (r.applicableCodePart)   next.applicableCodePart   = r.applicableCodePart
          if (r.guardrailLikelyRequired != null) next.guardrailLikelyRequired = r.guardrailLikelyRequired ? 1 : 0
        }

        const est = mm(r.estimatedMm)
        // Store scale reference used for this measurement (shown in UI)
        if (r.scaleRef) next.scaleRef = r.scaleRef

        if (p === 'riser_front') {
          // Always store the estimate even if low confidence — user can adjust
          next.rise = est ?? mm(r.estimated_mm) ?? 175

          // Store perspective correction metadata
          if (r.tiltCorrected)           next.tiltCorrected       = 1
          if (r.tiltAngleDeg != null)    next.tiltAngleDeg        = parseFloat(String(r.tiltAngleDeg))
          if (r.tapeMeasureRead)         next.tapeMeasureRead     = 1
          if (r.rawEstimateMm != null)   next.rawEstimateMm       = mm(r.rawEstimateMm) ?? undefined  // fallback to typical value

          // Store inconsistency data
          const maxVar = r.maxVariationMm != null ? parseFloat(String(r.maxVariationMm)) : null
          const flag   = r.inconsistencyFlag  // true | false | null
          if (maxVar != null && !isNaN(maxVar)) next.riserVariationMm = Math.round(maxVar)
          // inconsistencyFlag: 1=inconsistent, 0=consistent, -1=could not assess
          if (flag === true)       next.riserInconsistent = 1
          else if (flag === false) next.riserInconsistent = 0
          else                     next.riserInconsistent = -1  // null = unknown

          // Also extract nosing detected during riser measurement
          const hasN = r.hasNosing === true || r.has_nosing === true
          const nm = mm(r.nosingMm ?? r.nosing_mm)
          // Nosing < 15mm is effectively flush — treat as no nosing (not a fail)
          const nosingValid = nm != null && nm >= 15
          next.nosing = (hasN && nosingValid) ? nm! : 'none'
          if (nosingValid && nm) setNosingMm(nm)
        }
        if (p === 'handrail') {
          // No guardrail = null (not auto-fail; may not be required for this stair)
          // Respect explicit "no guardrail" signal — store null, not a default
          const noGuardrail = r.noGuardrail === true || r.no_guardrail === true
          next.guard = noGuardrail ? null : (est ?? mm(r.estimated_mm) ?? null)
          if (noGuardrail) next.guardrailAbsent = 1
          const off = mm(r.offsetMm ?? r.offset_mm)
          if (off) next.handrailOffset = off
        }
        if (p === 'alt_angle') {
          next.width = est ?? mm(r.estimated_mm) ?? null
        }
        if (p === 'tread_top') {
          next.run = est ?? mm(r.estimated_mm) ?? 250  // fallback to typical value
        }

        resultsRef.current = next
        return next
      })
  }  // end extractMeasurements


  // ── Finish early ──────────────────────────────────────────────────────────
  function finishScan() {
    clearTimer()
    // Use resultsRef so this always has fresh data even inside stale closures
    const final = { ...resultsRef.current }
    if (!final.headroom) final.headroom = 'clear'
    setResults(final)
    resultsRef.current = final
    setReviewVals(final)
    setShowReview(true)
  }

  function submitReview() {
    Analytics.scanCompleted({ role: userRole, measurementCount: Object.keys(reviewVals).length, hasFailed: false })
    // Ensure sessionStorage has all frames (supplement any that were stored during capture)
    try {
      const stored = JSON.parse(sessionStorage.getItem('sc_frames') || '{}')
      const merged = { ...stored, ...capturedFrames.current }
      sessionStorage.setItem('sc_frames', JSON.stringify(merged))
    } catch {}
    // Attach captured frames to measurements so report generation can embed them
    const withFrames = { ...reviewVals, _frames: JSON.stringify(capturedFrames.current) }
    onSuccess(withFrames)
  }

  // ── Derived display state ─────────────────────────────────────────────────
  // Show illustration: during position/ready/paused
  const showIllustration = false  // images removed — intro slideshow handles all illustrations
  // Show camera live: always — camera is always on in background
  // During illustration stages, camera shows at reduced opacity behind the white-bg overlay
  const showCamera = true
  // Camera is ALWAYS full opacity — dimming it causes auto-exposure to recalibrate
  // and produces dark/blurry frames when we need to capture
  const cameraOpacity = 1

  const progressPct   = (posIdx / POSITIONS.length) * 100
  const IMAGE_TOP     = 88
  const BOTTOM_PANEL  = 240  // tall enough for result stage content

  // ── Camera error ──────────────────────────────────────────────────────────
  if (camError) return (
    <div style={{position:'fixed',inset:0,background:NAVY,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'1rem',padding:'2rem',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{fontSize:'2rem'}}>📷</div>
      <p style={{color:WHITE,textAlign:'center'}}>Camera access is required to scan stairs.</p>
      <button onClick={onBack} style={{padding:'0.8rem 2rem',background:AMBER,border:'none',borderRadius:12,color:'#fff',fontWeight:700,cursor:'pointer'}}>Back</button>
    </div>
  )

  // ── Review screen ─────────────────────────────────────────────────────────
  function rescanPosition(posId: Position) {
    const idx = POSITIONS.findIndex(p => p.id === posId)
    if (idx < 0) return
    rescanReturnRef.current  = true
    pendingRescanRef.current = idx
    setShowReview(false)
    // goTo is called by the showReview useEffect below (after review unmounts)
  }

  // ── INTRO SLIDESHOW — shown before scan begins ─────────────────────────────
  if (showIntro) {
    const slide = INTRO_SLIDES[introSlide]
    const isLast = introSlide === INTRO_SLIDES.length - 1
    return (
      <div style={{position:'fixed',inset:0,background:'#fff',display:'flex',flexDirection:'column',zIndex:9999}}>
        {/* Header */}
        <div style={{padding:'1rem 1.25rem 0.75rem',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <button onClick={onBack} style={{background:'none',border:'none',color:'#6b7280',fontSize:'0.85rem',cursor:'pointer',fontFamily:'monospace',padding:'0.25rem 0'}}>← Exit</button>
          <span style={{fontSize:'0.72rem',fontFamily:'monospace',color:'#9ca3af',letterSpacing:'0.1em'}}>HOW TO SCAN</span>
          <button onClick={()=>setShowIntro(false)} style={{background:'none',border:'none',color:'#6b7280',fontSize:'0.75rem',cursor:'pointer',fontFamily:'monospace'}}>Skip →</button>
        </div>

        {/* Image — full white bg, fills most of screen */}
        <div style={{flex:1,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',position:'relative'}}>
          <img
            key={slide.img}
            src={slide.img}
            alt={slide.title}
            style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',display:'block',animation:'fadeSlide 0.3s ease'}}
          />
          {/* Left arrow */}
          {introSlide > 0 && (
            <button
              onClick={()=>setIntroSlide(i=>i-1)}
              style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',width:48,height:48,borderRadius:14,background:'rgba(10,28,46,0.85)',border:'2px solid rgba(255,255,255,0.25)',color:'#fff',fontSize:'1.6rem',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.3)'}}>
              ‹
            </button>
          )}
          {/* Right arrow */}
          <button
            onClick={()=>{ if(isLast) setShowIntro(false); else setIntroSlide(i=>i+1) }}
            style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',width:48,height:48,borderRadius:14,background: isLast ? '#27A96B' : 'rgba(10,28,46,0.85)',border:`2px solid ${isLast ? '#27A96B' : 'rgba(255,255,255,0.25)'}`,color:'#fff',fontSize: isLast ? '1rem' : '1.6rem',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.3)',fontFamily:'monospace'}}>
            {isLast ? '✓' : '›'}
          </button>
        </div>

        {/* Text */}
        <div style={{padding:'1rem 1.25rem',flexShrink:0}}>
          <div style={{fontSize:'1rem',fontWeight:800,color:'#0A1C2E',marginBottom:'0.35rem',fontFamily:'system-ui,sans-serif'}}>{slide.title}</div>
          <div style={{fontSize:'0.82rem',color:'#4b5563',lineHeight:1.6,fontFamily:'system-ui,sans-serif'}}>{slide.desc}</div>
        </div>

        {/* Dot indicators */}
        <div style={{display:'flex',justifyContent:'center',gap:'0.45rem',paddingBottom:'calc(env(safe-area-inset-bottom,0px) + 0.75rem)',paddingTop:'0.25rem',flexShrink:0}}>
          {INTRO_SLIDES.map((_,i)=>(
            <div key={i} onClick={()=>setIntroSlide(i)} style={{
              width: i===introSlide ? 22 : 8, height:8,
              borderRadius: i===introSlide ? 4 : '50%',
              background: i===introSlide ? '#0A1C2E' : '#d1d5db',
              cursor:'pointer',transition:'all 0.25s ease',
            }}/>
          ))}
        </div>

        {/* Start scan button — only on last slide */}
        {isLast && (
          <div style={{padding:'0 1.25rem',paddingBottom:'calc(env(safe-area-inset-bottom,0px) + 1rem)',flexShrink:0}}>
            <button
              onClick={()=>setShowIntro(false)}
              style={{width:'100%',padding:'1.1rem',background:'linear-gradient(135deg,#0A1C2E,#1a3a5c)',border:'none',borderRadius:16,color:'#fff',fontFamily:'monospace',fontSize:'1rem',fontWeight:900,letterSpacing:'0.06em',cursor:'pointer',boxShadow:'0 6px 24px rgba(10,28,46,0.4)'}}>
              📷 Start Scanning →
            </button>
          </div>
        )}

        <style>{`@keyframes fadeSlide{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}`}</style>
      </div>
    )
  }

  // ── AI GUIDE OVERLAY — shown when user taps AI Guide during scan ────────────
  if (showGuide) {
    const slide = INTRO_SLIDES[introSlide]
    const isLast = introSlide === INTRO_SLIDES.length - 1
    return (
      <div style={{position:'fixed',inset:0,background:'#fff',display:'flex',flexDirection:'column',zIndex:9999}}>
        {/* Header */}
        <div style={{padding:'1rem 1.25rem 0.75rem',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <span style={{fontSize:'0.85rem',fontWeight:700,color:'#0A1C2E',fontFamily:'system-ui,sans-serif'}}>📷 AI Guide</span>
          <button
            onClick={()=>setShowGuide(false)}
            style={{background:'#0A1C2E',border:'none',borderRadius:10,color:'#fff',fontSize:'0.8rem',fontFamily:'monospace',fontWeight:700,cursor:'pointer',padding:'0.5rem 1rem',letterSpacing:'0.06em'}}>
            ← Resume Scan
          </button>
        </div>

        <div style={{flex:1,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',position:'relative'}}>
          <img key={slide.img} src={slide.img} alt={slide.title}
            style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',display:'block',animation:'fadeSlide 0.3s ease'}}/>
          {introSlide > 0 && (
            <button onClick={()=>setIntroSlide(i=>i-1)}
              style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',width:48,height:48,borderRadius:14,background:'rgba(10,28,46,0.85)',border:'2px solid rgba(255,255,255,0.25)',color:'#fff',fontSize:'1.6rem',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.3)'}}>
              ‹
            </button>
          )}
          {!isLast && (
            <button onClick={()=>setIntroSlide(i=>i+1)}
              style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',width:48,height:48,borderRadius:14,background:'rgba(10,28,46,0.85)',border:'2px solid rgba(255,255,255,0.25)',color:'#fff',fontSize:'1.6rem',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.3)'}}>
              ›
            </button>
          )}
        </div>

        <div style={{padding:'1rem 1.25rem',flexShrink:0}}>
          <div style={{fontSize:'1rem',fontWeight:800,color:'#0A1C2E',marginBottom:'0.35rem',fontFamily:'system-ui,sans-serif'}}>{slide.title}</div>
          <div style={{fontSize:'0.82rem',color:'#4b5563',lineHeight:1.6,fontFamily:'system-ui,sans-serif'}}>{slide.desc}</div>
        </div>

        <div style={{display:'flex',justifyContent:'center',gap:'0.45rem',paddingBottom:'calc(env(safe-area-inset-bottom,0px) + 1.5rem)',paddingTop:'0.25rem',flexShrink:0}}>
          {INTRO_SLIDES.map((_,i)=>(
            <div key={i} onClick={()=>setIntroSlide(i)} style={{
              width: i===introSlide ? 22 : 8, height:8,
              borderRadius: i===introSlide ? 4 : '50%',
              background: i===introSlide ? '#0A1C2E' : '#d1d5db',
              cursor:'pointer',transition:'all 0.25s ease',
            }}/>
          ))}
        </div>
        <style>{`@keyframes fadeSlide{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}`}</style>
      </div>
    )
  }

  if (showReview) return (
    <div style={{position:'fixed',inset:0,background:NAVY,overflowY:'auto',
      padding:'max(env(safe-area-inset-top,0px),2.5rem) 1.25rem 3rem',
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{maxWidth:440,margin:'0 auto',display:'flex',flexDirection:'column',gap:'0.85rem'}}>

        <div style={{textAlign:'center',marginBottom:'0.25rem'}}>
          <div style={{fontSize:'1.5rem',marginBottom:'0.3rem'}}>📐</div>
          <div style={{fontSize:'1.1rem',fontWeight:800,color:WHITE}}>Review Measurements</div>
          <div style={{fontSize:'0.72rem',color:WHITE2,marginTop:'0.25rem',lineHeight:1.5}}>
            Tap ↺ on any row to rescan that measurement. Tap a value to edit it manually.
          </div>
        </div>

        {([
          {key:'rise',     label:'Riser Height',    unit:'mm', type:'number',   posId:'riser_front' as Position},
          {key:'run',      label:'Tread Depth',     unit:'mm', type:'number',   posId:'tread_top'   as Position},
          {key:'width',    label:'Stair Width',     unit:'mm', type:'number',   posId:'alt_angle'   as Position},
          {key:'guard',    label:'Handrail Height', unit:'mm', type:'number',   posId:'handrail'    as Position},
          {key:'nosing',   label:'Nosing',          unit:'',   type:'nosing',   posId:'nosing'      as Position},
          {key:'headroom', label:'Headroom',        unit:'',   type:'headroom', posId:'overview'    as Position},
        ] as const).map(({key,label,unit,type,posId}) => {
          const hasValue = reviewVals[key] != null
          const isMissing = !hasValue
          return (
            <div key={key} style={{
              borderRadius:14,
              border:`1.5px solid ${isMissing ? 'rgba(250,116,31,0.35)' : BORDER}`,
              background: isMissing ? 'rgba(250,116,31,0.06)' : 'rgba(255,255,255,0.04)',
              overflow:'hidden',
            }}>
              {/* Row header */}
              <div style={{display:'flex',alignItems:'center',padding:'0.7rem 0.9rem',gap:'0.6rem'}}>
                {/* Status dot */}
                <div style={{
                  width:8,height:8,borderRadius:'50%',flexShrink:0,
                  background: isMissing ? AMBER : GREEN,
                  boxShadow: `0 0 6px ${isMissing ? AMBER : GREEN}`,
                }}/>
                {/* Label */}
                <div style={{flex:1,fontSize:'0.85rem',fontWeight:700,color:WHITE}}>{label}</div>
                {/* Rescan button */}
                <button
                  onClick={()=>rescanPosition(posId)}
                  style={{
                    padding:'0.28rem 0.7rem',
                    background:'rgba(255,255,255,0.07)',
                    border:`1px solid ${BORDER}`,
                    borderRadius:8,color:WHITE2,
                    fontFamily:'monospace',fontSize:'0.68rem',
                    fontWeight:600,cursor:'pointer',
                    letterSpacing:'0.05em',
                    whiteSpace:'nowrap',
                  }}
                >↺ Rescan</button>
              </div>

              {/* Value area */}
              <div style={{padding:'0 0.9rem 0.75rem'}}>
                {type==='number' && (
                  <div style={{display:'flex',alignItems:'center',gap:'0.4rem'}}>
                    <input type="number" inputMode="numeric"
                      value={reviewVals[key]!=null && reviewVals[key]!=='clear' && reviewVals[key]!=='none' ? String(reviewVals[key]) : ''}
                      placeholder={isMissing ? 'Not captured — tap ↺ to rescan' : '—'}
                      onChange={e=>{ const v=parseInt(e.target.value,10); if(!isNaN(v)&&v>0) setReviewVals(p=>({...p,[key]:v})) }}
                      style={{
                        flex:1,padding:'0.5rem 0.75rem',
                        background:'rgba(255,255,255,0.06)',
                        border:`1px solid ${isMissing ? 'rgba(250,116,31,0.3)' : BORDER}`,
                        borderRadius:10,color: isMissing ? 'rgba(255,255,255,0.3)' : WHITE,
                        fontFamily:'monospace',fontWeight:700,fontSize:'1rem',
                      }}
                    />
                    <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',fontFamily:'monospace',flexShrink:0}}>mm</span>
                  </div>
                )}
                {type==='nosing' && (
                  <div style={{display:'flex',gap:'0.4rem'}}>
                    {(['none','yes'] as const).map(opt=>(
                      <button key={opt} onClick={()=>setReviewVals(p=>({...p,nosing:opt==='yes'?(nosingMm||30):'none'}))}
                        style={{padding:'0.45rem 1rem',borderRadius:10,border:'none',cursor:'pointer',fontFamily:'monospace',fontSize:'0.78rem',fontWeight:700,
                          background:(opt==='none'?reviewVals[key]==='none':reviewVals[key]!=='none'&&reviewVals[key]!=null)?AMBER+'33':'rgba(255,255,255,0.06)',
                          color:(opt==='none'?reviewVals[key]==='none':reviewVals[key]!=='none'&&reviewVals[key]!=null)?AMBER:WHITE2}}>
                        {opt==='none'?'No nosing':'Has nosing'}
                      </button>
                    ))}
                  </div>
                )}
                {type==='headroom' && (
                  <div style={{display:'flex',gap:'0.4rem'}}>
                    {(['clear','low'] as const).map(opt=>(
                      <button key={opt} onClick={()=>setReviewVals(p=>({...p,headroom:opt==='clear'?'clear':(p.headroom!=='clear'?p.headroom:1950)}))}
                        style={{padding:'0.45rem 1rem',borderRadius:10,border:'none',cursor:'pointer',fontFamily:'monospace',fontSize:'0.78rem',fontWeight:700,
                          background:(opt==='clear'?reviewVals[key]==='clear':reviewVals[key]!=='clear'&&reviewVals[key]!=null)?GREEN+'33':'rgba(255,255,255,0.06)',
                          color:(opt==='clear'?reviewVals[key]==='clear':reviewVals[key]!=='clear'&&reviewVals[key]!=null)?GREEN:WHITE2}}>
                        {opt==='clear'?'✓ Clear':'⚠ Low'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Missing items callout */}
        {Object.values(reviewVals).filter(v=>v!=null).length < 4 && (
          <div style={{background:'rgba(250,116,31,0.08)',border:'1px solid rgba(250,116,31,0.25)',borderRadius:12,padding:'0.65rem 0.9rem',fontSize:'0.72rem',color:WHITE2,lineHeight:1.6}}>
            <strong style={{color:AMBER}}>Some measurements are missing.</strong> You can still generate a partial report,
            or tap ↺ Rescan on any row to go back and capture it.
          </div>
        )}

        <button onClick={submitReview} style={{width:'100%',padding:'1.1rem',background:`linear-gradient(135deg,${GREEN},#1A7A50)`,border:'none',borderRadius:16,color:'#fff',fontFamily:'monospace',fontSize:'0.95rem',fontWeight:900,letterSpacing:'0.08em',cursor:'pointer',boxShadow:'0 4px 24px rgba(39,169,107,0.4)',marginTop:'0.25rem'}}>
          Generate Report →
        </button>
      </div>
    </div>
  )

  // ── Main scan UI ──────────────────────────────────────────────────────────
  return (
    <div ref={arOverlayRef} style={{position:'fixed',inset:0,background:'#000',overflow:'hidden',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>

      {/* Live camera feed */}
      {/* iOS Safari requires playsInline AND webkit-playsinline as HTML attributes */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        webkit-playsinline="true"
        x-webkit-airplay="deny"
        style={{
          position:'absolute', inset:0,
          width:'100%', height:'100%',
          objectFit:'cover',
          opacity:1,
          willChange:'transform',
          backfaceVisibility:'hidden',
          WebkitBackfaceVisibility:'hidden',
        }}
      />
      <canvas ref={captureRef} style={{display:'none'}}/>

      {/* ── LIVE ARCORE PLANE OVERLAY — rendered every frame from WebXR render loop ── */}
      {arPlanes.length > 0 && (stage === 'hold' || stage === 'capture' || stage === 'analysing') && (
        <svg
          width="100%" height="100%"
          style={{ position:'absolute', inset:0, zIndex:18, pointerEvents:'none', overflow:'visible' }}
        >
          <defs>
            <filter id="planeGlow">
              <feGaussianBlur stdDeviation="0.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <marker id="normalArrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
              <path d="M0,0 L5,2.5 L0,5 Z" fill="rgba(48,216,138,0.9)"/>
            </marker>
          </defs>
          {arPlanes.map((plane, i) => {
            const col = plane.orientation === 'horizontal' ? 'rgba(74,144,226,0.75)' : 'rgba(48,216,138,0.75)'
            const fillCol = plane.orientation === 'horizontal' ? 'rgba(74,144,226,0.08)' : 'rgba(48,216,138,0.08)'
            const pts = plane.screenPoly.filter(p => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100)
            if (pts.length < 3) return null
            const polyStr = pts.map(p => `${p.x},${p.y}`).join(' ')
            return (
              <g key={i} filter="url(#planeGlow)">
                {/* Filled polygon — faint tint showing plane extent */}
                <polygon points={polyStr} fill={fillCol} stroke={col} strokeWidth="0.4" strokeDasharray="1.5,1"/>
                {/* Centroid dot */}
                <circle cx={`${plane.cx}%`} cy={`${plane.cy}%`} r="0.8%" fill={col}/>
                {/* Normal vector arrow — perpendicular to the detected surface */}
                <line
                  x1={`${plane.cx}%`} y1={`${plane.cy}%`}
                  x2={`${plane.nx}%`} y2={`${plane.ny}%`}
                  stroke="rgba(48,216,138,0.9)" strokeWidth="0.6" strokeDasharray="2,1"
                  markerEnd="url(#normalArrow)"
                />
                {/* n̂ label at arrow tip */}
                <text x={`${plane.nx}%`} y={`${plane.ny - 1}%`}
                  textAnchor="middle" fill="rgba(48,216,138,0.85)"
                  fontSize="11" fontFamily="monospace">n̂</text>
                {/* Orientation label */}
                <text x={`${plane.cx}%`} y={`${plane.cy + 2.5}%`}
                  textAnchor="middle" fill={col}
                  fontSize="10" fontFamily="monospace" fontWeight="bold">
                  {plane.orientation === 'horizontal' ? '━━ H' : '┃ V'}
                </text>
              </g>
            )
          })}
        </svg>
      )}

      {/* ── ANGLE GUIDANCE OVERLAY — real-time phone positioning ───────────── */}
      <AngleGuidanceOverlay
        mode={(['riser_front','tread_top','alt_angle','handrail','overview'].includes(currentPos?.id)
          ? { riser_front: 'riser', tread_top: 'tread', alt_angle: 'width', handrail: 'handrail', overview: 'headroom' }[currentPos.id as string] ?? 'riser'
          : 'riser') as import('@/lib/pose-validator').MeasurementMode}
        isActive={stage === 'position' && !arSupported}
      />

      {/* ── MEASUREMENT LINE OVERLAY — animated blue scan line ──────────── */}
      <MeasurementLineOverlay
        isActive={showMeasureLine && stage === 'result'}
        measurement={measureLineValue}
        label={measureLineLabel}
        axis={measureLineAxis}
        onComplete={() => setShowMeasureLine(false)}
        sweepDuration={1600}
      />

      {/* ── IMAGE ZONE — illustration overlaid on camera ─────────────────── */}
      {/* Countdown timer — top right, only during position stage */}
      {showIllustration && stage === 'position' && (
        <div style={{position:'absolute',top:IMAGE_TOP+10,right:12,background:'rgba(10,28,46,0.88)',backdropFilter:'blur(8px)',borderRadius:12,padding:'0.4rem 0.75rem',border:`1px solid ${AMBER}55`,display:'flex',alignItems:'center',gap:'0.5rem',zIndex:12}}>
          <svg width="20" height="20" viewBox="0 0 36 36" style={{transform:'rotate(-90deg)',flexShrink:0}}>
            <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3"/>
            <circle cx="18" cy="18" r="14" fill="none" stroke={AMBER} strokeWidth="3"
              strokeDasharray={`${2*Math.PI*14}`}
              strokeDashoffset={`${2*Math.PI*14*(countdown/currentPos.positionTime)}`}
              strokeLinecap="round" style={{transition:'stroke-dashoffset 0.9s linear'}}/>
          </svg>
          <span style={{fontSize:'0.8rem',fontFamily:'monospace',fontWeight:800,color:WHITE}}>{countdown}s</span>
        </div>
      )}

      {/* No overlay during analyse — keep camera frame fully visible */}

      {/* ── TOP BAR ── */}
      <div style={{
        position:'absolute',top:0,left:0,right:0,zIndex:50,
        paddingTop:'max(env(safe-area-inset-top,0px),1.5rem)',
        paddingBottom:'0.6rem',paddingLeft:'1rem',paddingRight:'1rem',
        background: (stage==='hold'||stage==='capture')
          ? 'linear-gradient(to bottom,rgba(0,0,0,0.7),transparent)'
          : 'linear-gradient(to bottom,rgba(10,28,46,0.95),rgba(10,28,46,0.6))',
        display:'flex',alignItems:'center',gap:'0.75rem',
        height:IMAGE_TOP,boxSizing:'border-box',
      }}>
        {/* Back button → dropdown menu */}
        <div style={{position:'relative',flexShrink:0}}>
          <button
            onClick={()=>setShowBackMenu(v=>!v)}
            style={{width:34,height:34,borderRadius:'50%',background:'rgba(0,0,0,0.5)',border:`1px solid ${BORDER}`,color:WHITE,fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
          >←</button>
          {showBackMenu && (
            <div style={{
              position:'absolute',top:40,left:0,
              background:'rgba(10,28,46,0.97)',backdropFilter:'blur(12px)',
              border:`1px solid ${BORDER}`,borderRadius:14,
              padding:'0.4rem',zIndex:200,
              display:'flex',flexDirection:'column',gap:'0.25rem',
              minWidth:160,boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
            }}>
              {/* Go back one step */}
              <button
                onClick={()=>{ setShowBackMenu(false); if(posIdx>0) goTo(posIdx-1); else setShowBackMenu(false) }}
                style={{padding:'0.65rem 0.9rem',background:'transparent',border:'none',borderRadius:10,color:WHITE,fontSize:'0.82rem',fontWeight:600,cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:'0.5rem'}}
              >
                <span style={{fontSize:'1rem'}}>←</span> Go back one step
              </button>
              {/* View report early */}
              <button
                onClick={()=>{ setShowBackMenu(false); finishScan() }}
                style={{padding:'0.65rem 0.9rem',background:'transparent',border:'none',borderRadius:10,color:GREEN,fontSize:'0.82rem',fontWeight:600,cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:'0.5rem'}}
              >
                <span style={{fontSize:'1rem'}}>📋</span> View Report
              </button>
              {/* Divider */}
              <div style={{height:1,background:BORDER,margin:'0.15rem 0'}}/>
              {/* Sign out */}
              <button
                onClick={()=>{ setShowBackMenu(false); onBack() }}
                style={{padding:'0.65rem 0.9rem',background:'transparent',border:'none',borderRadius:10,color:'rgba(255,100,100,0.85)',fontSize:'0.82rem',fontWeight:600,cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:'0.5rem'}}
              >
                <span style={{fontSize:'1rem'}}>🚪</span> Sign Out
              </button>
              {/* Dismiss */}
              <button
                onClick={()=>setShowBackMenu(false)}
                style={{padding:'0.5rem 0.9rem',background:'transparent',border:'none',borderRadius:10,color:WHITE2,fontSize:'0.72rem',cursor:'pointer',textAlign:'center'}}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <div style={{flex:1,display:'flex',flexDirection:'column',gap:'0.25rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:'0.6rem',fontFamily:'monospace',letterSpacing:'0.1em',color:WHITE2}}>STEP {currentPos.step} / 5</span>
            <span style={{fontSize:'0.72rem',fontWeight:700,color:WHITE}}>{currentPos.label}</span>
          </div>
          <div style={{height:3,background:'rgba(255,255,255,0.1)',borderRadius:2,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${progressPct}%`,background:`linear-gradient(90deg,${GREEN},${BLUE})`,borderRadius:2,transition:'width 0.4s ease'}}/>
          </div>
        </div>
        {/* AI Guide button */}
        <button
          onClick={()=>{ setShowGuide(true); setIntroSlide(Math.max(0, Math.min(posIdx, INTRO_SLIDES.length-1))) }}
          style={{background:'rgba(10,28,46,0.7)',border:`1px solid ${BORDER}`,borderRadius:10,padding:'0.28rem 0.65rem',color:WHITE2,fontFamily:'monospace',fontSize:'0.58rem',fontWeight:700,letterSpacing:'0.06em',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',gap:'0.3rem'}}>
          <span>📷</span><span>Guide</span>
        </button>
        {/* AR / AI badge */}
        <div
          title={arSupported ? 'ARCore active' : 'AI Vision mode'}
          style={{background:arSupported?'rgba(74,144,226,0.15)':'rgba(242,147,55,0.15)',border:`1px solid ${arSupported?'rgba(74,144,226,0.4)':'rgba(242,147,55,0.4)'}`,borderRadius:10,padding:'0.18rem 0.6rem',flexShrink:0,display:'flex',alignItems:'center',gap:'0.3rem'}}>
          <div style={{width:5,height:5,borderRadius:'50%',background:arSupported?BLUE:AMBER,boxShadow:`0 0 4px ${arSupported?BLUE:AMBER}`}}/>
          <span style={{fontSize:'0.5rem',fontFamily:'monospace',letterSpacing:'0.1em',color:arSupported?BLUE:AMBER,fontWeight:700}}>{arSupported?'AR·CORE':'AI·VISION'}</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          BOTTOM PANEL — fixed height, never overlaps image
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        position:'absolute',bottom:0,left:0,right:0,
        minHeight:BOTTOM_PANEL,zIndex:50,
        background: (stage==='hold'||stage==='capture')
          ? 'linear-gradient(to top,rgba(0,0,0,0.85) 60%,transparent)'
          : 'linear-gradient(to top,rgba(10,28,46,0.99) 80%,rgba(10,28,46,0.6))',
        paddingBottom:'max(env(safe-area-inset-bottom,0px),1.25rem)',
        paddingLeft:'1.25rem',paddingRight:'1.25rem',paddingTop:'0.85rem',
        display:'flex',flexDirection:'column',gap:'0.6rem',
        boxSizing:'border-box',
      }}>

        {/* ══ POSITION — countdown ticking, dialogue instruction ══ */}
        {stage==='position' && <>
          {/* Instruction card */}
          <div style={{background:'rgba(255,255,255,0.06)',borderRadius:14,padding:'0.9rem 1rem',border:`1px solid rgba(255,255,255,0.1)`}}>
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.45rem'}}>
              <div style={{width:24,height:24,borderRadius:'50%',background:indicator.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',fontFamily:'monospace',fontWeight:900,color:'#000',flexShrink:0}}>{currentPos.step}</div>
              <div style={{fontSize:'0.92rem',fontWeight:800,color:WHITE,lineHeight:1.2}}>{currentPos.label}</div>
            </div>
            <div style={{fontSize:'0.78rem',color:WHITE2,lineHeight:1.6}}>{currentPos.detail}</div>
          </div>
          <div style={{display:'flex',gap:'0.45rem'}}>
            {currentPos.optional && (
              <button onClick={()=>goTo(posIdx+1)} style={{flex:1,padding:'0.75rem',background:'rgba(255,255,255,0.05)',border:`1px solid ${BORDER}`,borderRadius:13,color:WHITE2,fontFamily:'monospace',fontSize:'0.75rem',cursor:'pointer'}}>Skip →</button>
            )}
            <button onClick={finishScan} style={{flex:currentPos.optional?1:2,padding:'0.75rem',background:'rgba(250,116,31,0.12)',border:`1px solid rgba(250,116,31,0.3)`,borderRadius:13,color:AMBER,fontFamily:'monospace',fontSize:'0.75rem',fontWeight:600,cursor:'pointer'}}>View Report →</button>
          </div>
        </>}

        {/* ══ READY — in position, tap to start ══ */}
        {stage==='ready' && <>
          <div style={{background:`${indicator.color}11`,borderRadius:14,padding:'0.75rem 1rem',border:`1px solid ${indicator.color}33`}}>
            <div style={{fontSize:'0.72rem',fontFamily:'monospace',color:indicator.color,fontWeight:700,letterSpacing:'0.08em',marginBottom:'0.3rem'}}>STEP {currentPos.step} / 5 — {currentPos.label.toUpperCase()}</div>
            <div style={{fontSize:'0.78rem',color:WHITE2,lineHeight:1.55}}>{currentPos.detail}</div>
          </div>
          <button onClick={handleReady} style={{
            width:'100%',padding:'1.15rem',
            background:`linear-gradient(135deg,${GREEN},#1A7A50)`,
            border:'none',borderRadius:16,color:'#fff',
            fontFamily:'monospace',fontSize:'1rem',fontWeight:900,
            letterSpacing:'0.04em',cursor:'pointer',
            boxShadow:'0 6px 28px rgba(39,169,107,0.5)',
          }}>
            ✓ {currentPos.readyLabel}
          </button>
          <div style={{display:'flex',gap:'0.45rem'}}>
            {currentPos.optional && (
              <button onClick={()=>goTo(posIdx+1)} style={{flex:1,padding:'0.65rem',background:'rgba(255,255,255,0.05)',border:`1px solid ${BORDER}`,borderRadius:12,color:WHITE2,fontFamily:'monospace',fontSize:'0.72rem',cursor:'pointer'}}>Skip →</button>
            )}
            <button onClick={finishScan} style={{flex:1,padding:'0.65rem',background:'rgba(250,116,31,0.12)',border:`1px solid rgba(250,116,31,0.3)`,borderRadius:12,color:AMBER,fontFamily:'monospace',fontSize:'0.72rem',fontWeight:600,cursor:'pointer'}}>View Report →</button>
          </div>
        </>}

        {/* ══ HOLD — camera live, hold-still countdown ══ */}
        {stage==='hold' && <>
          <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
            {/* Countdown ring */}
            <div style={{position:'relative',width:64,height:64,flexShrink:0}}>
              <svg width="64" height="64" style={{transform:'rotate(-90deg)'}}>
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4.5"/>
                <circle cx="32" cy="32" r="26" fill="none" stroke={GREEN} strokeWidth="4.5"
                  strokeDasharray={`${2*Math.PI*26}`}
                  strokeDashoffset={`${2*Math.PI*26*(countdown/currentPos.holdSeconds)}`}
                  strokeLinecap="round" style={{transition:'stroke-dashoffset 0.9s linear'}}/>
              </svg>
              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.4rem',fontWeight:900,color:WHITE,fontFamily:'monospace'}}>{countdown}</div>
            </div>
            <div>
              <div style={{fontSize:'0.88rem',fontWeight:800,color:GREEN,letterSpacing:'0.05em',marginBottom:'0.2rem'}}>HOLD STILL</div>
              <div style={{fontSize:'0.72rem',color:WHITE2,lineHeight:1.4}}>Keep the phone steady — AI will read when ready to capture</div>
            </div>
          </div>
          <button onClick={finishScan} style={{width:'100%',padding:'0.72rem',background:`linear-gradient(135deg,${AMBER},#C4721E)`,border:'none',borderRadius:13,color:'#fff',fontFamily:'monospace',fontSize:'0.82rem',fontWeight:700,cursor:'pointer'}}>View Report →</button>
        </>}

        {/* ══ CAPTURE — hold done, waiting for user to tap ══ */}
        {stage==='capture' && <>
          <div style={{fontSize:'0.78rem',color:WHITE2,lineHeight:1.5}}>
            Phone is steady — tap the button below when you are ready to capture.
          </div>
          <button
            onClick={camWarm ? handleCapture : undefined}
            style={{
              width:'100%',padding:'1.15rem',
              background: camWarm ? `linear-gradient(135deg,${BLUE},#2C6FBF)` : 'rgba(255,255,255,0.07)',
              border: camWarm ? 'none' : `1px solid ${BORDER}`,
              borderRadius:16,
              color: camWarm ? '#fff' : WHITE2,
              fontFamily:'monospace',fontSize:'1rem',fontWeight:900,
              letterSpacing:'0.06em',
              cursor: camWarm ? 'pointer' : 'default',
              boxShadow: camWarm ? '0 6px 28px rgba(74,144,226,0.5)' : 'none',
              transition:'all 0.4s ease',
            }}>
            {camWarm ? `📸 ${currentPos.captureLabel}` : '⏳ Camera focusing…'}
          </button>
          <div style={{display:'flex',gap:'0.45rem'}}>
            <button onClick={()=>{ busyRef.current=false; setCamWarm(false); setStage('hold'); setCountdown(currentPos.holdSeconds); setTimeout(()=>setCamWarm(true),2000) }}
              style={{flex:1,padding:'0.65rem',background:'rgba(255,255,255,0.07)',border:`1px solid ${BORDER}`,borderRadius:12,color:WHITE2,fontFamily:'monospace',fontSize:'0.72rem',cursor:'pointer'}}>
              ↺ Re-steady
            </button>
            <button onClick={finishScan} style={{flex:1,padding:'0.65rem',background:'rgba(250,116,31,0.12)',border:`1px solid rgba(250,116,31,0.3)`,borderRadius:12,color:AMBER,fontFamily:'monospace',fontSize:'0.72rem',fontWeight:600,cursor:'pointer'}}>View Report →</button>
          </div>
        </>}

        {/* ══ ANALYSING — spinner ══ */}
        {stage==='analysing' && <>
          <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
            <div style={{width:40,height:40,borderRadius:'50%',border:'3px solid rgba(242,147,55,0.2)',borderTopColor:AMBER,animation:'spin 0.8s linear infinite',flexShrink:0}}/>
            <div>
              <div style={{fontSize:'0.88rem',color:WHITE,fontWeight:700,marginBottom:'0.15rem'}}>Reading image…</div>
              <div style={{fontSize:'0.7rem',color:WHITE2}}>Measuring {indicator.label}</div>
            </div>
          </div>
          <button onClick={finishScan} style={{width:'100%',padding:'0.72rem',background:'rgba(255,255,255,0.06)',border:`1px solid ${BORDER}`,borderRadius:13,color:WHITE2,fontFamily:'monospace',fontSize:'0.72rem',cursor:'pointer'}}>
            View Report →
          </button>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
        </>}

        {/* ══ RESULT — AI message, wait for user action ══ */}
        {stage==='result' && (() => {
          // Primary captured value for this position
          const capKey   = currentPos.captures[0] as string
          const rawVal   = results[capKey]
          const numVal   = typeof rawVal === 'number' ? rawVal : null
          const dispVal  = adjustVal ?? numVal
          const indColor = indicator.color
          const isMeasured = dispVal !== null

          // Previously confirmed measurements — shown as badges top-right of camera
          const confirmed = Object.entries(results).filter(([k,v]) =>
            !currentPos.captures.includes(k) && typeof v === 'number' && k !== 'riserCount' && k !== 'isResidential'
          ) as [string, number][]

          const capLabels: Record<string,string> = {
            rise:'RISER HEIGHT', run:'TREAD DEPTH', width:'STAIR WIDTH',
            guard:'HANDRAIL', headroom:'HEADROOM', nosing:'NOSING',
          }

          return <>
            {/* ── AR measurement line drawn over camera ── */}
            {isMeasured && (
              <div style={{
                position:'absolute', top:IMAGE_TOP, left:0, right:0, bottom:BOTTOM_PANEL+8,
                zIndex:20, pointerEvents:'none', overflow:'hidden',
              }}>
                {/* Confirmed badges — top right stack */}
                <div style={{position:'absolute',top:8,right:8,display:'flex',flexDirection:'column',gap:'0.3rem',zIndex:25}}>
                  {confirmed.slice(0,4).map(([k,v])=>(
                    <div key={k} style={{
                      background:'rgba(10,28,46,0.88)', backdropFilter:'blur(6px)',
                      borderRadius:8, padding:'0.22rem 0.55rem',
                      border:`1px solid rgba(39,169,107,0.45)`,
                      display:'flex', alignItems:'center', gap:'0.35rem',
                    }}>
                      <span style={{fontSize:'0.55rem',fontFamily:'monospace',fontWeight:700,color:'rgba(39,169,107,0.7)',letterSpacing:'0.06em'}}>{capLabels[k]??k.toUpperCase()}</span>
                      <span style={{fontSize:'0.72rem',fontFamily:'monospace',fontWeight:900,color:'#27A96B'}}>{v}mm</span>
                      <span style={{fontSize:'0.65rem',color:'#27A96B'}}>✓</span>
                    </div>
                  ))}
                </div>

                {/* ── Full AR measurement overlay ── */}
                <ARMeasurementOverlay
                  posId={currentPos.id}
                  color={indColor}
                  valueMm={dispVal ?? 0}
                  label={capLabels[capKey] ?? currentPos.label.toUpperCase()}
                />

                {/* Measured label — bottom centre */}
                <div style={{
                  position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)',
                  background:`rgba(10,28,46,0.88)`, backdropFilter:'blur(6px)',
                  borderRadius:20, padding:'0.25rem 0.9rem',
                  border:`1px solid ${indColor}66`,
                  display:'flex', alignItems:'center', gap:'0.4rem',
                  whiteSpace:'nowrap',
                }}>
                  <div style={{width:7,height:7,borderRadius:'50%',background:indColor,boxShadow:`0 0 5px ${indColor}`}}/>
                  <span style={{fontSize:'0.62rem',fontFamily:'monospace',fontWeight:700,color:indColor,letterSpacing:'0.1em'}}>
                    {capLabels[capKey]??currentPos.label.toUpperCase()} — MEASURED
                  </span>
                </div>
              </div>
            )}

            {/* ── Bottom panel result content ── */}
            {/* Big measurement number + ± adjustment */}
            {isMeasured ? (
              <div style={{display:'flex',flexDirection:'column',gap:'0.35rem'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'0.5rem'}}>
                  {/* − button */}
                  <button onClick={()=>setAdjustVal(v => Math.max(1, (v ?? numVal ?? 0) - 5))}
                    style={{width:52,height:52,borderRadius:'50%',background:'rgba(255,255,255,0.1)',border:`1px solid ${BORDER}`,color:WHITE,fontSize:'1.5rem',fontWeight:300,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    −
                  </button>
                  {/* Big number */}
                  <div style={{flex:1,textAlign:'center'}}>
                    <div style={{display:'flex',alignItems:'baseline',justifyContent:'center',gap:'0.2rem'}}>
                      <span style={{fontSize:'2.6rem',fontWeight:900,color:WHITE,fontFamily:'monospace',lineHeight:1}}>{dispVal}</span>
                      <span style={{fontSize:'1rem',color:WHITE2,fontFamily:'monospace'}}>mm</span>
                    </div>
                    {currentPos.id === 'riser_front' && results.tapeMeasureRead === 1 && (
                      <div style={{ marginTop:'0.3rem', fontSize:'0.6rem', fontFamily:'monospace', color:'#4ade80', letterSpacing:'0.06em' }}>
                        📏 TAPE MEASURE READ DIRECTLY
                      </div>
                    )}
                    {currentPos.id === 'riser_front' && results.tiltCorrected === 1 && results.tapeMeasureRead !== 1 && (
                      <div style={{ marginTop:'0.3rem', fontSize:'0.6rem', fontFamily:'monospace', color:AMBER, letterSpacing:'0.06em' }}>
                        📐 PERSPECTIVE CORRECTED{results.tiltAngleDeg ? ` (~${Math.round(Number(results.tiltAngleDeg))}° tilt)` : ''}
                        {results.rawEstimateMm ? ` · raw ${Math.round(Number(results.rawEstimateMm))}mm` : ''}
                      </div>
                    )}
                    {aiMessage && (
                      <div style={{fontSize:'0.65rem',color:WHITE2,lineHeight:1.4,marginTop:'0.15rem'}}>{aiMessage}</div>
                    )}
                    {/* ── Riser inconsistency warning ── */}
                    {currentPos.id === 'riser_front' && results.riserInconsistent === 1 && (
                      <div style={{
                        marginTop:'0.4rem', padding:'0.4rem 0.65rem',
                        background:'rgba(232,85,85,0.15)', border:'1px solid rgba(232,85,85,0.4)',
                        borderRadius:8, fontSize:'0.62rem', lineHeight:1.5, color:'#ff9999',
                        fontFamily:'monospace',
                      }}>
                        ⚠ RISER INCONSISTENCY DETECTED
                        {results.riserVariationMm != null && ` — ${results.riserVariationMm}mm variation`}
                        {' '}(code limit: 9.5mm). Professional inspection required.
                      </div>
                    )}
                    {currentPos.id === 'riser_front' && results.riserInconsistent === -1 && (
                      <div style={{
                        marginTop:'0.4rem', padding:'0.4rem 0.65rem',
                        background:'rgba(242,147,55,0.12)', border:'1px solid rgba(242,147,55,0.3)',
                        borderRadius:8, fontSize:'0.62rem', lineHeight:1.5, color:AMBER,
                        fontFamily:'monospace',
                      }}>
                        ℹ Only one riser visible — consistency across all risers cannot be confirmed. Professional inspection recommended.
                      </div>
                    )}
                    {adjustVal !== null && (
                      <div style={{fontSize:'0.58rem',color:AMBER,fontFamily:'monospace',marginTop:'0.1rem'}}>ADJUSTED</div>
                    )}
                    {results.scaleRef && (
                      <div style={{fontSize:'0.58rem',color:WHITE2,fontFamily:'monospace',marginTop:'0.2rem',opacity:0.7}}>
                        📐 {String(results.scaleRef)}
                      </div>
                    )}
                  </div>
                  {/* + button */}
                  <button onClick={()=>setAdjustVal(v => (v ?? numVal ?? 0) + 5)}
                    style={{width:52,height:52,borderRadius:'50%',background:'rgba(255,255,255,0.1)',border:`1px solid ${BORDER}`,color:WHITE,fontSize:'1.5rem',fontWeight:300,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    +
                  </button>
                </div>
                {adjustVal !== null && (
                  <div style={{fontSize:'0.6rem',color:'rgba(255,255,255,0.3)',textAlign:'center',fontFamily:'monospace'}}>
                    Adjust with − / + if needed · original: {numVal}mm
                  </div>
                )}
              </div>
            ) : (
              <div style={{fontSize:'0.82rem',fontWeight:600,color:WHITE,textAlign:'center',padding:'0.5rem 0'}}>
                {aiMessage ?? 'Could not read — tap Retry to try again.'}
              </div>
            )}

            {/* Confirm & Next — primary */}
            <button onClick={()=>{
              if (adjustVal !== null && capKey) {
                setResults(prev => {
                  const next = { ...prev, [capKey]: adjustVal }
                  resultsRef.current = next
                  return next
                })
                setAdjustVal(null)
              }
              if (rescanReturnRef.current) { rescanReturnRef.current=false; finishScan() }
              else goTo(posIdx+1)
            }} style={{
              width:'100%', padding:'0.85rem',
              background: isMeasured ? `linear-gradient(135deg,${GREEN},#1A7A50)` : `linear-gradient(135deg,${AMBER},#C4721E)`,
              border:'none', borderRadius:14, color:'#fff',
              fontFamily:'monospace', fontSize:'0.9rem', fontWeight:900,
              cursor:'pointer', letterSpacing:'0.04em',
              boxShadow: isMeasured ? '0 4px 18px rgba(39,169,107,0.45)' : '0 4px 18px rgba(250,116,31,0.35)',
            }}>
              {rescanReturnRef.current ? '← Back to Report' : isMeasured ? '✓ Confirm & Next →' : 'Next Position →'}
            </button>

            {/* Retry / View Report */}
            <div style={{display:'flex',gap:'0.45rem'}}>
              <button onClick={()=>{ setAdjustVal(null); busyRef.current=false; setCamWarm(false); setStage('hold'); setCountdown(currentPos.holdSeconds); setTimeout(()=>setCamWarm(true),2000) }}
                style={{flex:1,padding:'0.65rem',background:'rgba(255,255,255,0.07)',border:`1px solid ${BORDER}`,borderRadius:12,color:WHITE2,fontFamily:'monospace',fontSize:'0.72rem',cursor:'pointer'}}>
                ↺ Retry
              </button>
              <button onClick={()=>{
                if (adjustVal !== null && capKey) {
                  setResults(prev => {
                    const next = { ...prev, [capKey]: adjustVal }
                    resultsRef.current = next
                    return next
                  })
                }
                finishScan()
              }} style={{flex:1,padding:'0.65rem',background:'rgba(250,116,31,0.12)',border:`1px solid rgba(250,116,31,0.3)`,borderRadius:12,color:AMBER,fontFamily:'monospace',fontSize:'0.72rem',fontWeight:600,cursor:'pointer'}}>
                View Report →
              </button>
            </div>
          </>
        })()}


      </div>
    </div>
  )
}
