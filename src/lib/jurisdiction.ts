/**
 * src/lib/jurisdiction.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Single source of truth for "which building code applies here."
 *
 * Built in layers so it's robust and easy to extend:
 *   LAYER 1 — Types + the jurisdiction data table (this file, top half)
 *   LAYER 2 — resolveJurisdiction(): location → jurisdiction, with a correct
 *             international fallback to IBC (never defaults to OBC/NBC again)
 *   LAYER 3 — Manual override helpers (detection sets default; user always wins)
 *   LAYER 4 — Prompt/label helpers so vision, chat, and report all speak the
 *             SAME resolved code instead of assuming Ontario
 *
 * The old bug: unknown locations fell through to Ontario/NBC. Here, anything
 * outside Canada/US resolves to the International Building Code (IBC), which is
 * exactly what it exists for. Canadian provinces each map to their own code.
 */

// ─── LAYER 1: Types ──────────────────────────────────────────────────────────

export type JurisdictionId =
  // Canada — province-specific
  | 'CA_ON'   // Ontario Building Code
  | 'CA_BC'   // BC Building Code + BC Energy Step Code
  | 'CA_QC'   // Code de construction du Québec
  | 'CA_AB'   // Alberta Building Code
  | 'CA_NBC'  // National Building Code (other/unspecified province)
  // United States
  | 'US_IBC'  // International Building Code (commercial / general)
  | 'US_IRC'  // International Residential Code (1- & 2-family dwellings)
  // International default
  | 'INTL_IBC'
  // United Kingdom (kept from prior work; Part K = stairs)
  | 'UK'

export interface CodeLink {
  label: string
  url:   string
}

export interface Jurisdiction {
  id:        JurisdictionId
  /** Short label shown in the UI and injected into AI prompts, e.g. "BC Building Code". */
  label:     string
  /** Longer name for report headers. */
  fullName:  string
  /** Country ISO-2 this belongs to (for grouping in the picker). */
  country:   string
  /** Region/state/province name, when specific. */
  region?:   string
  /** Authoritative links surfaced in the location card and reports. */
  links:     CodeLink[]
  /** One-line note the AI can use for context (recent changes, special items). */
  note?:     string
  /** True when this is a fallback rather than a precise match. */
  isFallback?: boolean
}

// ─── LAYER 1: The data table ─────────────────────────────────────────────────
// Add new jurisdictions here; nothing else needs to change.

