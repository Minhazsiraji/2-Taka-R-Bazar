import type { NextConfig } from 'next'

const assetCache = 'public, max-age=86400, stale-while-revalidate=2592000'
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ')

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
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' }
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
