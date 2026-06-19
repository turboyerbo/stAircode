/**
 * inspection-types.ts
 *
 * Core type system for the stAIrcode Full Building Inspection platform.
 *
 * Phase structure follows OBC mandatory inspection hold points
 * (Ontario Building Code Act, R.S.O. 1990 c. B.13 / Ontario Reg 332/12):
 *
 *   Phase 1 — Pre-Construction    (drawings review, permit)
 *   Phase 2 — Excavation/Footings (before concrete pour)
 *   Phase 3 — Foundation          (before backfill)
 *   Phase 4 — Framing/Rough-In    (before drywall)
 *   Phase 5 — Insulation          (before interior finishes)
 *   Phase 6 — Occupancy/Final     (full walkthrough, occupancy permit)
 *
 * Each phase contains modules. Built-in AI scan modules (stair, foundation,
 * accessibility) are embedded inside the correct phase — not exposed separately
 * on the home screen.
 *
 * The only standalone module exposed on the home screen is "Stair Compliance Demo"
 * (free, no subscription required).
 *
 * Supabase storage schema:
 *   table: inspection_jobs  — one row per InspectionJob
 *   storage bucket: inspection-photos — keyed by job_id/module_id/photo_index
 */

// ─── Drawings data types ─────────────────────────────────────────────────────

export interface DrawingsFields {
  permitNumber?:       string | null
  permitDate?:         string | null
  applicant?:          string | null
  architect?:          string | null
  engineer?:           string | null
  projectAddress?:     string | null
  zoneClass?:          string | null
  lotArea?:            number | null   // m²
  buildingArea?:       number | null   // m²
  grossFloorArea?:     number | null   // m²
  lotCoverage?:        string | null   // e.g. "35%"
  frontSetback?:       number | null   // metres
  rearSetback?:        number | null
  sideSetbackLeft?:    number | null
  sideSetbackRight?:   number | null
  buildingHeight?:     number | null   // metres
  stories?:            number | null
  parkingSpaces?:      number | null
  fireSeparation?:     string | null
  occupancyClass?:     string | null
  constructionType?:   string | null
  drawingSheets?:      string[]
  revisionDate?:       string | null
  codeNotes?:          string[]
  summary?:            string
}

// ─── Property / Job ──────────────────────────────────────────────────────────

export interface PropertyAddress {
  street:      string
  unit?:       string
  city:        string
  province:    string
  postalCode:  string
  country:     string
  lat?:        number
  lng?:        number
}

export type BuildingType =
  | 'single_storey_residential'
  | 'two_storey_residential'
  | 'multi_unit_residential'
  | 'semi_detached'
  | 'townhouse'
  | 'commercial'
  | 'industrial'
  | 'mixed_use'
  | 'other'

export type RoofCovering =
  | 'concrete_tiles' | 'clay_tiles' | 'metal_deck' | 'asphalt_shingles'
  | 'flat_membrane' | 'fibreglass' | 'other' | 'unknown'

export type FootingType =
  | 'concrete_slab' | 'piers_stumps' | 'strip_footing' | 'unknown'

export type WallConstruction =
  | 'brick_veneer' | 'double_brick' | 'timber_frame' | 'concrete_block'
  | 'icf' | 'steel_frame' | 'other' | 'unknown'

export type WeatherCondition =
  | 'fine' | 'overcast' | 'light_rain' | 'heavy_rain' | 'windy' | 'other'

export type ProjectType = 'new_construction' | 'renovation'

export type InspectionJobStatus =
  | 'active'        // in progress
  | 'on_hold'       // awaiting inspector or materials
  | 'complete'      // all phases done, final report generated
  | 'archived'      // closed, kept for record

export interface InspectionJob {
  id:          string
  createdAt:   string
  updatedAt:   string
  status:      InspectionJobStatus

  // Project classification
  projectType: ProjectType     // 'new_construction' | 'renovation'

  // Client & inspector
  clientName:     string
  clientEmail?:   string
  clientPhone?:   string
  inspectorName:  string
  licenceNumber?: string
  company?:       string

  // Property
  address:         PropertyAddress
  buildingType:    BuildingType
  estimatedAge:    string
  roofCovering:    RoofCovering
  footingType:     FootingType
  wallConstruction: WallConstruction
  internalWalls:   string
  windows:         string
  isOccupied:      boolean
  isSecure:        boolean

  // Inspection context
  inspectionDate:  string
  weather:         WeatherCondition
  purposeNote:     string

