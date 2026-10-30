import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { DevicePicker } from '@/components/shop/device-picker'
import { EmptyState, GridSkeleton, ProductGrid } from '@/components/shop/product-card'
import { getCategories, getDeviceModels, listProducts } from '@/lib/queries'

export const metadata: Metadata = { title: 'ສິນຄ້າທັງໝົດ' }

export default function ProductsPage(props: PageProps<'/products'>) {
  return (
    <Suspense fallback={<GridSkeleton count={12} />}>
      <ProductList searchParams={props.searchParams} />
    </Suspense>
  )
}

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function ProductList({ searchParams }: { searchParams: PageProps<'/products'>['searchParams'] }) {
  const sp = await searchParams
  const categorySlug = param(sp.category)
  const deviceId = Number(param(sp.device)) || undefined
  const q = param(sp.q)?.trim() || undefined

  const [categories, models] = await Promise.all([getCategories(), getDeviceModels()])
  const category = categories.find((c) => c.slug === categorySlug)
  const device = models.find((m) => m.id === deviceId)
  const products = await listProducts({ categoryId: category?.id, deviceModelId: device?.id, q })

  const link = (next: { category?: string | null }) => {
    const params = new URLSearchParams()
    const cat = next.category === undefined ? categorySlug : next.category
    if (cat) params.set('category', cat)
    if (deviceId) params.set('device', String(deviceId))
    if (q) params.set('q', q)
    const qs = params.toString()
    return qs ? `/products?${qs}` : '/products'
  }

  const baseQuery = new URLSearchParams(
    Object.entries({ category: categorySlug, q }).filter((e): e is [string, string] => !!e[1]),
  ).toString()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">
          {q ? `ຜົນການຊອກຫາ “${q}”` : (category?.name ?? 'ສິນຄ້າທັງໝົດ')}
        </h1>
        <p className="text-sm text-muted">
          {products.length} ລາຍການ{device ? ` · ໃຊ້ກັບ ${device.name}` : ''}
        </p>
      </div>

      <DevicePicker models={models} value={device?.id} baseQuery={baseQuery} />

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <Link href={link({ category: null })} className="chip" data-active={!category}>
          ທັງໝົດ
        </Link>
        {categories.map((c) => (
          <Link key={c.id} href={link({ category: c.slug })} className="chip" data-active={c.id === category?.id}>
            {c.name}
          </Link>
        ))}
      </div>

      {products.length ? (
        <ProductGrid products={products} />
      ) : (
        <EmptyState title="ບໍ່ພົບສິນຄ້າທີ່ຊອກຫາ">
          <p className="text-sm text-muted">ລອງປ່ຽນຄຳຄົ້ນຫາ ຫຼື ທັກຖາມຮ້ານໄດ້ເລີຍ</p>
          <Link href="/products" className="btn btn-ghost btn-sm">
            ລ້າງຕົວກອງ
          </Link>
        </EmptyState>
      )}
    </div>
  )
}
