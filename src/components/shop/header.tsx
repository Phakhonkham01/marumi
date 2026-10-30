'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { BagIcon, SearchIcon, UserIcon } from '@/components/icons'
import { SHOP } from '@/lib/format'
import { useCart } from './cart'

export function ShopHeader() {
  const { count, ready } = useCart()
  const router = useRouter()
  const [query, setQuery] = useState('')

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : '/products')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image
            src="/logo.jpg"
            alt={SHOP.name}
            width={44}
            height={44}
            className="rounded-full ring-2 ring-sky"
            priority
          />
          <span className="hidden leading-tight sm:block">
            <span className="block font-display text-lg font-bold text-navy">Marumi</span>
            <span className="block text-xs text-muted">Phonecase</span>
          </span>
        </Link>

        <form onSubmit={onSearch} className="relative flex-1">
          <SearchIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ຊອກຫາເຄສ, ແບັດສຳຮອງ..."
            className="input rounded-full! pl-9"
            enterKeyHint="search"
          />
        </form>

        <Link href="/products" className="hidden font-semibold text-navy md:block">
          ສິນຄ້າທັງໝົດ
        </Link>

        <Link
          href="/admin"
          prefetch={false}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-line bg-white px-3 font-semibold text-navy hover:border-sky"
          aria-label="ເຂົ້າລະບົບ"
        >
          <UserIcon size={20} />
          <span className="hidden text-sm sm:inline">ເຂົ້າລະບົບ</span>
        </Link>

        <Link
          href="/cart"
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-navy bg-butter text-navy"
          aria-label="ກະຕ່າສິນຄ້າ"
        >
          <BagIcon size={22} />
          {ready && count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-navy px-1 text-xs font-bold text-white">
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
