'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { formatKip } from '@/lib/format'
import { savedOrders, type SavedOrder, type TrackedOrder } from '@/lib/my-orders'
import { createClient } from '@/lib/supabase/client'
import { OrderSummary } from './order-summary'

async function byCode(code: string) {
  const { data, error } = await createClient().rpc('track_order', { p_code: code.trim() })
  if (error) throw error
  return (data as TrackedOrder | null) ?? null
}

async function byPhone(phone: string) {
  const { data, error } = await createClient().rpc('track_orders_by_phone', { p_phone: phone })
  if (error) throw error
  return (data as TrackedOrder[] | null) ?? []
}

/** Under "thank you": the order just placed, with its status and items. */
export function OrderDoneDetails({ code }: { code: string }) {
  const [order, setOrder] = useState<TrackedOrder | null | undefined>(undefined)

  useEffect(() => {
    byCode(code)
      .then(setOrder)
      .catch(() => setOrder(null))
  }, [code])

  return (
    <div className="w-full space-y-3">
      {order === undefined && <div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-white/60" />}
      {order && <OrderSummary order={order} />}
      <Link href={`/track?code=${encodeURIComponent(code)}`} className="btn btn-primary w-full">
        ຕິດຕາມອໍເດີ
      </Link>
    </div>
  )
}

type Mode = 'code' | 'phone'

/**
 * /track: find orders by order code or by the phone number used to order.
 * Orders placed on this device are listed for one tap.
 */
export function TrackOrder() {
  const params = useSearchParams()
  const [mode, setMode] = useState<Mode>('code')
  const [mine, setMine] = useState<SavedOrder[]>([])
  const [value, setValue] = useState(params.get('code') ?? '')
  const [orders, setOrders] = useState<TrackedOrder[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const find = useCallback(async (how: Mode, input: string) => {
    setBusy(true)
    setError(null)
    try {
      const found = how === 'code' ? [await byCode(input)].filter((o): o is TrackedOrder => !!o) : await byPhone(input)
      setOrders(found)
      setOpen(found[0]?.code ?? null)
      if (found.length === 0) {
        setError(how === 'code' ? 'ບໍ່ພົບອໍເດີລະຫັດນີ້ — ກວດລະຫັດອີກຄັ້ງ' : 'ບໍ່ພົບອໍເດີຂອງເບີນີ້ໃນ 90 ມື້ຫຼ້າສຸດ')
      }
    } catch {
      setError('ເຊື່ອມຕໍ່ບໍ່ໄດ້ ລອງໃໝ່ອີກຄັ້ງ')
    } finally {
      setBusy(false)
    }
  }, [])

  // Orders saved on this device; open the one in the link (or the latest) straight away.
  // (Read after mount: localStorage is not available while rendering on the server.)
  useEffect(() => {
    const list = savedOrders()
    const pick = params.get('code') ?? list[0]?.code
    void Promise.resolve().then(() => {
      setMine(list)
      if (!pick) return
      setMode('code')
      setValue(pick)
      return find('code', pick)
    })
  }, [params, find])

  const switchMode = (m: Mode) => {
    setMode(m)
    setValue('')
    setError(null)
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="page-bar">ຕິດຕາມອໍເດີ</h1>

      <form
        className="card space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          find(mode, value)
        }}
      >
        <div className="grid grid-cols-2 gap-2" role="tablist">
          {(
            [
              ['code', 'ດ້ວຍລະຫັດອໍເດີ'],
              ['phone', 'ດ້ວຍເບີໂທ'],
            ] as const
          ).map(([m, label]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className="chip justify-center" data-active={mode === m} onClick={() => switchMode(m)}>
              {label}
            </button>
          ))}
        </div>
        {mode === 'code' ? (
          <input
            key="code"
            className="input font-display uppercase"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="ລະຫັດອໍເດີ ເຊັ່ນ MR261116-XXXXX"
            autoCapitalize="characters"
            aria-label="ລະຫັດອໍເດີ"
            required
          />
        ) : (
          <input
            key="phone"
            className="input"
            type="tel"
            inputMode="tel"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="ເບີໂທທີ່ໃຊ້ສັ່ງ 020 XXXX XXXX"
            autoComplete="tel"
            aria-label="ເບີໂທທີ່ໃຊ້ສັ່ງ"
            required
          />
        )}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'ກຳລັງຄົ້ນຫາ...' : 'ເບິ່ງສະຖານະອໍເດີ'}
        </button>
        {error && <p className="text-center text-sm font-semibold text-danger">{error}</p>}
      </form>

      {mine.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-sm text-muted">ອໍເດີທີ່ສັ່ງຈາກເຄື່ອງນີ້:</span>
          {mine.map((o) => (
            <button
              key={o.code}
              type="button"
              className="chip"
              data-active={open === o.code}
              onClick={() => {
                setMode('code')
                setValue(o.code)
                find('code', o.code)
              }}
            >
              {o.code}
            </button>
          ))}
        </div>
      )}

      {orders && orders.length > 1 && <p className="text-sm text-muted">ພົບ {orders.length} ອໍເດີ — ກົດເພື່ອເບິ່ງລາຍລະອຽດ</p>}
      {orders?.map((o) =>
        open === o.code || orders.length === 1 ? (
          <OrderSummary key={o.code} order={o} />
        ) : (
          <button key={o.code} type="button" className="card flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setOpen(o.code)}>
            <span>
              <span className="block font-display font-bold text-navy">{o.code}</span>
              <span className="block text-xs text-muted">{new Date(o.created_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Vientiane' })}</span>
            </span>
            <span className="text-right text-sm">
              <span className="block font-semibold">{STATUS_TEXT[o.status]}</span>
              <span className="block text-muted">{formatKip(o.total_lak)}</span>
            </span>
          </button>
        ),
      )}

      {orders && orders.length > 0 && (
        <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={() => find(mode, value)}>
          ↻ ອັບເດດສະຖານະ
        </button>
      )}
    </div>
  )
}

const STATUS_TEXT: Record<TrackedOrder['status'], string> = {
  pending: 'ລໍຖ້າຢືນຢັນ',
  confirmed: 'ຢືນຢັນແລ້ວ',
  completed: 'ສຳເລັດ',
  cancelled: 'ຍົກເລີກ',
}
