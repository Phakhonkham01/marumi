'use client'

import { refreshCatalog } from '@/app/admin/actions'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDialog } from '@/components/dialog'
import { CameraScanner, usePreloadScanner } from '@/components/camera-scanner'
import { BagIcon, CameraIcon, CashIcon, MinusIcon, PlusIcon, TrashIcon } from '@/components/icons'
import { TileBody } from '@/components/shop/product-card'
import { normalizeBarcode } from '@/lib/barcode'
import { beep, useBarcodeScanner } from '@/lib/use-barcode-scanner'
import { activeVariants, errorMessage, formatKip, imageUrl, sortedImages, variantPrice } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import type { ProductWithRelations, Variant } from '@/lib/types'
import { flyToCart } from '@/lib/fly-to-cart'

type Line = { variant: Variant; productName: string; image: string | null; qty: number; price: number }

/** Gives a short bounce to show something landed in it. */
export function PosTerminal({ products, canDiscount }: { products: ProductWithRelations[]; canDiscount: boolean }) {
  const router = useRouter()
  const dialog = useDialog()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [camera, setCamera] = useState(false)
  const [picking, setPicking] = useState<ProductWithRelations | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [discount, setDiscount] = useState('')
  const [payment, setPayment] = useState<'cash' | 'transfer' | 'mixed'>('cash')
  const [customer, setCustomer] = useState('')
  const [cash, setCash] = useState('')
  const [transfer, setTransfer] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const linesRef = useRef<HTMLDivElement>(null)
  const billRef = useRef<HTMLElement>(null)
  const billIconRef = useRef<HTMLSpanElement>(null)
  const cartBarRef = useRef<HTMLSpanElement>(null)
  const pickedTile = useRef<HTMLElement | null>(null)
  const lineCount = lines.length

  // Keep the newest line in view when one is added to a long bill.
  useEffect(() => {
    const el = linesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lineCount])

  const term = search.trim().toLowerCase()
  const categories = [...new Set(products.map((p) => p.categories?.name).filter((c): c is string => !!c))]
  const visible = products.filter(
    (p) => (!term || p.name.toLowerCase().includes(term)) && (!category || p.categories?.name === category),
  )
  const subtotal = lines.reduce((n, l) => n + l.qty * l.price, 0)
  const discountValue = Math.min(subtotal, Math.max(0, Number(discount.replace(/[,\s]/g, '')) || 0))
  const due = subtotal - discountValue
  // Cash + transfer: the transfer part is typed in, the rest is paid in cash.
  const transferValue = payment === 'mixed' ? Number(transfer) || 0 : 0
  const splitInvalid = payment === 'mixed' && (transferValue <= 0 || transferValue >= due)
  const cashDue = payment === 'mixed' ? Math.max(0, due - transferValue) : due
  // Cash handed over by the customer (optional); the change is shown and printed on the receipt.
  const cashValue = payment !== 'transfer' && cash ? Number(cash) : null
  const cashShort = cashValue !== null && cashValue < cashDue
  const cashSuggestions = [
    ...new Set([10_000, 50_000, 100_000].map((step) => Math.ceil(cashDue / step) * step).filter((v) => v > cashDue)),
  ]

  const itemCount = lines.reduce((n, l) => n + l.qty, 0)

  /** The cart the product flies to: the bottom bar on phones, the bill header on wide screens. */
  function cartTarget() {
    const bar = cartBarRef.current
    return bar && bar.getClientRects().length > 0 ? bar : billIconRef.current
  }

  function addVariant(product: ProductWithRelations, variant: Variant, source: Element | null = null) {
    setDone(null)
    setPicking(null)
    setLines((prev) => {
      const existing = prev.find((l) => l.variant.id === variant.id)
      if (existing) return prev.map((l) => (l.variant.id === variant.id ? { ...l, qty: l.qty + 1 } : l))
      const image = sortedImages(product)[0]?.path ?? null
      return [...prev, { variant, productName: product.name, image, qty: 1, price: variantPrice(product, variant) }]
    })
    flyToCart(source, cartTarget())
  }

  // Every variant with a barcode, for instant lookups without a network round trip.
  const byBarcode = useMemo(() => {
    const map = new Map<string, { product: ProductWithRelations; variant: Variant }>()
    for (const product of products)
      for (const variant of product.product_variants) if (variant.barcode) map.set(variant.barcode, { product, variant })
    return map
  }, [products])

  async function handleScan(code: string) {
    const hit = byBarcode.get(code)
    if (!hit) {
      beep(false)
      const add = await dialog.confirm({
        title: 'ບໍ່ພົບສິນຄ້າລະຫັດນີ້',
        message: `${code} — ເພີ່ມເປັນສິນຄ້າໃໝ່ບໍ?`,
        okLabel: 'ເພີ່ມສິນຄ້າໃໝ່',
        cancelLabel: 'ປິດ',
      })
      if (add) router.push(`/admin/products/new?barcode=${encodeURIComponent(code)}`)
      return
    }
    const { product, variant } = hit
    const inBill = lines.find((l) => l.variant.id === variant.id)?.qty ?? 0
    if (!variant.is_active || !product.is_active || variant.stock <= inBill) {
      beep(false)
      dialog.alert({
        tone: 'warning',
        title: variant.stock === 0 ? 'ສິນຄ້າໝົດສະຕັອກ' : !variant.is_active || !product.is_active ? 'ສິນຄ້ານີ້ປິດຂາຍຢູ່' : 'ສະຕັອກບໍ່ພໍ',
        message: `${product.name}${variant.name !== 'ມາດຕະຖານ' ? ` · ${variant.name}` : ''} (ເຫຼືອ ${variant.stock})`,
      })
      return
    }
    beep(true)
    addVariant(product, variant)
  }

  // Barcode gun anywhere on the page (paused while the variant picker is open).
  useBarcodeScanner(handleScan, !picking && !camera)
  usePreloadScanner()

  function onPickProduct(product: ProductWithRelations, tile: HTMLElement) {
    const variants = activeVariants(product)
    if (variants.length === 1) addVariant(product, variants[0], tile)
    else {
      pickedTile.current = tile
      setPicking(product)
    }
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
    setCash('')
    setTransfer('')
  }

  async function checkout() {
    setBusy(true)
    const total = subtotal - discountValue
    const { data, error } = await createClient().rpc('store_sale', {
      p_items: lines.map((l) => ({ variant_id: l.variant.id, qty: l.qty, unit_price_lak: l.price })),
      p_payment: payment,
      p_discount_lak: discountValue,
      p_customer_name: customer || null,
      p_cash_received_lak: cashValue,
      p_transfer_lak: payment === 'mixed' ? transferValue : null,
    })
    setBusy(false)
    if (error) return dialog.alert({ tone: 'error', title: 'ບັນທຶກການຂາຍບໍ່ສຳເລັດ', message: errorMessage(error.message) })
    dialog.alert({ tone: 'success', title: 'ບັນທຶກການຂາຍແລ້ວ', message: `ບິນ ${data} · ${formatKip(total)}` })
    setDone(data as string)
    setLines([])
    setDiscount('')
    setCustomer('')
    setCash('')
    setTransfer('')
    await refreshCatalog()
    // Straight to the paper receipt, ready to print.
    router.push(`/admin/receipt/${encodeURIComponent(data as string)}`)
  }

  return (
    <div className="grid items-start gap-4 pb-20 xl:grid-cols-[1fr_380px] xl:pb-0">
      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">
            <CashIcon size={22} /> ໜ້າຂາຍ
            <span className="ml-1 flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#7ee2b8]" /> ພ້ອມສະແກນ
            </span>
          </span>
          <div className="panel-search w-full sm:w-72">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                // Scanning while the search box has focus: add the item instead of filtering.
                if (e.key !== 'Enter') return
                const code = normalizeBarcode(search)
                if (byBarcode.has(code)) {
                  e.preventDefault()
                  setSearch('')
                  handleScan(code)
                }
              }}
              placeholder="ຄົ້ນຫາ ຫຼື ສະແກນບາໂຄ້ດ..."
              aria-label="ຄົ້ນຫາສິນຄ້າ"
            />
            <button type="button" onClick={() => setSearch('')}>
              {search ? 'ລ້າງ' : 'ຄົ້ນຫາ'}
            </button>
          </div>
          <button type="button" className="panel-btn" onClick={() => setCamera(true)}>
            <CameraIcon size={18} /> ກ້ອງ
          </button>
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="ໝວດສິນຄ້າ">
            <option value="">ທຸກໝວດ</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4 bg-[#f4f7fb] p-4 sm:grid-cols-3 2xl:grid-cols-4">
          {visible.map((p) => {
            const stock = activeVariants(p).reduce((n, v) => n + v.stock, 0)
            const prices = activeVariants(p).map((v) => variantPrice(p, v))
            return (
              // A div, not a <button>: iOS Safari collapses the photo box inside buttons.
              <div
                key={p.id}
                role="button"
                tabIndex={stock === 0 ? -1 : 0}
                aria-disabled={stock === 0}
                onClick={(e) => stock > 0 && onPickProduct(p, e.currentTarget)}
                onKeyDown={(e) => {
                  if (stock > 0 && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onPickProduct(p, e.currentTarget)
                  }
                }}
                className={`pcard w-full cursor-pointer select-none active:scale-[0.97] ${stock === 0 ? 'pointer-events-none opacity-40' : ''}`}
              >
                <TileBody
                  name={p.name}
                  category={p.categories?.name}
                  image={sortedImages(p)[0]?.path}
                  price={formatKip(prices.length ? Math.min(...prices) : p.price_lak)}
                  stock={stock}
                />
              </div>
            )
          })}
          {visible.length === 0 && <p className="col-span-full py-10 text-center text-muted">ບໍ່ພົບສິນຄ້າ</p>}
        </div>
      </section>

      {/* The bill stays in view while the product list scrolls with the page. */}
      <section ref={billRef} className="panel flex scroll-mt-24 flex-col xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7.5rem)]">
        <div className="panel-head">
          <span className="panel-title">
            <span ref={billIconRef} className="relative inline-flex">
              <BagIcon size={22} />
              {itemCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-butter px-1 text-[10px] font-bold text-navy">
                  {itemCount}
                </span>
              )}
            </span>{' '}
            ບິນ
          </span>
          <button type="button" className="panel-btn" onClick={clearBill} disabled={lines.length === 0}>
            <TrashIcon size={16} /> ລ້າງບິນ
          </button>
        </div>

        {/* About five lines fit; longer bills scroll inside this list. */}
        <div ref={linesRef} className="max-h-[33rem] min-h-48 flex-1 space-y-2 overflow-y-auto overscroll-contain bg-[#f4f7fb] p-3">
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
              <div className="flex items-start gap-3">
                <Image
                  src={imageUrl(l.image)}
                  alt=""
                  width={48}
                  height={48}
                  className={`h-12 w-12 shrink-0 rounded-md border border-line ${l.image ? 'object-cover' : 'object-contain p-1.5 opacity-40 grayscale'}`}
                />
                <span className="min-w-0 flex-1 font-bold text-ink">
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

        <div className="shrink-0 space-y-3 border-t border-line p-3">
          <div className={`grid gap-2 ${canDiscount ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {canDiscount && <input className="input" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="ສ່ວນຫຼຸດ (ກີບ)" />}
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
          <div className="grid grid-cols-3 gap-2">
            {(['cash', 'transfer', 'mixed'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPayment(m)}
                className={`rounded-md px-1 py-3 text-sm font-bold sm:text-base ${payment === m ? 'bg-navy text-white' : 'border-[1.5px] border-line bg-white text-navy'}`}
              >
                {m === 'cash' ? 'ເງິນສົດ' : m === 'transfer' ? 'ໂອນ' : 'ສົດ + ໂອນ'}
              </button>
            ))}
          </div>
          {payment === 'mixed' && (
            <div className="space-y-2 rounded-md border-[1.5px] border-line bg-white p-2.5">
              <div className="flex items-center gap-2">
                <label htmlFor="transfer" className="w-20 shrink-0 text-sm font-semibold text-navy">
                  ຍອດໂອນ
                </label>
                <input
                  id="transfer"
                  className="input text-right font-bold"
                  inputMode="numeric"
                  value={transfer ? Number(transfer).toLocaleString('en-US') : ''}
                  onChange={(e) => setTransfer(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
                  placeholder="ຈຳນວນທີ່ໂອນ"
                />
              </div>
              <p className={`flex justify-between text-sm font-bold ${splitInvalid && transfer ? 'text-danger' : 'text-navy'}`}>
                <span>{splitInvalid && transfer ? 'ຍອດໂອນຕ້ອງໜ້ອຍກວ່າຍອດຊຳລະ' : 'ຈ່າຍເງິນສົດອີກ'}</span>
                <span>{splitInvalid && transfer ? '' : formatKip(cashDue)}</span>
              </p>
            </div>
          )}
          {payment !== 'transfer' && !(payment === 'mixed' && splitInvalid) && (
            <div className="space-y-2 rounded-md border-[1.5px] border-line bg-white p-2.5">
              <div className="flex items-center gap-2">
                <label htmlFor="cash" className="w-20 shrink-0 text-sm font-semibold text-navy">
                  ຮັບເງິນມາ
                </label>
                <input
                  id="cash"
                  className="input text-right font-bold"
                  inputMode="numeric"
                  value={cash ? Number(cash).toLocaleString('en-US') : ''}
                  onChange={(e) => setCash(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
                  placeholder="ບໍ່ບັງຄັບ"
                />
              </div>
              {cashDue > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[cashDue, ...cashSuggestions].map((v, i) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCash(String(v))}
                      className="rounded-md bg-mist px-2.5 py-1 text-xs font-semibold text-navy hover:bg-butter"
                    >
                      {i === 0 ? 'ພໍດີ' : v.toLocaleString('en-US')}
                    </button>
                  ))}
                </div>
              )}
              {cashValue !== null && (
                <p className={`flex justify-between text-sm font-bold ${cashShort ? 'text-danger' : 'text-success'}`}>
                  <span>{cashShort ? 'ເງິນບໍ່ພໍ ຂາດອີກ' : 'ເງິນທອນ'}</span>
                  <span>{formatKip(Math.abs(cashValue - cashDue))}</span>
                </p>
              )}
            </div>
          )}
          <button
            className="flex w-full items-center justify-center gap-2 rounded-md bg-butter py-3.5 text-lg font-bold text-navy hover:bg-butter-deep disabled:opacity-50"
            onClick={checkout}
            disabled={busy || lines.length === 0 || cashShort || splitInvalid}
          >
            <CashIcon size={22} /> {busy ? 'ກຳລັງບັນທຶກ...' : 'ຊຳລະເງິນ'}
          </button>
        </div>
      </section>

      {/* Phones: the bill sits below the products, so a cart bar stays at the bottom. */}
      <button
        type="button"
        onClick={() => billRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className="fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-xl bg-navy px-4 py-3 text-white shadow-lg xl:hidden"
      >
        <span ref={cartBarRef} className="relative inline-flex">
          <BagIcon size={24} />
          {itemCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-butter px-1 text-xs font-bold text-navy">
              {itemCount}
            </span>
          )}
        </span>
        <span className="font-semibold">{itemCount > 0 ? `${itemCount} ລາຍການ` : 'ບິນຍັງວ່າງ'}</span>
        <span className="ml-auto font-bold text-butter">{formatKip(subtotal - discountValue)}</span>
        <span className="text-sm text-white/80">ເບິ່ງບິນ ›</span>
      </button>

      {camera && <CameraScanner continuous title="ສະແກນຂາຍ" onScan={handleScan} onClose={() => setCamera(false)} />}

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
                  <button key={v.id} className="chip" disabled={v.stock === 0} onClick={() => addVariant(picking, v, pickedTile.current)}>
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
