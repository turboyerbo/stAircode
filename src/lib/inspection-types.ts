/**
 * inspection-types.ts
 *
 * Core type system for the stAIrcode guided building inspection workflow.
 * Structures match the Compass Building Report (AS 4349.1) phase/section hierarchy.
 *
 * Report target: ~30 pages covering 9 inspection phases + summary + definitions.
 */

// ─── Property / Job ──────────────────────────────────────────────────────────

export interface PropertyAddress {
  street:       string
  unit?:        string
  city:         string
  province:     string
  postalCode:   string
  country:      string
  lat?:         number
  lng?:         number
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

export interface InspectionJob {
  id:             string
  createdAt:      string
  updatedAt:      string

  // Client & inspector
  clientName:     string
  clientEmail?:   string
  clientPhone?:   string
  inspectorName:  string
  licenceNumber?: string
  company?:       string

  // Property
  address:        PropertyAddress
  buildingType:   BuildingType
  estimatedAge:   string            // e.g. "~30 years"
  roofCovering:   RoofCovering
  footingType:    FootingType
  wallConstruction: WallConstruction
  internalWalls:  string            // e.g. "Plasterboard"
  windows:        string            // e.g. "Aluminium"
  isOccupied:     boolean
  isSecure:       boolean

  // Inspection context
  inspectionDate: string
  weather:        WeatherCondition
  purposeNote:    string            // free text purpose

  // Phase progress
  phases:         InspectionPhase[]
  overallCondition: OverallCondition | null

  // AI chat history
  chatMessages:   ChatMessage[]

