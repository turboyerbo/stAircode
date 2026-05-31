/**
 * generate-inspection-report.ts
 *
 * Generates a professional residential building inspection report PDF
 * using pdf-lib. Modelled on the Carson Dunlop / HORIZON format:
 *
 *   Page 1: Cover — address, client, inspector, date, logo
 *   Page 2: Summary — all significant findings (severity major/critical)
 *   Pages 3+: One section per phase/system with:
 *     - Section header (colour-coded)
 *     - Descriptions (materials, specifications from job data)
 *     - Observations & Recommendations (each finding: condition, implication, location, task)
 *     - Inspection photos (up to 3 per module)
 *     - Inspection Methods & Limitations (notes from inspector)
 *   Final page: Site Information
 *
 * Returns a Buffer suitable for emailing as an attachment or uploading
 * to Supabase Storage.
 */

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage, RGB } from 'pdf-lib'
import type { InspectionJob, InspectionPhase, InspectionModule, ModuleFinding } from './inspection-types'
import { PHASE_META, MODULE_META } from './inspection-types'

// ── Brand palette ────────────────────────────────────────────────────────────
const C = {
  navy:     rgb(0.039, 0.110, 0.180),   // #0A1C2E
  blue:     rgb(0.255, 0.486, 0.643),   // #417CA4
  orange:   rgb(0.949, 0.576, 0.216),   // #F29337
  green:    rgb(0.153, 0.663, 0.420),   // #27A96B
  red:      rgb(0.910, 0.271, 0.271),   // #E84545
  amber:    rgb(0.769, 0.451, 0.000),   // #C47200
  white:    rgb(1, 1, 1),
  light:    rgb(0.957, 0.969, 0.984),   // #F4F7FB
  text:     rgb(0.051, 0.118, 0.180),   // #0D1E2E
  text2:    rgb(0.369, 0.490, 0.608),   // #5E7D9B
  border:   rgb(0.898, 0.918, 0.945),   // #E5EBF2
  darkgrey: rgb(0.35, 0.35, 0.35),
  midgrey:  rgb(0.55, 0.55, 0.55),
  lightgrey: rgb(0.93, 0.93, 0.93),
}

// Section header colours matching Carson Dunlop style
const SECTION_COLORS: Record<string, RGB> = {
  property_setup:       rgb(0.35, 0.45, 0.55),
  pre_construction:     rgb(0.35, 0.45, 0.55),
  excavation_footings:  rgb(0.45, 0.35, 0.20),
  foundation:           rgb(0.30, 0.38, 0.28),
  framing_rough_in:     rgb(0.45, 0.38, 0.15),
  insulation:           rgb(0.40, 0.32, 0.18),
  occupancy_final:      rgb(0.20, 0.35, 0.55),
}

// Severity to colour mapping
function severityColor(s: string): RGB {
  switch (s) {
    case 'critical': return C.red
    case 'major':    return rgb(0.85, 0.25, 0.25)
    case 'moderate': return C.amber
    case 'minor':    return rgb(0.60, 0.50, 0.10)
    default:         return C.green
  }
}

function conditionColor(c: string): RGB {
  switch (c) {
    case 'poor': case 'below_average': return C.red
    case 'fair': case 'average':       return C.amber
    case 'good': case 'above_average': return C.green
    default:                           return C.blue
  }
}

// ── Page layout constants ─────────────────────────────────────────────────────
const PW  = 595.28    // A4 width pt
const PH  = 841.89    // A4 height pt
const ML  = 50        // margin left
const MR  = 50        // margin right
const MT  = 50        // margin top
const MB  = 60        // margin bottom
const TW  = PW - ML - MR  // text width

// ── Drawing helpers ──────────────────────────────────────────────────────────
function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, color: RGB, borderColor?: RGB, borderWidth = 0.5) {
  page.drawRectangle({ x, y, width: w, height: h, color, borderColor, borderWidth: borderColor ? borderWidth : 0 })
}

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color: RGB = C.text, maxWidth?: number) {
  if (!text) return
  const str = maxWidth ? truncateToWidth(text, font, size, maxWidth) : text
  page.drawText(str, { x, y, font, size, color })
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let result = text
  while (font.widthOfTextAtSize(result, size) > maxWidth && result.length > 3) {
    result = result.slice(0, -4) + '…'
  }
  return result
}

