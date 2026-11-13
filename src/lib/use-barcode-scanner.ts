'use client'

import { useEffect, useRef } from 'react'
import { looksLikeBarcode, normalizeBarcode } from './barcode'

const MAX_KEY_GAP_MS = 60

function isEditable(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

/**
 * Listens for a barcode gun anywhere on the page (when no text field has focus):
 * a burst of fast keystrokes ending in Enter. Human typing is too slow to trigger it.
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const handler = useRef(onScan)
  useEffect(() => {
    handler.current = onScan
  })

  useEffect(() => {
    if (!enabled) return
    let buffer = ''
    let last = 0

    function onKeyDown(e: KeyboardEvent) {
      if (isEditable(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const now = performance.now()
      if (now - last > MAX_KEY_GAP_MS) buffer = ''
      last = now

      if (e.key === 'Enter') {
        const code = normalizeBarcode(buffer)
        buffer = ''
        if (looksLikeBarcode(code)) {
          e.preventDefault()
          handler.current(code)
        }
        return
      }
      if (e.key.length === 1) buffer += e.key
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}

let audio: AudioContext | null = null

/** Short beep so staff hear that a scan registered (higher pitch = ok, low = problem). */
export function beep(ok = true) {
  try {
    audio ??= new AudioContext()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = ok ? 1500 : 320
    gain.gain.value = 0.08
    osc.connect(gain).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + (ok ? 0.08 : 0.25))
  } catch {
    // Audio unavailable; the visual feedback is enough.
  }
}
