import { useCallback } from "react"
import type { PixelateResult } from "../utils/pixelate"
import { exportPNG, copyJSON } from "../utils/export"

interface Props {
  result: PixelateResult | null
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onRandomSample: () => void
  showToast: (msg: string) => void
}

export default function ActionBar({ result, canvasRef, onRandomSample, showToast }: Props) {
  const handleExport = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      exportPNG(canvas)
      showToast("PNG 已导出")
    } catch {
      showToast("导出失败")
    }
  }, [canvasRef, showToast])

  const handleCopy = useCallback(async () => {
    if (!result) return
    try {
      await copyJSON(result.matrix)
      showToast("JSON 已复制到剪贴板")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "复制失败")
    }
  }, [result, showToast])

  return (
    <div className="flex flex-col gap-2.5">
      <button
        onClick={onRandomSample}
        className="w-full py-3 rounded-full font-semibold text-sm bg-accent1 text-white active:scale-[0.98] transition-transform shadow-sm"
      >
        🎲 随机示例
      </button>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={handleExport}
          disabled={!result || result.width === 0}
          className="py-3 rounded-full font-semibold text-sm bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform shadow-sm"
        >
          📥 导出 PNG
        </button>
        <button
          onClick={handleCopy}
          disabled={!result || result.width === 0}
          className="py-3 rounded-full font-semibold text-sm bg-accent2 text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform shadow-sm"
        >
          📋 复制数据
        </button>
      </div>
    </div>
  )
}
