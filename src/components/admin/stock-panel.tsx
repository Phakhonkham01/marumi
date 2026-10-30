'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { errorMessage, formatKip } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import type { Variant } from '@/lib/types'

type Mode = { variantId: number; kind: 'restock' | 'adjust' }

export function StockPanel({
  variants,
  costs,
  isOwner,
}: {
  variants: Variant[]
  costs: Record<number, number>
  isOwner: boolean
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode | null>(null)
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function open(next: Mode, current: number) {
    setMode(next)
    setQty(next.kind === 'adjust' ? String(current) : '')
    setCost('')
    setNote('')
    setError(null)
  }

  async function submit() {
    if (!mode) return
    const n = Number(qty)
    if (!Number.isInteger(n) || n < 0 || (mode.kind === 'restock' && n < 1)) return setError('ຈຳນວນບໍ່ຖືກຕ້ອງ')
    setBusy(true)
    const supabase = createClient()
    const { error } =
      mode.kind === 'restock'
        ? await supabase.rpc('restock', {
            p_variant_id: mode.variantId,
            p_qty: n,
            p_unit_cost_lak: isOwner && cost.trim() ? Number(cost.replace(/[,\s]/g, '')) : null,
            p_note: note || null,
          })
        : await supabase.rpc('adjust_stock', { p_variant_id: mode.variantId, p_new_stock: n, p_note: note || null })
    setBusy(false)
    if (error) return setError(errorMessage(error.message))
    setMode(null)
    router.refresh()
  }

  return (
    <section className="card space-y-2 p-4">
      <h2 className="font-bold text-navy">ສະຕັອກ</h2>
      <ul className="divide-y divide-line">
        {variants.map((v) => (
          <li key={v.id} className="py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 font-semibold">
                {v.name}
                {!v.is_active && <span className="ml-1 text-xs text-muted">(ປິດຂາຍ)</span>}
                {isOwner && costs[v.id] != null && (
                  <span className="ml-2 text-xs font-normal text-muted">ຕົ້ນທຶນ {formatKip(costs[v.id])}</span>
                )}
              </span>
              <span className={`w-10 text-right text-lg font-bold ${v.stock === 0 ? 'text-danger' : 'text-navy'}`}>{v.stock}</span>
              <button className="btn btn-butter btn-sm" onClick={() => open({ variantId: v.id, kind: 'restock' }, v.stock)}>
                + ຮັບເຂົ້າ
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => open({ variantId: v.id, kind: 'adjust' }, v.stock)}>
                ປັບ
              </button>
            </div>
            {mode?.variantId === v.id && (
              <div className="mt-2 space-y-2 rounded-2xl bg-mist/60 p-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-2">
                    {mode.kind === 'restock' ? 'ຈຳນວນຮັບເຂົ້າ' : 'ນັບໄດ້ຕົວຈິງ'}
                    <input className="input w-20!" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
                  </label>
                  {mode.kind === 'restock' && isOwner && (
                    <label className="flex items-center gap-2">
                      ຕົ້ນທຶນ/ຊິ້ນ
                      <input className="input w-28!" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="ກີບ" />
                    </label>
                  )}
                </div>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ໝາຍເຫດ (ບໍ່ບັງຄັບ)" />
                {error && <p className="text-danger">{error}</p>}
                <div className="flex gap-2">
                  <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
                    ບັນທຶກ
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setMode(null)}>
                    ຍົກເລີກ
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {isOwner && <p className="text-xs text-muted">ໃສ່ຕົ້ນທຶນຕອນຮັບເຂົ້າ ລະບົບຈະຄິດຕົ້ນທຶນສະເລ່ຍໃຫ້ອັດຕະໂນມັດ</p>}
    </section>
  )
}
