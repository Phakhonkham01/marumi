import { createClient, requirePermission } from '@/lib/supabase/server'
import type { Category, DeviceModel } from '@/lib/types'
import { CategoryEditor, DeviceModelEditor } from './editors'

export default async function SettingsPage() {
  await requirePermission('products')
  const supabase = await createClient()
  const [{ data: categories }, { data: models }] = await Promise.all([
    supabase.from('categories').select('*').order('sort'),
    supabase.from('device_models').select('*').order('brand').order('sort'),
  ])

  return (
    <div className="space-y-5">
      <h1 className="page-bar">ຕັ້ງຄ່າ</h1>
      <CategoryEditor categories={(categories as Category[]) ?? []} />
      <DeviceModelEditor models={(models as DeviceModel[]) ?? []} />
    </div>
  )
}
