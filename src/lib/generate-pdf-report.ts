/**
 * generate-pdf-report.ts
 *
 * Generates a professional PDF compliance report using pdf-lib.
 * pdf-lib is pure JavaScript — no font files, no fs.readFileSync,
 * works perfectly in Next.js App Router serverless functions.
 *
 * Returns a Buffer suitable for emailing as an attachment and uploading
 * to Supabase Storage.
 */

import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib'

// Brand colours as rgb() values
const ORANGE  = rgb(0.949, 0.576, 0.216)   // #F29337
const NAVY    = rgb(0.039, 0.110, 0.180)   // #0A1C2E
const NAVY2   = rgb(0.071, 0.180, 0.290)   // #1A2E4A
const LIGHT   = rgb(0.957, 0.969, 0.984)   // #F4F7FB
const TEXT    = rgb(0.051, 0.118, 0.180)   // #0D1E2E
const TEXT2   = rgb(0.369, 0.490, 0.608)   // #5E7D9B
const PASS    = rgb(0.153, 0.663, 0.420)   // #27A96B
const FAIL    = rgb(0.910, 0.333, 0.333)   // #E85555
const WARN    = rgb(0.949, 0.576, 0.216)   // #F29337
const BORDER  = rgb(0.898, 0.918, 0.945)   // #E5EBF2
const WHITE   = rgb(1, 1, 1)
const STRIPE  = rgb(0.949, 0.576, 0.216)

const FRAME_LABELS: Record<string,string> = {
  overview:    'Full Stair View',
  riser_front: 'Riser Height',
  rotate_90:   'Nosing Check',
  nosing:      'Nosing Close-Up',
  handrail:    'Handrail Height',
  alt_angle:   'Stair Width',
  tread_top:   'Tread Depth',
}

interface FieldResult {
  label:       string
  value?:      number | null
  pass?:       boolean | null
  clearAbove?: boolean
  min?:        number | null
  max?:        number | null
}