function textWidth(text: string, font: PDFFont, size: number): number {
  return font.widthOfTextAtSize(text, size)
}

// Word-wrap text and return array of lines
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\n/g, ' \n ').split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (word === '\n') { lines.push(current.trim()); current = ''; continue }
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (current) lines.push(current.trim())
      current = word
    } else {
      current = test
    }
  }
  if (current.trim()) lines.push(current.trim())
  return lines
}

// Draw wrapped text, return y position after last line
function drawWrapped(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color: RGB, maxWidth: number, lineHeight: number): number {
  const lines = wrapText(text, font, size, maxWidth)
  for (const line of lines) {
    page.drawText(line, { x, y, font, size, color })
    y -= lineHeight
  }
  return y
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateInspectionReport(job: InspectionJob): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`Building Inspection Report — ${job.address.street}, ${job.address.city}`)
  pdfDoc.setAuthor(job.inspectorName || 'stAIrcode Inspector')
  pdfDoc.setSubject('Residential Building Inspection Report')
  pdfDoc.setCreator('stAIrcode by Just Open Technologies Inc.')
  pdfDoc.setProducer('stAIrcode')

  // Load fonts
  const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontObl  = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const fonts = { reg: fontReg, bold: fontBold, obl: fontObl }

  // Collect all significant findings for the summary
  const allFindings: Array<{
    phase:     string
    module:    string
    finding:   ModuleFinding
    notes:     string
  }> = []

  for (const phase of job.phases) {
    if (phase.status === 'pending') continue
    for (const mod of phase.modules) {
      if (mod.status === 'pending' || mod.status === 'skipped') continue
      for (const finding of mod.findings) {
        if (finding.severity === 'major' || finding.severity === 'critical' || finding.severity === 'moderate') {
          allFindings.push({
            phase:   PHASE_META[phase.id]?.label ?? phase.id,
            module:  MODULE_META[mod.id]?.label ?? mod.id,
            finding,
            notes:   mod.notes,
          })
        }
      }
    }
  }

  // ── PAGE 1: Cover ──────────────────────────────────────────────────────────
  await buildCoverPage(pdfDoc, job, fonts)

  // ── PAGE 2: Summary ────────────────────────────────────────────────────────
  if (allFindings.length > 0) {
    await buildSummaryPage(pdfDoc, job, allFindings, fonts)
  }

  // ── SECTION PAGES: One per completed phase ────────────────────────────────
  for (const phase of job.phases) {
    if (phase.status === 'pending') continue
    const completedModules = phase.modules.filter(m => m.status === 'complete' || m.status === 'skipped')
    if (!completedModules.length && phase.id === 'property_setup') continue
    await buildPhaseSection(pdfDoc, job, phase, fonts)
  }

  // ── FINAL PAGE: Site Information ──────────────────────────────────────────
  await buildSiteInfoPage(pdfDoc, job, fonts)

  // Add page numbers to all pages
  const pages = pdfDoc.getPages()
  const totalPages = pages.length
  for (let i = 0; i < totalPages; i++) {
    const page = pages[i]
    if (i === 0) continue // skip cover
    const pageNumText = `Page ${i} of ${totalPages - 1}`
    const pw = page.getWidth()
    const textW = fontReg.widthOfTextAtSize(pageNumText, 8)
    page.drawText(pageNumText, { x: pw/2 - textW/2, y: 25, font: fontReg, size: 8, color: C.midgrey })
    page.drawText('stAIrcode by Just Open Technologies Inc.', { x: ML, y: 25, font: fontReg, size: 7, color: C.midgrey })
  }

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}

