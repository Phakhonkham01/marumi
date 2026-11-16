'use client'

import JsBarcode from 'jsbarcode'
import { useEffect, useRef, useState } from 'react'
import { PrinterIcon } from '@/components/icons'
import { SHOP, PAYMENT_LABEL } from '@/lib/format'
import { fetchReceipt, type ReceiptData } from '@/lib/receipt'
import { createClient } from '@/lib/supabase/client'

const TZ = 'Asia/Vientiane'
const n = (value: number) => value.toLocaleString('en-US')
const date = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
const time = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso))

/** Sets the printer page to 80 mm receipt paper while a receipt is on screen. */
export function ReceiptPageStyle() {
  return <style>{`@page { size: 80mm auto; margin: 0; }`}</style>
}

function CodeBarcode({ value }: { value: string }) {
  const svg = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (svg.current) JsBarcode(svg.current, value, { format: 'CODE128', height: 46, width: 1.5, margin: 0, displayValue: false })
  }, [value])
  return <svg ref={svg} className="mx-auto max-w-full" />
}

function Row({ left, right, className = '' }: { left: React.ReactNode; right: React.ReactNode; className?: string }) {
  return (
    <p className={`flex justify-between gap-3 ${className}`}>
      <span>{left}</span>
      <span className="shrink-0 text-right">{right}</span>
    </p>
  )
}

const Rule = () => <hr className="my-2 border-0 border-t-[1.5px] border-dashed border-black/60" />

/**
 * Paper receipt, 80 mm wide when printed. On screen it looks like a strip of
 * receipt paper with torn edges.
 */
export function Receipt({ order, items, cashier }: ReceiptData) {
  const when = order.confirmed_at ?? order.created_at
  const transfer = order.payment_method === 'mixed' ? (order.transfer_lak ?? 0) : 0
  const cashPart = order.total_lak - transfer
  const change = order.cash_received_lak != null ? order.cash_received_lak - cashPart : null
  const walkIn = order.customer_name === 'ລູກຄ້າໜ້າຮ້ານ'

  return (
    <div className="receipt-paper relative mx-auto w-full max-w-[340px] bg-white px-5 py-6 font-[inherit] text-[13px] leading-snug text-black print:max-w-none print:px-[4mm] print:py-[3mm] print:text-[11pt]">
      {order.status === 'cancelled' && (
        <p className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -rotate-12 rounded border-4 border-red-600 px-3 py-1 text-2xl font-bold text-red-600 opacity-80">
          ຍົກເລີກແລ້ວ
        </p>
      )}

      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- plain img prints reliably */}
        <img src="/logo.jpg" alt="" className="mx-auto mb-1 h-14 w-14 rounded-full grayscale" />
        <p className="text-lg font-bold">{SHOP.nameLo}</p>
        <p className="font-semibold">{SHOP.name}</p>
        <p className="text-xs">{SHOP.tagline}</p>
        <p className="text-xs">ໂທ {SHOP.phone}</p>
        <p className="mt-2 font-bold">ໃບບິນຮັບເງິນ</p>
      </div>

      <Rule />
      <div className="space-y-0.5 text-xs">
        <Row left="ເລກບິນ" right={<span className="font-mono font-semibold">{order.code}</span>} />
        <Row left="ວັນທີ" right={`${date(when)}  ${time(when)}`} />
        <Row left="ຊ່ອງທາງ" right={order.channel === 'store' ? 'ໜ້າຮ້ານ' : 'ອອນລາຍ'} />
        {cashier && <Row left="ພະນັກງານ" right={cashier} />}
        {!walkIn && <Row left="ລູກຄ້າ" right={order.customer_name} />}
        {order.customer_phone && <Row left="ເບີໂທ" right={order.customer_phone} />}
      </div>
      <Rule />

      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id}>
            <p className="font-semibold">
              {item.product_name}
              {item.variant_name !== 'ມາດຕະຖານ' && <span className="font-normal"> · {item.variant_name}</span>}
            </p>
            <Row
              className="pl-3"
              left={`${item.qty} x ${n(item.unit_price_lak)}`}
              right={n(item.qty * item.unit_price_lak)}
            />
          </div>
        ))}
      </div>

      <Rule />
      <div className="space-y-0.5">
        <Row left={`ລວມ (${items.reduce((s, i) => s + i.qty, 0)} ຊິ້ນ)`} right={n(order.subtotal_lak)} />
        {order.discount_lak > 0 && <Row left="ສ່ວນຫຼຸດ" right={`-${n(order.discount_lak)}`} />}
        <Row className="pt-1 text-xl font-bold" left="ຍອດຊຳລະ" right={n(order.total_lak)} />
        <p className="text-right text-xs">(ກີບ)</p>
      </div>

      <Rule />
      <div className="space-y-0.5">
        <Row left="ຊຳລະດ້ວຍ" right={PAYMENT_LABEL[order.payment_method]} />
        {order.payment_method === 'mixed' && (
          <>
            <Row className="pl-3" left="ໂອນ" right={n(transfer)} />
            <Row className="pl-3" left="ເງິນສົດ" right={n(cashPart)} />
          </>
        )}
        {order.cash_received_lak != null && (
          <>
            <Row left="ຮັບເງິນມາ" right={n(order.cash_received_lak)} />
            <Row className="font-bold" left="ເງິນທອນ" right={n(change ?? 0)} />
          </>
        )}
      </div>

      <div className="mt-4">
        <CodeBarcode value={order.code} />
      </div>
      <div className="mt-1 flex justify-between text-xs">
        <span>{date(when)}</span>
        <span>
          {time(when)} · {order.code}
        </span>
      </div>

      <div className="mt-3 text-center">
        <p className="text-base font-bold">ຂອບໃຈທີ່ອຸດໜູນ!</p>
        <p className="text-xs">ສິນຄ້າມີບັນຫາ ຕິດຕໍ່ ໂທ {SHOP.phone}</p>
        <p className="text-xs">Facebook: {SHOP.name}</p>
      </div>
    </div>
  )
}

