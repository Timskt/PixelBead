interface Props {
  value: number
  onChange: (value: number) => void
}

export default function PixelSlider({ value, onChange }: Props) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10)
    if (!isNaN(v)) onChange(Math.max(8, Math.min(200, v)))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text">像素大小</span>
        <input
          type="number"
          min={8}
          max={200}
          value={value}
          onChange={handleInputChange}
          className="w-16 text-center text-sm font-bold text-primary bg-primary/10 px-2 py-1 rounded-full border-none outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-light">8</span>
        <input
          type="range"
          min={8}
          max={200}
          step={2}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-xs text-text-light">200</span>
      </div>
    </div>
  )
}
