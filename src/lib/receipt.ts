import type { SupabaseClient } from '@supabase/supabase-js'
import type { Order, OrderItem } from '@/lib/types'

export type ReceiptData = { order: Order; items: OrderItem[]; cashier: string | null }

/** Loads one bill with its lines and the staff member who rang it up. */
export async function fetchReceipt(supabase: SupabaseClient, code: string): Promise<ReceiptData | null> {
  const { data: order } = await supabase.from('orders').select('*').eq('code', code).maybeSingle()
  if (!order) return null
  const [{ data: items }, { data: profile }] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', order.id).order('id'),
    order.created_by
      ? supabase.from('profiles').select('display_name').eq('id', order.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return { order: order as Order, items: (items as OrderItem[]) ?? [], cashier: profile?.display_name || null }
}
