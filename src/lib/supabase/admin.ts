import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from './env'

/**
 * Service-role client: bypasses RLS. Only for server actions that have already
 * checked the caller's permission (creating staff logins, editing profiles).
 * Needs SUPABASE_SERVICE_ROLE_KEY (Supabase → Project Settings → API keys).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export const AVATAR_BUCKET = 'avatars'
