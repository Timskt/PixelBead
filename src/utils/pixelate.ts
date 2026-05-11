import { getColorName, getDmcCode, getContrastTextColor } from "./colorMap"

export type DisplayMode = "color" | "dmc"

export interface PixelData {
  colorName: string
  dmc: string
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
  canvas: HTMLCanvasElement
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase()
}

export function loadAndCompressImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX_SIZE = 2000
        if (img.width > MAX_SIZE || img.height > MAX_SIZE) {
          const ratio = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height)
          const canvas = document.createElement("canvas")
          canvas.width = Math.round(img.width * ratio)
          canvas.height = Math.round(img.height * ratio)
          const ctx = canvas.getContext("2d")!
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const compressed = new Image()
          compressed.onload = () => resolve(compressed)
          compressed.onerror = reject
          compressed.src = canvas.toDataURL("image/png")
        } else {
          resolve(img)
        }
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function pixelateImage(
  img: HTMLImageElement,
  pixelSize: number
): PixelateResult {
  const srcCanvas = document.createElement("canvas")
  const srcCtx = srcCanvas.getContext("2d")!
  srcCanvas.width = img.width
  srcCanvas.height = img.height
  srcCtx.drawImage(img, 0, 0)

  const cols = Math.ceil(img.width / pixelSize)
  const rows = Math.ceil(img.height / pixelSize)

  const srcData = srcCtx.getImageData(0, 0, img.width, img.height)

  const matrix: PixelData[][] = []

  for (let row = 0; row < rows; row++) {
    const rowData: PixelData[] = []
    for (let col = 0; col < cols; col++) {
      const startX = col * pixelSize
      const startY = row * pixelSize
      const endX = Math.min(startX + pixelSize, img.width)
      const endY = Math.min(startY + pixelSize, img.height)

      let totalR = 0
      let totalG = 0
      let totalB = 0
      let count = 0

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * img.width + x) * 4
          totalR += srcData.data[idx]
          totalG += srcData.data[idx + 1]
          totalB += srcData.data[idx + 2]
          count++
        }
      }

      const avgR = Math.round(totalR / count)
      const avgG = Math.round(totalG / count)
      const avgB = Math.round(totalB / count)

      rowData.push({
        colorName: getColorName(avgR, avgG, avgB),
        dmc: getDmcCode(avgR, avgG, avgB),
        hex: rgbToHex(avgR, avgG, avgB),
        r: avgR,
        g: avgG,
        b: avgB,
        textColor: getContrastTextColor(avgR, avgG, avgB),
      })
    }
    matrix.push(rowData)
  }

  const outCanvas = renderPixelCanvas(matrix, pixelSize, cols, rows)

  return { matrix, width: cols, height: rows, canvas: outCanvas }
}

export function renderPixelCanvas(
  matrix: PixelData[][],
  pixelSize: number,
  cols: number,
  rows: number,
  displayMode: DisplayMode = "color"
): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = cols * pixelSize
  canvas.height = rows * pixelSize
  const ctx = canvas.getContext("2d")!

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
      ctx.font = `bold ${fontSize}px "PingFang SC", "Noto Sans SC", sans-serif`
      ctx.fillStyle = pixel.textColor
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(label, x + pixelSize / 2, y + pixelSize / 2)
    }
  }

  return canvas
}
