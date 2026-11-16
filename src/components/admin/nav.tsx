'use client'

import Link from 'next/link'
import { AppShell, FullscreenButton, TopClock, type MenuSection } from '@/components/app-shell'
import { BellIcon, LogoutIcon } from '@/components/icons'
import { hasPermission, type Permission, type Role } from '@/lib/permissions'
import { Avatar } from './avatar'
import { createClient } from '@/lib/supabase/client'

type Item = MenuSection[number] & { need?: Permission }

/** The side menu, showing only what this person may use. */
function adminMenu(user: { role: Role; permissions: Permission[] }, pending: number): MenuSection[] {
  const allowed = (i: { need?: Permission }) => !i.need || hasPermission(user, i.need)
  const sections: Item[][] = [
    [
      { label: 'ແຜງຄວບຄຸມ', href: '/admin', icon: 'grid' },
      { label: 'ຂາຍໜ້າຮ້ານ', href: '/admin/pos', icon: 'cash', need: 'pos' },
      { label: 'ຮັບສິນຄ້າເຂົ້າ', href: '/admin/receive', icon: 'box', need: 'receive' },
      { label: 'ອໍເດີ', href: '/admin/orders', icon: 'receipt', badge: pending, need: 'orders' },
      { label: 'ຍອດຂາຍ', href: '/admin/sales', icon: 'chart', need: 'sales' },
    ],
    [
      {
        label: 'ຈັດການສິນຄ້າ',
        href: '#products',
        icon: 'box',
        children: (
          [
            { label: 'ລາຍການສິນຄ້າ', href: '/admin/products', need: 'products' },
            { label: 'ເພີ່ມສິນຄ້າໃໝ່', href: '/admin/products/new', need: 'products' },
            { label: 'ພິມສະຕິກເກີບາໂຄ້ດ', href: '/admin/labels', need: 'labels' },
            { label: 'ໝວດ & ລຸ້ນໂທລະສັບ', href: '/admin/settings', need: 'products' },
          ] as (MenuLinkItem & { need?: Permission })[]
        ).filter(allowed),
      },
      { label: 'ລາຍງານ', href: '/admin/reports', icon: 'chart', need: 'reports' },
      { label: 'ພະນັກງານ', href: '/admin/staff', icon: 'users', need: 'staff' },
      { label: 'ໂປຣໄຟລ໌ຂອງຂ້ອຍ', href: '/admin/profile', icon: 'user' },
    ],
    [{ label: 'ເບິ່ງໜ້າຮ້ານ', href: '/', icon: 'store', external: true }],
  ]
  return sections.map((items) => items.filter(allowed).filter((i) => !i.children || i.children.length > 0))
}

type MenuLinkItem = NonNullable<MenuSection[number]['children']>[number]

export function AdminShell({
  name,
  role,
  permissions,
  avatarUrl,
  pending,
  children,
}: {
  name: string
  role: Role
  permissions: Permission[]
  avatarUrl: string | null
  pending: number
  children: React.ReactNode
}) {
  const canOrders = hasPermission({ role, permissions }, 'orders')
  return (
    <AppShell
      brand="Marumi"
      brandHref="/admin"
      sections={adminMenu({ role, permissions }, pending)}
      exact={['/admin']}
      fallbackTitle="ຫຼັງບ້ານ"
      topRight={
        <>
          <TopClock />
          <FullscreenButton />
          {canOrders && (
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
          )}
          <span className="hidden h-8 w-px bg-white/30 sm:block" />
          <Link href="/admin/profile" className="flex items-center gap-3 rounded-lg hover:opacity-90" aria-label="ໂປຣໄຟລ໌ຂອງຂ້ອຍ">
            <span className="hidden text-right leading-tight sm:block">
              <span className="block font-bold">Hi! {name}</span>
              <span className="block text-xs text-white/70">{role === 'owner' ? 'ເຈົ້າຂອງຮ້ານ' : 'ພະນັກງານ'}</span>
            </span>
            <Avatar url={avatarUrl} name={name} size={40} className="ring-2 ring-white" />
          </Link>
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
