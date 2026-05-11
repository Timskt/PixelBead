import { useRef, useState, useCallback, useEffect } from "react"
import type { PixelateResult, DisplayMode } from "../utils/pixelate"
import { renderPixelCanvas } from "../utils/pixelate"

interface Props {
  result: PixelateResult | null
  pixelSize: number
  displayMode: DisplayMode
}

export default function PixelCanvas({ result, pixelSize, displayMode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPinning] = useState(false)
  const lastTouch = useRef({ x: 0, y: 0 })
  const lastDist = useRef(0)

  useEffect(() => {
    if (!result || !canvasRef.current) return
    const canvas = renderPixelCanvas(
      result.matrix,
      pixelSize,
      result.width,
      result.height,
      displayMode
    )
    const ctx = canvasRef.current.getContext("2d")!
    canvasRef.current.width = canvas.width
    canvasRef.current.height = canvas.height
    ctx.drawImage(canvas, 0, 0)
  }, [result, pixelSize, displayMode])

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        setIsPinning(true)
        lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastDist.current = Math.sqrt(dx * dx + dy * dy)
      }
    },
    []
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1 && isPanning) {
        const dx = e.touches[0].clientX - lastTouch.current.x
        const dy = e.touches[0].clientY - lastTouch.current.y
        setTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
        lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (lastDist.current > 0) {
          const scaleFactor = dist / lastDist.current
          setScale((prev) => Math.max(0.2, Math.min(5, prev * scaleFactor)))
        }
        lastDist.current = dist
      }
    },
    [isPanning]
  )

  const handleTouchEnd = useCallback(() => {
    setIsPinning(false)
    lastDist.current = 0
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((prev) => Math.max(0.2, Math.min(5, prev * delta)))
  }, [])

  const resetView = useCallback(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }, [])

  if (!result) {
    return (
      <div className="grid-bg rounded-2xl aspect-square flex items-center justify-center">
        <div className="text-center text-text-light/50">
          <span className="text-5xl block mb-3">🎨</span>
          <p className="text-sm">上传图片后预览像素画</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="grid-bg rounded-2xl overflow-hidden aspect-square relative touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: isPanning ? "none" : "transform 0.1s ease",
          }}
        >
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
      </div>
      <button
        onClick={resetView}
        className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-xs text-text-light px-3 py-1.5 rounded-full shadow-sm active:scale-95 transition-transform"
      >
        重置视图
      </button>
    </div>
  )
}
