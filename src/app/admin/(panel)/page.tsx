import Link from 'next/link'
import { localDate, startOfLocalDay } from '@/lib/dates'
import { formatKip } from '@/lib/format'
import { createClient, getStaffSession } from '@/lib/supabase/server'

type LowStock = { id: number; name: string; stock: number; products: { id: number; name: string } | null }

export default async function DashboardPage() {
  const session = (await getStaffSession())!
  const supabase = await createClient()
  const today = localDate()

  const [pending, todayOrders, lowStock, report] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('orders')
      .select('total_lak, channel')
      .in('status', ['confirmed', 'completed'])
      .gte('confirmed_at', startOfLocalDay(today)),
    supabase
      .from('product_variants')
      .select('id, name, stock, products!inner(id, name, is_active)')
      .eq('is_active', true)
      .eq('products.is_active', true)
      .lte('stock', 2)
      .order('stock')
      .limit(10),
    session.role === 'owner' ? supabase.rpc('sales_report', { p_from: today, p_to: today }) : null,
  ])

  const orders = todayOrders.data ?? []
  const revenue = orders.reduce((n, o) => n + o.total_lak, 0)
  const online = orders.filter((o) => o.channel === 'online').length
  const profit = (report?.data as { profit_lak: number }[] | null)?.[0]?.profit_lak ?? 0

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
