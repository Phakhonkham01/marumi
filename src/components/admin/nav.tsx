'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BoxIcon, CashIcon, ChartIcon, GearIcon, HomeIcon, ReceiptIcon } from '@/components/icons'
import { createClient } from '@/lib/supabase/client'

const LINKS = [
  { href: '/admin', label: 'ພາບລວມ', icon: HomeIcon, ownerOnly: false },
  { href: '/admin/orders', label: 'ອໍເດີ', icon: ReceiptIcon, ownerOnly: false },
  { href: '/admin/pos', label: 'ຂາຍໜ້າຮ້ານ', icon: CashIcon, ownerOnly: false },
  { href: '/admin/products', label: 'ສິນຄ້າ', icon: BoxIcon, ownerOnly: false },
  { href: '/admin/reports', label: 'ລາຍງານ', icon: ChartIcon, ownerOnly: true },
  { href: '/admin/settings', label: 'ຕັ້ງຄ່າ', icon: GearIcon, ownerOnly: false },
] as const

export function AdminNav({ name, role }: { name: string; role: 'owner' | 'staff' }) {
  const pathname = usePathname()
  const links = LINKS.filter((l) => !l.ownerOnly || role === 'owner')
  const isActive = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href))


  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-white p-4 md:flex">
        <Link href="/admin" className="mb-6 flex items-center gap-2">
          <Image src="/logo.jpg" alt="" width={40} height={40} className="rounded-full ring-2 ring-sky" />
          <span className="font-display text-lg font-bold text-navy">Marumi</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold ${isActive(href) ? 'bg-navy text-white' : 'text-navy hover:bg-mist'}`}
            >
              <Icon size={20} /> {label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 border-t border-line pt-4 text-sm">
          <p className="font-semibold">{name}</p>
          <p className="text-muted">{role === 'owner' ? 'ເຈົ້າຂອງຮ້ານ' : 'ພະນັກງານ'}</p>
          <div className="flex gap-2">
            <Link href="/" className="btn btn-ghost btn-sm" target="_blank">
              ເບິ່ງໜ້າຮ້ານ
            </Link>
            <button onClick={signOut} className="btn btn-ghost btn-sm">
              ອອກ
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar + bottom tabs */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 py-2 md:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/logo.jpg" alt="" width={32} height={32} className="rounded-full" />
          <span className="font-display font-bold text-navy">Marumi</span>
        </Link>
        <button onClick={signOut} className="text-sm text-muted">
          ອອກຈາກລະບົບ
        </button>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive(href) ? 'text-navy' : 'text-muted'}`}
          >
            <Icon size={22} />
            {label}
          </Link>
        ))}
      </nav>
    </>
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
