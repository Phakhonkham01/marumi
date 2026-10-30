import Link from 'next/link'
import { SalesChart, type SalesDay } from '@/components/admin/sales-chart'
import { addDays, localDate, startOfLocalDay } from '@/lib/dates'
import { formatKip } from '@/lib/format'
import { createClient, getStaffSession } from '@/lib/supabase/server'

type LowStock = { id: number; name: string; stock: number; products: { id: number; name: string } | null }
type SaleRow = { total_lak: number; channel: 'online' | 'store'; confirmed_at: string }

const CHART_DAYS = 14

export default async function DashboardPage() {
  const session = (await getStaffSession())!
  const supabase = await createClient()
  const today = localDate()
  const from = addDays(today, -(CHART_DAYS - 1))

  const [pending, recentOrders, lowStock, report] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('orders')
      .select('total_lak, channel, confirmed_at')
      .in('status', ['confirmed', 'completed'])
      .gte('confirmed_at', startOfLocalDay(from))
      .limit(10000),
    supabase
      .from('product_variants')
      .select('id, name, stock, products!inner(id, name, is_active)')
      .eq('is_active', true)
      .eq('products.is_active', true)
      .lte('stock', 2)
      .order('stock')
      .limit(10),
    session.role === 'owner' ? supabase.rpc('sales_report', { p_from: from, p_to: today }) : null,
  ])

  const profitByDay = new Map(
    ((report?.data as { day: string; profit_lak: number }[] | null) ?? []).map((r) => [r.day, r.profit_lak]),
  )
  const chart: SalesDay[] = Array.from({ length: CHART_DAYS }, (_, i) => {
    const day = addDays(from, i)
    return { day, online: 0, store: 0, orders: 0, profit: report ? (profitByDay.get(day) ?? 0) : null }
  })
  const byDay = new Map(chart.map((d) => [d.day, d]))
  for (const o of (recentOrders.data as SaleRow[] | null) ?? []) {
    const d = byDay.get(localDate(new Date(o.confirmed_at)))
    if (!d) continue
    d[o.channel] += o.total_lak
    d.orders += 1
  }

  const todayRow = chart[chart.length - 1]
  const revenue = todayRow.online + todayRow.store
  const orders = (recentOrders.data as SaleRow[] | null)?.filter((o) => localDate(new Date(o.confirmed_at)) === today) ?? []
  const online = orders.filter((o) => o.channel === 'online').length
  const profit = todayRow.profit ?? 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy">ສະບາຍດີ {session.name} ✿</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/admin/orders?status=pending" className="card p-4 hover:border-sky">
          <p className="text-sm text-muted">ອໍເດີລໍຖ້າຢືນຢັນ</p>
          <p className="text-3xl font-bold text-navy">{pending.count ?? 0}</p>
        </Link>
        <div className="card p-4">
          <p className="text-sm text-muted">ຍອດຂາຍມື້ນີ້</p>
          <p className="text-xl font-bold text-navy">{formatKip(revenue)}</p>
          <p className="text-xs text-muted">
            {orders.length} ບິນ · ອອນລາຍ {online}
          </p>
        </div>
        {session.role === 'owner' && (
          <div className="card p-4">
            <p className="text-sm text-muted">ກຳໄລມື້ນີ້</p>
            <p className="text-xl font-bold text-success">{formatKip(profit)}</p>
          </div>
        )}
        <Link href="/admin/pos" className="card flex flex-col justify-center bg-butter! p-4 hover:border-navy">
          <p className="font-bold text-navy">+ ຂາຍໜ້າຮ້ານ</p>
          <p className="text-xs text-navy/70">ບັນທຶກການຂາຍໄວ</p>
        </Link>
      </div>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-navy">ຍອດຂາຍ {CHART_DAYS} ມື້ຫຼ້າສຸດ</h2>
          {session.role === 'owner' && (
            <Link href="/admin/reports" className="text-sm text-navy-soft">
              ລາຍງານລະອຽດ →
            </Link>
          )}
        </div>
        <SalesChart days={chart} />
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-navy">ສິນຄ້າໃກ້ໝົດ</h2>
          <Link href="/admin/products" className="text-sm text-navy-soft">
            ຈັດການສິນຄ້າ →
          </Link>
        </div>
        {(lowStock.data as unknown as LowStock[] | null)?.length ? (
          <ul className="divide-y divide-line">
            {(lowStock.data as unknown as LowStock[]).map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/admin/products/${v.products?.id}`} className="hover:underline">
                  {v.products?.name}
                  {v.name !== 'ມາດຕະຖານ' && <span className="text-muted"> · {v.name}</span>}
                </Link>
                <span className={`font-bold ${v.stock === 0 ? 'text-danger' : 'text-navy'}`}>{v.stock}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">ສະຕັອກຍັງພໍ ✓</p>
        )}
      </section>
    </div>
  )
}
