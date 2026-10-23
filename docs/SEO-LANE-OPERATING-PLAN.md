# 2TBR SEO Lane — verified baseline and implementation gates (23 Oct 2026)

Master tracker: https://github.com/Minhazsiraji/2-Taka-R-Bazar/issues/149

## Existing implementation: preserve
- Global SEO/Open Graph metadata: `app/layout.tsx`
- Indexing rules for public/private routes: `app/robots.ts` and `proxy.ts`
- Dynamic public product sitemap via `get_public_product_seo`: `app/sitemap.ts`
- English and Bangla product canonical routes: `app/p/[slug]` and `app/bn/p/[slug]`
- Product SEO publication rules: prior Issue #80 and existing SQL/RLS publication gates.
- Keep the approved storefront, real products, community cycle, and finance controls untouched.

## Read-only smoke audit
```bash
node --test tests/seo-health-check.test.mjs
node scripts/seo-health-check.mjs
# Or an isolated preview URL:
SEO_AUDIT_URL=https://YOUR-PREVIEW-URL node scripts/seo-health-check.mjs
```
The script GETs only six public paths and checks title, meta, canonical, JSON-LD, homepage language, robots, sitemap, duplicate URLs and private-route exposure. It does not claim to prove Google indexing or Core Web Vitals. A public network probe was not available from the first analysis environment, so hosted responses remain **unverified** until this command runs in CI or another reachable browser. Product URL count can be zero if no published canonical product is exposed; reconcile with actual approved product rows before reporting success.

## Required authenticated configuration
1. **Google Search Console**: Add/verify Domain property `2takarbazar.com` via a Google-provided DNS TXT record, or use an already verified property. Then submit `https://2takarbazar.com/sitemap.xml` and inspect canonical homepage + 2 active product URLs. Do not paste Google login details.
2. **GA4**: Create/identify a GA4 property and Web stream. Record its *public* Measurement ID (`G-...`). Region/time zone: Bangladesh, revenue currency: BDT. Link the verified GSC property.
3. **Meta Events Manager**: Create/identify the business-owned website Dataset/Pixel ID. Install browser Pixel only after explicit marketing-consent gating and preview testing. Do not paste CAPI tokens into GitHub/issues/chat; store them as server-only scoped Vercel environment secrets.
4. **Business Profile**: Determine eligibility before claiming: business must directly contact customers in person during stated hours. Purely online-only brands are ineligible. If genuine customer deliveries are performed face to face, configure service-area business (hide residential/non-customer-facing address), accurate phone, service areas, operating hours, website and genuine photos; owner handles Google verification.

## Event definitions: approved real outcomes only
| Customer journey | GA4 event | Meta browser/server | Rule |
|---|---|---|---|
| Public landing | `page_view` | `PageView` | Consent, one per route view |
| Published real product details | `view_item` | `ViewContent` | Real SKU, BDT, published facts |
| Add to real cart | `add_to_cart` | `AddToCart` | Only successful real cart write |
| Commitment submitted to Pool/Deal | `pool_commitment_submit` or `deal_commitment_submit` | Custom event, if useful | **Not Purchase** |
| Final quoted tier/fees acknowledged | `final_price_confirmed` | Custom event, if useful | **Not Purchase** |
| Checkout initiated | `begin_checkout` | `InitiateCheckout` | Actual checkout start, not page load |
| Confirmed paid real order | `purchase` | `Purchase` | Only authoritative finalized payment/settlement, stable transaction ID |
| Actual completed refund | `refund` | Corresponding verified event | Only real refund state |

Do not emit events from synthetic fixtures, Preview demo, admin QA, unconfirmed commitment, price quote or partial customer action. Do not include mobile number, email, password, exact GPS, delivery address, customer identity or bank details in client analytics. Use verified positive BDT prices, valid item arrays, nonduplicated actual IDs, and don't assume a Pool quote is a completed sale.

## Pixel + CAPI deduplication and security
- Use the *same* event name and unique event identifier at browser `eventID` and CAPI `event_id` for the same real outcome.
- Server events must be triggered only by verified backend settlement transitions, not an anonymously callable public endpoint that accepts arbitrary `Purchase` payloads.
- Use an authenticated/authorized source, outbox/idempotency/retry logic, event status persistence and limited PII, respecting consent. Keep CAPI access token server-only.
- Confirm dedup and delivery with Meta Test Events, GA4 DebugView/Realtime and purchase reconciliation. Do not enable live sends based on a passing unit test alone.

## Deployment sequence
1. Commit read-only audits and run locally/CI.
2. Separate feature-flagged tracking PR with consent UX (review approved brand styling).
3. Preview quality checks across mobile/desktop + dark/light, privacy policy update, no duplicate calls, no unwanted script loads before consent.
4. Configure production GA4/Meta public IDs and private secrets only after end-to-end Test Events success.
5. Progressive release with monitoring and rollback; no unauthorized production edits.

## Reporting target
Weekly: SEO crawl/indexed URL count; Search Console queries, impressions, clicks, CTR and position; GA4 engaged organic sessions, funnel and real orders; Meta event quality/dedup; content shipped; fixes and conversions. No fabricated metrics or guaranteed ranking claims.
