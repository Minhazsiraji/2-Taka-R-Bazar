import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PwaRegister } from '@/components/pwa-register'

export const metadata: Metadata = {
  title: { default: '1TAKA BazarPool', template: '%s · 1TAKA BazarPool' },
  description: 'Local community purchasing pools with transparent verified savings.',
  applicationName: '1TAKA BazarPool',
  appleWebApp: { capable: true, title: '1TAKA BazarPool', statusBarStyle: 'default' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#047857' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><PwaRegister />{children}</body></html>
}
