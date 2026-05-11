interface Props {
  value: number
  onChange: (value: number) => void
}

export default function PixelSlider({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text">像素大小</span>
        <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
          {value}px
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-light">8</span>
        <input
          type="range"
          min={8}
          max={200}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-xs text-text-light">200</span>
      </div>
    </div>
  )
}
