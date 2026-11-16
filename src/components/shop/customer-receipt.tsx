'use client'

import JsBarcode from 'jsbarcode'
import { useEffect, useRef, useState } from 'react'
import { PAYMENT_LABEL, SHOP } from '@/lib/format'
import type { TrackedOrder } from '@/lib/my-orders'

const TZ = 'Asia/Vientiane'
const n = (value: number) => value.toLocaleString('en-US')
const dateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )
const STATUS_TEXT: Record<TrackedOrder['status'], string> = {
  pending: 'ລໍຖ້າຮ້ານຢືນຢັນ',
  confirmed: 'ຮ້ານຢືນຢັນແລ້ວ',
  completed: 'ສຳເລັດ',
  cancelled: 'ຍົກເລີກແລ້ວ',
}
const variantText = (v: string) => (v !== 'ມາດຕະຖານ' ? ` · ${v}` : '')
const pieces = (o: TrackedOrder) => o.items.reduce((s, i) => s + i.qty, 0)

function Row({ left, right, className = '' }: { left: React.ReactNode; right: React.ReactNode; className?: string }) {
  return (
    <p className={`flex justify-between gap-3 ${className}`}>
      <span>{left}</span>
      <span className="shrink-0 text-right">{right}</span>
    </p>
  )
}
const Rule = () => <hr className="my-2 border-0 border-t-[1.5px] border-dashed border-black/50" />

/** The order as a paper receipt, like the one printed at the shop counter. */
export function CustomerReceipt({ order }: { order: TrackedOrder }) {
  const barcode = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (barcode.current) JsBarcode(barcode.current, order.code, { format: 'CODE128', height: 44, width: 1.5, margin: 0, displayValue: false })
  }, [order.code])

  return (
    <div className="drop-shadow-[0_4px_10px_rgba(29,43,72,0.2)]">
      <div className="receipt-paper mx-auto w-full max-w-[360px] bg-white px-5 py-6 text-left text-[13px] leading-snug text-black">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- same plain img the printed receipt uses */}
          <img src="/logo.jpg" alt="" className="mx-auto mb-1 h-14 w-14 rounded-full" />
          <p className="text-lg font-bold">{SHOP.nameLo}</p>
          <p className="font-semibold">{SHOP.name}</p>
          <p className="text-xs">ໂທ {SHOP.phone}</p>
          <p className="mt-2 font-bold">ໃບສັ່ງຊື້ອອນລາຍ</p>
        </div>
        <Rule />
        <div className="space-y-0.5 text-xs">
          <Row left="ລະຫັດອໍເດີ" right={<span className="font-mono font-semibold">{order.code}</span>} />
          <Row left="ວັນທີສັ່ງ" right={dateTime(order.created_at)} />
          <Row left="ສະຖານະ" right={<span className="font-bold">{STATUS_TEXT[order.status]}</span>} />
          <Row left="ການຮັບສິນຄ້າ" right={order.delivery_method === 'pickup' ? 'ຮັບທີ່ຮ້ານ' : 'ຈັດສົ່ງ'} />
        </div>
        <Rule />
        <div className="space-y-1.5">
          {order.items.map((item, i) => (
            <div key={i}>
              <p className="font-semibold">
                {item.product_name}
                <span className="font-normal">{variantText(item.variant_name)}</span>
              </p>
              <Row className="pl-3" left={`${item.qty} x ${n(item.unit_price_lak)}`} right={n(item.qty * item.unit_price_lak)} />
            </div>
          ))}
        </div>
        <Rule />
        <Row left={`ລວມ (${pieces(order)} ຊິ້ນ)`} right={n(order.subtotal_lak)} />
        {order.discount_lak > 0 && <Row left="ສ່ວນຫຼຸດ" right={`-${n(order.discount_lak)}`} />}
        <Row className="pt-1 text-xl font-bold" left="ຍອດຊຳລະ" right={n(order.total_lak)} />
        <p className="text-right text-xs">(ກີບ)</p>
        <Row left="ຊຳລະດ້ວຍ" right={PAYMENT_LABEL[order.payment_method]} />
        <div className="mt-4">
          <svg ref={barcode} className="mx-auto max-w-full" />
        </div>
        <p className="mt-1 text-center font-mono text-xs">{order.code}</p>
        <div className="mt-3 text-center">
          <p className="text-base font-bold">ຂອບໃຈທີ່ອຸດໜູນ!</p>
          <p className="text-xs">ຕິດຕາມອໍເດີ ຫຼື ສອບຖາມ ໂທ {SHOP.phone}</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Saving as a picture. Drawn straight onto a canvas (rather than screenshotting
// the HTML) so it comes out the same on iPhone Safari, Android and desktop.
// ---------------------------------------------------------------------------

const W = 600
const PAD = 40

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** Splits text into lines that fit the width (Lao has no spaces, so break on characters). */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = []
  let line = ''
  for (const ch of Array.from(text)) {
    if (ctx.measureText(line + ch).width > width && line) {
      lines.push(line)
      line = ch.trimStart()
    } else line += ch
  }
  if (line) lines.push(line)
  return lines
}

