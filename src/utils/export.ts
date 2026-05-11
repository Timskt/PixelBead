import type { PixelData } from "./pixelate"

export function exportPNG(canvas: HTMLCanvasElement, filename = "pixelbead.png") {
  const link = document.createElement("a")
  link.download = filename
  link.href = canvas.toDataURL("image/png")
  link.click()
}

export function copyJSON(matrix: PixelData[][]) {
  const data = matrix.map((row) =>
    row.map((pixel) => ({
      dmc: pixel.dmc,
      color: pixel.colorName,
      hex: pixel.hex,
    }))
  )
  const json = JSON.stringify(data, null, 2)
  return navigator.clipboard.writeText(json)
}
