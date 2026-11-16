import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TrackOrder } from '@/components/shop/order-lookup'

export const metadata: Metadata = { title: 'ຕິດຕາມອໍເດີ', robots: { index: false } }

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-64 max-w-lg animate-pulse rounded-[var(--radius-card)] bg-mist" />}>
      <TrackOrder />
    </Suspense>
  )
}
