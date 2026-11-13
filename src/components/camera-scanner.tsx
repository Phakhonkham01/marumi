'use client'

import { useEffect, useRef, useState } from 'react'
import { looksLikeBarcode, normalizeBarcode } from '@/lib/barcode'
import { beep } from '@/lib/use-barcode-scanner'

const REPEAT_GUARD_MS = 1500

/**
 * Full-screen camera barcode reader (phone or tablet). `continuous` keeps the camera
 * open for scanning many items in a row; otherwise it closes after the first read.
 * The same code is ignored for a moment so one box is not counted twice.
 */
export function CameraScanner({
  onScan,
  onClose,
  continuous = false,
  title = 'ສະແກນດ້ວຍກ້ອງ',
}: {
  onScan: (code: string) => void
  onClose: () => void
  continuous?: boolean
  title?: string
}) {
  const video = useRef<HTMLVideoElement>(null)
  const handler = useRef(onScan)
  const [error, setError] = useState<string | null>(null)
  const [last, setLast] = useState<string | null>(null)

  useEffect(() => {
    handler.current = onScan
  })

  useEffect(() => {
    let stopped = false
    let stop: (() => void) | undefined
    let lastCode = ''
    let lastAt = 0

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('ອຸປະກອນນີ້ບໍ່ຮອງຮັບກ້ອງ ຫຼື ເວັບບໍ່ໄດ້ເປີດຜ່ານ HTTPS')
        return
      }
      try {
        // Loaded on demand so the scanner library never weighs down other pages.
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (stopped || !video.current) return
        const reader = new BrowserMultiFormatReader()
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          video.current,
          (result) => {
            if (!result) return
            const code = normalizeBarcode(result.getText())
            const now = Date.now()
            if (!looksLikeBarcode(code) || (code === lastCode && now - lastAt < REPEAT_GUARD_MS)) return
            lastCode = code
            lastAt = now
            setLast(code)
            if (!continuous) {
              controls.stop()
              beep(true)
            }
            handler.current(code)
          },
        )
        if (stopped) controls.stop()
        else stop = () => controls.stop()
      } catch (e) {
        const name = (e as Error).name
        setError(
          name === 'NotAllowedError'
            ? 'ບໍ່ໄດ້ຮັບອະນຸຍາດໃຫ້ໃຊ້ກ້ອງ — ກະລຸນາອະນຸຍາດໃນການຕັ້ງຄ່າ browser'
            : name === 'NotFoundError'
              ? 'ບໍ່ພົບກ້ອງໃນອຸປະກອນນີ້'
              : 'ເປີດກ້ອງບໍ່ໄດ້',
        )
      }
    }

    start()
    return () => {
      stopped = true
      stop?.()
    }
  }, [continuous])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between bg-navy px-4 py-3">
        <span className="font-bold">{title}</span>
        <button onClick={onClose} className="rounded-lg bg-butter px-4 py-2 font-bold text-navy">
          {continuous ? 'ແລ້ວໆ' : 'ປິດ'}
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} className="h-full w-full object-cover" muted playsInline />
        {/* Aiming box */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-[80%] max-w-md rounded-xl border-4 border-butter shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]" />
        </div>
        {error && (
          <div className="absolute inset-x-4 top-4 rounded-lg bg-danger px-4 py-3 text-center font-semibold">{error}</div>
        )}
      </div>
      <div className="bg-navy px-4 py-3 text-center text-sm">
        {last ? (
          <span>
            ອ່ານໄດ້ຫຼ້າສຸດ: <span className="font-mono font-bold text-butter">{last}</span>
          </span>
        ) : (
          'ເລັງບາໂຄ້ດໃຫ້ຢູ່ໃນກອບສີເຫຼືອງ'
        )}
      </div>
    </div>
  )
}
