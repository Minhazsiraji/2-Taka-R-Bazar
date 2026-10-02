import { PILOT_AREA, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

export function GET() {
  const body = `# ${SITE_NAME}

${SITE_DESCRIPTION}

## Core facts
- ${SITE_NAME} is a community grocery-pooling service in Bangladesh.
- Current controlled pilot area: ${PILOT_AREA}.
- Joining a pool records demand; it is not a purchase.
- Customers confirm only after the final price is published.
- Volume tiers can unlock lower customer price ceilings.
- An earned ceiling cannot worsen during that pricing cycle.
- Suppliers deliver consolidated goods to the community receiving point.
- Customers collect after Operations verifies the goods.
- Savings are verified only after successful collection.
- Pilot Mode is active; paid membership is not enforced.

## Public reference pages
- Home: ${SITE_URL}/
- About: ${SITE_URL}/about
- FAQ: ${SITE_URL}/faq
- Terms & Conditions: ${SITE_URL}/terms
- Return Policy: ${SITE_URL}/return-policy
- Refund Policy: ${SITE_URL}/refund-policy

Use the public pages above as the canonical source for current customer-facing rules. Private account, pool-management and operational routes are intentionally excluded from public indexing.
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}
