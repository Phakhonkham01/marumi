import { createClient, getStaffSession } from '@/lib/supabase/server'
import { ADMIN_PRODUCT_SELECT, type ProductWithRelations } from '@/lib/types'
import { ReceiveTerminal } from './receive-terminal'

export default async function ReceivePage() {
  const session = (await getStaffSession())!
  const isOwner = session.role === 'owner'
  const supabase = await createClient()
  const [{ data }, { data: costRows }] = await Promise.all([
    supabase.from('products').select(ADMIN_PRODUCT_SELECT).order('name'),
    isOwner ? supabase.from('variant_costs').select('variant_id, cost_lak') : Promise.resolve({ data: [] }),
  ])
  const costs: Record<number, number> = Object.fromEntries(
    ((costRows as { variant_id: number; cost_lak: number }[]) ?? []).map((c) => [c.variant_id, c.cost_lak]),
  )
  return <ReceiveTerminal products={(data as unknown as ProductWithRelations[]) ?? []} costs={costs} isOwner={isOwner} />
}
