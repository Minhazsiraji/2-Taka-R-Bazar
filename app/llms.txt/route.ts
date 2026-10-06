import { PILOT_AREA, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

export function GET() {
  const body = `# ${SITE_NAME}

${SITE_DESCRIPTION}

## Core positioning
${SITE_NAME} is a community grocery-pooling platform where households combine demand, suppliers compete for volume, customers see the final price before confirming, and actual product savings are verified after successful fulfilment. It is designed for smart, modern households who value convenience, transparency, better buying decisions, and a more premium everyday shopping experience.

## Core facts
- ${SITE_NAME} is a community grocery-pooling service in Bangladesh.
- Current controlled pilot area: ${PILOT_AREA}.
- Joining a pool records demand; it is not a purchase.
- Customers confirm only after the final price is published.
- Volume tiers can unlock lower customer price ceilings.
- An earned ceiling cannot worsen during that pricing cycle.
- Suppliers deliver consolidated goods to the community receiving point.
- After Operations verifies the goods, customers choose FREE community collection or optional home delivery.
- Home delivery inside the community is ৳20 for a confirmed product subtotal of ৳1,000 or less and ৳30 above ৳1,000.
- Delivery charges are separate from product price and product savings.
- Product savings are verified only after successful fulfilment.
- Community Pool access has no subscription fee; the business model is based primarily on procurement margin.

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