export const JURISDICTIONS: Record<JurisdictionId, Jurisdiction> = {
  CA_ON: {
    id: 'CA_ON',
    label: 'Ontario Building Code',
    fullName: 'Ontario Building Code (OBC)',
    country: 'CA',
    region: 'Ontario',
    links: [
      { label: 'OBC (O. Reg. 332/12)', url: 'https://www.ontario.ca/laws/regulation/120332' },
    ],
    note: 'Ontario Building Code, based on the NBC model with provincial amendments.',
  },
  CA_BC: {
    id: 'CA_BC',
    label: 'BC Building Code',
    fullName: 'BC Building Code + BC Energy Step Code',
    country: 'CA',
    region: 'British Columbia',
    links: [
      { label: 'BC Building Code', url: 'https://www.bccodes.ca/building-code.html' },
      { label: 'BC Energy Step Code', url: 'https://energystepcode.ca/' },
    ],
    note:
      'BC Building Code with the BC Energy Step Code (performance steps for Part 9 housing). ' +
      'As of the 2024 code updates, new homes require radon rough-in and solar-ready / hot-water ' +
      'pre-plumbing provisions. Zoning may affect applicable step level.',
  },
  CA_QC: {
    id: 'CA_QC',
    label: 'Code de construction du Québec',
    fullName: 'Code de construction du Québec (CCQ)',
    country: 'CA',
    region: 'Québec',
    links: [
      { label: 'Code de construction du Québec', url: 'https://www.rbq.gouv.qc.ca/' },
    ],
    note: 'Québec construction code, based on the NBC with provincial amendments (Chapter I — Building).',
  },
  CA_AB: {
    id: 'CA_AB',
    label: 'Alberta Building Code',
    fullName: 'Alberta Building Code (ABC)',
    country: 'CA',
    region: 'Alberta',
    links: [
      { label: 'Alberta Building Code', url: 'https://www.alberta.ca/building-codes.aspx' },
    ],
    note: 'Alberta Building Code, based on the NBC with provincial amendments.',
  },
  CA_NBC: {
    id: 'CA_NBC',
    label: 'National Building Code of Canada',
    fullName: 'National Building Code of Canada (NBC)',
    country: 'CA',
    links: [
      { label: 'National Building Code of Canada', url: 'https://nrc.canada.ca/en/certifications-evaluations-standards/codes-canada/codes-canada-publications' },
    ],
    note: 'National model code — used where a province-specific code is not identified.',
    isFallback: true,
  },
  US_IBC: {
    id: 'US_IBC',
    label: 'International Building Code',
    fullName: 'International Building Code (IBC)',
    country: 'US',
    links: [
      { label: 'International Building Code (ICC)', url: 'https://codes.iccsafe.org/content/IBC2021P1' },
    ],
    note: 'Model code adopted (with amendments) by most US jurisdictions for commercial and general construction.',
  },
  US_IRC: {
    id: 'US_IRC',
    label: 'International Residential Code',
    fullName: 'International Residential Code (IRC)',
    country: 'US',
    links: [
      { label: 'International Residential Code (ICC)', url: 'https://codes.iccsafe.org/content/IRC2021P1' },
    ],
    note: 'Model code for one- and two-family dwellings, adopted with local amendments across the US.',
  },
  INTL_IBC: {
    id: 'INTL_IBC',
    label: 'International Building Code',
    fullName: 'International Building Code (IBC)',
    country: 'INTL',
    links: [
      { label: 'International Building Code (ICC)', url: 'https://codes.iccsafe.org/content/IBC2021P1' },
    ],
    note: 'The IBC is used or adapted internationally. Applied here as the default where a local code is not yet mapped; confirm against local requirements.',
    isFallback: true,
  },
  UK: {
    id: 'UK',
    label: 'UK Building Regulations',
    fullName: 'UK Building Regulations (Approved Documents)',
    country: 'GB',
    links: [
      { label: 'Approved Documents', url: 'https://www.gov.uk/government/collections/approved-documents' },
    ],
    note: 'UK Building Regulations Approved Documents (e.g. Part K — protection from falling, stairs).',
  },
}

/** Ordered list for the manual picker, grouped logically. */
export const JURISDICTION_PICKER_ORDER: JurisdictionId[] = [
  'CA_ON', 'CA_BC', 'CA_QC', 'CA_AB', 'CA_NBC',
  'US_IBC', 'US_IRC',
  'UK',
  'INTL_IBC',
]

// ─── LAYER 2: The resolver — THIS is the fix ─────────────────────────────────
//
// Turns a detected location into a Jurisdiction. The critical change vs. the old
// behaviour: unknown / non-North-American locations resolve to IBC, and each
// Canadian province maps to its own code — nothing silently falls back to OBC.

export interface LocationInput {
  /** ISO-2 country code, e.g. 'CA', 'US', 'GB', 'PH'. Case-insensitive. */
  countryCode?: string | null
  /** Province/state — full name OR 2-letter code, e.g. 'British Columbia' or 'BC'. */
  region?: string | null
  /** Optional: whether the structure is a 1–2 family dwelling (US → IRC vs IBC). */
  isResidential?: boolean
}

// Canadian province/state normalization → JurisdictionId
const CA_PROVINCE_MAP: Record<string, JurisdictionId> = {
  on: 'CA_ON', ontario: 'CA_ON',
  bc: 'CA_BC', 'british columbia': 'CA_BC', 'colombie-britannique': 'CA_BC',
  qc: 'CA_QC', quebec: 'CA_QC', 'québec': 'CA_QC',
  ab: 'CA_AB', alberta: 'CA_AB',
}

function norm(s?: string | null): string {
  return (s ?? '').trim().toLowerCase()
}

/**
 * Resolve a location to a jurisdiction.
 * Never throws; always returns a Jurisdiction (falls back to INTL_IBC).
 */
