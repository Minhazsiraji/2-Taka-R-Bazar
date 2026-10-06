import type { NextConfig } from 'next'

const assetCache = 'public, max-age=86400, stale-while-revalidate=2592000'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
      ]
    },
    {
      source: '/grocery-hero-glass.svg',
      headers: [{ key: 'Cache-Control', value: assetCache }]
    },
    {
      source: '/grocery-hero.svg',
      headers: [{ key: 'Cache-Control', value: assetCache }]
    },
    {
      source: '/brand-mark-transparent.png',
      headers: [{ key: 'Cache-Control', value: assetCache }]
    },
    {
      source: '/sw.js',
      headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }]
    }
  ]
}

export default nextConfig
