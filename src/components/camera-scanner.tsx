'use client'

import { useEffect, useRef, useState } from 'react'
import { looksLikeBarcode, normalizeBarcode } from '@/lib/barcode'
import { beep } from '@/lib/use-barcode-scanner'

const REPEAT_GUARD_MS = 1500
/** Pause between read attempts. The phone's own detector is cheap, ZXing less so. */
const NATIVE_GAP_MS = 50
const ZXING_GAP_MS = 100
/** ZXing works on a smaller copy of the aiming box; big frames only slow it down. */
const ZXING_MAX_WIDTH = 960

// Only the 1D formats the shop uses: product EAN/UPC codes and our own EAN-13 / Code128.
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }
type DetectorClass = {
  new (options: { formats: string[] }): Detector
  getSupportedFormats(): Promise<string[]>
}
type Decode = (canvas: HTMLCanvasElement) => Promise<string | null>

/** The phone's built-in barcode reader (Android Chrome and others), or null if it has none. */
async function nativeDecoder(): Promise<Decode | null> {
  const Native = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector
  if (!Native) return null
  try {
    const supported = await Native.getSupportedFormats()
    const formats = NATIVE_FORMATS.filter((f) => supported.includes(f))
    if (!formats.includes('ean_13')) return null
    const detector = new Native({ formats })
    return async (canvas) => (await detector.detect(canvas))[0]?.rawValue ?? null
  } catch {
    return null
  }
}

let zxingModules: Promise<[typeof import('@zxing/browser'), typeof import('@zxing/library')]> | undefined
const loadZxing = () => (zxingModules ??= Promise.all([import('@zxing/browser'), import('@zxing/library')]))

async function zxingDecoder(): Promise<Decode> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await loadZxing()
  const hints = new Map<unknown, unknown>([
    [
      DecodeHintType.POSSIBLE_FORMATS,
      [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
      ],
    ],
  ])
  const reader = new BrowserMultiFormatReader(hints as Map<never, unknown>)
  return async (canvas) => {
    try {
      return reader.decodeFromCanvas(canvas).getText()
    } catch {
      return null // nothing found in this frame
    }
  }
}

/**
 * Starts downloading the fallback reader in the background on pages that scan, so the camera
 * opens at once when tapped. Phones with a built-in barcode reader skip the download.
 */
export function usePreloadScanner() {
  useEffect(() => {
    if ((globalThis as { BarcodeDetector?: unknown }).BarcodeDetector) return
    const id = setTimeout(() => void loadZxing().catch(() => {}), 1500)
    return () => clearTimeout(id)
  }, [])
}

/**
 * Full-screen camera barcode reader (phone or tablet). `continuous` keeps the camera
 * open for scanning many items in a row; otherwise it closes after the first read.
 * The same code is ignored for a moment so one box is not counted twice.
 * Only the area inside the yellow aiming box is read, which keeps every attempt fast.
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
  const box = useRef<HTMLDivElement>(null)
  const handler = useRef(onScan)
  const [error, setError] = useState<string | null>(null)
  const [last, setLast] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    handler.current = onScan
  })

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let lastCode = ''
    let lastAt = 0
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    function stop() {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }

    /** Copies the part of the video under the aiming box (plus a margin) to the canvas. */
    function grabAimingBox(maxWidth: number) {
      const v = video.current
      const b = box.current
      if (!v || !b || !ctx || !v.videoWidth) return false
      const vr = v.getBoundingClientRect()
      const br = b.getBoundingClientRect()
      // The video is drawn with object-cover: scaled up and centred, edges cut off.
      const scale = Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight)
      const offX = (vr.width - v.videoWidth * scale) / 2
      const offY = (vr.height - v.videoHeight * scale) / 2
      const marginX = br.width * 0.1
      const marginY = br.height * 0.25
      const sx = Math.max(0, (br.left - vr.left - offX - marginX) / scale)
      const sy = Math.max(0, (br.top - vr.top - offY - marginY) / scale)
      const sw = Math.min(v.videoWidth - sx, (br.width + marginX * 2) / scale)
      const sh = Math.min(v.videoHeight - sy, (br.height + marginY * 2) / scale)
      if (sw <= 0 || sh <= 0) return false
      const shrink = Math.min(1, maxWidth / sw)
      canvas.width = Math.round(sw * shrink)
      canvas.height = Math.round(sh * shrink)
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      return true
    }

    function found(raw: string) {
      const code = normalizeBarcode(raw)
      const now = Date.now()
      if (!looksLikeBarcode(code) || (code === lastCode && now - lastAt < REPEAT_GUARD_MS)) return
      lastCode = code
      lastAt = now
      setLast(code)
      if (!continuous) {
        stop()
        beep(true)
      }
      handler.current(code)
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('ອຸປະກອນນີ້ບໍ່ຮອງຮັບກ້ອງ ຫຼື ເວັບບໍ່ໄດ້ເປີດຜ່ານ HTTPS')
        return
      }
      try {
        // Ask for the camera and pick the reader at the same time.
        const [media, native] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          }),
          nativeDecoder(),
        ])
        stream = media
        if (stopped || !video.current) return stop()

        // Continuous autofocus where the phone allows it; ignored elsewhere.
        const track = media.getVideoTracks()[0]
        const caps = (track.getCapabilities?.() ?? {}) as { focusMode?: string[] }
        if (caps.focusMode?.includes('continuous')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {})
        }

        video.current.srcObject = media
        await video.current.play()
        if (stopped) return
        setReady(true)

        const decode = native ?? (await zxingDecoder())
        const gap = native ? NATIVE_GAP_MS : ZXING_GAP_MS
        const maxWidth = native ? 1920 : ZXING_MAX_WIDTH

        const tick = async () => {
          if (stopped) return
          if (grabAimingBox(maxWidth)) {
            const code = await decode(canvas).catch(() => null)
            if (code && !stopped) found(code)
          }
          if (!stopped) timer = setTimeout(tick, gap)
        }
        tick()
      } catch (e) {
        stop()
        const name = (e as Error).name
        setError(
          name === 'NotAllowedError'
            ? 'ບໍ່ໄດ້ຮັບອະນຸຍາດໃຫ້ໃຊ້ກ້ອງ — ກະລຸນາອະນຸຍາດໃນການຕັ້ງຄ່າ browser'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'ບໍ່ພົບກ້ອງໃນອຸປະກອນນີ້'
              : 'ເປີດກ້ອງບໍ່ໄດ້',
        )
      }
    }

    start()
    return stop
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
        {/* Aiming box: only this area is read. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            ref={box}
            className="h-40 w-[80%] max-w-md rounded-xl border-4 border-butter shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]"
          />
        </div>
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center font-semibold">ກຳລັງເປີດກ້ອງ...</div>
        )}
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
