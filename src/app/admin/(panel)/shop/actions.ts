'use server'

import { updateTag } from 'next/cache'
import { CATALOG_TAG } from '@/lib/catalog'
import { hasPermission } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffSession } from '@/lib/supabase/server'

const BUCKET = 'shop'

/** Saves the bank details (and QR picture) customers see when paying by transfer. */
export async function saveShopSettings(form: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getStaffSession()
  if (!session || !hasPermission(session, 'settings')) return { ok: false, error: 'ທ່ານບໍ່ມີສິດຕັ້ງຄ່າຮ້ານ' }
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: 'ລະບົບຍັງບໍ່ໄດ້ຕັ້ງ SUPABASE_SERVICE_ROLE_KEY' }

  const text = (key: string) => String(form.get(key) ?? '').trim().slice(0, 100)
  const { data: current } = await admin.from('shop_settings').select('bank_qr_url').eq('id', 1).maybeSingle()
  let qrUrl: string | null = current?.bank_qr_url ?? null

  const file = form.get('qr')
  const removeQr = form.get('removeQr') === '1'
  if ((file instanceof File && file.size > 0) || removeQr) {
    const marker = `/${BUCKET}/`
    if (qrUrl?.includes(marker)) await admin.storage.from(BUCKET).remove([qrUrl.slice(qrUrl.indexOf(marker) + marker.length)])
    qrUrl = null
  }
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith('image/')) return { ok: false, error: 'ໄຟລ໌ QR ຕ້ອງເປັນຮູບ' }
    if (file.size > 3 * 1024 * 1024) return { ok: false, error: 'ຮູບ QR ໃຫຍ່ເກີນ 3MB' }
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `bank-qr-${Date.now()}.${ext}`
    const { error } = await admin.storage.from(BUCKET).upload(path, file, { contentType: file.type })
    if (error) return { ok: false, error: `ອັບໂຫຼດ QR ບໍ່ສຳເລັດ: ${error.message}` }
    qrUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  const { error } = await admin
    .from('shop_settings')
    .update({
      bank_name: text('bank_name') || 'BCEL One',
      bank_account: text('bank_account'),
      bank_holder: text('bank_holder'),
      bank_qr_url: qrUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
  if (error) return { ok: false, error: `ບັນທຶກບໍ່ສຳເລັດ: ${error.message}` }

  updateTag(CATALOG_TAG) // the checkout page shows the new details straight away
  return { ok: true }
}
