import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '2-TAKA-R-BAZAR',
    short_name: '2TAKA BAZAR',
    description: 'Smart community shopping with real verified savings',
    start_url: '/home',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#111111',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
