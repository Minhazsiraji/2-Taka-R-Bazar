import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-09-28T00:00:00+06:00')
  return [
    { url: SITE_URL, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/faq`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/return-policy`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/refund-policy`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
  ]
}
