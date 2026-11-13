'use client'

import Link from 'next/link'
import { AppShell, FullscreenButton, TopClock, type MenuSection } from '@/components/app-shell'
import { BellIcon, LogoutIcon, UserIcon } from '@/components/icons'
import { createClient } from '@/lib/supabase/client'

function adminMenu(role: 'owner' | 'staff', pending: number): MenuSection[] {
  return [
    [
      { label: 'ແຜງຄວບຄຸມ', href: '/admin', icon: 'grid' },
      { label: 'ຂາຍໜ້າຮ້ານ', href: '/admin/pos', icon: 'cash' },
      { label: 'ຮັບສິນຄ້າເຂົ້າ', href: '/admin/receive', icon: 'box' },
      { label: 'ອໍເດີ', href: '/admin/orders', icon: 'receipt', badge: pending },
    ],
    [
      {
        label: 'ຈັດການສິນຄ້າ',
        href: '#products',
        icon: 'box',
        children: [
          { label: 'ລາຍການສິນຄ້າ', href: '/admin/products' },
          { label: 'ເພີ່ມສິນຄ້າໃໝ່', href: '/admin/products/new' },
          { label: 'ພິມສະຕິກເກີບາໂຄ້ດ', href: '/admin/labels' },
          { label: 'ໝວດ & ລຸ້ນໂທລະສັບ', href: '/admin/settings' },
        ],
      },
      ...(role === 'owner' ? [{ label: 'ລາຍງານ', href: '/admin/reports', icon: 'chart' as const }] : []),
    ],
    [{ label: 'ເບິ່ງໜ້າຮ້ານ', href: '/', icon: 'store', external: true }],
  ]
}

export function AdminShell({
  name,
  role,
  pending,
  children,
}: {
  name: string
  role: 'owner' | 'staff'
  pending: number
  children: React.ReactNode
}) {
  return (
    <AppShell
      brand="Marumi"
      brandHref="/admin"
      sections={adminMenu(role, pending)}
      exact={['/admin']}
      fallbackTitle="ຫຼັງບ້ານ"
      topRight={
        <>
          <TopClock />
          <FullscreenButton />
          <Link
            href="/admin/orders?status=pending"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-navy hover:bg-butter"
            aria-label={`ອໍເດີລໍຖ້າຢືນຢັນ ${pending}`}
          >
            <BellIcon size={20} />
            {pending > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blush px-1 text-xs font-bold text-white">
                {pending}
              </span>
            )}
          </Link>
          <span className="hidden h-8 w-px bg-white/30 sm:block" />
          <span className="hidden text-right leading-tight sm:block">
            <span className="block font-bold">Hi! {name}</span>
            <span className="block text-xs text-white/70">{role === 'owner' ? 'ເຈົ້າຂອງຮ້ານ' : 'ພະນັກງານ'}</span>
          </span>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-navy">
            <UserIcon size={22} />
          </span>
        </>
      }
      sidebarFooter={
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 font-semibold text-white/90 hover:bg-white/10"
        >
          <LogoutIcon size={20} /> ອອກຈາກລະບົບ
        </button>
      }
    >
      {children}
    </AppShell>
  )
}

export async function signOut() {
  await createClient().auth.signOut()
  window.location.replace('/admin/login')
}

export function SignOutButton() {
  return (
    <button onClick={signOut} className="btn btn-ghost btn-sm">
      ອອກຈາກລະບົບ
    </button>
  )
}
