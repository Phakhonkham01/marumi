import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductForm } from '@/components/admin/product-form'
import { StockPanel } from '@/components/admin/stock-panel'
import { ArrowLeftIcon } from '@/components/icons'
import { formatDateTime } from '@/lib/dates'
import { createClient, getStaffSession } from '@/lib/supabase/server'
import { PRODUCT_SELECT, type Category, type DeviceModel, type ProductWithRelations } from '@/lib/types'

const REASON_LABEL: Record<string, string> = {
  restock: 'ຮັບເຂົ້າ',
  sale: 'ຂາຍ',
  cancel: 'ຍົກເລີກອໍເດີ',
  adjust: 'ປັບສະຕັອກ',
}

type Movement = { id: number; variant_id: number; delta: number; reason: string; note: string | null; created_at: string }

export default async function EditProductPage(props: PageProps<'/admin/products/[id]'>) {
  const { id } = await props.params
  const session = (await getStaffSession())!
  const isOwner = session.role === 'owner'
  const supabase = await createClient()

  const { data } = await supabase.from('products').select(PRODUCT_SELECT).eq('id', Number(id)).maybeSingle()
  if (!data) notFound()
  const product = data as unknown as ProductWithRelations
  const variantIds = product.product_variants.map((v) => v.id)

  const [{ data: categories }, { data: models }, { data: costRows }, { data: movements }] = await Promise.all([
    supabase.from('categories').select('*').order('sort'),
    supabase.from('device_models').select('*').order('brand').order('sort'),
    isOwner
      ? supabase.from('variant_costs').select('variant_id, cost_lak').in('variant_id', variantIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('stock_movements')
      .select('id, variant_id, delta, reason, note, created_at')
      .in('variant_id', variantIds)
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  const costs: Record<number, number> = Object.fromEntries(
    ((costRows as { variant_id: number; cost_lak: number }[]) ?? []).map((c) => [c.variant_id, c.cost_lak]),
  )
  const variants = [...product.product_variants].sort((a, b) => a.sort - b.sort || a.id - b.id)
  const variantName = new Map(variants.map((v) => [v.id, v.name]))

  return (
    <div className="space-y-4">
      <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeftIcon size={16} /> ສິນຄ້າ
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-navy">{product.name}</h1>
        <Link href={`/p/${product.slug}`} target="_blank" className="text-sm text-navy-soft underline">
          ເບິ່ງໃນໜ້າຮ້ານ
        </Link>
      </div>

      <StockPanel variants={variants} costs={costs} isOwner={isOwner} />

      <ProductForm
        key={product.updated_at}
        product={product}
        categories={(categories as Category[]) ?? []}
        models={(models as DeviceModel[]) ?? []}
        costs={costs}
        isOwner={isOwner}
      />

      <section className="card p-4">
        <h2 className="mb-2 font-bold text-navy">ປະຫວັດສະຕັອກລ່າສຸດ</h2>
        {(movements as Movement[] | null)?.length ? (
          <ul className="divide-y divide-line text-sm">
            {(movements as Movement[]).map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <span className="w-28 shrink-0 text-xs text-muted">{formatDateTime(m.created_at)}</span>
                <span className="flex-1">
                  {REASON_LABEL[m.reason] ?? m.reason}
                  {variants.length > 1 && <span className="text-muted"> · {variantName.get(m.variant_id)}</span>}
                  {m.note && <span className="text-muted"> · {m.note}</span>}
                </span>
                <span className={`font-bold ${m.delta > 0 ? 'text-success' : 'text-danger'}`}>
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">ຍັງບໍ່ມີການເຄື່ອນໄຫວ</p>
        )}
      </section>
    </div>
  )
}
