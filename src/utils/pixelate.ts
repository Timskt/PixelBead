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

const hexCache = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, "0")
)

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${hexCache[r]}${hexCache[g]}${hexCache[b]}`
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

export function pixelateWithWorker(
  imageData: ImageData,
  pixelSize: number
): Promise<PixelateResult> {
  return new Promise((resolve) => {
    const gen = ++jobGeneration
    const w = getWorker()

    const handler = (e: MessageEvent) => {
      if (gen !== jobGeneration) {
        w.removeEventListener("message", handler)
        resolve({ matrix: [], width: 0, height: 0 })
        return
      }
      w.removeEventListener("message", handler)
      const { matrix, cols, rows } = e.data
      resolve({ matrix, width: cols, height: rows })
    }

    w.addEventListener("message", handler)
    w.postMessage({ imageData, pixelSize }, [imageData.data.buffer])
  })
}

export function terminateWorker() {
  if (worker) {
    worker.terminate()
    worker = null
  }
}

export function renderPixelCanvas(
  matrix: PixelData[][],
  pixelSize: number,
  cols: number,
  rows: number,
  displayMode: DisplayMode = "color"
): HTMLCanvasElement {
  if (cols === 0 || rows === 0 || pixelSize <= 0) {
    const empty = document.createElement("canvas")
    empty.width = 1
    empty.height = 1
    return empty
  }

  const canvas = document.createElement("canvas")
  canvas.width = cols * pixelSize
  canvas.height = rows * pixelSize
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pixel = matrix[row][col]
      const x = col * pixelSize
      const y = row * pixelSize

      ctx.fillStyle = pixel.hex
      ctx.fillRect(x, y, pixelSize, pixelSize)

      ctx.strokeStyle = "rgba(0,0,0,0.08)"
      ctx.lineWidth = 0.5
      ctx.strokeRect(x, y, pixelSize, pixelSize)

      const label = displayMode === "dmc" ? pixel.dmc : pixel.colorName
      const fontSize = Math.max(6, Math.floor(pixelSize * 0.4))
      ctx.font = `bold ${fontSize}px "PingFang SC","Noto Sans SC",sans-serif`
      ctx.fillStyle = pixel.textColor
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(label, x + pixelSize / 2, y + pixelSize / 2)
    }
  }

  return canvas
}