export async function generatePDFReport(params: {
  reportText: string
  fields:     FieldResult[]
  frames:     Record<string,string>
  codeLabel:  string
  location:   string
  date:       string
}): Promise<Buffer> {
  const { reportText, fields, frames, codeLabel, location, date } = params

  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`stAIrcode Compliance Report — ${location || codeLabel}`)
  pdfDoc.setAuthor('stAIrcode by Just Open Technologies Inc.')
  pdfDoc.setSubject('Pre-Inspection Stair Compliance Report')

  const boldFont   = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const PW = 595.28   // A4 width in points
  const PH = 841.89   // A4 height in points
  const ML = 50       // left margin
  const MR = 50       // right margin
  const CW = PW - ML - MR   // content width

  let page = pdfDoc.addPage([PW, PH])
  let y = PH - 20   // current y position (pdf-lib y=0 is bottom)

  function newPage() {
    page = pdfDoc.addPage([PW, PH])
    y = PH - 50
  }

  function ensureSpace(needed: number) {
    if (y - needed < 50) newPage()
  }

  // ── Header ────────────────────────────────────────────────────────────────
  // Hazard stripe band
  page.drawRectangle({ x: 0, y: PH - 100, width: PW, height: 100, color: NAVY })
  // Diagonal stripes
  for (let sx = -80; sx < PW + 80; sx += 22) {
    page.drawRectangle({ x: sx, y: PH - 100, width: 11, height: 100, color: STRIPE, opacity: 0.35 })
  }
  // Navy inner box
  page.drawRectangle({ x: ML - 10, y: PH - 92, width: CW + 20, height: 82, color: NAVY })

  // Logo text "stAIrcode"
  const logoY = PH - 38
  page.drawText('st', { x: PW / 2 - 58, y: logoY, size: 20, font: boldFont, color: WHITE })
  page.drawText('AI', { x: PW / 2 - 30, y: logoY, size: 20, font: boldFont, color: ORANGE })
  page.drawText('rcode', { x: PW / 2 - 8, y: logoY, size: 20, font: boldFont, color: WHITE })

  // Title
  const titleText = 'Stair Compliance Report'
  const titleW = boldFont.widthOfTextAtSize(titleText, 16)
  page.drawText(titleText, { x: PW / 2 - titleW / 2, y: PH - 62, size: 16, font: boldFont, color: WHITE })

  // Subtitle
  const subText = `${codeLabel}${location ? ' · ' + location : ''} · ${date}`
  const subW = regularFont.widthOfTextAtSize(subText, 9)
  page.drawText(subText, { x: PW / 2 - subW / 2, y: PH - 80, size: 9, font: regularFont, color: rgb(0.576, 0.729, 0.831) })

  y = PH - 115

  // ── Summary chips ─────────────────────────────────────────────────────────
  const passed      = fields.filter(f => f.pass === true).length
  const failed      = fields.filter(f => f.pass === false).length
  const notAssessed = fields.filter(f => f.value == null && !f.clearAbove).length
  const chips = [
    { label: 'PASSED',       val: passed,      color: PASS },
    { label: 'FAILED',       val: failed,       color: FAIL },
    { label: 'NOT ASSESSED', val: notAssessed,  color: WARN },
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

  // ── Measurement photos ────────────────────────────────────────────────────
  const validFrames = Object.entries(frames).filter(([k, v]) => FRAME_LABELS[k] && v && v.length > 100)

  if (validFrames.length > 0) {
    ensureSpace(30)
    // Section bar
    page.drawRectangle({ x: ML, y: y - 22, width: CW, height: 22, color: NAVY })
    page.drawText('MEASUREMENT PHOTOS', { x: ML + 8, y: y - 16, size: 9, font: boldFont, color: WHITE })
    y -= 30

    page.drawText(`${validFrames.length} of ${Object.keys(FRAME_LABELS).length} positions captured during this inspection.`,
      { x: ML, y, size: 8, font: regularFont, color: TEXT2 })
    y -= 16

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

        // Border box
        page.drawRectangle({ x: imgX, y: imgY, width: imgW, height: imgH, borderColor: BORDER, borderWidth: 0.5, color: LIGHT })

        // Embed image
        try {
          const rawData = b64raw.startsWith('data:')
            ? b64raw.split(',')[1]
            : b64raw
          const imgBytes = Uint8Array.from(Buffer.from(rawData, 'base64'))

          let embeddedImage
          // Try JPEG first, fall back to PNG
          try {
            embeddedImage = await pdfDoc.embedJpg(imgBytes)
          } catch {
            embeddedImage = await pdfDoc.embedPng(imgBytes)
          }

          // Scale to fit box maintaining aspect ratio
          const { width: iw, height: ih } = embeddedImage
          const scale = Math.min(imgW / iw, imgH / ih)
          const dw = iw * scale
          const dh = ih * scale
          const dx = imgX + (imgW - dw) / 2
          const dy = imgY + (imgH - dh) / 2

          page.drawImage(embeddedImage, { x: dx, y: dy, width: dw, height: dh })
        } catch {
          page.drawText('Photo unavailable', {
            x: imgX + imgW / 2 - 30, y: imgY + imgH / 2, size: 8, font: regularFont, color: TEXT2,
          })
        }

        // Label
        const lbl = FRAME_LABELS[posId] ?? posId
        const lblW2 = boldFont.widthOfTextAtSize(lbl, 8)
        page.drawText(lbl, { x: imgX + imgW / 2 - lblW2 / 2, y: imgY - 14, size: 8, font: boldFont, color: TEXT })
      }

      y -= imgH + lblH + 8
    }
    y -= 8
  }

  // ── Compliance table ──────────────────────────────────────────────────────
  ensureSpace(60)
  page.drawRectangle({ x: ML, y: y - 22, width: CW, height: 22, color: NAVY })
  page.drawText('COMPLIANCE ANALYSIS', { x: ML + 8, y: y - 16, size: 9, font: boldFont, color: WHITE })
  y -= 30

  // Header row
  page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: LIGHT })
  page.drawText('Measurement', { x: ML + 4, y: y - 13, size: 8, font: boldFont, color: TEXT2 })
  page.drawText('Value',       { x: ML + 220, y: y - 13, size: 8, font: boldFont, color: TEXT2 })
  page.drawText('Result',      { x: ML + 320, y: y - 13, size: 8, font: boldFont, color: TEXT2 })
  y -= 18

  for (let i = 0; i < fields.length; i++) {
    ensureSpace(20)
    const f = fields[i]
    const rowColor = i % 2 === 0 ? WHITE : LIGHT
    page.drawRectangle({ x: ML, y: y - 18, width: CW, height: 18, color: rowColor, borderColor: BORDER, borderWidth: 0.25 })

    const val    = f.clearAbove ? 'Clear' : f.value != null ? `${Math.round(f.value)}mm` : 'Not captured'
    const status = f.value == null && !f.clearAbove ? 'NOT ASSESSED' : f.pass === true ? 'PASS' : f.pass === false ? 'FAIL' : 'N/A'
    const sColor = status === 'PASS' ? PASS : status === 'FAIL' ? FAIL : WARN

    page.drawText(f.label, { x: ML + 4,  y: y - 13, size: 8, font: regularFont, color: TEXT })
    page.drawText(val,     { x: ML + 220, y: y - 13, size: 8, font: regularFont, color: TEXT })
    page.drawText(status,  { x: ML + 320, y: y - 13, size: 8, font: boldFont,    color: sColor })
    y -= 18
  }
  y -= 12

  // ── Report text ───────────────────────────────────────────────────────────
  ensureSpace(50)
  page.drawRectangle({ x: ML, y: y - 22, width: CW, height: 22, color: NAVY })
  page.drawText('DETAILED ASSESSMENT', { x: ML + 8, y: y - 16, size: 9, font: boldFont, color: WHITE })
  y -= 30

  const lines = reportText.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { y -= 6; continue }

    const isSectionHeader = /^[0-9]+\.\s+[A-Z\s]+$/.test(trimmed)
    const fontSize = isSectionHeader ? 10 : 9
    const font     = isSectionHeader ? boldFont : regularFont
    const color    = isSectionHeader ? ORANGE : TEXT

    if (isSectionHeader) { ensureSpace(20); y -= 4 }

    // Word-wrap long lines
    const words = trimmed.split(' ')
    let currentLine = ''
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testW = font.widthOfTextAtSize(testLine, fontSize)
      if (testW > CW && currentLine) {
        ensureSpace(fontSize + 4)
        page.drawText(currentLine, { x: ML, y, size: fontSize, font, color })
        y -= fontSize + 3
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) {
      ensureSpace(fontSize + 4)
      page.drawText(currentLine, { x: ML, y, size: fontSize, font, color })
      y -= fontSize + 3
    }

    if (isSectionHeader) y -= 3
  }

  // ── Disclaimer ────────────────────────────────────────────────────────────
  ensureSpace(40)
  y -= 12
  page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.5, color: BORDER })
  y -= 12

  const disclaimer = `Pre-inspection AI analysis only — not a certified building inspection. Accuracy ±9.5–25mm. Always verify against ${codeLabel} with your local authority. staircode.app · © ${new Date().getFullYear()} Just Open Technologies Inc.`
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
