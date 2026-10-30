import { createClient } from '@/lib/supabase/server'
import { PRODUCT_SELECT, type ProductWithRelations } from '@/lib/types'
import { PosTerminal } from './pos-terminal'

export default async function PosPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select(PRODUCT_SELECT).order('name')
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">ຂາຍໜ້າຮ້ານ</h1>
      <PosTerminal products={(data as unknown as ProductWithRelations[]) ?? []} />
    </div>
  )
}
