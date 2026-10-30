'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useState } from 'react'
import { MinusIcon, PlusIcon, TrashIcon } from '@/components/icons'
import { useCart, type CartItem } from '@/components/shop/cart'
import { EmptyState } from '@/components/shop/product-card'
import { SlipUpload } from '@/components/shop/slip-upload'
import { formatKip, imageUrl, SHOP } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import { placeOrder, type CheckoutState } from './actions'

type FreshVariant = {
  id: number
  stock: number
  price_lak: number | null
  is_active: boolean
  products: { price_lak: number; is_active: boolean } | null
}

/** Re-reads price and stock so the cart never shows stale numbers. */
function useRefreshCart() {
  const { items, ready, replace } = useCart()
  const [notice, setNotice] = useState<string | null>(null)
  const done = useRef(false)

  useEffect(() => {
    if (!ready || done.current || items.length === 0) return
    done.current = true
    const ids = items.map((i) => i.variantId)
    createClient()
      .from('product_variants')
      .select('id, stock, price_lak, is_active, products(price_lak, is_active)')
      .in('id', ids)
      .then(({ data }) => {
        if (!data) return
        const fresh = new Map((data as unknown as FreshVariant[]).map((v) => [v.id, v]))
        let changed = false
        const next: CartItem[] = []
        for (const item of items) {
          const v = fresh.get(item.variantId)
          if (!v || !v.is_active || !v.products?.is_active || v.stock === 0) {
            changed = true
            continue
          }
          const price = v.price_lak ?? v.products.price_lak
          const qty = Math.min(item.qty, v.stock)
          if (price !== item.price || qty !== item.qty || v.stock !== item.stock) changed = true
          next.push({ ...item, price, qty, stock: v.stock })
        }
        if (changed) {
          replace(next)
          setNotice('ລາຄາ ຫຼື ຈຳນວນສິນຄ້າບາງລາຍການມີການປ່ຽນແປງ ກະຕ່າຖືກອັບເດດແລ້ວ')
        }
      })
  }, [ready, items, replace])

  return notice
}

export function CartView() {
  const { items, ready, subtotal, setQty, remove, clear } = useCart()
  const notice = useRefreshCart()
  const router = useRouter()
  const [delivery, setDelivery] = useState<'pickup' | 'delivery'>('pickup')
  const [payment, setPayment] = useState('transfer')
  const [uploading, setUploading] = useState(false)
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrder, {})

  useEffect(() => {
    if (state.code) {
      clear()
      router.push(`/order/${state.code}`)
    }
  }, [state.code, clear, router])

  if (!ready) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-mist" />

  if (items.length === 0) {
    return (
      <EmptyState title="ກະຕ່າຍັງຫວ່າງຢູ່">
        <Link href="/products" className="btn btn-primary">
          ເລືອກຊື້ສິນຄ້າ
        </Link>
      </EmptyState>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-navy">ກະຕ່າສິນຄ້າ</h1>
        {notice && <p className="rounded-2xl bg-butter/60 px-4 py-3 text-sm">{notice}</p>}
        {items.map((item) => (
          <div key={item.variantId} className="card flex gap-3 p-3">
            <Link href={`/p/${item.slug}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-mist">
              <Image src={imageUrl(item.image)} alt="" fill sizes="80px" className="object-cover" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate font-semibold">{item.productName}</p>
              {item.variantName !== 'ມາດຕະຖານ' && <p className="text-sm text-muted">{item.variantName}</p>}
              <p className="text-sm font-bold text-navy">{formatKip(item.price)}</p>
              <div className="mt-auto flex items-center justify-between pt-1">
                <div className="flex items-center rounded-full border-[1.5px] border-line">
                  <button className="p-2" onClick={() => setQty(item.variantId, item.qty - 1)} aria-label="ຫຼຸດ">
                    <MinusIcon size={14} />
                  </button>
                  <span className="w-7 text-center text-sm font-semibold">{item.qty}</span>
                  <button className="p-2" onClick={() => setQty(item.variantId, item.qty + 1)} aria-label="ເພີ່ມ">
                    <PlusIcon size={14} />
                  </button>
                </div>
                <button className="p-2 text-danger" onClick={() => remove(item.variantId)} aria-label="ລຶບ">
                  <TrashIcon size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      <form action={action} className="card h-fit space-y-4 p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-bold text-navy">ຂໍ້ມູນຜູ້ສັ່ງ</h2>
        <input
          type="hidden"
          name="items"
          value={JSON.stringify(items.map((i) => ({ variant_id: i.variantId, qty: i.qty })))}
        />
        <div>
          <label className="label" htmlFor="name">ຊື່</label>
          <input id="name" name="name" defaultValue={state.values?.name} className="input" required minLength={2} autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="phone">ເບີໂທ / WhatsApp</label>
          <input id="phone" name="phone" defaultValue={state.values?.phone} className="input" required inputMode="tel" placeholder="020 XXXX XXXX" autoComplete="tel" />
        </div>
        <fieldset>
          <legend className="label">ການຮັບສິນຄ້າ</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['pickup', 'ຮັບທີ່ຮ້ານ'],
                ['delivery', 'ຈັດສົ່ງ'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="chip cursor-pointer justify-center" data-active={delivery === value}>
                <input
                  type="radio"
                  name="delivery_method"
                  value={value}
                  checked={delivery === value}
                  onChange={() => setDelivery(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {delivery === 'delivery' && (
          <div>
            <label className="label" htmlFor="address">ທີ່ຢູ່ / ສາຂາຂົນສົ່ງ (ອານຸສິດ, HAL...)</label>
            <textarea id="address" name="address" defaultValue={state.values?.address} className="input" rows={2} required minLength={5} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="payment_method">ການຊຳລະ</label>
          <select
            id="payment_method"
            name="payment_method"
            className="input"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
          >
            <option value="transfer">ໂອນ (BCEL One)</option>
            <option value="cod">ເກັບເງິນປາຍທາງ</option>
            <option value="cash">ຈ່າຍເງິນສົດທີ່ຮ້ານ</option>
          </select>
        </div>
        {payment === 'transfer' && SHOP.bank.account && (
          <div className="rounded-2xl bg-mist/70 p-3 text-sm">
            <p className="font-semibold text-navy">ໂອນເຂົ້າບັນຊີ {SHOP.bank.name}</p>
            <p className="font-display text-base font-bold">{SHOP.bank.account}</p>
            <p className="text-muted">{SHOP.bank.holder}</p>
          </div>
        )}
        {delivery === 'delivery' && payment === 'transfer' && <SlipUpload onBusyChange={setUploading} />}
        <div>
          <label className="label" htmlFor="note">ໝາຍເຫດ</label>
          <textarea id="note" name="note" defaultValue={state.values?.note} className="input" rows={2} placeholder="ຕົວຢ່າງ: ຂໍສີຟ້າ, ຮັບຕອນແລງ" />
        </div>

        <div className="flex items-center justify-between border-t border-line pt-4">
          <span className="text-muted">ລວມທັງໝົດ</span>
          <span className="text-xl font-bold text-navy">{formatKip(subtotal)}</span>
        </div>
        {state.error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}
        <button className="btn btn-primary w-full" disabled={pending || uploading}>
          {pending ? 'ກຳລັງສົ່ງ...' : 'ຢືນຢັນການສັ່ງຊື້'}
        </button>
        <p className="text-center text-xs text-muted">ຮ້ານຈະໂທ ຫຼື ທັກຫາເພື່ອຢືນຢັນອໍເດີ</p>
      </form>
    </div>
  )
}