  // Permit / pre-construction
  permitNumber?:   string
  permitIssuedDate?: string
  drawingsReviewed?: boolean

  // Phase progress
  phases:          InspectionPhase[]
  overallCondition: OverallCondition | null

  // AI chat history
  chatMessages:    ChatMessage[]

  // Drawings data — extracted from approved plans, referenced throughout inspection
  drawingsData?: {
    pages:          string[]        // base64 JPEGs of drawing pages (stored compressed)
    fields:         DrawingsFields  // auto-extracted structured data
    chatMessages:   Array<{ role: 'user'|'assistant'; content: string }>
    uploadedAt:     string
    pageCount:      number
    fileNames:      string[]
  }

  // Collaborators — additional users who can view/edit this project
  collaborators?: Array<{
    email:   string
    role:    'co-inspector' | 'viewer' | 'client'
    addedAt: string
  }>

  // Report
  reportGenerated: boolean
  reportUrl?:      string
  reportModuleId?: string
  ahjEmail?:       string    // Authority Having Jurisdiction email for permit submission
  inspectorEmail?: string    // inspector's own email
  propertyThumbnail?: string // base64 JPEG thumbnail, survives save stripping for cross-device display

  // Server sync
  supabaseId?:     string    // row ID in inspection_jobs table
  userId?:         string    // Supabase auth user ID
  lastSyncedAt?:   string
}

// ─── Phase & Module system ────────────────────────────────────────────────────

export type PhaseId =
  | 'property_setup'          // 0 — address, permit, drawings
  | 'pre_construction'        // 1 — drawings review, permit issuance
  | 'excavation_footings'     // 2 — before concrete pour (OBC hold point)
  | 'foundation'              // 3 — before backfill (OBC hold point)
  | 'framing_rough_in'        // 4 — before drywall (largest inspection)
  | 'insulation'              // 5 — before interior finishes
  | 'occupancy_final'         // 6 — full walkthrough, occupancy permit

export type PhaseStatus = 'pending' | 'in_progress' | 'complete' | 'skipped' | 'not_applicable'

export type OverallCondition =
  | 'above_average' | 'typical' | 'average' | 'below_average' | 'poor'

export type DefectSeverity = 'none' | 'minor' | 'moderate' | 'major' | 'critical'

export interface InspectionPhase {
  id:           PhaseId
  status:       PhaseStatus
  startedAt?:   string
  completedAt?: string
  holdPoint?:   boolean
  modules:      InspectionModule[]
  phaseNotes:   string
  inspectorSignOff?: {
    signed:     boolean
    signedBy?:  string
    signedAt?:  string
    permitRef?: string
  }
  // Per-phase report section — generated independently, collated into final report
  reportPdfB64?:        string    // base64 PDF section for this phase
  reportGeneratedAt?:   string    // when this phase section was last generated
}

// ─── Module types ─────────────────────────────────────────────────────────────

export type ModuleId =
  // Property Setup
  | 'property_details'
  // Pre-Construction
  | 'drawings_review' | 'permit_issuance' | 'site_plan_review'
  // Excavation / Footings
  | 'footing_depth' | 'footing_width' | 'bearing_soil' | 'drain_tile'
  // Foundation
  | 'foundation_inspection'  // AI built-in scan
  | 'damp_proofing' | 'foundation_drainage' | 'window_wells'
  // Framing / Rough-In
  | 'structural_framing' | 'floor_systems' | 'roof_framing_rough'
  | 'rough_plumbing' | 'rough_electrical' | 'rough_hvac'
  | 'fire_blocking' | 'stair_rough'
  // Insulation
  | 'insulation_walls' | 'insulation_ceiling' | 'vapour_barrier'
  | 'window_door_rough_openings'
  // Occupancy / Final
  | 'interior_finishes' | 'ceilings' | 'internal_walls'
  | 'floors_final'
  | 'stairs'               // general visual
  | 'stair_compliance'     // AI built-in scan
  | 'guardrails_handrails'
  | 'exterior_walls' | 'exterior_cracks'
  | 'eaves_fascia_soffit'
  | 'porches_decks'
  | 'windows_final' | 'doors_final'
  | 'wet_areas_kitchen' | 'wet_areas_bathrooms' | 'wet_areas_laundry'
  | 'accessibility'        // AI built-in scan
  | 'smoke_co_detectors'
  | 'egress_windows'
  | 'garage_final'
  | 'decks_balconies'
  | 'site_grading' | 'site_drainage' | 'driveway_paths'
  // Roofing (full system)
  | 'roof_covering'
  | 'roof_flat'
  | 'roof_flashings'
  | 'roof_drainage'
  | 'chimneys'
  | 'skylights'
  | 'attic_access'
  // Electrical (full system)
  | 'electrical_service_entrance'
  | 'electrical_panel'        // label photo required
  | 'electrical_branch_wiring'
  | 'electrical_gfci_afci'
  | 'electrical_smoke_co'
  // Plumbing (full system)
  | 'plumbing_water_main'
  | 'plumbing_distribution'
  | 'plumbing_dwv'            // drain waste vent
  | 'plumbing_fixtures'
  | 'hot_water_system'        // label photo required
  // HVAC (full system)
  | 'hvac_furnace'            // label photo required
  | 'hvac_ac'                 // label photo required
  | 'hvac_venting_combustion'
  | 'hvac_thermostat'
  // Fireplace
  | 'fireplace_wett'
  // Appliances
  | 'appliances_kitchen'      // label photos required
  | 'appliances_laundry'      // label photos required
  // Legacy / general
  | 'services_electrical' | 'services_plumbing' | 'services_gas'
  | 'hvac_final'
  | 'swimming_pool'

