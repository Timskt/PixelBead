import { useState, useCallback, useRef } from "react"

interface Props {
  onImageLoad: (file: File) => void
  onError: (msg: string) => void
}

export default function ImageUploader({ onImageLoad, onError }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [url, setUrl] = useState("")
  const [urlLoading, setUrlLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const justDropped = useRef(false)

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/") || file.size === 0) {
        onError("请选择图片文件（JPG / PNG / WebP）")
        return
      }
      onImageLoad(file)
    },
    [onImageLoad, onError]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      justDropped.current = true
      setTimeout(() => { justDropped.current = false }, 200)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleClick = useCallback(() => {
    if (justDropped.current) return
    inputRef.current?.click()
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      if (inputRef.current) inputRef.current.value = ""
    },
    [handleFile]
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const file = e.clipboardData.files[0]
      if (file) {
        e.preventDefault()
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleUrlLoad = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    try {
      new URL(trimmed)
    } catch {
      onError("请输入有效的图片 URL")
      return
    }
    setUrlLoading(true)
    try {
      const response = await fetch(trimmed)
      if (!response.ok) throw new Error("下载失败")
      const blob = await response.blob()
      if (!blob.type.startsWith("image/")) {
        throw new Error("链接内容不是图片")
      }
      const ext = blob.type.split("/")[1] || "jpg"
      const file = new File([blob], `url-image.${ext}`, { type: blob.type })
      handleFile(file)
      setUrl("")
    } catch (err) {
      onError(err instanceof Error ? err.message : "加载 URL 失败")
    } finally {
      setUrlLoading(false)
    }
  }, [url, handleFile, onError])

  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleUrlLoad()
    },
    [handleUrlLoad]
  )

  return (
    <div className="space-y-3">
      {/* Drop / Click area */}
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onPaste={handlePaste}
        tabIndex={0}
        className={`
          relative cursor-pointer rounded-2xl border-2 border-dashed
          transition-all duration-200 p-8 text-center outline-none
          ${
            isDragging
              ? "border-primary bg-primary/10 scale-[1.02]"
              : "border-border hover:border-primary/50 hover:bg-primary/5"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleChange}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">{isDragging ? "📥" : "📷"}</span>
          <p className="text-sm text-text-light font-medium">
            {isDragging ? "松开即可上传" : "点击 / 拖拽 / 粘贴图片"}
          </p>
          <p className="text-xs text-text-light/60">支持 JPG / PNG / WebP</p>
        </div>
      </div>

      {/* URL input */}
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleUrlKeyDown}
          placeholder="粘贴图片链接..."
          className="flex-1 text-sm px-4 py-2.5 rounded-full border border-border bg-bg-card outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-light/40"
        />
        <button
          onClick={handleUrlLoad}
          disabled={!url.trim() || urlLoading}
          className="px-5 py-2.5 rounded-full text-sm font-semibold bg-accent2 text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform shadow-sm whitespace-nowrap"
        >
          {urlLoading ? "加载中..." : "🔗 加载"}
        </button>
      </div>
    </div>
  )
}
