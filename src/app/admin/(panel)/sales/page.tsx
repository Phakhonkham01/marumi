import Link from 'next/link'
import { ChartIcon } from '@/components/icons'
import { addDays, localDate, startOfLocalDay } from '@/lib/dates'
import { formatKip } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { SalesTable, type SaleRow } from './sales-table'

const LIMIT = 5000
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Quick ranges, worked out from today's date in Vientiane. */
function presets(today: string) {
  const [y, m] = today.split('-')
  const monthStart = `${y}-${m}-01`
  const lastMonthEnd = addDays(monthStart, -1)
  return [
    { key: 'today', label: 'ມື້ນີ້', from: today, to: today },
    { key: 'yesterday', label: 'ມື້ວານ', from: addDays(today, -1), to: addDays(today, -1) },
    { key: '7d', label: '7 ມື້ຫຼ້າສຸດ', from: addDays(today, -6), to: today },
    { key: 'month', label: 'ເດືອນນີ້', from: monthStart, to: today },
    { key: 'lastmonth', label: 'ເດືອນກ່ອນ', from: `${lastMonthEnd.slice(0, 7)}-01`, to: lastMonthEnd },
    { key: 'year', label: 'ປີນີ້', from: `${y}-01-01`, to: today },
    { key: 'lastyear', label: 'ປີກ່ອນ', from: `${Number(y) - 1}-01-01`, to: `${Number(y) - 1}-12-31` },
  ]
}

const CHANNELS = [
  { key: '', label: 'ທັງໝົດ' },
  { key: 'store', label: 'ໜ້າຮ້ານ' },
  { key: 'online', label: 'ອອນລາຍ' },
]

const longDate = (day: string) =>
  new Intl.DateTimeFormat('lo-LA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  )

export default async function SalesPage(props: PageProps<'/admin/sales'>) {
  const sp = await props.searchParams
  const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')
  const today = localDate()
  const ranges = presets(today)

  // A typed range wins; otherwise a preset (today by default).
  let from = one(sp.from)
  let to = one(sp.to)
  let active = ''
  if (!DAY.test(from) || !DAY.test(to)) {
    const preset = ranges.find((r) => r.key === one(sp.range)) ?? ranges[0]
    ;({ from, to } = preset)
    active = preset.key
  } else if (from > to) {
    ;[from, to] = [to, from]
  }
  const channel = CHANNELS.some((c) => c.key === one(sp.channel)) ? one(sp.channel) : ''

  const supabase = await createClient()
  let query = supabase
    .from('orders')
    .select('id, code, channel, customer_name, payment_method, transfer_lak, discount_lak, total_lak, confirmed_at, order_items(qty)')
    .in('status', ['confirmed', 'completed'])
    .gte('confirmed_at', startOfLocalDay(from))
    .lt('confirmed_at', startOfLocalDay(addDays(to, 1)))
    .order('confirmed_at', { ascending: false })
    .limit(LIMIT)
  if (channel) query = query.eq('channel', channel)
  const { data, error } = await query

  const rows: SaleRow[] = (data ?? []).map((o) => ({
    code: o.code,
    channel: o.channel,
    customer: o.customer_name,
    payment: o.payment_method,
    total: o.total_lak,
    transfer: o.payment_method === 'mixed' ? (o.transfer_lak ?? 0) : o.payment_method === 'cash' ? 0 : o.total_lak,
    discount: o.discount_lak,
    at: o.confirmed_at as string,
    pieces: (o.order_items as { qty: number }[]).reduce((n, i) => n + i.qty, 0),
  }))

  const total = rows.reduce((n, r) => n + r.total, 0)
  // Mixed bills count their transfer part as transfer and the rest as cash.
  const transferTotal = rows.reduce((n, r) => n + r.transfer, 0)
  const cards = [
    { label: 'ຍອດຂາຍລວມ', value: formatKip(total), strong: true },
    { label: 'ຈຳນວນບິນ', value: `${rows.length.toLocaleString('en-US')} ບິນ` },
    { label: 'ເງິນສົດ', value: formatKip(total - transferTotal) },
    { label: 'ໂອນ / ປາຍທາງ', value: formatKip(transferTotal) },
    { label: 'ສິນຄ້າທີ່ຂາຍ', value: `${rows.reduce((n, r) => n + r.pieces, 0).toLocaleString('en-US')} ຊິ້ນ` },
    { label: 'ສ່ວນຫຼຸດລວມ', value: formatKip(rows.reduce((n, r) => n + r.discount, 0)) },
  ]

  const href = (params: Record<string, string>) => {
    const q = new URLSearchParams({ ...params, ...(channel ? { channel } : {}) })
    return `/admin/sales?${q}`
  }
  const rangeParams: Record<string, string> = active ? { range: active } : { from, to }

  return (
    <div className="space-y-4">
      <section className="panel print:hidden">
        <div className="panel-head">
          <span className="panel-title">
            <ChartIcon size={22} /> ຍອດຂາຍ
          </span>
          <span className="text-sm font-semibold">
            {from === to ? longDate(from) : `${longDate(from)} – ${longDate(to)}`}
          </span>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {ranges.map((r) => (
              <Link
                key={r.key}
                href={href({ range: r.key })}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  active === r.key ? 'bg-navy text-white' : 'border-[1.5px] border-line bg-white text-navy hover:border-navy'
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>

          {/* Custom range: works without JavaScript as a plain GET form. */}
          <form action="/admin/sales" className="flex flex-wrap items-end gap-2">
            <label className="text-sm font-semibold text-navy">
              ແຕ່ວັນທີ
              <input type="date" name="from" defaultValue={from} max={today} className="input mt-1 block" required />
            </label>
            <label className="text-sm font-semibold text-navy">
              ຫາວັນທີ
              <input type="date" name="to" defaultValue={to} max={today} className="input mt-1 block" required />
            </label>
            {channel && <input type="hidden" name="channel" value={channel} />}
            <button className="btn btn-primary">ເບິ່ງ</button>
          </form>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-muted">ຊ່ອງທາງ:</span>
            {CHANNELS.map((c) => (
              <Link
                key={c.key}
                href={`/admin/sales?${new URLSearchParams({ ...rangeParams, ...(c.key ? { channel: c.key } : {}) })}`}
                className={`rounded-md px-3 py-1 font-semibold ${channel === c.key ? 'bg-butter text-navy' : 'text-navy hover:bg-mist'}`}
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 print:hidden">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl p-4 shadow-sm ${c.strong ? 'bg-navy text-white' : 'bg-white'}`}>
            <p className={`text-xs font-semibold ${c.strong ? 'text-white/80' : 'text-muted'}`}>{c.label}</p>
            <p className={`mt-1 text-lg font-bold ${c.strong ? 'text-butter' : 'text-navy'}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {error && <p className="text-danger print:hidden">ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ: {error.message}</p>}
      {rows.length === LIMIT && (
        <p className="text-sm text-danger print:hidden">ສະແດງພຽງ {LIMIT} ບິນຫຼ້າສຸດ — ເລືອກຊ່ວງວັນທີໃຫ້ສັ້ນລົງເພື່ອເບິ່ງຄົບ</p>
      )}
      <SalesTable rows={rows} multiDay={from !== to} />
    </div>
  )
}
