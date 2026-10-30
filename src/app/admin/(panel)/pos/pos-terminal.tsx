'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MinusIcon, PlusIcon, TrashIcon } from '@/components/icons'
import { activeVariants, errorMessage, formatKip, imageUrl, sortedImages, variantPrice } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import type { ProductWithRelations, Variant } from '@/lib/types'

type Line = { variant: Variant; productName: string; qty: number; price: number }

export function PosTerminal({ products }: { products: ProductWithRelations[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [picking, setPicking] = useState<ProductWithRelations | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [discount, setDiscount] = useState('')
  const [payment, setPayment] = useState<'cash' | 'transfer'>('cash')
  const [customer, setCustomer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const term = search.trim().toLowerCase()
  const visible = products.filter((p) => !term || p.name.toLowerCase().includes(term))
  const subtotal = lines.reduce((n, l) => n + l.qty * l.price, 0)
  const discountValue = Math.min(subtotal, Math.max(0, Number(discount.replace(/[,\s]/g, '')) || 0))

  function addVariant(product: ProductWithRelations, variant: Variant) {
    setDone(null)
    setPicking(null)
    setLines((prev) => {
      const existing = prev.find((l) => l.variant.id === variant.id)
      if (existing) return prev.map((l) => (l.variant.id === variant.id ? { ...l, qty: l.qty + 1 } : l))
      return [...prev, { variant, productName: product.name, qty: 1, price: variantPrice(product, variant) }]
    })
  }

  function onPickProduct(product: ProductWithRelations) {
    const variants = activeVariants(product)
    if (variants.length === 1) addVariant(product, variants[0])
    else setPicking(product)
  }

  const updateLine = (id: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.variant.id === id ? { ...l, ...patch } : l)))

  async function checkout() {
    setBusy(true)
    setError(null)
    const { data, error } = await createClient().rpc('store_sale', {
      p_items: lines.map((l) => ({ variant_id: l.variant.id, qty: l.qty, unit_price_lak: l.price })),
      p_payment: payment,
      p_discount_lak: discountValue,
      p_customer_name: customer || null,
    })
    setBusy(false)
    if (error) return setError(errorMessage(error.message))
    setDone(data as string)
    setLines([])
    setDiscount('')
    setCustomer('')
    router.refresh()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <section className="space-y-3">
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ຄົ້ນຫາສິນຄ້າ..." />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {visible.map((p) => {
            const stock = activeVariants(p).reduce((n, v) => n + v.stock, 0)
            return (
              <button
                key={p.id}
                onClick={() => onPickProduct(p)}
                disabled={stock === 0}
                className="card overflow-hidden text-left transition hover:border-sky disabled:opacity-40"
              >
                <div className="relative aspect-square bg-mist">
                  <Image src={imageUrl(sortedImages(p)[0]?.path)} alt="" fill sizes="120px" className="object-cover" />
                  <span className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 text-xs font-bold text-navy">{stock}</span>
                </div>
                <p className="line-clamp-2 p-2 text-xs font-semibold">{p.name}</p>
              </button>
            )
          })}
        </div>
      </section>

      <section className="card h-fit space-y-3 p-4 lg:sticky lg:top-8">
        <h2 className="font-bold text-navy">ບິນ</h2>
        {done && (
          <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
            ✓ ບັນທຶກແລ້ວ{' '}
            <Link href="/admin/orders?status=completed" className="font-display font-bold underline">
              {done}
            </Link>
          </p>
        )}
        {lines.length === 0 && !done && <p className="text-sm text-muted">ແຕະສິນຄ້າເພື່ອເພີ່ມໃສ່ບິນ</p>}
        <ul className="space-y-2">
          {lines.map((l) => (
            <li key={l.variant.id} className="rounded-xl border border-line p-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">
                  {l.productName}
                  {l.variant.name !== 'ມາດຕະຖານ' && <span className="font-normal text-muted"> · {l.variant.name}</span>}
                </span>
                <button onClick={() => setLines((prev) => prev.filter((x) => x.variant.id !== l.variant.id))} className="text-danger" aria-label="ລຶບ">
                  <TrashIcon size={16} />
                </button>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <button className="rounded-full border border-line p-1" onClick={() => updateLine(l.variant.id, { qty: Math.max(1, l.qty - 1) })} aria-label="ຫຼຸດ">
                  <MinusIcon size={14} />
                </button>
                <span className="w-6 text-center font-semibold">{l.qty}</span>
                <button
                  className="rounded-full border border-line p-1"
                  onClick={() => updateLine(l.variant.id, { qty: Math.min(l.variant.stock, l.qty + 1) })}
                  aria-label="ເພີ່ມ"
                >
                  <PlusIcon size={14} />
                </button>
                <input
                  className="input ml-auto w-28! py-1! text-right"
                  inputMode="numeric"
                  value={l.price}
                  onChange={(e) => updateLine(l.variant.id, { price: Math.max(0, Number(e.target.value.replace(/[^\d]/g, '')) || 0) })}
                  aria-label="ລາຄາ"
                />
              </div>
            </li>
          ))}
        </ul>

        {lines.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <input className="input" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="ສ່ວນຫຼຸດ (ກີບ)" />
              <input className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="ຊື່ລູກຄ້າ (ບໍ່ບັງຄັບ)" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'transfer'] as const).map((m) => (
                <button key={m} className="chip justify-center" data-active={payment === m} onClick={() => setPayment(m)}>
                  {m === 'cash' ? 'ເງິນສົດ' : 'ໂອນ'}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-line pt-3">
              <span className="text-muted">ລວມ</span>
              <span className="text-2xl font-bold text-navy">{formatKip(subtotal - discountValue)}</span>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button className="btn btn-primary w-full" onClick={checkout} disabled={busy}>
              {busy ? 'ກຳລັງບັນທຶກ...' : 'ຮັບເງິນ ແລະ ບັນທຶກການຂາຍ'}
            </button>
          </>
        )}
      </section>

      {picking && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={() => setPicking(null)}>
          <div className="card w-full max-w-md space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-navy">{picking.name}</p>
            <div className="flex flex-wrap gap-2">
              {activeVariants(picking).map((v) => (
                <button key={v.id} className="chip" disabled={v.stock === 0} onClick={() => addVariant(picking, v)}>
                  {v.name} <span className="text-xs text-muted">({v.stock})</span>
                </button>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setPicking(null)}>
              ປິດ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
