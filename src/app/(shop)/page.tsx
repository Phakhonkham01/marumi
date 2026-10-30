import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { DevicePicker } from '@/components/shop/device-picker'
import { EmptyState, GridSkeleton, ProductGrid } from '@/components/shop/product-card'
import { SHOP } from '@/lib/format'
import { getCategories, getDeviceModels, listProducts } from '@/lib/queries'

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="bg-waves relative overflow-hidden rounded-[var(--radius-card)] border-[1.5px] border-sky px-5 py-8 sm:px-10 sm:py-12">
        <div className="relative z-10 max-w-md space-y-4">
          <p className="inline-block rounded-full border border-navy bg-butter px-3 py-1 text-sm font-semibold text-navy">
            ✿ ເຄສໂທລະສັບ · ເຄສ AirPods · ແບັດສຳຮອງ ✿
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight text-navy sm:text-4xl">
            {SHOP.name}
            <span className="mt-1 block text-2xl sm:text-3xl">{SHOP.nameLo}</span>
          </h1>
          <p className="pr-16 text-ink/80 sm:pr-0">{SHOP.tagline}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/products" className="btn btn-primary">
              ເບິ່ງສິນຄ້າທັງໝົດ
            </Link>
          </div>
        </div>
        <Image
          src="/logo.jpg"
          alt=""
          width={220}
          height={220}
          priority
          className="absolute -bottom-10 -right-10 w-32 rounded-full ring-8 ring-white/70 sm:right-8 sm:top-1/2 sm:bottom-auto sm:w-56 sm:-translate-y-1/2"
        />
      </section>

      <Suspense fallback={<div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-mist" />}>
        <Browse />
      </Suspense>

      <Suspense fallback={<GridSkeleton />}>
        <ProductSections />
      </Suspense>
    </div>
  )
}

async function Browse() {
  const [categories, models] = await Promise.all([getCategories(), getDeviceModels()])
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-navy">ຊອກເຄສໃຫ້ກົງລຸ້ນ</h2>
      <DevicePicker models={models} />
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pt-1">
        {categories.map((c) => (
          <Link key={c.id} href={`/products?category=${c.slug}`} className="chip hover:border-sky">
            {c.name}
          </Link>
        ))}
      </div>
    </section>
  )
}

async function ProductSections() {
  const [featured, latest] = await Promise.all([
    listProducts({ featured: true, limit: 8 }),
    listProducts({ limit: 12 }),
  ])

  if (latest.length === 0) {
    return <EmptyState title="ກຳລັງຈັດສິນຄ້າລົງຮ້ານ ກັບມາເບິ່ງໃໝ່ໄວໆນີ້" />
  }

  return (
    <div className="space-y-10">
      {featured.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-navy">⭐ ສິນຄ້າແນະນຳ</h2>
          <ProductGrid products={featured} />
        </section>
      )}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy">ມາໃໝ່</h2>
          <Link href="/products" className="text-sm font-semibold text-navy-soft">
            ເບິ່ງທັງໝົດ →
          </Link>
        </div>
        <ProductGrid products={latest} />
      </section>
    </div>
  )
}
