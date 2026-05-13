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
  scale: number
  cartoon: boolean
  targetCols: number
  targetRows: number
}

interface WorkerResponse {
  matrix: PixelData[][]
  cols: number
  rows: number
  adjacentPairs: number
}

// ========== Weighted Euclidean (reference formula) ==========
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

// ========== K-Means Auto Palette Extraction (reference algorithm) ==========
function saturation(r: number, g: number, b: number): number {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
}

function autoExtractPalette(data: Uint8ClampedArray, maxColors: number): ColorEntry[] {
  // Step A: Deduplicate & subsample (max ~4000 unique colors)
  const seen = new Set<string>()
  const unique: { r: number; g: number; b: number }[] = []
  const step = Math.max(1, Math.floor(data.length / 4 / 4000))

  for (let i = 0; i < data.length; i += 4 * step) {
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push({ r: data[i], g: data[i + 1], b: data[i + 2] })
    }
  }

  // Step B: Sort by saturation (descending) — prioritize colorful colors
  unique.sort((a, b) => saturation(b.r, b.g, b.b) - saturation(a.r, a.g, a.b))

  // Step C: Greedy selection with distance threshold (RGB dist^2 < 1600)
  const threshold = 1600
  const selected: { r: number; g: number; b: number }[] = []

  for (const c of unique) {
    if (selected.length >= maxColors) break
    let tooClose = false
    for (const s of selected) {
      if ((c.r - s.r) ** 2 + (c.g - s.g) ** 2 + (c.b - s.b) ** 2 < threshold) {
        tooClose = true
        break
      }
    }
    if (!tooClose) selected.push(c)
  }

  // Step D: Fill remaining with lightest/darkest + evenly-spaced
  if (selected.length < maxColors) {
    const remaining = unique.filter((c) =>
      !selected.some((s) => s.r === c.r && s.g === c.g && s.b === c.b)
    )
    remaining.sort((a, b) => (a.r + a.g + a.b) - (b.r + b.g + b.b))
    if (remaining.length > 0) selected.push(remaining[0])           // darkest
    if (remaining.length > 1) selected.push(remaining[remaining.length - 1]) // lightest
    for (let i = 2; i < remaining.length && selected.length < maxColors; i += 10) {
      selected.push(remaining[i])
    }
  }

  // Always include white if not already present
  const hasWhite = selected.some((c) => c.r > 240 && c.g > 240 && c.b > 240)
  if (!hasWhite) selected.push({ r: 255, g: 255, b: 255 })

  if (selected.length === 0 && unique.length > 0) selected.push(unique[0])

  // Step E: K-Means refinement (8 iterations)
  let centroids = selected.map((c) => ({ ...c }))

  for (let iter = 0; iter < 8; iter++) {
    // Assignment: use subsample for speed
    const clusters: { r: number; g: number; b: number }[][] =
      Array.from({ length: centroids.length }, () => [])

    const sampleStep = Math.max(1, Math.floor(unique.length / 2000))
    for (let i = 0; i < unique.length; i += sampleStep) {
      const p = unique[i]
      let minDist = Infinity
      let bestIdx = 0
      for (let j = 0; j < centroids.length; j++) {
        const dist = (p.r - centroids[j].r) ** 2 + (p.g - centroids[j].g) ** 2 + (p.b - centroids[j].b) ** 2
        if (dist < minDist) { minDist = dist; bestIdx = j }
      }
      clusters[bestIdx].push(p)
    }

    // Update: recompute centroids
    const newCentroids: { r: number; g: number; b: number }[] = []
    for (let j = 0; j < centroids.length; j++) {
      const cluster = clusters[j]
      if (cluster.length === 0) { newCentroids.push(centroids[j]); continue }
      let sr = 0, sg = 0, sb = 0
      for (const p of cluster) { sr += p.r; sg += p.g; sb += p.b }
      newCentroids.push({
        r: Math.round(sr / cluster.length),
        g: Math.round(sg / cluster.length),
        b: Math.round(sb / cluster.length),
      })
    }
    centroids = newCentroids
  }

  // Convert to ColorEntry format — keep extracted RGB for display, find nearest DMC for label only
  const dmcColors = COLOR_TABLE
  return centroids.map((c) => {
    let minDist = Infinity
    let nearestDmc = dmcColors[0]
    for (const d of dmcColors) {
      const dist = (c.r - d.r) ** 2 + (c.g - d.g) ** 2 + (c.b - d.b) ** 2
      if (dist < minDist) { minDist = dist; nearestDmc = d }
    }
    // Use extracted color's REAL hex/RGB for display, DMC code for label
    return {
      dmc: nearestDmc.dmc,
      name: nearestDmc.name,
      hex: rgbToHex(c.r, c.g, c.b),
      r: c.r, g: c.g, b: c.b,
    }
  })
}

