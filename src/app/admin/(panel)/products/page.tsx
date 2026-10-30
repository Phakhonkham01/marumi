import Image from 'next/image'
import Link from 'next/link'
import { PlusIcon } from '@/components/icons'
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

      <div className="card divide-y divide-line">
        {products.map((p) => {
          const stock = p.product_variants.filter((v) => v.is_active).reduce((n, v) => n + v.stock, 0)
          return (
            <Link key={p.id} href={`/admin/products/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-mist/50">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-mist">
                <Image src={imageUrl(sortedImages(p)[0]?.path)} alt="" fill sizes="56px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {p.name}
                  {!p.is_active && <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-xs">ຊ່ອນຢູ່</span>}
                  {p.is_featured && <span className="ml-1 text-xs">⭐</span>}
                </p>
                <p className="text-xs text-muted">
                  {categoryName.get(p.category_id ?? -1) ?? 'ບໍ່ມີໝວດ'} · {p.product_variants.length} ຕົວເລືອກ
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-navy">{formatKip(minPrice(p))}</p>
                <p className={`text-xs font-semibold ${stock === 0 ? 'text-danger' : 'text-muted'}`}>ສະຕັອກ {stock}</p>
              </div>
            </Link>
          )
        })}
        {products.length === 0 && <p className="p-6 text-center text-muted">ຍັງບໍ່ມີສິນຄ້າ</p>}
      </div>
    </div>
  )
}
