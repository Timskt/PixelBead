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
  adjacentPairs: number
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

// ========== Nearest Palette Match ==========

function nearestColor(r: number, g: number, b: number, lut: ColorLUT): PixelData {
  const lutEntry = lookupColor(lut, r, g, b)
  return {
    dmc: lutEntry.dmc,
    colorName: lutEntry.name,
    hex: lutEntry.hex,
    r: lutEntry.r,
    g: lutEntry.g,
    b: lutEntry.b,
    textColor: lutEntry.textColor,
  }
}

// ========== White Detection ==========

function isNearWhite(r: number, g: number, b: number): boolean {
  return r > 220 && g > 220 && b > 220 && (0.299 * r + 0.587 * g + 0.114 * b) > 225
}

// ========== Majority Filter (8-connected neighbors) ==========
// If current color has <=2 votes among 8 neighbors AND dominant neighbor has >=4 votes,
// replace current with dominant. Removes speckle noise.
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
        // Replace with the dominant neighbor's full pixel data
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
        const dist = perceptualDist(p.r, p.g, p.b, k.r, k.g, k.b)
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

  const lut = getLUT(palette)
  const cols = Math.ceil(width / pixelSize)
  const rows = Math.ceil(height / pixelSize)

  // Step 1: Resize image to target grid dimensions using canvas
  // This uses the browser's high-quality resampling (anti-aliasing)
  const offscreen = new OffscreenCanvas(cols, rows)
  const ctx = offscreen.getContext("2d")!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  // Draw original image scaled down to grid size
  const srcCanvas = new OffscreenCanvas(width, height)
  const srcCtx = srcCanvas.getContext("2d")!
  srcCtx.putImageData(imageData, 0, 0)
  ctx.drawImage(srcCanvas, 0, 0, cols, rows)

  const downscaled = ctx.getImageData(0, 0, cols, rows)

  // Step 2: Map each pixel to nearest palette color
  let matrix: PixelData[][] = []
  for (let row = 0; row < rows; row++) {
    const rowData: PixelData[] = []
    for (let col = 0; col < cols; col++) {
      const i = (row * cols + col) * 4
      const r = downscaled.data[i]
      const g = downscaled.data[i + 1]
      const b = downscaled.data[i + 2]

      if (removeBg && isNearWhite(r, g, b)) {
        const white = palette.find((c) => c.dmc === "A1") ?? palette[0]
        rowData.push({
          dmc: white.dmc, colorName: white.name, hex: white.hex,
          r: white.r, g: white.g, b: white.b, textColor: "#000000",
        })
        continue
      }

      rowData.push(nearestColor(r, g, b, lut))
    }
    matrix.push(rowData)
  }

  // Step 3: Majority filter (noise reduction) - apply TWICE
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