// ── Cover page ────────────────────────────────────────────────────────────────
async function buildCoverPage(pdfDoc: PDFDocument, job: InspectionJob, fonts: Record<string, PDFFont>) {
  const page = pdfDoc.addPage([PW, PH])
  const { bold, reg } = fonts

  // Navy header band
  drawRect(page, 0, PH - 200, PW, 200, C.navy)

  // Title in header
  page.drawText('YOUR INSPECTION', { x: ML + 10, y: PH - 80, font: bold, size: 32, color: C.white })
  page.drawText('REPORT', { x: ML + 10, y: PH - 120, font: bold, size: 32, color: C.orange })

  // Orange accent stripe
  drawRect(page, 0, PH - 205, PW, 8, C.orange)

  // Property address — large
  const addr1 = job.address.street + (job.address.unit ? ` #${job.address.unit}` : '')
  const addr2 = `${job.address.city}, ${job.address.province}`
  page.drawText(addr1, { x: ML, y: PH - 280, font: bold, size: 22, color: C.navy })
  page.drawText(addr2, { x: ML, y: PH - 308, font: bold, size: 18, color: C.navy })

  // Divider
  drawRect(page, ML, PH - 325, TW, 1, C.border)

  // Info block
  const infoY = PH - 370
  const labelSize = 9
  const valSize   = 12

  const infoRows = [
    { label: 'PREPARED FOR',     value: job.clientName || 'Not specified' },
    { label: 'INSPECTION DATE',  value: formatDate(job.inspectionDate) },
    { label: 'INSPECTED BY',     value: job.inspectorName || 'Not specified' },
    { label: 'COMPANY',          value: job.company || 'Just Open Technologies Inc.' },
    { label: 'LICENCE NO.',      value: job.licenceNumber || '' },
    { label: 'PURPOSE',          value: job.purposeNote || 'Building Inspection' },
    { label: 'BUILDING TYPE',    value: formatBuildingType(job.buildingType) },
    { label: 'ESTIMATED AGE',    value: job.estimatedAge || 'Not recorded' },
  ]

  let y = infoY
  for (const row of infoRows) {
    if (!row.value) continue
    page.drawText(row.label, { x: ML, y, font: fonts.obl, size: labelSize, color: C.orange })
    page.drawText(row.value, { x: ML, y: y - 15, font: bold, size: valSize, color: C.navy })
    y -= 42
  }

  // Footer band
  drawRect(page, 0, 0, PW, 80, C.navy)
  page.drawText('stAIrcode', { x: ML, y: 50, font: bold, size: 18, color: C.orange })
  page.drawText('by Just Open Technologies Inc.', { x: ML, y: 32, font: reg, size: 10, color: C.white })
  page.drawText('staircode.app', { x: PW - MR - 100, y: 32, font: reg, size: 10, color: C.white })

  // Orange bottom stripe
  drawRect(page, 0, 0, PW, 8, C.orange)
}

