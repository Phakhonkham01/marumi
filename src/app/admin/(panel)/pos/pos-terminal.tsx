'use client'

import { refreshCatalog } from '@/app/admin/actions'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useDialog } from '@/components/dialog'
import { BagIcon, CashIcon, MinusIcon, PlusIcon, TrashIcon } from '@/components/icons'
import { TileBody } from '@/components/shop/product-card'
import { activeVariants, errorMessage, formatKip, sortedImages, variantPrice } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import type { ProductWithRelations, Variant } from '@/lib/types'

type Line = { variant: Variant; productName: string; qty: number; price: number }

export function PosTerminal({ products }: { products: ProductWithRelations[] }) {
  const router = useRouter()
  const dialog = useDialog()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [picking, setPicking] = useState<ProductWithRelations | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [discount, setDiscount] = useState('')
  const [payment, setPayment] = useState<'cash' | 'transfer'>('cash')
  const [customer, setCustomer] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const term = search.trim().toLowerCase()
  const categories = [...new Set(products.map((p) => p.categories?.name).filter((c): c is string => !!c))]
  const visible = products.filter(
    (p) => (!term || p.name.toLowerCase().includes(term)) && (!category || p.categories?.name === category),
  )
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

  async function clearBill() {
    const confirmed = await dialog.confirm({
      title: 'ລ້າງສິນຄ້າໃນບິນ?',
      message: `ຈະລຶບສິນຄ້າ ${lines.length} ລາຍການອອກຈາກບິນ ແຕ່ຍັງບໍ່ຫັກສະຕັອກ`,
      okLabel: 'ລຶບທັງໝົດ',
      danger: true,
    })
    if (!confirmed) return
    setLines([])
    setDiscount('')
    setCustomer('')
  }

  async function checkout() {
    setBusy(true)
    const total = subtotal - discountValue
    const { data, error } = await createClient().rpc('store_sale', {
      p_items: lines.map((l) => ({ variant_id: l.variant.id, qty: l.qty, unit_price_lak: l.price })),
      p_payment: payment,
      p_discount_lak: discountValue,
      p_customer_name: customer || null,
    })
    setBusy(false)
    if (error) return dialog.alert({ tone: 'error', title: 'ບັນທຶກການຂາຍບໍ່ສຳເລັດ', message: errorMessage(error.message) })
    dialog.alert({ tone: 'success', title: 'ບັນທຶກການຂາຍແລ້ວ', message: `ບິນ ${data} · ${formatKip(total)}` })
    setDone(data as string)
    setLines([])
    setDiscount('')
    setCustomer('')
    await refreshCatalog()
    router.refresh()
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">
            <CashIcon size={22} /> ໜ້າຂາຍ
          </span>
          <div className="panel-search w-full sm:w-72">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ຄົ້ນຫາສິນຄ້າ..." aria-label="ຄົ້ນຫາສິນຄ້າ" />
            <button type="button" onClick={() => setSearch('')}>
              {search ? 'ລ້າງ' : 'ຄົ້ນຫາ'}
            </button>
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="ໝວດສິນຄ້າ">
            <option value="">ທຸກໝວດ</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="grid max-h-[calc(100dvh-13rem)] grid-cols-2 gap-4 overflow-y-auto bg-[#f4f7fb] p-4 sm:grid-cols-3 2xl:grid-cols-4">
          {visible.map((p) => {
            const stock = activeVariants(p).reduce((n, v) => n + v.stock, 0)
            const prices = activeVariants(p).map((v) => variantPrice(p, v))
            return (
              <button key={p.id} onClick={() => onPickProduct(p)} disabled={stock === 0} className="pcard disabled:opacity-40">
                <TileBody
                  name={p.name}
                  category={p.categories?.name}
                  image={sortedImages(p)[0]?.path}
                  price={formatKip(prices.length ? Math.min(...prices) : p.price_lak)}
                  stock={stock}
                />
              </button>
            )
          })}
          {visible.length === 0 && <p className="col-span-full py-10 text-center text-muted">ບໍ່ພົບສິນຄ້າ</p>}
        </div>
      </section>

      <section className="panel flex h-fit flex-col xl:sticky xl:top-24">
        <div className="panel-head">
          <span className="panel-title">
            <BagIcon size={22} /> ບິນ
          </span>
          <button type="button" className="panel-btn" onClick={clearBill} disabled={lines.length === 0}>
            <TrashIcon size={16} /> ລ້າງບິນ
          </button>
        </div>

        <div className="min-h-48 space-y-2 bg-[#f4f7fb] p-3">
          {done && (
            <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
              ✓ ບັນທຶກແລ້ວ{' '}
              <Link href="/admin/orders?status=completed" className="font-bold underline">
                {done}
              </Link>
            </p>
          )}
          {lines.length === 0 && !done && (
            <div className="flex flex-col items-center gap-1 py-10 text-center text-muted">
              <BagIcon size={36} />
              <p className="font-semibold">ຍັງບໍ່ມີສິນຄ້າໃນບິນ</p>
              <p className="text-xs">ກົດໃສ່ສິນຄ້າດ້ານຊ້າຍເພື່ອຂາຍ</p>
            </div>
          )}
          {lines.map((l) => (
            <div key={l.variant.id} className="rounded-md bg-white p-3 text-sm shadow-sm">
              <div className="flex justify-between gap-2">
                <span className="font-bold text-ink">
                  {l.productName}
                  {l.variant.name !== 'ມາດຕະຖານ' && <span className="font-normal text-muted"> · {l.variant.name}</span>}
                </span>
                <button onClick={() => setLines((prev) => prev.filter((x) => x.variant.id !== l.variant.id))} className="text-muted hover:text-danger" aria-label="ລຶບ">
                  ✕
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="w-28 rounded border border-line px-2 py-1 font-semibold text-navy"
                  inputMode="numeric"
                  value={l.price}
                  onChange={(e) => updateLine(l.variant.id, { price: Math.max(0, Number(e.target.value.replace(/[^\d]/g, '')) || 0) })}
                  aria-label="ລາຄາ"
                />
                <div className="ml-auto flex items-center border border-line">
                  <button className="px-2 py-1 hover:bg-mist" onClick={() => updateLine(l.variant.id, { qty: Math.max(1, l.qty - 1) })} aria-label="ຫຼຸດ">
                    <MinusIcon size={14} />
                  </button>
                  <span className="w-8 border-x border-line text-center font-semibold">{l.qty}</span>
                  <button
                    className="px-2 py-1 hover:bg-mist"
                    onClick={() => updateLine(l.variant.id, { qty: Math.min(l.variant.stock, l.qty + 1) })}
                    aria-label="ເພີ່ມ"
                  >
                    <PlusIcon size={14} />
                  </button>
                </div>
                <span className="w-28 text-right font-semibold text-navy">{formatKip(l.price * l.qty)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-line p-3">
          <div className="grid grid-cols-2 gap-2">
            <input className="input" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="ສ່ວນຫຼຸດ (ກີບ)" />
            <input className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="ຊື່ລູກຄ້າ (ບໍ່ບັງຄັບ)" />
          </div>
          <div className="summary-box space-y-1 text-sm">
            <p className="flex justify-between">
              <span>ຍອດລວມສິນຄ້າ</span> <span className="font-semibold">{formatKip(subtotal)}</span>
            </p>
            <p className="flex justify-between">
              <span>ສ່ວນຫຼຸດ</span> <span className="font-semibold">-{formatKip(discountValue)}</span>
            </p>
            <p className="mt-2 flex justify-between border-t-2 border-navy pt-2 text-lg font-bold text-navy">
              <span>ຍອດທີ່ຕ້ອງຊຳລະ</span> <span>{formatKip(subtotal - discountValue)}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['cash', 'transfer'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPayment(m)}
                className={`rounded-md py-3 font-bold ${payment === m ? 'bg-navy text-white' : 'border-[1.5px] border-line bg-white text-navy'}`}
              >
                {m === 'cash' ? 'ເງິນສົດ' : 'ໂອນ'}
              </button>
            ))}
          </div>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-md bg-butter py-3.5 text-lg font-bold text-navy hover:bg-butter-deep disabled:opacity-50"
            onClick={checkout}
            disabled={busy || lines.length === 0}
          >
            <CashIcon size={22} /> {busy ? 'ກຳລັງບັນທຶກ...' : 'ຊຳລະເງິນ'}
          </button>
        </div>
      </section>

      {picking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={() => setPicking(null)}>
          <div className="panel w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <span className="panel-title">{picking.name}</span>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm text-muted">ເລືອກລຸ້ນ / ສີ</p>
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
        </div>
      )}
    </div>
  )
}
