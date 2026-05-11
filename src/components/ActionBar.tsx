import { useCallback } from "react"
import type { PixelateResult } from "../utils/pixelate"
import { exportPNG, copyJSON } from "../utils/export"

interface Props {
  result: PixelateResult | null
  onRandomSample: () => void
  showToast: (msg: string) => void
}

export default function ActionBar({ result, onRandomSample, showToast }: Props) {
  const handleExport = useCallback(() => {
    if (!result) return
    exportPNG(result.canvas)
    showToast("PNG 已导出 ✨")
  }, [result, showToast])

  const handleCopy = useCallback(() => {
    if (!result) return
    copyJSON(result.matrix).then(() => {
      showToast("JSON 已复制到剪贴板 📋")
    })
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
          disabled={!result}
          className="py-3 rounded-full font-semibold text-sm bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform shadow-sm"
        >
          📥 导出 PNG
        </button>
        <button
          onClick={handleCopy}
          disabled={!result}
          className="py-3 rounded-full font-semibold text-sm bg-accent2 text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform shadow-sm"
        >
          📋 复制数据
        </button>
      </div>
    </div>
  )
}
