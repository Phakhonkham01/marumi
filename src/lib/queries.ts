import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { CATALOG_TAG } from './catalog'
import { createCatalogClient } from './supabase/server'
import { PRODUCT_SELECT, type Category, type DeviceModel, type ProductWithRelations } from './types'

// Storefront reads are cached on the server so customers never wait on Supabase.
// Admin changes call refreshCatalog() to expire them immediately; the timed
// revalidate is a safety net for changes made outside the admin (e.g. SQL editor).
function catalogCache() {
  cacheTag(CATALOG_TAG)
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 })
}

export async function getCategories(): Promise<Category[]> {
  'use cache'
  catalogCache()
  const { data } = await createCatalogClient().from('categories').select('*').order('sort')
  return data ?? []
}

export async function getDeviceModels(): Promise<DeviceModel[]> {
  'use cache'
  catalogCache()
  const { data } = await createCatalogClient().from('device_models').select('*').order('brand').order('sort')
  return data ?? []
}

type ListOptions = {
  categorySlug?: string
  deviceModelId?: number
  q?: string
  featured?: boolean
  limit?: number
}

export async function listProducts(opts: ListOptions = {}): Promise<ProductWithRelations[]> {
  'use cache'
  catalogCache()
  // With a device filter, embed only that model's variants so cards show its price and stock.
  let select = opts.deviceModelId
    ? PRODUCT_SELECT.replace('product_variants(', 'product_variants!inner(')
    : PRODUCT_SELECT
  if (opts.categorySlug) select += ', categories!inner(slug)'
  let query = createCatalogClient().from('products').select(select).eq('is_active', true)

  if (opts.categorySlug) query = query.eq('categories.slug', opts.categorySlug)
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
  'use cache'
  catalogCache()
  const { data } = await createCatalogClient()
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  return (data as unknown as ProductWithRelations) ?? null
}
