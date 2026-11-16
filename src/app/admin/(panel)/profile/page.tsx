import { PERMISSIONS, hasPermission } from '@/lib/permissions'
import { requirePermission } from '@/lib/supabase/server'
import { ProfileForm } from './profile-form'

export default async function ProfilePage() {
  const session = await requirePermission()
  const mine = PERMISSIONS.filter((p) => hasPermission(session, p.key))
  return (
    <div className="space-y-4">
      <h1 className="page-bar">ໂປຣໄຟລ໌ຂອງຂ້ອຍ</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileForm name={session.name} phone={session.phone ?? ''} avatarUrl={session.avatarUrl} isOwner={session.role === 'owner'} />
        <section className="card space-y-2 p-5">
          <h2 className="font-bold text-navy">ສິດຂອງຂ້ອຍ</h2>
          {session.role === 'owner' && <p className="text-sm font-semibold text-navy">ເຈົ້າຂອງຮ້ານ — ທຸກສິດ</p>}
          <ul className="flex flex-wrap gap-2">
            {mine.map((p) => (
              <li key={p.key} className="chip">
                ✓ {p.label}
              </li>
            ))}
          </ul>
          {mine.length === 0 && <p className="text-sm text-muted">ຍັງບໍ່ມີສິດ</p>}
          <p className="text-xs text-muted">ຢາກໄດ້ສິດເພີ່ມ ໃຫ້ຂໍຈາກເຈົ້າຂອງຮ້ານ</p>
        </section>
      </div>
    </div>
  )
}
