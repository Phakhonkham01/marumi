'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ChatIcon, MinusIcon, PlusIcon } from '@/components/icons'
import { formatKip, imageUrl, variantPrice, whatsappLink } from '@/lib/format'
import type { Product, ProductImage, Variant } from '@/lib/types'
import { useCart } from './cart'

export function Gallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [active, setActive] = useState(0)
  const current = images[active]
  return (
    <div className="space-y-2">
      <div className="card relative aspect-square overflow-hidden bg-mist">
        <Image
          src={imageUrl(current?.path)}
          alt={name}
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className={current ? 'object-cover' : 'object-contain p-16 opacity-60'}
        />
      </div>
      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${i === active ? 'border-navy' : 'border-transparent'}`}
              aria-label={`ຮູບທີ ${i + 1}`}
            >
              <Image src={imageUrl(img.path)} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function BuyBox({
  product,
  variants,
  cover,
  pageUrl,
}: {
  product: Product
  variants: Variant[]
  cover: string | null
  pageUrl: string
}) {
  const { add, items } = useCart()
  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0]
  const [variantId, setVariantId] = useState(firstInStock?.id)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  const variant = variants.find((v) => v.id === variantId)
  const price = variantPrice(product, variant)
  const inCart = items.find((i) => i.variantId === variantId)?.qty ?? 0
  const available = Math.max(0, (variant?.stock ?? 0) - inCart)
  const showPicker = variants.length > 1

  function onAdd() {
    if (!variant || available < 1) return
    add(
      {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        productName: product.name,
        variantName: variant.name,
        price,
        image: cover,
        stock: variant.stock,
      },
      Math.min(qty, available),
    )
    setQty(1)
    setAdded(true)
  }

  const askText = `ສະບາຍດີ ສົນໃຈ ${product.name}${showPicker && variant ? ` (${variant.name})` : ''}\n${pageUrl}`

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold leading-snug text-ink">{product.name}</h1>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-2xl font-bold text-navy">{formatKip(price)}</span>
          {product.compare_at_lak && product.compare_at_lak > price && (
            <span className="text-muted line-through">{formatKip(product.compare_at_lak)}</span>
          )}
        </div>
      </div>

      {showPicker && (
        <div>
          <p className="label">ເລືອກລຸ້ນ / ສີ</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setVariantId(v.id)
                  setQty(1)
                  setAdded(false)
                }}
                disabled={v.stock === 0}
                className="chip disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through"
                data-active={v.id === variantId}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className={`text-sm font-semibold ${variant && variant.stock > 0 ? 'text-success' : 'text-danger'}`}>
        {variant && variant.stock > 0 ? `ມີສິນຄ້າ ${variant.stock} ຊິ້ນ` : 'ສິນຄ້າໝົດຊົ່ວຄາວ'}
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-full border-[1.5px] border-line bg-white">
          <button className="p-3" onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="ຫຼຸດຈຳນວນ">
            <MinusIcon size={16} />
          </button>
          <span className="w-8 text-center font-semibold">{qty}</span>
          <button
            className="p-3"
            onClick={() => setQty((n) => Math.min(Math.max(available, 1), n + 1))}
            aria-label="ເພີ່ມຈຳນວນ"
          >
            <PlusIcon size={16} />
          </button>
        </div>
        <button className="btn btn-primary flex-1" disabled={available < 1} onClick={onAdd}>
          {available < 1 && inCart > 0 ? 'ຢູ່ໃນກະຕ່າຄົບແລ້ວ' : 'ໃສ່ກະຕ່າ'}
        </button>
      </div>

      {added && (
        <div className="flex items-center justify-between rounded-2xl bg-mist px-4 py-3 text-sm">
          <span>✓ ເພີ່ມໃສ່ກະຕ່າແລ້ວ</span>
          <Link href="/cart" className="font-semibold text-navy underline">
            ໄປທີ່ກະຕ່າ
          </Link>
        </div>
      )}

      <a href={whatsappLink(askText)} target="_blank" rel="noreferrer" className="btn btn-ghost w-full">
        <ChatIcon size={18} /> ສອບຖາມທາງ WhatsApp
      </a>
    </div>
  )
}
