/** What a staff account may do. The owner always has every permission. Keep in sync with 0008_staff.sql. */
export const PERMISSIONS = [
  { key: 'pos', label: 'ຂາຍໜ້າຮ້ານ', hint: 'ໃຊ້ໜ້າຂາຍ ແລະ ພິມໃບບິນ' },
  { key: 'discount', label: 'ໃຫ້ສ່ວນຫຼຸດຕອນຂາຍ', hint: 'ໃສ່ສ່ວນຫຼຸດໃນໜ້າຂາຍໄດ້' },
  { key: 'receive', label: 'ຮັບສິນຄ້າເຂົ້າ', hint: 'ເພີ່ມສະຕັອກຈາກການຮັບເຄື່ອງ' },
  { key: 'orders', label: 'ຈັດການອໍເດີອອນລາຍ', hint: 'ຢືນຢັນ ແລະ ປິດອໍເດີ' },
  { key: 'cancel', label: 'ຍົກເລີກບິນ / ອໍເດີ', hint: 'ຍົກເລີກ ແລະ ຄືນສະຕັອກ' },
  { key: 'sales', label: 'ເບິ່ງຍອດຂາຍ', hint: 'ໜ້າຍອດຂາຍ ແລະ ໃບບິນທັງໝົດ' },
  { key: 'products', label: 'ຈັດການສິນຄ້າ', hint: 'ເພີ່ມ/ແກ້ສິນຄ້າ, ລາຄາ, ສະຕັອກ, ໝວດ & ລຸ້ນ' },
  { key: 'labels', label: 'ພິມສະຕິກເກີບາໂຄ້ດ', hint: '' },
  { key: 'reports', label: 'ລາຍງານ, ຕົ້ນທຶນ ແລະ ກຳໄລ', hint: 'ເຫັນລາຄາທຶນ ແລະ ກຳໄລທຸກບ່ອນ' },
  { key: 'staff', label: 'ຈັດການພະນັກງານ', hint: 'ເພີ່ມ/ແກ້ໄຂ/ປິດບັນຊີພະນັກງານ' },
  { key: 'settings', label: 'ຕັ້ງຄ່າຮ້ານ', hint: 'ບັນຊີທະນາຄານ ແລະ QR ສຳລັບລູກຄ້າໂອນ' },
] as const

export type Permission = (typeof PERMISSIONS)[number]['key']
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as Permission[]

/** Ready-made sets for the "add staff" form. */
export const PERMISSION_PRESETS: { label: string; keys: Permission[] }[] = [
  { label: 'ພະນັກງານຂາຍ', keys: ['pos', 'orders', 'sales', 'labels'] },
  { label: 'ຜູ້ຈັດການຮ້ານ', keys: ['pos', 'discount', 'receive', 'orders', 'cancel', 'sales', 'products', 'labels'] },
  { label: 'ທຸກສິດ', keys: PERMISSION_KEYS },
]

export type Role = 'owner' | 'staff'

export function hasPermission(user: { role: Role; permissions: readonly string[] }, key: Permission) {
  return user.role === 'owner' || user.permissions.includes(key)
}

/**
 * Staff sign in with their phone number. Supabase signs in by email, so each
 * phone maps to a private address that never receives mail.
 */
export const STAFF_EMAIL_DOMAIN = 'staff.marumi.shop'

/** Lao numbers as typed by people: "020 5555 1234", "+856 20 5555 1234", "2055551234" → "02055551234". */
export function normalizePhone(input: string) {
  let digits = input.replace(/\D/g, '')
  if (digits.startsWith('856')) digits = digits.slice(3)
  if (digits && !digits.startsWith('0')) digits = `0${digits}`
  return digits
}

export const isValidPhone = (phone: string) => /^0\d{8,10}$/.test(phone)

export const staffEmail = (phone: string) => `${phone}@${STAFF_EMAIL_DOMAIN}`
