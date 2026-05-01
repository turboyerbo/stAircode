/**
 * src/lib/generate-photo-report.ts
 *
 * CLIENT-SIDE ONLY — never import this from a server component or API route.
 * Uses jsPDF which requires browser APIs (window, document, canvas).
 *
 * Generates a professional PDF compliance report with embedded photos.
 * Called after Stripe payment for the $2.99 photo report.
 */

'use client'

import type { jsPDF as JsPDFType } from 'jspdf'

export interface PhotoReportInput {
  reportText:  string
  frames:      Record<string, string>   // positionId → base64 JPEG
  codeLabel:   string
  location:    string
  fields:      Array<{
    label: string; icon: string; value: number | null
    min?: number; max?: number; pass: boolean | null
    clearAbove?: boolean; note?: string
  }>
  date?:       string
}

const FRAME_LABELS: Record<string, string> = {
  overview:    'Full Stair Overview',
  riser_front: 'Riser Height Measurement',
  handrail:    'Handrail Height Measurement',
  alt_angle:   'Stair Width Measurement',
  tread_top:   'Tread Depth Measurement',
}

const NAVY  = [10, 28, 46]   as const
const ORANGE= [242, 147, 55] as const
const WHITE = [255, 255, 255] as const
const GREY  = [90, 110, 130] as const
const LGREY = [240, 245, 250] as const
const GREEN = [39, 169, 107] as const
const RED   = [220, 60, 60]  as const

