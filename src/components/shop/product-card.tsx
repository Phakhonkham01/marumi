import Image from 'next/image'
import Link from 'next/link'
import { formatKip, imageUrl, minPrice, sortedImages, totalStock } from '@/lib/format'
import type { ProductWithRelations } from '@/lib/types'

/** SaArdPOS-style tile body: category tag, square photo, navy footer with name, price and stock. */
export function TileBody({
  name,
  category,
  image,
  price,
  priceNote,
  stock,
  badge,
}: {
  name: string
  category?: string | null
  image?: string | null
  price: string
  priceNote?: string
  stock: number
  badge?: React.ReactNode
}) {
  return (
    <>
      <div className="relative aspect-[4/3] bg-white">
        {category && <span className="pcard-tag">{category}</span>}
        {badge}
        <Image
          src={imageUrl(image)}
          alt={name}
          fill
          sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw"
          className={image ? 'object-cover' : 'object-contain p-8 opacity-40 grayscale'}
        />
      </div>
      <div className="pcard-foot">
        <p className="truncate text-sm font-semibold">{name}</p>
        <hr />
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-bold">
            {priceNote && <span className="text-xs font-normal text-white/70">{priceNote} </span>}
            {price}
          </span>
          <span className={`text-xs font-semibold ${stock === 0 ? 'text-blush' : 'text-white/80'}`}>
            {stock === 0 ? 'ໝົດ' : `Stock ${stock}`}
          </span>
        </div>
      </div>
    </>
  )
}

export function ProductCard({ product }: { product: ProductWithRelations }) {
  const cover = sortedImages(product)[0]
  const stock = totalStock(product)
  const price = minPrice(product)
  const hasRange = new Set(product.product_variants.map((v) => v.price_lak ?? product.price_lak)).size > 1
  const onSale = !!product.compare_at_lak && product.compare_at_lak > price

  return (
    <Link href={`/p/${product.slug}`} className={`pcard ${stock === 0 ? 'opacity-70' : ''}`}>
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
    </Link>
  )
}

export function ProductGrid({ products }: { products: ProductWithRelations[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
