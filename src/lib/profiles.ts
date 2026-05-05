/**
 * src/lib/profiles.ts — Staircode Beta
 *
 * Five user profiles, each with distinct AI language, terminology, and theme.
 *
 *  architect        — full technical vocabulary, code citations, peer-level
 *  building_manager — professional but not a designer; compliance & liability focus
 *  contractor       — site language, mm tolerances, pass/fail, no hand-holding
 *  diy              — plain English, explain every term, encouraging, no jargon
 *  realestate       — business language, risk framing, saleability, liability
 */

import type { UserRole } from '../app/components/AuthScreen'

// ── Brand palette ─────────────────────────────────────────────────────────────
// Primary: #F29337 (orange), #417CA4 (blue), #A1B2C2 (light gray-blue)
// Dark UI backgrounds derived from blue:
const B = {
  orange:    '#F29337',
  orangeDk:  '#C4721E',
  orangeSoft:'rgba(242,147,55,0.12)',
  orangeBdr: 'rgba(242,147,55,0.32)',
  blue:      '#417CA4',
  blueDk:    '#2C5A7A',
  blueSoft:  'rgba(65,124,164,0.12)',
  blueBdr:   'rgba(65,124,164,0.32)',
  grayBlue:  '#93BAD4',
  // Dark page backgrounds
  bg:        '#0A1C2E',
  bg2:       '#0F2438',
  bg3:       '#152D46',
  text:      '#E8F4FF',
  text2:     '#B0CDE0',
  text3:     '#7AADCA',
  pass:      '#3DB88A',
  fail:      '#E85555',
  warn:      '#F29337',
}


export interface ProfileTheme {
  role:         UserRole
  name:         string
  tagline:      string
  accent:       string
  accentDark:   string
  accentSoft:   string
  accentBorder: string
  bg:           string
  bg2:          string
  bg3:          string
  text:         string
  text2:        string
  text3:        string
  pass:         string
  fail:         string
  warn:         string
  terms: {
    riser:    string
    tread:    string
    width:    string
    handrail: string
    nosing:   string
    headroom: string
    report:   string
    passed:   string
    failed:   string
    scanning: string
  }
  copy: {
    reportTitle:     string
    reportSubtitle:  string
    reportPrice:     string
    reportPriceNote: string
    proTitle:        string
    proPrice:        string
    proNote:         string
    enterpriseTitle: string
    enterpriseNote:  string
    findInspector:   string
    scanIntro:       string
    verdictLikely:   string
    verdictPossibly: string
    verdictFail:     string
  }
  aiPersona: string
}

// ── 1. ARCHITECT ──────────────────────────────────────────────────────────────
const ARCHITECT: ProfileTheme = {
  role: 'architect', name: 'Architect', tagline: 'Technical · Code-referenced · Precise',
  accent: B.blue, accentDark: B.blueDk, accentSoft: B.blueSoft, accentBorder: B.blueBdr,
  bg: B.bg, bg2: B.bg2, bg3: B.bg3,
  text: B.text, text2: B.text2, text3: B.text3,
  pass: B.pass, fail: B.fail, warn: B.warn,
  terms: {
    riser: 'Riser Height', tread: 'Tread Depth', width: 'Clear Width',
    handrail: 'Handrail Height', nosing: 'Nosing Projection', headroom: 'Headroom Clearance',
    report: 'Compliance Report', passed: 'Within Tolerance ✓', failed: 'Non-Compliant', scanning: 'Dimensional survey…',
  },
  copy: {
    reportTitle: 'Pre-Inspection Report', reportSubtitle: 'Compliance assessment against applicable building code',
    reportPrice: 'Generate Full Report — FREE during Beta', reportPriceNote: 'FREE during beta · Normally $2.99',
    proTitle: 'Pro — 20 Reports/month', proPrice: '$199/month', proNote: '20 scans/month, AR plane detection, all codes.',
    enterpriseTitle: 'Enterprise / Studio', enterpriseNote: 'Team seats, API access, BIM export.',
    findInspector: '📍 Find Architect / Inspector',
    scanIntro: "Ready to survey. Starting with riser height — face the riser, phone upright, ~1m distance.",
    verdictLikely: 'Likely Compliant ✅', verdictPossibly: 'Possibly Compliant 🔶', verdictFail: 'Issues Detected ⚠️',
  },
  aiPersona: `AUDIENCE: A registered architect or designer who is fully fluent in building code and construction terminology.

LANGUAGE: Use correct technical terms without explanation — riser, tread, nosing, going, headroom clearance, stringer, winder, landing, balustrade, newel post.
Cite code sections naturally: "OBC 9.8.4.1", "IRC R311.7.5.1", "IBC 1011.5".
Be peer-to-peer: concise, direct, no hand-holding.
State measurements with tolerances: "178mm — within OBC 130–200mm range".
Flag issues using architectural language: "nosing projection exceeds maximum", "going inconsistency detected", "no binding evident on this flight".
When something is off: "Riser variance suggests non-uniform flight — verify against s.9.8.4.3".

EXAMPLE messages:
"Riser face in frame. Reading ~178mm — within OBC 9.8.4.1 tolerance. Proceeding to tread depth."
"Tread going appears short. Reposition to top-down view for accurate measurement."
"No binding evident. Handrail bracket spacing looks compliant from this angle."`,
}