// ── Summary page ──────────────────────────────────────────────────────────────
async function buildSummaryPage(
  pdfDoc: PDFDocument,
  job: InspectionJob,
  findings: Array<{ phase: string; module: string; finding: ModuleFinding; notes: string }>,
  fonts: Record<string, PDFFont>
) {
  const page = pdfDoc.addPage([PW, PH])
  const { bold, reg, obl } = fonts

  let y = PH - MT

  // Section header
  y = drawSectionHeader(page, 'SUMMARY', C.darkgrey, y, fonts)
  y -= 8

  // Address + date line
  page.drawText(`${job.address.street}, ${job.address.city}, ${job.address.province}`, { x: ML, y, font: reg, size: 9, color: C.midgrey })
  page.drawText(formatDate(job.inspectionDate), { x: PW - MR - 100, y, font: reg, size: 9, color: C.midgrey })
  y -= 20

  // Intro text
  y = drawWrapped(page, 'This Summary outlines potentially significant issues identified during the inspection that may need to be addressed. Please read the complete report for full details on each system inspected.', ML, y, reg, 9, C.text, TW, 13)
  y -= 16

  // Group findings by phase
  const byPhase: Record<string, typeof findings> = {}
  for (const f of findings) {
    if (!byPhase[f.phase]) byPhase[f.phase] = []
    byPhase[f.phase].push(f)
  }

  for (const [phase, phasFindings] of Object.entries(byPhase)) {
    if (y < MB + 80) {
      y = addContinuationPage(pdfDoc, 'SUMMARY', C.darkgrey, fonts, job)
    }

    // Phase heading
    y -= 8
    page.drawText(phase, { x: ML, y, font: bold, size: 13, color: C.navy })
    y -= 18

    for (const { module, finding, notes } of phasFindings) {
      if (y < MB + 60) {
        y = addContinuationPage(pdfDoc, 'SUMMARY', C.darkgrey, fonts, job)
      }

      // Severity dot
      const dotColor = severityColor(finding.severity)
      page.drawCircle({ x: ML + 4, y: y - 2, size: 4, color: dotColor })

      // Module name (underlined style via bold)
      page.drawText(module, { x: ML + 14, y, font: bold, size: 10, color: C.navy })
      const mw = bold.widthOfTextAtSize(module, 10)
      drawRect(page, ML + 14, y - 1, mw, 0.5, C.navy)
      y -= 14

      // Condition
      page.drawText('Condition: ', { x: ML + 14, y, font: bold, size: 9, color: C.text })
      const condW = bold.widthOfTextAtSize('Condition: ', 9)
      page.drawText(formatCondition(finding.condition as string), { x: ML + 14 + condW, y, font: reg, size: 9, color: dotColor })
      y -= 12

      // Observations
      if (finding.notes) {
        y = drawWrapped(page, finding.notes, ML + 14, y, reg, 9, C.text, TW - 14, 12)
      }

      // Implication
      if (finding.recommendation) {
        page.drawText('Implication(s): ', { x: ML + 14, y, font: bold, size: 9, color: C.text })
        const impW = bold.widthOfTextAtSize('Implication(s): ', 9)
        y = drawWrapped(page, finding.recommendation, ML + 14 + impW, y, reg, 9, C.text2, TW - 14 - impW, 12)
      }

      // Severity as task
      if (finding.severity && finding.severity !== 'none') {
        const taskLabel = finding.severity === 'critical' ? 'URGENT — Address immediately' :
                          finding.severity === 'major'    ? 'Repair or replace' :
                          finding.severity === 'moderate' ? 'Monitor and repair' : 'Improve'
        page.drawText('Task: ', { x: ML + 14, y, font: bold, size: 9, color: C.text })
        page.drawText(taskLabel, { x: ML + 14 + bold.widthOfTextAtSize('Task: ', 9), y, font: reg, size: 9, color: dotColor })
        y -= 14
      }

      y -= 8
      // Separator line
      drawRect(page, ML + 14, y + 4, TW - 14, 0.3, C.border)
      y -= 4
    }
  }

  if (findings.length === 0) {
    drawWrapped(page, 'No significant issues were identified at this stage of the inspection. See the full report sections for all observations.', ML, y, reg, 10, C.text2, TW, 14)
  }
}

