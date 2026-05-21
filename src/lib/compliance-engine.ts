/**
 * src/lib/compliance-engine.ts
 *
 * ⚠️  THIS FILE RUNS ONLY ON THE SERVER.
 * It is never sent to the browser. All code limits and compliance
 * logic live here, protected from public view.
 *
 * Jurisdictions supported:
 *  NBC  — National Building Code of Canada 2020
 *  OBC  — Ontario Building Code 2024            (Part 9 residential)
 *  QBC  — Quebec Construction Code 2015/NBC      (CCQ + RBQ)
 *  NEN  — Netherlands Bbl 2024 (Besluit bouwwerken leefomgeving)
 *  NYRC — New York State Residential Code 2020   (RCNYS)
 *  NYBC — New York State Building Code 2020      (commercial/IBC-based)
 *  IBC  — International Building Code 2021
 *  IRC  — International Residential Code 2021
 *  ADA  — ADA / ABA Accessibility Guidelines 2010
 *  BCBC — BC Building Code 2024
 */

// ── Types ─────────────────────────────────────────────────────────────────

export type CodeKey =
  | 'NBC' | 'OBC' | 'QBC'
  | 'NEN'
  | 'NYRC' | 'NYBC'
  | 'IBC' | 'IRC' | 'ADA'
  | 'BCBC'

export type FieldKey =
  | 'riser' | 'tread' | 'headroom' | 'handrail'
  | 'width' | 'nosing' | 'variation' | 'landing'

export interface Limit {
  min?: number  // mm
  max?: number  // mm
}

export interface CodeSpec {
  label:      string
  ref:        string
  provincial?: boolean
  country:    string
  fields:     Record<FieldKey, Limit>
}

export interface Measurement {
  field:   FieldKey
  valueMm: number
}

export interface FieldResult {
  field:     FieldKey
  label:     string
  valueMm:   number
  limit:     Limit
  pass:      boolean
  deltaMm:   number | null
  direction: 'over' | 'under' | null
}

export interface ComplianceResult {
  code:        CodeKey
  codeLabel:   string
  codeRef:     string
  provincial:  boolean
  country:     string
  passCount:   number
  failCount:   number
  naCount:     number
  overallPass: boolean
  fields:      FieldResult[]
  checkedAt:   string
}

// ── Field labels ──────────────────────────────────────────────────────────

export const FIELD_LABELS: Record<FieldKey, string> = {
  riser:     'Riser Height',
  tread:     'Tread Depth',
  headroom:  'Headroom Clearance',
  handrail:  'Handrail Height',
  width:     'Stair Width (clear)',
  nosing:    'Nosing Projection',
  variation: 'Max Riser Variation',
  landing:   'Landing Depth',
}

// ── Code specifications (ALL VALUES IN MM) ────────────────────────────────
// This is protected IP — server-side only.

