import { createClient } from '@/lib/supabase/server'
import { PRODUCT_SELECT, type ProductWithRelations } from '@/lib/types'
import { PosTerminal } from './pos-terminal'

export default async function PosPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select(PRODUCT_SELECT).order('name')
  return (
    <PosTerminal products={(data as unknown as ProductWithRelations[]) ?? []} />
  )
}
