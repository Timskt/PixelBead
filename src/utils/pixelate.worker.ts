import { COLOR_TABLE, buildColorLUT, lookupColor } from "./colorMap"
import type { ColorLUT, ColorEntry } from "./colorMap"

interface PixelData {
  dmc: string
  colorName: string
  hex: string
  r: number
  g: number
  b: number
  textColor: string
}

interface WorkerRequest {
  imageData: ImageData
  pixelSize: number
  palette: ColorEntry[]
  quality: "fast" | "detail"
  maxColors: number
}

interface WorkerResponse {
  matrix: PixelData[][]
  cols: number
  rows: number
}

const lutCache = new Map<string, ColorLUT>()

function getLUT(palette: ColorEntry[]): ColorLUT {
  const key = palette.map((c) => c.dmc).sort().join(",")
  let lut = lutCache.get(key)
  if (!lut) {
    lut = buildColorLUT(palette.length > 0 ? palette : COLOR_TABLE)
    lutCache.set(key, lut)
  }
  return lut
}

// Fast: simple block average
function sampleAverage(
  data: Uint8ClampedArray, width: number,
  startX: number, startY: number, endX: number, endY: number
): [number, number, number] {
  let tr = 0, tg = 0, tb = 0, count = 0
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const i = (y * width + x) * 4
      tr += data[i]; tg += data[i + 1]; tb += data[i + 2]
      count++
    }
  }
  return [Math.round(tr / count), Math.round(tg / count), Math.round(tb / count)]
}

// Detail: edge-aware mode — splits block into quadrants, picks dominant
function sampleDetail(
  data: Uint8ClampedArray, width: number,
  startX: number, startY: number, endX: number, endY: number
): [number, number, number] {
  // Quantize to 5 bits per channel for grouping
  const colorCount = new Map<number, { r: number; g: number; b: number; n: number }>()
  let tr = 0, tg = 0, tb = 0, count = 0

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const i = (y * width + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2]
      tr += r; tg += g; tb += b; count++

      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
      const existing = colorCount.get(key)
      if (existing) {
        existing.n++
        existing.r += r; existing.g += g; existing.b += b
      } else {
        colorCount.set(key, { r, g, b, n: 1 })
      }
    }
  }

  // If very uniform block, just use average
  if (colorCount.size <= 2) {
    return [Math.round(tr / count), Math.round(tg / count), Math.round(tb / count)]
  }

  // Find dominant color group
  let bestKey = 0
  let bestCount = 0
  for (const [key, val] of colorCount) {
    if (val.n > bestCount) {
      bestCount = val.n
      bestKey = key
    }
  }

  const best = colorCount.get(bestKey)!
  return [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)]
}

// Simplify colors: keep top N most used, remap rest to nearest
function simplifyColors(
  matrix: PixelData[][],
  cols: number,
  rows: number,
  maxColors: number
): PixelData[][] {
  if (maxColors <= 0) return matrix

  const counts = new Map<string, { count: number; sample: PixelData }>()
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const p = matrix[row][col]
      const existing = counts.get(p.dmc)
      if (existing) {
        existing.count++
      } else {
        counts.set(p.dmc, { count: 1, sample: p })
      }
    }
  }

  if (counts.size <= maxColors) return matrix

  const sorted = [...counts.entries()].sort((a, b) => b[1].count - a[1].count)
  const keepSet = new Set(sorted.slice(0, maxColors).map(([dmc]) => dmc))
  const keepColors = sorted.slice(0, maxColors).map(([, v]) => v.sample)

  return matrix.map((row) =>
    row.map((p) => {
      if (keepSet.has(p.dmc)) return p
      let minDist = Infinity
      let nearest = keepColors[0]
      for (const k of keepColors) {
        const dist = (p.r - k.r) ** 2 + (p.g - k.g) ** 2 + (p.b - k.b) ** 2
        if (dist < minDist) { minDist = dist; nearest = k }
      }
      return nearest
    })
  )
}

self.onmessage = (e: MessageEvent) => {
  const { imageData, pixelSize, palette, quality, maxColors } = e.data as WorkerRequest
  const { width, height, data } = imageData

  if (pixelSize <= 0) {
    self.postMessage({ matrix: [], cols: 0, rows: 0 })
    return
  }

  const lut = getLUT(palette)
  const cols = Math.ceil(width / pixelSize)
  const rows = Math.ceil(height / pixelSize)
  const sampler = quality === "detail" ? sampleDetail : sampleAverage
  let matrix: PixelData[][] = []

  for (let row = 0; row < rows; row++) {
    const rowData: PixelData[] = []
    for (let col = 0; col < cols; col++) {
      const startX = col * pixelSize
      const startY = row * pixelSize
      const endX = Math.min(startX + pixelSize, width)
      const endY = Math.min(startY + pixelSize, height)

      const [avgR, avgG, avgB] = sampler(data, width, startX, startY, endX, endY)
      const color = lookupColor(lut, avgR, avgG, avgB)
      rowData.push({
        dmc: color.dmc,
        colorName: color.name,
        hex: color.hex,
        r: color.r,
        g: color.g,
        b: color.b,
        textColor: color.textColor,
      })
    }
    matrix.push(rowData)
  }

  if (maxColors > 0) {
    matrix = simplifyColors(matrix, cols, rows, maxColors)
  }

  self.postMessage({ matrix, cols, rows } as WorkerResponse)
}