// ── Phase section ─────────────────────────────────────────────────────────────
async function buildPhaseSection(
  pdfDoc: PDFDocument,
  job: InspectionJob,
  phase: InspectionPhase,
  fonts: Record<string, PDFFont>
) {
  const meta = PHASE_META[phase.id]
  if (!meta) return

  const sectionColor = SECTION_COLORS[phase.id] ?? C.navy
  const page = pdfDoc.addPage([PW, PH])
  const { bold, reg, obl } = fonts

  let y = PH - MT

  // Section header bar
  y = drawSectionHeader(page, meta.reportSection.toUpperCase(), sectionColor, y, fonts)
  y -= 8

  // Address line
  page.drawText(`${job.address.street}, ${job.address.city}, ${job.address.province}`, { x: ML, y, font: reg, size: 9, color: C.midgrey })
  page.drawText(formatDate(job.inspectionDate), { x: PW - MR - 100, y, font: reg, size: 9, color: C.midgrey })
  y -= 20

  // ── Descriptions block ────────────────────────────────────────────────────
  const descriptions = buildDescriptions(job, phase)
  if (descriptions.length > 0) {
    y = drawSubHeader(page, 'Descriptions', sectionColor, y, fonts)
    y -= 6

    for (const desc of descriptions) {
      if (y < MB + 30) {
        y = addContinuationPage(pdfDoc, meta.reportSection.toUpperCase(), sectionColor, fonts, job)
      }
      page.drawText(desc.label + ': ', { x: ML, y, font: bold, size: 9, color: C.text })
      const lw = bold.widthOfTextAtSize(desc.label + ': ', 9)
      page.drawText(desc.value, { x: ML + lw, y, font: reg, size: 9, color: sectionColor })
      y -= 13
    }
    y -= 8
  }

  // ── Observations & Recommendations ───────────────────────────────────────
  const completedModules = phase.modules.filter(m =>
    (m.status === 'complete') && (m.findings.length > 0 || m.notes)
  )

  if (completedModules.length > 0) {
    y = drawSubHeader(page, 'Observations & Recommendations', sectionColor, y, fonts)
    y -= 8

    let photoNum = 1

    for (const mod of completedModules) {
      const modMeta = MODULE_META[mod.id]
      if (!modMeta) continue

      for (const finding of mod.findings) {
        if (y < MB + 100) {
          y = addContinuationPage(pdfDoc, meta.reportSection.toUpperCase(), sectionColor, fonts, job)
          y -= 20
        }

        // Module name as header
        const modLabel = modMeta.label + (finding.label !== modMeta.label ? ` \\ ${finding.label}` : '')
        page.drawText(modLabel, { x: ML, y, font: bold, size: 10, color: C.navy })
        const mw = bold.widthOfTextAtSize(modLabel, 10)
        drawRect(page, ML, y - 1, mw, 0.5, C.navy)
        y -= 14

        // Condition pill
        const condColor = conditionColor(finding.condition as string)
        const condText  = formatCondition(finding.condition as string)
        page.drawCircle({ x: ML + 5, y: y - 1, size: 4, color: condColor })
        page.drawText('Condition: ', { x: ML + 14, y, font: bold, size: 9, color: C.text })
        page.drawText(condText, { x: ML + 14 + bold.widthOfTextAtSize('Condition: ', 9), y, font: reg, size: 9, color: condColor })
        y -= 12

        // Observations
        if (finding.notes) {
          y = drawWrapped(page, finding.notes, ML + 14, y, reg, 9, C.text, TW - 14, 12)
        }

        // Recommendation → Implication(s)
        if (finding.recommendation) {
          page.drawText('Implication(s): ', { x: ML + 14, y, font: bold, size: 9, color: C.text })
          const impW = bold.widthOfTextAtSize('Implication(s): ', 9)
          y = drawWrapped(page, finding.recommendation, ML + 14 + impW, y, reg, 9, C.text, TW - 14 - impW, 12)
        }

        // Code reference
        if (finding.codeRef || modMeta.codeRef) {
          const cr = finding.codeRef || modMeta.codeRef || ''
          page.drawText('Code reference: ', { x: ML + 14, y, font: bold, size: 9, color: C.text })
          page.drawText(cr, { x: ML + 14 + bold.widthOfTextAtSize('Code reference: ', 9), y, font: obl, size: 9, color: C.blue })
          y -= 12
        }

        // Severity as Task
        if (finding.severity && finding.severity !== 'none') {
          const sev = finding.severity
          const taskStr = sev === 'critical' ? 'URGENT — Address immediately' :
                          sev === 'major'    ? 'Repair or replace' :
                          sev === 'moderate' ? 'Monitor and repair when possible' : 'Improve'
          page.drawText('Task: ', { x: ML + 14, y, font: bold, size: 9, color: C.text })
          page.drawText(taskStr, { x: ML + 14 + bold.widthOfTextAtSize('Task: ', 9), y, font: reg, size: 9, color: severityColor(sev) })
          y -= 14
        }

        // Photos for this finding
        const photos = [...(finding.photos || []), ...(mod.photos || [])].filter(Boolean).slice(0, 2)
        for (const photoB64 of photos) {
          if (y < MB + 120) {
            y = addContinuationPage(pdfDoc, meta.reportSection.toUpperCase(), sectionColor, fonts, job)
            y -= 20
          }
          try {
            const imgBytes = Buffer.from(photoB64, 'base64')
            const img = photoB64.startsWith('/9j/') || photoB64.startsWith('data:image/jpeg')
              ? await pdfDoc.embedJpg(imgBytes)
              : await pdfDoc.embedPng(imgBytes)
            const maxW = 200, maxH = 150
            const scale = Math.min(maxW / img.width, maxH / img.height)
            const iw = img.width * scale, ih = img.height * scale
            const imgX = ML + (TW/2 - iw) / 2  // center in left half
            page.drawImage(img, { x: imgX, y: y - ih, width: iw, height: ih })
            // Caption
            page.drawText(`${photoNum}. ${finding.label || 'Photo'}`, { x: imgX, y: y - ih - 12, font: obl, size: 8, color: C.text })
            y -= ih + 22
            photoNum++
          } catch { /* skip invalid images */ }
        }

        y -= 10
        drawRect(page, ML, y + 5, TW, 0.3, C.lightgrey)
      }

      // Module notes (inspector notes)
      if (mod.notes && !mod.findings.length) {
        if (y < MB + 50) {
          y = addContinuationPage(pdfDoc, meta.reportSection.toUpperCase(), sectionColor, fonts, job)
          y -= 20
        }
        page.drawText(modMeta.label, { x: ML, y, font: bold, size: 10, color: C.navy })
        y -= 14
        y = drawWrapped(page, mod.notes, ML + 14, y, reg, 9, C.text, TW - 14, 12)
        y -= 8
      }
    }
  }

  // ── Inspection Methods & Limitations ─────────────────────────────────────
  if (phase.phaseNotes || phase.holdPoint) {
    if (y < MB + 60) {
      y = addContinuationPage(pdfDoc, meta.reportSection.toUpperCase(), sectionColor, fonts, job)
      y -= 20
    }
    y = drawSubHeader(page, 'Inspection Methods & Limitations', sectionColor, y, fonts)
    y -= 8

    if (phase.holdPoint) {
      const holdText = `OBC Hold Point: ${meta.obcRef || 'Inspector sign-off required before proceeding to next phase.'}`
      y = drawWrapped(page, holdText, ML, y, reg, 9, C.text, TW, 12)
    }

    if (phase.phaseNotes) {
      y = drawWrapped(page, phase.phaseNotes, ML, y, reg, 9, C.text, TW, 12)
    }

    if (phase.status === 'skipped') {
      y = drawWrapped(page, 'This phase was not fully inspected or was noted as not applicable.', ML, y, reg, 9, C.midgrey, TW, 12)
    }
  }
}

