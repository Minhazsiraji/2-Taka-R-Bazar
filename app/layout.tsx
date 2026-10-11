import type { Metadata, Viewport } from 'next'
import './globals.css'
import './site-glass.css'
import './site-glass-v2.css'
import './site-glass-v3.css'
import './site-glass-v4.css'
import './site-theme.css'
import './site-theme-semantic.css'
import './site-theme-mobile.css'
import './site-theme-admin.css'
import './site-theme-surface-fix.css'
import './site-customer-experience.css'
import './showcase.css'
import { PwaRegister } from '@/components/pwa-register'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE_EN, SITE_URL } from '@/lib/site'

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
  title: { default: `${SITE_NAME} | ${SITE_TAGLINE_EN}`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  icons: {
    icon: [{ url: '/brand-mark-transparent.png', type: 'image/png' }],
    shortcut: '/brand-mark-transparent.png',
    apple: '/brand-mark-transparent.png',
  },
  keywords: ['community grocery pooling','group buying Bangladesh','grocery savings Savar','Amin Model Town grocery','Pollibiddut grocery','কমিউনিটি বাজার','সাশ্রয়ী বাজার','Savar grocery pool'],
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} | ${SITE_TAGLINE_EN}`,
    description: SITE_DESCRIPTION,
    locale: 'en_BD',
    alternateLocale: ['bn_BD'],
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: `${SITE_NAME} — ${SITE_TAGLINE_EN}` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | ${SITE_TAGLINE_EN}`,
    description: SITE_DESCRIPTION,
    images: ['/opengraph-image'],
  },
  robots: { index: true, follow: true },
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
