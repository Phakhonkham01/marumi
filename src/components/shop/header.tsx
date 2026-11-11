'use client'

import Link, { useLinkStatus } from 'next/link'
import { useRouter } from 'next/navigation'
import { use, useState } from 'react'
import { AppShell, FullscreenButton, TopClock, type MenuSection } from '@/components/app-shell'
import { BagIcon, UserIcon } from '@/components/icons'
import { SHOP, whatsappLink } from '@/lib/format'
import type { Category } from '@/lib/types'
import { useCart } from './cart'

function shopMenu(categories: Category[], cartCount: number): MenuSection[] {
  return [
    [
      { label: 'ໜ້າຫຼັກ', href: '/', icon: 'home' },
      { label: 'ສິນຄ້າທັງໝົດ', href: '/products', icon: 'grid' },
      {
        label: 'ໝວດສິນຄ້າ',
        href: '#categories',
        icon: 'tag',
        children: categories.map((c) => ({ label: c.name, href: `/products?category=${c.slug}` })),
      },
      { label: 'ກະຕ່າສິນຄ້າ', href: '/cart', icon: 'bag', badge: cartCount },
    ],
    [
      {
        label: 'ຕິດຕໍ່ຮ້ານ',
        href: '#contact',
        icon: 'chat',
        children: [
          { label: 'WhatsApp', href: whatsappLink('ສະບາຍດີ Marumi'), external: true },
          { label: 'Facebook', href: SHOP.facebook, external: true },
          { label: `ໂທ ${SHOP.phone}`, href: `tel:${SHOP.phone.replace(/\s/g, '')}`, external: true },
        ],
      },
      // Straight to the static login page; the proxy forwards signed-in staff to /admin.
      { label: 'ເຂົ້າລະບົບຫຼັງບ້ານ', href: '/admin/login', icon: 'user' },
    ],
  ]
}

export function ShopShell({ categories, children }: { categories: Promise<Category[]>; children: React.ReactNode }) {
  const { count, ready } = useCart()
  const cartCount = ready ? count : 0

  return (
    <AppShell
      brand="Marumi"
      brandHref="/"
      sections={shopMenu([], cartCount)}
      // Only the menu waits for categories; the page itself renders straight away.
      resolveSections={() => shopMenu(use(categories), cartCount)}
      exact={['/']}
      fallbackTitle={SHOP.name}
      topCenter={<SearchBox />}
      topRight={
        <>
          <TopClock />
          <FullscreenButton />
          <Link
            href="/admin/login"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 font-semibold text-navy hover:bg-butter"
            aria-label="ເຂົ້າລະບົບ"
          >
            <LoginLabel />
          </Link>
          <Link
            href="/cart"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-butter text-navy hover:bg-butter-deep"
            aria-label="ກະຕ່າສິນຄ້າ"
          >
            <BagIcon size={22} />
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blush px-1 text-xs font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
        </>
      }
    >
      {children}
    </AppShell>
  )
}

function SearchBox() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : '/products')
  }

  return (
    <form onSubmit={onSearch} className="panel-search mx-auto w-full max-w-lg">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ຊອກຫາເຄສ, ແບັດສຳຮອງ..."
        enterKeyHint="search"
        aria-label="ຄົ້ນຫາສິນຄ້າ"
      />
      <button type="submit">ຄົ້ນຫາ</button>
    </form>
  )
}

function LoginLabel() {
  const { pending } = useLinkStatus()
  return (
    <>
      {pending ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky border-t-navy" aria-hidden />
      ) : (
        <UserIcon size={20} />
      )}
      <span className="hidden text-sm sm:inline">{pending ? 'ກຳລັງເປີດ...' : 'ເຂົ້າລະບົບ'}</span>
    </>
  )
}
