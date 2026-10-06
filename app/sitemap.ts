import type { MetadataRoute } from 'next'
import { SEO_UPDATED_AT, SITE_URL } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(SEO_UPDATED_AT)

  return [
    { url: SITE_URL, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/about`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/faq`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/return-policy`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/refund-policy`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
  ]
}
