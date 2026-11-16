/** Orders this browser placed, so customers can track them without retyping. Kept on the device only. */
export type SavedOrder = { code: string; phone: string; at: string }

const KEY = 'marumi-my-orders-v1'

export function savedOrders(): SavedOrder[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveOrder(code: string, phone: string) {
  try {
    const rest = savedOrders().filter((o) => o.code !== code)
    localStorage.setItem(KEY, JSON.stringify([{ code, phone, at: new Date().toISOString() }, ...rest].slice(0, 10)))
  } catch {
    // Private mode or storage full: tracking still works by typing code and phone.
  }
}

export type TrackedOrder = {
  code: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  channel: 'online' | 'store'
  delivery_method: 'pickup' | 'delivery'
  payment_method: 'cash' | 'transfer' | 'cod' | 'mixed'
  subtotal_lak: number
  discount_lak: number
  total_lak: number
  created_at: string
  confirmed_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  items: { product_name: string; variant_name: string; qty: number; unit_price_lak: number }[]
}
