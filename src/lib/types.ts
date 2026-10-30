export type Spec = { k: string; v: string }

export type Category = { id: number; name: string; slug: string; sort: number }

export type DeviceModel = { id: number; brand: string; name: string; sort: number }

export type ProductImage = { id: number; product_id: number; path: string; sort: number }

export type Variant = {
  id: number
  product_id: number
  name: string
  device_model_id: number | null
  price_lak: number | null
  stock: number
  sort: number
  is_active: boolean
}

export type Product = {
  id: number
  category_id: number | null
  name: string
  slug: string
  description: string
  price_lak: number
  compare_at_lak: number | null
  specs: Spec[]
  is_active: boolean
  is_featured: boolean
  created_at: string
  updated_at: string
}

export type ProductWithRelations = Product & {
  product_images: ProductImage[]
  product_variants: Variant[]
}

export type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'
export type OrderChannel = 'online' | 'store'
export type PaymentMethod = 'cash' | 'transfer' | 'cod'

export type Order = {
  id: number
  code: string
  channel: OrderChannel
  status: OrderStatus
  customer_name: string
  customer_phone: string | null
  delivery_method: 'pickup' | 'delivery'
  address: string | null
  note: string | null
  payment_method: PaymentMethod
  payment_slip_path: string | null
  subtotal_lak: number
  discount_lak: number
  total_lak: number
  created_at: string
}

export type OrderItem = {
  id: number
  order_id: number
  variant_id: number | null
  product_name: string
  variant_name: string
  qty: number
  unit_price_lak: number
}

/** Columns selected for product cards and detail pages. */
export const PRODUCT_SELECT =
  '*, product_images(id, product_id, path, sort), product_variants(id, product_id, name, device_model_id, price_lak, stock, sort, is_active)'
