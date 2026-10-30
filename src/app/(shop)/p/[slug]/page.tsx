import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { BuyBox, Gallery } from '@/components/shop/buy-box'
import { activeVariants, formatKip, imageUrl, minPrice, sortedImages } from '@/lib/format'
import { getProduct } from '@/lib/queries'

export async function generateMetadata(props: PageProps<'/p/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params
  const product = await getProduct(slug)
  if (!product) return { title: 'ບໍ່ພົບສິນຄ້າ' }
  const cover = sortedImages(product)[0]
  return {
    title: product.name,
    description: `${formatKip(minPrice(product))} · ${product.description || product.name}`.slice(0, 160),
    openGraph: { images: [imageUrl(cover?.path)] },
  }
}

export default function ProductPage(props: PageProps<'/p/[slug]'>) {
  return (
    <Suspense fallback={<div className="aspect-square max-w-lg animate-pulse rounded-[var(--radius-card)] bg-mist" />}>
      <ProductDetail params={props.params} />
    </Suspense>
  )
}

async function ProductDetail({ params }: { params: PageProps<'/p/[slug]'>['params'] }) {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) notFound()

  const images = sortedImages(product)
  const variants = activeVariants(product)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  return (
    <div className="space-y-8">
      <nav className="text-sm text-muted">
        <Link href="/products" className="hover:text-navy">
          ສິນຄ້າທັງໝົດ
        </Link>{' '}
        / <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <Gallery images={images} name={product.name} />
        <BuyBox
          product={product}
          variants={variants}
          cover={images[0]?.path ?? null}
          pageUrl={`${siteUrl}/p/${product.slug}`}
        />
      </div>

      {(product.specs.length > 0 || product.description) && (
        <section className="card space-y-4 p-5">
          {product.specs.length > 0 && (
            <div>
              <h2 className="mb-2 font-bold text-navy">ສະເປັກ</h2>
              <dl className="divide-y divide-line">
                {product.specs.map((s, i) => (
                  <div key={i} className="flex justify-between gap-4 py-2 text-sm">
                    <dt className="text-muted">{s.k}</dt>
                    <dd className="text-right font-semibold">{s.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {product.description && (
            <div>
              <h2 className="mb-2 font-bold text-navy">ລາຍລະອຽດ</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed">{product.description}</p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
