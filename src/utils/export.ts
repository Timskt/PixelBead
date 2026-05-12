import type { PixelData, DisplayMode } from "./pixelate"

// === Bead count utilities ===

export interface BeadCountItem {
  dmc: string
  name: string
  hex: string
  count: number
}

export function getBeadCounts(matrix: PixelData[][]): BeadCountItem[] {
  const map = new Map<string, BeadCountItem>()
  for (const row of matrix) {
    for (const pixel of row) {
      const existing = map.get(pixel.dmc)
      if (existing) {
        existing.count++
      } else {
        map.set(pixel.dmc, { dmc: pixel.dmc, name: pixel.colorName, hex: pixel.hex, count: 1 })
      }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

// === Export PNG (canvas) ===

export function exportPNG(canvas: HTMLCanvasElement, filename = "pixelbead.png") {
  try {
    const link = document.createElement("a")
    link.download = filename
    link.href = canvas.toDataURL("image/png")
    link.click()
  } catch {
    throw new Error("导出 PNG 失败")
  }
}

// === Export JSON ===

export async function copyJSON(matrix: PixelData[][]): Promise<void> {
  const data = matrix.map((row) =>
    row.map((pixel) => ({
      dmc: pixel.dmc,
      color: pixel.colorName,
      hex: pixel.hex,
    }))
  )
  const json = JSON.stringify(data, null, 2)

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(json)
      return
    } catch {
      // fall through
    }
  }

  const textarea = document.createElement("textarea")
  textarea.value = json
  textarea.style.cssText = "position:fixed;left:-9999px"
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand("copy")
  document.body.removeChild(textarea)
  if (!ok) throw new Error("复制失败，请手动复制")
}

// === Export Material List (CSV) ===

export function exportMaterialCSV(
  counts: BeadCountItem[],
  filename = "pixelbead-list.csv"
) {
  const BOM = "\uFEFF"
  const header = "DMC色号,颜色名,Hex色值,数量"
  const body = counts.map((c) => `${c.dmc},${c.name},${c.hex},${c.count}`).join("\n")
  const footer = `\n,,总计,${counts.reduce((s, c) => s + c.count, 0)}`
  const csv = BOM + header + "\n" + body + footer

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.download = filename
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

// === Export Material List (TXT) ===

export function exportMaterialTXT(
  counts: BeadCountItem[],
  cols: number,
  rows: number,
  filename = "pixelbead-list.txt"
) {
  const total = counts.reduce((s, c) => s + c.count, 0)
  const lines: string[] = [
    "PixelBead 拼豆用料清单",
    "========================",
    "",
    `图案尺寸: ${cols} × ${rows}`,
    `总用豆数: ${total}`,
    `颜色种类: ${counts.length}`,
    "",
    "色号    颜色名      Hex色值    数量",
    "----    --------    -------    ----",
  ]

  for (const c of counts) {
    const dmc = c.dmc.padEnd(8)
    const name = c.name.padEnd(10)
    const hex = c.hex.padEnd(10)
    lines.push(`${dmc}${name}${hex}${c.count}`)
  }

  lines.push("")
  lines.push("----    --------    -------    ----")
  lines.push(`${"".padEnd(8)}${"".padEnd(10)}总计${"".padEnd(6)}${total}`)
  lines.push("")
  lines.push("生成工具: PixelBead - pixelbead.pages.dev")

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.download = filename
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

// === Export Material List (Image) ===

export function exportMaterialImage(
  counts: BeadCountItem[],
  cols: number,
  rows: number,
  filename = "pixelbead-list.png"
) {
  const total = counts.reduce((s, c) => s + c.count, 0)
  const rowH = 32
  const headerH = 120
  const footerH = 60
  const w = 480
  const h = headerH + counts.length * rowH + footerH

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")!

  // Background
  ctx.fillStyle = "#FFFFFF"
  ctx.fillRect(0, 0, w, h)

  // Header
  ctx.fillStyle = "#2D3436"
  ctx.font = "bold 20px 'PingFang SC','Noto Sans SC',sans-serif"
  ctx.fillText("🧵 拼豆用料清单", 20, 35)

  ctx.fillStyle = "#636E72"
  ctx.font = "13px 'PingFang SC','Noto Sans SC',sans-serif"
  ctx.fillText(`图案尺寸: ${cols} × ${rows}    总用豆: ${total}    颜色: ${counts.length} 种`, 20, 60)

  // Column headers
  ctx.fillStyle = "#F0E6E0"
  ctx.fillRect(0, 80, w, 30)
  ctx.fillStyle = "#2D3436"
  ctx.font = "bold 12px 'PingFang SC','Noto Sans SC',sans-serif"
  ctx.fillText("色号", 20, 100)
  ctx.fillText("颜色", 100, 100)
  ctx.fillText("Hex", 240, 100)
  ctx.fillText("数量", 400, 100)

  // Rows
  for (let i = 0; i < counts.length; i++) {
    const c = counts[i]
    const y = headerH + i * rowH

    if (i % 2 === 1) {
      ctx.fillStyle = "#FFF9F5"
      ctx.fillRect(0, y, w, rowH)
    }

    // Color swatch
    ctx.fillStyle = c.hex
    ctx.fillRect(20, y + 6, 20, 20)
    ctx.strokeStyle = "rgba(0,0,0,0.1)"
    ctx.lineWidth = 1
    ctx.strokeRect(20, y + 6, 20, 20)

    // Text
    ctx.fillStyle = "#2D3436"
    ctx.font = "bold 13px 'PingFang SC','Noto Sans SC',sans-serif"
    ctx.fillText(c.dmc, 50, y + 21)

    ctx.fillStyle = "#636E72"
    ctx.font = "13px 'PingFang SC','Noto Sans SC',sans-serif"
    ctx.fillText(c.name, 100, y + 21)
    ctx.fillText(c.hex, 240, y + 21)

    ctx.fillStyle = "#2D3436"
    ctx.font = "bold 13px 'PingFang SC','Noto Sans SC',sans-serif"
    ctx.fillText(String(c.count), 400, y + 21)
  }

  // Footer
  ctx.strokeStyle = "#F0E6E0"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(20, headerH + counts.length * rowH + 10)
  ctx.lineTo(w - 20, headerH + counts.length * rowH + 10)
  ctx.stroke()

  ctx.fillStyle = "#636E72"
  ctx.font = "11px 'PingFang SC','Noto Sans SC',sans-serif"
  ctx.fillText("PixelBead - pixelbead.pages.dev", 20, h - 15)

  exportPNG(canvas, filename)
}

// === Pattern canvas with grid labels ===

export function renderPatternCanvas(
  matrix: PixelData[][],
  pixelSize: number,
  cols: number,
  rows: number,
  displayMode: DisplayMode
): HTMLCanvasElement {
  const labelW = Math.max(28, Math.floor(pixelSize * 0.8))
  const labelH = Math.max(20, Math.floor(pixelSize * 0.6))
  const logicalW = labelW + cols * pixelSize
  const logicalH = labelH + rows * pixelSize
  const scale = 2

  const canvas = document.createElement("canvas")
  canvas.width = logicalW * scale
  canvas.height = logicalH * scale
  const ctx = canvas.getContext("2d")!
  ctx.scale(scale, scale)
  ctx.imageSmoothingEnabled = false

  ctx.fillStyle = "#FFFFFF"
  ctx.fillRect(0, 0, logicalW, logicalH)

  // Column labels
  ctx.fillStyle = "#636E72"
  ctx.font = `bold ${Math.max(9, Math.floor(labelW * 0.4))}px sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  for (let col = 0; col < cols; col++) {
    ctx.fillText(colLabel(col), labelW + col * pixelSize + pixelSize / 2, labelH / 2)
  }

  // Row labels
  for (let row = 0; row < rows; row++) {
    ctx.fillText(String(row + 1), labelW / 2, labelH + row * pixelSize + pixelSize / 2)
  }

  // Grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pixel = matrix[row][col]
      const x = labelW + col * pixelSize
      const y = labelH + row * pixelSize

      ctx.fillStyle = pixel.hex
      ctx.fillRect(x, y, pixelSize, pixelSize)

      ctx.strokeStyle = "rgba(0,0,0,0.1)"
      ctx.lineWidth = 0.5
      ctx.strokeRect(x, y, pixelSize, pixelSize)

      const label = displayMode === "dmc" ? pixel.dmc : pixel.colorName
      const fontSize = Math.max(6, Math.floor(pixelSize * 0.38))
      ctx.font = `bold ${fontSize}px "PingFang SC","Noto Sans SC",sans-serif`
      ctx.fillStyle = pixel.textColor
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(label, x + pixelSize / 2, y + pixelSize / 2)
    }
  }

  return canvas
}

function colLabel(col: number): string {
  let s = ""
  let c = col
  while (c >= 0) {
    s = String.fromCharCode(65 + (c % 26)) + s
    c = Math.floor(c / 26) - 1
  }
  return s
}
