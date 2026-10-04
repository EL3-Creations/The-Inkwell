import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type Kind = 'ok' | 'error'
interface Toast { id: number; text: string; kind: Kind }

const ToastContext = createContext<{ toast: (text: string, kind?: Kind) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const nextId = useRef(1)
  const toast = useCallback((text: string, kind: Kind = 'ok') => {
    const id = nextId.current++
    setItems((l) => [...l, { id, text, kind }])
    window.setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), kind === 'error' ? 5000 : 2500)
  }, [])
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto max-w-md rounded-full px-5 py-3 text-base font-semibold shadow-lg ${
              t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-black text-white'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx.toast
}

/** Turn any thrown thing into a readable message. */
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}