// ── 2. BUILDING MANAGER ───────────────────────────────────────────────────────
const BUILDING_MANAGER: ProfileTheme = {
  role: 'building_manager', name: 'Building Manager', tagline: 'Compliance · Liability · Clear reporting',
  accent: B.grayBlue, accentDark: B.blueDk, accentSoft: 'rgba(161,178,194,0.12)', accentBorder: 'rgba(161,178,194,0.30)',
  bg: B.bg, bg2: B.bg2, bg3: B.bg3,
  text: B.text, text2: B.text2, text3: B.text3,
  pass: B.pass, fail: B.fail, warn: B.warn,
  terms: {
    riser: 'Step Height', tread: 'Step Depth', width: 'Stair Width',
    handrail: 'Handrail Height', nosing: 'Step Edge', headroom: 'Overhead Clearance',
    report: 'Compliance Report', passed: 'Compliant ✓', failed: 'Non-Compliant', scanning: 'Compliance check in progress…',
  },
  copy: {
    reportTitle: 'Building Compliance Report', reportSubtitle: 'Stair assessment for building management records',
    reportPrice: 'Get Compliance Report — FREE during Beta', reportPriceNote: 'FREE during beta · Normally $2.99',
    proTitle: 'Pro — 20 Assessments/month', proPrice: '$199/month', proNote: '20 scans/month — ideal for multi-unit buildings.',
    enterpriseTitle: 'Enterprise', enterpriseNote: 'Multi-site management, team access, audit trail.',
    findInspector: '📍 Find a Certified Inspector',
    scanIntro: "Let's assess this staircase for compliance. I'll check each dimension against the applicable building code. Starting with step height — hold your phone upright facing the steps.",
    verdictLikely: 'Compliant ✅', verdictPossibly: 'Requires Verification 🔶', verdictFail: 'Compliance Issues Found ⚠️',
  },
  aiPersona: `AUDIENCE: A building manager or facilities professional. Understands compliance requirements and liability but is not a design professional.

LANGUAGE: Professional and clear. Use plain terms but don't over-explain. Frame everything in terms of compliance, liability, and record-keeping.
Say "step height" not "riser". Note if the riser (vertical face/kick plate) appears open or closed.
When measuring the tread (the flat part you step on, also called the "run"), introduce it as: "tread depth — that's the flat part you step on, sometimes called the run".
Say "compliant" and "non-compliant" freely — they know these terms.
Reference that issues need to be addressed "for compliance" or "to reduce liability".
Be matter-of-fact: no encouragement needed, but also no heavy jargon.

EXAMPLE messages:
"I can see the staircase. Measuring step height now — this checks compliance with the building code."
"Step height measures approximately 178mm — this is within the compliant range."
"Step depth appears short. This may be a compliance issue — I'll flag it in the report."
"Handrail height looks compliant from this angle. Positioning for a closer measurement."`,
}

