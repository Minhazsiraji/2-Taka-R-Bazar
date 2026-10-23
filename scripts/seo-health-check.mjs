#!/usr/bin/env node
// Read-only, dependency-free public SEO smoke check. Never logs visitor or account information.
import { pathToFileURL } from 'node:url'

const BASE = 'https://2takarbazar.com'
const ROUTES = ['/', '/robots.txt', '/sitemap.xml', '/about', '/faq', '/privacy']

export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1].replaceAll('&amp;', '&').trim())
}

export function htmlErrors(html, origin) {
  const errors = []
  const titles = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)]
  if (titles.length !== 1 || !titles[0][1].trim()) errors.push('Missing or duplicate title')
  if (!/<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["'][^"']+["']/i.test(html) &&
      !/<meta\b[^>]*\bcontent=["'][^"']+["'][^>]*\bname=["']description["']/i.test(html)) errors.push('Missing description')
  if (/<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["'][^"']*noindex/i.test(html)) errors.push('Homepage has noindex')
  const canonicals = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]).filter((tag) => /\brel=["']canonical["']/i.test(tag))
  const href = canonicals[0]?.match(/\bhref=["']([^"']+)["']/i)?.[1]
  if (canonicals.length !== 1 || href?.replace(/\/$/, '') !== origin) errors.push('Missing or unexpected homepage canonical')
  if (!/<html\b[^>]*\blang=["']en["']/i.test(html)) errors.push('Missing English homepage language')
  if (!html.includes('application/ld+json')) errors.push('Homepage JSON-LD is missing')
  return errors
}

export function robotsErrors(content, origin) {
  const errors = []
  if (!/^User-agent:\s*\*$/im.test(content)) errors.push('No generic crawler rule')
  if (!content.split(/\r?\n/).some((line) => line.trim() === 'Sitemap: ' + origin + '/sitemap.xml')) errors.push('Wrong/missing canonical sitemap')
  if (/^Disallow:\s*\/\s*$/im.test(content)) errors.push('Whole site blocked')
  if (!/^Disallow:\s*\/admin\/?$/im.test(content)) errors.push('Admin disallow absent')
  return errors
}

export function sitemapErrors(content, origin) {
  const errors = []
  const urls = sitemapUrls(content)
  if (!/<urlset\b/i.test(content)) errors.push('Not a sitemap urlset')
  if (!urls.length) errors.push('Sitemap has no URLs')
  const seen = new Set()
  for (const entry of urls) {
    try {
      const url = new URL(entry)
      if (url.origin !== origin) errors.push('Other-domain sitemap URL: ' + entry)
      if (url.search || url.hash) errors.push('Noncanonical URL: ' + entry)
      if (/^\/(admin|login|signup|cart|checkout|orders|preview-demo|money)(\/|$)/i.test(url.pathname)) errors.push('Private URL in sitemap: ' + entry)
    } catch { errors.push('Invalid sitemap URL: ' + entry) }
    if (seen.has(entry)) errors.push('Duplicate sitemap URL: ' + entry)
    seen.add(entry)
  }
  if (!urls.includes(origin)) errors.push('Homepage missing in sitemap')
  return { errors, urls: urls.length, productUrls: urls.filter((url) => /\/(bn\/)?p\/[a-z0-9-]+$/i.test(url)).length }
}

export async function scanSite(base = BASE, get = fetch) {
  const origin = new URL(base).origin
  const results = []
  for (const route of ROUTES) {
    const url = origin + route
    try {
      const response = await get(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
        headers: { 'user-agent': '2TBR-SEO-Health/1.0 (read-only)' },
      })
      const body = await response.text()
      let errors = response.status === 200 ? [] : ['HTTP ' + response.status]
      if (new URL(response.url).origin !== origin) errors.push('Off-domain redirect')
      if (response.ok && route === '/') errors.push(...htmlErrors(body, origin))
      if (response.ok && route === '/robots.txt') errors.push(...robotsErrors(body, origin))
      const sitemap = response.ok && route === '/sitemap.xml' ? sitemapErrors(body, origin) : null
      if (sitemap) errors.push(...sitemap.errors)
      results.push({ url, http: response.status, status: errors.length ? 'FAIL' : 'PASS', errors, ...(sitemap ? { sitemapUrls: sitemap.urls, productUrls: sitemap.productUrls } : {}) })
    } catch (error) {
      results.push({ url, http: null, status: 'FAIL', errors: [String(error?.message ?? error)] })
    }
  }
  return { site: origin, checkedAt: new Date().toISOString(), passed: results.every((result) => result.status === 'PASS'), results }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await scanSite(process.env.SEO_AUDIT_URL || process.argv[2] || BASE)
  console.log(JSON.stringify(result, null, 2))
  if (!result.passed) process.exitCode = 1
}
