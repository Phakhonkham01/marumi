import type { Metadata } from 'next'
import Image from 'next/image'
import { Suspense } from 'react'
import { AdminNav, SignOutButton } from '@/components/admin/nav'
import { getStaffSession } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'ຫຼັງບ້ານ', robots: { index: false } }

export default function PanelLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <Suspense fallback={<div className="p-8 text-muted">ກຳລັງໂຫຼດ...</div>}>
      <Gate>{children}</Gate>
    </Suspense>
  )
}

async function Gate({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession()
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
    <div className="flex min-h-dvh flex-col bg-cream md:flex-row">
      <AdminNav name={session.name} role={session.role} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-8">{children}</main>
    </div>
  )
}
