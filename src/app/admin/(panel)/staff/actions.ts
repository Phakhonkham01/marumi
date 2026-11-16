'use server'

import { revalidatePath } from 'next/cache'
import {
  hasPermission,
  isValidPhone,
  normalizePhone,
  PERMISSION_KEYS,
  STAFF_EMAIL_DOMAIN,
  staffEmail,
  type Permission,
} from '@/lib/permissions'
import { AVATAR_BUCKET, createAdminClient } from '@/lib/supabase/admin'
import { createClient, getStaffSession, type StaffSession } from '@/lib/supabase/server'

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

type Admin = NonNullable<ReturnType<typeof createAdminClient>>

const fail = (error: string): ActionResult => ({ ok: false, error })
const NO_KEY = 'ລະບົບຍັງບໍ່ໄດ້ຕັ້ງ SUPABASE_SERVICE_ROLE_KEY — ໃຫ້ເຈົ້າຂອງຮ້ານຕັ້ງຄ່າກ່ອນ'
const BAN_FOREVER = '876000h' // 100 years

function text(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function checkPassword(password: string) {
  if (password.length < 6) return 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວ'
  if (password.length > 72) return 'ລະຫັດຜ່ານຍາວເກີນໄປ'
  return null
}

/** Phone is unique across profiles (it is also the login). */
async function phoneTaken(admin: Admin, phone: string, exceptId?: string) {
  let query = admin.from('profiles').select('id').eq('phone', phone)
  if (exceptId) query = query.neq('id', exceptId)
  const { data } = await query.limit(1)
  return (data?.length ?? 0) > 0
}

/** Saves a new photo (already shrunk in the browser) and removes the old one. */
async function saveAvatar(admin: Admin, userId: string, form: FormData, oldUrl: string | null) {
  const file = form.get('avatar')
  const remove = form.get('removeAvatar') === '1'
  if (!(file instanceof File && file.size > 0) && !remove) return { url: oldUrl }

  let url: string | null = null
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith('image/')) return { error: 'ໄຟລ໌ຮູບບໍ່ຖືກຕ້ອງ' }
    if (file.size > 2 * 1024 * 1024) return { error: 'ຮູບໃຫຍ່ເກີນ 2MB' }
    const ext = file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await admin.storage.from(AVATAR_BUCKET).upload(path, file, { contentType: file.type, upsert: true })
    if (error) return { error: `ອັບໂຫຼດຮູບບໍ່ສຳເລັດ: ${error.message}` }
    url = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl
  }
  const marker = `/${AVATAR_BUCKET}/`
  if (oldUrl?.includes(marker)) {
    await admin.storage.from(AVATAR_BUCKET).remove([oldUrl.slice(oldUrl.indexOf(marker) + marker.length)])
  }
  return { url }
}

function readPermissions(form: FormData, caller: StaffSession): Permission[] | string {
  const picked = form.getAll('permissions').filter((p): p is Permission => PERMISSION_KEYS.includes(p as Permission))
  // A manager can only hand out what they have themselves.
  const notAllowed = picked.filter((p) => !hasPermission(caller, p))
  if (notAllowed.length) return 'ທ່ານບໍ່ສາມາດໃຫ້ສິດທີ່ທ່ານເອງບໍ່ມີ'
  return [...new Set(picked)]
}

async function staffManager() {
  const session = await getStaffSession()
  if (!session || !hasPermission(session, 'staff')) return { error: 'ທ່ານບໍ່ມີສິດຈັດການພະນັກງານ' } as const
  const admin = createAdminClient()
  if (!admin) return { error: NO_KEY } as const
  return { session, admin } as const
}

