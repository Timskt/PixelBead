import { useCallback } from "react"
import type { PixelateResult, DisplayMode } from "../utils/pixelate"
import {
  exportPNG,
  copyJSON,
  exportMaterialCSV,
  exportMaterialTXT,
  exportMaterialImage,
  getBeadCounts,
  renderPatternCanvas,
} from "../utils/export"

interface Props {
  result: PixelateResult | null
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  displayMode: DisplayMode
  onRandomSample: () => void
  showToast: (msg: string) => void
}

export default function ActionBar({
  result, canvasRef, displayMode, onRandomSample, showToast,
}: Props) {
  const hasResult = result && result.width > 0

  const handleExportPNG = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      exportPNG(canvas)
      showToast("PNG 已导出")
    } catch {
      showToast("导出失败")
    }
  }, [canvasRef, showToast])

  const handleExportPattern = useCallback(() => {
    if (!hasResult) return
    try {
      const pattern = renderPatternCanvas(
        result.matrix, 20, result.width, result.height, displayMode
      )
      exportPNG(pattern, "pixelbead-pattern.png")
      showToast("图纸已导出（含行列标号）")
    } catch {
      showToast("导出失败")
    }
  }, [result, displayMode, showToast])

  const handleCopy = useCallback(async () => {
    if (!hasResult) return
    try {
      await copyJSON(result.matrix)
      showToast("JSON 已复制到剪贴板")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "复制失败")
    }
  }, [result, showToast])

  const handleExportCSV = useCallback(() => {
    if (!hasResult) return
    const counts = getBeadCounts(result.matrix)
    exportMaterialCSV(counts)
    showToast("CSV 用料清单已导出")
  }, [result, showToast])

  const handleExportTXT = useCallback(() => {
    if (!hasResult) return
    const counts = getBeadCounts(result.matrix)
    exportMaterialTXT(counts, result.width, result.height)
    showToast("TXT 用料清单已导出")
  }, [result, showToast])

  const handleExportListImage = useCallback(() => {
    if (!hasResult) return
    const counts = getBeadCounts(result.matrix)
    exportMaterialImage(counts, result.width, result.height)
    showToast("用料清单图片已导出")
  }, [result, showToast])

  return (
    <div className="flex flex-col gap-2.5">
      <button
        onClick={onRandomSample}
        className="w-full py-3 rounded-full font-semibold text-sm bg-accent1 text-white active:scale-[0.98] transition-transform shadow-sm"
      >
        🎲 随机示例
      </button>

      {/* Pattern export */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={handleExportPNG}
          disabled={!hasResult}
          className="py-3 rounded-full font-semibold text-sm bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform shadow-sm"
        >
          📥 导出 PNG
        </button>
        <button
          onClick={handleExportPattern}
          disabled={!hasResult}
          className="py-3 rounded-full font-semibold text-sm bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform shadow-sm"
        >
          🗺️ 导出图纸
        </button>
      </div>

      {/* Material list export */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleExportCSV}
          disabled={!hasResult}
          className="py-2.5 rounded-full font-semibold text-xs bg-accent2 text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform shadow-sm"
        >
          📊 清单 CSV
        </button>
        <button
          onClick={handleExportTXT}
          disabled={!hasResult}
          className="py-2.5 rounded-full font-semibold text-xs bg-accent2 text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform shadow-sm"
        >
          📝 清单 TXT
        </button>
        <button
          onClick={handleExportListImage}
          disabled={!hasResult}
          className="py-2.5 rounded-full font-semibold text-xs bg-accent2 text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform shadow-sm"
        >
          🖼️ 清单图片
        </button>
      </div>

      {/* Copy data */}
      <button
        onClick={handleCopy}
        disabled={!hasResult}
        className="py-2.5 rounded-full font-semibold text-xs bg-bg text-text-light border border-border disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
      >
        📋 复制 JSON 数据
      </button>
    </div>
  )
}
