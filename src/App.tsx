import { useState, useCallback, useRef, useEffect } from "react"
import ImageUploader from "./components/ImageUploader"
import PixelSlider from "./components/PixelSlider"
import PixelCanvas from "./components/PixelCanvas"
import ActionBar from "./components/ActionBar"
import Loading from "./components/Loading"
import { useToast, ToastDisplay } from "./components/Toast"
import {
  loadAndCompressImage,
  pixelateImage,
  type PixelateResult,
  type DisplayMode,
} from "./utils/pixelate"

const SAMPLE_IMAGES = [
  "https://picsum.photos/seed/pixel1/200/200",
  "https://picsum.photos/seed/pixel2/200/200",
  "https://picsum.photos/seed/pixel3/200/200",
  "https://picsum.photos/seed/pixel4/200/200",
]

export default function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [pixelSize, setPixelSize] = useState(20)
  const [displayMode, setDisplayMode] = useState<DisplayMode>("dmc")
  const [result, setResult] = useState<PixelateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast, showToast } = useToast()
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const processImage = useCallback(
    (img: HTMLImageElement, size: number) => {
      setLoading(true)
      requestAnimationFrame(() => {
        try {
          const res = pixelateImage(img, size)
          setResult(res)
        } catch {
          showToast("处理失败，请重试")
        } finally {
          setLoading(false)
        }
      })
    },
    [showToast]
  )

  const handleImageLoad = useCallback(
    async (file: File) => {
      try {
        setLoading(true)
        const img = await loadAndCompressImage(file)
        setImage(img)
        processImage(img, pixelSize)
        showToast("图片加载成功 🎉")
      } catch {
        showToast("图片加载失败")
      } finally {
        setLoading(false)
      }
    },
    [pixelSize, processImage, showToast]
  )

  const handleSliderChange = useCallback(
    (value: number) => {
      setPixelSize(value)
      if (!image) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        processImage(image, value)
      }, 80)
    },
    [image, processImage]
  )

  const handleRandomSample = useCallback(async () => {
    try {
      setLoading(true)
      const url = SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)]
      const response = await fetch(url)
      const blob = await response.blob()
      const file = new File([blob], "sample.jpg", { type: "image/jpeg" })
      const img = await loadAndCompressImage(file)
      setImage(img)
      processImage(img, pixelSize)
      showToast("示例图片已加载 🎲")
    } catch {
      showToast("加载示例失败，请重试")
    } finally {
      setLoading(false)
    }
  }, [pixelSize, processImage, showToast])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="min-h-dvh bg-bg">
      <div className="max-w-lg mx-auto px-4 pb-8">
        {/* Header */}
        <header className="pt-6 pb-4 text-center">
          <h1 className="text-2xl font-bold text-primary">
            🎨 PixelBead
          </h1>
          <p className="text-xs text-text-light mt-1">拼豆像素画生成器</p>
        </header>

        {/* Preview Area */}
        <section className="mb-4">
          {loading ? (
            <div className="grid-bg rounded-2xl aspect-square flex flex-col items-center justify-center">
              <Loading />
              <p className="text-xs text-text-light mt-2">像素化处理中...</p>
            </div>
          ) : (
            <PixelCanvas result={result} pixelSize={pixelSize} displayMode={displayMode} />
          )}
        </section>

        {/* Controls */}
        <section className="mb-4 bg-bg-card rounded-2xl p-4 shadow-sm">
          <PixelSlider value={pixelSize} onChange={handleSliderChange} />

          {/* Display Mode Toggle */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-text">显示模式</span>
            <div className="flex bg-bg rounded-full p-0.5">
              <button
                onClick={() => setDisplayMode("color")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  displayMode === "color"
                    ? "bg-primary text-white shadow-sm"
                    : "text-text-light"
                }`}
              >
                色名
              </button>
              <button
                onClick={() => setDisplayMode("dmc")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  displayMode === "dmc"
                    ? "bg-primary text-white shadow-sm"
                    : "text-text-light"
                }`}
              >
                DMC色号
              </button>
            </div>
          </div>

          {result && (
            <div className="mt-3 flex items-center justify-between text-xs text-text-light">
              <span>
                矩阵: {result.width} × {result.height}
              </span>
              <span>
                共 {result.width * result.height} 个像素
              </span>
            </div>
          )}
        </section>

        {/* Upload & Actions */}
        <section className="space-y-3">
          <ImageUploader onImageLoad={handleImageLoad} />
          <ActionBar
            result={result}
            onRandomSample={handleRandomSample}
            showToast={showToast}
          />
        </section>

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-text-light/40">
          <p>PixelBead · 拼豆像素画生成器</p>
        </footer>
      </div>

      <ToastDisplay toast={toast} />
    </div>
  )
}
