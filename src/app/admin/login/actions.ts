'use server'

import { normalizePhone, staffEmail } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/** Finds the login address for a phone number: the owner's real email if it's their phone, else the staff address. */
async function emailForPhone(phone: string) {
  const admin = createAdminClient()
  if (admin) {
    const { data: profile } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle()
    if (profile) {
      const { data } = await admin.auth.admin.getUserById(profile.id)
      if (data.user?.email) return data.user.email
    }
  }
  return staffEmail(phone)
}

/**
 * Signs in with a phone number or an email. Runs on the server so the email
 * behind a phone number is never sent to the browser.
 */
export async function signIn(login: string, password: string): Promise<{ error: string | null; code?: string }> {
  const value = login.trim()
  const email = value.includes('@') ? value : await emailForPhone(normalizePhone(value))
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? { error: error.message, code: error.code } : { error: null }
}
