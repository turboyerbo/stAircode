'use client'

// Detect image mime type from base64 string
function imgSrc(b64: string) {
  const head = b64.slice(0, 8)
  const mime = head.startsWith('iVBOR') ? 'image/png'
             : head.startsWith('/9j/')  ? 'image/jpeg'
             : head.startsWith('R0lGO') ? 'image/gif'
             : 'image/jpeg'
  return `data:${mime};base64,${b64}`
}

/**
 * InspectionModuleCapture.tsx  v2
 *
 * Unified camera + upload + AI analysis screen for every inspection module.
 *
 * Flow:
 *   capture (live camera or file upload)
 *   → analysing (Claude Vision with module-specific prompt)
 *   → review (AI pre-filled fields, fully editable)
 *   → save
 *
 * The AI prompt is tailored per module — it knows exactly what to look for,
 * what code section applies, and which fields to extract.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type {
  InspectionJob, InspectionPhase, InspectionModule,
  ModuleFinding, DefectSeverity, ModuleId,
} from '@/lib/inspection-types'
import { MODULE_META } from '@/lib/inspection-types'
import ScanReadyScreen from './ScanReadyScreen'
import type { UserRole } from './AuthScreen'

// ── Palette ───────────────────────────────────────────────────────────────────
const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const GREEN  = '#27A96B'
const ORANGE = '#F29337'
const RED    = '#E84545'
const BORDER = 'rgba(44,90,122,0.14)'
const BG     = '#F4F7FB'

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  job:      InspectionJob
  phase:    InspectionPhase
  module:   InspectionModule
  onSave:   (m: InspectionModule, drawingsData?: InspectionJob['drawingsData']) => void
  onBack:   () => void
  userRole?: UserRole
}

// ── Module-specific AI prompts ────────────────────────────────────────────────
// Each prompt tells Claude exactly what to look for, what to measure,
// and what JSON fields to return.

interface AIFields {
  condition:       string   // above_average|good|typical|fair|average|below_average|poor
  severity:        string   // none|minor|moderate|major|critical
  observations:    string   // 2-3 sentences of specific findings
  recommendation:  string   // 1-2 sentences of action
  passesCode:      boolean | null
  codeRef:         string
  measurements:    Record<string, string | number | boolean | null>  // module-specific
}

function getModulePrompt(moduleId: ModuleId, job: InspectionJob): string {
  const addr     = `${job.address.street}, ${job.address.city}, ${job.address.province}`
  const province = job.address.province
  const code = (() => {
    const p = province?.toLowerCase() ?? ''
    const c = (job?.address?.city ?? '').toLowerCase()
    if(p.includes('ontario')||p==='on'||['toronto','ottawa','hamilton','mississauga','brampton'].some(x=>c.includes(x))) return 'OBC 2024'
    if(p.includes('quebec')||p.includes('québec')||p==='qc'||c.includes('montreal')||c.includes('montréal')) return 'CCQ / RBQ'
    if(p.includes('british columbia')||p==='bc'||c.includes('vancouver')) return 'BCBC 2024'
    if(p.includes('alberta')||p==='ab') return 'ABC 2019'
    return 'NBC 2020'
  })()
  const age      = job.estimatedAge || 'unknown age'

  const base = `You are an expert building inspector conducting a site inspection in ${addr}. Building is ${age}. Applicable code: ${code}.

Analyse this photo carefully. Look for:
- Visible defects, damage, or non-compliance
- Material conditions and workmanship quality
- Code compliance issues with specific section references
- Safety concerns

Reply ONLY with valid JSON (no markdown):
`

  const prompts: Partial<Record<ModuleId, string>> = {

    // ── Phase 2: Excavation & Footings ──────────────────────────────────────
    footing_depth: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe visible footing depth, exposure, soil conditions",
  "recommendation": "Action required if any",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.15.1",
  "measurements": {
    "estimatedDepthMm": number or null,
    "belowFrostLine": true|false|null,
    "frostDepthApproxMm": 1200,
    "soilCondition": "undisturbed|disturbed|fill|unknown",
    "footingVisible": true|false,
    "notes": "any specific observations about depth adequacy"
  }
}`,

    footing_width: base + `Assess footing width against OBC 9.15.3 minimums.
Scale refs: standard concrete block=200mm, standard brick=90mm wide, lumber 2x6=140mm thick.
{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe footing width, wall relationship, bearing area visible",
  "recommendation": "Action if width is insufficient",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.15.3",
  "measurements": {
    "estimatedWidthMm": number or null,
    "wallThicknessApproxMm": number or null,
    "footingProjectionEachSideMm": number or null,
    "footingType": "poured_concrete|concrete_block|stone|unknown",
    "uniformWidth": true|false
  }
}`,

    bearing_soil: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe soil type, condition, bearing capacity indicators",
  "recommendation": "If soil appears inadequate, note engineer assessment",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.15.2",
  "measurements": {
    "soilType": "clay|sand|gravel|rock|fill|organic|unknown",
    "soilCondition": "firm|soft|wet|disturbed|frozen|unknown",
    "organicMaterialVisible": true|false,
    "waterPresent": true|false,
    "engineerRequired": true|false|null
  }
}`,

    drain_tile: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe drain tile/weeping tile installation, slope, filter fabric",
  "recommendation": "Corrective action if missing or improperly installed",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.14",
  "measurements": {
    "drainTilePresent": true|false,
    "filterFabricPresent": true|false,
    "gravel/StoneBed": true|false,
    "minimumDiameterMm": 100,
    "slopeAdequate": true|false|null,
    "drainTileType": "perforated_pipe|tile|sock_pipe|unknown"
  }
}`,

    // ── Phase 3: Foundation ──────────────────────────────────────────────────
    damp_proofing: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe damp-proofing membrane: coverage, continuity, damage, missed areas",
  "recommendation": "Remediation if incomplete or damaged",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.13",
  "measurements": {
    "membraneType": "asphalt_coating|bituminous|membrane_sheet|spray|unknown|none",
    "coverageComplete": true|false,
    "tearsDamageVisible": true|false,
    "appliedAboveGrade": true|false,
    "heightMm": number or null,
    "overlapAtJoints": true|false|null
  }
}`,

    foundation_drainage: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe drainage board, gravel bed, outlet to daylight or sump",
  "recommendation": "Action if drainage inadequate",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.14",
  "measurements": {
    "drainageBoardPresent": true|false,
    "drainageBoardType": "dimple_mat|rigid_board|none|unknown",
    "gravelBedDepthMm": number or null,
    "outletVisible": true|false,
    "waterStaining": true|false,
    "effloresence": true|false
  }
}`,

    window_wells: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe window well dimensions, drainage, cover, egress accessibility",
  "recommendation": "Action if below egress minimums",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.7.2",
  "measurements": {
    "widthMm": number or null,
    "projectionMm": number or null,
    "depthMm": number or null,
    "drainageAtBase": true|false,
    "coverPresent": true|false,
    "accessibleFromInside": true|false|null,
    "openableWithoutKey": true|false|null
  }
}`,

    // ── Phase 4: Framing & Rough-In ──────────────────────────────────────────
    structural_framing: base + `Scale: standard 2x6 stud=38x140mm, 2x4=38x89mm, LVL beam identifiable by layers.
{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe framing members, connections, bearing, bridging, blocking",
  "recommendation": "Structural concerns, engineer referral if needed",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.23",
  "measurements": {
    "framingType": "wood_2x4|wood_2x6|engineered_lumber|steel|mixed|unknown",
    "studSpacingMm": 400|600|other_number|null,
    "doubleTopPlatePresent": true|false,
    "headerOverOpenings": true|false,
    "splicesAtBearing": true|false|null,
    "notchingCuttingViolations": true|false,
    "fireBlockingVisible": true|false,
    "straightPlumb": true|false
  }
}`,

    floor_systems: base + `Scale: standard joist=38x235mm (2x10), 38x286mm (2x12), I-joist recognizable by web.
{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe joist type, spacing, bearing, bridging/blocking, subfloor",
  "recommendation": "Structural concerns if any",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.23",
  "measurements": {
    "joistType": "solid_lumber|I-joist|LVL|engineered|unknown",
    "estimatedSpacingMm": 400|600|null,
    "bearingAtWallsMm": number or null,
    "bridgingPresent": true|false,
    "subflooring": "osb|plywood|lumber|none|unknown",
    "deflection": true|false,
    "notchingIssues": true|false,
    "rimJoistInsulated": true|false|null
  }
}`,

    roof_framing_rough: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe roof framing: trusses or rafters, ridge, bracing, connections",
  "recommendation": "Structural concerns if any",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.23.13",
  "measurements": {
    "roofFramingType": "trusses|rafters|hybrid|unknown",
    "spacingMm": 400|600|null,
    "ridgeBeamOrRidge": "ridge_beam|ridge_board|unknown",
    "lateralBracing": true|false,
    "trussClipper": true|false|null,
    "ventingOpening": true|false,
    "ondulationsOrDeflection": true|false,
    "coveringType": "osb|plywood|boards|none|unknown"
  }
}`,

    rough_plumbing: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe DWV pipes, supply lines, slope, support, access cleanouts",
  "recommendation": "Issues with slope, support, or code compliance",
  "passesCode": true|false|null,
  "codeRef": "${code} Part 7",
  "measurements": {
    "drainPipeMaterial": "ABS|PVC|cast_iron|copper|mixed|unknown",
    "supplyPipeMaterial": "copper|PEX|CPVC|galvanized|unknown",
    "drainSlopeAdequate": true|false|null,
    "cleanoutProvided": true|false,
    "pipeSupportAdequate": true|false,
    "penetrationFireStopping": true|false|null,
    "noiseIssues": null,
    "testCapPresent": true|false
  }
}`,

    rough_electrical: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe panel, wiring type, box fill, clamps, grounding visible",
  "recommendation": "Electrical safety concerns or ESA required",
  "passesCode": true|false|null,
  "codeRef": "${code} Part 8 / Ontario Electrical Safety Code",
  "measurements": {
    "wiringType": "NMD90_romex|armored_BX|conduit|aluminum|mixed|unknown",
    "panelVisible": true|false,
    "boxFillAdequate": true|false|null,
    "clampedAtBoxes": true|false,
    "aluminumWiringPresent": true|false,
    "knobAndTubePresent": true|false,
    "groundingWirePresent": true|false,
    "AFCIorGFCI": true|false|null,
    "workmanshipGood": true|false
  }
}`,

    rough_hvac: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe duct work, equipment rough-in, combustion air, exhaust",
  "recommendation": "Issues with sizing, sealing, or clearances",
  "passesCode": true|false|null,
  "codeRef": "${code} Part 6",
  "measurements": {
    "ductMaterial": "sheet_metal|flex|fiberglass|none_visible|unknown",
    "ductsSealed": true|false,
    "returnAirPath": true|false|null,
    "combustionAirProvided": true|false|null,
    "exhaustVentingCorrect": true|false|null,
    "equipmentClearancesOK": true|false|null,
    "HRVorERVRoughIn": true|false|null
  }
}`,

    fire_blocking: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe fire blocking in wall cavities, at floor lines, around penetrations",
  "recommendation": "Missing blocking locations and remediation",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.10.17",
  "measurements": {
    "blockingAtFloorLines": true|false,
    "blockingAtCeilingLines": true|false,
    "penetrationStopping": "fire_caulk|mineral_wool|intumescent|none|partial|unknown",
    "materialUsed": "2x lumber|OSB|drywall|other|unknown",
    "gapsVisible": true|false,
    "openingsSealedAroundPipes": true|false,
    "openingsSealedAroundWires": true|false
  }
}`,

    stair_rough: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe stringer condition, spacing, landing framing, attachment",
  "recommendation": "Framing issues to address before finishing",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.8.4",
  "measurements": {
    "stringerCount": number or null,
    "stringerSpacingMm": number or null,
    "landingFramingPresent": true|false,
    "attachmentToFloor": "lag_bolts|hangers|toenailed|unknown",
    "headroomClearMm": number or null,
    "widthMm": number or null
  }
}`,

    // ── Phase 5: Insulation ──────────────────────────────────────────────────
    insulation_walls: base + `Scale: R-20 batt in 2x6 wall=140mm thick; fiberglass yellow/pink; mineral wool grey/green; spray foam expanding.
{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe insulation type, thickness, coverage, gaps, compression",
  "recommendation": "Areas needing additional insulation or correction",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.25",
  "measurements": {
    "insulationType": "fiberglass_batt|mineral_wool|spray_foam|rigid|cellulose|unknown",
    "estimatedRValue": "R-12|R-20|R-22|R-24|other|unknown",
    "coverageComplete": true|false,
    "gapsOrVoids": true|false,
    "compressed": true|false,
    "vapourBarrierSide": "warm_side_correct|wrong_side|absent|unknown",
    "electricalBoxesFilled": true|false
  }
}`,

    insulation_ceiling: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe attic/ceiling insulation: type, depth, distribution, baffles at eaves",
  "recommendation": "Coverage gaps or inadequate R-value",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.25",
  "measurements": {
    "insulationType": "blown_fiberglass|blown_cellulose|batt|spray_foam|unknown",
    "estimatedDepthMm": number or null,
    "estimatedRValue": "R-40|R-50|R-60|other|unknown",
    "eaveVentBaffles": true|false,
    "uniformCoverage": true|false,
    "atticHatch": "insulated|not_insulated|absent",
    "potLightClearance": true|false|null
  }
}`,

    vapour_barrier: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe polyethylene vapour barrier: side of insulation, lapping, sealing, penetrations",
  "recommendation": "Correct placement or sealing required",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.25.3",
  "measurements": {
    "vapourBarrierPresent": true|false,
    "onWarmSide": true|false|null,
    "overlapMm": number or null,
    "taped": true|false,
    "tightToFraming": true|false,
    "penetrationsSealedElectrical": true|false,
    "penetrationsSealedPlumbing": true|false,
    "tearsDamage": true|false,
    "polyThickness": "0.15mm_standard|0.05mm_thin|unknown"
  }
}`,

    window_door_rough_openings: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe rough opening size, header, jack studs, king studs, sill",
  "recommendation": "Framing issues before window/door installation",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.23",
  "measurements": {
    "headerType": "double_2x8|double_2x10|LVL|steel|unknown",
    "headerDepthMm": number or null,
    "jackStudsPresent": true|false,
    "kingStudsPresent": true|false,
    "roughOpeningSquare": true|false|null,
    "flashingPresent": true|false,
    "sillPresent": true|false
  }
}`,

    // ── Phase 6: Occupancy / Final ───────────────────────────────────────────
    interior_finishes: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe drywall finish, paint, trim, overall quality and defects",
  "recommendation": "Deficiencies requiring remediation before occupancy",
  "passesCode": true|false|null,
  "codeRef": "${code}",
  "measurements": {
    "drywallFinishLevel": "Level_1|Level_2|Level_3|Level_4|Level_5|unknown",
    "cracksVisible": true|false,
    "cracksType": "hairline|structural|settling|unknown|none",
    "tapeShowingThrough": true|false,
    "paintConsistent": true|false,
    "trimInstalled": true|false,
    "trimCondition": "good|gaps|paint_issues|damaged|unknown",
    "overallQuality": "excellent|good|typical|poor"
  }
}`,

    ceilings: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe ceiling condition: staining, cracking, sag, finish quality",
  "recommendation": "Moisture investigation or structural assessment if needed",
  "passesCode": true|false|null,
  "codeRef": "${code}",
  "measurements": {
    "waterStaining": true|false,
    "stainActive": true|false|null,
    "cracks": true|false,
    "crackType": "hairline|structural|plaster_failure|none",
    "sag": true|false,
    "estimatedHeightMm": number or null,
    "minimumCodeHeightMm": 2100,
    "meetsCeilingHeight": true|false|null,
    "materialType": "drywall|plaster|tile|drop_ceiling|unknown"
  }
}`,

    internal_walls: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe wall condition: cracks, damp, plumb, finish quality",
  "recommendation": "Moisture, structural or finish issues",
  "passesCode": true|false|null,
  "codeRef": "${code}",
  "measurements": {
    "cracksVisible": true|false,
    "crackWidth": "hairline|<3mm|3-6mm|>6mm|none",
    "crackPattern": "vertical|horizontal|diagonal|step|none",
    "dampness": true|false,
    "effloresence": true|false,
    "outOfPlumb": true|false,
    "outOfPlumbMmPerMetre": number or null,
    "materialType": "drywall|plaster|masonry|unknown"
  }
}`,

    stairs: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe stair condition: treads, risers, handrail, visible defects",
  "recommendation": "Safety issues or code deficiencies",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.8.4",
  "measurements": {
    "handrailPresent": true|false,
    "handrailBothSides": true|false|null,
    "handrailContinuous": true|false|null,
    "openRisers": true|false,
    "nosingsPresent": true|false,
    "treadCondition": "good|worn|damaged|missing|unknown",
    "squeak": true|false|null,
    "sagging": true|false,
    "balusterSpacingCompliant": true|false|null
  }
}`,

    guardrails_handrails: base + `Scale: standard guard height 900mm residential, 1070mm commercial. Baluster gap max 100mm.
{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe guard height, baluster spacing, graspability, attachment",
  "recommendation": "Non-compliant guards must be rectified before occupancy",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.8.7",
  "measurements": {
    "guardHeightMm": number or null,
    "minimumRequiredMm": 900,
    "meetsHeightRequirement": true|false|null,
    "balusters": true|false,
    "maxBalusterGapMm": number or null,
    "balustersCompliant": true|false|null,
    "graspable": true|false|null,
    "graspDiameterMm": number or null,
    "solidAttachment": true|false,
    "wobble": true|false,
    "material": "wood|metal|glass|composite|unknown"
  }
}`,

    exterior_walls: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe cladding condition: paint, moisture, damage, penetrations",
  "recommendation": "Maintenance, sealing, or structural issues",
  "passesCode": true|false|null,
  "codeRef": "${code}",
  "measurements": {
    "claddingType": "brick|vinyl|wood|stucco|fiber_cement|EIFS|metal|unknown",
    "paintPeeling": true|false,
    "moistureStaining": true|false,
    "penetrationsSealedCaulked": true|false,
    "weepholes": true|false|null,
    "clearanceFromGrade": "adequate_>150mm|insufficient|unknown",
    "flashingAtOpenings": true|false,
    "overallCondition": "good|fair|poor"
  }
}`,

    exterior_cracks: base + `Scale: hairline <0.5mm, minor 0.5-2mm, moderate 2-5mm, major >5mm.
{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe crack type, pattern, width, length, location on building",
  "recommendation": "Monitor, repair, or immediate structural assessment",
  "passesCode": true|false|null,
  "codeRef": "${code}",
  "measurements": {
    "cracksPresent": true|false,
    "crackType": "hairline|diagonal|stair_step|horizontal|vertical|multiple|none",
    "estimatedWidthMm": number or null,
    "pattern": "isolated|systematic|corner|lintel|unknown",
    "activeOrStable": "active|stable|unknown",
    "previousRepair": true|false,
    "structuralConcern": true|false,
    "engineerAssessmentRequired": true|false
  }
}`,

    windows_final: base + `Scale: standard egress min 0.35m² clear opening, min 380mm height, min 380mm width. Sill max 900mm AFF.
{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe window condition, operation, seals, frame condition",
  "recommendation": "Failed seals, operation issues or egress problems",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.7",
  "measurements": {
    "frameType": "vinyl|aluminum|wood|fiberglass|unknown",
    "sealCondition": "good|fogged|failed|unknown",
    "operationSmooth": true|false,
    "hardwareIntact": true|false,
    "weatherstrippingPresent": true|false,
    "clearOpeningAreaM2": number or null,
    "meetsEgress": true|false|null,
    "sillHeightMm": number or null,
    "flashingVisible": true|false
  }
}`,

    doors_final: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe door operation, hardware, frame, weatherstripping",
  "recommendation": "Alignment, hardware or weatherproofing issues",
  "passesCode": true|false|null,
  "codeRef": "${code}",
  "measurements": {
    "doorType": "interior|exterior|fire_rated|garage|unknown",
    "operationSmooth": true|false,
    "hardwareComplete": true|false,
    "selfClosingIfFireRated": true|false|null,
    "weatherstripping": true|false,
    "thresholdSealed": true|false,
    "frameSquare": true|false,
    "lockSetWorking": true|false
  }
}`,

    wet_areas_kitchen: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe kitchen: tiles, grout, caulk at sink, cabinet condition, exhaust fan",
  "recommendation": "Moisture sealing, ventilation or fixture issues",
  "passesCode": true|false|null,
  "codeRef": "${code}",
  "measurements": {
    "tileGroutCondition": "good|cracked|missing|n/a|unknown",
    "caulkAtSink": "present_good|present_failing|absent|unknown",
    "moistureStaining": true|false,
    "exhaustFanPresent": true|false,
    "exhaustDuctedToExterior": true|false|null,
    "cabinetCondition": "good|water_damaged|warped|unknown",
    "countertopCondition": "good|stained|damaged|unknown",
    "gfciAtSink": true|false|null
  }
}`,

    wet_areas_bathrooms: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe shower/tub tiles, grout, caulk, WC seal, vanity, ventilation",
  "recommendation": "Failed waterproofing, mould risk, or fixture issues",
  "passesCode": true|false|null,
  "codeRef": "${code}",
  "measurements": {
    "showerTileCondition": "good|cracked|loose|missing|n/a",
    "groutCondition": "good|cracking|missing|mould|unknown",
    "caulkAtTub": "present_good|failing|absent",
    "mouldVisible": true|false,
    "mouldLocation": "grout|caulk|ceiling|unknown|none",
    "wcSealAtFloor": "present|absent|cracked",
    "exhaustFanPresent": true|false,
    "exhaustDucted": true|false|null,
    "gfciOutlets": true|false|null,
    "hotColdLabelled": true|false
  }
}`,

    wet_areas_laundry: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe laundry area: dryer vent, floor drain, tub condition, moisture",
  "recommendation": "Venting, drainage, or moisture issues",
  "passesCode": true|false|null,
  "codeRef": "${code}",
  "measurements": {
    "dryerVentPresent": true|false,
    "dryerVentMaterial": "rigid_metal|flex_metal|plastic|foil|unknown|none",
    "dryerVentDuctedExterior": true|false|null,
    "floorDrainPresent": true|false,
    "tub/SinkCondition": "good|stained|damaged|n/a|unknown",
    "moistureStaining": true|false,
    "gfciOutlets": true|false|null
  }
}`,

    smoke_co_detectors: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe smoke/CO detector presence, location, type, condition",
  "recommendation": "Missing or improperly placed detectors require correction before occupancy",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.10.19",
  "measurements": {
    "smokeDetectorPresent": true|false,
    "coDetectorPresent": true|false,
    "combinedUnit": true|false,
    "locationAppropriate": true|false|null,
    "hardwiredOrBattery": "hardwired|battery|hardwired_backup|unknown",
    "interconnected": true|false|null,
    "withinExpiryDate": true|false|null,
    "onEachFloor": true|false|null,
    "inSleepingRooms": true|false|null,
    "atLeastOnePerFloor": true|false|null
  }
}`,

    egress_windows: base + `Scale: min clear opening 0.35m², min height 380mm, min width 380mm, max sill height 900mm AFF.
{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe egress window size, operation, sill height, access from inside",
  "recommendation": "Non-compliant egress is a life safety issue requiring immediate correction",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.7.2",
  "measurements": {
    "clearOpeningWidthMm": number or null,
    "clearOpeningHeightMm": number or null,
    "clearOpeningAreaM2": number or null,
    "meetsMinimumArea": true|false|null,
    "sillHeightAFFMm": number or null,
    "sillHeightCompliant": true|false|null,
    "openableWithoutKey": true|false,
    "operationSmooth": true|false,
    "wellDepthAdequate": true|false|null
  }
}`,

    garage_final: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe garage: door operation, floor condition, fire separation from house",
  "recommendation": "Fire separation, CO, or structural issues",
  "passesCode": true|false|null,
  "codeRef": "${code}",
  "measurements": {
    "doorToHouseSelfClosing": true|false|null,
    "doorToHouseFireRated": true|false|null,
    "floorSloped": true|false|null,
    "coDetectorPresent": true|false,
    "garageDoorsOperation": "good|stiff|damaged|unknown",
    "structuralIssues": true|false,
    "floorCracking": true|false,
    "fireSeparationIntact": true|false|null
  }
}`,

    decks_balconies: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe deck structure: joists, ledger, posts, decking, guardrail condition",
  "recommendation": "Structural concerns, rot, or guardrail deficiencies",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.8.7",
  "measurements": {
    "ledgerFlashing": true|false,
    "ledgerAttachment": "lag_bolts|through_bolts|nails_only|unknown",
    "postAnchors": true|false,
    "deckingCondition": "good|splintered|rot|missing|unknown",
    "deckingMaterial": "wood|composite|PVC|unknown",
    "joistsCondition": "good|rot|damage|unknown",
    "guardrailPresent": true|false,
    "guardrailHeightMm": number or null,
    "guardrailCompliant": true|false|null,
    "drainageAdequate": true|false
  }
}`,

    site_grading: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe grade slope away from foundation, ponding areas, erosion",
  "recommendation": "Regrading required if sloping toward foundation",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.12",
  "measurements": {
    "slopingAwayFromFoundation": true|false,
    "pondingVisible": true|false,
    "erosionVisible": true|false,
    "minimumSlopePctRequired": 2,
    "estimatedSlopePct": number or null,
    "windowWellsAboveGrade": true|false|null,
    "soilTypeAtGrade": "clay|loam|sand|gravel|unknown"
  }
}`,

    site_drainage: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe surface drainage: catch basins, swales, runoff path, ponding",
  "recommendation": "Drainage improvements to prevent foundation moisture",
  "passesCode": true|false|null,
  "codeRef": "${code}",
  "measurements": {
    "catchBasinPresent": true|false,
    "swalesPresent": true|false,
    "pondingEvidence": true|false,
    "drainageToStreet": true|false|null,
    "gutterDownspoutExtension": true|false|null,
    "downspoutAwayFromFoundation": true|false|null
  }
}`,

    services_electrical: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe panel condition, breaker labelling, safety switches, visible wiring",
  "recommendation": "Electrical safety concerns or ESA inspection required",
  "passesCode": true|false|null,
  "codeRef": "Ontario Electrical Safety Code",
  "measurements": {
    "panelType": "breaker|fuse|unknown",
    "panelAmps": "100A|200A|60A|unknown",
    "breakersLabelled": true|false,
    "doubleTappedBreakers": true|false,
    "AFCI_GFCI_present": true|false,
    "groundingBondPresent": true|false,
    "aluminumWiring": true|false,
    "knobAndTube": true|false,
    "panelCondition": "good|overcrowded|rust|outdated|unknown",
    "coverPresent": true|false
  }
}`,

    services_plumbing: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe fixtures, water pressure, drain performance, leaks, water heater",
  "recommendation": "Leaks, pressure, or code issues",
  "passesCode": true|false|null,
  "codeRef": "${code} Part 7",
  "measurements": {
    "supplyPipeMaterial": "copper|PEX|CPVC|galvanized|unknown",
    "drainMaterial": "ABS|PVC|cast_iron|unknown",
    "waterPressureAdequate": true|false|null,
    "leaksVisible": true|false,
    "hotWaterTemperatureOK": true|false|null,
    "shutoffValvesAccessible": true|false,
    "backflowPreventer": true|false|null
  }
}`,

    services_gas: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe gas connections, appliances, ventilation, sediment trap",
  "recommendation": "Gas safety issues require licensed gas technician",
  "passesCode": true|false|null,
  "codeRef": "${code} / Technical Standards & Safety Authority (TSSA)",
  "measurements": {
    "shutoffValveAccessible": true|false,
    "sedimentTrapPresent": true|false,
    "flexConnectorCondition": "good|kinked|corroded|none|unknown",
    "appliancesVented": true|false|null,
    "appliancesCSAApproved": true|false|null,
    "gasOdourDetected": false,
    "corrosionVisible": true|false
  }
}`,

    hot_water_system: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe water heater type, age, pressure relief valve, connections, flue",
  "recommendation": "Age, venting, or safety valve issues",
  "passesCode": true|false|null,
  "codeRef": "${code}",
  "measurements": {
    "systemType": "tank_gas|tank_electric|tankless_gas|tankless_electric|heat_pump|unknown",
    "estimatedAge": "string or null",
    "pressureReliefValvePresent": true|false,
    "pressureReliefDrainPipePresent": true|false,
    "flueVentingAdequate": true|false|null,
    "corrosionLeaksVisible": true|false,
    "insulatedPipes": true|false,
    "capacityL": number or null,
    "operatingProperly": true|false|null
  }
}`,

    hvac_final: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe HVAC equipment, filter, ductwork, exhaust, controls",
  "recommendation": "Maintenance, servicing, or code issues",
  "passesCode": true|false|null,
  "codeRef": "${code} Part 6",
  "measurements": {
    "systemType": "forced_air_gas|heat_pump|electric_baseboard|radiant|boiler|unknown",
    "filterCondition": "clean|dirty|absent|unknown",
    "ductworkCondition": "good|disconnected|damaged|unknown",
    "exhaustFansDucted": true|false|null,
    "HRV_ERV_present": true|false,
    "makeupAirProvided": true|false|null,
    "lastServiceDate": "visible_on_unit_or_null",
    "controlsWorking": true|false|null
  }
}`,

    driveway_paths: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe surface condition, cracks, heaving, drainage, trip hazards",
  "recommendation": "Safety, drainage, or maintenance issues",
  "passesCode": true|false|null,
  "codeRef": "${code}",
  "measurements": {
    "surfaceMaterial": "concrete|asphalt|interlocking|gravel|unknown",
    "cracks": true|false,
    "heaving": true|false,
    "drainage": "good|ponding|unknown",
    "tripHazards": true|false,
    "conditionOverall": "good|fair|poor"
  }
}`,

    swimming_pool: base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Describe pool condition, fencing compliance, safety equipment visible",
  "recommendation": "Pool fencing is a life safety requirement — specialist inspection recommended",
  "passesCode": true|false|null,
  "codeRef": "${code} 9.8.8 / Ontario Pool Enclosure Act",
  "measurements": {
    "poolFencePresent": true|false,
    "fenceHeightMm": number or null,
    "gatesSelfClosing": true|false|null,
    "gatesSelfLatching": true|false|null,
    "latchLocationCompliant": true|false|null,
    "poolCondition": "good|fair|poor|unknown",
    "safetyEquipmentVisible": true|false,
    "specialistInspectionRequired": true
  }
}`
  }

  return prompts[moduleId] ?? base + `{
  "condition": "above_average|good|typical|fair|average|below_average|poor",
  "severity": "none|minor|moderate|major|critical",
  "observations": "Specific observations about ${(MODULE_META[moduleId]?.label ?? moduleId).replace(/_/g,' ')}",
  "recommendation": "Required action if any",
  "passesCode": true|false|null,
  "codeRef": "${MODULE_META[moduleId]?.codeRef ?? code}",
  "measurements": {}
}`
}

// ── Stage type ────────────────────────────────────────────────────────────────
type Stage = 'capture' | 'analysing' | 'review'

// ── Condition pills ───────────────────────────────────────────────────────────
const CONDITIONS = [
  { value:'above_average', label:'Above Avg', color:'#1A7A50' },
  { value:'good',          label:'Good',      color:GREEN    },
  { value:'typical',       label:'Typical',   color:BLUE     },
  { value:'fair',          label:'Fair',      color:'#C48A00'},
  { value:'average',       label:'Average',   color:ORANGE   },
  { value:'below_average', label:'Below Avg', color:'#C44000'},
  { value:'poor',          label:'Poor',      color:RED      },
]

const SEVERITIES: { value: DefectSeverity; label: string }[] = [
  { value:'none',     label:'None'     },
  { value:'minor',    label:'Minor'    },
  { value:'moderate', label:'Moderate' },
  { value:'major',    label:'Major'    },
  { value:'critical', label:'Critical' },
]

// ── Measurement display ───────────────────────────────────────────────────────
function MeasurementPills({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 'unknown')
  if (!entries.length) return null
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:'0.3rem' }}>
      {entries.map(([k, v]) => {
        const label = k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()
        const valStr = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)
        const isPass = v === true || valStr === 'Yes' || valStr === 'good'
        const isFail = v === false || valStr === 'No' || valStr === 'absent' || valStr === 'poor'
        return (
          <div key={k} style={{
            fontSize:'0.68rem', padding:'0.22rem 0.55rem', borderRadius:5,
            background: isPass ? 'rgba(39,169,107,0.08)' : isFail ? 'rgba(232,69,69,0.08)' : 'rgba(65,124,164,0.08)',
            border: `1px solid ${isPass ? 'rgba(39,169,107,0.25)' : isFail ? 'rgba(232,69,69,0.25)' : 'rgba(65,124,164,0.2)'}`,
            color: isPass ? '#1A7A50' : isFail ? '#C44000' : '#3A5A78',
            lineHeight: 1.3,
          }}>
            <span style={{ opacity:0.65 }}>{label}: </span>
            <strong>{valStr}</strong>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function InspectionModuleCapture({ job, phase, module, onSave, onBack, userRole = 'diy' }: Props) {
  const meta = MODULE_META[module.id]

  // ── Stair compliance — full inline ScanReadyScreen ────────────────────────
  if (module.id === 'stair_compliance') {
    return (
      <ScanReadyScreen
        userRole={userRole}
        onBack={onBack}
        onSuccess={(measurements) => {
          const finding: ModuleFinding = {
            id:   `find-${Date.now()}`,
            label: 'Stair Compliance Scan',
            condition: 'typical' as any,
            severity:  'none' as any,
            notes: Object.entries(measurements).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${k}: ${v}`).join(' · '),
            photos: [],
          }
          onSave({ ...module, status:'complete', findings:[finding], capturedAt: new Date().toISOString() })
        }}
      />
    )
  }

  // ── Other built-in modules ────────────────────────────────────────────────
  if (meta?.isBuiltIn) {
    const urls: Record<string, string> = {
      foundation_inspection: '/?module=foundation',
      accessibility:         '/?module=accessibility',
    }
    const builtInSave = (status: 'complete'|'skipped') => {
      onSave({ ...module, status, capturedAt: new Date().toISOString() })
    }
    return (
      <div style={{ minHeight:'100dvh', background:BG, fontFamily:"inherit", color:'#0D1E2E' }}>
        <div style={{ background:NAVY, padding:'max(env(safe-area-inset-top,0px),1rem) 1.25rem 1.25rem' }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.55)', fontSize:'0.85rem', cursor:'pointer', padding:0 }}>← Back to phase</button>
          <h2 style={{ fontSize:'1.1rem', fontWeight:700, color:'#fff', margin:'0.5rem 0 0.1rem' }}>{meta.label}</h2>
          <p style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.5)', margin:0 }}>{meta.description}</p>
        </div>
        <div style={{ padding:'1.25rem' }}>
          <div style={{ background:'#fff', border:`1.5px solid rgba(65,124,164,0.3)`, borderRadius:12, padding:'1.25rem', display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <p style={{ fontSize:'0.82rem', color:'#5E7D9B', margin:0, lineHeight:1.65 }}>{meta.description}</p>
            <button
              onClick={() => {
                // Navigate to the standalone scan using signin=1 to preserve auth context
                // and goto=projects so the user returns to their projects after
                const moduleParam = module.id === 'accessibility' ? 'accessibility' : 'foundation'
                window.location.href = `/?signin=1&module=${moduleParam}`
              }}
              style={{ display:'block', width:'100%', padding:'0.9rem', background:`linear-gradient(135deg,${BLUE},#2C5A7A)`, borderRadius:10, color:'#fff', fontWeight:700, fontSize:'0.875rem', border:'none', cursor:'pointer', textAlign:'center' as const }}>
              Launch AI Scan →
            </button>
            <div style={{ display:'flex', gap:'0.5rem' }}>
              <button onClick={() => builtInSave('skipped')} style={{ flex:1, padding:'0.65rem', background:'rgba(44,90,122,0.07)', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:'0.78rem', fontWeight:600, color:'#5E7D9B', cursor:'pointer' }}>Skip</button>
              <button onClick={() => builtInSave('complete')} style={{ flex:2, padding:'0.65rem', background:GREEN, border:'none', borderRadius:8, fontSize:'0.78rem', fontWeight:700, color:'#fff', cursor:'pointer' }}>Mark Complete</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Camera + AI analysis flow ─────────────────────────────────────────────
  return <CameraCapture job={job} phase={phase} module={module} onSave={onSave} onBack={onBack} />
}

// ── Camera capture component ────────────────────────────────────────────────────
function CameraCapture({ job, phase, module, onSave, onBack }: Omit<Props, 'userRole'>) {
  const meta      = MODULE_META[module.id]
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  const [stage,      setStage]     = useState<Stage>('capture')
  const [camReady,   setCamReady]  = useState(false)
  const [camError,   setCamError]  = useState(false)
  const [camActive,  setCamActive] = useState(false)  // true = live camera mode
  // ── Photo state ─────────────────────────────────────────────────────────────
  // Load all real photos from module (filter out [photo-N] Supabase placeholders)
  const allExistingPhotos = (module.photos ?? []).filter(p => p && !p.startsWith('[') && p.length > 50)
  const firstRealPhoto = allExistingPhotos[0] ?? null
  const [capturedB64, setCapturedB64] = useState<string | null>(firstRealPhoto)
  const [aiFields,   setAiFields]  = useState<AIFields | null>(null)
  const [aiError,    setAiError]   = useState<string | null>(null)
  // photos = primary photo (index 0). additionalPhotos = all others (index 1+).
  // Seeded from module.photos so existing photos survive re-open without duplication.
  const [photos,          setPhotos]          = useState<string[]>(allExistingPhotos.slice(0, 1))
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>(allExistingPhotos.slice(1))

  // Editable review fields
  const [condition,  setCondition]  = useState(module.findings[0]?.condition ?? '')
  const [severity,   setSeverity]   = useState<DefectSeverity>(module.findings[0]?.severity ?? 'none')
  const [notes,      setNotes]      = useState(module.notes ?? '')
  const [findNote,   setFindNote]   = useState(module.findings[0]?.notes ?? '')
  const [recommend,  setRecommend]  = useState(module.findings[0]?.recommendation ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'>('idle')

  // ── Camera ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!camActive) return
    let alive = true
    async function startCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' }, audio:false })
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        const v = videoRef.current
        if (v) { v.srcObject = stream; v.muted = true; v.playsInline = true; v.play().catch(() => {}) }
        const poll = setInterval(() => {
          if (!alive) { clearInterval(poll); return }
          const vv = videoRef.current
          if (vv && vv.videoWidth > 0) { clearInterval(poll); if (alive) setCamReady(true) }
        }, 100)
      } catch {
        if (alive) setCamError(true)
      }
    }
    startCam()
    return () => { alive = false; streamRef.current?.getTracks().forEach(t => t.stop()); setCamReady(false) }
  }, [camActive])

  function captureFrame(): string | null {
    const v = videoRef.current, c = canvasRef.current
    if (!v || !c || v.videoWidth === 0) return null
    const MAX = 1600, ratio = Math.min(1, MAX / Math.max(v.videoWidth, v.videoHeight))
    c.width = Math.round(v.videoWidth * ratio); c.height = Math.round(v.videoHeight * ratio)
    const ctx = c.getContext('2d', { willReadFrequently:true })!
    ctx.drawImage(v, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.88).split(',')[1]
  }

  function handleLiveCapture() {
    const b64 = captureFrame()
    if (!b64) return
    streamRef.current?.getTracks().forEach(t => t.stop())
    setCamActive(false)
    setCapturedB64(b64)
    setPhotos([b64])
    runAI(b64)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      const b64 = result.includes(',') ? result.split(',')[1] : result
      setCapturedB64(b64)
      setPhotos([b64])
      runAI(b64)
    }
    reader.readAsDataURL(file)
  }

  function handleAdditionalPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        const result = ev.target?.result as string
        const b64 = result.includes(',') ? result.split(',')[1] : result
        setAdditionalPhotos(prev => [...prev, b64])
        // Run supplemental AI on each additional photo — APPENDS to existing findings
        runSupplementalAI(b64)
      }
      reader.readAsDataURL(file)
    })
  }

  // ── Supplemental AI — adds detail to existing analysis without overwriting ──
  const runSupplementalAI = useCallback(async (b64: string) => {
    // Compose a follow-up prompt that includes existing context
    const existingObs = findNote
    const existingRec = recommend
    const supplementPrompt = `You are reviewing an additional photograph of the same building element (module: ${module.id}).

${existingObs ? `EXISTING OBSERVATIONS ALREADY RECORDED:\n${existingObs}\n` : ''}
${existingRec ? `EXISTING RECOMMENDATION:\n${existingRec}\n` : ''}

Analyse this ADDITIONAL photo and return ONLY a JSON object with these fields:
- "additionalObservations": string — new details visible in THIS photo that ADD to the existing notes. Do NOT repeat what is already recorded. Focus on new angles, additional defects, or confirmation of existing findings.
- "updatedRecommendation": string or null — only if this photo reveals something that changes or strengthens the recommendation. null if the existing recommendation still stands.
- "severity": "none"|"minor"|"major"|"critical" — your assessment based on all evidence now seen.

Return ONLY valid JSON.`

    try {
      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageB64: b64, prompt: supplementPrompt }),
      })
      if (!res.ok) return
      const data = await res.json()
      const raw  = (data.text ?? '').replace(/```json|```/g, '').trim()
      const m    = raw.match(/\{[\s\S]*\}/)
      if (!m) return
      const parsed = JSON.parse(m[0])

      // APPEND — never overwrite existing text
      if (parsed.additionalObservations?.trim()) {
        setFindNote(prev => prev
          ? `${prev}\n\n[Additional photo] ${parsed.additionalObservations.trim()}`
          : parsed.additionalObservations.trim()
        )
      }
      if (parsed.updatedRecommendation?.trim()) {
        setRecommend(prev => prev
          ? `${prev}\n\n[Updated] ${parsed.updatedRecommendation.trim()}`
          : parsed.updatedRecommendation.trim()
        )
      }
      if (parsed.severity) setSeverity(parsed.severity as DefectSeverity)
    } catch {
      // Supplemental AI failure is silent — primary analysis is preserved
    }
  }, [module.id, findNote, recommend]) // eslint-disable-line

  // ── AI analysis ────────────────────────────────────────────────────────────
  const runAI = useCallback(async (b64: string) => {
    setStage('analysing'); setAiError(null); setAiFields(null)
    const prompt = getModulePrompt(module.id as ModuleId, job)
    try {
      const res  = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageB64: b64, prompt }),
      })
      if (!res.ok) throw new Error('Vision API error')
      const data = await res.json()
      const raw  = data.text ?? ''
      const m    = raw.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
      if (!m) throw new Error('Could not parse response')
      const parsed: AIFields = JSON.parse(m[0])
      setAiFields(parsed)
      if (parsed.condition)    setCondition(parsed.condition)
      if (parsed.severity)     setSeverity(parsed.severity as DefectSeverity)
      if (parsed.observations) setFindNote(parsed.observations)
      if (parsed.recommendation) setRecommend(parsed.recommendation)
      setStage('review')
    } catch (err: any) {
      setAiError(err.message ?? 'AI analysis failed')
      setStage('review')
    }
  }, [job, module.id])

  // ── Save ────────────────────────────────────────────────────────────────────
  function handleSave(status: 'complete'|'skipped'|'in_progress' = 'complete') {
    // Deduplicate: use first 100 chars of base64 as a fingerprint
    const seen = new Set<string>()
    const allPhotos = [...photos, ...additionalPhotos].filter(p => {
      if (!p || p.length < 50) return false
      const key = p.slice(0, 100)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const finding: ModuleFinding = {
      id:             `find-${Date.now()}`,
      label:          meta?.label ?? module.id,
      condition:      (condition as any) || 'typical',
      severity,
      notes:          findNote,
      recommendation: recommend || undefined,
      photos:         allPhotos.slice(0, 1), // primary photo only on the finding
      codeRef:        aiFields?.codeRef,
    }
    const updated: InspectionModule = {
      ...module,
      status,
      photos:     allPhotos,   // all deduplicated photos on the module
      notes,
      findings:   condition || findNote ? [finding] : [],
      aiSummary:  aiFields ? JSON.stringify(aiFields.measurements ?? {}) : undefined,
      capturedAt: new Date().toISOString(),
    }
    onSave(updated)
  }

  const canLiveCapture = !camError && typeof navigator !== 'undefined' && 'mediaDevices' in navigator

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100dvh', background:BG, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:'#0D1E2E', display:'flex', flexDirection:'column' }}>

      {/* ── Header ── */}
      <div style={{ background:NAVY, padding:'max(env(safe-area-inset-top,0px),1rem) 1.25rem 1rem', flexShrink:0 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.55)', fontSize:'0.85rem', cursor:'pointer', padding:'0 0 0.4rem' }}>← Back to phase</button>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.5rem' }}>
          <div>
            <h2 style={{ fontSize:'1.05rem', fontWeight:700, color:'#fff', margin:'0 0 0.15rem' }}>{meta?.label ?? module.id.replace(/_/g,' ')}</h2>
            <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.45)' }}>
              {meta?.codeRef && <span style={{ marginRight:'0.5rem', color:'rgba(242,147,55,0.8)' }}>{meta.codeRef}</span>}
              {meta?.description}
            </div>
          </div>
          {meta?.required && (
            <span style={{ fontSize:'0.6rem', color:ORANGE, background:'rgba(242,147,55,0.15)', border:`1px solid rgba(242,147,55,0.3)`, padding:'0.18rem 0.5rem', borderRadius:5, flexShrink:0 }}>Required</span>
          )}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'1rem 1.25rem 1rem' }}>

        {/* ══ CAPTURE stage ══ */}
        {stage === 'capture' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>

            {/* Live camera viewfinder */}
            {camActive && (
              <div style={{ position:'relative', borderRadius:12, overflow:'hidden', background:'#000', aspectRatio:'4/3' }}>
                <video ref={videoRef} autoPlay playsInline muted
                  // @ts-ignore
                  webkit-playsinline="true"
                  style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                <canvas ref={canvasRef} style={{ display:'none' }}/>
                {!camReady && (
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)' }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', border:`3px solid rgba(255,255,255,0.2)`, borderTopColor:'#fff', animation:'spin 0.8s linear infinite' }}/>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}>`}</style>
                  </div>
                )}
                {/* Capture button */}
                {camReady && (
                  <div style={{ position:'absolute', bottom:'1rem', left:0, right:0, display:'flex', justifyContent:'center', gap:'1rem' }}>
                    <button onClick={handleLiveCapture}
                      style={{ width:64, height:64, borderRadius:'50%', background:'#fff', border:'4px solid rgba(255,255,255,0.6)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }}>
                      <div style={{ width:48, height:48, borderRadius:'50%', background:NAVY }}/>
                    </button>
                    <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setCamActive(false) }}
                      style={{ position:'absolute', top:'-2.5rem', right:'1rem', background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#fff', fontSize:'0.72rem', padding:'0.35rem 0.7rem', cursor:'pointer' }}>Cancel</button>
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            {!camActive && (
              <div style={{ background:'rgba(65,124,164,0.06)', border:`1px solid rgba(65,124,164,0.2)`, borderRadius:11, padding:'0.85rem 1rem', fontSize:'0.78rem', color:'#3A5A78', lineHeight:1.65 }}>
                <div style={{ fontWeight:600, color:'#0D1E2E', marginBottom:'0.2rem' }}>Photograph for AI analysis</div>
                The AI will inspect the image and automatically fill in condition, severity, observations, and all relevant code compliance checks for this module.
              </div>
            )}

            {/* Previous photo preview */}
            {capturedB64 && !camActive && (
              <div>
                <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.4rem' }}>Current photo</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc(capturedB64)} alt="captured" style={{ width:'100%', borderRadius:10, objectFit:'cover', maxHeight:260, display:'block', border:`1px solid ${BORDER}` }}/>
              </div>
            )}

            {/* Capture / Upload buttons */}
            {!camActive && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.6rem' }}>
                {canLiveCapture && !camError && (
                  <button onClick={() => setCamActive(true)}
                    style={{ padding:'0.85rem', background:`linear-gradient(135deg,${NAVY},#1A3A5C)`, border:'none', borderRadius:11, color:'#fff', fontWeight:700, fontSize:'0.82rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.45rem', boxShadow:'0 2px 10px rgba(10,28,46,0.25)' }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <rect x="1" y="4" width="16" height="12" rx="2" stroke="#fff" strokeWidth="1.4"/>
                      <circle cx="9" cy="10" r="3.5" stroke="#fff" strokeWidth="1.4"/>
                      <path d="M6 4V3h6v1" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    Live Capture
                  </button>
                )}
                <button onClick={() => fileRef.current?.click()}
                  style={{ padding:'0.85rem', background:'#fff', border:`1.5px solid rgba(65,124,164,0.35)`, borderRadius:11, color:BLUE, fontWeight:700, fontSize:'0.82rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.45rem' }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M3 13V15h12v-2M9 3v9M6 6l3-3 3 3" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Upload Photo
                </button>
              </div>
            )}

            {/* Manual skip */}
            {!camActive && (
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={() => setStage('review')}
                  style={{ flex:1, padding:'0.72rem', background:'rgba(65,124,164,0.08)', border:`1px solid rgba(65,124,164,0.2)`, borderRadius:10, color:BLUE, fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
                  Fill in manually →
                </button>
                <button onClick={() => handleSave('skipped')}
                  style={{ flex:1, padding:'0.72rem', background:'#fff', border:`1px solid ${BORDER}`, borderRadius:10, color:'#9DB4C5', fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
                  Skip module
                </button>
              </div>
            )}

            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileUpload} style={{ display:'none' }}/>
          </div>
        )}

        {/* ══ ANALYSING stage ══ */}
        {stage === 'analysing' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', padding:'2rem 0' }}>
            {capturedB64 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgSrc(capturedB64)} alt="" style={{ width:'100%', borderRadius:12, opacity:0.55, filter:'blur(1px)', maxHeight:220, objectFit:'cover', display:'block' }}/>
            )}
            <div style={{ width:40, height:40, borderRadius:'50%', border:`3px solid rgba(65,124,164,0.15)`, borderTopColor:BLUE, animation:'spin 0.8s linear infinite' }}/>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'0.9rem', fontWeight:600, color:'#0D1E2E', marginBottom:'0.2rem' }}>Analysing for compliance…</div>
              <div style={{ fontSize:'0.72rem', color:'#5E7D9B' }}>Checking against {meta?.codeRef ?? 'building code'}</div>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}>`}</style>
          </div>
        )}

        {/* ══ REVIEW stage ══ */}
        {stage === 'review' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>

            {/* Photo thumbnail + retake */}
            {capturedB64 && (() => {
              const isPlaceholder = capturedB64.startsWith('[') || capturedB64.length < 50
              return (
                <div style={{ position:'relative', borderRadius:10, overflow:'hidden', border:`1px solid ${BORDER}`, background:'#EBF3FA' }}>
                  {isPlaceholder ? (
                    <div style={{ width:'100%', height:140, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6 }}>
                      <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
                        <rect x="1" y="3" width="18" height="14" rx="2" stroke={BLUE} strokeWidth="1.3" strokeOpacity="0.35"/>
                        <circle cx="6.5" cy="7.5" r="1.5" fill={BLUE} fillOpacity="0.35"/>
                        <path d="M1 13l4-4 3 3 3-3 4 4" stroke={BLUE} strokeWidth="1.3" strokeOpacity="0.35" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontSize:'0.65rem', color:'#9DB4C5' }}>Photo saved to server</span>
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={imgSrc(capturedB64)} alt="" style={{ width:'100%', borderRadius:10, objectFit:'cover', maxHeight:200, display:'block' }}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display='none' }}/>
                  )}
                  <button onClick={() => { setCapturedB64(null); setPhotos([]); setAiFields(null); setAiError(null); setStage('capture') }}
                    style={{ position:'absolute', top:'0.5rem', right:'0.5rem', padding:'0.3rem 0.65rem', background:'rgba(10,28,46,0.75)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:7, color:'#fff', fontSize:'0.68rem', fontWeight:600, cursor:'pointer' }}>
                    ↺ Retake
                  </button>
                </div>
              )
            })()}

            {/* AI result banner */}
            {aiFields && !aiError && (
              <div style={{ background:'rgba(39,169,107,0.07)', border:'1px solid rgba(39,169,107,0.3)', borderRadius:10, padding:'0.75rem 1rem', display:'flex', gap:'0.5rem', alignItems:'flex-start' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0, marginTop:1 }}>
                  <circle cx="8" cy="8" r="7" stroke={GREEN} strokeWidth="1.4"/>
                  <path d="M4.5 8l2.5 2.5 4.5-5" stroke={GREEN} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div style={{ fontSize:'0.75rem', color:'#1A7A50', lineHeight:1.5 }}>
                  <strong>AI analysis complete</strong> — fields pre-filled below. Review and edit as needed.
                  {aiFields.passesCode === false && <span style={{ color:RED, fontWeight:700 }}> Warning: Possible code non-compliance detected.</span>}
                  {aiFields.passesCode === true  && <span style={{ color:GREEN, fontWeight:700 }}> Appears code compliant.</span>}
                </div>
              </div>
            )}

            {/* AI error */}
            {aiError && (
              <div style={{ background:'rgba(242,147,55,0.08)', border:'1px solid rgba(242,147,55,0.3)', borderRadius:9, padding:'0.65rem 0.9rem', fontSize:'0.75rem', color:'#C4721E', lineHeight:1.5 }}>
                Could not analyse the image automatically. Fill in the fields below manually.
                {capturedB64 && <button onClick={() => runAI(capturedB64)} style={{ display:'block', marginTop:'0.5rem', padding:'0.3rem 0.7rem', background:ORANGE, border:'none', borderRadius:6, color:'#fff', fontSize:'0.72rem', fontWeight:700, cursor:'pointer' }}>Retry AI →</button>}
              </div>
            )}

            {/* AI measurements */}
            {aiFields?.measurements && Object.keys(aiFields.measurements).length > 0 && (
              <div>
                <div style={{ fontSize:'0.68rem', fontWeight:600, color:BLUE, letterSpacing:'0.04em', textTransform:'uppercase' as const, marginBottom:'0.4rem' }}>Extracted Measurements</div>
                <MeasurementPills data={aiFields.measurements as Record<string, unknown>} />
              </div>
            )}

            {/* Condition */}
            <div>
              <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.45rem' }}>Condition</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'0.3rem' }}>
                {CONDITIONS.map(c => (
                  <button key={c.value} onClick={() => setCondition(c.value)}
                    style={{ padding:'0.32rem 0.65rem', borderRadius:6, border:`1.5px solid ${condition === c.value ? c.color : BORDER}`, background: condition === c.value ? `${c.color}14` : '#fff', fontSize:'0.73rem', fontWeight: condition === c.value ? 700 : 500, color: condition === c.value ? c.color : '#5E7D9B', cursor:'pointer', transition:'all 0.1s' }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity */}
            {condition && (
              <div>
                <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.45rem' }}>Defect Severity</div>
                <div style={{ display:'flex', gap:'0.3rem' }}>
                  {SEVERITIES.map(s => {
                    const col = s.value==='none'?GREEN:s.value==='minor'?'#C48A00':s.value==='moderate'?ORANGE:s.value==='major'?'#C44000':RED
                    return (
                      <button key={s.value} onClick={() => setSeverity(s.value)}
                        style={{ flex:1, padding:'0.35rem 0.25rem', borderRadius:6, border:`1.5px solid ${severity===s.value?col:BORDER}`, background:severity===s.value?`${col}14`:'#fff', fontSize:'0.66rem', fontWeight:severity===s.value?700:500, color:severity===s.value?col:'#9DB4C5', cursor:'pointer', transition:'all 0.1s' }}>
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Observations */}
            <div>
              <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.35rem' }}>Observations</div>
              <textarea value={findNote} onChange={e => setFindNote(e.target.value)} placeholder="AI-filled or describe what was observed…" rows={3}
                style={{ width:'100%', padding:'0.65rem 0.85rem', background:'#fff', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:'0.82rem', color:'#0D1E2E', outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.55 }}/>
            </div>

            {/* Recommendation */}
            <div>
              <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.35rem' }}>Recommendation</div>
              <textarea value={recommend} onChange={e => setRecommend(e.target.value)} placeholder="Required action…" rows={2}
                style={{ width:'100%', padding:'0.65rem 0.85rem', background:'#fff', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:'0.82rem', color:'#0D1E2E', outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.55 }}/>
            </div>

            {/* All photos — unified grid (primary + additional) */}
            <div>
              <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.5rem' }}>
                Photos
                <span style={{ fontWeight:400, color:'#9DB4C5', marginLeft:'0.4rem' }}>
                  {photos.length + additionalPhotos.length} photo{photos.length + additionalPhotos.length !== 1 ? 's' : ''} · each new photo deepens the AI analysis
                </span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem', alignItems:'flex-start' }}>

                {/* Primary photo tile */}
                {photos[0] && (() => {
                  const p = photos[0]
                  const isPlaceholder = !p || p.startsWith('[') || p.length < 50
                  return (
                    <div style={{ position:'relative', width:76, height:76, borderRadius:8, overflow:'hidden', border:'2px solid rgba(65,124,164,0.5)', background:'#EBF3FA', flexShrink:0 }}>
                      {isPlaceholder ? (
                        <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <svg width="22" height="22" viewBox="0 0 20 20" fill="none"><rect x="1" y="3" width="18" height="14" rx="2" stroke={BLUE} strokeWidth="1.3" strokeOpacity="0.4"/><circle cx="6.5" cy="7.5" r="1.5" fill={BLUE} fillOpacity="0.4"/><path d="M1 13l4-4 3 3 3-3 4 4" stroke={BLUE} strokeWidth="1.3" strokeOpacity="0.4" strokeLinejoin="round"/></svg>
                        </div>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={imgSrc(p)} alt="primary" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display='none' }}/>
                      )}
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(10,28,46,0.6)', fontSize:'0.42rem', fontWeight:800, color:'#fff', textAlign:'center', padding:'2px 0', letterSpacing:'0.06em' }}>PRIMARY</div>
                      <button onClick={() => { setPhotos([]); setCapturedB64(null); setAiFields(null); setAiError(null); setStage('capture') }}
                        style={{ position:'absolute', top:2, right:2, width:20, height:20, borderRadius:'50%', background:'rgba(220,50,50,0.9)', border:'1.5px solid rgba(255,255,255,0.6)', color:'#fff', fontSize:'0.72rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, lineHeight:1, zIndex:2 }}>×</button>
                    </div>
                  )
                })()}

                {/* Additional photo tiles */}
                {additionalPhotos.map((p, i) => {
                  const isPlaceholder = !p || p.startsWith('[') || p.length < 50
                  return (
                    <div key={i} style={{ position:'relative', width:76, height:76, borderRadius:8, overflow:'hidden', border:`1.5px solid ${BORDER}`, background:'#EBF3FA', flexShrink:0 }}>
                      {isPlaceholder ? (
                        <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3 }}>
                          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="1" y="3" width="18" height="14" rx="2" stroke={BLUE} strokeWidth="1.3" strokeOpacity="0.35"/><circle cx="6.5" cy="7.5" r="1.5" fill={BLUE} fillOpacity="0.35"/><path d="M1 13l4-4 3 3 3-3 4 4" stroke={BLUE} strokeWidth="1.3" strokeOpacity="0.35" strokeLinejoin="round"/></svg>
                          <span style={{ fontSize:'0.45rem', color:BLUE, opacity:0.5 }}>#{i+2}</span>
                        </div>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={imgSrc(p)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display='none' }}/>
                      )}
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(10,28,46,0.5)', fontSize:'0.42rem', fontWeight:700, color:'rgba(255,255,255,0.85)', textAlign:'center', padding:'2px 0' }}>#{i+2}</div>
                      <button onClick={() => setAdditionalPhotos(prev => prev.filter((_,j) => j !== i))}
                        style={{ position:'absolute', top:2, right:2, width:20, height:20, borderRadius:'50%', background:'rgba(220,50,50,0.9)', border:'1.5px solid rgba(255,255,255,0.6)', color:'#fff', fontSize:'0.72rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, lineHeight:1, zIndex:2 }}>×</button>
                    </div>
                  )
                })}

                {/* Add button */}
                <button onClick={() => { const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.multiple=true; inp.onchange=(e)=>handleAdditionalPhotos(e as any); inp.click() }}
                  style={{ width:76, height:76, borderRadius:8, background:'#fff', border:`1.5px dashed rgba(65,124,164,0.3)`, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.3rem', flexShrink:0 }}>
                  <svg width="20" height="20" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke={BLUE} strokeWidth="1.3"/><line x1="9" y1="5.5" x2="9" y2="12.5" stroke={BLUE} strokeWidth="1.3" strokeLinecap="round"/><line x1="5.5" y1="9" x2="12.5" y2="9" stroke={BLUE} strokeWidth="1.3" strokeLinecap="round"/></svg>
                  <span style={{ fontSize:'0.6rem', color:BLUE, fontWeight:600 }}>Add Photo</span>
                </button>
              </div>
            </div>

            {/* Inspector notes (internal) */}
            <div>
              <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#9DB4C5', marginBottom:'0.35rem' }}>Inspector notes (internal)</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Private notes — not in client report" rows={2}
                style={{ width:'100%', padding:'0.65rem 0.85rem', background:'rgba(44,90,122,0.03)', border:`1px dashed rgba(44,90,122,0.18)`, borderRadius:8, fontSize:'0.78rem', color:'#5E7D9B', outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.55 }}/>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom action bar ── */}
      {stage !== 'analysing' && (
        <div style={{ padding:'0.75rem 1.25rem', paddingBottom:'max(env(safe-area-inset-bottom,0px),0.75rem)', borderTop:`1px solid ${BORDER}`, background:'#fff', display:'flex', gap:'0.45rem', flexShrink:0 }}>
          <button onClick={() => handleSave('skipped')}
            style={{ flex:1, padding:'0.8rem', background:'#fff', border:`1.5px solid ${BORDER}`, borderRadius:10, fontSize:'0.78rem', fontWeight:600, color:'#9DB4C5', cursor:'pointer' }}>
            Skip
          </button>
          {stage === 'review' && (
            <button onClick={() => { setStage('capture'); setAiFields(null); setAiError(null) }}
              style={{ flex:1, padding:'0.8rem', background:'rgba(65,124,164,0.08)', border:`1.5px solid rgba(65,124,164,0.2)`, borderRadius:10, fontSize:'0.78rem', fontWeight:600, color:BLUE, cursor:'pointer' }}>
              ↺ Retake
            </button>
          )}
          <button onClick={() => { setSaveStatus('saving'); handleSave('in_progress'); setTimeout(() => setSaveStatus('saved'), 600) }}
            style={{ flex:1, padding:'0.8rem', background: saveStatus==='saved'?GREEN:'rgba(65,124,164,0.1)', border:`1.5px solid ${saveStatus==='saved'?'rgba(39,169,107,0.4)':'rgba(65,124,164,0.25)'}`, borderRadius:10, fontSize:'0.78rem', fontWeight:700, color: saveStatus==='saved'?'#fff':BLUE, cursor:'pointer', transition:'all 0.2s' }}>
            {saveStatus==='saved'?'Saved':'Save Draft'}
          </button>
          <button onClick={() => handleSave('complete')}
            style={{ flex:2, padding:'0.8rem', background:`linear-gradient(135deg,${GREEN},#1A7A50)`, border:'none', borderRadius:10, fontSize:'0.82rem', fontWeight:700, color:'#fff', cursor:'pointer', boxShadow:'0 2px 8px rgba(39,169,107,0.35)' }}>
            Complete →
          </button>
        </div>
      )}
    </div>
  )
}
