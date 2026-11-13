'use client'

import JsBarcode from 'jsbarcode'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MinusIcon, PlusIcon, PrinterIcon, TrashIcon } from '@/components/icons'
import { formatKip, variantPrice } from '@/lib/format'
import type { ProductWithRelations, Variant } from '@/lib/types'

type Item = { product: ProductWithRelations; variant: Variant }
type Line = Item & { qty: number }

// Sizes in mm. "a4" is the common 3×8 sticker sheet (70×37 mm, 24 per page);
// the others are single labels for thermal label printers.
const PRESETS = {
  a4: { label: 'A4 ສະຕິກເກີ 3×8 (70×37 mm)', page: 'A4', w: 70, h: 37, sheet: true },
  t50: { label: 'ເຄື່ອງພິມສະຕິກເກີ 50×30 mm', page: '50mm 30mm', w: 50, h: 30, sheet: false },
  t40: { label: 'ເຄື່ອງພິມສະຕິກເກີ 40×30 mm', page: '40mm 30mm', w: 40, h: 30, sheet: false },
} as const
type PresetKey = keyof typeof PRESETS

const name = ({ product, variant }: Item) =>
  variant.name === 'ມາດຕະຖານ' ? product.name : `${product.name} · ${variant.name}`

function isEan13(code: string) {
  if (!/^\d{13}$/.test(code)) return false
  const sum = [...code.slice(0, 12)].reduce((n, d, i) => n + Number(d) * (i % 2 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === Number(code[12])
}

function Barcode({ value, height }: { value: string; height: number }) {
  const svg = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!svg.current) return
    const options = { height, width: 1.4, fontSize: 11, margin: 0, textMargin: 1 }
    try {
      JsBarcode(svg.current, value, { ...options, format: isEan13(value) ? 'EAN13' : 'CODE128' })
    } catch {
      JsBarcode(svg.current, value, { ...options, format: 'CODE128' })
    }
  }, [value, height])
  return <svg ref={svg} className="max-w-full" />
}

