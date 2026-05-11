import { COLOR_TABLE, buildColorLUT, lookupColor } from "./colorMap"
import type { ColorLUT } from "./colorMap"

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
}

interface WorkerResponse {
  matrix: PixelData[][]
  cols: number
  rows: number
}

let lut: ColorLUT = buildColorLUT(COLOR_TABLE)

self.onmessage = (e: MessageEvent) => {
  const { imageData, pixelSize } = e.data as WorkerRequest
  const { width, height, data } = imageData

  if (pixelSize <= 0) {
    self.postMessage({ matrix: [], cols: 0, rows: 0 })
    return
  }

  const cols = Math.ceil(width / pixelSize)
  const rows = Math.ceil(height / pixelSize)
  const matrix: PixelData[][] = []

  for (let row = 0; row < rows; row++) {
    const rowData: PixelData[] = []
    for (let col = 0; col < cols; col++) {
      const startX = col * pixelSize
      const startY = row * pixelSize
      const endX = Math.min(startX + pixelSize, width)
      const endY = Math.min(startY + pixelSize, height)

      let totalR = 0
      let totalG = 0
      let totalB = 0
      let count = 0

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4
          totalR += data[idx]
          totalG += data[idx + 1]
          totalB += data[idx + 2]
          count++
        }
      }

      const avgR = Math.round(totalR / count)
      const avgG = Math.round(totalG / count)
      const avgB = Math.round(totalB / count)

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

  const response: WorkerResponse = { matrix, cols, rows }
  self.postMessage(response)
}
