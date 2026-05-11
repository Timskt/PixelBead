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
  terminateWorker,
  type PixelateResult,
  type DisplayMode,
} from "./utils/pixelate"
import { getBeadCounts } from "./utils/export"
import { BRAND_PALETTES } from "./utils/colorMap"

const SAMPLE_IMAGES = [
  "https://picsum.photos/seed/bead1/200/200",
  "https://picsum.photos/seed/bead2/200/200",
  "https://picsum.photos/seed/bead3/200/200",
  "https://picsum.photos/seed/bead4/200/200",
  "https://picsum.photos/seed/bead5/200/200",
]

export default function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 })
  const [pixelSize, setPixelSize] = useState(20)
  const [displayMode, setDisplayMode] = useState<DisplayMode>("dmc")
  const [brand, setBrand] = useState("全部")
  const [result, setResult] = useState<PixelateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast, showToast } = useToast()
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastSampleRef = useRef(-1)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const processImage = useCallback(
    (img: HTMLImageElement, size: number, brandName: string) => {
      setLoading(true)
      try {
        const imageData = getImageData(img)
        pixelateWithWorker(imageData, size, brandName).then((res) => {
          setResult(res)
          setLoading(false)
        })
      } catch (err) {
        console.error(err)
        showToast("处理失败，请重试")
        setLoading(false)
      }
    },
    [showToast]
  )

  const handleImageLoad = useCallback(
    async (file: File) => {
      try {
        setLoading(true)
        const img = await loadAndCompressImage(file)
        setImage(img)
        setImageSize({ w: img.width, h: img.height })
        const imageData = getImageData(img)
        const res = await pixelateWithWorker(imageData, pixelSize, brand)
        setResult(res)
        showToast("图片加载成功")
      } catch (err) {
        console.error(err)
        showToast(err instanceof Error ? err.message : "图片加载失败")
      } finally {
        setLoading(false)
      }
    },
    [pixelSize, brand, showToast]
  )

  const handleSliderChange = useCallback(
    (value: number) => {
      setPixelSize(value)
      if (!image) return
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        processImage(image, value, brand)
      }, 250)
    },
    [image, brand, processImage]
  )

  const handleBrandChange = useCallback(
    (newBrand: string) => {
      setBrand(newBrand)
      if (!image) return
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        processImage(image, pixelSize, newBrand)
      }, 150)
    },
    [image, pixelSize, processImage]
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
      const imageData = getImageData(img)
      const res = await pixelateWithWorker(imageData, pixelSize, brand)
      setResult(res)
      showToast("示例图片已加载")
    } catch (err) {
      console.error(err)
      showToast("加载示例失败，请重试")
    } finally {
      setLoading(false)
    }
  }, [pixelSize, brand, showToast])

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current)
      terminateWorker()
    }
  }, [])

  const beadCounts = result && result.width > 0 ? getBeadCounts(result.matrix) : []
  const totalPixels = result ? result.width * result.height : 0
  const brandNames = Object.keys(BRAND_PALETTES)

  return (
    <div className="min-h-dvh bg-bg">
      <div className="max-w-lg mx-auto px-4 pb-8">
        {/* Header */}
        <header className="pt-6 pb-4 text-center">
          <h1 className="text-2xl font-bold text-primary">🎨 PixelBead</h1>
          <p className="text-xs text-text-light mt-1">拼豆像素画生成器</p>
        </header>

        {/* Preview Area */}
        <section className="mb-4">
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
        </section>

        {/* Controls */}
        <section className="mb-4 bg-bg-card rounded-2xl p-4 shadow-sm space-y-3">
          <PixelSlider value={pixelSize} onChange={handleSliderChange} />

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

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text">品牌色板</span>
            <div className="flex bg-bg rounded-full p-0.5 flex-wrap gap-0.5">
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
            <div className="flex items-center justify-between text-xs text-text-light pt-1">
              <span>矩阵: {result.width} × {result.height}</span>
              <span>共 {totalPixels} 个像素 · {beadCounts.length} 种颜色</span>
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
            onRandomSample={handleRandomSample}
            showToast={showToast}
          />
        </section>

        {/* Footer */}
        <footer className="mt-8 pb-safe text-center text-xs text-text-light/40">
          <p>PixelBead · 拼豆像素画生成器</p>
        </footer>
      </div>

      <ToastDisplay toast={toast} />
    </div>
  )
}