// ── 3. CONTRACTOR ─────────────────────────────────────────────────────────────
const CONTRACTOR: ProfileTheme = {
  role: 'contractor', name: 'Contractor', tagline: 'Direct · Site language · Pass/fail',
  accent: B.orange, accentDark: B.orangeDk, accentSoft: B.orangeSoft, accentBorder: B.orangeBdr,
  bg: B.bg, bg2: B.bg2, bg3: B.bg3,
  text: B.text, text2: B.text2, text3: B.text3,
  pass: B.pass, fail: B.fail, warn: B.warn,
  terms: {
    riser: 'Riser', tread: 'Tread', width: 'Clear Width',
    handrail: 'Rail Height', nosing: 'Nosing', headroom: 'Headroom',
    report: 'Site Report', passed: 'Pass ✓', failed: 'Fail — Fix Required', scanning: 'Measuring…',
  },
  copy: {
    reportTitle: 'Site Compliance Check', reportSubtitle: 'Stair dimensions vs code — pass/fail per item',
    reportPrice: 'Get Site Report — FREE during Beta', reportPriceNote: 'FREE during beta · Normally $2.99',
    proTitle: 'Pro — 20 Checks/month', proPrice: '$199/month', proNote: '20 scans/month across all your sites.',
    enterpriseTitle: 'Enterprise', enterpriseNote: 'Team access, project management integration.',
    findInspector: '📍 Find Inspector',
    scanIntro: "Starting riser measurement. Phone upright, face-on to the riser, about 1m back. Hold steady.",
    verdictLikely: 'Passes Code ✅', verdictPossibly: 'Marginal — Verify 🔶', verdictFail: 'Fails Code ⚠️',
  },
  aiPersona: `AUDIENCE: A builder, carpenter, or construction tradesperson. Knows all the terminology — riser, tread, nosing, going, headroom, stringer. Does not need anything explained.

LANGUAGE: Direct site language. Short sentences. Measurements in mm. State pass/fail clearly.
Skip pleasantries. Be efficient — they're on a job site.
Use trade terms freely: nosing, going, balustrade, newel, stringer.
Note whether risers are open or closed (kick plate present or absent) — relevant for nosing code compliance.
When something fails: state the measurement, the requirement, and the deficiency in mm. Nothing more.

EXAMPLE messages:
"Riser: reading ~176mm. OBC max 200mm — pass."
"Tread looks short from here. Go top-down for the going measurement."
"Rail height ~940mm. Within 865–1070mm — pass."
"Nosing projection looks borderline. I'll flag for field verification."`,
}

// ── 4. DIY RENOVATOR ──────────────────────────────────────────────────────────
const DIY: ProfileTheme = {
  role: 'diy', name: 'DIY Renovator', tagline: 'Plain English · Step-by-step · No jargon',
  accent: B.orange, accentDark: B.orangeDk, accentSoft: B.orangeSoft, accentBorder: B.orangeBdr,
  bg: B.bg, bg2: B.bg2, bg3: B.bg3,
  text: B.text, text2: B.text2, text3: B.text3,
  pass: B.pass, fail: B.fail, warn: B.warn,
  terms: {
    riser: 'Step Height', tread: 'Step Depth', width: 'Stair Width',
    handrail: 'Handrail Height', nosing: 'Step Lip', headroom: 'Overhead Clearance',
    report: 'Your Results', passed: 'Looks Good ✓', failed: 'Needs Attention', scanning: 'Measuring your stairs…',
  },
  copy: {
    reportTitle: 'Your Stair Check', reportSubtitle: "Here's what we found about your stairs",
    reportPrice: 'Get the Full Report — $2.99', reportPriceNote: 'FREE during beta · Normally $2.99',
    proTitle: 'Unlimited Scans', proPrice: '$199/month', proNote: 'Scan as many staircases as you want. Cancel anytime.',
    enterpriseTitle: 'Need professional help?', enterpriseNote: 'Talk to our team — we can connect you with a local inspector.',
    findInspector: '📍 Find a Local Inspector',
    scanIntro: "Hi! I'm going to help you check your stairs. We'll start by measuring the step height — that's how tall each step is. Hold your phone upright and point it at the front of the steps.",
    verdictLikely: 'Your stairs look good! ✅', verdictPossibly: 'A few things to double-check 🔶', verdictFail: 'Some issues found ⚠️',
  },
  aiPersona: `AUDIENCE: A homeowner or DIY renovator with no construction background. They have never heard terms like "riser", "tread", "nosing", or "headroom clearance".

LANGUAGE: Always explain what you are measuring in plain English BEFORE or AS you measure it.
Never use a technical term without explaining it. Every time.
"Riser" → always say "step height (that's the vertical face of each step)"
"Tread" → always say "step depth (how far back each step goes)"
"Nosing" → always say "the little lip at the front edge of the step"
"Headroom" → always say "the clearance above your head as you walk up"
"Handrail" → just say "handrail" — this one they know
Be warm, encouraging, and patient. This may be their first time.
Celebrate good results: "That's perfect!", "Great — that step is the right height!"
For issues: "This step might be a little too tall — that can make stairs harder to climb safely."

EXAMPLE messages:
"I can see your stairs! First I'll measure the step height — that's how tall the vertical face of each step is. Hold your phone steady..."
"Great news — that step height looks just right! Safe stairs usually have steps between 130mm and 200mm tall."
"Now I need to measure the step depth — that's how far back each step goes from front to back."
"Hmm, this step looks a little shallow. Steps should be at least 220mm deep so your whole foot fits on them."`,
}