  // Report
  reportGenerated: boolean
  reportUrl?:      string
  reportModuleId?: string
}

// ─── Phase & Module system ────────────────────────────────────────────────────

export type PhaseId =
  | 'property_setup'
  | 'roof_external'
  | 'roof_internal'
  | 'interior'
  | 'wet_areas'
  | 'exterior'
  | 'garage_structures'
  | 'site'
  | 'services'

export type PhaseStatus = 'pending' | 'in_progress' | 'complete' | 'skipped'

export type OverallCondition =
  | 'above_average' | 'typical' | 'average' | 'below_average' | 'poor'

export type DefectSeverity = 'none' | 'minor' | 'moderate' | 'major' | 'critical'

export interface InspectionPhase {
  id:         PhaseId
  status:     PhaseStatus
  startedAt?: string
  completedAt?: string
  modules:    InspectionModule[]
  phaseNotes: string
}

// ─── Module types ─────────────────────────────────────────────────────────────

export type ModuleId =
  // Property Setup
  | 'property_details'
  // Roof External
  | 'roof_covering' | 'flashings' | 'gutters_downpipes' | 'eaves_fascias' | 'roof_ridgeline'
  // Roof Internal
  | 'roof_framing' | 'insulation' | 'sarking'
  // Interior
  | 'ceilings' | 'internal_walls' | 'windows_interior' | 'doors' | 'floors' | 'stairs'
  // Wet Areas
  | 'kitchen' | 'laundry' | 'bathroom' | 'ensuite' | 'toilet'
  // Exterior
  | 'external_walls' | 'external_cracks' | 'windows_exterior' | 'external_doors'
  // Garage & Structures
  | 'garage' | 'decks_pergolas' | 'outbuildings'
  // Site
  | 'driveway' | 'fences_gates' | 'paths_paving' | 'drainage' | 'yard_gardens' | 'swimming_pool'
  // Services
  | 'electrical' | 'plumbing' | 'gas' | 'smoke_detectors' | 'hot_water' | 'hvac'
  // Existing stAIrcode modules (already built)
  | 'stair_compliance'     // → StairCapture / ScanReadyScreen
  | 'foundation_inspection' // → FoundationScanScreen
  | 'accessibility'         // → AccessibilityScanScreen

export type ModuleStatus = 'pending' | 'in_progress' | 'complete' | 'skipped' | 'na'

export interface ModuleFinding {
  id:          string
  label:       string
  condition:   OverallCondition | 'good' | 'fair' | 'poor' | 'na'
  severity:    DefectSeverity
  notes:       string
  photos:      string[]           // base64 or URLs
  recommendation?: string
  codeRef?:    string
}

export interface InspectionModule {
  id:           ModuleId
  status:       ModuleStatus
  findings:     ModuleFinding[]
  aiSummary?:   string            // AI-generated summary text
  capturedAt?:  string
  photos:       string[]          // base64 JPEGs
  notes:        string            // inspector free text
  isBuiltIn:    boolean           // true = existing stAIrcode scan module
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

// ─── Phase metadata (labels, descriptions, icons, modules) ────────────────────

export const PHASE_META: Record<PhaseId, {
  label:       string
  shortLabel:  string
  description: string
  icon:        'roof' | 'interior' | 'water' | 'exterior' | 'garage' | 'site' | 'services' | 'setup'
  modules:     ModuleId[]
  reportSection: string
}> = {
  property_setup: {
    label:       'Property Setup',
    shortLabel:  'Setup',
    description: 'Address, building type, client details and inspection context',
    icon:        'setup',
    modules:     ['property_details'],
    reportSection: 'Client & Site Information',
  },
  roof_external: {
    label:       'Roof — External',
    shortLabel:  'Roof Ext.',
    description: 'Roof covering, flashings, gutters, downpipes, eaves, fascias and ridgeline',
    icon:        'roof',
    modules:     ['roof_covering', 'flashings', 'gutters_downpipes', 'eaves_fascias', 'roof_ridgeline'],
    reportSection: 'Roof System External',
  },
  roof_internal: {
    label:       'Roof — Internal',
    shortLabel:  'Roof Int.',
    description: 'Roof void, framing, insulation and sarking',
    icon:        'roof',
    modules:     ['roof_framing', 'insulation', 'sarking'],
    reportSection: 'Roof System Internal',
  },
  interior: {
    label:       'Interior',
    shortLabel:  'Interior',
    description: 'Ceilings, walls, windows, doors, floors, woodwork and stairs',
    icon:        'interior',
    modules:     ['ceilings', 'internal_walls', 'windows_interior', 'doors', 'floors', 'stairs', 'stair_compliance'],
    reportSection: 'Interior Condition Report',
  },
  wet_areas: {
    label:       'Wet Areas',
    shortLabel:  'Wet Areas',
    description: 'Kitchen, laundry, bathrooms, ensuites and toilets',
    icon:        'water',
    modules:     ['kitchen', 'laundry', 'bathroom', 'ensuite', 'toilet', 'accessibility'],
    reportSection: 'Wet Areas',
  },
  exterior: {
    label:       'Exterior',
    shortLabel:  'Exterior',
    description: 'External walls, cracking, doors, windows and cladding',
    icon:        'exterior',
    modules:     ['external_walls', 'external_cracks', 'windows_exterior', 'external_doors', 'foundation_inspection'],
    reportSection: 'Exterior',
  },
  garage_structures: {
    label:       'Garage & Structures',
    shortLabel:  'Garage',
    description: 'Garage, decks, pergolas, balconies, verandahs and outbuildings',
    icon:        'garage',
    modules:     ['garage', 'decks_pergolas', 'outbuildings'],
    reportSection: 'Garaging / Decks & Pergolas / Outbuildings',
  },
  site: {
    label:       'Site',
    shortLabel:  'Site',
    description: 'Driveway, fences, paths, drainage, yard, gardens and pool',
    icon:        'site',
    modules:     ['driveway', 'fences_gates', 'paths_paving', 'drainage', 'yard_gardens', 'swimming_pool'],
    reportSection: 'Site',
  },
  services: {
    label:       'Services',
    shortLabel:  'Services',
    description: 'Electrical, plumbing, gas, smoke detectors, hot water and HVAC',
    icon:        'services',
    modules:     ['electrical', 'plumbing', 'gas', 'smoke_detectors', 'hot_water', 'hvac'],
    reportSection: 'Services',
  },
}

export const MODULE_META: Partial<Record<ModuleId, {
  label:       string
  description: string
  required:    boolean
  isBuiltIn:   boolean   // routes to existing scan screen
}>> = {
  property_details:     { label: 'Property Details',     description: 'Address, type, age, materials', required: true,  isBuiltIn: false },
  roof_covering:        { label: 'Roof Covering',        description: 'Tiles, flashings, condition',   required: true,  isBuiltIn: false },
  flashings:            { label: 'Flashings',            description: 'Roof flashings and sealants',   required: true,  isBuiltIn: false },
  gutters_downpipes:    { label: 'Gutters & Downpipes',  description: 'Gutters, downpipes, valleys',   required: true,  isBuiltIn: false },
  eaves_fascias:        { label: 'Eaves & Fascias',      description: 'Eaves lining, fascia boards',   required: false, isBuiltIn: false },
  roof_ridgeline:       { label: 'Ridge & Hips',         description: 'Mortar, pointing, condition',   required: false, isBuiltIn: false },
  roof_framing:         { label: 'Roof Framing',         description: 'Trusses, purlins, bracing',     required: true,  isBuiltIn: false },
  insulation:           { label: 'Insulation',           description: 'Type, coverage, condition',     required: false, isBuiltIn: false },
  sarking:              { label: 'Sarking',              description: 'Membrane condition, tears',     required: false, isBuiltIn: false },
  ceilings:             { label: 'Ceilings',             description: 'Lining, staining, cracking',   required: true,  isBuiltIn: false },
  internal_walls:       { label: 'Internal Walls',       description: 'Plasterboard, cracking, damp', required: true,  isBuiltIn: false },
  windows_interior:     { label: 'Windows (Interior)',   description: 'Condition, operation, seals',   required: true,  isBuiltIn: false },
  doors:                { label: 'Doors',                description: 'Operation, hardware, frames',   required: true,  isBuiltIn: false },
  floors:               { label: 'Floors',               description: 'Coverings, condition, bounce',  required: true,  isBuiltIn: false },
  stairs:               { label: 'Stairs (General)',     description: 'Visual condition, handrails',   required: false, isBuiltIn: false },
  stair_compliance:     { label: 'Stair Compliance Scan','description': 'AI measurement scan — OBC/IBC', required: false, isBuiltIn: true  },
  kitchen:              { label: 'Kitchen',              description: 'Fixtures, tiles, moisture',     required: true,  isBuiltIn: false },
  laundry:              { label: 'Laundry',              description: 'Tubs, taps, drainage',         required: false, isBuiltIn: false },
  bathroom:             { label: 'Bathroom',             description: 'Shower, tiles, vanity, seals', required: true,  isBuiltIn: false },
  ensuite:              { label: 'Ensuite',              description: 'Shower, tiles, WC, seals',     required: false, isBuiltIn: false },
  toilet:               { label: 'Toilet',               description: 'Dual flush, condition, seals', required: false, isBuiltIn: false },
  accessibility:        { label: 'Accessibility Scan',   description: 'OBC 2024 / AODA guided scan',  required: false, isBuiltIn: true  },
  external_walls:       { label: 'External Walls',       description: 'Cladding, paint, moisture',    required: true,  isBuiltIn: false },
  external_cracks:      { label: 'External Cracking',    description: 'Crack type, severity, location', required: true, isBuiltIn: false },
  windows_exterior:     { label: 'Windows (Exterior)',   description: 'Frames, seals, condition',     required: false, isBuiltIn: false },
  external_doors:       { label: 'Doors (Exterior)',     description: 'Frames, weatherproofing',      required: false, isBuiltIn: false },
  foundation_inspection:{ label: 'Foundation Scan',      description: 'AI foundation analysis',       required: false, isBuiltIn: true  },
  garage:               { label: 'Garage',               description: 'Doors, floor, walls, damp',   required: false, isBuiltIn: false },
  decks_pergolas:       { label: 'Decks & Pergolas',     description: 'Structure, drainage, fixings', required: false, isBuiltIn: false },
  outbuildings:         { label: 'Outbuildings',         description: 'Sheds, structures, approvals', required: false, isBuiltIn: false },
  driveway:             { label: 'Driveway',             description: 'Concrete, asphalt, condition', required: false, isBuiltIn: false },
  fences_gates:         { label: 'Fences & Gates',       description: 'Condition, decay, posts',      required: false, isBuiltIn: false },
  paths_paving:         { label: 'Paths & Paving',       description: 'Condition, trip hazards',      required: false, isBuiltIn: false },
  drainage:             { label: 'Surface Drainage',     description: 'Ponding, run-off, outlets',    required: false, isBuiltIn: false },
  yard_gardens:         { label: 'Yard & Gardens',       description: 'Trees, clearance, condition',  required: false, isBuiltIn: false },
  swimming_pool:        { label: 'Swimming Pool',        description: 'Fencing compliance, specialist', required: false, isBuiltIn: false },
  electrical:           { label: 'Electrical (Visual)',  description: 'Switchboard, safety switches', required: true,  isBuiltIn: false },
  plumbing:             { label: 'Plumbing (Visual)',    description: 'Visible pipes, water pressure', required: true,  isBuiltIn: false },
  gas:                  { label: 'Gas (Visual)',         description: 'Connection, appliances noted', required: false, isBuiltIn: false },
  smoke_detectors:      { label: 'Smoke Detectors',      description: 'Presence, placement, type',    required: true,  isBuiltIn: false },
  hot_water:            { label: 'Hot Water System',     description: 'Type, location, condition',    required: true,  isBuiltIn: false },
  hvac:                 { label: 'HVAC / Air Conditioning','description':'Units noted, not tested',  required: false, isBuiltIn: false },
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

export function createNewJob(partial: Partial<InspectionJob> = {}): InspectionJob {
  const id = `insp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()

  const phases: InspectionPhase[] = (Object.keys(PHASE_META) as PhaseId[]).map(phaseId => ({
    id:      phaseId,
    status:  phaseId === 'property_setup' ? 'in_progress' : 'pending',
    modules: PHASE_META[phaseId].modules.map(modId => ({
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
    clientName:    '',
    inspectorName: '',
    address: { street:'', city:'', province:'Ontario', postalCode:'', country:'Canada' },
    buildingType:  'single_storey_residential',
    estimatedAge:  '',
    roofCovering:  'unknown',
    footingType:   'unknown',
    wallConstruction: 'unknown',
    internalWalls: '',
    windows:       '',
    isOccupied:    false,
    isSecure:      true,
    inspectionDate: now.slice(0, 10),
    weather:       'fine',
    purposeNote:   'Pre-purchase building inspection',
    phases,
    overallCondition: null,
    chatMessages:  [],
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
  const total = job.phases.filter(p => p.id !== 'property_setup').length
  const done  = job.phases.filter(p => p.id !== 'property_setup' && (p.status === 'complete' || p.status === 'skipped')).length
  return Math.round((done / total) * 100)
}