const CODE_SPECS: Record<CodeKey, CodeSpec> = {

  // ── Canada: National Building Code 2020 ──────────────────────────────
  NBC: {
    label:     'NBC 2020',
    ref:       'Division B, 9.8.4 / 3.4.6',
    provincial: true,
    country:   'Canada',
    fields: {
      riser:     { min: 125,  max: 200  },
      tread:     { min: 235            },
      headroom:  { min: 1950           },
      handrail:  { min: 865,  max: 1070 },
      width:     { min: 860            },
      nosing:    { min: 15,   max: 50  },
      variation: {            max: 5   },
      landing:   { min: 860            },
    },
  },

  // ── Canada: Ontario Building Code 2024 ───────────────────────────────
  // Source: OBC 2024 Div B Part 9, s.9.8.4.1 (residential)
  // Riser 125–200mm (Part 9 residential), tread min 255mm,
  // headroom 1950mm (residential dwelling unit), handrail 865–965mm (s.9.8.7.2)
  OBC: {
    label:     'OBC 2024',
    ref:       'Division B, Part 9 — s.9.8.4 / 9.8.7',
    provincial: true,
    country:   'Canada',
    fields: {
      riser:     { min: 125,  max: 200  },  // s.9.8.4.1 residential
      tread:     { min: 255            },   // s.9.8.4.2 rectangular treads
      headroom:  { min: 1950           },   // s.9.8.2.2 dwelling unit (1950+1 riser)
      handrail:  { min: 865,  max: 965 },   // s.9.8.7.2 (865–965mm in dwellings)
      width:     { min: 860            },   // s.9.8.2.1
      nosing:    { min: 8,    max: 13  },   // s.9.8.4.4 bevel 8–13mm horizontal
      variation: {            max: 5   },   // uniform tolerance ≤5mm
      landing:   { min: 860            },   // s.9.8.6 = stair width, min 860
    },
  },

  // ── Canada: Quebec Construction Code (CCQ) / NBC base + RBQ ──────────
  // Quebec adopts NBC with amendments via CCQ Chapter I, Buildings.
  // Source: RBQ building standards, CCQ s.3.4.6 / 9.8
  // Riser 146–200mm (5¾"–8"), tread 216–292mm (RBQ residential range)
  // Handrail 865–965mm per NBC base, headroom 1950mm dwelling unit
  QBC: {
    label:     'CCQ 2015 (Québec)',
    ref:       'Code de construction du Québec, Chap. I / RBQ 9.8',
    provincial: true,
    country:   'Canada',
    fields: {
      riser:     { min: 146,  max: 200  },  // RBQ: 14.6–20 cm
      tread:     { min: 216,  max: 292  },  // RBQ: 21.6–29.2 cm residential
      headroom:  { min: 1950           },   // NBC base, dwelling unit
      handrail:  { min: 865,  max: 965 },   // NBC base residential stair
      width:     { min: 860            },   // NBC base min 860mm
      nosing:    { min: 15,   max: 50  },   // NBC base
      variation: {            max: 5   },   // NBC base tolerance ≤5mm
      landing:   { min: 860            },   // NBC base = stair width
    },
  },

  // ── Netherlands: Besluit bouwwerken leefomgeving (Bbl) 2024 ──────────
  // Replaced Bouwbesluit 2012 on 1 Jan 2024.
  // Source: Bbl Art. 4.27–4.31 (woonfunctie nieuwbouw)
  // Riser max 188mm, tread min 220mm, headroom min 2300mm (Bbl residential new build)
  // Width min 800mm residential new build, handrail 860–1000mm (NEN 3509 / Bbl)
  NEN: {
    label:     'Bbl 2024 (Nederland)',
    ref:       'Besluit bouwwerken leefomgeving, Art. 4.27–4.31',
    provincial: false,
    country:   'Netherlands',
    fields: {
      riser:     {            max: 188  },  // Bbl: optrede max 188mm (woonfunctie nieuwbouw)
      tread:     { min: 220            },   // Bbl: aantrede min 220mm
      headroom:  { min: 2300           },   // Bbl: doorloophoogte min 2300mm
      handrail:  { min: 860,  max: 1000 },  // NEN 3509 / Bbl: leuninghoogte 860–1000mm
      width:     { min: 800            },   // Bbl: vrije breedte min 800mm nieuwbouw
      nosing:    { min: 10,   max: 45  },   // NEN 3509: wel (oversteek) 10–45mm
      variation: {            max: 5   },   // Good practice / NEN 3509: ≤5mm uniform
      landing:   { min: 800            },   // Bbl: bordes min = trapbreedte
    },
  },

  // ── New York State: Residential Code 2020 (RCNYS) ─────────────────────
  // Based on 2018 IRC with NYS amendments.
  // Source: RCNYS 2020 R311.7; NYS DOS Technical Bulletin 1005
  // Riser max 209mm (8¼"), tread min 241mm (9½") — NY amendment stricter than IRC
  // Handrail 864–965mm (34"–38"), headroom 2032mm (80"), width 914mm (36")
  NYRC: {
    label:     'RCNYS 2020',
    ref:       'NY Residential Code 2020, R311.7 / NYS Supplement',
    provincial: false,
    country:   'USA',
    fields: {
      riser:     { min: 102,  max: 209  },  // RCNYS: max 8¼" = 209.6mm (NY amendment)
      tread:     { min: 241            },   // RCNYS: min 9½" = 241.3mm (NY amendment)
      headroom:  { min: 2032           },   // R311.7.2: 80" = 2032mm
      handrail:  { min: 864,  max: 965 },   // R311.7.8.1: 34"–38"
      width:     { min: 914            },   // R311.7.1: 36" = 914mm
      nosing:    { min: 19,   max: 32  },   // R311.7.5.3: ¾"–1¼"
      variation: {            max: 9.5 },   // R311.7.5.1: max ⅜" = 9.5mm
      landing:   { min: 914            },   // R311.7.6: 36" direction of travel
    },
  },

  // ── New York State: Building Code 2020 (NYSBC) — commercial/IBC-based ─
  // Adopted IBC 2018 with amendments. Commercial, multi-family, institutional.
  // Source: NYSBC 2020 Chapter 10, s.1011
  // Riser 102–178mm (4"–7"), tread min 279mm (11"), width 1118mm (44")
  NYBC: {
    label:     'NYSBC 2020',
    ref:       'NY Building Code 2020, §1011 (Commercial)',
    provincial: false,
    country:   'USA',
    fields: {
      riser:     { min: 102,  max: 178  },  // §1011.5.2: 4"–7"
      tread:     { min: 279            },   // §1011.5.2: 11" = 279mm
      headroom:  { min: 2032           },   // §1011.3: 80" = 2032mm
      handrail:  { min: 864,  max: 965 },   // §1012.3: 34"–38"
      width:     { min: 1118           },   // §1011.2: 44" = 1118mm
      nosing:    { min: 19,   max: 32  },   // §1011.5.5: ¾"–1¼"
      variation: {            max: 9.5 },   // §1011.5.4: ⅜" max
      landing:   { min: 1118           },   // §1011.7: = stair width
    },
  },

  // ── IBC 2021 ─────────────────────────────────────────────────────────
  IBC: {
    label:   'IBC 2021',
    ref:     'Section 1011',
    country: 'USA',
    fields: {
      riser:     { min: 102,  max: 178  },
      tread:     { min: 279            },
      headroom:  { min: 2032           },
      handrail:  { min: 864,  max: 965 },
      width:     { min: 1118           },
      nosing:    { min: 19,   max: 32  },
      variation: {            max: 9.5 },
      landing:   { min: 1118           },
    },
  },

  // ── IRC 2021 ─────────────────────────────────────────────────────────
  IRC: {
    label:   'IRC 2021',
    ref:     'Section R311.7',
    country: 'USA',
    fields: {
      riser:     { min: 102,  max: 197  },
      tread:     { min: 254            },
      headroom:  { min: 2032           },
      handrail:  { min: 864,  max: 965 },
      width:     { min: 914            },
      nosing:    { min: 19,   max: 32  },
      variation: {            max: 9.5 },
      landing:   { min: 914            },
    },
  },

  // ── ADA / ABA 2010 ───────────────────────────────────────────────────
  ADA: {
    label:   'ADA / ABA 2010',
    ref:     'Section 504',
    country: 'USA',
    fields: {
      riser:     { min: 102,  max: 178  },
      tread:     { min: 279            },
      headroom:  { min: 2032           },
      handrail:  { min: 864,  max: 965 },
      width:     { min: 1219           },
      nosing:    { min: 0,    max: 13  },
      variation: {            max: 6.4 },
      landing:   { min: 1524           },
    },
  },

  // ── BC Building Code 2024 ────────────────────────────────────────────
  BCBC: {
    label:     'BCBC 2024',
    ref:       'Part 9.8',
    provincial: true,
    country:   'Canada',
    fields: {
      riser:     { min: 125,  max: 200  },
      tread:     { min: 255            },
      headroom:  { min: 1950           },
      handrail:  { min: 865,  max: 1070 },
      width:     { min: 860            },
      nosing:    { min: 6,    max: 14  },
      variation: {            max: 5   },
      landing:   { min: 860            },
    },
  },
}

