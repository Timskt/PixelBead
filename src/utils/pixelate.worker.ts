import { COLOR_TABLE, buildColorLUT, lookupColor, perceptualDist } from "./colorMap"
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
  sx: number, sy: number, ex: number, ey: number
): [number, number, number] {
  let tr = 0, tg = 0, tb = 0, count = 0
  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const i = (y * width + x) * 4
      tr += data[i]; tg += data[i + 1]; tb += data[i + 2]
      count++
    }
  }
  return [Math.round(tr / count), Math.round(tg / count), Math.round(tb / count)]
}

// Detail: smart dominant color with variance-aware fallback
function sampleDetail(
  data: Uint8ClampedArray, width: number,
  sx: number, sy: number, ex: number, ey: number
): [number, number, number] {
  // 4-bit quantization (16 levels) for finer grouping
  const groups = new Map<number, { tr: number; tg: number; tb: number; n: number }>()
  let tr = 0, tg = 0, tb = 0, count = 0

  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const i = (y * width + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2]
      tr += r; tg += g; tb += b; count++

      // 4-bit quantization: shift right by 4 (16 levels)
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      const existing = groups.get(key)
      if (existing) {
        existing.n++
        existing.tr += r; existing.tg += g; existing.tb += b
      } else {
        groups.set(key, { tr: r, tg: g, tb: b, n: 1 })
      }
    }
  }

  // If very uniform (1-2 groups), just use average
  if (groups.size <= 2) {
    return [Math.round(tr / count), Math.round(tg / count), Math.round(tb / count)]
  }

  // Find dominant group
  let bestKey = 0
  let bestN = 0
  for (const [key, val] of groups) {
    if (val.n > bestN) {
      bestN = val.n
      bestKey = key
    }
  }

  const dominantRatio = bestN / count

  // If dominant group is less than 30% of block, the block is too mixed — use average
  if (dominantRatio < 0.3) {
    return [Math.round(tr / count), Math.round(tg / count), Math.round(tb / count)]
  }

  // Use dominant group's average color
  const best = groups.get(bestKey)!
  return [Math.round(best.tr / best.n), Math.round(best.tg / best.n), Math.round(best.tb / best.n)]
}

// Simplify colors: keep top N most used, remap rest to nearest (perceptual distance)
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
        const dist = perceptualDist(p.r, p.g, p.b, k.r, k.g, k.b)
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
      const sx = col * pixelSize
      const sy = row * pixelSize
      const ex = Math.min(sx + pixelSize, width)
      const ey = Math.min(sy + pixelSize, height)

      const [avgR, avgG, avgB] = sampler(data, width, sx, sy, ex, ey)
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
