import { COLOR_TABLE } from "./colorMap"
import type { ColorEntry } from "./colorMap"

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
  adjacentPairs: number
}

// ========== Weighted Euclidean (reference formula) ==========
// Luminance-adaptive: green 4x, red/blue adjust with average red level
function colorDistSq(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  const avgR = (r1 + r2) / 2
  return ((512 + avgR) * dr * dr >> 8) + 4 * dg * dg + ((768 - avgR) * db * db >> 8)
}

// ========== Nearest Palette Match (exact, no LUT) ==========

function nearestColor(r: number, g: number, b: number, palette: ColorEntry[]): PixelData {
  let minDist = Infinity
  let best = palette[0]
  for (const c of palette) {
    const dist = colorDistSq(r, g, b, c.r, c.g, c.b)
    if (dist < minDist) {
      minDist = dist
      best = c
    }
  }
  return {
    dmc: best.dmc, colorName: best.name, hex: best.hex,
    r: best.r, g: best.g, b: best.b, textColor: "#000000",
  }
}

// ========== White Detection ==========

function isNearWhite(r: number, g: number, b: number): boolean {
  return r > 220 && g > 220 && b > 220 && (0.299 * r + 0.587 * g + 0.114 * b) > 225
}

// ========== Majority Filter (8-connected, reference algorithm) ==========
// If current color has <=2 votes among 8 neighbors AND dominant has >=4 votes, replace
function majorityFilter(
  matrix: PixelData[][], cols: number, rows: number
): PixelData[][] {
  const out = matrix.map((row) => row.map((p) => ({ ...p })))

  for (let row = 1; row < rows - 1; row++) {
    for (let col = 1; col < cols - 1; col++) {
      const cur = matrix[row][col]
      const neighbors = [
        matrix[row - 1][col], matrix[row + 1][col],
        matrix[row][col - 1], matrix[row][col + 1],
        matrix[row - 1][col - 1], matrix[row - 1][col + 1],
        matrix[row + 1][col - 1], matrix[row + 1][col + 1],
      ]

      const votes = new Map<string, number>()
      let maxVotes = 0
      let dominantDmc = cur.dmc

      for (const n of neighbors) {
        const count = (votes.get(n.dmc) || 0) + 1
        votes.set(n.dmc, count)
        if (count > maxVotes) {
          maxVotes = count
          dominantDmc = n.dmc
        }
      }

      const curVotes = votes.get(cur.dmc) || 0
      if (curVotes <= 2 && maxVotes >= 4) {
        const domPixel = neighbors.find((n) => n.dmc === dominantDmc)!
        out[row][col] = { ...domPixel }
      }
    }
  }
  return out
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
        const dist = colorDistSq(p.r, p.g, p.b, k.r, k.g, k.b)
        if (dist < minDist) { minDist = dist; nearest = k }
      }
      return nearest
    })
  )
}

// ========== Merge Adjacent ==========

function mergeAdjacent(matrix: PixelData[][], cols: number, rows: number): number {
  let merged = 0
  for (let row = 0; row < rows; row++)
    for (let col = 1; col < cols; col++)
      if (matrix[row][col].dmc === matrix[row][col - 1].dmc) merged++
  for (let row = 1; row < rows; row++)
    for (let col = 0; col < cols; col++)
      if (matrix[row][col].dmc === matrix[row - 1][col].dmc) merged++
  return merged
}

// ========== Main Pipeline ==========

self.onmessage = (e: MessageEvent) => {
  const { imageData, pixelSize, palette, quality, maxColors, removeBg } = e.data as WorkerRequest
  const { width, height } = imageData

  if (pixelSize <= 0) {
    self.postMessage({ matrix: [], cols: 0, rows: 0, adjacentPairs: 0 })
    return
  }

  const colors = palette.length > 0 ? palette : COLOR_TABLE
  const cols = Math.ceil(width / pixelSize)
  const rows = Math.ceil(height / pixelSize)

  // Step 1: Canvas resampling (browser-quality anti-aliasing)
  const offscreen = new OffscreenCanvas(cols, rows)
  const ctx = offscreen.getContext("2d")!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  const srcCanvas = new OffscreenCanvas(width, height)
  srcCanvas.getContext("2d")!.putImageData(imageData, 0, 0)
  ctx.drawImage(srcCanvas, 0, 0, cols, rows)

  const downscaled = ctx.getImageData(0, 0, cols, rows)

  // Step 2: Per-pixel exact nearest palette match (no LUT)
  let matrix: PixelData[][] = []
  for (let row = 0; row < rows; row++) {
    const rowData: PixelData[] = []
    for (let col = 0; col < cols; col++) {
      const i = (row * cols + col) * 4
      const r = downscaled.data[i]
      const g = downscaled.data[i + 1]
      const b = downscaled.data[i + 2]

      if (removeBg && isNearWhite(r, g, b)) {
        const white = colors.find((c) => c.dmc === "A1") ?? colors[0]
        rowData.push({
          dmc: white.dmc, colorName: white.name, hex: white.hex,
          r: white.r, g: white.g, b: white.b, textColor: "#000000",
        })
        continue
      }

      rowData.push(nearestColor(r, g, b, colors))
    }
    matrix.push(rowData)
  }

  // Step 3: Majority filter x2 (reference algorithm)
  if (quality === "detail") {
    matrix = majorityFilter(matrix, cols, rows)
    matrix = majorityFilter(matrix, cols, rows)
  }

  // Step 4: Color simplification
  if (maxColors > 0) {
    matrix = simplifyColors(matrix, cols, rows, maxColors)
  }

  const adjacentPairs = mergeAdjacent(matrix, cols, rows)

  self.postMessage({ matrix, cols, rows, adjacentPairs } as WorkerResponse)
}