/** Adds a staff login (phone + password) with a profile. */
export async function createStaff(form: FormData): Promise<ActionResult> {
  const ctx = await staffManager()
  if ('error' in ctx) return fail(ctx.error!)
  const { session, admin } = ctx

  const name = text(form, 'name')
  const phone = normalizePhone(text(form, 'phone'))
  const password = String(form.get('password') ?? '')
  if (!name) return fail('ກະລຸນາໃສ່ຊື່')
  if (!isValidPhone(phone)) return fail('ເບີໂທບໍ່ຖືກຕ້ອງ (ຕົວຢ່າງ 020 5555 1234)')
  const badPassword = checkPassword(password)
  if (badPassword) return fail(badPassword)
  const permissions = readPermissions(form, session)
  if (typeof permissions === 'string') return fail(permissions)
  if (await phoneTaken(admin, phone)) return fail('ເບີໂທນີ້ມີໃນລະບົບແລ້ວ')

  const { data: created, error } = await admin.auth.admin.createUser({
    email: staffEmail(phone),
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  })
  if (error || !created.user) {
    return fail(error?.code === 'email_exists' ? 'ເບີໂທນີ້ມີບັນຊີແລ້ວ' : `ສ້າງບັນຊີບໍ່ສຳເລັດ: ${error?.message}`)
  }
  const userId = created.user.id

  const avatar = await saveAvatar(admin, userId, form, null)
  const { error: profileError } = await admin.from('profiles').insert({
    id: userId,
    display_name: name,
    role: 'staff',
    phone,
    permissions,
    avatar_url: avatar.url ?? null,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    return fail(`ບັນທຶກຂໍ້ມູນບໍ່ສຳເລັດ: ${profileError.message}`)
  }
  revalidatePath('/admin/staff')
  return { ok: true, id: userId }
}

/** Edits another staff member (or yourself, minus switching yourself off or dropping your own staff right). */
export async function updateStaff(id: string, form: FormData): Promise<ActionResult> {
  const ctx = await staffManager()
  if ('error' in ctx) return fail(ctx.error!)
  const { session, admin } = ctx

  const { data: target } = await admin.from('profiles').select('*').eq('id', id).maybeSingle()
  if (!target) return fail('ບໍ່ພົບພະນັກງານ')
  const self = id === session.userId
  if (target.role === 'owner' && session.role !== 'owner') return fail('ແກ້ໄຂບັນຊີເຈົ້າຂອງຮ້ານບໍ່ໄດ້')

  const name = text(form, 'name')
  const phoneInput = text(form, 'phone')
  const phone = phoneInput ? normalizePhone(phoneInput) : null
  const password = String(form.get('password') ?? '')
  const active = form.get('active') === '1'
  if (!name) return fail('ກະລຸນາໃສ່ຊື່')
  if (phone && !isValidPhone(phone)) return fail('ເບີໂທບໍ່ຖືກຕ້ອງ (ຕົວຢ່າງ 020 5555 1234)')
  if (target.role === 'staff' && !phone) return fail('ພະນັກງານຕ້ອງມີເບີໂທ (ໃຊ້ລ໋ອກອິນ)')
  if (password) {
    const badPassword = checkPassword(password)
    if (badPassword) return fail(badPassword)
  }
  if (phone && (await phoneTaken(admin, phone, id))) return fail('ເບີໂທນີ້ມີໃນລະບົບແລ້ວ')

  let permissions: Permission[] = target.permissions ?? []
  if (target.role === 'staff') {
    const picked = readPermissions(form, session)
    if (typeof picked === 'string') return fail(picked)
    // Rights the caller can't grant stay as they were.
    permissions = [...new Set([...picked, ...permissions.filter((p) => !hasPermission(session, p))])]
    if (self && !permissions.includes('staff')) return fail('ຖອນສິດຈັດການພະນັກງານຂອງຕົນເອງບໍ່ໄດ້')
  }
  if (self && !active) return fail('ປິດບັນຊີຂອງຕົນເອງບໍ່ໄດ້')
  if (target.role === 'owner' && !active) return fail('ປິດບັນຊີເຈົ້າຂອງຮ້ານບໍ່ໄດ້')

  // Login details live in Supabase Auth; phone logins use the private staff address.
  const { data: authUser } = await admin.auth.admin.getUserById(id)
  const phoneLogin = authUser.user?.email?.endsWith(`@${STAFF_EMAIL_DOMAIN}`) ?? false
  const authChanges: { email?: string; password?: string; ban_duration?: string } = {}
  if (phoneLogin && phone && phone !== target.phone) authChanges.email = staffEmail(phone)
  if (password) authChanges.password = password
  if (active !== target.is_active) authChanges.ban_duration = active ? 'none' : BAN_FOREVER
  if (Object.keys(authChanges).length) {
    const { error } = await admin.auth.admin.updateUserById(id, { ...authChanges, email_confirm: true })
    if (error) return fail(`ບັນທຶກການລ໋ອກອິນບໍ່ສຳເລັດ: ${error.message}`)
  }

  const avatar = await saveAvatar(admin, id, form, target.avatar_url)
  if ('error' in avatar) return fail(avatar.error!)
  const { error } = await admin
    .from('profiles')
    .update({ display_name: name, phone, permissions, is_active: active, avatar_url: avatar.url })
    .eq('id', id)
  if (error) return fail(`ບັນທຶກບໍ່ສຳເລັດ: ${error.message}`)

  revalidatePath('/admin', 'layout')
  return { ok: true, id }
}

/** "My profile": name, phone and photo. Permissions and on/off stay with the staff manager. */
export async function updateMyProfile(form: FormData): Promise<ActionResult> {
  const session = await getStaffSession()
  if (!session) return fail('ກະລຸນາລ໋ອກອິນໃໝ່')
  const admin = createAdminClient()
  if (!admin) return fail(NO_KEY)

  const name = text(form, 'name')
  const phoneInput = text(form, 'phone')
  const phone = phoneInput ? normalizePhone(phoneInput) : null
  if (!name) return fail('ກະລຸນາໃສ່ຊື່')
  if (phone && !isValidPhone(phone)) return fail('ເບີໂທບໍ່ຖືກຕ້ອງ (ຕົວຢ່າງ 020 5555 1234)')
  if (session.role === 'staff' && !phone) return fail('ພະນັກງານຕ້ອງມີເບີໂທ (ໃຊ້ລ໋ອກອິນ)')
  if (phone && (await phoneTaken(admin, phone, session.userId))) return fail('ເບີໂທນີ້ມີໃນລະບົບແລ້ວ')

  const { data: authUser } = await admin.auth.admin.getUserById(session.userId)
  const phoneLogin = authUser.user?.email?.endsWith(`@${STAFF_EMAIL_DOMAIN}`) ?? false
  if (phoneLogin && phone && phone !== session.phone) {
    const { error } = await admin.auth.admin.updateUserById(session.userId, { email: staffEmail(phone), email_confirm: true })
    if (error) return fail(`ປ່ຽນເບີໂທບໍ່ສຳເລັດ: ${error.message}`)
  }

  const avatar = await saveAvatar(admin, session.userId, form, session.avatarUrl)
  if ('error' in avatar) return fail(avatar.error!)
  const { error } = await admin
    .from('profiles')
    .update({ display_name: name, phone, avatar_url: avatar.url })
    .eq('id', session.userId)
  if (error) return fail(`ບັນທຶກບໍ່ສຳເລັດ: ${error.message}`)

  revalidatePath('/admin', 'layout')
  return { ok: true }
}

/** Changes your own password after checking the current one. */
export async function changeMyPassword(form: FormData): Promise<ActionResult> {
  const session = await getStaffSession()
  if (!session) return fail('ກະລຸນາລ໋ອກອິນໃໝ່')
  const current = String(form.get('current') ?? '')
  const next = String(form.get('next') ?? '')
  const badPassword = checkPassword(next)
  if (badPassword) return fail(badPassword)

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email
  if (!email) return fail('ກະລຸນາລ໋ອກອິນໃໝ່')
  const { error: wrong } = await supabase.auth.signInWithPassword({ email, password: current })
  if (wrong) return fail('ລະຫັດຜ່ານປັດຈຸບັນບໍ່ຖືກ')
  const { error } = await supabase.auth.updateUser({ password: next })
  if (error) return fail(`ປ່ຽນລະຫັດບໍ່ສຳເລັດ: ${error.message}`)
  return { ok: true }
}
