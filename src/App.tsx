import { useState, useCallback, useRef, useEffect } from "react"
import ImageUploader from "./components/ImageUploader"
import PixelSlider from "./components/PixelSlider"
import PixelCanvas from "./components/PixelCanvas"
import ActionBar from "./components/ActionBar"
import BeadSummary from "./components/BeadSummary"
import Loading from "./components/Loading"
import { useToast, ToastDisplay } from "./components/Toast"
import {
  loadAndCompressImage,
  getImageData,
  pixelateWithWorker,
  type PixelateResult,
  type DisplayMode,
  type QualityMode,
} from "./utils/pixelate"
import { getBeadCounts } from "./utils/export"
import { BRAND_PALETTES } from "./utils/colorMap"

const SAMPLE_IMAGES = [
  "https://picsum.photos/seed/bead1/300/300",
  "https://picsum.photos/seed/bead2/300/300",
  "https://picsum.photos/seed/bead3/300/300",
  "https://picsum.photos/seed/bead4/300/300",
  "https://picsum.photos/seed/bead5/300/300",
]

const GRID_PRESETS = [
  { label: "20", value: 20 },
  { label: "30", value: 30 },
  { label: "40", value: 40 },
  { label: "58", value: 58 },
  { label: "80", value: 80 },
  { label: "100", value: 100 },
  { label: "150", value: 150 },
  { label: "不限", value: 0 },
]

const COLOR_LIMITS = [
  { label: "8", value: 8 },
  { label: "12", value: 12 },
  { label: "20", value: 20 },
  { label: "30", value: 30 },
  { label: "不限", value: 0 },
]

const BEAD_SIZES = [
  { label: "标准 2.6mm", value: 2.6 },
  { label: "迷你 2.0mm", value: 2.0 },
  { label: "Midi 2.8mm", value: 2.8 },
  { label: "大颗 5.0mm", value: 5.0 },
]

function calcPixelSize(imgW: number, imgH: number, maxGrid: number): number {
  if (maxGrid <= 0) return 20
  const raw = Math.max(imgW, imgH) / maxGrid
  return Math.max(1, Math.min(500, Math.round(raw)))
}

// Encode settings to URL hash
function encodeSettings(s: Record<string, string | number | boolean>): string {
  return Object.entries(s)
    .filter(([, v]) => v !== undefined && v !== "" && v !== false)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&")
}

function decodeSettings(hash: string): Record<string, string> {
  if (!hash.startsWith("#")) return {}
  const params: Record<string, string> = {}
  for (const pair of hash.slice(1).split("&")) {
    const [k, v] = pair.split("=")
    if (k && v) params[k] = decodeURIComponent(v)
  }
  return params
}

