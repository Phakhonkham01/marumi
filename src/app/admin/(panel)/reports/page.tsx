import { addDays, localDate } from '@/lib/dates'
import { formatKip } from '@/lib/format'
import { createClient, getStaffSession } from '@/lib/supabase/server'

type DayRow = { day: string; order_count: number; revenue_lak: number; cost_lak: number; profit_lak: number }
type TopRow = { product_name: string; qty: number; revenue_lak: number; profit_lak: number }
type StockRow = { stock: number; variant_costs: { cost_lak: number } | null }

const RANGES = [
  { days: 7, label: '7 ມື້' },
  { days: 30, label: '30 ມື້' },
  { days: 90, label: '90 ມື້' },
]

export default async function ReportsPage(props: PageProps<'/admin/reports'>) {
  const session = (await getStaffSession())!
  if (session.role !== 'owner') {
    return <p className="text-muted">ໜ້ານີ້ສະເພາະເຈົ້າຂອງຮ້ານ</p>
  }

  const sp = await props.searchParams
  const days = RANGES.find((r) => String(r.days) === sp.days)?.days ?? 30
  const to = localDate()
  const from = addDays(to, -(days - 1))
  const supabase = await createClient()

  const [{ data: daily }, { data: top }, { data: stock }] = await Promise.all([
    supabase.rpc('sales_report', { p_from: from, p_to: to }),
    supabase.rpc('top_products', { p_from: from, p_to: to, p_limit: 10 }),
    supabase.from('product_variants').select('stock, variant_costs(cost_lak)').gt('stock', 0),
  ])

  const rows = (daily as DayRow[]) ?? []
  const totals = rows.reduce(
    (t, r) => ({
      orders: t.orders + r.order_count,
      revenue: t.revenue + r.revenue_lak,
      profit: t.profit + r.profit_lak,
    }),
    { orders: 0, revenue: 0, profit: 0 },
  )
  const stockRows = (stock as unknown as StockRow[]) ?? []
  const inventoryValue = stockRows.reduce((n, s) => n + s.stock * (s.variant_costs?.cost_lak ?? 0), 0)
  const missingCost = stockRows.filter((s) => !s.variant_costs).length
  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue_lak))
  const margin = totals.revenue ? Math.round((totals.profit / totals.revenue) * 100) : 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-navy">ລາຍງານ</h1>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <a key={r.days} href={`/admin/reports?days=${r.days}`} className="chip" data-active={r.days === days}>
              {r.label}
            </a>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="ຍອດຂາຍ" value={formatKip(totals.revenue)} sub={`${totals.orders} ບິນ`} />
        <Stat label="ກຳໄລ" value={formatKip(totals.profit)} sub={`ອັດຕາກຳໄລ ${margin}%`} accent />
        <Stat label="ສະເລ່ຍຕໍ່ບິນ" value={formatKip(totals.orders ? Math.round(totals.revenue / totals.orders) : 0)} />
        <Stat
          label="ມູນຄ່າສະຕັອກ (ຕົ້ນທຶນ)"
          value={formatKip(inventoryValue)}
          sub={missingCost ? `${missingCost} ລາຍການຍັງບໍ່ໃສ່ຕົ້ນທຶນ` : undefined}
        />
      </div>

      <section className="card p-4">
        <h2 className="mb-1 font-bold text-navy">ຍອດຂາຍລາຍວັນ</h2>
        <p className="mb-3 text-xs text-muted">
          {from} → {to} · ນັບອໍເດີທີ່ຢືນຢັນ ຫຼື ສຳເລັດແລ້ວ
        </p>
        {rows.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 font-normal">ວັນທີ</th>
                <th className="py-1 font-normal">ຍອດຂາຍ</th>
                <th className="py-1 text-right font-normal">ກຳໄລ</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.day} className="border-t border-line" title={`${r.day}: ${r.order_count} ບິນ`}>
                  <td className="w-24 py-2 text-muted">{r.day.slice(5)}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 rounded-r bg-navy"
                        style={{ width: `${Math.max(2, (r.revenue_lak / maxRevenue) * 60)}%` }}
                      />
                      <span className="whitespace-nowrap text-xs">{formatKip(r.revenue_lak)}</span>
                    </div>
                  </td>
                  <td className="py-2 text-right font-semibold whitespace-nowrap">{formatKip(r.profit_lak)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">ຍັງບໍ່ມີການຂາຍໃນຊ່ວງນີ້</p>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-bold text-navy">ສິນຄ້າຂາຍດີ</h2>
        {(top as TopRow[] | null)?.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 font-normal">ສິນຄ້າ</th>
                <th className="py-1 text-right font-normal">ຈຳນວນ</th>
                <th className="py-1 text-right font-normal">ຍອດຂາຍ</th>
                <th className="py-1 text-right font-normal">ກຳໄລ</th>
              </tr>
            </thead>
            <tbody>
              {(top as TopRow[]).map((t) => (
                <tr key={t.product_name} className="border-t border-line">
                  <td className="py-2">{t.product_name}</td>
                  <td className="py-2 text-right">{t.qty}</td>
                  <td className="py-2 text-right whitespace-nowrap">{formatKip(t.revenue_lak)}</td>
                  <td className="py-2 text-right font-semibold whitespace-nowrap">{formatKip(t.profit_lak)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">ຍັງບໍ່ມີຂໍ້ມູນ</p>
        )}
        <p className="mt-3 text-xs text-muted">ກຳໄລຕໍ່ສິນຄ້າຄິດກ່ອນຫັກສ່ວນຫຼຸດທ້າຍບິນ.</p>
      </section>
    </div>
  )
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-xl font-bold ${accent ? 'text-success' : 'text-navy'}`}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  )
}