export async function generatePhotoReport(input: PhotoReportInput): Promise<void> {
  // Dynamic import — jsPDF is large, only load on demand
  const { jsPDF } = await import('jspdf')

  const doc: JsPDFType = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW = 210   // page width mm
  const PH = 297   // page height mm
  const ML = 18    // margin left
  const MR = 18    // margin right
  const CW = PW - ML - MR   // content width
  let y = 0

  const date = input.date ?? new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })

  // ── Helper: add new page if needed ──────────────────────────────────────
  function checkPage(needed: number) {
    if (y + needed > PH - 20) {
      doc.addPage()
      y = 18
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ═══════════════════════════════════════════════════════════════════════

  // Navy header band
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2])
  doc.rect(0, 0, PW, 55, 'F')

  // Orange stripe at bottom of header
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2])
  doc.rect(0, 52, PW, 3, 'F')

  // Title
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('Stair Compliance Report', ML, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(180, 200, 220)
  doc.text('stAIrcode — AI-Powered Pre-Inspection Analysis', ML, 30)

  // Code + location + date on a row
  doc.setFontSize(8.5)
  doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2])
  doc.text(`${input.codeLabel}`, ML, 40)
  doc.setTextColor(180, 200, 220)
  doc.text(`  ·  ${input.location || 'Unknown Location'}  ·  ${date}`, ML + doc.getTextWidth(input.codeLabel), 40)

  // Disclaimer badge
  doc.setFillColor(30, 50, 75)
  doc.roundedRect(ML, 44, CW, 6.5, 1.5, 1.5, 'F')
  doc.setFontSize(7)
  doc.setTextColor(150, 180, 210)
  doc.text('PRE-INSPECTION AI ANALYSIS — Verify all findings with a licensed building official before relying on this report.', ML + 2.5, 48.5)

  y = 63

  // ── Pass/Fail summary table ──────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text('MEASUREMENT SUMMARY', ML, y)
  y += 5

  const colW = [70, 30, 30, CW - 130] as const
  const headers = ['Dimension', 'Measured', 'Required', 'Result']

  // Table header
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2])
  doc.rect(ML, y, CW, 7, 'F')
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2])
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  let cx = ML + 2
  headers.forEach((h, i) => {
    doc.text(h, cx, y + 5)
    cx += colW[i]
  })
  y += 7

  // Table rows
  doc.setFont('helvetica', 'normal')
  input.fields.forEach((f, i) => {
    checkPage(7)
    const bg = i % 2 === 0 ? LGREY : WHITE
    doc.setFillColor(bg[0], bg[1], bg[2])
    doc.rect(ML, y, CW, 7, 'F')

    const val    = f.clearAbove ? 'CLEAR' : f.value != null ? `${Math.round(f.value)}mm` : '—'
    const range  = f.min != null && f.max != null ? `${f.min}–${f.max}mm`
                 : f.min != null ? `≥${f.min}mm`
                 : f.max != null ? `≤${f.max}mm` : '—'
    const result = f.pass === true ? 'PASS' : f.pass === false ? 'FAIL' : 'N/A'
    const rColor = f.pass === true ? GREEN : f.pass === false ? RED : GREY

    doc.setFontSize(7.5)
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
    cx = ML + 2
    doc.text(f.icon ? `${f.icon} ${f.label}` : f.label, cx, y + 5);  cx += colW[0]
    doc.text(val, cx, y + 5);                      cx += colW[1]
    doc.text(range, cx, y + 5);                    cx += colW[2]
    doc.setTextColor(rColor[0], rColor[1], rColor[2])
    doc.setFont('helvetica', 'bold')
    doc.text(result, cx, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])

    if (f.note) {
      y += 7
      checkPage(5)
      doc.setFillColor(bg[0], bg[1], bg[2])
      doc.rect(ML, y, CW, 5, 'F')
      doc.setFontSize(6.5)
      doc.setTextColor(GREY[0], GREY[1], GREY[2])
      doc.text(`  ↳ ${f.note}`, ML + 2, y + 3.5)
      y += 5
    } else {
      y += 7
    }
  })

  y += 6

  // ── Report text ──────────────────────────────────────────────────────
  checkPage(12)
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2])
  doc.rect(ML, y, 3, 0, 'F')  // accent bar will be drawn after

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text('COMPLIANCE ANALYSIS', ML, y + 5)

  // Orange underline
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2])
  doc.rect(ML, y + 6.5, 45, 0.8, 'F')
  y += 12

  // Split report text into sections and render
  const sections = input.reportText.split(/\n(?=\d\.\s+[A-Z])/)
  sections.forEach(section => {
    const lines = section.split('\n').filter(l => l.trim())
    if (!lines.length) return

    const heading = lines[0]
    const body    = lines.slice(1).join('\n')

    checkPage(14)

    // Section heading
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
    doc.text(heading, ML, y)
    y += 5

    // Body text — wrap to content width
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(GREY[0], GREY[1], GREY[2])
    const wrapped = doc.splitTextToSize(body, CW)
    wrapped.forEach((line: string) => {
      checkPage(5)
      doc.text(line, ML, y)
      y += 4.5
    })
    y += 4
  })

  // ═══════════════════════════════════════════════════════════════════════
  // PHOTO PAGES — one photo per page, labelled
  // ═══════════════════════════════════════════════════════════════════════
  const frameEntries = Object.entries(input.frames).filter(([k, v]) => FRAME_LABELS[k] && v)

  if (frameEntries.length > 0) {
    doc.addPage()
    y = 18

    // Section header
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2])
    doc.rect(0, 0, PW, 14, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2])
    doc.text('MEASUREMENT PHOTOGRAPHS', ML, 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(180, 200, 220)
    doc.text(`${frameEntries.length} positions captured during scan`, PW - MR - doc.getTextWidth(`${frameEntries.length} positions captured during scan`), 10)
    y = 22

    // Orange accent line
    doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2])
    doc.rect(ML, 14, CW, 1.5, 'F')

    for (let idx = 0; idx < frameEntries.length; idx++) {
      const [posId, b64] = frameEntries[idx]
      const label   = FRAME_LABELS[posId] ?? posId
      const photoW = CW    // full width

      checkPage(120)

      // Label bar
      doc.setFillColor(20, 40, 65)
      doc.roundedRect(ML, y, CW, 8, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2])
      doc.text(`${String(idx + 1).padStart(2, '0')}`, ML + 3, y + 5.5)
      doc.setTextColor(WHITE[0], WHITE[1], WHITE[2])
      doc.text(label.toUpperCase(), ML + 11, y + 5.5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(150, 180, 210)
      doc.text(`Position: ${posId}`, PW - MR - doc.getTextWidth(`Position: ${posId}`), y + 5.5)
      y += 10

      // Photo — embed base64 JPEG preserving native aspect ratio
      try {
        const imgData = b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`

        // Detect natural dimensions via Image element so we never stretch/squash
        // for...of allows await here (forEach callbacks cannot be async)
        const naturalDims = await new Promise<{ w: number; h: number }>(resolve => {
          const img = new window.Image()
          img.onload  = () => resolve({ w: img.naturalWidth,  h: img.naturalHeight })
          img.onerror = () => resolve({ w: 4, h: 3 }) // fallback 4:3
          img.src = imgData
        })

        const aspectRatio = naturalDims.h / naturalDims.w  // e.g. 16/9 for portrait phone
        const drawW = photoW                               // fill page width
        const drawH = Math.min(drawW * aspectRatio, 160)  // cap height at 160mm

        checkPage(drawH + 14)

        doc.addImage(imgData, 'JPEG', ML, y, drawW, drawH, undefined, 'MEDIUM')
        doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2])
        doc.setLineWidth(0.4)
        doc.rect(ML, y, drawW, drawH)

        y += drawH + 8
      } catch (e) {
        // If image fails, show placeholder
        const fallbackH = 80
        doc.setFillColor(LGREY[0], LGREY[1], LGREY[2])
        doc.rect(ML, y, photoW, fallbackH, 'F')
        doc.setFontSize(8)
        doc.setTextColor(GREY[0], GREY[1], GREY[2])
        doc.text('Image could not be embedded', ML + CW/2 - 20, y + fallbackH/2)
        y += fallbackH + 8
      }

      // Add new page between photos if running low
      if (idx < frameEntries.length - 1) {
        checkPage(120)
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FOOTER on every page
  // ═══════════════════════════════════════════════════════════════════════
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2])
    doc.rect(0, PH - 10, PW, 10, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(120, 150, 180)
    doc.text(`stAIrcode · staircode.app · Pre-inspection AI analysis only · © ${new Date().getFullYear()} Just Open Technologies Inc.`, ML, PH - 3.5)
    doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2])
    doc.text(`Page ${p} of ${pageCount}`, PW - MR - 15, PH - 3.5)
  }

  // ── Save ─────────────────────────────────────────────────────────────
  const filename = `stAIrcode-report-${(input.location || 'unknown').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${date.replace(/[^0-9]/g, '')}.pdf`
  doc.save(filename)
}
