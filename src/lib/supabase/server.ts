import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { cache } from 'react'
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
  return createAnonClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type StaffSession = { userId: string; name: string; role: 'owner' | 'staff' }

export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, role')
    .eq('id', userId)
    .maybeSingle()
  if (!profile) return null
  return { userId, name: profile.display_name, role: profile.role }
})
