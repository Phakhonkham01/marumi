'use client'

import { useCallback, useState } from 'react'
import { ReceiptModal } from '@/components/admin/receipt'
import { ReceiptIcon } from '@/components/icons'
import { formatKip, PAYMENT_LABEL } from '@/lib/format'
import type { PaymentMethod } from '@/lib/types'

export type SaleRow = {
  code: string
  channel: 'store' | 'online'
  customer: string
  payment: PaymentMethod
  total: number
  /** Part paid by transfer or COD (all of it unless cash or mixed). */
  transfer: number
  discount: number
  at: string
  pieces: number
}

const fmt = (iso: string, withDate: boolean) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Vientiane',
    ...(withDate ? { day: '2-digit', month: '2-digit', year: '2-digit' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))

/** One row per bill; the bill number opens its receipt. */
export function SalesTable({ rows, multiDay }: { rows: SaleRow[]; multiDay: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  const close = useCallback(() => setOpen(null), [])

  return (
    <>
      <section className="panel print:hidden">
        <div className="panel-head">
          <span className="panel-title">
            <ReceiptIcon size={22} /> ໃບບິນ ({rows.length})
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="py-12 text-center text-muted">ບໍ່ພົບໃບບິນ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ເລກບິນ</th>
                  <th>{multiDay ? 'ວັນທີ / ເວລາ' : 'ເວລາ'}</th>
                  <th>ຊ່ອງທາງ</th>
                  <th>ລູກຄ້າ</th>
                  <th>ຊຳລະ</th>
                  <th className="text-right!">ຊິ້ນ</th>
                  <th className="text-right!">ຍອດ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code} className="cursor-pointer hover:bg-mist" onClick={() => setOpen(r.code)}>
                    <td>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md bg-butter px-2.5 py-1 font-mono text-xs font-bold text-navy hover:bg-butter-deep"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpen(r.code)
                        }}
                      >
                        <ReceiptIcon size={14} /> {r.code}
                      </button>
                    </td>
                    <td className="whitespace-nowrap">{fmt(r.at, multiDay)}</td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.channel === 'store' ? 'bg-sky/30 text-navy' : 'bg-blush/20 text-blush'
                        }`}
                      >
                        {r.channel === 'store' ? 'ໜ້າຮ້ານ' : 'ອອນລາຍ'}
                      </span>
                    </td>
                    <td className="max-w-40 truncate">{r.customer}</td>
                    <td className="whitespace-nowrap">{PAYMENT_LABEL[r.payment]}</td>
                    <td className="text-right">{r.pieces}</td>
                    <td className="whitespace-nowrap text-right font-bold text-navy">{formatKip(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open && <ReceiptModal code={open} onClose={close} />}
    </>
  )
}
