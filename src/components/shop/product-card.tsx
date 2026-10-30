import Image from 'next/image'
import Link from 'next/link'
import { formatKip, imageUrl, minPrice, sortedImages, totalStock } from '@/lib/format'
import type { ProductWithRelations } from '@/lib/types'

export function ProductCard({ product }: { product: ProductWithRelations }) {
  const cover = sortedImages(product)[0]
  const stock = totalStock(product)
  const price = minPrice(product)
  const hasRange = new Set(product.product_variants.map((v) => v.price_lak ?? product.price_lak)).size > 1

  return (
    <Link href={`/p/${product.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-sky">
      <div className="relative aspect-square bg-mist">
        <Image
          src={imageUrl(cover?.path)}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className={cover ? 'object-cover' : 'object-contain p-8 opacity-60'}
        />
        {stock === 0 ? (
          <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-semibold text-white">
            ໝົດຊົ່ວຄາວ
          </span>
        ) : stock <= 3 ? (
          <span className="absolute left-2 top-2 rounded-full bg-blush px-2.5 py-1 text-xs font-semibold text-ink">
            ເຫຼືອ {stock} ຊິ້ນ
          </span>
        ) : null}
        {product.compare_at_lak && product.compare_at_lak > price && (
          <span className="absolute right-2 top-2 rounded-full border border-navy bg-butter px-2.5 py-1 text-xs font-bold text-navy">
            SALE
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 font-semibold leading-snug">{product.name}</p>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2">
          <span className="font-bold text-navy">
            {hasRange && <span className="text-xs font-normal text-muted">ເລີ່ມ </span>}
            {formatKip(price)}
          </span>
          {product.compare_at_lak && product.compare_at_lak > price && (
            <span className="text-xs text-muted line-through">{formatKip(product.compare_at_lak)}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

export function ProductGrid({ products }: { products: ProductWithRelations[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="bg-waves flex flex-col items-center gap-3 rounded-[var(--radius-card)] px-6 py-14 text-center">
      <Image src="/logo.jpg" alt="" width={96} height={96} className="rounded-full ring-4 ring-white" />
      <p className="text-lg font-semibold text-navy">{title}</p>
      {children}
    </div>
  )
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="aspect-square animate-pulse bg-mist" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-3/4 animate-pulse rounded bg-mist" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-mist" />
          </div>
        </div>
      ))}
    </div>
  )
}
