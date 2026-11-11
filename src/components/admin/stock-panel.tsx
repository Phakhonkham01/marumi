'use client'

import { refreshCatalog } from '@/app/admin/actions'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useDialog } from '@/components/dialog'
import { MinusIcon, PlusIcon } from '@/components/icons'
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
  const dialog = useDialog()
  const [mode, setMode] = useState<Mode | null>(null)
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  function open(next: Mode, current: number) {
    setMode(next)
    setQty(next.kind === 'adjust' ? String(current) : '1')
    setCost('')
    setNote('')
  }

  async function submit() {
    if (!mode) return
    const n = Number(qty)
    if (!Number.isInteger(n) || n < 0 || (mode.kind === 'restock' && n < 1)) {
      return dialog.alert({ tone: 'warning', title: 'ຈຳນວນບໍ່ຖືກຕ້ອງ', message: 'ກະລຸນາໃສ່ຕົວເລກຈຳນວນເຕັມ' })
    }
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
    if (error) return dialog.alert({ tone: 'error', title: 'ບັນທຶກບໍ່ສຳເລັດ', message: errorMessage(error.message) })
    const variantName = variants.find((v) => v.id === mode.variantId)?.name
    setMode(null)
    await refreshCatalog()
    router.refresh()
    dialog.alert(
      mode.kind === 'restock'
        ? { tone: 'success', title: 'ຮັບສິນຄ້າເຂົ້າແລ້ວ', message: `${variantName}: +${n} ຊິ້ນ` }
        : { tone: 'success', title: 'ປັບສະຕັອກແລ້ວ', message: `${variantName}: ເຫຼືອ ${n} ຊິ້ນ` },
    )
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
              <span className="mr-2 text-right leading-tight">
                <span className="block text-xs text-muted">ຄົງເຫຼືອ</span>
                <span className={`text-2xl font-bold ${v.stock === 0 ? 'text-danger' : 'text-navy'}`}>{v.stock}</span>
              </span>
              <button
                className="btn btn-butter min-w-36 px-6 py-3 text-base shadow-sm"
                onClick={() => open({ variantId: v.id, kind: 'restock' }, v.stock)}
              >
                <PlusIcon size={20} /> ຮັບເຂົ້າ
              </button>
              <button
                className="btn btn-primary min-w-36 px-6 py-3 text-base shadow-sm"
                onClick={() => open({ variantId: v.id, kind: 'adjust' }, v.stock)}
              >
                ປັບສະຕັອກ
              </button>
            </div>
            {mode?.variantId === v.id && (
              <div className="mt-2 space-y-2 rounded-2xl bg-mist/60 p-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span>{mode.kind === 'restock' ? 'ຈຳນວນຮັບເຂົ້າ' : 'ນັບໄດ້ຕົວຈິງ'}</span>
                    <QtyStepper value={qty} onChange={setQty} min={mode.kind === 'restock' ? 1 : 0} />
                    {mode.kind === 'restock' && Number(qty) > 0 && (
                      <span className="text-muted">→ ຄົງເຫຼືອ {v.stock + Number(qty)}</span>
                    )}
                  </div>
                  {mode.kind === 'restock' && isOwner && (
                    <label className="flex items-center gap-2">
                      ຕົ້ນທຶນ/ຊິ້ນ
                      <input className="input w-28!" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="ກີບ" />
                    </label>
                  )}
                </div>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ໝາຍເຫດ (ບໍ່ບັງຄັບ)" />
                <div className="flex gap-2">
                  <button className="btn btn-primary min-w-28" onClick={submit} disabled={busy}>
                    ບັນທຶກ
                  </button>
                  <button className="btn btn-ghost min-w-28" onClick={() => setMode(null)}>
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

function QtyStepper({ value, onChange, min }: { value: string; onChange: (v: string) => void; min: number }) {
  const n = Number(value) || 0
  const step = (d: number) => onChange(String(Math.max(min, n + d)))
  return (
    <div className="flex items-center overflow-hidden rounded-xl border-[1.5px] border-navy bg-white">
      <button type="button" className="px-3 py-2.5 text-navy hover:bg-mist disabled:opacity-30" onClick={() => step(-1)} disabled={n <= min} aria-label="ຫຼຸດ">
        <MinusIcon size={18} />
      </button>
      <input
        className="w-16 border-x-[1.5px] border-navy py-2 text-center text-lg font-bold text-navy outline-none"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        onFocus={(e) => e.target.select()}
        autoFocus
        aria-label="ຈຳນວນ"
      />
      <button type="button" className="px-3 py-2.5 text-navy hover:bg-mist" onClick={() => step(1)} aria-label="ເພີ່ມ">
        <PlusIcon size={18} />
      </button>
    </div>
  )
}
