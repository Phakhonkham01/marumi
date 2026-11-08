import Image from 'next/image'
import Link from 'next/link'
import { EditIcon, PlusIcon } from '@/components/icons'
import { formatKip, imageUrl, minPrice, sortedImages } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { PRODUCT_SELECT, type Category, type ProductWithRelations } from '@/lib/types'

export default async function AdminProductsPage(props: PageProps<'/admin/products'>) {
  const sp = await props.searchParams
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const supabase = await createClient()

  let query = supabase.from('products').select(PRODUCT_SELECT).order('created_at', { ascending: false })
  if (q) query = query.ilike('name', `%${q.replace(/[%_,()]/g, ' ')}%`)
  const [{ data }, { data: categories }] = await Promise.all([query, supabase.from('categories').select('*')])

  const products = (data as unknown as ProductWithRelations[]) ?? []
  const categoryName = new Map((categories as Category[] | null)?.map((c) => [c.id, c.name]))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy">ສິນຄ້າ ({products.length})</h1>
        <Link href="/admin/products/new" className="btn btn-primary">
          <PlusIcon size={18} /> ເພີ່ມສິນຄ້າ
        </Link>
      </div>

      <form>
        <input name="q" defaultValue={q} className="input" placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ..." enterKeyHint="search" />
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => {
          const stock = p.product_variants.filter((v) => v.is_active).reduce((n, v) => n + v.stock, 0)
          return (
            <article key={p.id} className="card overflow-hidden transition-shadow hover:shadow-md">
              <Link href={`/admin/products/${p.id}`} className="block">
                <div className="relative aspect-[4/3] bg-mist">
                  <Image
                    src={imageUrl(sortedImages(p)[0]?.path)}
                    alt={p.name}
                    fill
                    sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              </Link>
              <div className="space-y-3 p-4">
                <div className="min-w-0">
                  <Link href={`/admin/products/${p.id}`} className="block truncate font-semibold text-navy hover:underline">
                    {p.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {categoryName.get(p.category_id ?? -1) ?? 'ບໍ່ມີໝວດ'} · {p.product_variants.length} ຕົວເລືອກ
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-navy">{formatKip(minPrice(p))}</p>
                    <p className={`text-xs font-semibold ${stock === 0 ? 'text-danger' : 'text-muted'}`}>ສະຕັອກ {stock}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1">
                    {!p.is_active && <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs">ຊ່ອນຢູ່</span>}
                    {p.is_featured && <span className="rounded-full bg-butter px-2 py-0.5 text-xs">⭐ ແນະນຳ</span>}
                  </div>
                  <Link href={`/admin/products/${p.id}`} className="btn btn-secondary px-3 py-2 text-sm">
                    <EditIcon size={16} /> ແກ້ໄຂ
                  </Link>
                </div>
              </div>
            </article>
          )
        })}
        {products.length === 0 && <p className="card p-6 text-center text-muted sm:col-span-2 xl:col-span-3">ຍັງບໍ່ມີສິນຄ້າ</p>}
      </div>
    </div>
  )
}
