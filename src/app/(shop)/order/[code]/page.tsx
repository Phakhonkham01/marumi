import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { ChatIcon } from '@/components/icons'
import { OrderDoneDetails } from '@/components/shop/order-lookup'
import { whatsappLink } from '@/lib/format'

export const metadata: Metadata = { title: 'ສັ່ງຊື້ສຳເລັດ', robots: { index: false } }

export default function OrderDonePage(props: PageProps<'/order/[code]'>) {
  return (
    <div className="bg-waves mx-auto flex max-w-lg flex-col gap-4 rounded-[var(--radius-card)] px-4 py-5 sm:px-6">
      <Suspense fallback={<p className="h-24" />}>
        <OrderCode params={props.params} />
      </Suspense>
      <Link href="/products" className="self-center text-sm font-semibold text-navy underline">
        ເລືອກຊື້ຕໍ່
      </Link>
    </div>
  )
}

async function OrderCode({ params }: { params: PageProps<'/order/[code]'>['params'] }) {
  const { code } = await params
  return (
    <>
      {/* Compact header (logo left, thanks right) so the receipt below shows without scrolling. */}
      <div className="flex items-center gap-3">
        <Image src="/logo.jpg" alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-full ring-4 ring-white" />
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-bold leading-tight text-navy">ຂອບໃຈທີ່ສັ່ງຊື້ ✿</h1>
          <p className="text-sm">
            ລະຫັດອໍເດີ <span className="rounded-md bg-white px-1.5 py-0.5 font-display font-bold text-navy">{code}</span>
          </p>
          <p className="text-xs leading-snug text-muted">ຮ້ານຈະຕິດຕໍ່ກັບໄປເພື່ອຢືນຢັນ. ຢາກໄວຂຶ້ນ ທັກມາບອກລະຫັດອໍເດີໄດ້ເລີຍ</p>
        </div>
      </div>
      <OrderDoneDetails code={code} />
      <a
        href={whatsappLink(`ສະບາຍດີ ຂ້ອຍສັ່ງສິນຄ້າໃນເວັບ ລະຫັດອໍເດີ ${code}`)}
        target="_blank"
        rel="noreferrer"
        className="btn btn-ghost w-full bg-white"
      >
        <ChatIcon size={18} /> ແຈ້ງຮ້ານທາງ WhatsApp
      </a>
    </>
  )
}
