// Barcode guns type like a keyboard. With the Lao (Kedmanee) layout active the
// number row comes out as Lao letters, so map those keys back to what was meant.
const LAO_KEYS: Record<string, string> = {
  ຢ: '1', ຟ: '2', ໂ: '3', ຖ: '4', 'ຸ': '5', 'ູ': '6', ຄ: '7', ຕ: '8', ຈ: '9', ຂ: '0', ຊ: '-',
  '໐': '0', '໑': '1', '໒': '2', '໓': '3', '໔': '4', '໕': '5', '໖': '6', '໗': '7', '໘': '8', '໙': '9',
}

/** Canonical form stored in the database: Lao-layout keys fixed, upper case, no spaces. */
export function normalizeBarcode(raw: string) {
  return [...raw]
    .map((ch) => LAO_KEYS[ch] ?? ch)
    .join('')
    .replace(/\s/g, '')
    .toUpperCase()
}

export function looksLikeBarcode(value: string) {
  return /^[A-Z0-9-]{4,64}$/.test(value)
}

/**
 * Shop-made code for items without a manufacturer barcode: a valid EAN-13 in the
 * "2xx" in-store range. Digits only, so any scanner reads it on any keyboard layout.
 */
export function generateShopBarcode() {
  const digits = '2' + Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('')
  const sum = [...digits].reduce((n, d, i) => n + Number(d) * (i % 2 ? 3 : 1), 0)
  return digits + ((10 - (sum % 10)) % 10)
}