// ── Site Information page ─────────────────────────────────────────────────────
async function buildSiteInfoPage(pdfDoc: PDFDocument, job: InspectionJob, fonts: Record<string, PDFFont>) {
  const page = pdfDoc.addPage([PW, PH])
  const { bold, reg } = fonts

  let y = PH - MT
  y = drawSectionHeader(page, 'SITE INFORMATION', C.darkgrey, y, fonts)
  y -= 8

  page.drawText(`${job.address.street}, ${job.address.city}, ${job.address.province}`, { x: ML, y, font: reg, size: 9, color: C.midgrey })
  page.drawText(formatDate(job.inspectionDate), { x: PW - MR - 100, y, font: reg, size: 9, color: C.midgrey })
  y -= 20

  y = drawSubHeader(page, 'Descriptions', C.darkgrey, y, fonts)
  y -= 8

  const siteRows = [
    { label: 'Weather at inspection',    value: formatWeather(job.weather) },
    { label: 'Property occupied',        value: job.isOccupied ? 'Yes' : 'No' },
    { label: 'Property secured',         value: job.isSecure ? 'Yes' : 'No' },
    { label: 'Building type',            value: formatBuildingType(job.buildingType) },
    { label: 'Estimated age of building',value: job.estimatedAge || 'Not recorded' },
    { label: 'Wall construction',        value: formatConstruction(job.wallConstruction) },
    { label: 'Roof covering',            value: formatRoofCovering(job.roofCovering) },
    { label: 'Foundation type',          value: formatFootingType(job.footingType) },
    { label: 'Internal walls',           value: job.internalWalls || 'Not recorded' },
    { label: 'Windows',                  value: job.windows || 'Not recorded' },
    { label: 'Permit number',            value: job.permitNumber || 'Not recorded' },
    { label: 'Inspection purpose',       value: job.purposeNote || 'Building Inspection' },
    { label: 'Inspector',                value: job.inspectorName + (job.licenceNumber ? ` (Lic. ${job.licenceNumber})` : '') },
    { label: 'Company',                  value: job.company || 'Just Open Technologies Inc.' },
    { label: 'Client',                   value: job.clientName || 'Not specified' },
    { label: 'Project type',             value: job.projectType === 'renovation' ? 'Renovation' : 'New Construction' },
  ]

  for (const row of siteRows) {
    if (!row.value || row.value === 'unknown' || row.value === 'Unknown') continue
    page.drawText(row.label + ': ', { x: ML, y, font: bold, size: 9, color: C.text })
    const lw = bold.widthOfTextAtSize(row.label + ': ', 9)
    page.drawText(row.value, { x: ML + lw, y, font: reg, size: 9, color: C.darkgrey })
    y -= 14
  }

  y -= 20
  drawRect(page, ML, y, TW, 0.5, C.border)
  y -= 16
  page.drawText('END OF REPORT', { x: PW/2 - bold.widthOfTextAtSize('END OF REPORT', 11)/2, y, font: bold, size: 11, color: C.navy })

  y -= 24
  const disclaimer = 'This report was prepared using stAIrcode by Just Open Technologies Inc. It is a visual inspection only and does not replace a formal inspection by a licensed professional. The AI-assisted analysis is provided as a compliance aid. All recommendations should be reviewed by qualified tradespeople.'
  drawWrapped(page, disclaimer, ML, y, reg, 8, C.midgrey, TW, 11)
}

