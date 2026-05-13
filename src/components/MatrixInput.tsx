import { useState, useCallback, useRef } from "react"

interface Props {
  value: number
  onApply: (value: number) => void
}

export default function MatrixInput({ value, onApply }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFocus = useCallback(() => {
    setEditing(true)
    setDraft(String(value))
  }, [value])

  const handleBlur = useCallback(() => {
    setEditing(false)
    const n = parseInt(draft, 10)
    if (!isNaN(n) && n >= 1 && n !== value) {
      onApply(n)
    }
  }, [draft, value, onApply])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      inputRef.current?.blur()
    }
  }, [])

  const handleStep = useCallback((delta: number) => {
    const next = Math.max(1, value + delta)
    onApply(next)
  }, [value, onApply])

  return (
    <div className="flex items-center gap-0.5">
      <button onClick={() => handleStep(-1)}
        className="w-5 h-5 flex items-center justify-center text-xs font-bold text-text-light bg-bg rounded hover:bg-primary/10 active:scale-90 transition-all">
        −
      </button>
      <input
        ref={inputRef}
        type="number"
        min={1}
        step={1}
        value={editing ? draft : value}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-14 text-center text-xs font-bold text-primary bg-primary/10 px-1 py-0.5 rounded border-none outline-none focus:ring-1 focus:ring-primary/30"
      />
      <button onClick={() => handleStep(1)}
        className="w-5 h-5 flex items-center justify-center text-xs font-bold text-text-light bg-bg rounded hover:bg-primary/10 active:scale-90 transition-all">
        +
      </button>
    </div>
  )
}
