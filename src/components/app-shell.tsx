'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  BagIcon,
  BoxIcon,
  CashIcon,
  ChartIcon,
  ChatIcon,
  ChevronDownIcon,
  ClockIcon,
  ExpandIcon,
  GearIcon,
  GridIcon,
  HomeIcon,
  MenuIcon,
  PhoneIcon,
  ReceiptIcon,
  StoreIcon,
  TagIcon,
  UserIcon,
} from '@/components/icons'

// Icons are passed by name so server layouts can describe their menus.
const ICONS = {
  bag: BagIcon,
  box: BoxIcon,
  cash: CashIcon,
  chart: ChartIcon,
  chat: ChatIcon,
  gear: GearIcon,
  grid: GridIcon,
  home: HomeIcon,
  phone: PhoneIcon,
  receipt: ReceiptIcon,
  store: StoreIcon,
  tag: TagIcon,
  user: UserIcon,
}

export type MenuLink = { label: string; href: string; external?: boolean; badge?: number }
export type MenuItem = MenuLink & { icon: keyof typeof ICONS; children?: MenuLink[] }
export type MenuSection = MenuItem[]

/** Longest href that the current path sits under; "/" and section roots only match exactly. */
function activeHref(pathname: string, sections: MenuSection[], exact: string[]) {
  const hrefs = sections
    .flat()
    .flatMap((i) => [i, ...(i.children ?? [])])
    .filter((l) => !l.external && !l.href.includes('?'))
    .map((l) => l.href)
  const matches = hrefs.filter((h) =>
    exact.includes(h) ? pathname === h : pathname === h || pathname.startsWith(`${h}/`),
  )
  return matches.sort((a, b) => b.length - a.length)[0]
}

function findLabel(sections: MenuSection[], href: string | undefined) {
  for (const item of sections.flat()) {
    if (item.href === href) return item.label
    const child = item.children?.find((c) => c.href === href)
    if (child) return child.label
  }
}

