import { useState, useCallback, useEffect } from "react"

interface ToastState {
  message: string
  visible: boolean
  exiting: boolean
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({ message: "", visible: false, exiting: false })

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true, exiting: false })
  }, [])

  useEffect(() => {
    if (!toast.visible || toast.exiting) return
    const timer = setTimeout(() => {
      setToast((prev) => ({ ...prev, exiting: true }))
    }, 2000)
    return () => clearTimeout(timer)
  }, [toast.visible, toast.exiting])

  useEffect(() => {
    if (!toast.exiting) return
    const timer = setTimeout(() => {
      setToast({ message: "", visible: false, exiting: false })
    }, 300)
    return () => clearTimeout(timer)
  }, [toast.exiting])

  return { toast, showToast }
}

export function ToastDisplay({ toast }: { toast: ToastState }) {
  if (!toast.visible) return null
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
      <div
        className={`bg-text text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-lg whitespace-nowrap ${
          toast.exiting ? "toast-exit" : "toast-enter"
        }`}
      >
        {toast.message}
      </div>
    </div>
  )
}