// ── Core compliance function ───────────────────────────────────────────────

function checkField(
  _field: FieldKey,
  valueMm: number,
  limit: Limit
): Pick<FieldResult, 'pass' | 'deltaMm' | 'direction'> {
  if (limit.min !== undefined && valueMm < limit.min) {
    return { pass: false, deltaMm: limit.min - valueMm, direction: 'under' }
  }
  if (limit.max !== undefined && valueMm > limit.max) {
    return { pass: false, deltaMm: valueMm - limit.max, direction: 'over' }
  }
  return { pass: true, deltaMm: null, direction: null }
}

export function runCompliance(
  code: CodeKey,
  measurements: Measurement[]
): ComplianceResult {
  const spec = CODE_SPECS[code]
  if (!spec) throw new Error(`Unknown code: ${code}`)

  let passCount = 0, failCount = 0

  const fields: FieldResult[] = measurements.map(({ field, valueMm }) => {
    const limit = spec.fields[field]
    const { pass, deltaMm, direction } = checkField(field, valueMm, limit)
    if (pass) passCount++; else failCount++
    return { field, label: FIELD_LABELS[field], valueMm, limit, pass, deltaMm, direction }
  })

  const allFields      = Object.keys(FIELD_LABELS) as FieldKey[]
  const submittedFields = new Set(measurements.map(m => m.field))
  const naCount        = allFields.filter(f => !submittedFields.has(f)).length

  return {
    code,
    codeLabel:  spec.label,
    codeRef:    spec.ref,
    provincial: spec.provincial ?? false,
    country:    spec.country,
    passCount,
    failCount,
    naCount,
    overallPass: failCount === 0 && passCount > 0,
    fields,
    checkedAt: new Date().toISOString(),
  }
}

// ── Input validation ───────────────────────────────────────────────────────

export function validateInput(
  body: unknown
): { code: CodeKey; measurements: Measurement[] } {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Invalid request body')
  }
  const { code, measurements } = body as Record<string, unknown>

  const validCodes: CodeKey[] = [
    'NBC','OBC','QBC','NEN','NYRC','NYBC','IBC','IRC','ADA','BCBC'
  ]
  if (!validCodes.includes(code as CodeKey)) {
    throw new Error(`Invalid code: ${code}`)
  }
  if (!Array.isArray(measurements) || measurements.length === 0) {
    throw new Error('No measurements provided')
  }

  const validFields = new Set(Object.keys(FIELD_LABELS))
  const cleaned: Measurement[] = measurements.map((m: unknown) => {
    const { field, valueMm } = m as Record<string, unknown>
    if (!validFields.has(field as string)) throw new Error(`Invalid field: ${field}`)
    if (typeof valueMm !== 'number' || isNaN(valueMm) || valueMm < 0) {
      throw new Error(`Invalid value for ${field}`)
    }
    return { field: field as FieldKey, valueMm }
  })

  return { code: code as CodeKey, measurements: cleaned }
}
