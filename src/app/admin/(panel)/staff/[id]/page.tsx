import { notFound, redirect } from 'next/navigation'
import { PERMISSION_KEYS, hasPermission, type Permission } from '@/lib/permissions'
import { createClient, requirePermission } from '@/lib/supabase/server'
import { StaffForm } from '../staff-form'

export default async function EditStaffPage(props: PageProps<'/admin/staff/[id]'>) {
  const { id } = await props.params
  const session = await requirePermission('staff')
  const supabase = await createClient()
  const { data: p } = await supabase
    .from('profiles')
    .select('id, display_name, role, phone, avatar_url, is_active, permissions')
    .eq('id', id)
    .maybeSingle()
  if (!p) notFound()
  if (p.role === 'owner' && session.role !== 'owner') redirect('/admin/no-access')

  return (
    <div className="space-y-4">
      <h1 className="page-bar">ແກ້ໄຂພະນັກງານ: {p.display_name}</h1>
      <StaffForm
        initial={{
          id: p.id,
          name: p.display_name,
          phone: p.phone ?? '',
          role: p.role,
          permissions: (p.permissions ?? []) as Permission[],
          active: p.is_active,
          avatarUrl: p.avatar_url,
        }}
        grantable={PERMISSION_KEYS.filter((k) => hasPermission(session, k))}
        isSelf={p.id === session.userId}
      />
    </div>
  )
}
