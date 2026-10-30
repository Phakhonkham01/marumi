'use server'

import { errorMessage } from '@/lib/format'
import { createPublicClient } from '@/lib/supabase/server'

export type CheckoutState = { error?: string; code?: string; values?: Record<string, string> }

export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  let items: { variant_id: number; qty: number }[]
  try {
    items = JSON.parse(String(formData.get('items') ?? '[]'))
  } catch {
    return { error: errorMessage('invalid_items') }
  }

  const customer = {
    name: String(formData.get('name') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    delivery_method: String(formData.get('delivery_method') ?? 'pickup'),
    address: String(formData.get('address') ?? ''),
    payment_method: String(formData.get('payment_method') ?? 'transfer'),
    note: String(formData.get('note') ?? ''),
    payment_slip_path: String(formData.get('payment_slip_path') ?? ''),
  }

  const { data, error } = await (await createPublicClient()).rpc('place_order', {
    p_customer: customer,
    p_items: items.map((i) => ({ variant_id: Number(i.variant_id), qty: Number(i.qty) })),
  })
  if (error) return { error: errorMessage(error.message), values: customer }
  return { code: data as string }
}
