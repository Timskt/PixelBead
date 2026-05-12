import { useRef, useState, useCallback, useEffect } from "react"
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
  const [zoomDisplay, setZoomDisplay] = useState(100)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  const applyTransform = useCallback(() => {
    if (!transformRef.current) return
    const { x, y } = translateRef.current
    const s = scaleRef.current
    transformRef.current.style.transform = `translate(${x}px,${y}px) scale(${s})`
  }, [])

  // Render canvas when result/pixelSize/displayMode changes
  useEffect(() => {
    if (!result || !canvasRef.current || result.width === 0) return
    const showText = pixelSize >= 8
    const rendered = renderPixelCanvas(
      result.matrix, pixelSize, result.width, result.height, displayMode, true, showText
    )
    const ctx = canvasRef.current.getContext("2d")
    if (!ctx) return
    canvasRef.current.width = rendered.width
    canvasRef.current.height = rendered.height
    canvasRef.current.style.width = rendered.style.width
    canvasRef.current.style.height = rendered.style.height
    ctx.drawImage(rendered, 0, 0)
  }, [result, pixelSize, displayMode, canvasRef])

  // Fit to container when result changes
  useEffect(() => {
    if (!result || result.width === 0 || !containerRef.current) return
    const cw = containerRef.current.clientWidth
    const ch = containerRef.current.clientHeight || cw
    const canvasW = result.width * pixelSize
    const canvasH = result.height * pixelSize
    const fitScale = Math.min(cw / canvasW, ch / canvasH, 1)
    scaleRef.current = fitScale
    translateRef.current = { x: 0, y: 0 }
    applyTransform()
    setZoomDisplay(Math.round(fitScale * 100))
    fittedRef.current = true
  }, [result, pixelSize, applyTransform])

  // Touch events via native listener (non-passive for preventDefault)
  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    ;(containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node

    const onStart = (e: TouchEvent) => {
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

    const onMove = (e: TouchEvent) => {
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
          scaleRef.current = Math.max(0.2, Math.min(5, scaleRef.current * (dist / lastDist.current)))
          applyTransform()
        }
        lastDist.current = dist
      }
    }

    const onEnd = () => {
      isPanningRef.current = false
      lastDist.current = 0
      setZoomDisplay(Math.round(scaleRef.current * 100))
    }

    // Wheel via native listener (non-passive so preventDefault works)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setTooltip(null)
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      scaleRef.current = Math.max(0.2, Math.min(5, scaleRef.current * delta))
      applyTransform()
      setZoomDisplay(Math.round(scaleRef.current * 100))
    }

    node.addEventListener("touchstart", onStart, { passive: true })
    node.addEventListener("touchmove", onMove, { passive: false })
    node.addEventListener("touchend", onEnd)
    node.addEventListener("wheel", onWheel, { passive: false })

    return () => {
      node.removeEventListener("touchstart", onStart)
      node.removeEventListener("touchmove", onMove)
      node.removeEventListener("touchend", onEnd)
      node.removeEventListener("wheel", onWheel)
    }
  }, [applyTransform])

  const resetView = useCallback(() => {
    if (!containerRef.current || !result || result.width === 0) return
    const cw = containerRef.current.clientWidth
    const ch = containerRef.current.clientHeight || cw
    const fitScale = Math.min(cw / (result.width * pixelSize), ch / (result.height * pixelSize), 1)
    scaleRef.current = fitScale
    translateRef.current = { x: 0, y: 0 }
    applyTransform()
    setZoomDisplay(Math.round(fitScale * 100))
    setTooltip(null)
  }, [result, pixelSize, applyTransform])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!result || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const scaleX = canvasRef.current.width / rect.width
      const scaleY = canvasRef.current.height / rect.height
      const col = Math.floor((e.clientX - rect.left) * scaleX / pixelSize)
      const row = Math.floor((e.clientY - rect.top) * scaleY / pixelSize)
      if (row >= 0 && row < result.height && col >= 0 && col < result.width) {
        const pixel = result.matrix[row][col]
        const cRect = containerRef.current?.getBoundingClientRect()
        if (cRect) {
          setTooltip({
            x: e.clientX - cRect.left, y: e.clientY - cRect.top - 10,
            dmc: pixel.dmc, colorName: pixel.colorName, hex: pixel.hex,
          })
        }
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

  const aspectRatio = imageWidth > 0 && imageHeight > 0
    ? `${imageWidth} / ${imageHeight}` : `${result.width} / ${result.height}`

  return (
    <div className="relative">
      <div
        ref={containerCallbackRef}
        className="grid-bg rounded-2xl overflow-hidden relative touch-none"
        style={{ aspectRatio, maxHeight: "70vh" }}
      >
        <div ref={transformRef} className="w-full h-full flex items-center justify-center"
          style={{ transformOrigin: "center center", willChange: "transform" }}>
          <canvas ref={canvasRef} className="max-w-full max-h-full object-contain cursor-crosshair"
            style={{ imageRendering: "pixelated" }} onClick={handleCanvasClick} />
        </div>
      </div>

      {tooltip && (
        <div className="absolute z-10 pointer-events-none bg-text text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%,-100%)" }}>
          <div className="font-bold">{tooltip.dmc} · {tooltip.colorName}</div>
          <div className="opacity-70">{tooltip.hex}</div>
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        <span className="bg-white/80 backdrop-blur-sm text-[10px] text-text-light px-2 py-1 rounded-full">{zoomDisplay}%</span>
        <button onClick={resetView}
          className="bg-white/90 backdrop-blur-sm text-xs text-text-light px-3 py-1.5 rounded-full shadow-sm active:scale-95 transition-transform">
          适应屏幕
        </button>
      </div>
    </div>
  )
}