export function AppShell({
  brand,
  brandHref,
  sections,
  resolveSections,
  exact = [],
  fallbackTitle,
  topCenter,
  topRight,
  sidebarFooter,
  children,
}: {
  brand: string
  brandHref: string
  sections: MenuSection[]
  /** Called while rendering inside Suspense; may `use()` a promise to fill the menu once data arrives. */
  resolveSections?: () => MenuSection[]
  /** Hrefs that must match exactly (section roots such as "/" or "/admin"). */
  exact?: string[]
  fallbackTitle: string
  topCenter?: ReactNode
  topRight?: ReactNode
  sidebarFooter?: ReactNode
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawer, setDrawer] = useState(false)
  // Stable so the route-change effect below only fires on navigation.
  const closeDrawer = useCallback(() => setDrawer(false), [])

  function toggleMenu() {
    if (window.matchMedia('(min-width: 1024px)').matches) setCollapsed((c) => !c)
    else setDrawer((d) => !d)
  }

  return (
    <div className="flex min-h-dvh bg-[#eef2f8]">
      {drawer && <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setDrawer(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-navy text-white transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${
          drawer ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:hidden' : ''}`}
      >
        <Link href={brandHref} className="flex h-20 shrink-0 items-center gap-3 bg-[#1a2d55] px-4">
          <Image src="/logo.jpg" alt="" width={48} height={48} className="rounded-lg bg-white p-0.5" priority />
          <span className="text-xl font-bold leading-tight">{brand}</span>
        </Link>

        {/* The current path is request data on dynamic routes, so everything that
            highlights the active page renders inside Suspense. */}
        <Suspense fallback={<SidebarNav sections={sections} />}>
          <ActiveSidebarNav sections={resolveSections ?? (() => sections)} exact={exact} onNavigate={closeDrawer} />
        </Suspense>

        {sidebarFooter && <div className="border-t border-white/15 p-4 text-sm">{sidebarFooter}</div>}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-stretch bg-navy text-white shadow lg:h-20">
          <div className="flex items-center gap-3 bg-butter pl-3 pr-10 text-navy [clip-path:polygon(0_0,100%_0,calc(100%-1.75rem)_100%,0_100%)] sm:pl-4">
            <button
              onClick={toggleMenu}
              className="flex h-10 w-10 items-center justify-center rounded-lg border-[1.5px] border-navy/30 hover:bg-white/50"
              aria-label="ເປີດ/ປິດເມນູ"
            >
              <MenuIcon size={22} />
            </button>
            <span className="max-w-[40vw] truncate text-base font-bold sm:text-lg">
              <Suspense fallback={fallbackTitle}>
                <PageTitle sections={resolveSections ?? (() => sections)} exact={exact} fallback={fallbackTitle} />
              </Suspense>
            </span>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 px-3 sm:gap-3 sm:px-5">
            {topCenter && <div className="hidden min-w-0 flex-1 md:block">{topCenter}</div>}
            {topRight}
          </div>
        </header>

        {topCenter && <div className="bg-navy px-3 pb-3 md:hidden">{topCenter}</div>}

        <main className="min-w-0 flex-1 p-3 sm:p-5">{children}</main>
      </div>
    </div>
  )
}

function SidebarNav({ sections, active }: { sections: MenuSection[]; active?: string }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {sections.map((section, i) => (
        <div key={i} className={i > 0 ? 'mt-3 border-t border-white/15 pt-3' : ''}>
          {section.map((item) => (
            <SidebarItem key={item.label} item={item} active={active} />
          ))}
        </div>
      ))}
    </nav>
  )
}

function ActiveSidebarNav({
  sections,
  exact,
  onNavigate,
}: {
  sections: () => MenuSection[]
  exact: string[]
  onNavigate: () => void
}) {
  const pathname = usePathname()
  const menu = sections()
  // Close the mobile drawer after navigating.
  useEffect(() => onNavigate(), [pathname, onNavigate])
  return <SidebarNav sections={menu} active={activeHref(pathname, menu, exact)} />
}

function PageTitle({ sections, exact, fallback }: { sections: () => MenuSection[]; exact: string[]; fallback: string }) {
  const pathname = usePathname()
  const menu = sections()
  return findLabel(menu, activeHref(pathname, menu, exact)) ?? fallback
}

function SidebarItem({ item, active }: { item: MenuItem; active: string | undefined }) {
  const Icon = ICONS[item.icon]
  const childActive = item.children?.some((c) => c.href === active) ?? false
  const [open, setOpen] = useState(childActive || !!item.children)

  const base = 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-semibold transition'
  const style = (isActive: boolean) => (isActive ? 'bg-butter text-navy shadow' : 'text-white/90 hover:bg-white/10')

  if (!item.children) {
    return (
      <MenuAnchor link={item} className={`${base} ${style(item.href === active)}`}>
        <Icon size={20} />
        <span className="flex-1">{item.label}</span>
        <Badge value={item.badge} />
      </MenuAnchor>
    )
  }

  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className={`${base} ${style(false)}`} aria-expanded={open}>
        <Icon size={20} />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDownIcon size={18} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="mb-1 ml-5 border-l-2 border-white/25 py-1">
          {item.children.map((child) => {
            const isActive = child.href === active
            return (
              <li key={child.href} className="relative pl-4">
                <span className="absolute left-0 top-1/2 h-0.5 w-3 bg-white/25" />
                <MenuAnchor
                  link={child}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-semibold ${style(isActive)}`}
                >
                  <span className="flex-1">{child.label}</span>
                  <Badge value={child.badge} />
                </MenuAnchor>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function MenuAnchor({ link, className, children }: { link: MenuLink; className: string; children: ReactNode }) {
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link href={link.href} className={className}>
      {children}
    </Link>
  )
}

function Badge({ value }: { value?: number }) {
  if (!value) return null
  return <span className="rounded-full bg-blush px-2 py-0.5 text-xs font-bold text-white">{value}</span>
}

/** Live clock pill for the top bar (rendered after mount to avoid hydration mismatch). */
export function TopClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start the clock on mount
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="hidden items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold xl:flex">
      <ClockIcon size={18} />
      {now
        ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Vientiane' }).format(now)
        : '--/--/---- --:--:--'}
    </span>
  )
}

export function FullscreenButton() {
  function toggle() {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen().catch(() => {})
  }
  return (
    <button
      onClick={toggle}
      className="hidden h-10 w-10 items-center justify-center rounded-lg bg-white text-navy hover:bg-butter sm:flex"
      aria-label="ເຕັມຈໍ"
    >
      <ExpandIcon size={20} />
    </button>
  )
}
