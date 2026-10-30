import { createClient, getStaffSession } from '@/lib/supabase/server'
import type { Category, DeviceModel } from '@/lib/types'
import { CategoryEditor, DeviceModelEditor } from './editors'

type Profile = { id: string; display_name: string; role: 'owner' | 'staff' }

export default async function SettingsPage() {
  const session = (await getStaffSession())!
  const supabase = await createClient()
  const [{ data: categories }, { data: models }, { data: staff }] = await Promise.all([
    supabase.from('categories').select('*').order('sort'),
    supabase.from('device_models').select('*').order('brand').order('sort'),
    supabase.from('profiles').select('id, display_name, role').order('created_at'),
  ])

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-navy">ຕັ້ງຄ່າ</h1>
      <CategoryEditor categories={(categories as Category[]) ?? []} />
      <DeviceModelEditor models={(models as DeviceModel[]) ?? []} />

      <section className="card space-y-2 p-4">
        <h2 className="font-bold text-navy">ພະນັກງານ</h2>
        <ul className="divide-y divide-line text-sm">
          {((staff as Profile[]) ?? []).map((p) => (
            <li key={p.id} className="flex justify-between py-2">
              <span>
                {p.display_name || '—'}
                {p.id === session.userId && <span className="text-muted"> (ເຈົ້າ)</span>}
              </span>
              <span className="text-muted">{p.role === 'owner' ? 'ເຈົ້າຂອງຮ້ານ' : 'ພະນັກງານ'}</span>
            </li>
          ))}
        </ul>
        {session.role === 'owner' && (
          <p className="text-xs text-muted">
            ເພີ່ມພະນັກງານ: ສ້າງຜູ້ໃຊ້ໃນ Supabase → Authentication → Users ແລ້ວແລ່ນ SQL ໃນ README (ພາກ “ເພີ່ມພະນັກງານ”).
            ພະນັກງານຈະບໍ່ເຫັນຕົ້ນທຶນ ແລະ ກຳໄລ.
          </p>
        )}
      </section>
    </div>
  )
}
