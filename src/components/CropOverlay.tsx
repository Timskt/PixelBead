import { useState, useRef, useCallback, useEffect } from "react"

export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

interface Props {
  imageUrl: string
  onApply: (crop: CropRect) => void
  onCancel: () => void
}

type DragHandle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | null

export default function CropOverlay({ imageUrl, onApply, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<CropRect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })
  const dragRef = useRef<{ handle: DragHandle; startX: number; startY: number; startCrop: CropRect } | null>(null)

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const el = containerRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    }
  }, [])

  const startDrag = useCallback((handle: DragHandle, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const pos = getPos(e)
    dragRef.current = { handle, startX: pos.x, startY: pos.y, startCrop: { ...crop } }
  }, [crop, getPos])

  const onDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragRef.current || !dragRef.current.handle) return
    const pos = getPos(e)
    const { handle, startX, startY, startCrop } = dragRef.current
    if (!handle) return
    const dx = pos.x - startX
    const dy = pos.y - startY

    let { x, y, w, h } = startCrop
    const minSize = 0.05

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
  }, [getPos])

  const endDrag = useCallback(() => { dragRef.current = null }, [])

  useEffect(() => {
    window.addEventListener("mouseup", endDrag)
    window.addEventListener("touchend", endDrag)
    return () => { window.removeEventListener("mouseup", endDrag); window.removeEventListener("touchend", endDrag) }
  }, [endDrag])

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

  const cropPx = imgRef.current ? {
    x: Math.round(crop.x * imgRef.current.naturalWidth),
    y: Math.round(crop.y * imgRef.current.naturalHeight),
    w: Math.round(crop.w * imgRef.current.naturalWidth),
    h: Math.round(crop.h * imgRef.current.naturalHeight),
  } : null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4"
      onMouseMove={onDrag} onTouchMove={onDrag}>
      <div className="text-white text-sm mb-3 font-semibold">拖动选框裁剪图片</div>

      <div ref={containerRef} className="relative max-w-full max-h-[70vh] select-none touch-none">
        <img ref={imgRef} src={imageUrl} alt="Crop" className="max-w-full max-h-[70vh] object-contain pointer-events-none" />

        {/* Dark overlay outside crop */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bg-black/50" style={{ top: 0, left: 0, right: 0, height: `${crop.y * 100}%` }} />
          <div className="absolute bg-black/50" style={{ top: `${(crop.y + crop.h) * 100}%`, left: 0, right: 0, bottom: 0 }} />
          <div className="absolute bg-black/50" style={{ top: `${crop.y * 100}%`, left: 0, width: `${crop.x * 100}%`, height: `${crop.h * 100}%` }} />
          <div className="absolute bg-black/50" style={{ top: `${crop.y * 100}%`, right: 0, width: `${(1 - crop.x - crop.w) * 100}%`, height: `${crop.h * 100}%` }} />
        </div>

        {/* Crop border */}
        <div className="absolute border-2 border-white cursor-move"
          style={{
            left: `${crop.x * 100}%`, top: `${crop.y * 100}%`,
            width: `${crop.w * 100}%`, height: `${crop.h * 100}%`,
          }}
          onMouseDown={(e) => startDrag("move", e)}
          onTouchStart={(e) => startDrag("move", e)} />

        {/* Corner + edge handles */}
        {handles.map((h) => (
          <div key={h.id} className="absolute w-5 h-5 -ml-2.5 -mt-2.5 bg-white border-2 border-primary rounded-full z-10"
            style={{ ...h.style, cursor: h.id.length === 2 ? (h.id === "nw" || h.id === "se" ? "nwse-resize" : "nesw-resize") : (h.id === "n" || h.id === "s" ? "ns-resize" : "ew-resize") }}
            onMouseDown={(e) => startDrag(h.id, e)}
            onTouchStart={(e) => startDrag(h.id, e)} />
        ))}
      </div>

      {/* Size info */}
      {cropPx && (
        <div className="text-white/60 text-xs mt-2">
          {cropPx.w} × {cropPx.h} px
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-4">
        <button onClick={onCancel}
          className="px-6 py-2.5 rounded-full text-sm font-semibold bg-white/20 text-white active:scale-95 transition-transform">
          取消
        </button>
        <button onClick={() => onApply(crop)}
          className="px-6 py-2.5 rounded-full text-sm font-semibold bg-primary text-white active:scale-95 transition-transform shadow-sm">
          应用裁剪
        </button>
      </div>
    </div>
  )
}
