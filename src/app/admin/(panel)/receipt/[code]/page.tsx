import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PrintButton, Receipt, ReceiptPageStyle } from '@/components/admin/receipt'
import { CashIcon, ChartIcon } from '@/components/icons'
import { fetchReceipt } from '@/lib/receipt'
import { createClient, requirePermission } from '@/lib/supabase/server'

/** Paper receipt for one bill; the POS opens this right after payment. */
export default async function ReceiptPage(props: PageProps<'/admin/receipt/[code]'>) {
  await requirePermission('pos', 'sales', 'orders')
  const { code } = await props.params
  const data = await fetchReceipt(await createClient(), decodeURIComponent(code))
  if (!data) notFound()

  return (
    <div className="mx-auto max-w-md space-y-4 print:max-w-none print:space-y-0">
      <ReceiptPageStyle />
      <div className="flex flex-wrap items-center justify-center gap-2 print:hidden">
        <PrintButton />
        <Link href="/admin/pos" className="btn btn-ghost">
          <CashIcon size={18} /> ຂາຍຕໍ່
        </Link>
        <Link href="/admin/sales" className="btn btn-ghost">
          <ChartIcon size={18} /> ຍອດຂາຍ
        </Link>
      </div>
      <div className="drop-shadow-[0_4px_10px_rgba(29,43,72,0.2)] print:drop-shadow-none">
        <Receipt {...data} />
      </div>
    </div>
  )
}