export default function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 })
  const [pixelSize, setPixelSize] = useState(20)
  const [maxGrid, setMaxGrid] = useState(40)
  const [quality, setQuality] = useState<QualityMode>("detail")
  const [maxColors, setMaxColors] = useState(0)
  const [beadSize, setBeadSize] = useState(2.6)
  const [removeBg, setRemoveBg] = useState(false)
  const [displayMode, setDisplayMode] = useState<DisplayMode>("dmc")
  const [brand, setBrand] = useState("全部")
  const [result, setResult] = useState<PixelateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const { toast, showToast } = useToast()
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastSampleRef = useRef(-1)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const originalUrlRef = useRef<string>("")
  const appRef = useRef<HTMLDivElement>(null)

  const processImage = useCallback(
    (img: HTMLImageElement, size: number) => {
      setLoading(true)
      try {
        const imageData = getImageData(img)
        pixelateWithWorker(imageData, size, brand, quality, maxColors, removeBg).then((res) => {
          setResult(res)
          setLoading(false)
        })
      } catch (err) {
        console.error(err)
        showToast("处理失败，请重试")
        setLoading(false)
      }
    },
    [brand, quality, maxColors, removeBg, showToast]
  )

  const handleImageLoad = useCallback(
    async (file: File) => {
      try {
        setLoading(true)
        const img = await loadAndCompressImage(file)
        setImage(img)
        setImageSize({ w: img.width, h: img.height })
        // Store original for compare mode
        const tempCanvas = document.createElement("canvas")
        tempCanvas.width = img.width
        tempCanvas.height = img.height
        const tempCtx = tempCanvas.getContext("2d")!
        tempCtx.drawImage(img, 0, 0)
        originalUrlRef.current = tempCanvas.toDataURL("image/jpeg", 0.8)

        const autoSize = maxGrid > 0
          ? calcPixelSize(img.width, img.height, maxGrid)
          : pixelSize
        setPixelSize(autoSize)
        const imageData = getImageData(img)
        const res = await pixelateWithWorker(imageData, autoSize, brand, quality, maxColors, removeBg)
        setResult(res)
        showToast(`图片加载成功 · ${autoSize}px`)
      } catch (err) {
        console.error(err)
        showToast(err instanceof Error ? err.message : "图片加载失败")
      } finally {
        setLoading(false)
      }
    },
    [pixelSize, maxGrid, brand, quality, maxColors, removeBg, showToast]
  )

  const handleSliderChange = useCallback(
    (value: number) => {
      setPixelSize(value)
      setMaxGrid(0)
      if (!image) return
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => processImage(image, value), 250)
    },
    [image, processImage]
  )

  const handleGridPreset = useCallback(
    (grid: number) => {
      setMaxGrid(grid)
      if (!image || grid <= 0) return
      const autoSize = calcPixelSize(image.width, image.height, grid)
      setPixelSize(autoSize)
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => processImage(image, autoSize), 150)
    },
    [image, processImage]
  )

  const reprocess = useCallback(() => {
    if (!image) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => processImage(image, pixelSize), 150)
  }, [image, pixelSize, processImage])

  const handleBrandChange = useCallback(
    (newBrand: string) => { setBrand(newBrand); reprocess() },
    [reprocess]
  )
  const handleQualityChange = useCallback(
    (q: QualityMode) => { setQuality(q); reprocess() },
    [reprocess]
  )
  const handleMaxColorsChange = useCallback(
    (n: number) => { setMaxColors(n); reprocess() },
    [reprocess]
  )
  const handleRemoveBgChange = useCallback(
    (v: boolean) => { setRemoveBg(v); reprocess() },
    [reprocess]
  )

  const handleRandomSample = useCallback(async () => {
    try {
      setLoading(true)
      let idx: number
      do {
        idx = Math.floor(Math.random() * SAMPLE_IMAGES.length)
      } while (idx === lastSampleRef.current && SAMPLE_IMAGES.length > 1)
      lastSampleRef.current = idx

      const response = await fetch(SAMPLE_IMAGES[idx])
      if (!response.ok) throw new Error("网络请求失败")
      const blob = await response.blob()
      const file = new File([blob], "sample.jpg", { type: "image/jpeg" })
      const img = await loadAndCompressImage(file)
      setImage(img)
      setImageSize({ w: img.width, h: img.height })
      const tempCanvas = document.createElement("canvas")
      tempCanvas.width = img.width
      tempCanvas.height = img.height
      tempCanvas.getContext("2d")!.drawImage(img, 0, 0)
      originalUrlRef.current = tempCanvas.toDataURL("image/jpeg", 0.8)

      const autoSize = maxGrid > 0
        ? calcPixelSize(img.width, img.height, maxGrid)
        : pixelSize
      setPixelSize(autoSize)
      const imageData = getImageData(img)
      const res = await pixelateWithWorker(imageData, autoSize, brand, quality, maxColors, removeBg)
      setResult(res)
      showToast("示例图片已加载")
    } catch (err) {
      console.error(err)
      showToast("加载示例失败，请重试")
    } finally {
      setLoading(false)
    }
  }, [pixelSize, maxGrid, brand, quality, maxColors, removeBg, showToast])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in input
      if ((e.target as HTMLElement).tagName === "INPUT") return

      switch (e.key) {
        case "v":
          setCompareMode((prev) => !prev)
          break
        case "r":
          handleRandomSample()
          break
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleRandomSample])

  // Update URL hash with settings
  useEffect(() => {
    const hash = encodeSettings({
      grid: maxGrid, px: pixelSize, q: quality,
      colors: maxColors, bead: beadSize, bg: removeBg ? 1 : 0,
      mode: displayMode, brand,
    })
    history.replaceState(null, "", "#" + hash)
  }, [maxGrid, pixelSize, quality, maxColors, beadSize, removeBg, displayMode, brand])

  // Load settings from URL hash on mount
  useEffect(() => {
    const params = decodeSettings(location.hash)
    if (params.grid) setMaxGrid(Number(params.grid))
    if (params.px) setPixelSize(Number(params.px))
    if (params.q) setQuality(params.q as QualityMode)
    if (params.colors) setMaxColors(Number(params.colors))
    if (params.bead) setBeadSize(Number(params.bead))
    if (params.bg === "1") setRemoveBg(true)
    if (params.mode) setDisplayMode(params.mode as DisplayMode)
    if (params.brand) setBrand(params.brand)
  }, [])

  const beadCounts = result && result.width > 0 ? getBeadCounts(result.matrix) : []
  const totalPixels = result ? result.width * result.height : 0
  const uniqueColors = beadCounts.length
  const brandNames = Object.keys(BRAND_PALETTES)
  const physW = result && result.width > 0 ? (result.width * beadSize / 10).toFixed(1) : "0"
  const physH = result && result.height > 0 ? (result.height * beadSize / 10).toFixed(1) : "0"
  const adjPairs = result?.adjacentPairs ?? 0

  return (
    <div className="min-h-dvh bg-bg" ref={appRef} tabIndex={-1}>
      <div className="max-w-lg mx-auto px-4 pb-8">
        {/* Header */}
        <header className="pt-6 pb-4 text-center">
          <h1 className="text-2xl font-bold text-primary">🎨 PixelBead</h1>
          <p className="text-xs text-text-light mt-1">拼豆像素画生成器</p>
        </header>

        {/* Preview Area */}
        <section className="mb-4 relative">
          {loading ? (
            <div
              className="grid-bg rounded-2xl flex flex-col items-center justify-center"
              style={{
                aspectRatio: imageSize.w > 0 ? `${imageSize.w} / ${imageSize.h}` : "1",
                maxHeight: "70vh",
              }}
            >
              <Loading />
              <p className="text-xs text-text-light mt-2">像素化处理中...</p>
            </div>
          ) : compareMode && originalUrlRef.current ? (
            <div className="grid-bg rounded-2xl overflow-hidden" style={{ maxHeight: "70vh" }}>
              <div className="flex">
                <div className="flex-1 border-r border-border">
                  <p className="text-[10px] text-center text-text-light/60 py-1 bg-bg">原图</p>
                  <img
                    src={originalUrlRef.current}
                    alt="Original"
                    className="w-full object-contain"
                    style={{ maxHeight: "65vh" }}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-center text-text-light/60 py-1 bg-bg">像素画</p>
                  <PixelCanvas
                    result={result}
                    pixelSize={pixelSize}
                    displayMode={displayMode}
                    canvasRef={canvasRef}
                    imageWidth={imageSize.w}
                    imageHeight={imageSize.h}
                  />
                </div>
              </div>
            </div>
          ) : (
            <PixelCanvas
              result={result}
              pixelSize={pixelSize}
              displayMode={displayMode}
              canvasRef={canvasRef}
              imageWidth={imageSize.w}
              imageHeight={imageSize.h}
            />
          )}
          {result && result.width > 0 && (
            <button
              onClick={() => setCompareMode((v) => !v)}
              className={`absolute top-3 left-3 text-xs px-3 py-1.5 rounded-full shadow-sm transition-all ${
                compareMode ? "bg-primary text-white" : "bg-white/90 backdrop-blur-sm text-text-light"
              }`}
            >
              {compareMode ? "退出对比" : "👁 对比原图"}
            </button>
          )}
        </section>

        {/* Controls */}
        <section className="mb-4 bg-bg-card rounded-2xl p-4 shadow-sm space-y-3">
          {/* Grid Size */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text">目标尺寸</span>
            <div className="flex bg-bg rounded-full p-0.5 flex-wrap gap-0.5">
              {GRID_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => handleGridPreset(p.value)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-full transition-all ${
                    maxGrid === p.value ? "bg-primary text-white shadow-sm" : "text-text-light"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <PixelSlider value={pixelSize} onChange={handleSliderChange} />

          {/* Quality + RemoveBg row */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text">画质</span>
            <div className="flex items-center gap-2">
              <div className="flex bg-bg rounded-full p-0.5">
                <button
                  onClick={() => handleQualityChange("fast")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                    quality === "fast" ? "bg-accent1 text-white shadow-sm" : "text-text-light"
                  }`}
                >
                  快速
                </button>
                <button
                  onClick={() => handleQualityChange("detail")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                    quality === "detail" ? "bg-accent1 text-white shadow-sm" : "text-text-light"
                  }`}
                >
                  细节
                </button>
              </div>
              <button
                onClick={() => handleRemoveBgChange(!removeBg)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  removeBg ? "bg-primary text-white shadow-sm" : "bg-bg text-text-light border border-border"
                }`}
              >
                去白底
              </button>
            </div>
          </div>

          {/* Color Limit */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text">颜色数量</span>
            <div className="flex bg-bg rounded-full p-0.5 flex-wrap gap-0.5">
              {COLOR_LIMITS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => handleMaxColorsChange(c.value)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-full transition-all ${
                    maxColors === c.value ? "bg-primary text-white shadow-sm" : "text-text-light"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bead Size */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text">豆子规格</span>
            <div className="flex bg-bg rounded-full p-0.5 flex-wrap gap-0.5">
              {BEAD_SIZES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setBeadSize(s.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                    beadSize === s.value ? "bg-accent2 text-white shadow-sm" : "text-text-light"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Display Mode */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text">显示模式</span>
            <div className="flex bg-bg rounded-full p-0.5">
              <button
                onClick={() => setDisplayMode("dmc")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  displayMode === "dmc" ? "bg-primary text-white shadow-sm" : "text-text-light"
                }`}
              >
                DMC色号
              </button>
              <button
                onClick={() => setDisplayMode("color")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  displayMode === "color" ? "bg-primary text-white shadow-sm" : "text-text-light"
                }`}
              >
                色名
              </button>
            </div>
          </div>

          {/* Brand Palette */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text">品牌色板</span>
            <div className="flex bg-bg rounded-full p-0.5 flex-wrap gap-0.5">
              <button
                onClick={() => handleBrandChange("无限制")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  brand === "无限制" ? "bg-accent2 text-white shadow-sm" : "text-text-light"
                }`}
              >
                无限制
              </button>
              {brandNames.map((b) => (
                <button
                  key={b}
                  onClick={() => handleBrandChange(b)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                    brand === b ? "bg-accent1 text-white shadow-sm" : "text-text-light"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {result && result.width > 0 && (
            <div className="text-xs text-text-light pt-1 space-y-1">
              <div className="flex items-center justify-between">
                <span>矩阵: {result.width} × {result.height}</span>
                <span>{totalPixels} 颗 · {uniqueColors} 种颜色</span>
              </div>
              <div className="flex items-center justify-between">
                <span>实物: {physW} × {physH} cm</span>
                <span>相邻同色: {adjPairs} 对 ({totalPixels > 0 ? Math.round(adjPairs / totalPixels * 100) : 0}% 可合并)</span>
              </div>
            </div>
          )}
        </section>

        {/* Bead Summary */}
        {beadCounts.length > 0 && (
          <section className="mb-4">
            <BeadSummary counts={beadCounts} totalPixels={totalPixels} />
          </section>
        )}

        {/* Upload & Actions */}
        <section className="space-y-3">
          <ImageUploader onImageLoad={handleImageLoad} onError={showToast} />
          <ActionBar
            result={result}
            canvasRef={canvasRef}
            displayMode={displayMode}
            onRandomSample={handleRandomSample}
            showToast={showToast}
          />
        </section>

        {/* Keyboard hints */}
        <div className="mt-4 text-center text-[10px] text-text-light/30 space-x-3">
          <span>V 对比原图</span>
          <span>R 随机示例</span>
          <span>滚轮缩放</span>
          <span>拖动平移</span>
        </div>

        {/* Footer */}
        <footer className="mt-4 pb-safe text-center text-xs text-text-light/40">
          <p>PixelBead · 拼豆像素画生成器</p>
        </footer>
      </div>

      <ToastDisplay toast={toast} />
    </div>
  )
}
