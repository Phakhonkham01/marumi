import { PERMISSION_KEYS, hasPermission } from '@/lib/permissions'
import { requirePermission } from '@/lib/supabase/server'
import { StaffForm } from '../staff-form'

export default async function NewStaffPage() {
  const session = await requirePermission('staff')
  return (
    <div className="space-y-4">
      <h1 className="page-bar">ເພີ່ມພະນັກງານ</h1>
      <StaffForm
        initial={{ name: '', phone: '', role: 'staff', permissions: ['pos', 'sales'], active: true, avatarUrl: null }}
        grantable={PERMISSION_KEYS.filter((k) => hasPermission(session, k))}
        isSelf={false}
      />
    </div>
  )
}