// ========== Nearest Palette Match (exact) ==========
function nearestColor(r: number, g: number, b: number, palette: ColorEntry[]): PixelData {
  let minDist = Infinity
  let best = palette[0]
  for (const c of palette) {
    const dist = colorDistSq(r, g, b, c.r, c.g, c.b)
    if (dist < minDist) { minDist = dist; best = c }
  }
  const lum = 0.299 * best.r + 0.587 * best.g + 0.114 * best.b
  return {
    dmc: best.dmc, colorName: best.name, hex: best.hex,
    r: best.r, g: best.g, b: best.b,
    textColor: lum > 128 ? "#000000" : "#FFFFFF",
  }
}

// ========== White Detection ==========
function isNearWhite(r: number, g: number, b: number): boolean {
  return r > 220 && g > 220 && b > 220 && (0.299 * r + 0.587 * g + 0.114 * b) > 225
}

// ========== Majority Filter (8-connected, x2) ==========
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
        if (count > maxVotes) { maxVotes = count; dominantDmc = n.dmc }
      }
      const curVotes = votes.get(cur.dmc) || 0
      if (curVotes <= 2 && maxVotes >= 4) {
        out[row][col] = { ...neighbors.find((n) => n.dmc === dominantDmc)! }
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

// ========== Cartoon Style Filter ==========
// Posterize + edge enhancement for cel-shaded look
function applyCartoonFilter(data: ImageData): ImageData {
  const { width, height } = data
  const src = data.data
  const out = new Uint8ClampedArray(src.length)

  // Posterize: reduce each channel to 6 levels
  const levels = 6
  const step = 255 / (levels - 1)
  for (let i = 0; i < src.length; i += 4) {
    out[i] = Math.round(Math.round(src[i] / step) * step)
    out[i + 1] = Math.round(Math.round(src[i + 1] / step) * step)
    out[i + 2] = Math.round(Math.round(src[i + 2] / step) * step)
    out[i + 3] = src[i + 3]
  }

  // Edge detection on posterized image
  const getGray = (x: number, y: number): number => {
    const cx = Math.max(0, Math.min(width - 1, x))
    const cy = Math.max(0, Math.min(height - 1, y))
    const i = (cy * width + cx) * 4
    return 0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2]
  }

  const edges = new Uint8Array(width * height)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = getGray(x - 1, y - 1), tc = getGray(x, y - 1), tr = getGray(x + 1, y - 1)
      const ml = getGray(x - 1, y), mr = getGray(x + 1, y)
      const bl = getGray(x - 1, y + 1), bc = getGray(x, y + 1), br = getGray(x + 1, y + 1)
      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br
      edges[y * width + x] = Math.sqrt(gx * gx + gy * gy) > 30 ? 1 : 0
    }
  }

  // Darken edges
  for (let i = 0; i < edges.length; i++) {
    if (edges[i]) {
      const pi = i * 4
      out[pi] = Math.max(0, out[pi] - 40)
      out[pi + 1] = Math.max(0, out[pi + 1] - 40)
      out[pi + 2] = Math.max(0, out[pi + 2] - 40)
    }
  }

  return new ImageData(out, width, height)
}

