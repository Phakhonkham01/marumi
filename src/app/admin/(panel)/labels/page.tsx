import { createClient } from '@/lib/supabase/server'
import { ADMIN_PRODUCT_SELECT, type ProductWithRelations } from '@/lib/types'
import { LabelSheet } from './label-sheet'

/** Barcode sticker printing. `?items=12:5,13:2` preselects variant 12 ×5 and 13 ×2. */
export default async function LabelsPage(props: PageProps<'/admin/labels'>) {
  const { items } = await props.searchParams
  const supabase = await createClient()
  const { data } = await supabase.from('products').select(ADMIN_PRODUCT_SELECT).order('name')

  const initial = (typeof items === 'string' ? items : '')
    .split(',')
    .map((pair) => pair.split(':').map(Number))
    .filter(([id]) => Number.isInteger(id) && id > 0)
    .map(([id, qty]) => ({ variantId: id, qty: Number.isInteger(qty) && qty > 0 ? Math.min(qty, 500) : 1 }))

  return <LabelSheet products={(data as unknown as ProductWithRelations[]) ?? []} initial={initial} />
}
