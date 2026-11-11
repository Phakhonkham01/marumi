import type { Metadata } from 'next'
import Image from 'next/image'
import { Suspense } from 'react'
import { AdminShell, SignOutButton } from '@/components/admin/nav'
import { createClient, getStaffSession } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'ຫຼັງບ້ານ', robots: { index: false } }

export default function PanelLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <Suspense fallback={<div className="flex min-h-dvh"><div className="hidden w-64 bg-navy lg:block" /><div className="flex-1 bg-[#eef2f8]"><div className="h-20 bg-navy" /></div></div>}>
      <Gate>{children}</Gate>
    </Suspense>
  )
}

async function Gate({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const [session, pending] = await Promise.all([
    getStaffSession(),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])
  if (!session) {
    return (
      <div className="bg-waves flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <Image src="/logo.jpg" alt="" width={80} height={80} className="rounded-full" />
        <p className="font-semibold text-navy">ບັນຊີນີ້ຍັງບໍ່ໄດ້ຮັບສິດເຂົ້າຫຼັງບ້ານ</p>
        <p className="text-sm text-muted">ໃຫ້ເຈົ້າຂອງຮ້ານເພີ່ມບັນຊີນີ້ເປັນພະນັກງານກ່ອນ</p>
        <SignOutButton />
      </div>
    )
  }
  return (
    <AdminShell name={session.name} role={session.role} pending={pending.count ?? 0}>
      {children}
    </AdminShell>
  )
}
