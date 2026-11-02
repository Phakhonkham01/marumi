'use server'

import { updateTag } from 'next/cache'
import { CATALOG_TAG } from '@/lib/catalog'
import { getStaffSession } from '@/lib/supabase/server'

/** Expires the storefront cache after staff change products, stock or categories. */
export async function refreshCatalog() {
  if (!(await getStaffSession())) return
  updateTag(CATALOG_TAG)
}
