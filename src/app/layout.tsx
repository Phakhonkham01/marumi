import type { Metadata, Viewport } from 'next'
import { Noto_Sans_Lao_Looped } from 'next/font/google'
import { SHOP } from '@/lib/format'
import './globals.css'

// One typeface for every page (Lao + Latin), self-hosted by next/font.
const looped = Noto_Sans_Lao_Looped({
  variable: '--font-looped',
  subsets: ['lao', 'latin'],
  weight: 'variable',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: `${SHOP.name} · ${SHOP.nameLo}`, template: `%s · ${SHOP.name}` },
  description: SHOP.tagline,
  openGraph: { siteName: SHOP.name, images: ['/logo.jpg'], locale: 'lo_LA', type: 'website' },
}

export const viewport: Viewport = {
  themeColor: '#22396b',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="lo" className={`${looped.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
