import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PwaRegister } from '@/components/pwa-register'

export const metadata: Metadata = {
  title: { default: '2-TAKA-R-BAZAR', template: '%s · 2-TAKA-R-BAZAR' },
  description: 'Smart community shopping with transparent local price comparison and verified savings.',
  applicationName: '2-TAKA-R-BAZAR',
  appleWebApp: { capable: true, title: '2-TAKA-R-BAZAR', statusBarStyle: 'default' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#111111' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><PwaRegister />{children}</body></html>
}