export function PrintButton({ className = 'btn btn-primary' }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      <PrinterIcon size={18} /> ພິມໃບບິນ
    </button>
  )
}

/**
 * Pop-up receipt for a bill code. Long bills scroll inside the pop-up; printing
 * prints only the receipt.
 */
export function ReceiptModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [data, setData] = useState<ReceiptData | null | undefined>(undefined)

  useEffect(() => {
    let live = true
    fetchReceipt(createClient(), code).then((r) => live && setData(r))
    return () => {
      live = false
    }
  }, [code])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-3 print:static print:block print:bg-transparent print:p-0"
      onClick={onClose}
    >
      <ReceiptPageStyle />
      <div
        className="flex max-h-[92dvh] w-full max-w-[380px] flex-col overflow-hidden rounded-xl bg-[#e9edf3] shadow-2xl print:max-h-none print:max-w-none print:overflow-visible print:rounded-none print:bg-transparent print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 bg-navy px-4 py-3 text-white print:hidden">
          <span className="font-bold">ໃບບິນ {code}</span>
          <button type="button" onClick={onClose} className="rounded-lg bg-white/15 px-3 py-1 font-semibold hover:bg-white/25">
            ປິດ
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 print:overflow-visible print:p-0">
          {data === undefined && <p className="py-16 text-center text-muted">ກຳລັງໂຫຼດ...</p>}
          {data === null && <p className="py-16 text-center text-danger">ບໍ່ພົບໃບບິນນີ້</p>}
          {data && (
            <div className="drop-shadow-[0_4px_10px_rgba(29,43,72,0.2)] print:drop-shadow-none">
              <Receipt {...data} />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-line bg-white p-3 print:hidden">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            ປິດ
          </button>
          <PrintButton />
        </div>
      </div>
    </div>
  )
}