export function LabelSheet({
  products,
  initial,
}: {
  products: ProductWithRelations[]
  initial: { variantId: number; qty: number }[]
}) {
  const items = useMemo(
    () => products.flatMap((product) => product.product_variants.map((variant) => ({ product, variant }))),
    [products],
  )
  const byId = useMemo(() => new Map(items.map((i) => [i.variant.id, i])), [items])

  const [lines, setLines] = useState<Line[]>(() =>
    initial.map((l) => ({ ...byId.get(l.variantId)!, qty: l.qty })).filter((l) => l.variant),
  )
  const [preset, setPreset] = useState<PresetKey>('a4')
  const [showPrice, setShowPrice] = useState(true)
  const [search, setSearch] = useState('')
  const size = PRESETS[preset]

  const term = search.trim().toLowerCase()
  const matches = term
    ? items.filter((i) => name(i).toLowerCase().includes(term) || i.variant.barcode?.includes(term.toUpperCase())).slice(0, 8)
    : []

  function add(item: Item) {
    setLines((prev) =>
      prev.some((l) => l.variant.id === item.variant.id)
        ? prev.map((l) => (l.variant.id === item.variant.id ? { ...l, qty: l.qty + 1 } : l))
        : [...prev, { ...item, qty: 1 }],
    )
    setSearch('')
  }

  const setQty = (id: number, qty: number) =>
    setLines((prev) => prev.map((l) => (l.variant.id === id ? { ...l, qty: Math.max(1, Math.min(500, qty)) } : l)))

  const printable = lines.filter((l) => l.variant.barcode)
  const labels = printable.flatMap((l) => Array.from({ length: l.qty }, () => l))
  const missing = lines.filter((l) => !l.variant.barcode)

  return (
    <div className="space-y-4">
      {/* Page size for the printer; the app shell is hidden in print. */}
      <style>{`@page { size: ${size.page}; margin: 0; }`}</style>

      <section className="panel print:hidden">
        <div className="panel-head">
          <span className="panel-title">
            <PrinterIcon size={22} /> ພິມສະຕິກເກີບາໂຄ້ດ
          </span>
          <select value={preset} onChange={(e) => setPreset(e.target.value as PresetKey)} aria-label="ຂະໜາດສະຕິກເກີ">
            {Object.entries(PRESETS).map(([key, p]) => (
              <option key={key} value={key}>
                {p.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> ສະແດງລາຄາ
          </label>
          <button className="panel-btn bg-butter!" onClick={() => window.print()} disabled={labels.length === 0}>
            <PrinterIcon size={18} /> ພິມ {labels.length} ແຜ່ນ
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="relative max-w-md">
            <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ເພີ່ມສິນຄ້າ: ພິມຊື່ ຫຼື ບາໂຄ້ດ..." />
            {matches.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-white shadow-lg">
                {matches.map((i) => (
                  <li key={i.variant.id}>
                    <button className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-mist" onClick={() => add(i)}>
                      <span className="font-semibold">{name(i)}</span>
                      <span className="font-mono text-xs text-muted">{i.variant.barcode ?? 'ບໍ່ມີລະຫັດ'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {lines.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ສິນຄ້າ</th>
                  <th>ບາໂຄ້ດ</th>
                  <th className="text-center!">ຈຳນວນແຜ່ນ</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.variant.id}>
                    <td className="font-semibold">{name(l)}</td>
                    <td className="font-mono text-xs">
                      {l.variant.barcode ?? (
                        <Link href={`/admin/products/${l.product.id}`} className="text-danger underline">
                          ຍັງບໍ່ມີລະຫັດ — ໄປສ້າງ
                        </Link>
                      )}
                    </td>
                    <td>
                      <div className="mx-auto flex w-fit items-center overflow-hidden rounded-lg border-[1.5px] border-navy">
                        <button className="px-2.5 py-1.5 hover:bg-mist" onClick={() => setQty(l.variant.id, l.qty - 1)} aria-label="ຫຼຸດ">
                          <MinusIcon size={16} />
                        </button>
                        <input
                          className="w-14 border-x-[1.5px] border-navy py-1 text-center font-bold text-navy outline-none"
                          inputMode="numeric"
                          value={l.qty}
                          onChange={(e) => setQty(l.variant.id, Number(e.target.value.replace(/[^\d]/g, '')) || 1)}
                          aria-label="ຈຳນວນແຜ່ນ"
                        />
                        <button className="px-2.5 py-1.5 hover:bg-mist" onClick={() => setQty(l.variant.id, l.qty + 1)} aria-label="ເພີ່ມ">
                          <PlusIcon size={16} />
                        </button>
                      </div>
                    </td>
                    <td className="text-center">
                      <button className="text-muted hover:text-danger" onClick={() => setLines((p) => p.filter((x) => x.variant.id !== l.variant.id))} aria-label="ລຶບ">
                        <TrashIcon size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted">ຍັງບໍ່ມີລາຍການ — ຄົ້ນຫາສິນຄ້າເພື່ອເພີ່ມ</p>
          )}
          {missing.length > 0 && (
            <p className="text-sm text-danger">{missing.length} ລາຍການຍັງບໍ່ມີບາໂຄ້ດ ຈຶ່ງບໍ່ຖືກພິມ</p>
          )}
          <p className="text-xs text-muted">
            ຕອນພິມ: ຕັ້ງ Scale/ຂະໜາດເປັນ 100% (ບໍ່ໃຫ້ fit to page) ແລະ ປິດ Headers and footers
          </p>
        </div>
      </section>

      {labels.length > 0 && (
        <section className="overflow-x-auto rounded-lg bg-white p-4 shadow print:overflow-visible print:rounded-none print:p-0 print:shadow-none">
          <p className="mb-3 text-sm font-semibold text-navy print:hidden">ຕົວຢ່າງ ({labels.length} ແຜ່ນ)</p>
          <div
            className={size.sheet ? 'grid' : 'flex flex-wrap gap-2 print:block'}
            style={size.sheet ? { gridTemplateColumns: `repeat(3, ${size.w}mm)`, width: `${size.w * 3}mm` } : undefined}
          >
            {labels.map((l, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center overflow-hidden text-center text-black outline outline-1 outline-dashed outline-line print:outline-none"
                style={{
                  width: `${size.w}mm`,
                  height: `${size.h}mm`,
                  padding: '2mm',
                  breakInside: 'avoid',
                  breakAfter: size.sheet ? undefined : 'page',
                }}
              >
                <p className="w-full truncate text-[8pt] font-semibold leading-tight">{name(l)}</p>
                {showPrice && (
                  <p className="text-[9pt] font-bold leading-tight">{formatKip(variantPrice(l.product, l.variant))}</p>
                )}
                <Barcode value={l.variant.barcode!} height={size.h >= 37 ? 42 : 30} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
