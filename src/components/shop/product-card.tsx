import Image from 'next/image'
import type { ProductWithRelations } from '@/lib/types'
import { ShopCard } from './shop-card'

export { TileBody } from './tile-body'

export function ProductGrid({ products }: { products: ProductWithRelations[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {products.map((p) => (
        <ShopCard key={p.id} product={p} />
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
