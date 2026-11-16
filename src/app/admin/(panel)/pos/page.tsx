import { hasPermission } from '@/lib/permissions'
import { createClient, requirePermission } from '@/lib/supabase/server'
import { ADMIN_PRODUCT_SELECT, type ProductWithRelations } from '@/lib/types'
import { PosTerminal } from './pos-terminal'

export default async function PosPage() {
  const session = await requirePermission('pos')
  const supabase = await createClient()
  const { data } = await supabase.from('products').select(ADMIN_PRODUCT_SELECT).order('name')
  return (
    <PosTerminal products={(data as unknown as ProductWithRelations[]) ?? []} canDiscount={hasPermission(session, 'discount')} />
  )
}
