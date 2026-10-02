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
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/about', '/terms', '/return-policy', '/refund-policy', '/faq', '/llms.txt'],
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: ['/', '/about', '/terms', '/return-policy', '/refund-policy', '/faq', '/llms.txt'],
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