// ── Drawing utilities ─────────────────────────────────────────────────────────
function drawSectionHeader(page: PDFPage, title: string, color: RGB, y: number, fonts: Record<string, PDFFont>): number {
  const { bold } = fonts
  drawRect(page, ML - 5, y - 22, TW + 10, 26, color)
  page.drawText(title, { x: ML, y: y - 16, font: bold, size: 12, color: C.white })
  return y - 32
}

function drawSubHeader(page: PDFPage, title: string, color: RGB, y: number, fonts: Record<string, PDFFont>): number {
  const { bold } = fonts
  drawRect(page, ML - 5, y - 18, TW + 10, 22, rgb(color.red*0.85, color.green*0.85, color.blue*0.85))
  page.drawText(title, { x: ML, y: y - 13, font: bold, size: 10, color: C.white })
  return y - 26
}

function addContinuationPage(
  pdfDoc: PDFDocument,
  sectionTitle: string,
  color: RGB,
  fonts: Record<string, PDFFont>,
  job: InspectionJob
): number {
  const page = pdfDoc.addPage([PW, PH])
  let y = PH - MT
  y = drawSectionHeader(page, sectionTitle, color, y, fonts)
  y -= 8
  page.drawText(`${job.address.street}, ${job.address.city}, ${job.address.province}`, { x: ML, y, font: fonts.reg, size: 9, color: C.midgrey })
  page.drawText(formatDate(job.inspectionDate), { x: PW - MR - 100, y, font: fonts.reg, size: 9, color: C.midgrey })
  y -= 20
  return y
}

