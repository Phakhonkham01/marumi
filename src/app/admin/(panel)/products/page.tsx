import Image from 'next/image'
import Link from 'next/link'
import { BoxIcon, EditIcon, PlusIcon } from '@/components/icons'
import { formatDateTime } from '@/lib/dates'
import { formatKip, imageUrl, minPrice, sortedImages } from '@/lib/format'
import { getCategories } from '@/lib/queries'
import { createClient, getStaffSession } from '@/lib/supabase/server'
import { PRODUCT_SELECT, type ProductWithRelations } from '@/lib/types'

export default async function AdminProductsPage(props: PageProps<'/admin/products'>) {
  const sp = await props.searchParams
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const categoryId = Number(sp.category) || undefined
  const session = (await getStaffSession())!
  const isOwner = session.role === 'owner'
  const supabase = await createClient()

  let query = supabase.from('products').select(PRODUCT_SELECT).order('created_at', { ascending: false })
  if (q) query = query.ilike('name', `%${q.replace(/[%_,()]/g, ' ')}%`)
  if (categoryId) query = query.eq('category_id', categoryId)
  const [{ data }, categories, { data: costRows }] = await Promise.all([
    query,
    getCategories(),
    isOwner ? supabase.from('variant_costs').select('variant_id, cost_lak') : Promise.resolve({ data: [] }),
  ])

  const products = (data as unknown as ProductWithRelations[]) ?? []
  const costs = new Map(((costRows as { variant_id: number; cost_lak: number }[]) ?? []).map((c) => [c.variant_id, c.cost_lak]))

  return (
    <section className="panel">
      <form className="panel-head">
        <span className="panel-title">
          <BoxIcon size={22} /> ລາຍການສິນຄ້າ ({products.length})
        </span>
        <div className="panel-search w-full sm:w-72">
          <input name="q" defaultValue={q} placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ..." enterKeyHint="search" aria-label="ຄົ້ນຫາ" />
          <button type="submit">ຄົ້ນຫາ</button>
        </div>
        <select name="category" defaultValue={categoryId ?? ''} aria-label="ໝວດສິນຄ້າ">
          <option value="">ທຸກໝວດສິນຄ້າ</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="panel-btn">
          ກອງ
        </button>
        <Link href="/admin/products/new" className="panel-btn">
          <PlusIcon size={18} /> ເພີ່ມສິນຄ້າໃໝ່
        </Link>
      </form>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-16 text-center!">ຮູບ</th>
              <th>ຊື່ສິນຄ້າ</th>
              <th>ໝວດ</th>
              <th className="text-center!">ຕົວເລືອກ</th>
              {isOwner && <th className="text-right!">ຕົ້ນທຶນ</th>}
              <th className="text-right!">ລາຄາຂາຍ</th>
              {isOwner && <th className="text-right!">ກຳໄລ</th>}
              <th className="text-right!">ສະຕັອກ</th>
              <th>ສະຖານະ</th>
              <th>ເພີ່ມເມື່ອ</th>
              <th>ແກ້ໄຂລ່າສຸດ</th>
              <th className="text-center!">ຈັດການ</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const active = p.product_variants.filter((v) => v.is_active)
              const stock = active.reduce((n, v) => n + v.stock, 0)
              const price = minPrice(p)
              const variantCosts = active.map((v) => costs.get(v.id)).filter((c): c is number => c != null)
              const cost = variantCosts.length ? Math.min(...variantCosts) : null
              return (
                <tr key={p.id}>
                  <td className="text-center">
                    <div className="relative mx-auto h-11 w-11 overflow-hidden rounded-md border border-line bg-mist">
                      <Image src={imageUrl(sortedImages(p)[0]?.path)} alt="" fill sizes="44px" className="object-cover" />
                    </div>
                  </td>
                  <td>
                    <Link href={`/admin/products/${p.id}`} className="font-semibold text-navy hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">{p.categories?.name ?? '—'}</td>
                  <td className="text-center">{p.product_variants.length}</td>
                  {isOwner && <td className="num">{cost == null ? '—' : formatKip(cost)}</td>}
                  <td className="num font-semibold">{formatKip(price)}</td>
                  {isOwner && (
                    <td className="num font-semibold text-success">{cost == null ? '—' : `+${formatKip(price - cost)}`}</td>
                  )}
                  <td className={`num font-bold ${stock === 0 ? 'text-danger' : stock <= 3 ? 'text-[#b7791f]' : ''}`}>{stock}</td>
                  <td className="whitespace-nowrap">
                    {p.is_active ? (
                      <span className="rounded bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">ເປີດຂາຍ</span>
                    ) : (
                      <span className="rounded bg-ink/10 px-2 py-0.5 text-xs font-semibold text-muted">ຊ່ອນຢູ່</span>
                    )}
                    {p.is_featured && <span className="ml-1 rounded bg-butter px-2 py-0.5 text-xs font-semibold text-navy">ແນະນຳ</span>}
                  </td>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(p.created_at)}</td>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(p.updated_at)}</td>
                  <td className="text-center">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="inline-flex items-center gap-1 rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-soft"
                    >
                      <EditIcon size={14} /> ແກ້ໄຂ
                    </Link>
                  </td>
                </tr>
              )
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={isOwner ? 12 : 10} className="py-10 text-center text-muted">
                  ບໍ່ມີສິນຄ້າ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
