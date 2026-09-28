import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: ['/', '/terms', '/return-policy', '/refund-policy', '/faq', '/llms.txt'],
      disallow: ['/login', '/signup', '/admin/', '/super-admin/', '/home', '/pool', '/orders', '/savings', '/community', '/pickup', '/pickup-ops', '/profile', '/notifications', '/subscription', '/onboarding', '/verify-otp'],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
