import Link from 'next/link'
import { formatDateTime } from '@/lib/dates'
import { ReceiptIcon } from '@/components/icons'
import { formatKip, PAYMENT_LABEL, STATUS_LABEL, STATUS_STYLE } from '@/lib/format'
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
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">
          <ReceiptIcon size={22} /> ອໍເດີ ({orders.length})
        </span>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={`/admin/orders?status=${t.value}`}
              className={`panel-btn ${t.value === status ? 'bg-butter!' : 'bg-white/90!'}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>ລະຫັດ</th>
              <th>ວັນທີ</th>
              <th>ລູກຄ້າ</th>
              <th>ຊ່ອງທາງ</th>
              <th>ການຊຳລະ</th>
              <th className="text-right!">ຍອດລວມ</th>
              <th>ສະຖານະ</th>
              <th className="text-center!">ຈັດການ</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="font-semibold whitespace-nowrap">{o.code}</td>
                <td className="whitespace-nowrap text-muted">{formatDateTime(o.created_at)}</td>
                <td>
                  <span className="font-semibold">{o.customer_name}</span>
                  {o.customer_phone && <span className="block text-xs text-muted">{o.customer_phone}</span>}
                </td>
                <td className="whitespace-nowrap">
                  {o.channel === 'store' ? 'ໜ້າຮ້ານ' : o.delivery_method === 'delivery' ? 'ອອນລາຍ · ຈັດສົ່ງ' : 'ອອນລາຍ · ຮັບທີ່ຮ້ານ'}
                </td>
                <td className="whitespace-nowrap">
                  {PAYMENT_LABEL[o.payment_method]}
                  {o.payment_slip_path && <span className="ml-1 text-xs">🧾</span>}
                </td>
                <td className="num font-bold text-navy">{formatKip(o.total_lak)}</td>
                <td>
                  <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[o.status]}`}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </td>
                <td className="text-center">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="inline-flex rounded-md bg-navy px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white hover:bg-navy-soft"
                  >
                    ເບິ່ງລາຍລະອຽດ
                  </Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-muted">
                  ບໍ່ມີອໍເດີ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
