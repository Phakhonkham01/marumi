import { ChatIcon, PhoneIcon } from '@/components/icons'
import { CartProvider } from '@/components/shop/cart'
import { ShopHeader } from '@/components/shop/header'
import { SHOP, whatsappLink } from '@/lib/format'

export default function ShopLayout({ children }: LayoutProps<'/'>) {
  return (
    <CartProvider>
      <ShopHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-4">{children}</main>
      <footer className="bg-waves border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
          <div>
            <p className="font-display text-xl font-bold text-navy">{SHOP.name}</p>
            <p className="text-navy">{SHOP.nameLo}</p>
            <p className="mt-2 text-sm text-muted">{SHOP.tagline}</p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-navy">ຕິດຕໍ່ຮ້ານ</p>
            <a href={`tel:${SHOP.phone.replace(/\s/g, '')}`} className="flex items-center gap-2">
              <PhoneIcon size={16} /> {SHOP.phone}
            </a>
            <a href={whatsappLink('ສະບາຍດີ Marumi')} target="_blank" rel="noreferrer" className="flex items-center gap-2">
              <ChatIcon size={16} /> WhatsApp
            </a>
            <a href={SHOP.facebook} target="_blank" rel="noreferrer" className="flex items-center gap-2">
              <ChatIcon size={16} /> Facebook
            </a>
          </div>
          <div className="text-sm text-muted sm:text-right">
            <p>ຮັບທີ່ຮ້ານ ຫຼື ສົ່ງທົ່ວປະເທດ</p>
            <p>© {SHOP.name}</p>
            <a href="/admin/login" className="mt-2 inline-block underline">
              ເຂົ້າລະບົບຫຼັງບ້ານ
            </a>
          </div>
        </div>
      </footer>
    </CartProvider>
  )
}