export type ModuleStatus = 'pending' | 'in_progress' | 'complete' | 'skipped' | 'na'

export interface ModuleFinding {
  id:             string
  label:          string
  condition:      OverallCondition | 'good' | 'fair' | 'poor' | 'na'
  severity:       DefectSeverity
  notes:          string
  photos:         string[]
  recommendation?: string
  codeRef?:       string
}

export interface InspectionModule {
  id:           ModuleId
  status:       ModuleStatus
  findings:     ModuleFinding[]
  aiSummary?:   string
  capturedAt?:  string
  photos:       string[]
  notes:        string
  isBuiltIn:    boolean
}

// ─── AI Chat ──────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  timestamp: string
  phase?:    PhaseId
  module?:   ModuleId
  photos?:   string[]
}

// ─── Phase metadata — OBC 6-phase construction sequence ──────────────────────

export const PHASE_META: Record<PhaseId, {
  label:         string
  shortLabel:    string
  description:   string
  holdPoint:     boolean          // OBC mandatory inspector sign-off
  icon:          string
  modules:       ModuleId[]
  reportSection: string
  obcRef:        string
}> = {
  property_setup: {
    label:       'Property Setup',
    shortLabel:  'Setup',
    description: 'Address, permit number, building type, client and inspector details',
    holdPoint:   false,
    icon:        'setup',
    modules:     ['property_details'],
    reportSection: 'Client & Site Information',
    obcRef:      '',
  },
  pre_construction: {
    label:       'Phase 1 — Pre-Construction',
    shortLabel:  'Pre-Construction',
    description: 'Drawings review, permit issuance, site plan. Desk review — no physical inspection. Confirm proposed design meets code before construction begins.',
    holdPoint:   true,
    icon:        'drawings',
    modules:     ['drawings_review', 'permit_issuance', 'site_plan_review'],
    reportSection: 'Phase 1 — Pre-Construction',
    obcRef:      'OBC Act s.8 — Permit required before construction',
  },
  excavation_footings: {
    label:       'Phase 2 — Excavation & Footings',
    shortLabel:  'Footings',
    description: 'Inspector visits before concrete is poured. Confirms footing depth, width, and bearing soil. Mandatory hold point — cannot pour until inspector signs off.',
    holdPoint:   true,
    icon:        'footing',
    modules:     ['footing_depth', 'footing_width', 'bearing_soil', 'drain_tile'],
    reportSection: 'Phase 2 — Excavation & Footings',
    obcRef:      'OBC 9.15.1 — Footings below frost depth; 9.15.3 — Minimum footing width',
  },
  foundation: {
    label:       'Phase 3 — Foundation',
    shortLabel:  'Foundation',
    description: 'After forming, before backfill. Inspector checks foundation walls for thickness, reinforcement, damp-proofing, and drainage. Mandatory hold point.',
    holdPoint:   true,
    icon:        'foundation',
    modules:     ['foundation_inspection', 'damp_proofing', 'foundation_drainage', 'window_wells'],
    reportSection: 'Phase 3 — Foundation',
    obcRef:      'OBC 9.15.4 — Wall thickness; 9.13 — Dampproofing; 9.14 — Drainage',
  },
  framing_rough_in: {
    label:       'Phase 4 — Framing & Rough-In',
    shortLabel:  'Framing',
    description: 'Largest single inspection. Full structural walkthrough before drywall. Checks structural framing, floor/roof systems, rough plumbing, rough electrical, rough HVAC, fire blocking, and insulation.',
    holdPoint:   true,
    icon:        'framing',
    modules:     ['structural_framing', 'floor_systems', 'roof_framing_rough', 'rough_plumbing', 'rough_electrical', 'rough_hvac', 'fire_blocking', 'stair_rough'],
    reportSection: 'Phase 4 — Framing & Rough-In',
    obcRef:      'OBC Part 9 — Housing & Small Buildings; 9.4 — Excavation; 9.23 — Wood Frame Construction',
  },
  insulation: {
    label:       'Phase 5 — Insulation',
    shortLabel:  'Insulation',
    description: 'Confirmed before interior finishes. R-values, vapour barrier continuity, and window/door rough openings.',
    holdPoint:   true,
    icon:        'insulation',
    modules:     ['insulation_walls', 'insulation_ceiling', 'vapour_barrier', 'window_door_rough_openings'],
    reportSection: 'Phase 5 — Insulation',
    obcRef:      'OBC 9.25 — Thermal Insulation; 9.25.3 — Vapour Barrier',
  },
  occupancy_final: {
    label:       'Phase 6 — Occupancy & Final',
    shortLabel:  'Final',
    description: 'Full walkthrough of the completed home. All finishes, mechanical systems, stairs, guardrails, smoke/CO detectors, egress windows, grading, and drainage. Occupancy permit issued on pass.',
    holdPoint:   true,
    icon:        'final',
    modules:     [
      // Exterior envelope
      'exterior_walls', 'exterior_cracks', 'eaves_fascia_soffit', 'porches_decks',
      'windows_final', 'doors_final',
      // Roofing system
      'roof_covering', 'roof_flat', 'roof_flashings', 'roof_drainage', 'chimneys', 'skylights',
      // Attic
      'attic_access',
      // Structure
      'structural_framing', 'floor_systems',
      // Interior
      'interior_finishes', 'ceilings', 'internal_walls', 'floors_final',
      'stairs', 'stair_compliance', 'guardrails_handrails',
      // Wet areas
      'wet_areas_kitchen', 'wet_areas_bathrooms', 'wet_areas_laundry',
      // Electrical system
      'electrical_service_entrance', 'electrical_panel',
      'electrical_branch_wiring', 'electrical_gfci_afci', 'electrical_smoke_co',
      // Plumbing system
      'plumbing_water_main', 'plumbing_distribution', 'plumbing_dwv', 'plumbing_fixtures',
      // Hot water
      'hot_water_system',
      // HVAC system
      'hvac_thermostat', 'hvac_furnace', 'hvac_ac', 'hvac_venting_combustion',
      // Fireplace
      'fireplace_wett',
      // Appliances
      'appliances_kitchen', 'appliances_laundry',
      // Safety
      'smoke_co_detectors', 'egress_windows', 'accessibility',
      // Site
      'site_grading', 'site_drainage', 'driveway_paths',
      // Optional
      'garage_final', 'decks_balconies', 'swimming_pool',
    ],
    reportSection: 'Phase 6 — Occupancy & Final Inspection',
    obcRef:      'OBC Act s.10 — Occupancy Permit; OBC 9.9 — Stairs; 9.8 — Guards',
  },
}

