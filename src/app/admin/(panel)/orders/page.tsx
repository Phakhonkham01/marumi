import Link from 'next/link'
import { formatDateTime } from '@/lib/dates'
import { formatKip, STATUS_LABEL, STATUS_STYLE } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import type { Order, OrderStatus } from '@/lib/types'

const TABS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'pending', label: STATUS_LABEL.pending },
  { value: 'confirmed', label: STATUS_LABEL.confirmed },
  { value: 'completed', label: STATUS_LABEL.completed },
  { value: 'cancelled', label: STATUS_LABEL.cancelled },
  { value: 'all', label: 'ທັງໝົດ' },
]

export default async function OrdersPage(props: PageProps<'/admin/orders'>) {
  const sp = await props.searchParams
  const status = (TABS.find((t) => t.value === sp.status)?.value ?? 'pending') as OrderStatus | 'all'
  const supabase = await createClient()

  let query = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100)
  if (status !== 'all') query = query.eq('status', status)
  const { data } = await query
  const orders = (data as Order[]) ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">ອໍເດີ</h1>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => (
          <Link key={t.value} href={`/admin/orders?status=${t.value}`} className="chip" data-active={t.value === status}>
            {t.label}
          </Link>
        ))}
      </div>

      <div className="card divide-y divide-line">
        {orders.map((o) => (
          <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center gap-3 p-3 hover:bg-mist/50">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {o.customer_name}
                <span className="ml-2 font-display text-xs text-muted">{o.code}</span>
              </p>
              <p className="text-xs text-muted">
                {formatDateTime(o.created_at)} · {o.channel === 'store' ? 'ໜ້າຮ້ານ' : 'ອອນລາຍ'}
                {o.channel === 'online' && ` · ${o.delivery_method === 'delivery' ? 'ຈັດສົ່ງ' : 'ຮັບທີ່ຮ້ານ'}`}
                {o.payment_slip_path && ' · 🧾 ມີບິນໂອນ'}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-navy">{formatKip(o.total_lak)}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[o.status]}`}>
                {STATUS_LABEL[o.status]}
              </span>
            </div>
          </Link>
        ))}
        {orders.length === 0 && <p className="p-6 text-center text-muted">ບໍ່ມີອໍເດີ</p>}
      </div>
    </div>
  )
}
