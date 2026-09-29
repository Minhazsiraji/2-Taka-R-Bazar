import type { Metadata, Viewport } from 'next'
import './globals.css'
import './site-glass.css'
import { PwaRegister } from '@/components/pwa-register'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} | Community Grocery Pooling in Savar`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ['community grocery pooling','group buying Bangladesh','grocery savings Savar','Amin Model Town grocery','Pollibiddut grocery','কমিউনিটি বাজার','সাশ্রয়ী বাজার','Savar grocery pool'],
  alternates: { canonical: '/' },
  openGraph: { type:'website',url:SITE_URL,siteName:SITE_NAME,title:`${SITE_NAME} | Community Grocery Pooling`,description:SITE_DESCRIPTION,locale:'en_BD',alternateLocale:['bn_BD'] },
  twitter: { card:'summary',title:`${SITE_NAME} | Community Grocery Pooling`,description:SITE_DESCRIPTION },
  robots: { index:true,follow:true },
  category: 'shopping',
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'default' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#e7e2e8' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="site-glass-root"><PwaRegister />{children}</body></html>
}