// ── 5. REAL ESTATE PROFESSIONAL ───────────────────────────────────────────────
const REALESTATE: ProfileTheme = {
  role: 'realestate', name: 'Real Estate Professional', tagline: 'Risk · Liability · Property value',
  accent: B.grayBlue, accentDark: B.blueDk, accentSoft: 'rgba(161,178,194,0.10)', accentBorder: 'rgba(161,178,194,0.28)',
  bg: B.bg, bg2: B.bg2, bg3: B.bg3,
  text: B.text, text2: B.text2, text3: B.text3,
  pass: B.pass, fail: B.fail, warn: B.warn,
  terms: {
    riser: 'Step Height', tread: 'Step Depth', width: 'Stair Width',
    handrail: 'Handrail', nosing: 'Step Edge', headroom: 'Overhead Clearance',
    report: 'Property Report', passed: 'Code Compliant ✓', failed: 'Compliance Issue', scanning: 'Property assessment…',
  },
  copy: {
    reportTitle: 'Stair Compliance Assessment', reportSubtitle: 'Pre-listing compliance check for disclosure purposes',
    reportPrice: 'Get Property Report — FREE during Beta', reportPriceNote: 'One-time · Suitable for disclosure file · Instant PDF',
    proTitle: 'Pro — Unlimited Properties', proPrice: '$199/month', proNote: 'Assess every property in your portfolio.',
    enterpriseTitle: 'Brokerage / Team Plan', enterpriseNote: 'Team access, branded reports, portfolio management.',
    findInspector: '📍 Find a Certified Inspector',
    scanIntro: "I'll assess this staircase for code compliance — useful for disclosure and pre-listing purposes. Starting with step height. Hold your phone upright facing the stairs.",
    verdictLikely: 'Likely Code Compliant ✅', verdictPossibly: 'May Require Disclosure 🔶', verdictFail: 'Compliance Issues — Review Required ⚠️',
  },
  aiPersona: `AUDIENCE: A real estate agent, broker, or property investor. Understands compliance risk and property liability but is not a builder or designer.

LANGUAGE: Business-focused and professional. Frame everything in terms of risk, disclosure, liability, and property value.
Use plain but professional terms — "step height" not "riser". Mention the riser can be open (no panel) or closed.
For tread depth, note it's also called the "run" — the flat surface buyers and occupants step on.
Use "code compliant" and "disclosure" freely — they understand these terms.
Flag issues in terms of their property impact: "this could require disclosure", "a buyer's inspector is likely to flag this", "this may affect the property's insurability".
Be helpful and informative, not alarming. Frame issues as manageable.

EXAMPLE messages:
"Measuring step height now — this is one of the items a buyer's home inspector will check."
"Step height measures ~178mm — code compliant. No disclosure required for this item."
"Step depth looks short here. This is the kind of issue that can come up during a buyer's inspection — worth noting for disclosure."
"Handrail height looks good. Compliant handrails are often flagged in older properties, so this is a positive."`,
}

// ── Lookup ────────────────────────────────────────────────────────────────────
const PROFILES: Record<UserRole, ProfileTheme> = {
  architect:        ARCHITECT,
  building_manager: BUILDING_MANAGER,
  contractor:       CONTRACTOR,
  diy:              DIY,
  realestate:       REALESTATE,
}

export function getProfile(role?: UserRole | null): ProfileTheme {
  if (!role) return DIY
  return PROFILES[role] ?? DIY
}

export function getProfileLabel(role?: UserRole | null): string {
  return getProfile(role).name
}

export { ARCHITECT, BUILDING_MANAGER, CONTRACTOR, DIY, REALESTATE }
