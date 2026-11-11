import { CartProvider } from '@/components/shop/cart'
import { ShopShell } from '@/components/shop/header'
import { SHOP } from '@/lib/format'
import { getCategories } from '@/lib/queries'

export default function ShopLayout({ children }: LayoutProps<'/'>) {
  // Not awaited: the shell streams the category menu in without blocking the page.
  const categories = getCategories()
  return (
    <CartProvider>
      <ShopShell categories={categories}>
        <div className="mx-auto w-full max-w-7xl">{children}</div>
        <footer className="mx-auto mt-10 max-w-7xl border-t border-line pt-4 text-center text-xs text-muted">
          © {SHOP.name} · {SHOP.nameLo} · {SHOP.phone}
        </footer>
      </ShopShell>
    </CartProvider>
  )
}
