interface Props {
  counts: { dmc: string; name: string; hex: string; count: number }[]
  totalPixels: number
}

export default function BeadSummary({ counts, totalPixels }: Props) {
  if (counts.length === 0) return null

  return (
    <details className="bg-bg-card rounded-2xl shadow-sm overflow-hidden group">
      <summary className="p-4 cursor-pointer flex items-center justify-between select-none">
        <span className="text-sm font-semibold text-text">
          🧵 拼豆用量清单
        </span>
        <span className="text-xs text-text-light">
          {counts.length} 种颜色 · {totalPixels} 颗
          <span className="ml-1 inline-block transition-transform group-open:rotate-90">▶</span>
        </span>
      </summary>
      <div className="px-4 pb-4">
        <div className="grid gap-1.5 max-h-64 overflow-y-auto">
          {counts.map((c) => (
            <div
              key={c.dmc}
              className="flex items-center gap-3 text-sm py-1.5 px-3 rounded-lg bg-bg"
            >
              <span
                className="w-5 h-5 rounded-sm border border-black/10 flex-shrink-0"
                style={{ backgroundColor: c.hex }}
              />
              <span className="font-bold text-primary w-8">{c.dmc}</span>
              <span className="text-text-light flex-1">{c.name}</span>
              <span className="font-mono text-text font-semibold">{c.count}</span>
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}
