import type { PixelData } from "./pixelate"

export function exportPNG(canvas: HTMLCanvasElement, filename = "pixelbead.png") {
  try {
    const link = document.createElement("a")
    link.download = filename
    link.href = canvas.toDataURL("image/png")
    link.click()
  } catch {
    throw new Error("导出 PNG 失败")
  }
}

export async function copyJSON(matrix: PixelData[][]): Promise<void> {
  const data = matrix.map((row) =>
    row.map((pixel) => ({
      dmc: pixel.dmc,
      color: pixel.colorName,
      hex: pixel.hex,
    }))
  )
  const json = JSON.stringify(data, null, 2)

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(json)
      return
    } catch {
      // fall through to fallback
    }
  }

  const textarea = document.createElement("textarea")
  textarea.value = json
  textarea.style.cssText = "position:fixed;left:-9999px"
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand("copy")
  document.body.removeChild(textarea)
  if (!ok) throw new Error("复制失败，请手动复制")
}

export function getBeadCounts(
  matrix: PixelData[][]
): { dmc: string; name: string; hex: string; count: number }[] {
  const map = new Map<string, { dmc: string; name: string; hex: string; count: number }>()
  for (const row of matrix) {
    for (const pixel of row) {
      const existing = map.get(pixel.dmc)
      if (existing) {
        existing.count++
      } else {
        map.set(pixel.dmc, { dmc: pixel.dmc, name: pixel.colorName, hex: pixel.hex, count: 1 })
      }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}
