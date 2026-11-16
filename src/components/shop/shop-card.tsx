'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { EyeIcon, PlusIcon } from '@/components/icons'
import { flyToCart, pulse } from '@/lib/fly-to-cart'
import { activeVariants, formatKip, imageUrl, minPrice, sortedImages, totalStock, variantPrice } from '@/lib/format'
import type { ProductWithRelations, Variant } from '@/lib/types'
import { useCart } from './cart'
import { TileBody } from './tile-body'

const cartIcon = () => document.querySelector('[data-cart-target]')

/**
 * Storefront card: tapping it puts the product straight into the cart (with the
 * fly-to-cart animation). Products with several models/colours ask which one first.
 * The eye button opens the full product page.
 */
export function ShopCard({ product }: { product: ProductWithRelations }) {
  const { add, items } = useCart()
  const tile = useRef<HTMLDivElement>(null)
  const [picking, setPicking] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const cover = sortedImages(product)[0]
  const variants = activeVariants(product)
  const stock = totalStock(product)
  const price = minPrice(product)
  const hasRange = new Set(variants.map((v) => variantPrice(product, v))).size > 1
  const onSale = !!product.compare_at_lak && product.compare_at_lak > price
  const inCart = (v: Variant) => items.find((i) => i.variantId === v.id)?.qty ?? 0

  useEffect(() => {
    if (!note) return
    const id = setTimeout(() => setNote(null), 1600)
    return () => clearTimeout(id)
  }, [note])

  function addVariant(v: Variant) {
    setPicking(false)
    if (inCart(v) >= v.stock) {
      setNote('ຄົບຈຳນວນທີ່ມີແລ້ວ')
      return
    }
    add(
      {
        variantId: v.id,
        productId: product.id,
        slug: product.slug,
        productName: product.name,
        variantName: v.name,
        price: variantPrice(product, v),
        image: cover?.path ?? null,
        stock: v.stock,
      },
      1,
    )
    flyToCart(tile.current, cartIcon())
  }

  function onTap() {
    if (stock === 0) {
      setNote('ສິນຄ້າໝົດຊົ່ວຄາວ')
      if (tile.current) pulse(tile.current)
      return
    }
    const available = variants.filter((v) => v.stock > 0)
    if (variants.length === 1 && available[0]) addVariant(available[0])
    else setPicking(true)
  }

  return (
    <>
      <div
        ref={tile}
        role="button"
        tabIndex={0}
        aria-label={`ໃສ່ກະຕ່າ: ${product.name}`}
        onClick={onTap}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onTap()
          }
        }}
        className={`pcard relative cursor-pointer select-none active:scale-[0.98] ${stock === 0 ? 'opacity-70' : ''}`}
      >
        <TileBody
          name={product.name}
          category={product.categories?.name}
          image={cover?.path}
          price={formatKip(price)}
          priceNote={hasRange ? 'ເລີ່ມ' : undefined}
          stock={stock}
          badge={
            onSale && (
              <span className="absolute right-2 top-2 z-[1] rounded-md bg-butter px-2 py-0.5 text-xs font-bold text-navy">
                SALE
              </span>
            )
          }
        />
        <div className="flex gap-1.5 bg-navy px-2 pb-2">
          <Link
            href={`/p/${product.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-white/15 text-xs font-semibold text-white hover:bg-white/25"
          >
            <EyeIcon size={16} /> ລາຍລະອຽດ
          </Link>
          <span
            aria-hidden
            className={`flex h-9 w-11 items-center justify-center rounded-lg ${stock === 0 ? 'bg-white/10 text-white/40' : 'bg-butter text-navy'}`}
          >
            <PlusIcon size={18} />
          </span>
        </div>
        {note && (
          <span className="pointer-events-none absolute inset-x-2 top-2 z-[2] rounded-lg bg-ink/85 px-2 py-1.5 text-center text-xs font-semibold text-white">
            {note}
          </span>
        )}
      </div>

      {picking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center" onClick={() => setPicking(false)}>
          <div
            className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <Image src={imageUrl(cover?.path)} alt="" width={56} height={56} className="h-14 w-14 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-bold text-navy">{product.name}</p>
                <p className="text-sm text-muted">ເລືອກລຸ້ນ / ສີ</p>
              </div>
            </div>
            <div className="grid max-h-[50dvh] grid-cols-2 gap-2 overflow-y-auto">
              {variants.map((v) => {
                const left = v.stock - inCart(v)
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={left < 1}
                    onClick={() => addVariant(v)}
                    className="rounded-xl border-[1.5px] border-line p-3 text-left hover:border-navy disabled:opacity-40"
                  >
                    <span className="block font-semibold">{v.name}</span>
                    <span className="block text-sm font-bold text-navy">{formatKip(variantPrice(product, v))}</span>
                    <span className="block text-xs text-muted">
                      {v.stock === 0 ? 'ໝົດ' : left < 1 ? 'ຢູ່ໃນກະຕ່າຄົບແລ້ວ' : `ມີ ${v.stock} ຊິ້ນ`}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setPicking(false)}>
                ປິດ
              </button>
              <Link href={`/p/${product.slug}`} className="btn btn-ghost">
                <EyeIcon size={18} /> ລາຍລະອຽດ
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
