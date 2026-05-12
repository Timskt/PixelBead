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

// ========== Edge Detection (Sobel) ==========

function sobelEdgeMap(
  data: Uint8ClampedArray, width: number,
  sx: number, sy: number, ex: number, ey: number
): Uint8Array {
  const bw = ex - sx
  const bh = ey - sy
  const edges = new Uint8Array(bw * bh)

  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const lx = x - sx
      const ly = y - sy

      // Get 3x3 grayscale neighborhood
      const getGray = (px: number, py: number): number => {
        const cx = Math.max(sx, Math.min(ex - 1, px))
        const cy = Math.max(sy, Math.min(ey - 1, py))
        const i = (cy * width + cx) * 4
        return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }

      const tl = getGray(x - 1, y - 1), tc = getGray(x, y - 1), tr = getGray(x + 1, y - 1)
      const ml = getGray(x - 1, y), mr = getGray(x + 1, y)
      const bl = getGray(x - 1, y + 1), bc = getGray(x, y + 1), br = getGray(x + 1, y + 1)

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br
      const mag = Math.sqrt(gx * gx + gy * gy)

      edges[ly * bw + lx] = mag > 40 ? Math.min(255, Math.round(mag)) : 0
    }
  }
  return edges
}

// ========== Median Cut with Edge Awareness ==========

interface Bucket {
  pixels: Uint8Array
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

// Edge-weighted dominant color: edge pixels get 3x influence
function bucketEdgeDominant(b: Bucket, edges: Uint8Array): [number, number, number] {
  const groups = new Map<number, { tr: number; tg: number; tb: number; w: number }>()
  for (let i = 0; i < b.pixels.length; i += 3) {
    const r = b.pixels[i], g = b.pixels[i + 1], bb = b.pixels[i + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (bb >> 4)
    const pxIdx = i / 3
    const edgeWeight = (edges[pxIdx] > 0) ? 3 : 1
    const existing = groups.get(key)
    if (existing) {
      existing.w += edgeWeight; existing.tr += r; existing.tg += g; existing.tb += bb
    } else {
      groups.set(key, { tr: r, tg: g, tb: bb, w: edgeWeight })
    }
  }
  let bestW = 0
  let best = null as { tr: number; tg: number; tb: number; w: number } | null
  for (const val of groups.values()) {
    if (val.w > bestW) { bestW = val.w; best = val }
  }
  if (!best) return bucketAverage(b)
  const n = best.w
  return [Math.round(best.tr / n), Math.round(best.tg / n), Math.round(best.tb / n)]
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
  let ch = 0
  if (rangeG >= rangeR && rangeG >= rangeB) ch = 1
  else if (rangeB >= rangeR && rangeB >= rangeG) ch = 2

  const arr = b.pixels
  const n = b.count
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

  return [{ pixels: p1, count: mid }, { pixels: p2, count: n - mid }]
}

// Edge-aware median cut: use edge map to guide splitting
function medianCutEdgeColor(
  data: Uint8ClampedArray, width: number,
  sx: number, sy: number, ex: number, ey: number,
  edges: Uint8Array, bw: number
): [number, number, number] {
  const bucket = createBucket(data, width, sx, sy, ex, ey)
  if (bucket.count <= 4) return bucketAverage(bucket)

  const [rangeR, rangeG, rangeB] = bucketColorRange(bucket)
  if (rangeR < 15 && rangeG < 15 && rangeB < 15) {
    return bucketEdgeDominant(bucket, edges)
  }

  // Split based on edge direction if there are strong edges
  let hasStrongEdges = false
  let edgeDirX = 0, edgeDirY = 0
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] > 60) {
      hasStrongEdges = true
      const ex = i % bw
      const ey2 = Math.floor(i / bw)
      edgeDirX += ex - bw / 2
      edgeDirY += ey2 - (ey - sy) / 2
    }
  }

  let buckets: Bucket[]
  if (hasStrongEdges && Math.abs(edgeDirX) + Math.abs(edgeDirY) > 5) {
    // Split perpendicular to edge direction
    const splitHorizontal = Math.abs(edgeDirY) > Math.abs(edgeDirX)
    const arr = bucket.pixels
    const n = bucket.count
    const indices = Array.from({ length: n }, (_, i) => i)

    if (splitHorizontal) {
      // Split by Y (top half vs bottom half)
      indices.sort((a, b) => {
        const ay = Math.floor((a * 3) / (bw * 3)) 
        const by = Math.floor((b * 3) / (bw * 3))
        return ay - by
      })
    } else {
      // Split by X (left half vs right half)
      indices.sort((a, b) => (a % bw) - (b % bw))
    }

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
    buckets = [{ pixels: p1, count: mid }, { pixels: p2, count: n - mid }]
  } else {
    // Standard median cut by widest channel
    if (rangeR + rangeG + rangeB < 60) {
      buckets = splitBucket(bucket)
    } else {
      const [b1, b2] = splitBucket(bucket)
      const [r1] = bucketColorRange(b1)
      const [r2] = bucketColorRange(b2)
      if (r1 > 25 && b1.count > 4) {
        const [b1a, b1b] = splitBucket(b1)
        buckets = [b1a, b1b, b2]
      } else if (r2 > 25 && b2.count > 4) {
        const [b2a, b2b] = splitBucket(b2)
        buckets = [b1, b2a, b2b]
      } else {
        buckets = [b1, b2]
      }
    }
  }

  let bestBucket = buckets[0]
  for (const b of buckets) {
    if (b.count > bestBucket.count) bestBucket = b
  }

  return bucketEdgeDominant(bestBucket, edges)
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

