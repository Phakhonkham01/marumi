import type { Metadata, Viewport } from 'next'
import { Noto_Sans_Lao, Quicksand } from 'next/font/google'
import { DialogProvider } from '@/components/dialog'
import { SHOP } from '@/lib/format'
import './globals.css'

const lao = Noto_Sans_Lao({ variable: '--font-lao', subsets: ['lao'], weight: ['400', '500', '600', '700'] })
const latin = Quicksand({ variable: '--font-latin', subsets: ['latin'], weight: ['500', '600', '700'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: `${SHOP.name} · ${SHOP.nameLo}`, template: `%s · ${SHOP.name}` },
  description: SHOP.tagline,
  openGraph: { siteName: SHOP.name, images: ['/logo.jpg'], locale: 'lo_LA', type: 'website' },
}

export const viewport: Viewport = {
  themeColor: '#fffaf0',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="lo" className={`${lao.variable} ${latin.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  )
}
