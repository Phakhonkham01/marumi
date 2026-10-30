import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { ChatIcon } from '@/components/icons'
import { whatsappLink } from '@/lib/format'

export const metadata: Metadata = { title: 'ສັ່ງຊື້ສຳເລັດ', robots: { index: false } }

export default function OrderDonePage(props: PageProps<'/order/[code]'>) {
  return (
    <div className="bg-waves mx-auto flex max-w-lg flex-col items-center gap-4 rounded-[var(--radius-card)] px-6 py-12 text-center">
      <Image src="/logo.jpg" alt="" width={120} height={120} className="rounded-full ring-4 ring-white" />
      <h1 className="text-2xl font-bold text-navy">ຂອບໃຈທີ່ສັ່ງຊື້ ✿</h1>
      <Suspense fallback={<p className="h-24" />}>
        <OrderCode params={props.params} />
      </Suspense>
      <Link href="/products" className="text-sm font-semibold text-navy underline">
        ເລືອກຊື້ຕໍ່
      </Link>
    </div>
  )
}

async function OrderCode({ params }: { params: PageProps<'/order/[code]'>['params'] }) {
  const { code } = await params
  return (
    <>
      <p>
        ລະຫັດອໍເດີ <span className="rounded-lg bg-white px-2 py-1 font-display font-bold text-navy">{code}</span>
      </p>
      <p className="text-sm text-muted">ຮ້ານຈະຕິດຕໍ່ກັບໄປເພື່ອຢືນຢັນ. ຢາກໄວຂຶ້ນ ທັກມາບອກລະຫັດອໍເດີໄດ້ເລີຍ</p>
      <a
        href={whatsappLink(`ສະບາຍດີ ຂ້ອຍສັ່ງສິນຄ້າໃນເວັບ ລະຫັດອໍເດີ ${code}`)}
        target="_blank"
        rel="noreferrer"
        className="btn btn-primary"
      >
        <ChatIcon size={18} /> ແຈ້ງຮ້ານທາງ WhatsApp
      </a>
    </>
  )
}
