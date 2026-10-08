import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

const PRIVATE_PATHS = [
  '/login',
  '/signup',
  '/auth/',
  '/admin/',
  '/super-admin/',
  '/home',
  '/pool',
  '/orders',
  '/savings',
  '/community',
  '/pickup',
  '/pickup-ops',
  '/profile',
  '/notifications',
  '/subscription',
  '/onboarding',
  '/verify-otp',
  '/feedback',
  '/money',
  '/join',
  '/community-invite',
  '/group-deals',
  '/supplier',
  '/preview-demo',
  '/qr/',
]

const PUBLIC_PATHS = ['/', '/about', '/terms', '/return-policy', '/refund-policy', '/faq', '/llms.txt']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: PUBLIC_PATHS,
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: PUBLIC_PATHS,
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: 'OAI-AdsBot',
        allow: PUBLIC_PATHS,
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
