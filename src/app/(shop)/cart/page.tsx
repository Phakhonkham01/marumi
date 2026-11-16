import type { Metadata } from 'next'
import { getShopSettings } from '@/lib/queries'
import { CartView } from './cart-view'

export const metadata: Metadata = { title: 'ກະຕ່າສິນຄ້າ' }

export default async function CartPage() {
  return <CartView shop={await getShopSettings()} />
}
