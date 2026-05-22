/**
 * generate-foundation-pdf.ts
 *
 * Generates a professional foundation inspection PDF report using pdf-lib.
 * Mirrors generate-pdf-report.ts patterns for consistency.
 *
 * Sections:
 *   1. Header (safety stripe, title, location/date)
 *   2. Summary chips (pass / flag / critical)
 *   3. Wall classification panel
 *   4. Measurement photos (wall overview, crack detail, thickness, footing)
 *   5. Compliance field table
 *   6. Crack documentation
 *   7. Moisture & dampproofing
 *   8. Detailed assessment narrative (AI text)
 *   9. Code references
 *  10. Disclaimer + module metadata (for future multi-module combining)
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { FoundationMeasurements }      from '@/app/components/FoundationScanScreen'
import type { FoundationField }             from '@/app/components/FoundationReportScreen'

// Brand colours
const ORANGE  = rgb(0.949, 0.576, 0.216)   // #F29337
const BLUE    = rgb(0.255, 0.486, 0.643)   // #417CA4
const NAVY    = rgb(0.039, 0.110, 0.180)   // #0A1C2E
const LIGHT   = rgb(0.957, 0.969, 0.984)   // #F4F7FB
const TEXT    = rgb(0.051, 0.118, 0.180)   // #0D1E2E
const TEXT2   = rgb(0.369, 0.490, 0.608)   // #5E7D9B
const PASS    = rgb(0.153, 0.663, 0.420)   // #27A96B
const FAIL    = rgb(0.910, 0.333, 0.333)   // #E85555
const WARN    = rgb(0.949, 0.576, 0.216)   // #F29337
const CRIT    = rgb(0.910, 0.271, 0.271)   // #E84545
const BORDER  = rgb(0.898, 0.918, 0.945)   // #E5EBF2
const WHITE   = rgb(1, 1, 1)
const STRIPE  = rgb(0.949, 0.576, 0.216)

const FRAME_LABELS: Record<string, string> = {
  wall_overview:   'Foundation Wall Overview',
  crack_detail:    'Crack Documentation',
  wall_thickness:  'Wall Thickness',
  base_footing:    'Foundation Base / Footing',
}

const CRACK_STRUCTURAL: Record<string, string> = {
  none:       'No cracks observed.',
  hairline:   'Surface shrinkage — normal, monitor for progression.',
  vertical:   'Thermal/shrinkage movement — low concern, monitor.',
  diagonal:   'Differential settlement — professional assessment recommended.',
  stair_step: 'Stair-step cracking in masonry — differential settlement, professional assessment required.',
  horizontal: 'CRITICAL: Lateral earth pressure potentially exceeding wall capacity. Immediate structural engineering assessment required.',
  multiple:   'Multiple crack types present — professional assessment required.',
}

export interface FoundationPDFParams {
  measurements: FoundationMeasurements
  fields:       FoundationField[]
  reportText:   string   // AI-generated narrative
  codeLabel:    string
  location:     string
  date:         string
  frames:       Record<string, string>
  moduleId:     string   // unique ID for multi-module combining
}

export async function generateFoundationPDF(params: FoundationPDFParams): Promise<Buffer> {
  const { measurements: m, fields, reportText, codeLabel, location, date, frames, moduleId } = params

  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`stAIrcode Foundation Inspection — ${location || codeLabel}`)
  pdfDoc.setAuthor('stAIrcode by Just Open Technologies Inc.')
  pdfDoc.setSubject('Foundation Inspection Compliance Report')
  // Store module metadata for future multi-module combining
  pdfDoc.setKeywords([`module:foundation`, `moduleId:${moduleId}`, `code:${codeLabel}`, `location:${location}`])

  const boldFont    = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const PW = 595.28
  const PH = 841.89
  const ML = 50
  const MR = 50
  const CW = PW - ML - MR

  let page = pdfDoc.addPage([PW, PH])
  let y = PH - 20

  function newPage() {
    page = pdfDoc.addPage([PW, PH])
    y = PH - 50
  }
  function ensureSpace(needed: number) {
    if (y - needed < 60) newPage()
  }
  function sectionBar(title: string, color = NAVY) {
    ensureSpace(30)
    page.drawRectangle({ x: ML, y: y - 22, width: CW, height: 22, color })
    page.drawText(title, { x: ML + 8, y: y - 16, size: 9, font: boldFont, color: WHITE })
    y -= 30
  }

  // ── 1. HEADER ────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: PH - 110, width: PW, height: 110, color: NAVY })
  for (let sx = -80; sx < PW + 80; sx += 22) {
    page.drawRectangle({ x: sx, y: PH - 110, width: 11, height: 110, color: STRIPE, opacity: 0.30 })
  }
  // Blue accent bar — distinguishes foundation from stair (orange)
  page.drawRectangle({ x: 0, y: PH - 110, width: 8, height: 110, color: BLUE })
  page.drawRectangle({ x: ML - 10, y: PH - 102, width: CW + 20, height: 92, color: NAVY })

  // Logo
  const logoY = PH - 40
  page.drawText('st', { x: PW / 2 - 62, y: logoY, size: 20, font: boldFont, color: WHITE })
  page.drawText('AI', { x: PW / 2 - 34, y: logoY, size: 20, font: boldFont, color: ORANGE })
  page.drawText('rcode', { x: PW / 2 - 12, y: logoY, size: 20, font: boldFont, color: WHITE })

  // Title
  const titleText = 'Foundation Inspection Report'
  const titleW = boldFont.widthOfTextAtSize(titleText, 16)
  page.drawText(titleText, { x: PW / 2 - titleW / 2, y: PH - 66, size: 16, font: boldFont, color: WHITE })

  // Module badge
  const badgeText = 'FOUNDATION MODULE'
  const badgeW = boldFont.widthOfTextAtSize(badgeText, 8) + 16
  page.drawRectangle({ x: PW / 2 - badgeW / 2, y: PH - 84, width: badgeW, height: 14, color: BLUE, opacity: 0.85 })
  const bW = boldFont.widthOfTextAtSize(badgeText, 8)
  page.drawText(badgeText, { x: PW / 2 - bW / 2, y: PH - 81, size: 8, font: boldFont, color: WHITE })

  // Subtitle: code · location · date
  const subText = `${codeLabel}${location ? ' · ' + location : ''} · ${date}`
  const subW = regularFont.widthOfTextAtSize(subText, 9)
  page.drawText(subText, { x: PW / 2 - subW / 2, y: PH - 100, size: 9, font: regularFont, color: rgb(0.576, 0.729, 0.831) })

  y = PH - 125

  // ── 2. SUMMARY CHIPS ─────────────────────────────────────────────────────────
  const passCount  = fields.filter(f => f.pass === true).length
  const flagCount  = fields.filter(f => f.pass === false).length
  const critCount  = fields.filter(f => f.pass === false && f.severity === 'critical').length
  const chips = [
    { label: 'PASS',     val: passCount, color: PASS },
    { label: 'FLAG',     val: flagCount,  color: WARN },
    { label: 'CRITICAL', val: critCount,  color: CRIT },
  ]
  const chipW = CW / 3 - 8
  let cx = ML
  for (const chip of chips) {
    page.drawRectangle({ x: cx, y: y - 44, width: chipW, height: 44, color: LIGHT, borderColor: BORDER, borderWidth: 0.5 })
    const numStr = String(chip.val)
    const numW = boldFont.widthOfTextAtSize(numStr, 20)
    page.drawText(numStr, { x: cx + chipW / 2 - numW / 2, y: y - 24, size: 20, font: boldFont, color: chip.color })
    const lblW = regularFont.widthOfTextAtSize(chip.label, 7)
    page.drawText(chip.label, { x: cx + chipW / 2 - lblW / 2, y: y - 38, size: 7, font: regularFont, color: TEXT2 })
    cx += chipW + 12
  }
  y -= 60

  // ── 3. WALL CLASSIFICATION ────────────────────────────────────────────────────
  sectionBar('WALL CLASSIFICATION', BLUE)
  page.drawRectangle({ x: ML, y: y - 40, width: CW, height: 40, color: LIGHT, borderColor: BORDER, borderWidth: 0.5 })
  page.drawText(m.wallTypeLabel ?? m.wallType ?? 'Unknown', {
    x: ML + 10, y: y - 20, size: 12, font: boldFont, color: TEXT,
  })
  if (m.wallTypeConfidence != null) {
    const confText = `AI confidence: ${Math.round(m.wallTypeConfidence * 100)}%  ·  Overall condition: ${m.overallCondition ?? 'unknown'}`
    page.drawText(confText, { x: ML + 10, y: y - 35, size: 8, font: regularFont, color: TEXT2 })
  }
  y -= 52

  // ── 4. MEASUREMENT PHOTOS ────────────────────────────────────────────────────
  const validFrames = Object.entries(frames).filter(([k, v]) => FRAME_LABELS[k] && v && v.length > 100)
  if (validFrames.length > 0) {
    sectionBar('INSPECTION PHOTOS')
    const imgW = (CW - 12) / 2
    const imgH = 130
    const lblH = 18
    for (let i = 0; i < validFrames.length; i += 2) {
      ensureSpace(imgH + lblH + 12)
      const pair = validFrames.slice(i, i + 2)
      for (let j = 0; j < pair.length; j++) {
        const [posId, b64raw] = pair[j]
        const imgX = ML + j * (imgW + 12)
        const imgY = y - imgH
        page.drawRectangle({ x: imgX, y: imgY, width: imgW, height: imgH, borderColor: BORDER, borderWidth: 0.5, color: LIGHT })
        try {
          const rawData = b64raw.startsWith('data:') ? b64raw.split(',')[1] : b64raw
          const imgBytes = Uint8Array.from(Buffer.from(rawData, 'base64'))
          let img
          try { img = await pdfDoc.embedJpg(imgBytes) } catch { img = await pdfDoc.embedPng(imgBytes) }
          const { width: iw, height: ih } = img
          const scale = Math.min(imgW / iw, imgH / ih)
          const dw = iw * scale, dh = ih * scale
          page.drawImage(img, { x: imgX + (imgW - dw) / 2, y: imgY + (imgH - dh) / 2, width: dw, height: dh })
        } catch {
          page.drawText('Photo unavailable', { x: imgX + imgW / 2 - 30, y: imgY + imgH / 2, size: 8, font: regularFont, color: TEXT2 })
        }
        const lbl = FRAME_LABELS[posId] ?? posId
        const lW = boldFont.widthOfTextAtSize(lbl, 8)
        page.drawText(lbl, { x: imgX + imgW / 2 - lW / 2, y: imgY - 14, size: 8, font: boldFont, color: TEXT })
      }
      y -= imgH + lblH + 8
    }
    y -= 8
  }

  // ── 5. COMPLIANCE FIELD TABLE ────────────────────────────────────────────────
  sectionBar('COMPLIANCE CHECK RESULTS')
  // Header row
  page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: LIGHT })
  page.drawText('Check', { x: ML + 4, y: y - 13, size: 8, font: boldFont, color: TEXT2 })
  page.drawText('Value', { x: ML + 220, y: y - 13, size: 8, font: boldFont, color: TEXT2 })
  page.drawText('Result', { x: ML + 360, y: y - 13, size: 8, font: boldFont, color: TEXT2 })
  y -= 18
  for (let i = 0; i < fields.length; i++) {
    ensureSpace(22)
    const f = fields[i]
    page.drawRectangle({ x: ML, y: y - 20, width: CW, height: 20, color: i % 2 === 0 ? WHITE : LIGHT, borderColor: BORDER, borderWidth: 0.25 })
    const val = f.value != null ? `${f.value}${f.unit ? ' ' + f.unit : ''}` : '—'
    const status = f.pass === true ? 'PASS' : f.pass === false ? (f.severity === 'critical' ? 'CRITICAL' : 'FLAG') : 'N/A'
    const sColor = f.pass === true ? PASS : f.pass === false ? (f.severity === 'critical' ? CRIT : WARN) : TEXT2
    page.drawText(f.label, { x: ML + 4,   y: y - 14, size: 8, font: regularFont, color: TEXT })
    page.drawText(val,     { x: ML + 220,  y: y - 14, size: 8, font: regularFont, color: TEXT })
    page.drawText(status,  { x: ML + 360,  y: y - 14, size: 8, font: boldFont,    color: sColor })
    y -= 20
    // Note line
    if (f.note) {
      ensureSpace(16)
      const noteW = regularFont.widthOfTextAtSize(f.note, 7.5)
      if (noteW <= CW - 8) {
        page.drawText(f.note, { x: ML + 8, y: y - 10, size: 7.5, font: regularFont, color: TEXT2 })
        y -= 14
      }
    }
  }
  y -= 8

  // ── 6. CRACK DOCUMENTATION ───────────────────────────────────────────────────
  sectionBar('CRACK DOCUMENTATION')
  const crackPresent = m.crackPresent
  const crackType    = m.crackType ?? 'none'
  const crackSev     = crackType === 'horizontal' ? 'CRITICAL'
                     : ['diagonal','stair_step','multiple'].includes(crackType) ? 'WARNING'
                     : 'INFO'
  const crackColor   = crackType === 'horizontal' ? CRIT
                     : ['diagonal','stair_step','multiple'].includes(crackType) ? WARN
                     : PASS

  if (!crackPresent || crackType === 'none') {
    ensureSpace(24)
    page.drawRectangle({ x: ML, y: y - 22, width: CW, height: 22, color: LIGHT, borderColor: BORDER, borderWidth: 0.5 })
    page.drawText('No cracks detected', { x: ML + 8, y: y - 15, size: 9, font: boldFont, color: PASS })
    y -= 30
  } else {
    ensureSpace(60)
    page.drawRectangle({ x: ML, y: y - 56, width: CW, height: 56, color: LIGHT, borderColor: BORDER, borderWidth: 0.5 })
    page.drawText(`Crack Type: ${crackType.replace('_', ' ').toUpperCase()}`, { x: ML + 8, y: y - 16, size: 10, font: boldFont, color: crackColor })
    page.drawText(crackSev, { x: ML + CW - boldFont.widthOfTextAtSize(crackSev, 8) - 8, y: y - 16, size: 8, font: boldFont, color: crackColor })
    const dims = [
      m.crackWidthMm  != null ? `Width: ${m.crackWidthMm}mm`  : null,
      m.crackLengthMm != null ? `Length: ~${m.crackLengthMm}mm` : null,
    ].filter(Boolean).join('  ·  ')
    if (dims) page.drawText(dims, { x: ML + 8, y: y - 30, size: 8, font: regularFont, color: TEXT })
    const structural = CRACK_STRUCTURAL[crackType] ?? ''
    page.drawText(structural, { x: ML + 8, y: y - 44, size: 7.5, font: regularFont, color: TEXT2 })
    y -= 64

    // Critical box
    if (crackType === 'horizontal') {
      ensureSpace(40)
      page.drawRectangle({ x: ML, y: y - 36, width: CW, height: 36, color: rgb(0.98, 0.93, 0.93), borderColor: CRIT, borderWidth: 1.5 })
      page.drawText('STRUCTURAL EMERGENCY — Immediate professional assessment required before occupancy.', {
        x: ML + 8, y: y - 16, size: 8, font: boldFont, color: CRIT,
      })
      page.drawText('Engage a licensed structural engineer. Do not occupy or perform remediation without engineering sign-off.', {
        x: ML + 8, y: y - 29, size: 7.5, font: regularFont, color: rgb(0.6, 0.1, 0.1),
      })
      y -= 44
    }
  }

  // ── 7. MOISTURE & DAMPPROOFING ────────────────────────────────────────────────
  sectionBar('MOISTURE & DAMPPROOFING')
  const moistureRows = [
    { label: 'Moisture / Water Staining', val: m.moisturePresent ? 'Detected' : 'None detected', flag: m.moisturePresent },
    { label: 'Efflorescence', val: m.efflorescence ? 'White mineral deposits present' : 'None detected', flag: m.efflorescence },
    { label: 'Dampproofing', val: m.dampproofingVisible === true ? 'Visible — present' : m.dampproofingVisible === false ? 'Not detected' : 'Not assessable from this view', flag: m.dampproofingVisible === false },
  ]
  for (let i = 0; i < moistureRows.length; i++) {
    ensureSpace(20)
    const row = moistureRows[i]
    page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: i % 2 === 0 ? WHITE : LIGHT, borderColor: BORDER, borderWidth: 0.25 })
    page.drawText(row.label, { x: ML + 4,  y: y - 13, size: 8, font: regularFont, color: TEXT })
    page.drawText(row.val,   { x: ML + 280, y: y - 13, size: 8, font: row.flag ? boldFont : regularFont, color: row.flag ? WARN : PASS })
    y -= 18
  }
  y -= 8

  // ── 8. AI NARRATIVE ──────────────────────────────────────────────────────────
  sectionBar('DETAILED ASSESSMENT')
  const lines = reportText.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { y -= 6; continue }
    const isSectionHdr = /^[0-9]+\.\s+[A-Z\s]+$/.test(trimmed)
    const fontSize = isSectionHdr ? 10 : 9
    const font     = isSectionHdr ? boldFont : regularFont
    const color    = isSectionHdr ? ORANGE : TEXT
    if (isSectionHdr) { ensureSpace(20); y -= 4 }
    const words = trimmed.split(' ')
    let currentLine = ''
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      if (font.widthOfTextAtSize(testLine, fontSize) > CW && currentLine) {
        ensureSpace(fontSize + 4)
        page.drawText(currentLine, { x: ML, y, size: fontSize, font, color })
        y -= fontSize + 3
        currentLine = word
      } else { currentLine = testLine }
    }
    if (currentLine) {
      ensureSpace(fontSize + 4)
      page.drawText(currentLine, { x: ML, y, size: fontSize, font, color })
      y -= fontSize + 3
    }
    if (isSectionHdr) y -= 3
  }

  // ── 9. CODE REFERENCES ───────────────────────────────────────────────────────
  sectionBar('APPLICABLE CODE REFERENCES', BLUE)
  const codeRefs = [
    `${codeLabel} — Foundation wall thickness: Part 9 s.9.15 (residential) / Part 3 (commercial)`,
    'IBC §1807 — Foundation wall requirements for all occupancies',
    'ACI 224R — Guide for Crack Control in Concrete Structures',
    'OBC s.9.13 / IBC §1805 — Dampproofing and waterproofing requirements',
    'NBC 9.15.4 — Minimum wall thickness for masonry foundation walls',
  ]
  for (const ref of codeRefs) {
    ensureSpace(14)
    page.drawText(`• ${ref}`, { x: ML + 4, y, size: 8, font: regularFont, color: TEXT2 })
    y -= 13
  }
  y -= 8

  // ── 10. DISCLAIMER + MODULE METADATA ─────────────────────────────────────────
  ensureSpace(50)
  y -= 12
  page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.5, color: BORDER })
  y -= 12

  const disclaimer = `AI-assisted visual screening only — not a certified building inspection. Accuracy ±15–40mm. Foundation assessments require physical access and professional engineering judgment. This report does not substitute for inspection by a licensed structural engineer. Module ID: ${moduleId} · staircode.app · © ${new Date().getFullYear()} Just Open Technologies Inc.`
  const dWords = disclaimer.split(' ')
  let dLine = ''
  for (const word of dWords) {
    const test = dLine ? `${dLine} ${word}` : word
    if (regularFont.widthOfTextAtSize(test, 7.5) > CW && dLine) {
      const dW = regularFont.widthOfTextAtSize(dLine, 7.5)
      page.drawText(dLine, { x: PW / 2 - dW / 2, y, size: 7.5, font: regularFont, color: TEXT2 })
      y -= 11
      dLine = word
    } else { dLine = test }
  }
  if (dLine) {
    const dW = regularFont.widthOfTextAtSize(dLine, 7.5)
    page.drawText(dLine, { x: PW / 2 - dW / 2, y, size: 7.5, font: regularFont, color: TEXT2 })
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
