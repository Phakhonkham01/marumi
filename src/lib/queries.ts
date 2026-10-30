import 'server-only'
import { createPublicClient } from './supabase/server'
import { PRODUCT_SELECT, type Category, type DeviceModel, type ProductWithRelations } from './types'

export async function getCategories(): Promise<Category[]> {
  const { data } = await (await createPublicClient()).from('categories').select('*').order('sort')
  return data ?? []
}

export async function getDeviceModels(): Promise<DeviceModel[]> {
  const { data } = await (await createPublicClient()).from('device_models').select('*').order('brand').order('sort')
  return data ?? []
}

type ListOptions = {
  categoryId?: number
  deviceModelId?: number
  q?: string
  featured?: boolean
  limit?: number
}

export async function listProducts(opts: ListOptions = {}): Promise<ProductWithRelations[]> {
  // With a device filter, embed only that model's variants so cards show its price and stock.
  const select = opts.deviceModelId
    ? PRODUCT_SELECT.replace('product_variants(', 'product_variants!inner(')
    : PRODUCT_SELECT
  let query = (await createPublicClient()).from('products').select(select).eq('is_active', true)

  if (opts.categoryId) query = query.eq('category_id', opts.categoryId)
  if (opts.deviceModelId) query = query.eq('product_variants.device_model_id', opts.deviceModelId)
  if (opts.featured) query = query.eq('is_featured', true)
  if (opts.q) {
    const term = opts.q.replace(/[%_,()]/g, ' ').trim()
    if (term) query = query.ilike('name', `%${term}%`)
  }

  const { data } = await query.order('created_at', { ascending: false }).limit(opts.limit ?? 60)
  return (data as unknown as ProductWithRelations[]) ?? []
}

export async function getProduct(slug: string): Promise<ProductWithRelations | null> {
  const { data } = await (await createPublicClient())
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  return (data as unknown as ProductWithRelations) ?? null
}
