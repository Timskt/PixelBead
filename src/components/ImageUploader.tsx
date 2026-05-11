import { useCallback, useRef, useState } from "react"

interface Props {
  onImageLoad: (file: File) => void
}

export default function ImageUploader({ onImageLoad }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return
      onImageLoad(file)
    },
    [onImageLoad]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
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
    inputRef.current?.click()
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative cursor-pointer rounded-2xl border-2 border-dashed
        transition-all duration-200 p-8 text-center
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
        capture="environment"
      />
      <div className="flex flex-col items-center gap-3">
        <span className="text-4xl">{isDragging ? "📥" : "📷"}</span>
        <p className="text-sm text-text-light font-medium">
          {isDragging ? "松开即可上传" : "点击或拖拽图片到这里"}
        </p>
        <p className="text-xs text-text-light/60">支持 JPG / PNG / WebP</p>
      </div>
    </div>
  )
}
