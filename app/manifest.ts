import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '1TAKA BazarPool',
    short_name: '1TAKA',
    description: 'Community purchasing pools with verified savings',
    start_url: '/home',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#047857',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
