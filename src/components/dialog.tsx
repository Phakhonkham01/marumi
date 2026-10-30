'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type Tone = 'success' | 'error' | 'warning' | 'info'

type DialogOptions = {
  title: string
  message?: ReactNode
  tone?: Tone
  okLabel?: string
  cancelLabel?: string
  /** Paints the OK button red, for deletes and cancellations. */
  danger?: boolean
}

type Request = DialogOptions & { kind: 'alert' | 'confirm'; resolve: (ok: boolean) => void }

type DialogApi = {
  alert: (options: DialogOptions) => Promise<void>
  confirm: (options: DialogOptions) => Promise<boolean>
}

const DialogContext = createContext<DialogApi | null>(null)

const TONE: Record<Tone, { icon: string; ring: string }> = {
  success: { icon: '✓', ring: 'bg-success/15 text-success' },
  error: { icon: '✕', ring: 'bg-danger/15 text-danger' },
  warning: { icon: '!', ring: 'bg-butter text-navy' },
  info: { icon: 'i', ring: 'bg-mist text-navy' },
}

/** Popup modal for results and confirmations. Requests queue, so nothing is lost when two fire at once. */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Request[]>([])
  const ref = useRef<HTMLDialogElement>(null)
  const current = queue[0]

  useEffect(() => {
    const el = ref.current
    if (current && el && !el.open) el.showModal()
  }, [current])

  const close = useCallback(
    (ok: boolean) => {
      if (!current) return
      current.resolve(ok)
      ref.current?.close()
      setQueue((q) => q.slice(1))
    },
    [current],
  )

  const api = useMemo<DialogApi>(
    () => ({
      alert: (options) =>
        new Promise((resolve) => setQueue((q) => [...q, { ...options, kind: 'alert', resolve: () => resolve() }])),
      confirm: (options) =>
        new Promise((resolve) => setQueue((q) => [...q, { ...options, kind: 'confirm', resolve }])),
    }),
    [],
  )

  const tone = TONE[current?.tone ?? (current?.kind === 'confirm' ? 'warning' : 'info')]

  return (
    <DialogContext.Provider value={api}>
      {children}
      <dialog
        ref={ref}
        // Esc closes the native dialog; treat it as "cancel".
        onCancel={(e) => {
          e.preventDefault()
          close(false)
        }}
        onClick={(e) => e.target === e.currentTarget && close(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-[var(--radius-card)] border-[1.5px] border-line bg-white p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        {current && (
          <div className="space-y-4 p-6 text-center">
            <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold ${tone.ring}`}>
              {tone.icon}
            </span>
            <div className="space-y-1">
              <p className="text-lg font-bold text-navy">{current.title}</p>
              {current.message && <div className="text-sm text-muted">{current.message}</div>}
            </div>
            <div className="flex gap-2">
              {current.kind === 'confirm' && (
                <button className="btn btn-ghost flex-1" onClick={() => close(false)}>
                  {current.cancelLabel ?? 'ຍົກເລີກ'}
                </button>
              )}
              <button
                autoFocus
                className={`btn flex-1 ${current.danger ? 'bg-danger text-white hover:opacity-90' : 'btn-primary'}`}
                onClick={() => close(true)}
              >
                {current.okLabel ?? 'ຕົກລົງ'}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </DialogContext.Provider>
  )
}

export function useDialog() {
  const api = useContext(DialogContext)
  if (!api) throw new Error('useDialog must be used inside <DialogProvider>')
  return api
}
