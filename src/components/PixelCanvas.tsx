import { useRef, useState, useCallback } from "react"
import type { PixelateResult, DisplayMode } from "../utils/pixelate"
import { renderPixelCanvas } from "../utils/pixelate"

interface Props {
  result: PixelateResult | null
  pixelSize: number
  displayMode: DisplayMode
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  imageWidth: number
  imageHeight: number
}

interface TooltipInfo {
  x: number
  y: number
  dmc: string
  colorName: string
  hex: string
}

export default function PixelCanvas({
  result, pixelSize, displayMode, canvasRef, imageWidth, imageHeight,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1)
  const translateRef = useRef({ x: 0, y: 0 })
  const transformRef = useRef<HTMLDivElement>(null)
  const lastTouch = useRef({ x: 0, y: 0 })
  const lastDist = useRef(0)
  const isPanningRef = useRef(false)
  const fittedRef = useRef(false)
  const [, forceRender] = useState(0)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  const applyTransform = useCallback(() => {
    if (!transformRef.current) return
    const { x, y } = translateRef.current
    const s = scaleRef.current
    transformRef.current.style.transform = `translate(${x}px,${y}px) scale(${s})`
  }, [])

  const renderCanvas = useCallback(() => {
    if (!result || !canvasRef.current || result.width === 0) return
    const rendered = renderPixelCanvas(
      result.matrix, pixelSize, result.width, result.height, displayMode, true
    )
    const ctx = canvasRef.current.getContext("2d")
    if (!ctx) return
    canvasRef.current.width = rendered.width
    canvasRef.current.height = rendered.height
    canvasRef.current.style.width = rendered.style.width
    canvasRef.current.style.height = rendered.style.height
    ctx.drawImage(rendered, 0, 0)
  }, [result, pixelSize, displayMode, canvasRef])

  // Reset fit when result changes
  const prevResultRef = useRef<PixelateResult | null>(null)
  if (result !== prevResultRef.current) {
    prevResultRef.current = result
    fittedRef.current = false
  }

  // Render and fit
  const effectRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  if (result && result.width > 0) {
    clearTimeout(effectRef.current)
    effectRef.current = setTimeout(() => {
      renderCanvas()
      if (!fittedRef.current && containerRef.current) {
        const containerW = containerRef.current.clientWidth
        const containerH = containerRef.current.clientHeight || containerRef.current.clientWidth
        const canvasW = result.width * pixelSize
        const canvasH = result.height * pixelSize
        const fitScale = Math.min(containerW / canvasW, containerH / canvasH, 1)
        scaleRef.current = fitScale
        translateRef.current = { x: 0, y: 0 }
        applyTransform()
        fittedRef.current = true
      }
    }, 0)
  }

  // Touch events via native listener (non-passive)
  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    ;(containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node

    const handleTouchStart = (e: TouchEvent) => {
      setTooltip(null)
      if (e.touches.length === 1) {
        isPanningRef.current = true
        lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      } else if (e.touches.length === 2) {
        isPanningRef.current = false
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastDist.current = Math.sqrt(dx * dx + dy * dy)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1 && isPanningRef.current) {
        const dx = e.touches[0].clientX - lastTouch.current.x
        const dy = e.touches[0].clientY - lastTouch.current.y
        translateRef.current.x += dx
        translateRef.current.y += dy
        lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        applyTransform()
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (lastDist.current > 0) {
          const factor = dist / lastDist.current
          scaleRef.current = Math.max(0.5, Math.min(5, scaleRef.current * factor))
          applyTransform()
        }
        lastDist.current = dist
      }
    }

    const handleTouchEnd = () => {
      isPanningRef.current = false
      lastDist.current = 0
      forceRender((n) => n + 1)
    }

    node.addEventListener("touchstart", handleTouchStart, { passive: true })
    node.addEventListener("touchmove", handleTouchMove, { passive: false })
    node.addEventListener("touchend", handleTouchEnd)

    return () => {
      node.removeEventListener("touchstart", handleTouchStart)
      node.removeEventListener("touchmove", handleTouchMove)
      node.removeEventListener("touchend", handleTouchEnd)
    }
  }, [applyTransform])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    scaleRef.current = Math.max(0.5, Math.min(5, scaleRef.current * delta))
    applyTransform()
    forceRender((n) => n + 1)
  }, [applyTransform])

  const resetView = useCallback(() => {
    if (!containerRef.current || !result || result.width === 0) return
    const containerW = containerRef.current.clientWidth
    const containerH = containerRef.current.clientHeight || containerRef.current.clientWidth
    const canvasW = result.width * pixelSize
    const canvasH = result.height * pixelSize
    const fitScale = Math.min(containerW / canvasW, containerH / canvasH, 1)
    scaleRef.current = fitScale
    translateRef.current = { x: 0, y: 0 }
    applyTransform()
    forceRender((n) => n + 1)
    setTooltip(null)
  }, [result, pixelSize, applyTransform])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!result || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const scaleX = canvasRef.current.width / rect.width
      const scaleY = canvasRef.current.height / rect.height
      const canvasX = (e.clientX - rect.left) * scaleX
      const canvasY = (e.clientY - rect.top) * scaleY
      const col = Math.floor(canvasX / pixelSize)
      const row = Math.floor(canvasY / pixelSize)
      if (row >= 0 && row < result.height && col >= 0 && col < result.width) {
        const pixel = result.matrix[row][col]
        const containerRect = containerRef.current!.getBoundingClientRect()
        setTooltip({
          x: e.clientX - containerRect.left,
          y: e.clientY - containerRect.top - 10,
          dmc: pixel.dmc,
          colorName: pixel.colorName,
          hex: pixel.hex,
        })
      }
    },
    [result, pixelSize, canvasRef]
  )

  // Empty state
  if (!result || result.width === 0) {
    return (
      <div className="grid-bg rounded-2xl aspect-square flex items-center justify-center">
        <div className="text-center text-text-light/50">
          <span className="text-5xl block mb-3">🎨</span>
          <p className="text-sm">上传图片后预览像素画</p>
        </div>
      </div>
    )
  }

  const zoomPercent = Math.round(scaleRef.current * 100)
  const aspectRatio = imageWidth > 0 && imageHeight > 0
    ? `${imageWidth} / ${imageHeight}`
    : `${result.width} / ${result.height}`

  return (
    <div className="relative">
      <div
        ref={containerCallbackRef}
        className="grid-bg rounded-2xl overflow-hidden relative touch-none"
        style={{ aspectRatio, maxHeight: "70vh" }}
        onWheel={handleWheel}
      >
        <div
          ref={transformRef}
          className="w-full h-full flex items-center justify-center"
          style={{ transformOrigin: "center center", willChange: "transform" }}
        >
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full object-contain cursor-crosshair"
            style={{ imageRendering: "pixelated" }}
            onClick={handleCanvasClick}
          />
        </div>
      </div>

      {tooltip && (
        <div
          className="absolute z-10 pointer-events-none bg-text text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%,-100%)" }}
        >
          <div className="font-bold">{tooltip.dmc} · {tooltip.colorName}</div>
          <div className="opacity-70">{tooltip.hex}</div>
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        <span className="bg-white/80 backdrop-blur-sm text-[10px] text-text-light px-2 py-1 rounded-full">
          {zoomPercent}%
        </span>
        <button
          onClick={resetView}
          className="bg-white/90 backdrop-blur-sm text-xs text-text-light px-3 py-1.5 rounded-full shadow-sm active:scale-95 transition-transform"
        >
          适应屏幕
        </button>
      </div>
    </div>
  )
}
