import { useState, useRef, useCallback, useEffect } from "react"

export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

interface Props {
  imageUrl: string
  onApply: (crop: CropRect, polygon?: { x: number; y: number }[]) => void
  onCancel: () => void
}

type DragHandle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | null

export default function CropOverlay({ imageUrl, onApply, onCancel }: Props) {
  const [mode, setMode] = useState<"rect" | "polygon">("rect")
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Rect crop state
  const [crop, setCrop] = useState<CropRect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })
  const dragRef = useRef<{ handle: DragHandle; startX: number; startY: number; startCrop: CropRect } | null>(null)

  // Polygon crop state
  const [polyPoints, setPolyPoints] = useState<{ x: number; y: number }[]>([])
  const [polyPreview, setPolyPreview] = useState<{ x: number; y: number } | null>(null)

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const el = containerRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    let clientX: number, clientY: number
    if ("touches" in e) {
      clientX = e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0
      clientY = e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    }
  }, [])

  // === Rect drag ===
  const startDrag = useCallback((handle: DragHandle, e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== "rect") return
    e.preventDefault()
    e.stopPropagation()
    const pos = getPos(e)
    dragRef.current = { handle, startX: pos.x, startY: pos.y, startCrop: { ...crop } }
  }, [crop, getPos, mode])

  const onDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragRef.current || mode !== "rect") return
    e.preventDefault()
    const pos = getPos(e)
    const { handle, startX, startY, startCrop } = dragRef.current
    if (!handle) return
    const dx = pos.x - startX
    const dy = pos.y - startY
    let { x, y, w, h } = startCrop
    const minSize = 0.03

    if (handle === "move") {
      x = Math.max(0, Math.min(1 - w, startCrop.x + dx))
      y = Math.max(0, Math.min(1 - h, startCrop.y + dy))
    } else {
      if (handle.includes("w")) { x = Math.max(0, startCrop.x + dx); w = startCrop.w - dx }
      if (handle.includes("e")) { w = Math.min(1 - startCrop.x, startCrop.w + dx) }
      if (handle.includes("n")) { y = Math.max(0, startCrop.y + dy); h = startCrop.h - dy }
      if (handle.includes("s")) { h = Math.min(1 - startCrop.y, startCrop.h + dy) }
      w = Math.max(minSize, w)
      h = Math.max(minSize, h)
    }
    setCrop({ x, y, w, h })
  }, [getPos, mode])

  const endDrag = useCallback(() => { dragRef.current = null }, [])

  // === Polygon click ===
  const handlePolyClick = useCallback((e: React.MouseEvent) => {
    if (mode !== "polygon") return
    const pos = getPos(e)

    // Check if clicking near first point to close
    if (polyPoints.length >= 3) {
      const first = polyPoints[0]
      const el = containerRef.current
      if (el) {
        const dist = Math.sqrt((pos.x - first.x) ** 2 + (pos.y - first.y) ** 2)
        if (dist < 0.03) {
          // Close polygon
          setPolyPreview(null)
          return
        }
      }
    }

    setPolyPoints((prev) => [...prev, pos])
  }, [mode, polyPoints, getPos])

  const handlePolyMove = useCallback((e: React.MouseEvent) => {
    if (mode !== "polygon" || polyPoints.length === 0) return
    const pos = getPos(e)
    setPolyPreview(pos)
  }, [mode, polyPoints.length, getPos])

  const resetPoly = useCallback(() => {
    setPolyPoints([])
    setPolyPreview(null)
  }, [])

  useEffect(() => {
    window.addEventListener("mouseup", endDrag)
    window.addEventListener("touchend", endDrag)
    return () => { window.removeEventListener("mouseup", endDrag); window.removeEventListener("touchend", endDrag) }
  }, [endDrag])

  // Rect handles
  const handles = [
    { id: "nw" as const, style: { left: `${crop.x * 100}%`, top: `${crop.y * 100}%` } },
    { id: "ne" as const, style: { left: `${(crop.x + crop.w) * 100}%`, top: `${crop.y * 100}%` } },
    { id: "sw" as const, style: { left: `${crop.x * 100}%`, top: `${(crop.y + crop.h) * 100}%` } },
    { id: "se" as const, style: { left: `${(crop.x + crop.w) * 100}%`, top: `${(crop.y + crop.h) * 100}%` } },
    { id: "n" as const, style: { left: `${(crop.x + crop.w / 2) * 100}%`, top: `${crop.y * 100}%` } },
    { id: "s" as const, style: { left: `${(crop.x + crop.w / 2) * 100}%`, top: `${(crop.y + crop.h) * 100}%` } },
    { id: "w" as const, style: { left: `${crop.x * 100}%`, top: `${(crop.y + crop.h / 2) * 100}%` } },
    { id: "e" as const, style: { left: `${(crop.x + crop.w) * 100}%`, top: `${(crop.y + crop.h / 2) * 100}%` } },
  ]

  const imgW = imgRef.current?.naturalWidth ?? 0
  const imgH = imgRef.current?.naturalHeight ?? 0

  const allPolyPts = polyPreview ? [...polyPoints, polyPreview] : polyPoints

  const handleApply = () => {
    if (mode === "rect") {
      onApply(crop)
    } else if (polyPoints.length >= 3) {
      // Compute bounding box
      const xs = polyPoints.map((p) => p.x)
      const ys = polyPoints.map((p) => p.y)
      const bx = Math.min(...xs)
      const by = Math.min(...ys)
      const bw = Math.max(...xs) - bx
      const bh = Math.max(...ys) - by
      onApply({ x: bx, y: by, w: bw, h: bh }, polyPoints)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4"
      onMouseMove={onDrag} onTouchMove={onDrag}>

      {/* Mode toggle */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-white text-sm font-semibold">裁剪模式</span>
        <div className="flex bg-white/20 rounded-full p-0.5">
          <button onClick={() => setMode("rect")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${mode === "rect" ? "bg-primary text-white" : "text-white/70"}`}>
            ▭ 矩形
          </button>
          <button onClick={() => { setMode("polygon"); resetPoly() }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${mode === "polygon" ? "bg-primary text-white" : "text-white/70"}`}>
            ⬠ 自由形状
          </button>
        </div>
      </div>

      {/* Image container */}
      <div ref={containerRef} className="relative max-w-full max-h-[65vh] select-none touch-none"
        onClick={mode === "polygon" ? handlePolyClick : undefined}
        onMouseMove={mode === "polygon" ? handlePolyMove : undefined}>

        <img ref={imgRef} src={imageUrl} alt="Crop"
          className="max-w-full max-h-[65vh] object-contain pointer-events-none" />

        {/* === RECT MODE === */}
        {mode === "rect" && (
          <>
            {/* Dark overlay outside crop */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute bg-black/50" style={{ top: 0, left: 0, right: 0, height: `${crop.y * 100}%` }} />
              <div className="absolute bg-black/50" style={{ top: `${(crop.y + crop.h) * 100}%`, left: 0, right: 0, bottom: 0 }} />
              <div className="absolute bg-black/50" style={{ top: `${crop.y * 100}%`, left: 0, width: `${crop.x * 100}%`, height: `${crop.h * 100}%` }} />
              <div className="absolute bg-black/50" style={{ top: `${crop.y * 100}%`, right: 0, width: `${(1 - crop.x - crop.w) * 100}%`, height: `${crop.h * 100}%` }} />
            </div>
            {/* Crop border */}
            <div className="absolute border-2 border-white cursor-move"
              style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
              onMouseDown={(e) => startDrag("move", e)} onTouchStart={(e) => startDrag("move", e)} />
            {/* Handles */}
            {handles.map((h) => (
              <div key={h.id} className="absolute w-5 h-5 -ml-2.5 -mt-2.5 bg-white border-2 border-primary rounded-full z-10"
                style={{ ...h.style, cursor: h.id.length === 2 ? (h.id === "nw" || h.id === "se" ? "nwse-resize" : "nesw-resize") : (h.id === "n" || h.id === "s" ? "ns-resize" : "ew-resize") }}
                onMouseDown={(e) => startDrag(h.id, e)} onTouchStart={(e) => startDrag(h.id, e)} />
            ))}
            {/* Size info */}
            {imgW > 0 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                {Math.round(crop.w * imgW)} × {Math.round(crop.h * imgH)}
              </div>
            )}
          </>
        )}

        {/* === POLYGON MODE === */}
        {mode === "polygon" && (
          <>
            {/* SVG overlay for polygon */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: "visible" }}>
              {/* Dark overlay outside polygon */}
              {polyPoints.length >= 3 && (
                <defs>
                  <mask id="polyMask">
                    <rect width="100%" height="100%" fill="white" />
                    <polygon points={polyPoints.map((p) => `${p.x * 100}%,${p.y * 100}%`).join(" ")} fill="black" />
                  </mask>
                </defs>
              )}
              {polyPoints.length >= 3 && (
                <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#polyMask)" />
              )}

              {/* Polygon outline */}
              {allPolyPts.length >= 2 && (
                <polyline
                  points={allPolyPts.map((p) => `${p.x * 100}%,${p.y * 100}%`).join(" ")}
                  fill="none" stroke="white" strokeWidth="2"
                  strokeDasharray={polyPoints.length >= 3 ? "none" : "6,4"}
                />
              )}

              {/* Closing line preview */}
              {polyPoints.length >= 3 && polyPreview && (
                <line
                  x1={`${polyPreview.x * 100}%`} y1={`${polyPreview.y * 100}%`}
                  x2={`${polyPoints[0].x * 100}%`} y2={`${polyPoints[0].y * 100}%`}
                  stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="4,4"
                />
              )}
            </svg>

            {/* Vertex dots */}
            {polyPoints.map((p, i) => (
              <div key={i}
                className={`absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white z-10 ${i === 0 && polyPoints.length >= 3 ? "bg-primary w-5 h-5 -ml-2.5 -mt-2.5" : "bg-white/80"}`}
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} />
            ))}

            {/* Hint */}
            {polyPoints.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-white/60 text-sm bg-black/40 px-4 py-2 rounded-full">点击图片放置顶点，靠近起点闭合</p>
              </div>
            )}
            {polyPoints.length > 0 && polyPoints.length < 3 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white/60 text-[10px] px-2 py-0.5 rounded-full">
                至少 3 个顶点
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-4">
        <button onClick={onCancel}
          className="px-6 py-2.5 rounded-full text-sm font-semibold bg-white/20 text-white active:scale-95 transition-transform">
          取消
        </button>
        {mode === "polygon" && polyPoints.length > 0 && (
          <button onClick={resetPoly}
            className="px-6 py-2.5 rounded-full text-sm font-semibold bg-white/20 text-white active:scale-95 transition-transform">
            重置
          </button>
        )}
        <button onClick={handleApply}
          disabled={mode === "polygon" && polyPoints.length < 3}
          className="px-6 py-2.5 rounded-full text-sm font-semibold bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform shadow-sm">
          应用裁剪
        </button>
      </div>
    </div>
  )
}
