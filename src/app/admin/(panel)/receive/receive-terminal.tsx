'use client'

import { refreshCatalog } from '@/app/admin/actions'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { CameraScanner } from '@/components/camera-scanner'
import { useDialog } from '@/components/dialog'
import { BoxIcon, CameraIcon, MinusIcon, PlusIcon, PrinterIcon, SearchIcon, TrashIcon } from '@/components/icons'
import { looksLikeBarcode, normalizeBarcode } from '@/lib/barcode'
import { errorMessage, formatKip } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import type { ProductWithRelations, Variant } from '@/lib/types'
import { beep, useBarcodeScanner } from '@/lib/use-barcode-scanner'

type Item = { product: ProductWithRelations; variant: Variant }
type Line = Item & { qty: number; cost: string }
type Draft = { lines: { variantId: number; qty: number; cost: string }[]; note: string }

const DRAFT_KEY = 'marumi-receive-draft-v1'

const label = ({ product, variant }: Item) =>
  variant.name === 'ມາດຕະຖານ' ? product.name : `${product.name} · ${variant.name}`

export function ReceiveTerminal({
  products: initialProducts,
  costs,
  isOwner,
}: {
  products: ProductWithRelations[]
  costs: Record<number, number>
  isOwner: boolean
}) {
  const router = useRouter()
  const dialog = useDialog()
  const [products, setProducts] = useState(initialProducts)
  const [lines, setLines] = useState<Line[]>([])
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [linking, setLinking] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [restored, setRestored] = useState(false)
  const [camera, setCamera] = useState(false)

  const items = useMemo(
    () => products.flatMap((product) => product.product_variants.map((variant) => ({ product, variant }))),
    [products],
  )
  const byBarcode = useMemo(() => new Map(items.filter((i) => i.variant.barcode).map((i) => [i.variant.barcode!, i])), [items])
  const byId = useMemo(() => new Map(items.map((i) => [i.variant.id, i])), [items])

  // Keep an unsaved delivery across reloads or accidental navigation.
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null
      if (draft) {
        const restoredLines = draft.lines
          .map((l) => {
            const item = byId.get(l.variantId)
            return item ? { ...item, qty: l.qty, cost: l.cost } : null
          })
          .filter((l): l is Line => !!l)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved draft once on mount
        setLines(restoredLines)
        setNote(draft.note)
      }
    } catch {
      // Unreadable draft; start fresh.
    }
    setRestored(true)
    // byId is only needed for the first restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!restored) return
    try {
      if (lines.length === 0 && !note) localStorage.removeItem(DRAFT_KEY)
      else {
        const draft: Draft = { lines: lines.map((l) => ({ variantId: l.variant.id, qty: l.qty, cost: l.cost })), note }
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      }
    } catch {
      // Storage unavailable; the list still works for this visit.
    }
  }, [lines, note, restored])

  function addItem(item: Item, qty = 1) {
    setLines((prev) => {
      const existing = prev.find((l) => l.variant.id === item.variant.id)
      if (existing) return prev.map((l) => (l.variant.id === item.variant.id ? { ...l, qty: l.qty + qty } : l))
      // Newest on top, where the eye is after a scan.
      return [{ ...item, qty, cost: '' }, ...prev]
    })
  }

  async function handleScan(code: string) {
    const hit = byBarcode.get(code)
    if (hit) {
      beep(true)
      addItem(hit)
      return
    }
    beep(false)
    const choice = await dialog.choose({
      title: 'ບໍ່ພົບສິນຄ້າລະຫັດນີ້',
      message: `${code} — ຜູກກັບສິນຄ້າທີ່ມີຢູ່ແລ້ວ ຫຼື ສ້າງສິນຄ້າໃໝ່?`,
      okLabel: 'ຜູກກັບສິນຄ້າທີ່ມີ',
      altLabel: 'ສ້າງສິນຄ້າໃໝ່',
    })
    if (choice === 'ok') setLinking(code)
    if (choice === 'alt') router.push(`/admin/products/new?barcode=${encodeURIComponent(code)}`)
  }

  useBarcodeScanner(handleScan, !linking && !saving && !camera)

  async function linkBarcode(item: Item, code: string) {
    const { error } = await createClient().from('product_variants').update({ barcode: code }).eq('id', item.variant.id)
    if (error) {
      const message = error.code === '23505' ? errorMessage('barcode_taken') : errorMessage(error.message)
      dialog.alert({ tone: 'error', title: 'ຜູກລະຫັດບໍ່ສຳເລັດ', message })
      return
    }
    // Reflect the new barcode locally so the next scan of this code is instant.
    setProducts((prev) =>
      prev.map((p) =>
        p.id !== item.product.id
          ? p
          : { ...p, product_variants: p.product_variants.map((v) => (v.id === item.variant.id ? { ...v, barcode: code } : v)) },
      ),
    )
    setLinking(null)
    beep(true)
    addItem({ product: item.product, variant: { ...item.variant, barcode: code } })
    dialog.alert({ tone: 'success', title: 'ຜູກລະຫັດແລ້ວ', message: `${label(item)} = ${code}` })
  }

  const updateLine = (id: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.variant.id === id ? { ...l, ...patch } : l)))

  const term = search.trim().toLowerCase()
  const suggestions = term && !looksLikeBarcode(normalizeBarcode(search))
    ? items.filter((i) => label(i).toLowerCase().includes(term)).slice(0, 8)
    : []

  const totalQty = lines.reduce((n, l) => n + l.qty, 0)
  const totalCost = lines.reduce((n, l) => n + l.qty * (Number(l.cost) || 0), 0)

  async function clearAll() {
    if (!(await dialog.confirm({ title: 'ລ້າງລາຍການຮັບເຂົ້າ?', message: 'ລາຍການທີ່ສະແກນໄວ້ຈະຖືກລຶບ (ຍັງບໍ່ໄດ້ບັນທຶກສະຕັອກ)', okLabel: 'ລ້າງ', danger: true })))
      return
    setLines([])
    setNote('')
  }

  async function saveAll() {
    if (lines.some((l) => l.qty < 1)) {
      dialog.alert({ tone: 'warning', title: 'ຈຳນວນບໍ່ຖືກຕ້ອງ', message: 'ທຸກລາຍການຕ້ອງມີຢ່າງໜ້ອຍ 1 ຊິ້ນ' })
      return
    }
    const ok = await dialog.confirm({
      title: 'ບັນທຶກການຮັບເຂົ້າ?',
      message: `${lines.length} ລາຍການ · ລວມ ${totalQty} ຊິ້ນ`,
      okLabel: 'ບັນທຶກ',
      tone: 'info',
    })
    if (!ok) return
    setSaving(true)
    const { error } = await createClient().rpc('restock_batch', {
      p_items: lines.map((l) => ({
        variant_id: l.variant.id,
        qty: l.qty,
        unit_cost_lak: isOwner && l.cost ? Number(l.cost) : null,
      })),
      p_note: note.trim() || null,
    })
    setSaving(false)
    if (error) {
      dialog.alert({ tone: 'error', title: 'ບັນທຶກບໍ່ສຳເລັດ', message: errorMessage(error.message) })
      return
    }
    dialog.alert({ tone: 'success', title: 'ຮັບສິນຄ້າເຂົ້າແລ້ວ', message: `${lines.length} ລາຍການ · ${totalQty} ຊິ້ນ` })
    setLines([])
    setNote('')
    await refreshCatalog()
    router.refresh()
  }

  // After a refresh, show the new stock levels on any lines still listed.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync server data into local state
    setProducts(initialProducts)
  }, [initialProducts])

  return (
    <div className="space-y-4">
      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">
            <BoxIcon size={22} /> ຮັບສິນຄ້າເຂົ້າ
            <span className="ml-1 flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#7ee2b8]" /> ພ້ອມສະແກນ
            </span>
          </span>
          <button type="button" className="panel-btn" onClick={() => setCamera(true)}>
            <CameraIcon size={18} /> ກ້ອງ
          </button>
          <div className="relative w-full sm:w-96">
            <div className="panel-search">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  const code = normalizeBarcode(search)
                  if (looksLikeBarcode(code)) {
                    setSearch('')
                    handleScan(code)
                  } else if (suggestions[0]) {
                    addItem(suggestions[0])
                    setSearch('')
                  }
                }}
                placeholder="ສະແກນ, ພິມບາໂຄ້ດ ຫຼື ຊື່ສິນຄ້າ..."
                aria-label="ຄົ້ນຫາສິນຄ້າ"
              />
              <button type="button" onClick={() => setSearch('')}>
                {search ? 'ລ້າງ' : <SearchIcon size={18} />}
              </button>
            </div>
            {suggestions.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg bg-white text-ink shadow-lg">
                {suggestions.map((i) => (
                  <li key={i.variant.id}>
                    <button
                      className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-mist"
                      onClick={() => {
                        addItem(i)
                        setSearch('')
                      }}
                    >
                      <span className="font-semibold">{label(i)}</span>
                      <span className="text-muted">ເຫຼືອ {i.variant.stock}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10 text-center!">#</th>
                <th>ສິນຄ້າ</th>
                <th>ບາໂຄ້ດ</th>
                <th className="text-right!">ສະຕັອກປັດຈຸບັນ</th>
                <th className="text-center!">ຈຳນວນຮັບເຂົ້າ</th>
                {isOwner && <th className="text-right!">ຕົ້ນທຶນ/ຊິ້ນ</th>}
                <th className="text-right!">ຫຼັງຮັບເຂົ້າ</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.variant.id}>
                  <td className="text-center text-muted">{lines.length - i}</td>
                  <td className="font-semibold">{label(l)}</td>
                  <td className="font-mono text-xs text-muted">{l.variant.barcode ?? '—'}</td>
                  <td className="num">{l.variant.stock}</td>
                  <td>
                    <div className="mx-auto flex w-fit items-center overflow-hidden rounded-lg border-[1.5px] border-navy bg-white">
                      <button className="px-2.5 py-1.5 hover:bg-mist disabled:opacity-30" disabled={l.qty <= 1} onClick={() => updateLine(l.variant.id, { qty: l.qty - 1 })} aria-label="ຫຼຸດ">
                        <MinusIcon size={16} />
                      </button>
                      <input
                        className="w-14 border-x-[1.5px] border-navy py-1 text-center font-bold text-navy outline-none"
                        inputMode="numeric"
                        value={l.qty}
                        onChange={(e) => updateLine(l.variant.id, { qty: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
                        aria-label="ຈຳນວນ"
                      />
                      <button className="px-2.5 py-1.5 hover:bg-mist" onClick={() => updateLine(l.variant.id, { qty: l.qty + 1 })} aria-label="ເພີ່ມ">
                        <PlusIcon size={16} />
                      </button>
                    </div>
                  </td>
                  {isOwner && (
                    <td className="num">
                      <input
                        className="w-28 rounded border border-line px-2 py-1 text-right"
                        inputMode="numeric"
                        value={l.cost}
                        onChange={(e) => updateLine(l.variant.id, { cost: e.target.value.replace(/[^\d]/g, '') })}
                        placeholder={costs[l.variant.id] != null ? String(costs[l.variant.id]) : 'ກີບ'}
                        aria-label="ຕົ້ນທຶນຕໍ່ຊິ້ນ"
                      />
                    </td>
                  )}
                  <td className="num font-bold text-success">{l.variant.stock + l.qty}</td>
                  <td className="text-center">
                    <button
                      className="text-muted hover:text-danger"
                      onClick={() => setLines((prev) => prev.filter((x) => x.variant.id !== l.variant.id))}
                      aria-label="ລຶບລາຍການ"
                    >
                      <TrashIcon size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={isOwner ? 8 : 7} className="py-14 text-center text-muted">
                    <BoxIcon size={36} className="mx-auto mb-2" />
                    <p className="font-semibold">ຍິງປືນສະແກນໃສ່ສິນຄ້າເພື່ອເລີ່ມຮັບເຂົ້າ</p>
                    <p className="text-xs">ສະແກນຊ້ຳ = +1 ຊິ້ນ · ຫຼື ພິມຊື່ສິນຄ້າໃນຊ່ອງຄົ້ນຫາ</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {lines.length > 0 && (
        <section className="panel p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="summary-box min-w-60 space-y-1 text-sm">
              <p className="flex justify-between gap-6">
                <span>ລາຍການ</span> <span className="font-semibold">{lines.length}</span>
              </p>
              <p className="flex justify-between gap-6 text-base font-bold text-navy">
                <span>ລວມຮັບເຂົ້າ</span> <span>{totalQty} ຊິ້ນ</span>
              </p>
              {isOwner && totalCost > 0 && (
                <p className="flex justify-between gap-6">
                  <span>ມູນຄ່າຕົ້ນທຶນ</span> <span className="font-semibold">{formatKip(totalCost)}</span>
                </p>
              )}
            </div>
            <div className="min-w-60 flex-1">
              <label className="label" htmlFor="receive-note">ໝາຍເຫດ (ເຊັ່ນ ຜູ້ສະໜອງ, ເລກບິນ)</label>
              <input id="receive-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button className="btn btn-ghost" onClick={clearAll} disabled={saving}>
              ລ້າງລາຍການ
            </button>
            {lines.some((l) => l.variant.barcode) && (
              <Link
                href={`/admin/labels?items=${lines.filter((l) => l.variant.barcode).map((l) => `${l.variant.id}:${l.qty}`).join(',')}`}
                className="btn btn-ghost"
                title="ພິມສະຕິກເກີເທົ່າຈຳນວນທີ່ຮັບເຂົ້າ (ລາຍການນີ້ຍັງຖືກເກັບໄວ້)"
              >
                <PrinterIcon size={18} /> ພິມສະຕິກເກີ
              </Link>
            )}
            <button
              className="flex items-center gap-2 rounded-md bg-butter px-8 py-3.5 text-lg font-bold text-navy hover:bg-butter-deep disabled:opacity-50"
              onClick={saveAll}
              disabled={saving}
            >
              <BoxIcon size={22} /> {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກຮັບເຂົ້າທັງໝົດ'}
            </button>
          </div>
        </section>
      )}

      {camera && !linking && (
        <CameraScanner continuous title="ສະແກນຮັບເຂົ້າ" onScan={handleScan} onClose={() => setCamera(false)} />
      )}

      {linking && <LinkDialog code={linking} items={items} onPick={(item) => linkBarcode(item, linking)} onClose={() => setLinking(null)} />}
    </div>
  )
}

/** Pick which existing variant an unknown barcode belongs to (variants without a barcode first). */
function LinkDialog({
  code,
  items,
  onPick,
  onClose,
}: {
  code: string
  items: Item[]
  onPick: (item: Item) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const term = query.trim().toLowerCase()
  const matches = items
    .filter((i) => !term || label(i).toLowerCase().includes(term))
    .sort((a, b) => Number(!!a.variant.barcode) - Number(!!b.variant.barcode))
    .slice(0, 50)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="panel flex max-h-[80dvh] w-full max-w-lg flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <span className="panel-title">ຜູກລະຫັດ {code}</span>
        </div>
        <div className="p-3">
          <input className="input" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ..." />
        </div>
        <ul className="flex-1 overflow-y-auto border-t border-line">
          {matches.map((i) => (
            <li key={i.variant.id}>
              <button className="flex w-full items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-left hover:bg-mist" onClick={() => onPick(i)}>
                <span className="font-semibold">{label(i)}</span>
                <span className="font-mono text-xs text-muted">{i.variant.barcode ?? 'ຍັງບໍ່ມີລະຫັດ'}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="p-6 text-center text-muted">ບໍ່ພົບສິນຄ້າ</li>}
        </ul>
        <div className="p-3 text-right">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ປິດ
          </button>
        </div>
      </div>
    </div>
  )
}
