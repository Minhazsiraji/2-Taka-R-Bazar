import type { Metadata, Viewport } from 'next'
import './globals.css'
import './site-glass.css'
import './site-glass-v2.css'
import './site-glass-v3.css'
import './site-glass-v4.css'
import './site-pool-kpi.css'
import './site-theme.css'
import { PwaRegister } from '@/components/pwa-register'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

const themeInitScript = `
(function(){
  try {
    var saved = localStorage.getItem('2taka-theme');
    var theme = saved === 'dark' || saved === 'light'
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b1018' : '#e7e2e8');
  } catch (_) {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.colorScheme = 'light';
  }
})();`

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

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning>
    <head>
      <meta name="theme-color" content="#e7e2e8" />
      <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
    </head>
    <body className="site-glass-root"><PwaRegister />{children}</body>
  </html>
}
