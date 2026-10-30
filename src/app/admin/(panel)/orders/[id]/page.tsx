import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeftIcon, ChatIcon, PhoneIcon } from '@/components/icons'
import { formatDateTime } from '@/lib/dates'
import { formatKip, PAYMENT_LABEL, STATUS_LABEL, STATUS_STYLE } from '@/lib/format'
import { createClient, getStaffSession } from '@/lib/supabase/server'
import type { Order, OrderItem } from '@/lib/types'
import { OrderActions } from './order-actions'

export default async function OrderPage(props: PageProps<'/admin/orders/[id]'>) {
  const { id } = await props.params
  const session = (await getStaffSession())!
  const supabase = await createClient()

  const [{ data: order }, { data: items }] = await Promise.all([
    supabase.from('orders').select('*').eq('id', Number(id)).maybeSingle(),
    supabase.from('order_items').select('*').eq('order_id', Number(id)).order('id'),
  ])
  if (!order) notFound()
  const o = order as Order
  const lines = (items as OrderItem[]) ?? []

  let costs = new Map<number, number>()
  if (session.role === 'owner' && lines.length) {
    const { data } = await supabase
      .from('order_item_costs')
      .select('order_item_id, unit_cost_lak')
      .in('order_item_id', lines.map((l) => l.id))
    costs = new Map((data ?? []).map((c) => [c.order_item_id as number, c.unit_cost_lak as number]))
  }
  const slipUrl = o.payment_slip_path
    ? (await supabase.storage.from('payment-slips').createSignedUrl(o.payment_slip_path, 60 * 60)).data?.signedUrl
    : null
  const totalCost = lines.reduce((n, l) => n + (costs.get(l.id) ?? 0) * l.qty, 0)
  const phone = o.customer_phone?.replace(/[^\d]/g, '') ?? ''
  const waPhone = phone.startsWith('0') ? `856${phone.slice(1)}` : phone

  return (
    <div className="space-y-4">
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeftIcon size={16} /> ອໍເດີ
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-navy">{o.code}</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-1 p-4 text-sm">
          <h2 className="mb-2 font-bold text-navy">ລູກຄ້າ</h2>
          <p className="text-base font-semibold">{o.customer_name}</p>
          {o.customer_phone && (
            <div className="flex flex-wrap gap-2 py-1">
              <a href={`tel:${phone}`} className="btn btn-ghost btn-sm">
                <PhoneIcon size={16} /> {o.customer_phone}
              </a>
              <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                <ChatIcon size={16} /> WhatsApp
              </a>
            </div>
          )}
          <p>
            {o.channel === 'store' ? 'ຂາຍໜ້າຮ້ານ' : o.delivery_method === 'delivery' ? 'ຈັດສົ່ງ' : 'ຮັບທີ່ຮ້ານ'} ·{' '}
            {PAYMENT_LABEL[o.payment_method]}
          </p>
          {o.address && <p className="whitespace-pre-line">📍 {o.address}</p>}
          {o.note && <p className="whitespace-pre-line text-muted">📝 {o.note}</p>}
          <p className="text-xs text-muted">ສັ່ງເມື່ອ {formatDateTime(o.created_at)}</p>
        </section>

        <section className="card p-4 text-sm">
          <h2 className="mb-2 font-bold text-navy">ລາຍການ</h2>
          <ul className="divide-y divide-line">
            {lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-3 py-2">
                <span>
                  {l.product_name}
                  {l.variant_name !== 'ມາດຕະຖານ' && <span className="text-muted"> · {l.variant_name}</span>}
                  <span className="text-muted"> × {l.qty}</span>
                </span>
                <span className="font-semibold">{formatKip(l.unit_price_lak * l.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 space-y-1 border-t border-line pt-2">
            {o.discount_lak > 0 && (
              <p className="flex justify-between text-muted">
                <span>ສ່ວນຫຼຸດ</span> <span>-{formatKip(o.discount_lak)}</span>
              </p>
            )}
            <p className="flex justify-between text-base font-bold text-navy">
              <span>ລວມ</span> <span>{formatKip(o.total_lak)}</span>
            </p>
            {session.role === 'owner' && costs.size > 0 && (
              <p className="flex justify-between text-success">
                <span>ກຳໄລ</span> <span>{formatKip(o.total_lak - totalCost)}</span>
              </p>
            )}
          </div>
        </section>
      </div>

      {o.payment_slip_path && (
        <section className="card p-4">
          <h2 className="mb-2 font-bold text-navy">ບິນໂອນ</h2>
          {slipUrl ? (
            <a href={slipUrl} target="_blank" rel="noreferrer" className="block w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
              <img src={slipUrl} alt="ບິນໂອນ" className="max-h-96 rounded-xl border border-line" />
              <span className="mt-1 block text-xs text-muted">ແຕະເພື່ອເບິ່ງຮູບເຕັມ</span>
            </a>
          ) : (
            <p className="text-sm text-danger">ເປີດຮູບບິນບໍ່ໄດ້</p>
          )}
        </section>
      )}

      <OrderActions orderId={o.id} status={o.status} />
    </div>
  )
}
