/**
 * inspection-standards.ts
 *
 * Standards, specifications, and placeholder content for every module.
 * Used by the report generator to produce a complete, professional report
 * even when a module hasn't been fully inspected yet.
 *
 * Format mirrors Carson Dunlop / HORIZON:
 *   descriptions  — material types, specifications present in every report
 *   standard      — what a passing inspection looks like (reference baseline)
 *   implications  — why this component matters
 *   limitations   — what the inspector can/cannot see
 */

export interface ModuleStandard {
  descriptions:  string[]    // descriptor lines shown in the Descriptions block
  standard:      string      // one-paragraph baseline: what good looks like
  implications:  string      // why this matters if deficient
  limitations:   string      // scope / access limitations
  checkItems:    string[]    // bulleted checklist items shown when no finding captured
  codeRef:       string      // primary OBC reference
}

export const INSPECTION_STANDARDS: Partial<Record<string, ModuleStandard>> = {

  // ── PROPERTY SETUP ─────────────────────────────────────────────────────────

  property_details: {
    descriptions:  ['Building type: Single Storey Detached Residential', 'Foundation: Poured concrete', 'Exterior walls: Wood frame with brick veneer', 'Roof framing: Trusses', 'Roof covering: Asphalt shingles'],
    standard:      'Property details confirm the building type, age, construction materials, and site conditions. This information is used to determine applicable code editions and inspection scope.',
    implications:  'Accurate property data ensures the correct code edition is applied and the scope of inspection is properly defined.',
    limitations:   'Visual inspection only. Concealed structure, buried services, and areas not accessible at the time of inspection are excluded.',
    checkItems:    ['Building address and legal description confirmed', 'Building type and occupancy classification recorded', 'Estimated age noted', 'Exterior wall and roof construction materials identified', 'Foundation type identified'],
    codeRef:       'OBC 2024 Division A',
  },

  drawings_review: {
    descriptions:  ['Document type: Architectural drawings and specifications', 'Permit status: Review required', 'Drawing scale: As indicated'],
    standard:      'Submitted drawings must include a site plan, floor plans, elevations, and sections with sufficient detail to confirm code compliance. An approved permit must be posted on-site before construction begins. Drawings must show occupancy class, construction type, setbacks, lot coverage, building height, and means of egress.',
    implications:  'Construction without approved drawings or permits may result in orders to stop work, demolition orders, and difficulty obtaining title insurance or financing.',
    limitations:   'This review is limited to documents provided. It does not constitute an approval of engineering or architectural design. Structural design must be stamped by a licensed engineer where required.',
    checkItems:    ['Site plan showing property lines and setbacks', 'Floor plan at sufficient scale', 'Elevations showing building height and cladding', 'Occupancy classification identified', 'Construction type identified', 'Means of egress shown', 'Permit number issued and posted on-site'],
    codeRef:       'OBC Act s.8; OBC 2024 Div B Part 3',
  },

  permit_issuance: {
    descriptions:  ['Permit type: Building permit', 'Issuing authority: Local municipality'],
    standard:      'A valid building permit must be obtained from the local building department before commencing construction. The permit number and approved drawings must be available on-site for inspector review at each hold point. Permit fees are based on construction value.',
    implications:  'Unpermitted construction creates liability for the owner and may result in stop-work orders, mandatory removal, and difficulty selling the property.',
    limitations:   'Permit status confirmed by documents presented at time of inspection. Online portal verification recommended.',
    checkItems:    ['Permit number obtained and recorded', 'Approved drawings on-site', 'Permit card posted visibly on-site', 'Permit conditions reviewed'],
    codeRef:       'OBC Act s.8(1)',
  },

  site_plan_review: {
    descriptions:  ['Lot area: To be confirmed from survey', 'Required setbacks: Per zoning by-law'],
    standard:      'The site plan must confirm minimum setbacks from all lot lines, maximum lot coverage, maximum building height, grading plan showing drainage away from the foundation, driveway location, and all easements or right-of-ways. Zoning compliance must be confirmed with the local municipality.',
    implications:  'Non-compliant setbacks or lot coverage may require variance applications or demolition of non-compliant elements.',
    limitations:   'Zoning compliance is determined by the municipality. This inspection confirms physical measurements match the approved drawings.',
    checkItems:    ['Setbacks measured and confirmed vs. drawings', 'Lot coverage calculated', 'Building height confirmed', 'Grading plan reviewed for positive drainage', 'Easements identified on survey'],
    codeRef:       'OBC 2024 3.3; Local Zoning By-law',
  },

  // ── EXCAVATION & FOOTINGS ──────────────────────────────────────────────────

  footing_depth: {
    descriptions:  ['Frost depth (Ontario): 1.2 m minimum', 'Footing material: Poured concrete'],
    standard:      'Footings must bear below the frost line. In Ontario, the minimum frost depth is 1.2 m (4 ft) below finished grade. Footings must rest on undisturbed or engineered fill with adequate bearing capacity. Bottom of excavation must be free of loose material, ice, and standing water before concrete is placed.',
    implications:  'Footings above frost depth are subject to frost heave, causing foundation movement, cracking, and structural damage.',
    limitations:   'Depth measured from finished grade at time of inspection. Actual depth may vary with final grading. Excavation must be open for inspection — this hold point cannot be verified after backfill.',
    checkItems:    ['Footing depth measured at minimum 3 locations', 'Bottom of footing below 1.2 m frost depth', 'Bottom of excavation free of loose material and water', 'Bearing surface confirmed — undisturbed soil or engineered fill', 'No frozen material in bearing zone'],
    codeRef:       'OBC 2024 9.15.1',
  },

  footing_width: {
    descriptions:  ['Minimum footing width: 480 mm for single-storey residential', 'Footing projection each side: min. equal to wall thickness or 100 mm'],
    standard:      'Footing width must be sufficient to distribute building loads to the bearing soil. For single-storey residential, minimum footing width is 480 mm. The projection beyond the wall face must be at least equal to the wall thickness and not less than 100 mm on each side. Footing thickness must be at least 200 mm. Reinforcement may be required by engineer depending on soil conditions.',
    implications:  'Undersized footings concentrate loads on a smaller area, potentially exceeding soil bearing capacity and causing differential settlement.',
    limitations:   'Footing dimensions measured where visible. Submerged or formed sections require dewatering and/or forming removal for accurate measurement.',
    checkItems:    ['Footing width measured at minimum 3 locations', 'Minimum 480 mm width confirmed', 'Projection each side >= 100 mm (or wall thickness)', 'Footing thickness >= 200 mm', 'Step footings meet minimum overlap requirements', 'Reinforcement present if required by engineer'],
    codeRef:       'OBC 2024 9.15.3',
  },

  bearing_soil: {
    descriptions:  ['Soil type: To be confirmed by visual inspection and/or geotechnical report'],
    standard:      'Bearing soil must be capable of supporting design loads without excessive settlement. Minimum allowable bearing pressure for undisturbed native soil varies by type: compact gravel/sand: 150 kPa, firm clay: 75 kPa. Soft, wet, organic, or disturbed soils require engineered fill or deep foundations. All organic material (topsoil, peat) must be removed from beneath footings.',
    implications:  'Inadequate bearing capacity causes settlement, which leads to foundation cracking, uneven floors, and structural damage.',
    limitations:   'Visual soil assessment only. Formal geotechnical investigation required for questionable soils. Water content and bearing capacity of disturbed fill cannot be reliably determined visually.',
    checkItems:    ['Organic material removed from bearing zone', 'Soil type identified visually', 'No soft, wet, or disturbed material under footings', 'Geotechnical report obtained if soil is questionable', 'Fill (if present) is properly compacted engineered fill'],
    codeRef:       'OBC 2024 9.15.2',
  },

  drain_tile: {
    descriptions:  ['Pipe type: 100 mm perforated HDPE (corrugated)', 'Bedding: 19 mm clear stone', 'Filter fabric: Geotextile sock or wrap required'],
    standard:      'Perimeter drainage tile (weeping tile) must be 100 mm minimum diameter perforated pipe installed in a bed of 19 mm clear stone. A geotextile filter fabric must wrap the pipe and/or stone to prevent soil fines from migrating into and clogging the system. Minimum slope is 1:100 (1%) toward a sump pit or daylight outlet. The outlet must be protected from backflow and verified unobstructed.',
    implications:  'Clogged or absent drain tile results in hydrostatic pressure against the foundation wall, causing water infiltration, efflorescence, and eventual structural deterioration.',
    limitations:   'Drain tile must be inspected before backfill. Slope cannot be confirmed without instrument. Long-term drainage performance cannot be guaranteed.',
    checkItems:    ['100 mm min. diameter perforated pipe', 'Geotextile filter fabric installed', '19 mm clear stone bedding', 'Minimum 1:100 slope to outlet', 'Outlet protected and unobstructed', 'Pipe installed at footing level or below', 'Sump pit provided where gravity outlet not available'],
    codeRef:       'OBC 2024 9.14.3',
  },

  // ── FOUNDATION ─────────────────────────────────────────────────────────────

  foundation_inspection: {
    descriptions:  ['Foundation wall type: Poured concrete', 'Wall thickness: 200 mm minimum for residential', 'Reinforcement: As per engineer\'s design'],
    standard:      'Foundation walls must be constructed of poured concrete, concrete masonry units (CMU), or preserved wood. Minimum wall thickness for residential is 200 mm for poured concrete. Walls must be plumb, free of major cracks, honeycombing, or cold joints. Tie holes must be sealed. All form ties must be cut flush or recessed.',
    implications:  'Foundation wall defects including cracks, honeycombing, and cold joints allow water infiltration and reduce structural capacity.',
    limitations:   'This inspection is a visual assessment of exposed surfaces. Concealed reinforcement, soil pressures, and long-term settlement cannot be assessed without engineering review.',
    checkItems:    ['Wall thickness measured', 'Walls plumb and aligned', 'No major cracks (> 6 mm)', 'No honeycombing or voids', 'Cold joints absent or properly treated', 'Form ties cut flush, holes sealed', 'Reinforcement installed per engineer\'s drawings'],
    codeRef:       'OBC 2024 9.15.4; 9.16',
  },

  damp_proofing: {
    descriptions:  ['Membrane type: Bituminous / polymer-modified asphalt', 'Application: Spray or roller-applied', 'Coverage: Full height from footing to grade'],
    standard:      'All below-grade foundation walls must be damp-proofed with a continuous membrane applied from the top of the footing to finished grade. The membrane must be free of holidays (missed areas), pinholes, and fisheyes. Joints and penetrations must be sealed. Drainage board is applied over the membrane where required. Damp-proofing must be protected before backfilling.',
    implications:  'Incomplete or damaged damp-proofing allows moisture to penetrate the foundation wall, leading to efflorescence, mould, and eventual concrete deterioration.',
    limitations:   'Coverage assessed visually. Adhesion and thickness cannot be confirmed without destructive testing.',
    checkItems:    ['Full coverage from top of footing to grade', 'No holidays, pinholes, or fisheyes', 'Penetrations sealed (pipes, conduits)', 'Membrane protected from damage before backfill', 'Drainage board installed where required by design'],
    codeRef:       'OBC 2024 9.13.2',
  },

  foundation_drainage: {
    descriptions:  ['System type: Exterior drainage board + weeping tile', 'Drainage layer: Granular fill or drainage board'],
    standard:      'The foundation drainage system must manage both surface water and ground water. A drainage board or granular fill layer must be installed against the foundation wall from the footing to a point above grade. This directs water to the perimeter drain tile. Backfill material must be free of large rocks and debris that could damage the membrane.',
    implications:  'Without adequate drainage, water builds up against the foundation creating hydrostatic pressure, leading to wall cracking, leakage, and potential failure.',
    limitations:   'Drainage system performance can only be confirmed during and immediately after inspection. Long-term effectiveness depends on maintenance of outlets and grading.',
    checkItems:    ['Drainage board or granular fill in place', 'Drainage layer extends full height of wall', 'Connected to weeping tile at base', 'Backfill material appropriate (no large rocks)', 'Positive drainage slope maintained during backfill'],
    codeRef:       'OBC 2024 9.14.1',
  },

  // ── FRAMING & ROUGH-IN ─────────────────────────────────────────────────────

  structural_framing: {
    descriptions:  ['Wall framing: 38 x 89 mm (2x4) or 38 x 140 mm (2x6) SPF studs at 400 mm or 600 mm o/c', 'Bearing: Double top plate at all load-bearing walls', 'Connections: Structural screws or nails per schedule'],
    standard:      'Structural framing must comply with OBC Part 9 wood frame construction requirements. Studs must be straight and continuous from plate to plate. Load-bearing walls require double top plates with minimum 600 mm lap at joints. All headers over openings must be sized per span tables. Cripple studs, jack studs, and king studs must be present at all openings. Engineered lumber must bear engineer\'s stamp.',
    implications:  'Structural framing deficiencies including under-sized headers, missing studs, and improper connections create weak points that can fail under load.',
    limitations:   'Framing must be inspected before insulation and drywall. Concealed conditions cannot be assessed after close-in.',
    checkItems:    ['Stud spacing confirmed', 'Load-bearing walls have double top plate', 'Headers sized per span table or engineer', 'Cripple/jack/king studs present at openings', 'Notching and boring within code limits', 'Engineered lumber stamped and installed per drawings', 'Connections to foundation per holddown schedule'],
    codeRef:       'OBC 2024 9.23',
  },

  floor_systems: {
    descriptions:  ['Joist type: Dimensional lumber or engineered I-joist', 'Subfloor: 19 mm tongue-and-groove OSB or plywood', 'Bearing: 38 mm minimum at each end'],
    standard:      'Floor joists must be sized per span tables for the applicable load (residential: 1.9 kPa live + 0.5 kPa dead). All joists must have minimum 38 mm bearing at each end. Notching and boring must comply with OBC 9.23.7. Bridging or blocking is required at maximum 2.1 m intervals for joists over 38 mm deep. Subfloor must be glued and nailed with no squeaks or deflection.',
    implications:  'Undersized or damaged joists deflect excessively, causing uneven floors. Improper notching reduces structural capacity and can cause failure.',
    limitations:   'Joist sizes confirmed where visible. Concealed joists above finished ceiling require invasive investigation.',
    checkItems:    ['Joist size and spacing confirmed vs. drawings', 'Minimum 38 mm bearing at each end', 'Notching within code limits (max 1/3 depth at end, 1/4 depth in middle third)', 'Drilling within code limits (max 1/3 depth)', 'Bridging or blocking at <= 2.1 m intervals', 'Subfloor properly glued and fastened', 'No point loads without blocking'],
    codeRef:       'OBC 2024 9.23.4; 9.23.7',
  },

  roof_framing_rough: {
    descriptions:  ['Roof type: Prefabricated wood trusses', 'Truss spacing: 600 mm o/c typical', 'Ridge: As per truss design'],
    standard:      'Roof trusses or rafters must be installed per the manufacturer\'s stamped drawings. Trusses must not be cut, notched, or modified in any way — any modifications require engineer re-design. Bracing members must be installed per drawings. Truss plates must be fully embedded. Ridge board must be minimum 25 mm wider than plumb cut of rafter.',
    implications:  'Roof framing deficiencies can cause roof collapse under snow load. Truss modifications are particularly dangerous as they alter the engineered load path.',
    limitations:   'Truss plates and hidden connections cannot be fully inspected once trusses are installed. Attic access required for full inspection.',
    checkItems:    ['Trusses installed per stamped drawings', 'No modifications to trusses (cuts, notches, openings)', 'All bracing members installed', 'Truss plates fully seated', 'Ridge, hip, and valley members correctly sized', 'Collar ties or ceiling joists in place where required', 'Attic ventilation openings confirmed'],
    codeRef:       'OBC 2024 9.23.13',
  },

  rough_plumbing: {
    descriptions:  ['Supply pipe: 19 mm copper or PEX', 'Drain/waste/vent: 100 mm and 50 mm ABS or PVC', 'Water heater: Gas-fired conventional tank'],
    standard:      'Drain, waste, and vent (DWV) piping must be properly sized, sloped at minimum 1:50 (2%) for horizontal runs, and supported at maximum 1.2 m intervals for horizontal pipe and 1.8 m for vertical. All drain connections must have proper trap and vent to prevent sewer gas entry. Supply pipes must be insulated in unheated spaces. Pressure test required before close-in.',
    implications:  'Improper plumbing leads to sewer gas infiltration (health hazard), drain blockages, and water hammer. Inadequate slope causes standing water and blockages.',
    limitations:   'Rough-in must be inspected before walls close. Pressure test required. Water flow and fixtures cannot be tested until final inspection.',
    checkItems:    ['DWV sized per code and fixture count', 'Horizontal drain slope >= 1:50', 'All fixtures properly trapped and vented', 'Supply pipes insulated in unheated spaces', 'Pressure test completed (air or water)', 'Clean-outs provided at base of stacks and every 30 m', 'Stack vent terminates above roof per OBC'],
    codeRef:       'OBC 2024 Part 7',
  },

  rough_electrical: {
    descriptions:  ['Service size: 200A, 240V', 'Main panel: Circuit breaker type', 'Wiring: 14 AWG and 12 AWG NMD-90 copper'],
    standard:      'Electrical rough-in must comply with the Ontario Electrical Safety Code (OESC). All wiring must be properly supported and protected from physical damage. Boxes must be plumb and at correct depth for finish. Wire bends must have minimum 6x wire diameter radius. All circuits must be identified in the panel. AFCI protection required for bedroom circuits. GFCI required within 1.5 m of water sources.',
    implications:  'Electrical deficiencies are a leading cause of house fires and electrocution. Improperly supported or protected wiring can arc and ignite insulation.',
    limitations:   'Rough-in inspected before drywall. Electrical inspections are carried out by the Electrical Safety Authority (ESA) in Ontario — this report is supplemental only. ESA inspection certificate required.',
    checkItems:    ['All boxes at correct depth', 'Wiring supported at <= 1.5 m', 'Wire protection at studs (nail plates where < 32 mm from face)', 'Minimum 14 AWG for 15A circuits', 'Panel sized with 20% spare capacity', 'AFCI breakers for bedroom circuits', 'GFCI outlets within 1.5 m of water'],
    codeRef:       'OBC 2024 Part 8; OESC 26th Edition',
  },

  rough_hvac: {
    descriptions:  ['Heat source: Natural gas forced-air furnace', 'Distribution: Sheet metal ductwork', 'Combustion air: Dedicated supply'],
    standard:      'HVAC rough-in must provide adequate supply and return air to all habitable rooms. Ductwork must be sealed at all joints. Combustion air supply must be confirmed for gas appliances — minimum 30 m3 volume per 0.6 kW input or dedicated outside air supply. Gas lines must be pressure-tested. HRV or mechanical ventilation required per OBC 9.32.',
    implications:  'Insufficient combustion air causes incomplete combustion, carbon monoxide production, and appliance backdrafting. Under-sized ducts cause comfort problems and excessive energy use.',
    limitations:   'Duct leakage cannot be confirmed without blower door test. Gas line pressure test required before cover-up. Combustion appliance testing performed at final inspection.',
    checkItems:    ['Supply and return to all habitable rooms', 'All duct joints sealed with mastic or UL-listed tape', 'Combustion air volume confirmed or dedicated supply installed', 'Gas lines pressure-tested (min. 14 kPa for 15 min)', 'HRV or exhaust fans installed per OBC 9.32', 'Filter access provided', 'Dryer exhaust to exterior (max 6 m equivalent length)'],
    codeRef:       'OBC 2024 Part 6; 9.32',
  },

  fire_blocking: {
    descriptions:  ['Fire blocking material: Lumber, gypsum board, or mineral wool', 'Required locations: At floor lines, ceiling lines, and all concealed stud spaces > 3 m'],
    standard:      'Fire blocking must be provided in all concealed stud wall spaces at floor and ceiling lines, at the top and bottom of stair stringers, between floor and soffit, at horizontal soffits, and at all concealed spaces > 3.0 m in any direction. Penetrations through fire blocking must be sealed with fire-rated sealant (intumescent or mineral wool). All service penetrations must be sealed.',
    implications:  'Absent or inadequate fire blocking allows fire to travel rapidly through concealed wall and floor cavities, giving occupants less time to escape.',
    limitations:   'Fire blocking inspection must be completed before drywall. Penetration sealing cannot be confirmed after close-in.',
    checkItems:    ['Fire blocking at all floor lines', 'Fire blocking at all ceiling lines', 'Fire blocking at top and bottom of stairs', 'No concealed space > 3.0 m without blocking', 'All service penetrations sealed with fire-rated material', 'Fire blocking supports confirmed (not toe-nailed only)', 'Attic hatch fire separation confirmed'],
    codeRef:       'OBC 2024 9.10.17',
  },

  // ── INSULATION ─────────────────────────────────────────────────────────────

  insulation_walls: {
    descriptions:  ['Wall insulation: Batt insulation, fibreglass or mineral wool', 'Minimum R-value (exterior wall): R-22 for Climate Zone 5 (Ontario)', 'Vapour barrier: 6-mil polyethylene on warm side'],
    standard:      'Exterior wall insulation must achieve minimum effective R-22 in Ontario (Climate Zone 5). Batts must fill the full depth of the stud cavity without compression or voids. All electrical boxes, pipes, and rough openings must be fully insulated around. Continuous insulation or thermal break required where specified. Vapour barrier on warm (interior) side of insulation, sealed at all penetrations.',
    implications:  'Under-insulated walls cause excessive heat loss, high energy bills, condensation within the wall cavity, and mould growth. Missing insulation at thermal bridges creates cold spots.',
    limitations:   'Installed R-value confirmed by product label and batt thickness. Thermal bridging and convective loops within cavities cannot be confirmed without thermographic imaging.',
    checkItems:    ['Full cavity fill with no voids or compression', 'Minimum R-22 effective achieved', 'Insulation behind electrical boxes installed', 'Wind wash barriers at exterior sheathing joints', 'Rim joist insulation installed', 'Cantilevered floor insulation installed', 'Vapour barrier continuous on warm side'],
    codeRef:       'OBC 2024 9.25; Table 9.25.4.1',
  },

  insulation_ceiling: {
    descriptions:  ['Attic insulation: Blown mineral wool or fibreglass', 'Minimum R-value (ceiling): R-60 for Climate Zone 5 (Ontario)', 'Eave ventilation: Baffles at all rafter bays'],
    standard:      'Attic insulation must achieve minimum R-60 in Ontario. Insulation must maintain a minimum 50 mm clearance from the roof deck at the eaves for ventilation. Insulation baffles must be installed at every rafter bay to prevent blocking of soffit vents. Attic hatch must be insulated to the same level as the surrounding attic floor. All air leakage paths must be sealed before insulation is installed.',
    implications:  'Under-insulated attics are responsible for 25-30% of heat loss in a typical house. Ice damming caused by heat escaping through the ceiling melts snow which refreezes at the eaves causing water damage.',
    limitations:   'Insulation depth measured with a depth gauge or ruler at multiple locations. Settled insulation may have reduced R-value. Concealed air leakage paths cannot be confirmed without blower door test.',
    checkItems:    ['Minimum R-60 depth achieved', 'Uniform coverage with no voids', '50 mm clearance maintained at eaves', 'Ventilation baffles at all rafter bays', 'Attic hatch insulated and weather-stripped', 'Top plates sealed to prevent air leakage', 'All plumbing/electrical penetrations sealed'],
    codeRef:       'OBC 2024 9.25; Table 9.25.4.1',
  },

  vapour_barrier: {
    descriptions:  ['Vapour barrier: 6-mil (0.15 mm) polyethylene sheet', 'Location: Warm side of insulation (interior face)', 'Laps: Minimum 150 mm, sealed with acoustical sealant'],
    standard:      'A continuous polyethylene vapour barrier of minimum 6-mil thickness must be installed on the warm side of all insulated walls, ceilings, and floors over unheated spaces. All joints must lap minimum 150 mm and be sealed with acoustical sealant or poly tape. All penetrations (electrical boxes, pipes, windows) must be sealed. The vapour barrier must be continuous from slab to underside of roof sheathing.',
    implications:  'Discontinuous vapour barrier allows warm moist interior air to enter the wall cavity where it condenses on cold surfaces, causing mould, wood rot, and structural damage.',
    limitations:   'Vapour barrier continuity confirmed visually. Penetration sealing assessed but small pinholes and joint failures cannot be detected without pressurization testing.',
    checkItems:    ['6-mil poly installed on warm side', 'Joints lapped minimum 150 mm', 'All joints sealed with acoustical sealant or tape', 'Electrical boxes sealed with pre-formed poly boots or sealant', 'Plumbing penetrations sealed', 'Window and door rough openings sealed', 'Continuous from slab to roof sheathing'],
    codeRef:       'OBC 2024 9.25.3',
  },

  // ── OCCUPANCY & FINAL ──────────────────────────────────────────────────────

  stair_compliance: {
    descriptions:  ['Stair type: Interior residential', 'Riser height: 125 mm minimum, 200 mm maximum', 'Tread depth: 235 mm minimum', 'Width: 860 mm minimum clear between handrails'],
    standard:      'All stairs must meet OBC 9.8.4: Maximum rise 200 mm, minimum run 235 mm, maximum variation between largest and smallest rise or run in one flight is 5 mm. Minimum width 860 mm clear. Headroom minimum 1,950 mm measured vertically from stair nosing. Handrail required on all stairs with 3 or more risers, between 800-965 mm above stair nosing, graspable. Handrail must return to wall or post.',
    implications:  'Non-compliant stairs are a major fall hazard. Inconsistent rise/run dimensions cause people to misstep. Inadequate headroom causes injury. Missing or non-graspable handrails prevent arrest of falls.',
    limitations:   'Measurements taken at worst-case locations. Finished surfaces (carpet, tile) may alter effective rise/run. AI measurements are supplemental — physical verification required for permit sign-off.',
    checkItems:    ['Maximum rise <= 200 mm', 'Minimum run >= 235 mm', 'Rise/run variation <= 5 mm within flight', 'Width >= 860 mm clear', 'Headroom >= 1,950 mm', 'Handrail 800-965 mm above nosing', 'Handrail graspable (32-38 mm diameter or equivalent)', 'Handrail continuous for full stair width', 'Handrail returns to wall at both ends'],
    codeRef:       'OBC 2024 9.8.4; 9.8.6',
  },

  guardrails_handrails: {
    descriptions:  ['Guard height: 900 mm minimum for floors <= 1,800 mm above grade', 'Baluster spacing: 100 mm maximum opening', 'Material: Structural capacity to resist 0.5 kN/m'],
    standard:      'Guards are required wherever there is a drop of more than 600 mm. Minimum height is 900 mm for residential up to 1,800 mm above grade; 1,070 mm for drops > 1,800 mm (i.e. second-floor decks). No opening in the guard shall allow passage of a 100 mm sphere. Guards must withstand a horizontal load of 0.5 kN/m. Posts must be positively attached to the structure — clamp-on post systems are not compliant without additional engineering.',
    implications:  'Non-compliant guards are a leading cause of falls from height. Under-height guards, excessive baluster spacing, and poorly anchored posts all create fall hazards.',
    limitations:   'Guard height and opening sizes measured at multiple locations. Structural adequacy of post connections confirmed visually — load testing not performed.',
    checkItems:    ['Guard height >= 900 mm (or 1,070 mm where required)', 'No opening > 100 mm sphere', 'No climbable horizontal rails between 140-900 mm height', 'Posts anchored to structure (not clamp-on)', 'Guard able to resist 0.5 kN/m lateral load', 'Stair guards continuous for full stair length', 'Graspable handrail at all stair guards'],
    codeRef:       'OBC 2024 9.8.7; 9.8.8',
  },

  smoke_co_detectors: {
    descriptions:  ['Smoke alarms: Photoelectric or ionization, or combination', 'CO alarms: Electrochemical sensor', 'Interconnection: Required in new construction'],
    standard:      'Smoke alarms required on every storey, in every sleeping room, and in every hallway serving sleeping rooms. CO alarms required on every storey with a fuel-burning appliance or attached garage. All alarms must be interconnected so activation of one triggers all. Alarms must be hardwired with battery backup in new construction. Alarms must be installed within 300 mm of ceiling (not in dead air space corners). Replace alarms after 10 years.',
    implications:  'Smoke and CO alarms save lives by providing early warning. Missing interconnection means alarms in uninhabited parts of the home do not warn sleeping occupants.',
    limitations:   'Placement, interconnection, and power source confirmed visually. Alarm functionality requires physical testing. Age of existing alarms confirmed from manufacture date on back of unit.',
    checkItems:    ['Smoke alarm on every storey', 'Smoke alarm in every sleeping room', 'Smoke alarm in every hallway serving sleeping rooms', 'CO alarm on every storey with fuel-burning appliances or garage', 'All alarms hardwired with battery backup', 'All alarms interconnected', 'Alarms within 300 mm of ceiling, outside dead air corners', 'CO alarm within 1-5 m of sleeping area'],
    codeRef:       'OBC 2024 9.10.19; 9.10.21; Fire Code',
  },

  egress_windows: {
    descriptions:  ['Minimum opening area: 0.35 m2', 'Minimum dimension (height or width): 380 mm', 'Maximum sill height: 1,000 mm above floor'],
    standard:      'All sleeping rooms must have at least one outside window or door with a minimum unobstructed opening of 0.35 m2 and minimum dimension of 380 mm in both height and width. The bottom of the opening must be no more than 1,000 mm above the floor. Windows in bedrooms must be openable from inside without tools or special knowledge. Window well egress windows must have a minimum 900 mm clearance in front of the window.',
    implications:  'Inadequate egress windows prevent occupants from escaping and firefighters from entering during a fire emergency.',
    limitations:   'Opening dimensions measured with window fully open. Some windows have limited openings (awning, casement restrictors). Operational testing required.',
    checkItems:    ['Opening area >= 0.35 m2', 'Opening height >= 380 mm', 'Opening width >= 380 mm', 'Sill height <= 1,000 mm above floor', 'Window operable from inside without tools', 'Window well (if applicable) >= 900 mm clear', 'Window well has drainage', 'Security bars (if present) release from inside'],
    codeRef:       'OBC 2024 9.7.2',
  },

  services_electrical: {
    descriptions:  ['Service entrance: Overhead, 200A/240V', 'Panel: Circuit breaker', 'Grounding: Water pipe + ground rod'],
    standard:      'All electrical work must be inspected and approved by the Electrical Safety Authority (ESA) in Ontario. The distribution panel must be labeled with all circuit breakers identified. No live exposed conductors. All outlets within 1.5 m of water sources must be GFCI protected and tested. Arc-fault protection required for bedroom circuits. Service entrance cable must be protected at weatherhead.',
    implications:  'Electrical deficiencies are a leading cause of house fires. Improperly terminated connections arc and ignite. Lack of GFCI protection results in electrocution near water.',
    limitations:   'ESA inspection approval must be obtained separately. This report is supplemental. Wiring within walls cannot be assessed without invasive investigation.',
    checkItems:    ['ESA inspection approved', 'Panel labeled and accessible', 'No live exposed conductors', 'GFCI outlets within 1.5 m of all water sources', 'AFCI breakers for bedroom circuits', 'All outlets operational', 'Exterior outlets weatherproof-rated', 'Ground fault protection for outdoor and garage circuits'],
    codeRef:       'OBC 2024 Part 8; OESC 26th Edition; ESA',
  },

  exterior_walls: {
    descriptions:  ['Cladding type: As noted on approved drawings', 'Flashing: At all wall/roof junctions, windows, and doors'],
    standard:      'Exterior cladding must provide a continuous weather-resistive barrier. All penetrations, windows, and doors must be properly flashed to direct water to the exterior. Cladding must maintain minimum clearances from grade (150 mm for wood, 50 mm for fibre cement). Kickout flashing required at all roof/wall junctions to direct water away from the wall.',
    implications:  'Water infiltration behind cladding causes concealed rot, mould, and structural damage that may not be visible for years.',
    limitations:   'Concealed water damage behind cladding cannot be confirmed without invasive investigation. Moisture content of framing cannot be determined without a moisture meter.',
    checkItems:    ['Cladding clearance from grade >= 150 mm (wood)', 'All window/door penetrations flashed', 'Kickout flashing at all roof/wall junctions', 'Weep holes present in brick veneer (every 3rd brick at base)', 'No cracks or gaps in cladding', 'Caulking at all penetrations', 'Trim boards sealed at joints'],
    codeRef:       'OBC 2024 9.27; 9.7.6',
  },

  site_grading: {
    descriptions:  ['Required slope: 1:20 (5%) minimum for 1.5 m from foundation', 'Material: Granular or clay-based fill'],
    standard:      'Finished grade must slope away from all foundation walls at a minimum gradient of 1:20 (5%) for at least 1.5 m from the building. Swales must direct surface water to the street or lot drainage system. Downspouts must discharge at least 1.5 m from the foundation. No mulch, soil, or decking material may be in contact with wood frame members.',
    implications:  'Negative grade (sloping toward the foundation) directs surface water runoff into the basement, leading to chronic basement flooding even with proper weeping tile.',
    limitations:   'Grade slope estimated visually at time of inspection. Final verification requires survey instrument or digital level.',
    checkItems:    ['Grade slopes away from foundation min. 1:20 for 1.5 m', 'Swales present and functional', 'Downspouts extend >= 1.5 m from foundation', 'No wood/organic contact with soil or foundation', 'Window wells drained', 'Driveway and walkway slope away from building', 'No ponding areas adjacent to foundation'],
    codeRef:       'OBC 2024 9.12.3',
  },

  wet_areas_bathrooms: {
    descriptions:  ['Waterproofing: Tile on cement board or equivalent waterproof substrate', 'Ventilation: Mechanical exhaust fan required'],
    standard:      'All shower and tub enclosures must be waterproofed to a minimum height of 1,800 mm and at minimum 150 mm above the curb. The waterproofing system must extend 150 mm onto the floor. All tile grout lines must be fully grouted without voids. Silicone caulk at all internal corners and floor/wall joints. Exhaust fan ducted to exterior (not into attic or crawlspace).',
    implications:  'Inadequate bathroom waterproofing leads to concealed water damage in the floor structure and adjacent rooms, causing mould and structural rot.',
    limitations:   'Waterproofing continuity confirmed visually. Water testing behind tiles not performed. Concealed water damage cannot be assessed without moisture meter readings or invasive investigation.',
    checkItems:    ['Waterproofing extends to 1,800 mm height in shower/tub', 'No missing or cracked grout', 'Silicone caulk at all internal corners', 'Floor slopes to drain (no ponding)', 'Exhaust fan ducted to exterior', 'No evidence of water staining behind fixtures', 'Toilet anchored and sealed at base'],
    codeRef:       'OBC 2024 9.29.6; 9.32.3',
  },
}

/**
 * Get the standard for a module, falling back to a generic placeholder
 */
export function getModuleStandard(moduleId: string): ModuleStandard | null {
  return (INSPECTION_STANDARDS as any)[moduleId] ?? null
}
