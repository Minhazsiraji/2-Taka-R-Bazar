import test from 'node:test'
import assert from 'node:assert/strict'
import { sitemapUrls, htmlErrors, robotsErrors, sitemapErrors, scanSite } from '../scripts/seo-health-check.mjs'

const base = 'https://2takarbazar.com'
const html = '<html lang="en"><head><title>2-TAKA-R-BAZAR</title><meta name="description" content="Shopping"><link rel="canonical" href="' + base + '"><script type="application/ld+json">{}</script></head></html>'
const robots = 'User-agent: *\nDisallow: /admin/\nSitemap: ' + base + '/sitemap.xml'
const sitemap = '<urlset><url><loc>' + base + '</loc></url><url><loc>' + base + '/p/rice</loc></url><url><loc>' + base + '/bn/p/rice</loc></url></urlset>'

test('sitemap parser handles XML entities', () => {
  assert.deepEqual(sitemapUrls('<loc>https://example.test/?a=1&amp;b=2</loc>'), ['https://example.test/?a=1&b=2'])
})

test('homepage checks title, description, canonical, language and JSON-LD', () => {
  assert.deepEqual(htmlErrors(html, base), [])
  assert.ok(htmlErrors('<html><head><title></title></head>', base).length >= 3)
})

test('robots validation rejects global disallow', () => {
  assert.deepEqual(robotsErrors(robots, base), [])
  assert.ok(robotsErrors('User-agent: *\nDisallow: /', base).includes('Whole site blocked'))
})

test('sitemap detects private and duplicate URLs', () => {
  assert.deepEqual(sitemapErrors(sitemap, base), { errors: [], urls: 3, productUrls: 2 })
  const bad = '<urlset><loc>' + base + '/admin</loc><loc>' + base + '/admin</loc></urlset>'
  assert.ok(sitemapErrors(bad, base).errors.some((error) => error.startsWith('Private URL')))
  assert.ok(sitemapErrors(bad, base).errors.some((error) => error.startsWith('Duplicate')))
})

test('network scanner is read-only and reports six endpoints', async () => {
  const docs = new Map([['/', html], ['/robots.txt', robots], ['/sitemap.xml', sitemap], ['/about', 'ok'], ['/faq', 'ok'], ['/privacy', 'ok']])
  const called = []
  const fakeFetch = async (url, options) => {
    called.push({ url, options })
    return { status: 200, ok: true, url, text: async () => docs.get(new URL(url).pathname) }
  }
  const result = await scanSite(base, fakeFetch)
  assert.equal(result.passed, true)
  assert.equal(result.results.length, 6)
  assert.equal(result.results[2].productUrls, 2)
  assert.ok(called.every((request) => request.url.startsWith(base) && !request.options.method))
})