// ========== Merge Adjacent ==========

function mergeAdjacent(matrix: PixelData[][], cols: number, rows: number): number {
  let merged = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 1; col < cols; col++) {
      if (matrix[row][col].dmc === matrix[row][col - 1].dmc) merged++
    }
  }
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
    self.postMessage({ matrix: [], cols: 0, rows: 0, adjacentPairs: 0 })
    return
  }

  const lut = getLUT(palette)
  const cols = Math.ceil(width / pixelSize)
  const rows = Math.ceil(height / pixelSize)
  let matrix: PixelData[][] = []

  if (quality === "detail") {
    // Detail mode: edge-aware median cut
    // Pre-compute edge map for the entire image
    const fullEdges = sobelEdgeMap(data, width, 0, 0, width, height)

    for (let row = 0; row < rows; row++) {
      const rowData: PixelData[] = []
      for (let col = 0; col < cols; col++) {
        const sx = col * pixelSize
        const sy = row * pixelSize
        const ex = Math.min(sx + pixelSize, width)
        const ey = Math.min(sy + pixelSize, height)

        // Extract edge sub-map for this block
        const bw = ex - sx
        const bh = ey - sy
        const blockEdges = new Uint8Array(bw * bh)
        for (let y = 0; y < bh; y++) {
          for (let x = 0; x < bw; x++) {
            blockEdges[y * bw + x] = fullEdges[(sy + y) * width + (sx + x)]
          }
        }

        const [avgR, avgG, avgB] = medianCutEdgeColor(data, width, sx, sy, ex, ey, blockEdges, bw)

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
  } else {
    // Fast mode: simple average
    for (let row = 0; row < rows; row++) {
      const rowData: PixelData[] = []
      for (let col = 0; col < cols; col++) {
        const sx = col * pixelSize
        const sy = row * pixelSize
        const ex = Math.min(sx + pixelSize, width)
        const ey = Math.min(sy + pixelSize, height)
        const [avgR, avgG, avgB] = sampleAverage(data, width, sx, sy, ex, ey)

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
  }

  if (maxColors > 0) {
    matrix = simplifyColors(matrix, cols, rows, maxColors)
  }

  const adjacentPairs = mergeAdjacent(matrix, cols, rows)

  self.postMessage({ matrix, cols, rows, adjacentPairs } as WorkerResponse)
}
