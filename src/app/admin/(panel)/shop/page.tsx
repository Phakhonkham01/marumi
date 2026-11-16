import { createClient, requirePermission } from '@/lib/supabase/server'
import { ShopSettingsForm } from './settings-form'

export default async function ShopSettingsPage() {
  await requirePermission('settings')
  const supabase = await createClient()
  const { data } = await supabase
    .from('shop_settings')
    .select('bank_name, bank_account, bank_holder, bank_qr_url')
    .eq('id', 1)
    .maybeSingle()

  return (
    <div className="space-y-4">
      <h1 className="page-bar">ຕັ້ງຄ່າຮ້ານ</h1>
      {data ? (
        <ShopSettingsForm initial={data} />
      ) : (
        <p className="card p-5 text-danger">ຍັງບໍ່ໄດ້ລັນ SQL 0010_shop_settings.sql ໃນ Supabase</p>
      )}
    </div>
  )
}
