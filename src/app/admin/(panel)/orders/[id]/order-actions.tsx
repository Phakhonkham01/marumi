'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useDialog } from '@/components/dialog'
import { errorMessage, STATUS_LABEL } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import type { OrderStatus } from '@/lib/types'

const NEXT: Record<OrderStatus, { to: OrderStatus; label: string; style: string; confirm?: string }[]> = {
  pending: [
    { to: 'confirmed', label: 'ຢືນຢັນອໍເດີ (ຕັດສະຕັອກ)', style: 'btn-primary' },
    { to: 'cancelled', label: 'ຍົກເລີກ', style: 'btn-danger', confirm: 'ຍົກເລີກອໍເດີນີ້?' },
  ],
  confirmed: [
    { to: 'completed', label: 'ສົ່ງ/ຮັບເງິນແລ້ວ — ສຳເລັດ', style: 'btn-primary' },
    { to: 'cancelled', label: 'ຍົກເລີກ (ຄືນສະຕັອກ)', style: 'btn-danger', confirm: 'ຍົກເລີກ ແລະ ຄືນສະຕັອກ?' },
  ],
  completed: [{ to: 'cancelled', label: 'ຍົກເລີກ/ຄືນເງິນ (ຄືນສະຕັອກ)', style: 'btn-danger', confirm: 'ອໍເດີນີ້ສຳເລັດແລ້ວ ແນ່ໃຈບໍ່ວ່າຈະຍົກເລີກ?' }],
  cancelled: [],
}

export function OrderActions({ orderId, status }: { orderId: number; status: OrderStatus }) {
  const router = useRouter()
  const dialog = useDialog()
  const [busy, setBusy] = useState(false)
  const actions = NEXT[status]
  if (actions.length === 0) return null

  async function go(to: OrderStatus, confirmText?: string) {
    if (confirmText && !(await dialog.confirm({ title: confirmText, okLabel: 'ຍົກເລີກອໍເດີ', cancelLabel: 'ບໍ່', danger: true }))) return
    setBusy(true)
    const { error } = await createClient().rpc('set_order_status', { p_order_id: orderId, p_status: to })
    setBusy(false)
    if (error) return dialog.alert({ tone: 'error', title: 'ປ່ຽນສະຖານະບໍ່ສຳເລັດ', message: errorMessage(error.message) })
    router.refresh()
    dialog.alert({ tone: 'success', title: 'ອັບເດດອໍເດີແລ້ວ', message: `ສະຖານະ: ${STATUS_LABEL[to]}` })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <button key={a.to} className={`btn ${a.style}`} disabled={busy} onClick={() => go(a.to, a.confirm)}>
          {a.label}
        </button>
      ))}
    </div>
  )
}
