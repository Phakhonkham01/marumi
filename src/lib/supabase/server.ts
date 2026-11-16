import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { cache } from 'react'
import { hasPermission, type Permission, type Role } from '@/lib/permissions'
import { SUPABASE_KEY, SUPABASE_URL } from './env'

/** Session-aware client for admin pages and server actions. */
export async function createClient() {
  // supabase-js reads the clock while restoring the session, which must not
  // happen during prerendering.
  await connection()
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options)
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  })
}

/** Cookie-free client for the public storefront (always reads as a customer). */
export async function createPublicClient() {
  await connection()
  return createCatalogClient()
}

/** Anonymous client for use inside `'use cache'` scopes, where request APIs are off-limits. */
export function createCatalogClient() {
  return createAnonClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type StaffSession = {
  userId: string
  name: string
  role: Role
  permissions: Permission[]
  phone: string | null
  avatarUrl: string | null
}

/** The signed-in staff member, or null when signed out, not staff, or switched off. */
export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, role, permissions, phone, avatar_url, is_active')
    .eq('id', userId)
    .maybeSingle()
  if (!profile || !profile.is_active) return null
  return {
    userId,
    name: profile.display_name,
    role: profile.role,
    permissions: (profile.permissions ?? []) as Permission[],
    phone: profile.phone,
    avatarUrl: profile.avatar_url,
  }
})

/** Session check for a page: sends people without the permission to the "no access" page. */
export async function requirePermission(...anyOf: Permission[]) {
  const session = await getStaffSession()
  if (!session) redirect('/admin/login')
  if (anyOf.length && !anyOf.some((key) => hasPermission(session, key))) redirect('/admin/no-access')
  return session
}
