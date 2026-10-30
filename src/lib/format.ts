import { IMAGE_BUCKET, SUPABASE_URL } from './supabase/env'
import type { OrderStatus, PaymentMethod, ProductWithRelations, Variant } from './types'

export const SHOP = {
  name: 'Marumi Phonecase',
  nameLo: 'ມາຣູມິໂຟນເຄສ',
  phone: '020 99 505 727',
  whatsapp: '8562099505727',
  facebook: 'https://www.facebook.com/profile.php?id=100087092628169',
  tagline: 'ອຸປະກອນເສີມໂທລະສັບ ຫູຟັງ ສາຍສາກ ພາວເວີແບັງ',
  // Shown at checkout when the customer pays by transfer. Leave account empty to hide.
  bank: { name: 'BCEL One', account: '', holder: '' },
}

export function formatKip(value: number) {
  return `${value.toLocaleString('en-US')} ກີບ`
}

export function imageUrl(path: string | null | undefined) {
  if (!path) return '/logo.jpg'
  return `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`
}

export function variantPrice(product: { price_lak: number }, variant?: Pick<Variant, 'price_lak'> | null) {
  return variant?.price_lak ?? product.price_lak
}

export function sortedImages(product: ProductWithRelations) {
  return [...product.product_images].sort((a, b) => a.sort - b.sort)
}

export function activeVariants(product: ProductWithRelations) {
  return product.product_variants.filter((v) => v.is_active).sort((a, b) => a.sort - b.sort || a.id - b.id)
}

export function totalStock(product: ProductWithRelations) {
  return activeVariants(product).reduce((sum, v) => sum + v.stock, 0)
}

/** Lowest variant price, for "from" prices on cards. */
export function minPrice(product: ProductWithRelations) {
  const prices = activeVariants(product).map((v) => variantPrice(product, v))
  return prices.length ? Math.min(...prices) : product.price_lak
}

export function whatsappLink(text: string) {
  return `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(text)}`
}

export function slugify(input: string) {
  const ascii = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return ascii || `item-${Date.now().toString(36)}`
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'ລໍຖ້າຢືນຢັນ',
  confirmed: 'ຢືນຢັນແລ້ວ',
  completed: 'ສຳເລັດ',
  cancelled: 'ຍົກເລີກ',
}

export const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'bg-butter text-navy',
  confirmed: 'bg-sky/40 text-navy',
  completed: 'bg-success/15 text-success',
  cancelled: 'bg-ink/10 text-muted',
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'ເງິນສົດ',
  transfer: 'ໂອນ (BCEL One)',
  cod: 'ເກັບເງິນປາຍທາງ',
}

const ERROR_LABEL: Record<string, string> = {
  invalid_name: 'ກະລຸນາໃສ່ຊື່ໃຫ້ຖືກຕ້ອງ',
  invalid_phone: 'ເບີໂທບໍ່ຖືກຕ້ອງ',
  address_required: 'ກະລຸນາໃສ່ທີ່ຢູ່ຈັດສົ່ງ',
  invalid_items: 'ກະຕ່າສິນຄ້າຫວ່າງ',
  invalid_qty: 'ຈຳນວນບໍ່ຖືກຕ້ອງ',
  variant_unavailable: 'ມີສິນຄ້າບາງລາຍການທີ່ບໍ່ມີຂາຍແລ້ວ',
  insufficient_stock: 'ສິນຄ້າໃນສະຕັອກບໍ່ພໍ',
  invalid_transition: 'ປ່ຽນສະຖານະນີ້ບໍ່ໄດ້',
  invalid_discount: 'ສ່ວນຫຼຸດບໍ່ຖືກຕ້ອງ',
  invalid_slip: 'ບິນໂອນບໍ່ຖືກຕ້ອງ ກະລຸນາແນບໃໝ່',
  forbidden: 'ບໍ່ມີສິດ',
  forbidden_cost: 'ສະເພາະເຈົ້າຂອງຮ້ານທີ່ໃສ່ຕົ້ນທຶນໄດ້',
  stock_must_use_rpc: 'ໃຫ້ປ່ຽນສະຕັອກຜ່ານປຸ່ມ ຮັບເຂົ້າ/ປັບສະຕັອກ',
}

/** Turns a Postgres exception raised by our RPCs into a Lao message. */
export function errorMessage(message: string | undefined) {
  if (!message) return 'ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່'
  const [code, detail] = message.split(':')
  const label = ERROR_LABEL[code]
  if (!label) return message
  return detail ? `${label}: ${detail}` : label
}
