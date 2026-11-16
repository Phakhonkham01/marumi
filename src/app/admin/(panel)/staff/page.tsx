import Link from 'next/link'
import { Avatar } from '@/components/admin/avatar'
import { PlusIcon, UsersIcon } from '@/components/icons'
import { PERMISSIONS, type Permission } from '@/lib/permissions'
import { createClient, requirePermission } from '@/lib/supabase/server'

type Row = {
  id: string
  display_name: string
  role: 'owner' | 'staff'
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  permissions: Permission[]
}

const label = (key: Permission) => PERMISSIONS.find((p) => p.key === key)?.label ?? key

export default async function StaffPage() {
  const session = await requirePermission('staff')
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, role, phone, avatar_url, is_active, permissions')
    .order('role')
    .order('created_at')
  const rows = (data as Row[] | null) ?? []
  const keyMissing = !process.env.SUPABASE_SERVICE_ROLE_KEY

  return (
    <div className="space-y-4">
      {keyMissing && (
        <p className="rounded-lg bg-danger/10 p-3 text-sm font-semibold text-danger">
          ຍັງບໍ່ໄດ້ຕັ້ງ SUPABASE_SERVICE_ROLE_KEY — ເພີ່ມ ຫຼື ແກ້ໄຂພະນັກງານຍັງບໍ່ໄດ້
        </p>
      )}
      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">
            <UsersIcon size={22} /> ພະນັກງານ ({rows.length})
          </span>
          <Link href="/admin/staff/new" className="btn btn-primary btn-sm">
            <PlusIcon size={16} /> ເພີ່ມພະນັກງານ
          </Link>
        </div>
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/staff/${r.id}`}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-mist ${r.is_active ? '' : 'opacity-50'}`}
              >
                <Avatar url={r.avatar_url} name={r.display_name} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-navy">{r.display_name || '—'}</span>
                    {r.id === session.userId && <span className="text-xs text-muted">(ເຈົ້າ)</span>}
                    {r.role === 'owner' && <span className="rounded bg-butter px-2 py-0.5 text-xs font-bold text-navy">ເຈົ້າຂອງຮ້ານ</span>}
                    {!r.is_active && <span className="rounded bg-danger px-2 py-0.5 text-xs font-bold text-white">ປິດບັນຊີແລ້ວ</span>}
                  </span>
                  <span className="block text-sm text-muted">{r.phone ?? 'ບໍ່ມີເບີໂທ'}</span>
                  <span className="mt-1 block truncate text-xs text-muted">
                    {r.role === 'owner' ? 'ທຸກສິດ' : r.permissions.length ? r.permissions.map(label).join(' · ') : 'ຍັງບໍ່ມີສິດ'}
                  </span>
                </span>
                <span className="text-sm font-semibold text-navy">ແກ້ໄຂ ›</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
