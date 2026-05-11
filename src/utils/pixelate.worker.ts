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
  removeBg: boolean
}

interface WorkerResponse {
  matrix: PixelData[][]
  cols: number
  rows: number
}

// ========== LUT Cache ==========

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

// ========== Median Cut ==========

interface Bucket {
  pixels: Uint8Array  // flat array: [r,g,b, r,g,b, ...]
  count: number
}

function createBucket(
  data: Uint8ClampedArray, width: number,
  sx: number, sy: number, ex: number, ey: number
): Bucket {
  const count = (ex - sx) * (ey - sy)
  const pixels = new Uint8Array(count * 3)
  let idx = 0
  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const i = (y * width + x) * 4
      pixels[idx++] = data[i]
      pixels[idx++] = data[i + 1]
      pixels[idx++] = data[i + 2]
    }
  }
  return { pixels, count }
}

function bucketAverage(b: Bucket): [number, number, number] {
  let tr = 0, tg = 0, tb = 0
  for (let i = 0; i < b.pixels.length; i += 3) {
    tr += b.pixels[i]; tg += b.pixels[i + 1]; tb += b.pixels[i + 2]
  }
  return [Math.round(tr / b.count), Math.round(tg / b.count), Math.round(tb / b.count)]
}

function bucketDominant(b: Bucket): [number, number, number] {
  // 4-bit quantization grouping
  const groups = new Map<number, { tr: number; tg: number; tb: number; n: number }>()
  for (let i = 0; i < b.pixels.length; i += 3) {
    const r = b.pixels[i], g = b.pixels[i + 1], bb = b.pixels[i + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (bb >> 4)
    const existing = groups.get(key)
    if (existing) {
      existing.n++; existing.tr += r; existing.tg += g; existing.tb += bb
    } else {
      groups.set(key, { tr: r, tg: g, tb: bb, n: 1 })
    }
  }
  let bestN = 0
  let best = null as { tr: number; tg: number; tb: number; n: number } | null
  for (const val of groups.values()) {
    if (val.n > bestN) { bestN = val.n; best = val }
  }
  if (!best) return bucketAverage(b)
  return [Math.round(best.tr / best.n), Math.round(best.tg / best.n), Math.round(best.tb / best.n)]
}

function bucketColorRange(b: Bucket): [number, number, number] {
  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0
  for (let i = 0; i < b.pixels.length; i += 3) {
    const r = b.pixels[i], g = b.pixels[i + 1], bb = b.pixels[i + 2]
    if (r < minR) minR = r; if (r > maxR) maxR = r
    if (g < minG) minG = g; if (g > maxG) maxG = g
    if (bb < minB) minB = bb; if (bb > maxB) maxB = bb
  }
  return [maxR - minR, maxG - minG, maxB - minB]
}

function splitBucket(b: Bucket): [Bucket, Bucket] {
  const [rangeR, rangeG, rangeB] = bucketColorRange(b)
  // Split along the channel with the largest range
  let ch = 0
  if (rangeG >= rangeR && rangeG >= rangeB) ch = 1
  else if (rangeB >= rangeR && rangeB >= rangeG) ch = 2

  // Sort pixels by the chosen channel
  const arr = b.pixels
  const n = b.count
  // Simple insertion sort for small arrays, otherwise use a buffer
  const indices = Array.from({ length: n }, (_, i) => i)
  indices.sort((a, b) => arr[a * 3 + ch] - arr[b * 3 + ch])

  const mid = n >> 1
  const p1 = new Uint8Array(mid * 3)
  const p2 = new Uint8Array((n - mid) * 3)
  for (let i = 0; i < mid; i++) {
    const src = indices[i] * 3
    p1[i * 3] = arr[src]; p1[i * 3 + 1] = arr[src + 1]; p1[i * 3 + 2] = arr[src + 2]
  }
  for (let i = mid; i < n; i++) {
    const src = indices[i] * 3
    const j = i - mid
    p2[j * 3] = arr[src]; p2[j * 3 + 1] = arr[src + 1]; p2[j * 3 + 2] = arr[src + 2]
  }

  return [
    { pixels: p1, count: mid },
    { pixels: p2, count: n - mid },
  ]
}

// Extract dominant color from a block using median cut
function medianCutColor(
  data: Uint8ClampedArray, width: number,
  sx: number, sy: number, ex: number, ey: number
): [number, number, number] {
  const bucket = createBucket(data, width, sx, sy, ex, ey)

  // For very small or uniform blocks, just use average
  if (bucket.count <= 4) return bucketAverage(bucket)

  const [rangeR, rangeG, rangeB] = bucketColorRange(bucket)

  // If block is very uniform (all channels range < 20), use dominant
  if (rangeR < 20 && rangeG < 20 && rangeB < 20) {
    return bucketDominant(bucket)
  }

  // Median cut: split into 2-4 buckets, pick the largest
  let buckets: Bucket[]
  if (rangeR + rangeG + rangeB < 80) {
    // Moderate variance: 2 buckets
    buckets = splitBucket(bucket)
  } else {
    // High variance: 4 buckets (split twice)
    const [b1, b2] = splitBucket(bucket)
    const [range1] = bucketColorRange(b1)
    const [range2] = bucketColorRange(b2)
    if (range1 > 30 && b1.count > 4) {
      const [b1a, b1b] = splitBucket(b1)
      buckets = [b1a, b1b, b2]
    } else if (range2 > 30 && b2.count > 4) {
      const [b2a, b2b] = splitBucket(b2)
      buckets = [b1, b2a, b2b]
    } else {
      buckets = [b1, b2]
    }
  }

  // Pick the bucket with the most pixels
  let bestBucket = buckets[0]
  for (const b of buckets) {
    if (b.count > bestBucket.count) bestBucket = b
  }

  return bucketDominant(bestBucket)
}

// ========== Fast Average ==========

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

// ========== White Detection ==========

function snapToWhite(r: number, g: number, b: number, palette: ColorEntry[]): PixelData | null {
  if (r > 220 && g > 220 && b > 220) {
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    if (lum > 225) {
      const white = palette.find((c) => c.dmc === "A1") ?? palette[0]
      return {
        dmc: white.dmc, colorName: white.name, hex: white.hex,
        r: white.r, g: white.g, b: white.b, textColor: "#000000",
      }
    }
  }
  return null
}

// ========== Color Simplification ==========

function simplifyColors(
  matrix: PixelData[][], cols: number, rows: number, maxColors: number
): PixelData[][] {
  if (maxColors <= 0) return matrix

  const counts = new Map<string, { count: number; sample: PixelData }>()
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const p = matrix[row][col]
      const existing = counts.get(p.dmc)
      if (existing) existing.count++
      else counts.set(p.dmc, { count: 1, sample: p })
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

// ========== Merge Adjacent Same-Color Pixels ==========

function mergeAdjacent(matrix: PixelData[][], cols: number, rows: number): number {
  let merged = 0
  // Horizontal merge
  for (let row = 0; row < rows; row++) {
    for (let col = 1; col < cols; col++) {
      if (matrix[row][col].dmc === matrix[row][col - 1].dmc) merged++
    }
  }
  // Vertical merge
  for (let row = 1; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (matrix[row][col].dmc === matrix[row - 1][col].dmc) merged++
    }
  }
  return merged
}

// ========== Main ==========

self.onmessage = (e: MessageEvent) => {
  const { imageData, pixelSize, palette, quality, maxColors, removeBg } = e.data as WorkerRequest
  const { width, height, data } = imageData

  if (pixelSize <= 0) {
    self.postMessage({ matrix: [], cols: 0, rows: 0 })
    return
  }

  const lut = getLUT(palette)
  const cols = Math.ceil(width / pixelSize)
  const rows = Math.ceil(height / pixelSize)
  const sampler = quality === "detail" ? medianCutColor : sampleAverage
  let matrix: PixelData[][] = []

  for (let row = 0; row < rows; row++) {
    const rowData: PixelData[] = []
    for (let col = 0; col < cols; col++) {
      const sx = col * pixelSize
      const sy = row * pixelSize
      const ex = Math.min(sx + pixelSize, width)
      const ey = Math.min(sy + pixelSize, height)

      const [avgR, avgG, avgB] = sampler(data, width, sx, sy, ex, ey)

      if (removeBg) {
        const whitePixel = snapToWhite(avgR, avgG, avgB, palette)
        if (whitePixel) { rowData.push(whitePixel); continue }
      }

      const color = lookupColor(lut, avgR, avgG, avgB)
      rowData.push({
        dmc: color.dmc, colorName: color.name, hex: color.hex,
        r: color.r, g: color.g, b: color.b, textColor: color.textColor,
      })
    }
    matrix.push(rowData)
  }

  if (maxColors > 0) {
    matrix = simplifyColors(matrix, cols, rows, maxColors)
  }

  const adjacentPairs = mergeAdjacent(matrix, cols, rows)

  self.postMessage({ matrix, cols, rows, adjacentPairs } as WorkerResponse & { adjacentPairs: number })
}