// ── Descriptions helpers ──────────────────────────────────────────────────────
function buildDescriptions(job: InspectionJob, phase: InspectionPhase): Array<{ label: string; value: string }> {
  const descs: Array<{ label: string; value: string }> = []
  const id = phase.id

  if (id === 'property_setup' || id === 'pre_construction') {
    if (job.buildingType)     descs.push({ label: 'Building type',           value: formatBuildingType(job.buildingType) })
    if (job.estimatedAge)     descs.push({ label: 'Estimated age',           value: job.estimatedAge })
    if (job.wallConstruction) descs.push({ label: 'Wall construction',       value: formatConstruction(job.wallConstruction) })
    if (job.roofCovering)     descs.push({ label: 'Roof covering',           value: formatRoofCovering(job.roofCovering) })
    if (job.footingType)      descs.push({ label: 'Foundation / footings',   value: formatFootingType(job.footingType) })
    if (job.permitNumber)     descs.push({ label: 'Building permit',         value: job.permitNumber })
    if (job.drawingsData?.fields?.occupancyClass) descs.push({ label: 'Occupancy class', value: job.drawingsData.fields.occupancyClass })
    if (job.drawingsData?.fields?.constructionType) descs.push({ label: 'Construction type', value: job.drawingsData.fields.constructionType })
  }
  if (id === 'excavation_footings') {
    if (job.footingType) descs.push({ label: 'Footing type', value: formatFootingType(job.footingType) })
  }
  if (id === 'foundation') {
    if (job.wallConstruction) descs.push({ label: 'Foundation wall type', value: formatConstruction(job.wallConstruction) })
  }
  if (id === 'framing_rough_in' || id === 'insulation' || id === 'occupancy_final') {
    if (job.wallConstruction) descs.push({ label: 'Exterior wall construction', value: formatConstruction(job.wallConstruction) })
    if (job.internalWalls)    descs.push({ label: 'Interior wall finishes',     value: job.internalWalls })
    if (job.windows)          descs.push({ label: 'Windows',                    value: job.windows })
    if (job.roofCovering)     descs.push({ label: 'Roof covering',              value: formatRoofCovering(job.roofCovering) })
  }

  // Add drawings data fields if available
  if (job.drawingsData?.fields) {
    const f = job.drawingsData.fields
    if (f.lotCoverage)    descs.push({ label: 'Lot coverage',     value: f.lotCoverage })
    if (f.frontSetback)   descs.push({ label: 'Front setback',    value: `${f.frontSetback}m` })
    if (f.buildingHeight) descs.push({ label: 'Building height',  value: `${f.buildingHeight}m` })
  }

  return descs.filter(d => d.value && d.value !== 'unknown' && d.value !== 'Unknown')
}

// ── Formatting helpers ─────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  if (!dateStr) return new Date().toLocaleDateString('en-CA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
  try {
    return new Date(dateStr).toLocaleDateString('en-CA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
  } catch { return dateStr }
}

function formatBuildingType(t: string): string {
  const map: Record<string, string> = {
    single_storey_residential: 'Single Storey Detached Residential',
    two_storey_residential: 'Two Storey Detached Residential',
    semi_detached: 'Semi-Detached Residential',
    townhouse: 'Townhouse',
    multi_unit_residential: 'Multi-Unit Residential',
    commercial: 'Commercial',
    industrial: 'Industrial',
    mixed_use: 'Mixed Use',
  }
  return map[t] ?? t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatConstruction(t: string): string {
  const map: Record<string, string> = {
    brick_veneer: 'Brick Veneer', double_brick: 'Double Brick', timber_frame: 'Wood Frame',
    concrete_block: 'Concrete Block (CMU)', icf: 'ICF', steel_frame: 'Steel Frame',
  }
  return map[t] ?? t.replace(/_/g, ' ')
}

function formatRoofCovering(t: string): string {
  const map: Record<string, string> = {
    concrete_tiles: 'Concrete Tiles', clay_tiles: 'Clay Tiles', metal_deck: 'Metal Deck / Colorbond',
    asphalt_shingles: 'Asphalt Shingles', flat_membrane: 'Flat / Membrane',
  }
  return map[t] ?? t.replace(/_/g, ' ')
}

function formatFootingType(t: string): string {
  const map: Record<string, string> = {
    concrete_slab: 'Concrete Footings & Slab', piers_stumps: 'Piers / Stumps', strip_footing: 'Strip Footing',
  }
  return map[t] ?? t.replace(/_/g, ' ')
}

function formatCondition(c: string): string {
  const map: Record<string, string> = {
    above_average: 'Above Average', good: 'Good', typical: 'Typical', fair: 'Fair',
    average: 'Average', below_average: 'Below Average', poor: 'Poor', na: 'Not Applicable',
  }
  return map[c] ?? c
}

function formatWeather(w: string): string {
  const map: Record<string, string> = {
    fine: 'Fine', overcast: 'Overcast', light_rain: 'Light Rain', heavy_rain: 'Heavy Rain', windy: 'Windy',
  }
  return map[w] ?? w
}