async function drawReceipt(order: TrackedOrder): Promise<Blob> {
  await document.fonts.ready
  const family = getComputedStyle(document.body).fontFamily
  const logo = await loadImage('/logo.jpg')
  const bars = document.createElement('canvas')
  JsBarcode(bars, order.code, { format: 'CODE128', height: 70, width: 2.4, margin: 0, displayValue: false })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // Pass 1 measures the height, pass 2 draws.
  const layout = (draw: boolean) => {
    let y = 36
    const font = (size: number, weight = 400) => (ctx.font = `${weight} ${size}px ${family}`)
    const center = (text: string, size: number, weight = 400, gap = 1.45) => {
      font(size, weight)
      if (draw) {
        ctx.textAlign = 'center'
        ctx.fillText(text, W / 2, y + size)
      }
      y += size * gap
    }
    const row = (left: string, right: string, size = 20, weight = 400, indent = 0) => {
      font(size, weight)
      const rightWidth = ctx.measureText(right).width
      const lines = wrap(ctx, left, W - PAD * 2 - indent - rightWidth - 16)
      lines.forEach((line, i) => {
        if (draw) {
          ctx.textAlign = 'left'
          ctx.fillText(line, PAD + indent, y + size)
          if (i === 0) {
            ctx.textAlign = 'right'
            ctx.fillText(right, W - PAD, y + size)
          }
        }
        y += size * 1.4
      })
    }
    const rule = () => {
      y += 8
      if (draw) {
        ctx.setLineDash([8, 6])
        ctx.lineWidth = 2
        ctx.strokeStyle = '#555'
        ctx.beginPath()
        ctx.moveTo(PAD, y)
        ctx.lineTo(W - PAD, y)
        ctx.stroke()
        ctx.setLineDash([])
      }
      y += 16
    }

    if (logo) {
      if (draw) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(W / 2, y + 45, 45, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(logo, W / 2 - 45, y, 90, 90)
        ctx.restore()
      }
      y += 100
    }
    center(SHOP.nameLo, 30, 700)
    center(SHOP.name, 22, 600)
    center(`ໂທ ${SHOP.phone}`, 18)
    y += 6
    center('ໃບສັ່ງຊື້ອອນລາຍ', 24, 700)
    rule()
    row('ລະຫັດອໍເດີ', order.code, 19, 600)
    row('ວັນທີສັ່ງ', dateTime(order.created_at), 19)
    row('ສະຖານະ', STATUS_TEXT[order.status], 19, 700)
    row('ການຮັບສິນຄ້າ', order.delivery_method === 'pickup' ? 'ຮັບທີ່ຮ້ານ' : 'ຈັດສົ່ງ', 19)
    rule()
    for (const item of order.items) {
      row(item.product_name + variantText(item.variant_name), '', 21, 600)
      row(`${item.qty} x ${n(item.unit_price_lak)}`, n(item.qty * item.unit_price_lak), 20, 400, 20)
      y += 4
    }
    rule()
    row(`ລວມ (${pieces(order)} ຊິ້ນ)`, n(order.subtotal_lak))
    if (order.discount_lak > 0) row('ສ່ວນຫຼຸດ', `-${n(order.discount_lak)}`)
    y += 4
    row('ຍອດຊຳລະ', `${n(order.total_lak)} ກີບ`, 30, 700)
    row('ຊຳລະດ້ວຍ', PAYMENT_LABEL[order.payment_method], 19)
    y += 20
    if (draw) ctx.drawImage(bars, (W - Math.min(bars.width, W - PAD * 2)) / 2, y, Math.min(bars.width, W - PAD * 2), 70)
    y += 78
    center(order.code, 18)
    y += 10
    center('ຂອບໃຈທີ່ອຸດໜູນ!', 26, 700)
    center(`ຕິດຕາມອໍເດີ ຫຼື ສອບຖາມ ໂທ ${SHOP.phone}`, 17)
    return y + 30
  }

  canvas.width = W
  canvas.height = Math.ceil(layout(false))
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  ctx.textBaseline = 'alphabetic'
  layout(true)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'))
}

/** Saves the receipt as a picture: the phone's share sheet ("Save Image") where available, else a download. */
export function SaveReceiptButton({ order }: { order: TrackedOrder }) {
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const blob = await drawReceipt(order)
      const file = new File([blob], `marumi-${order.code}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `ໃບສັ່ງຊື້ ${order.code}` }).catch(() => {})
      } else {
        const url = URL.createObjectURL(blob)
        const a = Object.assign(document.createElement('a'), { href: url, download: file.name })
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" className="btn btn-ghost w-full bg-white" onClick={save} disabled={busy}>
      {busy ? 'ກຳລັງສ້າງຮູບ...' : '⬇ ບັນທຶກໃບບິນເປັນຮູບ'}
    </button>
  )
}