export const MODULE_META: Partial<Record<ModuleId, {
  label:       string
  description: string
  required:    boolean
  isBuiltIn:   boolean
  codeRef?:    string
}>> = {
  // Setup
  property_details:          { label: 'Property Details',         description: 'Address, type, age, materials', required: true,  isBuiltIn: false },
  // Pre-construction
  drawings_review:           { label: 'Drawings Review',          description: 'Submitted drawings, code compliance check', required: true, isBuiltIn: false, codeRef: 'OBC Act s.8' },
  permit_issuance:           { label: 'Building Permit',          description: 'Permit number, issue date, conditions', required: true, isBuiltIn: false, codeRef: 'OBC Act s.8' },
  site_plan_review:          { label: 'Site Plan Review',         description: 'Setbacks, grading plan, lot coverage', required: false, isBuiltIn: false },
  // Excavation / Footings
  footing_depth:             { label: 'Footing Depth',            description: 'Below frost depth confirmation', required: true, isBuiltIn: false, codeRef: 'OBC 9.15.1' },
  footing_width:             { label: 'Footing Width',            description: 'Minimum footing width per wall thickness', required: true, isBuiltIn: false, codeRef: 'OBC 9.15.3' },
  bearing_soil:              { label: 'Bearing Soil Condition',   description: 'Soil capacity and condition', required: true, isBuiltIn: false, codeRef: 'OBC 9.15.2' },
  drain_tile:                { label: 'Drain Tile / Weeping Tile', description: 'Perimeter drainage installation', required: false, isBuiltIn: false, codeRef: 'OBC 9.14' },
  // Foundation
  foundation_inspection:     { label: 'Foundation AI Scan',       description: 'Wall type, cracks, thickness, footing — AI scan', required: true, isBuiltIn: true, codeRef: 'OBC 9.15.4' },
  damp_proofing:             { label: 'Damp-proofing',            description: 'Membrane application and continuity', required: true, isBuiltIn: false, codeRef: 'OBC 9.13' },
  foundation_drainage:       { label: 'Foundation Drainage',      description: 'Drainage board, gravel bed, outlet', required: true, isBuiltIn: false, codeRef: 'OBC 9.14' },
  window_wells:              { label: 'Window Wells',             description: 'Egress window well dimensions and drainage', required: false, isBuiltIn: false },
  // Framing / Rough-In
  structural_framing:        { label: 'Structural Framing',       description: 'Wood frame, beams, columns, connections', required: true, isBuiltIn: false, codeRef: 'OBC 9.23' },
  floor_systems:             { label: 'Floor Systems',            description: 'Joists, spans, bearing, subfloor', required: true, isBuiltIn: false, codeRef: 'OBC 9.23' },
  roof_framing_rough:        { label: 'Roof Framing',             description: 'Trusses, rafters, ridge, bracing', required: true, isBuiltIn: false, codeRef: 'OBC 9.23.13' },
  rough_plumbing:            { label: 'Rough Plumbing',           description: 'Drain, waste, vent — before walls close', required: true, isBuiltIn: false, codeRef: 'OBC Part 7' },
  rough_electrical:          { label: 'Rough Electrical',         description: 'Panel, wiring routes, boxes — before drywall', required: true, isBuiltIn: false, codeRef: 'OBC Part 8' },
  rough_hvac:                { label: 'Rough HVAC',               description: 'Ducts, equipment rough-in, combustion air', required: true, isBuiltIn: false, codeRef: 'OBC Part 6' },
  fire_blocking:             { label: 'Fire Blocking',            description: 'Blocking in wall cavities, penetrations', required: true, isBuiltIn: false, codeRef: 'OBC 9.10.17' },
  stair_rough:               { label: 'Stair Rough Framing',      description: 'Stringer spacing, landing framing', required: false, isBuiltIn: false, codeRef: 'OBC 9.8.4' },
  // Insulation
  insulation_walls:          { label: 'Wall Insulation',          description: 'R-value, type, installation', required: true, isBuiltIn: false, codeRef: 'OBC 9.25' },
  insulation_ceiling:        { label: 'Ceiling/Attic Insulation', description: 'R-value, coverage, venting clearance', required: true, isBuiltIn: false, codeRef: 'OBC 9.25' },
  vapour_barrier:            { label: 'Vapour Barrier',           description: 'Poly continuity, lapping, sealing', required: true, isBuiltIn: false, codeRef: 'OBC 9.25.3' },
  window_door_rough_openings: { label: 'Window & Door ROs',       description: 'Rough opening sizes, headers, sealing', required: false, isBuiltIn: false },
  // Occupancy / Final
  interior_finishes:         { label: 'Interior Finishes',        description: 'Drywall, trim, paint, overall condition', required: true, isBuiltIn: false },
  ceilings:                  { label: 'Ceilings',                 description: 'Lining, staining, cracking, heights', required: true, isBuiltIn: false },
  internal_walls:            { label: 'Internal Walls',           description: 'Plasterboard, cracking, damp', required: true, isBuiltIn: false },
  stairs:                    { label: 'Stairs — Visual',          description: 'General visual condition, handrails', required: false, isBuiltIn: false, codeRef: 'OBC 9.8.4' },
  stair_compliance:          { label: 'Stair Compliance (AI)',    description: 'AI measurement scan — OBC/IBC/NBC', required: false, isBuiltIn: true, codeRef: 'OBC 9.8.4' },
  guardrails_handrails:      { label: 'Guardrails & Handrails',   description: 'Height, baluster spacing, graspability', required: true, isBuiltIn: false, codeRef: 'OBC 9.8.7' },
  exterior_walls:            { label: 'Exterior Walls',           description: 'Cladding, paint, moisture, condition', required: true, isBuiltIn: false },
  exterior_cracks:           { label: 'Exterior Cracking',        description: 'Crack type, severity, location', required: true, isBuiltIn: false },
  windows_final:             { label: 'Windows (Final)',          description: 'Egress openings, sill heights, operation', required: true, isBuiltIn: false, codeRef: 'OBC 9.7' },
  doors_final:               { label: 'Doors (Final)',            description: 'Hardware, weatherstripping, operation', required: false, isBuiltIn: false },
  wet_areas_kitchen:         { label: 'Kitchen',                  description: 'Fixtures, tiles, moisture, ventilation', required: true, isBuiltIn: false },
  wet_areas_bathrooms:       { label: 'Bathrooms',                description: 'Shower, tiles, WC, grab bars, seals', required: true, isBuiltIn: false },
  wet_areas_laundry:         { label: 'Laundry',                  description: 'Tubs, taps, drainage, ventilation', required: false, isBuiltIn: false },
  accessibility:             { label: 'Accessibility (AI)',       description: 'OBC 2024 / AODA guided scan', required: false, isBuiltIn: true, codeRef: 'OBC 3.8 / AODA' },
  smoke_co_detectors:        { label: 'Smoke & CO Detectors',     description: 'Placement, type, interconnection', required: true, isBuiltIn: false, codeRef: 'OBC 9.10.19' },
  egress_windows:            { label: 'Egress Windows',           description: 'Minimum opening size, sill height, operation', required: true, isBuiltIn: false, codeRef: 'OBC 9.7.2' },
  garage_final:              { label: 'Garage (Final)',           description: 'Doors, floor, fire separation, CO', required: false, isBuiltIn: false },
  decks_balconies:           { label: 'Decks & Balconies',        description: 'Structure, drainage, guardrails, fixings', required: false, isBuiltIn: false, codeRef: 'OBC 9.8.7' },
  site_grading:              { label: 'Site Grading',             description: 'Drainage slope away from foundation', required: true, isBuiltIn: false, codeRef: 'OBC 9.12' },
  site_drainage:             { label: 'Surface Drainage',         description: 'Ponding, run-off, storm outlets', required: false, isBuiltIn: false },
  driveway_paths:            { label: 'Driveway & Paths',         description: 'Surface, condition, trip hazards', required: false, isBuiltIn: false },
  // Legacy entries kept for backward compat with old job data
  services_electrical:       { label: 'Electrical (Final)',       description: 'Panel, fixtures, outlets, safety switches', required: false, isBuiltIn: false },
  services_plumbing:         { label: 'Plumbing (Final)',         description: 'All fixtures, water pressure, waste', required: false, isBuiltIn: false },
  services_gas:              { label: 'Gas (Final)',              description: 'Appliances connected, licensed', required: false, isBuiltIn: false },
  hvac_final:                { label: 'HVAC (Final)',             description: 'Equipment operation, fresh air, filters', required: false, isBuiltIn: false },
  swimming_pool:             { label: 'Swimming Pool',            description: 'Pool fencing compliance — specialist referral', required: false, isBuiltIn: false },

  // ── Exterior ──────────────────────────────────────────────────────────────
  floors_final:              { label: 'Floors',                   description: 'Floor covering condition, wear, trip hazards', required: false, isBuiltIn: false },
  eaves_fascia_soffit:       { label: 'Eaves, Fascia & Soffit',   description: 'Material, paint, rot, condition. Inspect from ground.', required: false, isBuiltIn: false, codeRef: 'OBC 9.27' },
  porches_decks:             { label: 'Porches & Decks',          description: 'Wood condition, structural elements, rot, sealing. Note limited underside access.', required: false, isBuiltIn: false },

  // ── Roofing System ────────────────────────────────────────────────────────
  roof_covering:             { label: 'Roof Covering (Sloped)',   description: 'Shingle/tile condition, curling, missing pieces, service life. Inspect with binoculars or camera zoom from ground.', required: true, isBuiltIn: false, codeRef: 'OBC 9.27' },
  roof_flat:                 { label: 'Flat Roof / Membrane',     description: 'Modified bitumen, TPO or built-up condition. Visible portion. Note any deck cover obstructions.', required: false, isBuiltIn: false, codeRef: 'OBC 9.26' },
  roof_flashings:            { label: 'Roof Flashings',           description: 'Chimney, plumbing stack, skylight, valley flashings. Check for separation, caulking failure.', required: true, isBuiltIn: false, codeRef: 'OBC 9.27.3' },
  roof_drainage:             { label: 'Roof Drainage',            description: 'Eaves troughs, downspouts, above/below ground drainage. Condition and clearance.', required: false, isBuiltIn: false },
  chimneys:                  { label: 'Chimney(s)',               description: 'Inspect from ground — brick spalling, mortar loss, cap, flashing. Photo each chimney. Note whether active or disused.', required: false, isBuiltIn: false },
  skylights:                 { label: 'Skylight(s)',              description: 'Interior moisture, frame condition, flashing. Note any condensation or staining.', required: false, isBuiltIn: false },
  attic_access:              { label: 'Attic',                    description: 'Access hatch location, insulation type and depth (if visible), ventilation, evidence of moisture or pest. Note if no access.', required: false, isBuiltIn: false, codeRef: 'OBC 9.19' },

  // ── Electrical System ─────────────────────────────────────────────────────
  electrical_service_entrance: { label: 'Service Entrance',      description: 'Overhead or underground feed, conductor material (copper/aluminium), service voltage. Photo the meter and entry point.', required: true, isBuiltIn: false, codeRef: 'OBC Part 8' },
  electrical_panel:            { label: 'Distribution Panel',    description: 'Panel location, breaker type, rated amperage, room for expansion, double-tapped breakers, labelling. PHOTOGRAPH THE DATA PLATE and interior panel clearly — same as Pillar to Post standard.', required: true, isBuiltIn: false, codeRef: 'OBC Part 8' },
  electrical_branch_wiring:    { label: 'Branch Circuit Wiring', description: 'Conductor material (copper/aluminium), NMD type, grounding. Note any aluminium branch circuits — requires further evaluation.', required: true, isBuiltIn: false, codeRef: 'OBC Part 8' },
  electrical_gfci_afci:        { label: 'GFCI & AFCI Devices',   description: 'GFCI tested in wet areas (kitchen, bathrooms, exterior). AFCI where required. Note missing protection.', required: true, isBuiltIn: false, codeRef: 'OBC 9.10.5' },
  electrical_smoke_co:         { label: 'Smoke & CO Alarms',     description: 'Alarm present on all levels and in each unit. Test button. Note missing locations. CO alarms required within 5m of each sleeping area (Ontario Fire Code).', required: true, isBuiltIn: false, codeRef: 'OFC s.2.13 / OBC 9.10.19' },

  // ── Plumbing System ───────────────────────────────────────────────────────
  plumbing_water_main:         { label: 'Water Main & Shutoff',  description: 'Material (copper/lead/galvanised), meter location, main shutoff valve presence and operability. PHOTOGRAPH the shutoff valve. Note if handle is missing.', required: true, isBuiltIn: false, codeRef: 'OBC Part 7' },
  plumbing_distribution:       { label: 'Distribution Piping',   description: 'Supply pipe material, water pressure/flow with multiple fixtures running simultaneously. Note any evidence of prior repairs.', required: true, isBuiltIn: false, codeRef: 'OBC Part 7' },
  plumbing_dwv:                { label: 'Drain, Waste & Vent',   description: 'Visible DWV piping material (ABS/cast iron), drainage test — fill sinks/tubs, flush toilets. Note slow drainage or gurgling.', required: true, isBuiltIn: false, codeRef: 'OBC Part 7' },
  plumbing_fixtures:           { label: 'Fixtures & Faucets',    description: 'Sinks, toilets, tubs, showers — fill and drain each. Shower wall stability test. Floor drain function.', required: true, isBuiltIn: false },

  // ── Hot Water System ──────────────────────────────────────────────────────
  hot_water_system:            { label: 'Water Heater',          description: 'Type (tank/tankless), fuel, capacity, year of manufacture. PHOTOGRAPH THE DATA PLATE (model, serial, BTU, year). Check venting, TPR valve, gas shutoff. Note age — typical service life 10–12 years.', required: true, isBuiltIn: false, codeRef: 'OBC 7.6.4' },

  // ── HVAC System ───────────────────────────────────────────────────────────
  hvac_thermostat:             { label: 'Thermostat',            description: 'Location, type, test heating/cooling cycle using normal operating controls.', required: false, isBuiltIn: false },
  hvac_furnace:                { label: 'Furnace',               description: 'Fuel type, efficiency rating, year. PHOTOGRAPH THE DATA PLATE (model, serial, BTU input/output). Test using normal operating controls. Note any error codes, leaks, or unusual sounds. Check filter condition.', required: true, isBuiltIn: false, codeRef: 'OBC Part 6' },
  hvac_ac:                     { label: 'Air Conditioning',      description: 'System type, refrigerant type, year. PHOTOGRAPH THE DATA PLATE on the exterior condenser unit. Test operation. Note age — typical service life 15 years. Check for evidence of refrigerant leakage inside furnace cabinet.', required: false, isBuiltIn: false },
  hvac_venting_combustion:     { label: 'Combustion & Venting',  description: 'Flue pipe material (Gas 636, B-vent, SS liner), condition, securing, exterior termination. Power-vented or natural-draft. Combustion air supply.', required: true, isBuiltIn: false, codeRef: 'OBC 6.8' },

  // ── Fireplace ─────────────────────────────────────────────────────────────
  fireplace_wett:              { label: 'Fireplace / WETT',      description: 'Type (wood/gas/electric), visible condition of firebox, damper, hearth extension. Recommend WETT inspection by qualified inspector before use. Note if chimney is active or disused.', required: false, isBuiltIn: false },

  // ── Appliances ────────────────────────────────────────────────────────────
  appliances_kitchen:          { label: 'Kitchen Appliances',    description: 'Refrigerator, range/oven, dishwasher, range hood — test each using normal operating controls. PHOTOGRAPH THE DATA PLATE (brand, model, serial) on each appliance. Note non-functional items.', required: false, isBuiltIn: false },
  appliances_laundry:          { label: 'Laundry Appliances',    description: 'Washer and dryer — test basic cycle. PHOTOGRAPH THE DATA PLATE on each. Note dryer venting (should exhaust to exterior). Note any staining or evidence of past leaks.', required: false, isBuiltIn: false },
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

export function createNewJob(partial: Partial<InspectionJob> = {}): InspectionJob {
  const id  = `insp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()

  const phases: InspectionPhase[] = (Object.keys(PHASE_META) as PhaseId[]).map(phaseId => ({
    id:        phaseId,
    status:    phaseId === 'property_setup' ? 'in_progress' : 'pending',
    holdPoint: PHASE_META[phaseId].holdPoint,
    modules:   PHASE_META[phaseId].modules.map(modId => ({
      id:        modId,
      status:    'pending',
      findings:  [],
      photos:    [],
      notes:     '',
      isBuiltIn: MODULE_META[modId]?.isBuiltIn ?? false,
    })),
    phaseNotes: '',
  }))

  return {
    id,
    createdAt:  now,
    updatedAt:  now,
    status:     'active',
    projectType: 'new_construction',
    clientName:      '',
    inspectorName:   '',
    address: { street: '', city: '', province: 'Ontario', postalCode: '', country: 'Canada' },
    buildingType:    'single_storey_residential',
    estimatedAge:    '',
    roofCovering:    'unknown',
    footingType:     'unknown',
    wallConstruction: 'unknown',
    internalWalls:   '',
    windows:         '',
    isOccupied:      false,
    isSecure:        true,
    inspectionDate:  now.slice(0, 10),
    weather:         'fine',
    purposeNote:     'Pre-purchase building inspection',
    phases,
    overallCondition: null,
    chatMessages:    [],
    reportGenerated: false,
    ...partial,
  }
}

export function getPhaseProgress(phase: InspectionPhase): number {
  if (!phase.modules.length) return 0
  const done = phase.modules.filter(m => m.status === 'complete' || m.status === 'skipped').length
  return Math.round((done / phase.modules.length) * 100)
}

export function getJobProgress(job: InspectionJob): number {
  // Exclude property_setup and not_applicable phases from progress
  const relevantPhases = job.phases.filter(p =>
    p.id !== 'property_setup' && p.status !== 'not_applicable'
  )
  if (!relevantPhases.length) return 0
  const done = relevantPhases.filter(p => p.status === 'complete' || p.status === 'skipped').length
  return Math.round((done / relevantPhases.length) * 100)
}

export function getJobSummary(job: InspectionJob): string {
  const pct        = getJobProgress(job)
  const activePhase = job.phases.find(p => p.status === 'in_progress')
  const phaseMeta  = activePhase ? PHASE_META[activePhase.id] : null
  if (pct === 100) return 'Complete'
  if (phaseMeta)   return `${phaseMeta.shortLabel} · ${pct}%`
  return `${pct}% complete`
}
