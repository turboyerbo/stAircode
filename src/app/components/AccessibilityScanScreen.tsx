'use client'
/**
 * AccessibilityScanScreen.tsx — Accessibility Compliance Module
 *
 * Based on OBC 2024 / AODA accessibility requirements:
 *   https://www.ontario.ca/page/accessibility-ontarios-building-code
 *
 * 5 sub-module categories (one active scan at a time):
 *   1. barrier_free_path   — corridor/doorway widths, ramp slopes, turning spaces
 *   2. visual_fire_safety  — visual alarm placement, coverage, strobe visibility
 *   3. washrooms           — turning radius, grab bar heights, counter heights
 *   4. pool_spa_access     — barrier-free approach, deck width, lift presence
 *   5. accessible_seating  — companion seating, aisle clearance, wheelchair space
 *
 * Each category: position → countdown → ready → hold → capture → analysing → result
 * Platform note: photogrammetry (web), LiDAR / raycast (native Android/iOS)
 *
 * Colour token: PURPLE (#7B5EA7) — distinguishes from stair (orange) and foundation (blue)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import MeasurementLineOverlay from './MeasurementLineOverlay'

// ── Palette ────────────────────────────────────────────────────────────────────
const NAVY    = '#0A1C2E'
const PURPLE  = '#7B5EA7'   // Accessibility module accent
const GREEN   = '#27A96B'
const AMBER   = '#FA741F'
const RED     = '#E84545'
const WHITE   = '#E8F4FF'
const WHITE2  = '#93BAD4'
const BORDER  = 'rgba(147,186,212,0.15)'

// ── OBC 2024 dimensional requirements (mm) ────────────────────────────────────
export const OBC_ACCESS = {
  doorClearMin:        860,    // OBC 3.8.1.4 — clear doorway width
  corridorWidthMin:    900,    // OBC 3.8.1.6 — minimum corridor width
  rampWidthMin:        900,    // OBC 3.8.3.3 — ramp clear width
  rampSlopeMaxRatio:   10,     // OBC 3.8.3.1 — 1:10 maximum slope
  landingDepthMin:     1500,   // OBC 3.8.3.5 — level landing depth
  turningRadiusMm:     1500,   // OBC 3.8.1.5 — turning space diameter
  counterHeightMax:    865,    // OBC 3.8.4 — counter/sink max height
  grabBarHeight:       840,    // OBC 3.8.4.7 — grab bar centre height (range 840–920)
  grabBarHeightMax:    920,
  wcAccessClearance:   1500,   // OBC 3.8.4.6 — WC side transfer clearance
  poolDeckWidthMin:    1200,   // OBC 3.8.5 — barrier-free deck zone
  companionSeatGap:    900,    // OBC 3.8.6.3 — companion seat clear width
  wheelchairSpaceW:    900,    // OBC 3.8.6.1 — wheelchair space width
  wheelchairSpaceD:    1400,   // OBC 3.8.6.1 — wheelchair space depth
}

// ── Sub-module categories ─────────────────────────────────────────────────────
export type AccessibilityCategory =
  | 'barrier_free_path'
  | 'visual_fire_safety'
  | 'washrooms'
  | 'pool_spa_access'
  | 'accessible_seating'

export const CATEGORY_META: Record<AccessibilityCategory, {
  label: string; color: string; icon: string; description: string; obcRef: string
}> = {
  barrier_free_path: {
    label:       'Barrier-Free Path',
    color:       PURPLE,
    icon:        'path',
    description: 'Doorway widths, corridor widths, ramp dimensions, turning spaces, power door operators',
    obcRef:      'OBC 2024 §3.8.1 – §3.8.3',
  },
  visual_fire_safety: {
    label:       'Visual Fire Safety',
    color:       RED,
    icon:        'fire',
    description: 'Visual alarm placement, strobe coverage per floor and sleeping area, NFPA 72 compliance',
    obcRef:      'OBC 2024 §3.2.4 / NFPA 72',
  },
  washrooms: {
    label:       'Washrooms',
    color:       '#2196F3',
    icon:        'wash',
    description: 'Turning radius, grab bars, counter heights, doorway width, signage, accessible fixtures',
    obcRef:      'OBC 2024 §3.8.4',
  },
  pool_spa_access: {
    label:       'Pool & Spa Access',
    color:       '#00BCD4',
    icon:        'pool',
    description: 'Barrier-free deck approach, deck width, pool lift presence, ramp to water',
    obcRef:      'OBC 2024 §3.8.5',
  },
  accessible_seating: {
    label:       'Accessible Seating',
    color:       '#FF9800',
    icon:        'seat',
    description: 'Wheelchair spaces, companion seating, aisle clearance, dispersal throughout venue',
    obcRef:      'OBC 2024 §3.8.6',
  },
}

// ── Measurement result types per category ────────────────────────────────────
export interface BarrierFreePathMeasurements {
  doorClearMm:       number | null   // measured clear opening width
  corridorWidthMm:   number | null   // measured corridor/hallway width
  rampWidthMm:       number | null   // ramp clear width (if ramp present)
  rampSlopeRatio:    number | null   // e.g. 12 means 1:12 slope
  landingDepthMm:    number | null   // landing depth at top/bottom of ramp
  turningSpaceMm:    number | null   // turning circle diameter
  hasPowerDoor:      boolean | null  // power door operator observed
  hasTactileIndicator: boolean | null // tactile walking surface indicator
  passesOBC:         boolean | null
  confidence:        number
  notes:             string
}

export interface VisualFireSafetyMeasurements {
  alarmsObserved:    number          // count in frame
  coverageAdequate:  boolean | null  // visible from all positions
  onEveryFloor:      boolean | null
  inSleepingRooms:   boolean | null
  strobeVisible:     boolean | null
  nfpaCompliant:     boolean | null  // visual check only
  confidence:        number
  notes:             string
}

export interface WashroomMeasurements {
  doorClearMm:       number | null   // washroom entry clear width (min 860mm)
  turningSpaceMm:    number | null   // turning radius inside (min 1500mm)
  grabBarPresentSide: boolean | null // side grab bar at WC
  grabBarPresentRear: boolean | null // rear grab bar at WC
  grabBarHeightMm:   number | null   // centre height (840–920mm)
  counterHeightMm:   number | null   // sink/counter height (max 865mm)
  mirrorHeightMm:    number | null   // bottom of mirror (max 1000mm)
  wcClearanceMm:     number | null   // side transfer clear (min 1500mm)
  accessibleSignage: boolean | null
  confidence:        number
  notes:             string
}

export interface PoolSpaAccessMeasurements {
  deckWidthMm:       number | null   // barrier-free deck zone width (min 1200mm)
  barrierFreeApproach: boolean | null // clear path from entrance to pool deck
  poolLiftPresent:   boolean | null  // mechanical lift observed
  accessRampPresent: boolean | null  // ramp into water or to deck
  deckSurface:       string          // 'compliant'|'non_slip'|'hazardous'|'unknown'
  confidence:        number
  notes:             string
}

export interface AccessibleSeatingMeasurements {
  wheelchairSpacesCount: number | null  // total counted
  companionSeatsPresent: boolean | null // paired seating adjacent
  wheelchairSpaceWidthMm: number | null // min 900mm
  wheelchairSpaceDepthMm: number | null // min 1400mm
  aisleWidthMm:          number | null  // min 900mm approach aisle
  dispersedThroughout:   boolean | null // not all clustered in one zone
  mobilityStorageArea:   boolean | null // storage for mobility devices
  confidence:            number
  notes:                 string
}

// Combined result for report
export interface AccessibilityMeasurements {
  category:         AccessibilityCategory
  barrierFreePath:  Partial<BarrierFreePathMeasurements>
  visualFireSafety: Partial<VisualFireSafetyMeasurements>
  washrooms:        Partial<WashroomMeasurements>
  poolSpaAccess:    Partial<PoolSpaAccessMeasurements>
  accessibleSeating: Partial<AccessibleSeatingMeasurements>
  obcRef:           string
  overallPass:      boolean | null
  confidence:       number
  occupancyType:    string
  location:         string
}

// ── Position config type ──────────────────────────────────────────────────────
type Stage = 'category_select' | 'intro' | 'position' | 'ready' | 'hold' | 'capture' | 'analysing' | 'result' | 'review'

interface PosCfg {
  id:           string
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
  aiPrompt:     (prior: Partial<AccessibilityMeasurements>) => string
}

// ── Per-category position configs ─────────────────────────────────────────────
const POSITIONS: Record<AccessibilityCategory, PosCfg[]> = {

  // ── 1. BARRIER-FREE PATH ────────────────────────────────────────────────────
  barrier_free_path: [
    {
      id: 'doorway', step: 1, label: 'Doorway Width', color: PURPLE,
      headline: 'Face the door — full frame visible',
      detail: 'Stand directly in front of the door. Frame the full doorway from floor to top of frame, including both jambs. Include any door hardware. The AI will measure the clear opening width — minimum 860mm required under OBC 3.8.1.4.',
      readyLabel: 'Doorway in frame — Start',
      captureLabel: 'Tap to measure doorway',
      holdSeconds: 5, positionTime: 12, optional: false,
      aiPrompt: (_p) => `You are an accessibility compliance inspector analysing a doorway image under Ontario Building Code 2024, s.3.8.1.4.

MEASURE: Clear doorway opening width (the free space between door stops when door is open, not the rough opening).

SCALE CALIBRATION (use in priority order):
1. Standard door height: 2032mm (80") — most common residential; 2134mm (84") commercial
2. Standard door width: 813mm (32"), 864mm (34"), 914mm (36") — identify from panel proportions
3. Door hardware: lever handle ~120mm length; deadbolt ~25mm diameter
4. Electrical outlet box: 70mm wide × 114mm tall (North America standard)
5. Door hinge: 89mm × 89mm (3.5") standard residential; 102mm × 102mm (4") commercial
6. Human adult: ~1750mm height, shoulder width ~450mm

OBC REQUIREMENT: Minimum 860mm clear opening width (measured from face of door stop to far jamb face when door is fully open 90°).

Assess:
- Clear opening width in mm
- Door type: swing, sliding, power-operated
- Hardware type: lever (compliant) or knob (non-compliant)
- Threshold height (max 13mm for barrier-free)
- Closing device: does the door have a hydraulic closer? (affects accessibility)

Reply ONLY with valid JSON:
{
  "doorClearMm": number|null,
  "doorType": "swing"|"sliding"|"power"|"unknown",
  "hardwareType": "lever"|"knob"|"push_bar"|"unknown",
  "thresholdHeightMm": number|null,
  "passesOBC": true|false|null,
  "confident": true|false,
  "scaleRef": "what you used",
  "message": "one sentence for the inspector"
}`,
    },
    {
      id: 'corridor', step: 2, label: 'Corridor Width', color: PURPLE,
      headline: 'Stand at one end — look down the corridor',
      detail: 'Position yourself at one end of the corridor/hallway and frame the full width. The AI will measure the clear passage width. Minimum 900mm required under OBC 3.8.1.6. Include any protrusions or obstacles.',
      readyLabel: 'Corridor in frame — Start',
      captureLabel: 'Tap to measure corridor',
      holdSeconds: 5, positionTime: 12, optional: false,
      aiPrompt: (_p) => `Measure corridor/hallway clear width under OBC 2024 s.3.8.1.6 (min 900mm barrier-free).

SCALE CALIBRATION:
1. Standard door in corridor: 813–914mm wide, 2032–2134mm tall
2. Electrical outlet: 70mm wide at face plate
3. Baseboard: typically 65–90mm tall
4. Light switch: 86mm × 86mm plate
5. Human shoulder width: ~450mm; wheelchair width: ~660–700mm

MEASURE:
- Clear corridor width in mm (wall face to wall face, excluding baseboards and protrusions)
- Any obstructions (radiators, columns, fire extinguisher cabinets, etc.)
- Passing space: is there a 1500mm × 1500mm passing space every 30m?

Reply ONLY with valid JSON:
{
  "corridorWidthMm": number|null,
  "obstructionsPresent": true|false,
  "obstructionDescription": "brief description if present"|null,
  "passesOBC": true|false|null,
  "confident": true|false,
  "scaleRef": "what you used",
  "message": "one sentence"
}`,
    },
    {
      id: 'turning_space', step: 3, label: 'Turning Space', color: PURPLE,
      headline: 'Capture the full room/space from above-angle',
      detail: 'Position yourself to show as much of the floor area as possible. We need to assess whether a 1500mm × 1500mm turning space (wheelchair turning circle) exists at key points — room entries, dead-ends, and publicly used spaces. OBC 3.8.1.5.',
      readyLabel: 'Space in frame — Start',
      captureLabel: 'Tap to assess turning space',
      holdSeconds: 5, positionTime: 12, optional: true,
      aiPrompt: (_p) => `Assess available turning space for wheelchair users. OBC 2024 s.3.8.1.5 requires a 1500mm × 1500mm clear turning space.

SCALE CALIBRATION:
1. Standard floor tile: 300×300mm or 600×600mm most common
2. Door width in frame: 813–914mm
3. Baseboard: 65–90mm tall
4. Standard furniture: chair seat ~450mm height, table ~720mm height

ASSESS:
- Estimate maximum clear turning circle that fits in this space
- Note obstacles within the space (furniture, columns, equipment)
- Is there clear 1500mm × 1500mm floor area?

Reply ONLY with valid JSON:
{
  "turningSpaceMm": number|null,
  "clearSpaceAdequate": true|false|null,
  "obstructions": "description of obstacles"|null,
  "passesOBC": true|false|null,
  "confident": true|false,
  "scaleRef": "what you used",
  "message": "one sentence"
}`,
    },
    {
      id: 'ramp', step: 4, label: 'Ramp (if present)', color: PURPLE,
      headline: 'Frame the full ramp from side angle',
      detail: 'If a ramp is present, position yourself to the side so the full run and slope are visible. Include any handrails and landing areas. OBC 3.8.3: min 900mm wide, max 1:10 slope, landings min 1500mm deep. Skip if no ramp present.',
      readyLabel: 'Ramp in frame — Start',
      captureLabel: 'Tap to measure ramp',
      holdSeconds: 5, positionTime: 12, optional: true,
      aiPrompt: (_p) => `Assess ramp under OBC 2024 s.3.8.3:
- Min clear width: 900mm
- Max slope: 1:10 (10% or 5.7°)
- Min landing depth at top & bottom: 1500mm
- Handrails required on both sides if ramp > 600mm rise

SCALE CALIBRATION:
1. Step riser height (if mixed stair/ramp): 125–200mm OBC
2. Standard handrail height: 865–965mm
3. Ramp run (horizontal distance) vs rise (vertical) — calculate ratio
4. Landing tile or floor material for scale

MEASURE:
- Ramp width (clear between handrails)
- Slope ratio (estimate rise:run)
- Landing depth at top
- Landing depth at bottom
- Handrails: both sides? yes/no

Reply ONLY with valid JSON:
{
  "rampWidthMm": number|null,
  "slopeRatio": number|null,
  "landingDepthTopMm": number|null,
  "landingDepthBottomMm": number|null,
  "handrailsBothSides": true|false|null,
  "passesOBC": true|false|null,
  "confident": true|false,
  "scaleRef": "what you used",
  "message": "one sentence"
}`,
    },
  ],

  // ── 2. VISUAL FIRE SAFETY ───────────────────────────────────────────────────
  visual_fire_safety: [
    {
      id: 'floor_alarm_overview', step: 1, label: 'Floor Alarm Coverage', color: RED,
      headline: 'Sweep the ceiling — capture all visible alarms',
      detail: 'Pan slowly across the ceiling of the space. The AI will count visible strobe alarms and assess coverage. NFPA 72 requires visual alarms to be visible from all parts of the space and mounted 2000–2400mm from floor. OBC 3.2.4.',
      readyLabel: 'Ceiling in frame — Start',
      captureLabel: 'Tap to document alarms',
      holdSeconds: 5, positionTime: 12, optional: false,
      aiPrompt: (_p) => `Assess visual fire alarm devices under OBC 2024 s.3.2.4 and NFPA 72.

IDENTIFY:
- Count of visual alarm devices (strobes) visible in frame
- Mounting height from floor (should be 2000–2400mm)
- Coverage zone — is this alarm visible from all areas of the space?
- Device condition (damaged, obstructed, missing)

SCALE CALIBRATION:
1. Ceiling tile: 600×600mm or 300×600mm
2. Sprinkler head: ~75mm diameter, flush ~25mm drop
3. Standard light fixture: 300–600mm wide
4. Conduit: 20–25mm diameter

NFPA 72 requirements:
- Max spacing: 15m or per manufacturer specs
- Mounting: 2000–2400mm AFF or within 150–610mm of ceiling
- Candela: 15cd minimum for rooms up to 28m²; higher for larger spaces

Reply ONLY with valid JSON:
{
  "alarmsObservedCount": number,
  "mountingHeightMm": number|null,
  "coverageAdequate": true|false|null,
  "obstructed": true|false,
  "deviceCondition": "good"|"damaged"|"obstructed"|"unknown",
  "passesNFPA": true|false|null,
  "confident": true|false,
  "scaleRef": "what you used",
  "message": "one sentence"
}`,
    },
    {
      id: 'sleeping_room_alarm', step: 2, label: 'Sleeping Room Alarm', color: RED,
      headline: 'Show the bedroom ceiling — alarm position',
      detail: 'In residential buildings, a visual alarm with strobe must be present in every sleeping room. Frame the ceiling of the sleeping area to confirm presence and positioning. OBC 3.2.4 / NFPA 72.',
      readyLabel: 'Sleeping room in frame — Start',
      captureLabel: 'Tap to confirm alarm',
      holdSeconds: 5, positionTime: 12, optional: true,
      aiPrompt: (_p) => `Confirm visual strobe alarm in sleeping room. OBC 3.2.4 requires visual + audible alarms in all sleeping rooms.

CHECK:
- Is a visual alarm (strobe) present in the room?
- Is an audible alarm also present (combined unit or separate)?
- Mounting position: ceiling centre or wall within mounting height range (2000–2400mm)
- Temporal-3 coded strobe pattern (NFPA 72) — visible flash rate if active

Reply ONLY with valid JSON:
{
  "strobePresent": true|false,
  "audiblePresent": true|false,
  "combinedUnit": true|false|null,
  "mountingHeightMm": number|null,
  "passesOBC": true|false|null,
  "confident": true|false,
  "message": "one sentence"
}`,
    },
  ],

  // ── 3. WASHROOMS ────────────────────────────────────────────────────────────
  washrooms: [
    {
      id: 'washroom_entry', step: 1, label: 'Washroom Entry', color: '#2196F3',
      headline: 'Frame the full washroom doorway',
      detail: 'Stand outside the washroom and frame the complete door and frame. The AI will measure the clear opening width (min 860mm OBC 3.8.4) and check door hardware for accessibility compliance.',
      readyLabel: 'Washroom door in frame — Start',
      captureLabel: 'Tap to measure entry',
      holdSeconds: 5, positionTime: 12, optional: false,
      aiPrompt: (_p) => `Measure accessible washroom entry under OBC 2024 s.3.8.4.

MEASURE:
- Clear opening width (min 860mm)
- Door hardware: lever = compliant, knob = non-compliant
- Signage: Is an accessible washroom sign present? (ISA symbol)
- Approach clearance: 300mm clear space on latch side of door (for wheelchair approach)
- Threshold height (max 13mm)

SCALE:
1. Door height: 2032mm standard; 2134mm commercial
2. Door hardware: lever ~120mm long
3. ISA sign: typically 150×150mm

Reply ONLY with valid JSON:
{
  "doorClearMm": number|null,
  "hardwareType": "lever"|"knob"|"automatic"|"unknown",
  "accessibleSignage": true|false|null,
  "latchClearanceMm": number|null,
  "thresholdMm": number|null,
  "passesOBC": true|false|null,
  "confident": true|false,
  "scaleRef": "what you used",
  "message": "one sentence"
}`,
    },
    {
      id: 'washroom_turning', step: 2, label: 'Turning Space', color: '#2196F3',
      headline: 'Frame the washroom floor area — wide angle',
      detail: 'From inside the washroom, capture as much of the floor as possible. We need a 1500mm × 1500mm clear turning circle inside. This is the most commonly failed requirement. OBC 3.8.4.5.',
      readyLabel: 'Floor in frame — Start',
      captureLabel: 'Tap to assess turning space',
      holdSeconds: 5, positionTime: 12, optional: false,
      aiPrompt: (_p) => `Assess turning space in accessible washroom. OBC 2024 s.3.8.4.5 requires 1500mm × 1500mm clear floor space for wheelchair turning.

MEASURE:
- Floor dimensions visible in frame
- Obstacles: toilet, vanity, trash can, baby change, bins
- Clear circular space available

SCALE:
1. Floor tile: 300×300mm or 600×600mm
2. Standard toilet: ~360mm wide, 640–720mm from wall to front
3. Vanity: typically 450–600mm deep
4. Grab bar (if visible): 300–450mm long, 35mm diameter

Reply ONLY with valid JSON:
{
  "turningSpaceMm": number|null,
  "clearSpaceAdequate": true|false|null,
  "obstructionList": "obstacles present"|null,
  "passesOBC": true|false|null,
  "confident": true|false,
  "scaleRef": "what you used",
  "message": "one sentence"
}`,
    },
    {
      id: 'grab_bars', step: 3, label: 'Grab Bars & Fixtures', color: '#2196F3',
      headline: 'Frame the toilet area — include grab bars',
      detail: 'Position yourself to show the toilet, side wall, and rear wall clearly. The AI will check grab bar presence, height (840–920mm centre from floor), and configuration. OBC 3.8.4.7.',
      readyLabel: 'Toilet area in frame — Start',
      captureLabel: 'Tap to assess grab bars',
      holdSeconds: 5, positionTime: 12, optional: false,
      aiPrompt: (_p) => `Assess grab bars and WC fixtures under OBC 2024 s.3.8.4.7.

MEASURE:
- Side grab bar: present? height from floor to bar centre (840–920mm OBC)
- Rear grab bar: present? height from floor to bar centre
- Grab bar length: min 600mm for side, 900mm for rear
- WC side transfer clearance: min 1500mm from centre of WC to side wall (1500mm diameter clearance)
- WC height: 400–450mm seat height standard accessible

SCALE:
1. WC height: ~400mm seat height
2. Toilet paper roll: ~110mm diameter
3. Grab bar diameter: 32–38mm (ASTM)
4. Floor tile: 300×300mm or 600×600mm

Reply ONLY with valid JSON:
{
  "sideGrabBarPresent": true|false,
  "sideGrabBarHeightMm": number|null,
  "rearGrabBarPresent": true|false,
  "rearGrabBarHeightMm": number|null,
  "wcSideTransferClearanceMm": number|null,
  "passesOBC": true|false|null,
  "confident": true|false,
  "scaleRef": "what you used",
  "message": "one sentence"
}`,
    },
    {
      id: 'sink_counter', step: 4, label: 'Sink & Counter', color: '#2196F3',
      headline: 'Frame the sink and counter — full height visible',
      detail: 'Show the sink/counter from the side so the height from floor to counter surface is visible. OBC 3.8.4: max counter height 865mm; knee clearance min 680mm high × 760mm wide underneath. Mirror bottom max 1000mm from floor.',
      readyLabel: 'Counter in frame — Start',
      captureLabel: 'Tap to measure counter',
      holdSeconds: 5, positionTime: 12, optional: true,
      aiPrompt: (_p) => `Measure accessible sink and counter under OBC 2024 s.3.8.4.

MEASURE:
- Counter/sink height from floor to rim (max 865mm)
- Knee clearance height under counter (min 680mm)
- Knee clearance width (min 760mm)
- Mirror bottom height from floor (max 1000mm)
- Faucet type: lever/sensor = compliant; knob = non-compliant
- Soap dispenser height (max 1000mm reach)

SCALE:
1. Standard light switch plate: 86mm × 86mm at ~1200mm AFF
2. Outlet plate: 86mm × 86mm at ~300–400mm AFF
3. Tile grout lines if visible

Reply ONLY with valid JSON:
{
  "counterHeightMm": number|null,
  "kneeHeightMm": number|null,
  "kneeWidthMm": number|null,
  "mirrorHeightMm": number|null,
  "faucetType": "lever"|"sensor"|"knob"|"unknown",
  "passesOBC": true|false|null,
  "confident": true|false,
  "scaleRef": "what you used",
  "message": "one sentence"
}`,
    },
  ],

  // ── 4. POOL & SPA ACCESS ────────────────────────────────────────────────────
  pool_spa_access: [
    {
      id: 'pool_deck_approach', step: 1, label: 'Deck Approach', color: '#00BCD4',
      headline: 'Frame the pool deck entry path',
      detail: 'Show the barrier-free approach path from the changeroom/entrance to the pool deck. Minimum 1200mm clear width required along the accessible route. OBC 3.8.5.',
      readyLabel: 'Pool deck in frame — Start',
      captureLabel: 'Tap to assess approach',
      holdSeconds: 5, positionTime: 12, optional: false,
      aiPrompt: (_p) => `Assess barrier-free pool deck approach under OBC 2024 s.3.8.5.

MEASURE:
- Path width from entrance to pool deck (min 1200mm)
- Surface condition: slip-resistant? drains present?
- Steps or level changes in path (barrier if present without ramp)
- Ramp present if grade change exists?

SCALE:
1. Standard pool lane width: 2500mm
2. Lane rope: 115mm diameter
3. Starting block: ~500mm wide
4. Tile grout: 3–10mm

Reply ONLY with valid JSON:
{
  "deckWidthMm": number|null,
  "surfaceType": "compliant_nonslip"|"hazardous"|"standard"|"unknown",
  "barrierFreeApproach": true|false|null,
  "gradeChangesPresent": true|false,
  "passesOBC": true|false|null,
  "confident": true|false,
  "scaleRef": "what you used",
  "message": "one sentence"
}`,
    },
    {
      id: 'pool_lift', step: 2, label: 'Pool Lift / Access', color: '#00BCD4',
      headline: 'Frame the pool water entry area',
      detail: 'Show the pool edge, any pool lift, ramp into water, or zero-entry area. OBC 3.8.5 requires barrier-free access to and around all public pools. Capture any lifting equipment, steps, or zero-entry features.',
      readyLabel: 'Pool entry in frame — Start',
      captureLabel: 'Tap to document access',
      holdSeconds: 5, positionTime: 12, optional: false,
      aiPrompt: (_p) => `Document pool water access under OBC 2024 s.3.8.5.

IDENTIFY:
- Pool mechanical lift (hydraulic chair lift): present?
- Zero-entry (beach entry / gradual slope into water): present?
- Accessible steps with grab rails?
- Ramp into water?
- Any of these features accessible from barrier-free deck path?

Reply ONLY with valid JSON:
{
  "poolLiftPresent": true|false,
  "zeroEntryPresent": true|false,
  "accessibleStepsPresent": true|false,
  "waterRampPresent": true|false,
  "accessibleFromBarrierFreePath": true|false|null,
  "passesOBC": true|false|null,
  "confident": true|false,
  "message": "one sentence"
}`,
    },
  ],

  // ── 5. ACCESSIBLE SEATING ───────────────────────────────────────────────────
  accessible_seating: [
    {
      id: 'wheelchair_spaces', step: 1, label: 'Wheelchair Spaces', color: '#FF9800',
      headline: 'Frame dedicated wheelchair seating areas',
      detail: 'Show the designated wheelchair seating zones. Each space must be minimum 900mm wide × 1400mm deep with a companion seat immediately adjacent. OBC 3.8.6.1.',
      readyLabel: 'Seating area in frame — Start',
      captureLabel: 'Tap to assess spaces',
      holdSeconds: 5, positionTime: 12, optional: false,
      aiPrompt: (_p) => `Assess wheelchair seating spaces under OBC 2024 s.3.8.6.

MEASURE:
- Count of dedicated wheelchair spaces visible
- Width of each space (min 900mm)
- Depth of each space (min 1400mm)
- Companion seats: adjacent to each wheelchair space?
- Approach aisle: min 900mm wide leading to spaces?
- ISA symbols / accessible seating signage?
- Distribution: spaces in multiple viewing areas (not all clustered)?

SCALE:
1. Standard seat width: 450–500mm
2. Standard seat depth: 350–400mm
3. Aisle width between rows: typically 400–600mm (accessible requires 900mm)

Reply ONLY with valid JSON:
{
  "wheelchairSpacesCount": number|null,
  "spaceWidthMm": number|null,
  "spaceDepthMm": number|null,
  "companionSeatsPresent": true|false,
  "aisleWidthMm": number|null,
  "accessibleSignage": true|false,
  "dispersedThroughout": true|false|null,
  "passesOBC": true|false|null,
  "confident": true|false,
  "scaleRef": "what you used",
  "message": "one sentence"
}`,
    },
    {
      id: 'mobility_storage', step: 2, label: 'Mobility Device Storage', color: '#FF9800',
      headline: 'Capture mobility storage and aisle approach',
      detail: 'OBC 3.8.6.3 requires storage space for wheelchairs and other mobility assistive devices. Frame the area around accessible seating including any storage zones and the approach aisle.',
      readyLabel: 'Storage area in frame — Start',
      captureLabel: 'Tap to document storage',
      holdSeconds: 5, positionTime: 12, optional: true,
      aiPrompt: (_p) => `Assess mobility device storage under OBC 2024 s.3.8.6.3.

ASSESS:
- Dedicated mobility storage space present (for wheelchairs, scooters, walkers)?
- Storage area dimensions: width × depth in mm
- Clear path to storage from main accessible route?
- Storage unobstructed and identifiable?

Reply ONLY with valid JSON:
{
  "mobilityStoragePresent": true|false,
  "storageAreaMm": number|null,
  "clearPathToStorage": true|false|null,
  "passesOBC": true|false|null,
  "confident": true|false,
  "message": "one sentence"
}`,
    },
  ],
}

// ── SVG Category Icons (inline — no image file deps) ─────────────────────────
function CategoryIcon({ cat, size = 28, active = false }: { cat: AccessibilityCategory; size?: number; active?: boolean }) {
  const col = active ? CATEGORY_META[cat].color : WHITE2
  const icons: Record<AccessibilityCategory, React.ReactNode> = {
    barrier_free_path: (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="6" r="3" stroke={col} strokeWidth="1.8"/>
        <path d="M14 9v6l-4 4M14 15l4 4" stroke={col} strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="8" y1="28" x2="8" y2="18" stroke={col} strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="20" y1="28" x2="20" y2="18" stroke={col} strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M2 20h6M20 20h6" stroke={col} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    visual_fire_safety: (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <rect x="5" y="4" width="18" height="14" rx="2" stroke={col} strokeWidth="1.8"/>
        <path d="M14 18v4" stroke={col} strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="9" y1="22" x2="19" y2="22" stroke={col} strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="14" cy="11" r="3" stroke={col} strokeWidth="1.5"/>
        {[0,60,120,180,240,300].map(a => (
          <line key={a}
            x1={14 + Math.cos(a*Math.PI/180)*5.5} y1={11 + Math.sin(a*Math.PI/180)*5.5}
            x2={14 + Math.cos(a*Math.PI/180)*7.5} y2={11 + Math.sin(a*Math.PI/180)*7.5}
            stroke={col} strokeWidth="1.2" strokeLinecap="round"/>
        ))}
      </svg>
    ),
    washrooms: (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <rect x="5" y="10" width="18" height="14" rx="1.5" stroke={col} strokeWidth="1.8"/>
        <path d="M10 10V8a4 4 0 018 0v2" stroke={col} strokeWidth="1.8"/>
        <line x1="5" y1="17" x2="23" y2="17" stroke={col} strokeWidth="1.2"/>
        <line x1="14" y1="14" x2="14" y2="20" stroke={col} strokeWidth="1.2"/>
        <circle cx="14" cy="17" r="1.5" fill={col}/>
      </svg>
    ),
    pool_spa_access: (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <path d="M4 20 Q7 16 10 20 Q13 24 16 20 Q19 16 22 20 Q25 24 28 20" stroke={col} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <circle cx="14" cy="8" r="3" stroke={col} strokeWidth="1.8"/>
        <path d="M14 11v4l-3 3" stroke={col} strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M14 15l3 3" stroke={col} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    accessible_seating: (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <rect x="4" y="8" width="20" height="12" rx="2" stroke={col} strokeWidth="1.8"/>
        <rect x="4" y="20" width="20" height="4" rx="1" stroke={col} strokeWidth="1.5"/>
        <line x1="10" y1="8" x2="10" y2="20" stroke={col} strokeWidth="1.2"/>
        <line x1="18" y1="8" x2="18" y2="20" stroke={col} strokeWidth="1.2"/>
        <circle cx="7" cy="12" r="2" fill={col} fillOpacity="0.7"/>
        <rect x="14" y="10" width="6" height="5" rx="0.5" stroke={col} strokeWidth="1.2"/>
      </svg>
    ),
  }
  return <>{icons[cat]}</>
}

// ── Position illustration SVGs ────────────────────────────────────────────────
function PositionIllustration({ posId, color }: { posId: string; color: string }) {
  const svgs: Record<string, React.ReactNode> = {
    doorway: (
      <svg width="100%" height="160" viewBox="0 0 320 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="320" height="160" fill="#0A1C2E"/>
        <rect x="90" y="10" width="140" height="130" rx="2" fill="rgba(123,94,167,0.12)" stroke="rgba(123,94,167,0.5)" strokeWidth="2"/>
        <rect x="90" y="10" width="140" height="5" fill={color} opacity="0.6"/>
        <line x1="90" y1="80" x2="230" y2="80" stroke={color} strokeWidth="2.5"/>
        <path d="M95 74 L85 80 L95 86" fill={color}/>
        <path d="M225 74 L235 80 L225 86" fill={color}/>
        <text x="160" y="76" textAnchor="middle" fontSize="10" fill={color} fontFamily="monospace" fontWeight="700">CLEAR WIDTH</text>
        <text x="160" y="148" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)" fontFamily="monospace">MIN 860mm — OBC 3.8.1.4</text>
        <circle cx="155" cy="60" r="5" fill="rgba(123,94,167,0.3)" stroke={color} strokeWidth="1.5"/>
        <text x="162" y="63" fontSize="7" fill={color} fontFamily="monospace">LEVER HANDLE</text>
      </svg>
    ),
    corridor: (
      <svg width="100%" height="160" viewBox="0 0 320 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="320" height="160" fill="#0A1C2E"/>
        <rect x="70" y="10" width="180" height="140" fill="rgba(123,94,167,0.08)"/>
        <line x1="70" y1="10" x2="70" y2="150" stroke="rgba(123,94,167,0.5)" strokeWidth="3"/>
        <line x1="250" y1="10" x2="250" y2="150" stroke="rgba(123,94,167,0.5)" strokeWidth="3"/>
        <line x1="70" y1="80" x2="250" y2="80" stroke={color} strokeWidth="2.5"/>
        <path d="M76 74 L64 80 L76 86" fill={color}/>
        <path d="M244 74 L256 80 L244 86" fill={color}/>
        <text x="160" y="76" textAnchor="middle" fontSize="9" fill={color} fontFamily="monospace" fontWeight="700">CORRIDOR WIDTH</text>
        <rect x="100" y="50" width="40" height="8" rx="1" fill="rgba(255,255,255,0.15)"/>
        <text x="120" y="57" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.5)" fontFamily="monospace">WHEELCHAIR</text>
        <text x="160" y="148" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)" fontFamily="monospace">MIN 900mm — OBC 3.8.1.6</text>
      </svg>
    ),
    floor_alarm_overview: (
      <svg width="100%" height="160" viewBox="0 0 320 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="320" height="160" fill="#0A1C2E"/>
        <rect x="10" y="10" width="300" height="30" fill="rgba(232,69,69,0.08)" stroke="rgba(232,69,69,0.3)" strokeWidth="1"/>
        <text x="160" y="28" textAnchor="middle" fontSize="8" fill="rgba(232,69,69,0.6)" fontFamily="monospace">CEILING</text>
        {[70, 160, 250].map(x => (
          <g key={x}>
            <rect x={x-15} y="40" width="30" height="20" rx="3" fill="rgba(232,69,69,0.15)" stroke={RED} strokeWidth="1.5"/>
            <text x={x} y="54" textAnchor="middle" fontSize="8" fill={RED} fontFamily="monospace">!</text>
            <line x1={x} y1="60" x2={x} y2="80" stroke="rgba(232,69,69,0.3)" strokeWidth="1" strokeDasharray="3,2"/>
          </g>
        ))}
        <text x="160" y="110" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.7)" fontFamily="monospace">STROBE COVERAGE</text>
        <text x="160" y="148" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)" fontFamily="monospace">OBC 3.2.4 / NFPA 72</text>
      </svg>
    ),
    washroom_entry: (
      <svg width="100%" height="160" viewBox="0 0 320 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="320" height="160" fill="#0A1C2E"/>
        <rect x="100" y="20" width="120" height="120" rx="2" fill="rgba(33,150,243,0.1)" stroke="rgba(33,150,243,0.4)" strokeWidth="2"/>
        <circle cx="50" cy="80" r="30" stroke="rgba(33,150,243,0.3)" strokeWidth="1.5" strokeDasharray="4,3"/>
        <circle cx="50" cy="80" r="20" stroke="rgba(33,150,243,0.5)" strokeWidth="1.5" strokeDasharray="4,3"/>
        <text x="50" y="117" textAnchor="middle" fontSize="7" fill="rgba(33,150,243,0.7)" fontFamily="monospace">APPROACH</text>
        <line x1="100" y1="80" x2="220" y2="80" stroke="#2196F3" strokeWidth="2.5"/>
        <path d="M106 74 L94 80 L106 86" fill="#2196F3"/>
        <path d="M214 74 L226 80 L214 86" fill="#2196F3"/>
        <text x="160" y="148" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)" fontFamily="monospace">MIN 860mm — OBC 3.8.4</text>
      </svg>
    ),
    grab_bars: (
      <svg width="100%" height="160" viewBox="0 0 320 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="320" height="160" fill="#0A1C2E"/>
        <rect x="60" y="40" width="60" height="100" rx="3" fill="rgba(33,150,243,0.1)" stroke="rgba(33,150,243,0.3)" strokeWidth="1.5"/>
        <text x="90" y="95" textAnchor="middle" fontSize="9" fill="rgba(33,150,243,0.6)" fontFamily="monospace">WC</text>
        <line x1="120" y1="75" x2="200" y2="75" stroke="#2196F3" strokeWidth="4" strokeLinecap="round"/>
        <text x="160" y="68" textAnchor="middle" fontSize="7" fill="#2196F3" fontFamily="monospace">SIDE GRAB BAR</text>
        <line x1="60" y1="105" x2="130" y2="105" stroke="#2196F3" strokeWidth="4" strokeLinecap="round"/>
        <text x="95" y="120" textAnchor="middle" fontSize="7" fill="#2196F3" fontFamily="monospace">REAR</text>
        <line x1="235" y1="40" x2="235" y2="140" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
        <line x1="225" y1="75" x2="245" y2="75" stroke="#2196F3" strokeWidth="1.5"/>
        <text x="260" y="78" fontSize="7" fill="#2196F3" fontFamily="monospace">840-920mm</text>
        <text x="160" y="148" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)" fontFamily="monospace">OBC 3.8.4.7</text>
      </svg>
    ),
    pool_deck_approach: (
      <svg width="100%" height="160" viewBox="0 0 320 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="320" height="160" fill="#0A1C2E"/>
        <rect x="10" y="100" width="300" height="50" rx="2" fill="rgba(0,188,212,0.15)" stroke="rgba(0,188,212,0.4)" strokeWidth="1.5"/>
        <text x="160" y="130" textAnchor="middle" fontSize="10" fill="rgba(0,188,212,0.6)" fontFamily="monospace">POOL</text>
        <line x1="60" y1="100" x2="260" y2="100" stroke="#00BCD4" strokeWidth="2"/>
        <line x1="60" y1="10" x2="60" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
        <line x1="260" y1="10" x2="260" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
        <line x1="60" y1="55" x2="260" y2="55" stroke="#00BCD4" strokeWidth="2.5"/>
        <path d="M66 49 L54 55 L66 61" fill="#00BCD4"/>
        <path d="M254 49 L266 55 L254 61" fill="#00BCD4"/>
        <text x="160" y="52" textAnchor="middle" fontSize="9" fill="#00BCD4" fontFamily="monospace" fontWeight="700">DECK WIDTH</text>
        <text x="160" y="148" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)" fontFamily="monospace">MIN 1200mm — OBC 3.8.5</text>
      </svg>
    ),
    wheelchair_spaces: (
      <svg width="100%" height="160" viewBox="0 0 320 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="320" height="160" fill="#0A1C2E"/>
        <rect x="40" y="30" width="60" height="90" rx="2" fill="rgba(255,152,0,0.12)" stroke="#FF9800" strokeWidth="2"/>
        <circle cx="70" cy="50" r="8" fill="rgba(255,152,0,0.3)" stroke="#FF9800" strokeWidth="1.5"/>
        <text x="70" y="88" textAnchor="middle" fontSize="8" fill="#FF9800" fontFamily="monospace">WC</text>
        <text x="70" y="100" textAnchor="middle" fontSize="7" fill="rgba(255,152,0,0.6)" fontFamily="monospace">SPACE</text>
        <rect x="100" y="30" width="50" height="90" rx="2" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
        <text x="125" y="80" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.5)" fontFamily="monospace">COMPANION</text>
        <line x1="40" y1="30" x2="40" y2="120" stroke="#FF9800" strokeWidth="1.5"/>
        <line x1="100" y1="30" x2="100" y2="120" stroke="#FF9800" strokeWidth="1.5"/>
        <text x="70" y="148" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)" fontFamily="monospace">MIN 900×1400mm — OBC 3.8.6</text>
      </svg>
    ),
  }

  const defaultSvg = (
    <svg width="100%" height="160" viewBox="0 0 320 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="320" height="160" fill="#0A1C2E"/>
      <text x="160" y="85" textAnchor="middle" fontSize="12" fill={color} fontFamily="monospace" fontWeight="700">{posId.replace(/_/g,' ').toUpperCase()}</text>
    </svg>
  )

  return (
    <div style={{ width: '100%', borderRadius: 10, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
      {svgs[posId] ?? defaultSvg}
    </div>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  onSuccess: (m: AccessibilityMeasurements) => void
  onBack:    () => void
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AccessibilityScanScreen({ onSuccess, onBack }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const captureRef = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const busyRef    = useRef(false)
  const capturedFrames = useRef<Record<string, string>>({})

  const [category,    setCategory]    = useState<AccessibilityCategory | null>(null)
  const [positions,   setPositions]   = useState<PosCfg[]>([])
  const [posIdx,      setPosIdx]      = useState(0)
  const [stage,       setStage]       = useState<Stage>('category_select')
  const [countdown,   setCountdown]   = useState(0)
  const [camReady,    setCamReady]    = useState(false)
  const [camWarm,     setCamWarm]     = useState(false)
  const [camError,    setCamError]    = useState(false)
  const [aiMessage,   setAiMessage]   = useState<string | null>(null)
  const [results,     setResults]     = useState<Partial<AccessibilityMeasurements>>({})
  const resultsRef    = useRef<Partial<AccessibilityMeasurements>>({})
  const [showBackMenu,      setShowBackMenu]      = useState(false)
  const [showMeasureLine,   setShowMeasureLine]   = useState(false)
  const [measureLineValue,  setMeasureLineValue]  = useState<string | null>(null)
  const [measureLineLabel,  setMeasureLineLabel]  = useState('MEASURING')
  const [measureLineAxis,   setMeasureLineAxis]   = useState<'horizontal'|'vertical'>('horizontal')

  const currentPos = positions[posIdx] ?? positions[0]
  const progressPct = positions.length ? (posIdx / positions.length) * 100 : 0
  const IMAGE_TOP    = 88
  const BOTTOM_PANEL = 240

  // ── Camera init ───────────────────────────────────────────────────────────
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
      for (const c of constraints) {
        try { stream = await navigator.mediaDevices.getUserMedia(c); break }
        catch (e: any) { if (e?.name === 'NotReadableError' && attempt < 3) return startCamera(attempt + 1); continue }
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

  // ── Re-attach stream ───────────────────────────────────────────────────────
  useEffect(() => {
    if (['hold','capture','analysing','result'].includes(stage)) {
      const v = videoRef.current
      if (v && streamRef.current && !v.srcObject) { v.srcObject = streamRef.current; v.muted = true; v.play().catch(() => {}) }
    }
  }, [stage])

  // ── Select category ────────────────────────────────────────────────────────
  function selectCategory(cat: AccessibilityCategory) {
    setCategory(cat)
    setPositions(POSITIONS[cat])
    setPosIdx(0)
    busyRef.current = false
    resultsRef.current = { category: cat }
    setResults({ category: cat })
    setStage('position')
    setCountdown(POSITIONS[cat][0].positionTime)
  }

  // ── Capture helpers ────────────────────────────────────────────────────────
  function captureB64(scale = 1.0): string | null {
    const v = videoRef.current, c = captureRef.current
    if (!v || !c) return null
    if (streamRef.current && !v.srcObject) { v.srcObject = streamRef.current; v.muted = true; v.play().catch(() => {}) }
    if (v.videoWidth === 0 || v.videoHeight === 0 || v.readyState < 2) return null
    const MAX   = 1600
    const ratio = Math.min(1, MAX / Math.max(v.videoWidth, v.videoHeight)) * scale
    c.width  = Math.round(v.videoWidth  * ratio)
    c.height = Math.round(v.videoHeight * ratio)
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(v, 0, 0, c.width, c.height)
    const probe = ctx.getImageData(c.width >> 1, c.height >> 1, 4, 4).data
    if (Array.from(probe).every((_, i) => i % 4 === 3 || probe[i] < 8)) return null
    return c.toDataURL('image/jpeg', 0.88).split(',')[1]
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goTo = useCallback((idx: number) => {
    if (idx >= positions.length) { finishScan(); return }
    busyRef.current = false
    setPosIdx(idx); setAiMessage(null); setStage('position')
    setCountdown(positions[idx].positionTime)
    setShowMeasureLine(false); setMeasureLineValue(null)
  }, [positions]) // eslint-disable-line

  // ── Stage: position countdown ──────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'position') return
    if (countdown <= 0) { setStage('ready'); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [stage, countdown])

  // ── Stage: hold countdown ──────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'hold' || !currentPos) return
    if (countdown <= 0) { setStage('capture'); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [stage, countdown, currentPos])

  function handleReady() { setCamWarm(false); setStage('hold'); setCountdown(currentPos.holdSeconds); setTimeout(() => setCamWarm(true), 2000) }

  // ── Stage: capture ─────────────────────────────────────────────────────────
  function handleCapture() {
    const b64 = captureB64(1.0)
    if (b64 && currentPos) {
      capturedFrames.current[currentPos.id] = b64
      try {
        const ex = JSON.parse(sessionStorage.getItem('sc_frames_accessibility') || '{}')
        ex[currentPos.id] = b64
        sessionStorage.setItem('sc_frames_accessibility', JSON.stringify(ex))
      } catch {}
    }
    busyRef.current = false; setStage('analysing')
  }

  // ── Stage: analysing ───────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'analysing' || busyRef.current || !currentPos) return
    busyRef.current = true

    async function run() {
      let b64: string | null = null
      for (let i = 0; i < 6; i++) { b64 = captureB64(); if (b64) break; await new Promise(r => setTimeout(r, 250)) }
      if (!b64) { busyRef.current = false; setStage('capture'); return }

      const prompt = currentPos.aiPrompt(resultsRef.current)
      let raw: string | null = null
      try {
        const ctrl = new AbortController()
        const t    = setTimeout(() => ctrl.abort(), 20000)
        const r = await fetch('/api/vision', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageB64: b64, prompt }), signal: ctrl.signal,
        })
        clearTimeout(t)
        if (r.ok) { const d = await r.json(); raw = d.text ?? null }
      } catch {}
      busyRef.current = false

      let parsed: any = null
      try {
        const m = (raw ?? '').replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/)
        if (m) parsed = JSON.parse(m[0])
      } catch {}

      if (parsed) {
        // Merge into results by category
        setResults(prev => {
          const next = { ...prev }
          if (!next.barrierFreePath)  next.barrierFreePath  = {}
          if (!next.visualFireSafety) next.visualFireSafety = {}
          if (!next.washrooms)        next.washrooms        = {}
          if (!next.poolSpaAccess)    next.poolSpaAccess    = {}
          if (!next.accessibleSeating) next.accessibleSeating = {}

          // Assign parsed to the active sub-object
          const catKey: Record<AccessibilityCategory, keyof typeof next> = {
            barrier_free_path:  'barrierFreePath',
            visual_fire_safety: 'visualFireSafety',
            washrooms:          'washrooms',
            pool_spa_access:    'poolSpaAccess',
            accessible_seating: 'accessibleSeating',
          }
          if (category) {
            const key = catKey[category]
            ;(next as any)[key] = { ...((next as any)[key] ?? {}), ...parsed }
          }

          // Derive overall pass
          const passes = [
            parsed.passesOBC, parsed.passesNFPA, parsed.passesOBC,
          ].filter((v: any) => v !== undefined && v !== null)
          if (passes.length > 0) next.overallPass = passes.every(Boolean)
          next.confidence = parsed.confident ? 0.85 : 0.60

          resultsRef.current = next
          return next
        })
        setAiMessage(parsed.message ?? null)

        // Measurement line for numeric results
        const numericMap: Record<string, { label: string; axis: 'horizontal'|'vertical' }> = {
          doorClearMm:    { label: 'DOOR WIDTH',      axis: 'horizontal' },
          corridorWidthMm: { label: 'CORRIDOR WIDTH',  axis: 'horizontal' },
          turningSpaceMm:  { label: 'TURNING SPACE',   axis: 'horizontal' },
          rampWidthMm:     { label: 'RAMP WIDTH',      axis: 'horizontal' },
          deckWidthMm:     { label: 'DECK WIDTH',      axis: 'horizontal' },
          counterHeightMm: { label: 'COUNTER HEIGHT',  axis: 'vertical'   },
          grabBarHeightMm: { label: 'GRAB BAR HEIGHT', axis: 'vertical'   },
        }
        for (const [key, info] of Object.entries(numericMap)) {
          if (parsed[key]) {
            setMeasureLineLabel(info.label)
            setMeasureLineAxis(info.axis)
            setMeasureLineValue(`${Math.round(parsed[key])}mm`)
            setShowMeasureLine(true)
            break
          }
        }
      } else {
        setAiMessage('Could not read the image clearly — tap Retry.')
      }
      setStage('result')
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // ── Finish scan ────────────────────────────────────────────────────────────
  function finishScan() {
    const final: AccessibilityMeasurements = {
      category:         category!,
      barrierFreePath:  resultsRef.current.barrierFreePath  ?? {},
      visualFireSafety: resultsRef.current.visualFireSafety ?? {},
      washrooms:        resultsRef.current.washrooms        ?? {},
      poolSpaAccess:    resultsRef.current.poolSpaAccess    ?? {},
      accessibleSeating: resultsRef.current.accessibleSeating ?? {},
      obcRef:           CATEGORY_META[category!].obcRef,
      overallPass:      resultsRef.current.overallPass ?? null,
      confidence:       resultsRef.current.confidence  ?? 0.7,
      occupancyType:    'unknown',
      location:         '',
    }
    try {
      const frames = { ...capturedFrames.current }
      sessionStorage.setItem('sc_frames_accessibility', JSON.stringify(frames))
    } catch {}
    onSuccess(final)
  }

  // ── Camera error ──────────────────────────────────────────────────────────
  if (camError) return (
    <div style={{ position:'fixed', inset:0, background:NAVY, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', padding:'2rem' }}>
      <p style={{ color:WHITE, textAlign:'center' }}>Camera access is required to scan for accessibility compliance.</p>
      <button onClick={onBack} style={{ padding:'0.8rem 2rem', background:AMBER, border:'none', borderRadius:12, color:'#fff', fontWeight:700, cursor:'pointer' }}>Back</button>
    </div>
  )

  // ── Category selector ──────────────────────────────────────────────────────
  if (stage === 'category_select') {
    return (
      <div style={{ position:'fixed', inset:0, background:NAVY, overflowY:'auto', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
        <div style={{ padding:'max(env(safe-area-inset-top,0px),1.5rem) 1.25rem 3rem' }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:WHITE2, fontSize:'0.85rem', cursor:'pointer', fontFamily:'monospace', padding:'0 0 0.5rem' }}>← Exit</button>

          {/* Header */}
          <div style={{ marginBottom:'1.5rem' }}>
            <div style={{ fontSize:'0.6rem', fontFamily:'monospace', color:PURPLE, fontWeight:700, letterSpacing:'0.14em', marginBottom:'0.4rem' }}>ACCESSIBILITY MODULE · OBC 2024 / AODA</div>
            <h1 style={{ fontSize:'1.5rem', fontWeight:900, color:WHITE, letterSpacing:'-0.03em', lineHeight:1.1, margin:'0 0 0.5rem' }}>Select Inspection<br/>Category</h1>
            <p style={{ fontSize:'0.78rem', color:WHITE2, lineHeight:1.6, margin:0 }}>Choose the accessibility category you want to inspect. Each category guides you through the required measurements and generates a cited compliance report.</p>
          </div>

          {/* Category cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
            {(Object.keys(CATEGORY_META) as AccessibilityCategory[]).map(cat => {
              const meta = CATEGORY_META[cat]
              return (
                <button key={cat} onClick={() => selectCategory(cat)}
                  style={{ width:'100%', padding:'1rem 1.1rem', background:'rgba(255,255,255,0.04)', border:`1.5px solid rgba(255,255,255,0.1)`, borderRadius:14, display:'flex', alignItems:'center', gap:'0.9rem', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = meta.color + '88')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                >
                  <div style={{ width:44, height:44, borderRadius:12, background:`${meta.color}18`, border:`1.5px solid ${meta.color}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <CategoryIcon cat={cat} size={24} active />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'0.88rem', fontWeight:800, color:WHITE, marginBottom:'0.15rem' }}>{meta.label}</div>
                    <div style={{ fontSize:'0.68rem', color:WHITE2, lineHeight:1.4 }}>{meta.description}</div>
                  </div>
                  <div style={{ fontSize:'0.6rem', fontFamily:'monospace', fontWeight:700, color:meta.color, background:`${meta.color}18`, padding:'0.15rem 0.5rem', borderRadius:6, border:`1px solid ${meta.color}33`, flexShrink:0 }}>
                    {meta.obcRef.split(' ')[0]}
                  </div>
                </button>
              )
            })}
          </div>

          <p style={{ fontSize:'0.65rem', color:'rgba(147,186,212,0.45)', textAlign:'center', marginTop:'1.5rem', lineHeight:1.55, fontFamily:'monospace' }}>
            Each category can be scanned independently.<br/>Reports can be combined into a full compliance package.
          </p>
        </div>
      </div>
    )
  }

  // ── Main scan UI ───────────────────────────────────────────────────────────
  if (!currentPos || !category) return null
  const col = currentPos.color

  return (
    <div style={{ position:'fixed', inset:0, background:'#000', overflow:'hidden', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <video ref={videoRef} autoPlay playsInline muted
        // @ts-ignore
        webkit-playsinline="true"
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:1 }} />
      <canvas ref={captureRef} style={{ display:'none' }} />

      <MeasurementLineOverlay
        isActive={showMeasureLine && stage === 'result'}
        measurement={measureLineValue}
        label={measureLineLabel}
        axis={measureLineAxis}
        onComplete={() => setShowMeasureLine(false)}
        sweepDuration={1600}
      />

      {/* ── TOP BAR ── */}
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:50, paddingTop:'max(env(safe-area-inset-top,0px),1.5rem)', paddingBottom:'0.6rem', paddingLeft:'1rem', paddingRight:'1rem', background:'linear-gradient(to bottom,rgba(10,28,46,0.95),rgba(10,28,46,0.6))', display:'flex', alignItems:'center', gap:'0.75rem', height:IMAGE_TOP, boxSizing:'border-box' as const }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          <button onClick={() => setShowBackMenu(v => !v)} style={{ width:34, height:34, borderRadius:'50%', background:'rgba(0,0,0,0.5)', border:`1px solid ${BORDER}`, color:WHITE, fontSize:'1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>←</button>
          {showBackMenu && (
            <div style={{ position:'absolute', top:40, left:0, background:'rgba(10,28,46,0.97)', backdropFilter:'blur(12px)', border:`1px solid ${BORDER}`, borderRadius:14, padding:'0.4rem', zIndex:200, display:'flex', flexDirection:'column', gap:'0.25rem', minWidth:180, boxShadow:'0 8px 32px rgba(0,0,0,0.6)' }}>
              <button onClick={() => { setShowBackMenu(false); if (posIdx > 0) goTo(posIdx - 1) }} style={{ padding:'0.65rem 0.9rem', background:'transparent', border:'none', borderRadius:10, color:WHITE, fontSize:'0.82rem', fontWeight:600, cursor:'pointer', textAlign:'left' as const }}>← Back one step</button>
              <button onClick={() => { setShowBackMenu(false); setStage('category_select') }} style={{ padding:'0.65rem 0.9rem', background:'transparent', border:'none', borderRadius:10, color:WHITE2, fontSize:'0.82rem', fontWeight:600, cursor:'pointer', textAlign:'left' as const }}>Change Category</button>
              <button onClick={() => { setShowBackMenu(false); finishScan() }} style={{ padding:'0.65rem 0.9rem', background:'transparent', border:'none', borderRadius:10, color:GREEN, fontSize:'0.82rem', fontWeight:600, cursor:'pointer', textAlign:'left' as const }}>View Report →</button>
              <div style={{ height:1, background:BORDER, margin:'0.15rem 0' }} />
              <button onClick={() => { setShowBackMenu(false); onBack() }} style={{ padding:'0.65rem 0.9rem', background:'transparent', border:'none', borderRadius:10, color:'rgba(255,100,100,0.85)', fontSize:'0.82rem', fontWeight:600, cursor:'pointer', textAlign:'left' as const }}>Exit</button>
              <button onClick={() => setShowBackMenu(false)} style={{ padding:'0.5rem 0.9rem', background:'transparent', border:'none', borderRadius:10, color:WHITE2, fontSize:'0.72rem', cursor:'pointer', textAlign:'center' as const }}>Cancel</button>
            </div>
          )}
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'0.25rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'0.6rem', fontFamily:'monospace', letterSpacing:'0.1em', color:WHITE2 }}>STEP {currentPos.step} / {positions.length}</span>
            <span style={{ fontSize:'0.72rem', fontWeight:700, color:WHITE }}>{currentPos.label}</span>
          </div>
          <div style={{ height:3, background:'rgba(255,255,255,0.1)', borderRadius:2, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${progressPct}%`, background:`linear-gradient(90deg,${col},${PURPLE})`, borderRadius:2, transition:'width 0.4s ease' }} />
          </div>
        </div>
        <button onClick={() => goTo(posIdx + 1)} disabled={posIdx >= positions.length - 1}
          style={{ width:34, height:34, borderRadius:'50%', background:'rgba(0,0,0,0.5)', border:`1px solid ${BORDER}`, color:WHITE, fontSize:'1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>→</button>
        <div style={{ background:`${PURPLE}22`, border:`1px solid ${PURPLE}66`, borderRadius:10, padding:'0.18rem 0.6rem', flexShrink:0 }}>
          <span style={{ fontSize:'0.5rem', fontFamily:'monospace', letterSpacing:'0.1em', color:PURPLE, fontWeight:700 }}>ACCESS</span>
        </div>
      </div>

      {/* ── BOTTOM PANEL ── */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, minHeight:BOTTOM_PANEL, zIndex:50, background:['hold','capture'].includes(stage) ? 'linear-gradient(to top,rgba(0,0,0,0.85) 60%,transparent)' : 'linear-gradient(to top,rgba(10,28,46,0.99) 80%,rgba(10,28,46,0.6))', paddingBottom:'max(env(safe-area-inset-bottom,0px),1.25rem)', paddingLeft:'1.25rem', paddingRight:'1.25rem', paddingTop:'0.85rem', display:'flex', flexDirection:'column', gap:'0.6rem', boxSizing:'border-box' as const }}>

        {/* POSITION */}
        {stage === 'position' && <>
          <PositionIllustration posId={currentPos.id} color={col} />
          <div style={{ background:`${col}11`, borderRadius:12, padding:'0.75rem 1rem', border:`1px solid ${col}33` }}>
            <div style={{ fontSize:'0.65rem', fontFamily:'monospace', color:col, fontWeight:700, marginBottom:'0.25rem' }}>{CATEGORY_META[category].obcRef}</div>
            <div style={{ fontSize:'0.78rem', color:WHITE2, lineHeight:1.6 }}>{currentPos.detail}</div>
          </div>
          <div style={{ display:'flex', gap:'0.45rem' }}>
            {currentPos.optional && <button onClick={() => goTo(posIdx + 1)} style={{ flex:1, padding:'0.75rem', background:'rgba(255,255,255,0.05)', border:`1px solid ${BORDER}`, borderRadius:13, color:WHITE2, fontFamily:'monospace', fontSize:'0.75rem', cursor:'pointer' }}>Skip →</button>}
            <button onClick={finishScan} style={{ flex:currentPos.optional?1:2, padding:'0.75rem', background:'rgba(250,116,31,0.12)', border:`1px solid rgba(250,116,31,0.3)`, borderRadius:13, color:AMBER, fontFamily:'monospace', fontSize:'0.75rem', fontWeight:600, cursor:'pointer' }}>View Report →</button>
          </div>
        </>}

        {/* READY */}
        {stage === 'ready' && <>
          <div style={{ background:`${col}11`, borderRadius:14, padding:'0.75rem 1rem', border:`1px solid ${col}33` }}>
            <div style={{ fontSize:'0.65rem', fontFamily:'monospace', color:col, fontWeight:700, letterSpacing:'0.08em', marginBottom:'0.3rem' }}>STEP {currentPos.step}/{positions.length} — {currentPos.label.toUpperCase()}</div>
            <div style={{ fontSize:'0.78rem', color:WHITE2, lineHeight:1.55 }}>{currentPos.detail}</div>
          </div>
          <button onClick={handleReady} style={{ width:'100%', padding:'1.15rem', background:`linear-gradient(135deg,${GREEN},#1A7A50)`, border:'none', borderRadius:16, color:'#fff', fontFamily:'monospace', fontSize:'1rem', fontWeight:900, letterSpacing:'0.04em', cursor:'pointer', boxShadow:'0 6px 28px rgba(39,169,107,0.5)' }}>{currentPos.readyLabel}</button>
          <div style={{ display:'flex', gap:'0.45rem' }}>
            {currentPos.optional && <button onClick={() => goTo(posIdx + 1)} style={{ flex:1, padding:'0.65rem', background:'rgba(255,255,255,0.05)', border:`1px solid ${BORDER}`, borderRadius:12, color:WHITE2, fontFamily:'monospace', fontSize:'0.72rem', cursor:'pointer' }}>Skip →</button>}
            <button onClick={finishScan} style={{ flex:1, padding:'0.65rem', background:'rgba(250,116,31,0.12)', border:`1px solid rgba(250,116,31,0.3)`, borderRadius:12, color:AMBER, fontFamily:'monospace', fontSize:'0.72rem', fontWeight:600, cursor:'pointer' }}>View Report →</button>
          </div>
        </>}

        {/* HOLD */}
        {stage === 'hold' && <>
          <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
            <div style={{ position:'relative', width:64, height:64, flexShrink:0 }}>
              <svg width="64" height="64" style={{ transform:'rotate(-90deg)' }}>
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4.5"/>
                <circle cx="32" cy="32" r="26" fill="none" stroke={GREEN} strokeWidth="4.5"
                  strokeDasharray={`${2*Math.PI*26}`}
                  strokeDashoffset={`${2*Math.PI*26*(countdown/currentPos.holdSeconds)}`}
                  strokeLinecap="round" style={{ transition:'stroke-dashoffset 0.9s linear' }}/>
              </svg>
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', fontWeight:900, color:WHITE, fontFamily:'monospace' }}>{countdown}</div>
            </div>
            <div>
              <div style={{ fontSize:'0.88rem', fontWeight:800, color:GREEN, letterSpacing:'0.05em', marginBottom:'0.2rem' }}>HOLD STILL</div>
              <div style={{ fontSize:'0.72rem', color:WHITE2, lineHeight:1.4 }}>Keep the phone steady for a clear capture</div>
            </div>
          </div>
          <button onClick={finishScan} style={{ width:'100%', padding:'0.72rem', background:`linear-gradient(135deg,${AMBER},#C4721E)`, border:'none', borderRadius:13, color:'#fff', fontFamily:'monospace', fontSize:'0.82rem', fontWeight:700, cursor:'pointer' }}>View Report →</button>
        </>}

        {/* CAPTURE */}
        {stage === 'capture' && <>
          <div style={{ fontSize:'0.78rem', color:WHITE2, lineHeight:1.5 }}>Phone is steady — tap to capture.</div>
          <button onClick={camWarm ? handleCapture : undefined}
            style={{ width:'100%', padding:'1.15rem', background:camWarm?`linear-gradient(135deg,${col},${PURPLE})`:'rgba(255,255,255,0.07)', border:camWarm?'none':`1px solid ${BORDER}`, borderRadius:16, color:camWarm?'#fff':WHITE2, fontFamily:'monospace', fontSize:'1rem', fontWeight:900, letterSpacing:'0.06em', cursor:camWarm?'pointer':'default', boxShadow:camWarm?`0 6px 28px ${col}80`:'none', transition:'all 0.4s ease' }}>
            {camWarm ? currentPos.captureLabel : 'Camera focusing…'}
          </button>
          <div style={{ display:'flex', gap:'0.45rem' }}>
            <button onClick={() => { busyRef.current=false; setCamWarm(false); setStage('hold'); setCountdown(currentPos.holdSeconds); setTimeout(()=>setCamWarm(true),2000) }}
              style={{ flex:1, padding:'0.65rem', background:'rgba(255,255,255,0.07)', border:`1px solid ${BORDER}`, borderRadius:12, color:WHITE2, fontFamily:'monospace', fontSize:'0.72rem', cursor:'pointer' }}>↺ Re-steady</button>
            <button onClick={finishScan}
              style={{ flex:1, padding:'0.65rem', background:'rgba(250,116,31,0.12)', border:`1px solid rgba(250,116,31,0.3)`, borderRadius:12, color:AMBER, fontFamily:'monospace', fontSize:'0.72rem', fontWeight:600, cursor:'pointer' }}>View Report →</button>
          </div>
        </>}

        {/* ANALYSING */}
        {stage === 'analysing' && <>
          <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
            <div style={{ width:40, height:40, borderRadius:'50%', border:`3px solid rgba(123,94,167,0.2)`, borderTopColor:col, animation:'spin 0.8s linear infinite', flexShrink:0 }} />
            <div>
              <div style={{ fontSize:'0.88rem', color:WHITE, fontWeight:700, marginBottom:'0.15rem' }}>Analysing for compliance…</div>
              <div style={{ fontSize:'0.7rem', color:WHITE2 }}>Checking {currentPos.label.toLowerCase()}</div>
            </div>
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </>}

        {/* RESULT */}
        {stage === 'result' && (() => {
          const catData: any = category === 'barrier_free_path'  ? results.barrierFreePath
                             : category === 'visual_fire_safety' ? results.visualFireSafety
                             : category === 'washrooms'          ? results.washrooms
                             : category === 'pool_spa_access'    ? results.poolSpaAccess
                             : results.accessibleSeating

          const passes    = catData?.passesOBC ?? catData?.passesNFPA ?? null
          const resultColor = passes === true ? GREEN : passes === false ? RED : AMBER

          // Pull the most relevant numeric value to display large
          const bigVal = catData?.doorClearMm ?? catData?.corridorWidthMm ?? catData?.turningSpaceMm
                       ?? catData?.deckWidthMm ?? catData?.counterHeightMm ?? catData?.wheelchairSpaceWidthMm ?? null
          const bigLabel = catData?.doorClearMm ? 'mm door width'
                         : catData?.corridorWidthMm ? 'mm corridor'
                         : catData?.turningSpaceMm ? 'mm turning space'
                         : catData?.deckWidthMm ? 'mm deck width'
                         : catData?.counterHeightMm ? 'mm counter'
                         : catData?.wheelchairSpaceWidthMm ? 'mm WC space' : ''

          return <>
            <div style={{ background:`${col}11`, borderRadius:14, padding:'0.9rem 1rem', border:`1px solid ${col}33` }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.4rem' }}>
                <span style={{ fontSize:'0.7rem', fontFamily:'monospace', fontWeight:700, color:resultColor, background:`${resultColor}22`, padding:'0.2rem 0.6rem', borderRadius:6, border:`1px solid ${resultColor}44`, textTransform:'uppercase' as const }}>
                  {passes === true ? 'PASS' : passes === false ? 'FLAG' : 'ASSESSED'}
                </span>
                <span style={{ fontSize:'0.68rem', color:WHITE2, fontFamily:'monospace' }}>{currentPos.label}</span>
              </div>
              {bigVal != null && (
                <div style={{ fontSize:'1.8rem', fontWeight:900, color:WHITE, fontFamily:'monospace' }}>
                  {Math.round(bigVal)}<span style={{ fontSize:'0.9rem', color:WHITE2 }}>mm</span>
                  {bigLabel && <span style={{ fontSize:'0.68rem', color:WHITE2, fontWeight:400, marginLeft:'0.4rem' }}>{bigLabel}</span>}
                </div>
              )}
              {aiMessage && <div style={{ fontSize:'0.72rem', color:WHITE2, lineHeight:1.5, marginTop:'0.35rem' }}>{aiMessage}</div>}
            </div>
            <button onClick={() => goTo(posIdx + 1)} style={{ width:'100%', padding:'0.85rem', background:`linear-gradient(135deg,${GREEN},#1A7A50)`, border:'none', borderRadius:14, color:'#fff', fontFamily:'monospace', fontSize:'0.9rem', fontWeight:900, cursor:'pointer', letterSpacing:'0.04em', boxShadow:'0 4px 18px rgba(39,169,107,0.45)' }}>Confirm & Next →</button>
            <div style={{ display:'flex', gap:'0.45rem' }}>
              <button onClick={() => { busyRef.current=false; setCamWarm(false); setStage('hold'); setCountdown(currentPos.holdSeconds); setTimeout(()=>setCamWarm(true),2000) }}
                style={{ flex:1, padding:'0.65rem', background:'rgba(255,255,255,0.07)', border:`1px solid ${BORDER}`, borderRadius:12, color:WHITE2, fontFamily:'monospace', fontSize:'0.72rem', cursor:'pointer' }}>↺ Retry</button>
              <button onClick={finishScan}
                style={{ flex:1, padding:'0.65rem', background:'rgba(250,116,31,0.12)', border:`1px solid rgba(250,116,31,0.3)`, borderRadius:12, color:AMBER, fontFamily:'monospace', fontSize:'0.72rem', fontWeight:600, cursor:'pointer' }}>View Report →</button>
            </div>
          </>
        })()}

      </div>
    </div>
  )
}
