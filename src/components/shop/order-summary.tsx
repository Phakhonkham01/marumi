import type { TrackedOrder } from '@/lib/my-orders'
import { CustomerReceipt, SaveReceiptButton } from './customer-receipt'

const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Vientiane',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso))
    : null

/** Order status as steps, then the items and totals. */
export function OrderSummary({ order }: { order: TrackedOrder }) {
  const pickup = order.delivery_method === 'pickup'
  const steps = [
    { label: 'ສັ່ງຊື້ແລ້ວ', at: order.created_at, done: true },
    { label: 'ຮ້ານຢືນຢັນແລ້ວ', at: order.confirmed_at, done: !!order.confirmed_at },
    { label: pickup ? 'ຮັບສິນຄ້າແລ້ວ' : 'ຈັດສົ່ງສຳເລັດ', at: order.completed_at, done: order.status === 'completed' },
  ]
  const next =
    order.status === 'pending'
      ? 'ຮ້ານກຳລັງກວດອໍເດີ ແລະ ຈະໂທ ຫຼື ທັກຫາເພື່ອຢືນຢັນ'
      : order.status === 'confirmed'
        ? pickup
          ? 'ສິນຄ້າພ້ອມແລ້ວ ມາຮັບທີ່ຮ້ານໄດ້ເລີຍ'
          : 'ຮ້ານກຳລັງກຽມ ແລະ ຈັດສົ່ງສິນຄ້າ'
        : order.status === 'completed'
          ? 'ຂອບໃຈທີ່ອຸດໜູນ ✿'
          : 'ອໍເດີນີ້ຖືກຍົກເລີກແລ້ວ. ມີຄຳຖາມ ທັກຫາຮ້ານໄດ້ເລີຍ'

  return (
    <div className="space-y-4 text-left">
      <div className="card space-y-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted">ລະຫັດອໍເດີ</span>
          <span className="rounded-lg bg-mist px-2 py-1 font-display font-bold text-navy">{order.code}</span>
        </div>

        {order.status === 'cancelled' ? (
          <p className="rounded-xl bg-danger/10 p-3 text-center font-bold text-danger">ຍົກເລີກແລ້ວ · {when(order.cancelled_at)}</p>
        ) : (
          <ol className="relative space-y-3 pl-8">
            <span className="absolute bottom-3 left-[11px] top-3 w-0.5 bg-line" aria-hidden />
            {steps.map((s) => (
              <li key={s.label} className="relative">
                <span
                  className={`absolute -left-8 top-0 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    s.done ? 'bg-success text-white' : 'border-2 border-line bg-white text-muted'
                  }`}
                >
                  {s.done ? '✓' : ''}
                </span>
                <p className={`font-semibold ${s.done ? 'text-navy' : 'text-muted'}`}>{s.label}</p>
                {s.done && s.at && <p className="text-xs text-muted">{when(s.at)}</p>}
              </li>
            ))}
          </ol>
        )}
        <p className="rounded-xl bg-butter/60 p-3 text-sm font-semibold text-navy">{next}</p>
      </div>

      <CustomerReceipt order={order} />
      <SaveReceiptButton order={order} />
    </div>
  )
}