export function resolveJurisdiction(loc: LocationInput): Jurisdiction {
  const country = norm(loc.countryCode)
  const region  = norm(loc.region)

  // ── Canada ── province-specific, else national fallback (NOT Ontario) ──
  if (country === 'ca' || country === 'can' || country === 'canada') {
    const provId = CA_PROVINCE_MAP[region]
    if (provId) return JURISDICTIONS[provId]
    return JURISDICTIONS.CA_NBC   // unknown province → NBC, not OBC
  }

  // ── United States ── IRC for 1–2 family dwellings, else IBC ──
  if (country === 'us' || country === 'usa' || country === 'united states') {
    return loc.isResidential ? JURISDICTIONS.US_IRC : JURISDICTIONS.US_IBC
  }

  // ── United Kingdom ──
  if (country === 'gb' || country === 'uk' || country === 'united kingdom') {
    return JURISDICTIONS.UK
  }

  // ── Everywhere else ── the whole point: default to IBC, not Canadian code ──
  return JURISDICTIONS.INTL_IBC
}

// ─── LAYER 3: Manual override (detection sets default; the user always wins) ──
//
// Store the resolved default on the job, plus an optional explicit override.
// getActiveJurisdiction() returns the override if set, else the detected one,
// else the international fallback — so callers never have to branch.

export interface JurisdictionState {
  /** What detection resolved to (may be a fallback). */
  detectedId?: JurisdictionId
  /** What the user explicitly chose, if anything. This wins. */
  overrideId?: JurisdictionId
}

export function getActiveJurisdiction(state: JurisdictionState | undefined): Jurisdiction {
  if (state?.overrideId && JURISDICTIONS[state.overrideId]) return JURISDICTIONS[state.overrideId]
  if (state?.detectedId && JURISDICTIONS[state.detectedId]) return JURISDICTIONS[state.detectedId]
  return JURISDICTIONS.INTL_IBC
}

/** Convenience for building the initial state from a detected location. */
export function initJurisdictionState(loc: LocationInput): JurisdictionState {
  return { detectedId: resolveJurisdiction(loc).id }
}

/** Apply a manual override (e.g. from the picker). Returns new state (immutable). */
export function setJurisdictionOverride(
  state: JurisdictionState | undefined,
  id: JurisdictionId,
): JurisdictionState {
  return { ...(state ?? {}), overrideId: id }
}

/** True when the active jurisdiction is a fallback the user may want to confirm. */
export function shouldPromptOverride(state: JurisdictionState | undefined): boolean {
  const active = getActiveJurisdiction(state)
  // Prompt only when nothing was explicitly chosen AND we're on a fallback.
  return !state?.overrideId && !!active.isFallback
}

// ─── LAYER 4: Prompt & label helpers (one code, everywhere) ──────────────────
//
// Vision, chat, and report builders must all reference the SAME resolved code.
// Pass the active Jurisdiction into these instead of hardcoding "OBC".

/** Short label for badges/headers, e.g. "BC Building Code". */
export function jurisdictionLabel(j: Jurisdiction): string {
  return j.label
}

/** A sentence the AI prompts can inject so answers cite the right code. */
export function jurisdictionPromptContext(j: Jurisdiction): string {
  const linkList = j.links.map(l => l.label).join('; ')
  const base = `The applicable building code for this location is the ${j.fullName}. ` +
    `Cite and reason against ${j.label} requirements` +
    (linkList ? ` (references: ${linkList}).` : '.')
  return j.note ? `${base} ${j.note}` : base
}

/** For report headers: full name + region if present. */
export function jurisdictionReportHeader(j: Jurisdiction): string {
  return j.region ? `${j.fullName} — ${j.region}` : j.fullName
}

// ─── LAYER 5: Bridge from the legacy detectCode() CodeKey + location ──────────
//
// The app already has a detectCode() that returns a CodeKey ('OBC','BCBC','IBC'
// ...). Map that (plus country) to a JurisdictionId so the AI prompts get the
// right jurisdiction without ripping out the existing stair-limit logic.

export function codeKeyToJurisdictionId(
  codeKey: string,
  countryCode?: string | null,
): JurisdictionId {
  switch ((codeKey || '').toUpperCase()) {
    case 'OBC':  return 'CA_ON'
    case 'BCBC': return 'CA_BC'
    case 'QBC':  return 'CA_QC'
    case 'NBC':  return 'CA_NBC'   // includes Alberta-labelled ABC in the legacy map
    case 'IRC':  return 'US_IRC'
    case 'IBC': {
      const cc = norm(countryCode)
      if (cc === 'us' || cc === 'usa') return 'US_IBC'
      if (cc === 'gb' || cc === 'uk')  return 'UK'
      return 'INTL_IBC'
    }
    default:
      return 'INTL_IBC'
  }
}
