import type { ColorEntry } from "./colorMap"
import { BRAND_PALETTES, COLOR_TABLE } from "./colorMap"

export type DisplayMode = "color" | "dmc"

export interface PixelData {
  dmc: string
  colorName: string
  hex: string
  r: number
  g: number
  b: number
  textColor: string
}

export interface PixelateResult {
  matrix: PixelData[][]
  width: number
  height: number
  adjacentPairs: number
}

export function getBrandColors(brand: string): ColorEntry[] {
  const codes = BRAND_PALETTES[brand] ?? BRAND_PALETTES["全部"]
  return COLOR_TABLE.filter((c) => codes.includes(c.dmc))
}

export function loadAndCompressImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (file.size === 0) {
      reject(new Error("文件为空"))
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const src = e.target?.result
      if (typeof src !== "string") {
        reject(new Error("读取文件失败"))
        return
      }
      const img = new Image()
      img.onload = () => {
        const MAX_SIZE = 2000
        if (img.width > MAX_SIZE || img.height > MAX_SIZE) {
          const ratio = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height)
          const canvas = document.createElement("canvas")
          canvas.width = Math.round(img.width * ratio)
          canvas.height = Math.round(img.height * ratio)
          const ctx = canvas.getContext("2d")
          if (!ctx) { reject(new Error("Canvas 不可用")); return }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const compressed = new Image()
          compressed.onload = () => {
            URL.revokeObjectURL(src)
            resolve(compressed)
          }
          compressed.onerror = () => { URL.revokeObjectURL(src); reject(new Error("压缩图片失败")) }
          compressed.src = canvas.toDataURL("image/png")
        } else {
          resolve(img)
        }
      }
      img.onerror = () => reject(new Error("无法解析图片"))
      img.src = src
    }
    reader.onerror = () => reject(new Error("读取文件失败"))
    reader.readAsDataURL(file)
  })
}

export function getImageData(img: HTMLImageElement): ImageData {
  const canvas = document.createElement("canvas")
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 不可用")
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, img.width, img.height)
}

let worker: Worker | null = null
let jobGeneration = 0

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("./pixelate.worker.ts", import.meta.url),
      { type: "module" }
    )
  }
  return worker
}

export type QualityMode = "fast" | "detail"

export function pixelateWithWorker(
  imageData: ImageData,
  pixelSize: number,
  brand: string = "全部",
  quality: QualityMode = "detail",
  maxColors: number = 0,
  removeBg: boolean = false,
  scale: number = 1
): Promise<PixelateResult> {
  return new Promise((resolve) => {
    const gen = ++jobGeneration
    const w = getWorker()
    const palette = getBrandColors(brand)

    const handler = (e: MessageEvent) => {
      if (gen !== jobGeneration) {
        w.removeEventListener("message", handler)
        resolve({ matrix: [], width: 0, height: 0, adjacentPairs: 0 })
        return
      }
      w.removeEventListener("message", handler)
      const { matrix, cols, rows, adjacentPairs } = e.data
      resolve({ matrix, width: cols, height: rows, adjacentPairs: adjacentPairs ?? 0 })
    }

    w.addEventListener("message", handler)
    w.postMessage({ imageData, pixelSize, palette, quality, maxColors, removeBg, scale }, [imageData.data.buffer])
  })
}

export function renderPixelCanvas(
  matrix: PixelData[][],
  pixelSize: number,
  cols: number,
  rows: number,
  displayMode: DisplayMode = "color",
  hiRes = false,
  showText = true
): HTMLCanvasElement {
  if (cols === 0 || rows === 0 || pixelSize <= 0) {
    const empty = document.createElement("canvas")
    empty.width = 1
    empty.height = 1
    return empty
  }

  const scale = hiRes ? 3 : 1
  const canvas = document.createElement("canvas")
  const logicalW = cols * pixelSize
  const logicalH = rows * pixelSize
  canvas.width = logicalW * scale
  canvas.height = logicalH * scale
  canvas.style.width = logicalW + "px"
  canvas.style.height = logicalH + "px"
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas

  ctx.scale(scale, scale)
  ctx.imageSmoothingEnabled = false

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pixel = matrix[row][col]
      const x = col * pixelSize
      const y = row * pixelSize

      ctx.fillStyle = pixel.hex
      ctx.fillRect(x, y, pixelSize, pixelSize)

      ctx.strokeStyle = "rgba(0,0,0,0.1)"
      ctx.lineWidth = 0.5
      ctx.strokeRect(x, y, pixelSize, pixelSize)

      if (showText) {
        const label = displayMode === "dmc" ? pixel.dmc : pixel.colorName
        const fontSize = Math.max(8, Math.floor(pixelSize * 0.45))
        ctx.font = `bold ${fontSize}px "PingFang SC","Noto Sans SC",sans-serif`
        ctx.fillStyle = pixel.textColor
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        if (pixel.textColor === "#000000") {
          ctx.shadowColor = "rgba(255,255,255,0.5)"
          ctx.shadowBlur = 1
        }
        ctx.fillText(label, x + pixelSize / 2, y + pixelSize / 2)
        ctx.shadowColor = "transparent"
        ctx.shadowBlur = 0
      }
    }
  }

  return canvas
}