// ========== Main Pipeline ==========
self.onmessage = (e: MessageEvent) => {
  const { imageData, pixelSize, palette, quality, maxColors, removeBg, scale, cartoon, targetCols, targetRows } = e.data as WorkerRequest
  let { width, height } = imageData

  if (pixelSize <= 0 && targetCols <= 0) {
    self.postMessage({ matrix: [], cols: 0, rows: 0, adjacentPairs: 0 })
    return
  }

  // Apply cartoon filter before processing
  let processedData = imageData
  if (cartoon) {
    processedData = applyCartoonFilter(imageData)
  }

  // Step 0: Scale image
  let srcData = processedData
  if (scale > 0 && scale < 1) {
    const sw = Math.max(1, Math.round(width * scale))
    const sh = Math.max(1, Math.round(height * scale))
    const scaleCanvas = new OffscreenCanvas(sw, sh)
    const scaleCtx = scaleCanvas.getContext("2d")!
    scaleCtx.imageSmoothingEnabled = true
    scaleCtx.imageSmoothingQuality = "high"
    const srcCanvas = new OffscreenCanvas(width, height)
    srcCanvas.getContext("2d")!.putImageData(srcData, 0, 0)
    scaleCtx.drawImage(srcCanvas, 0, 0, sw, sh)
    srcData = scaleCtx.getImageData(0, 0, sw, sh)
    width = sw
    height = sh
  }

  let cols: number, rows: number

  if (targetCols > 0 && targetRows > 0) {
    // Exact target grid: resize image directly to target dimensions
    cols = targetCols
    rows = targetRows
    const offscreen = new OffscreenCanvas(cols, rows)
    const ctx = offscreen.getContext("2d")!
    ctx.imageSmoothingEnabled = false
    const srcCanvas = new OffscreenCanvas(width, height)
    srcCanvas.getContext("2d")!.putImageData(srcData, 0, 0)
    ctx.drawImage(srcCanvas, 0, 0, cols, rows)
    srcData = ctx.getImageData(0, 0, cols, rows)
    width = cols
    height = rows
  } else {
    // Standard: use pixelSize for grid
    cols = Math.ceil(width / pixelSize)
    rows = Math.ceil(height / pixelSize)
    // Step 1: Canvas resampling
    const offscreen = new OffscreenCanvas(cols, rows)
    const ctx = offscreen.getContext("2d")!
    ctx.imageSmoothingEnabled = false
    const srcCanvas = new OffscreenCanvas(width, height)
    srcCanvas.getContext("2d")!.putImageData(srcData, 0, 0)
    ctx.drawImage(srcCanvas, 0, 0, cols, rows)
    srcData = ctx.getImageData(0, 0, cols, rows)
  }

  const downscaled = srcData

  // Step 2: Determine palette (auto-extract if using "无限制" / all colors)
  let colors: ColorEntry[]
  if (palette.length >= COLOR_TABLE.length && palette.length === COLOR_TABLE.length) {
    // "无限制" / 全部 mode — auto-extract from image for best match
    colors = autoExtractPalette(downscaled.data, maxColors > 0 ? Math.min(maxColors, 30) : 20)
  } else {
    colors = palette
  }

  // Step 3: Per-pixel exact nearest palette match
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

  // Step 4: Majority filter x2
  if (quality === "detail") {
    matrix = majorityFilter(matrix, cols, rows)
    matrix = majorityFilter(matrix, cols, rows)
  }

  // Step 5: Color simplification
  if (maxColors > 0) {
    matrix = simplifyColors(matrix, cols, rows, maxColors)
  }

  const adjacentPairs = mergeAdjacent(matrix, cols, rows)

  self.postMessage({ matrix, cols, rows, adjacentPairs } as WorkerResponse)
}
