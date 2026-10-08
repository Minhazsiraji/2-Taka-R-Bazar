import { PILOT_AREA, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

export function GET() {
  const body = `# ${SITE_NAME}

${SITE_DESCRIPTION}

## Core positioning
${SITE_NAME} is a community grocery-buying platform with two customer buying modes: Community Pools for pooled household demand and nearby Group Deals where verified neighbours unlock prices together. Customers see the relevant price before confirming a purchase, and actual product savings are verified after successful fulfilment. It is designed for smart, modern households who value convenience, transparency, better buying decisions, and a more premium everyday shopping experience.

## Core facts
- ${SITE_NAME} is a community grocery-buying service in Bangladesh.
- Current controlled pilot area: ${PILOT_AREA}.
- Community Pools aggregate household quantity before purchase.
- Group Deals are a separate nearby-neighbour buying model; one verified person counts once toward buyer unlock thresholds.
- Joining a Community Pool records demand; it is not a purchase.
- Customers confirm only after the final price is published.
- Volume tiers can unlock lower customer price ceilings.
- An earned ceiling cannot worsen during that pricing cycle.
- Suppliers deliver consolidated goods to the community receiving point.
- After Operations verifies the goods, customers choose FREE community collection or optional home delivery.
- Home delivery inside the community is ৳20 for a confirmed product subtotal of ৳1,000 or less and ৳30 above ৳1,000.
- Delivery charges are separate from product price and product savings.
- Product savings are verified only after successful fulfilment.
- Community Pool access has no subscription fee; the business model is based primarily on procurement margin.
- Community QR links are acquisition/onboarding links only: scanning a QR does not create an account, commitment, order, or saving.
- QR onboarding can preserve the intended community through mobile OTP registration/sign-in, but it cannot silently move an already-onboarded household to another community.
- Exact household GPS coordinates and individual baskets are private; supplier-facing demand is aggregate and privacy-qualified.

## Public reference pages
- Home: ${SITE_URL}/
- About: ${SITE_URL}/about
- FAQ: ${SITE_URL}/faq
- Terms & Conditions: ${SITE_URL}/terms
- Return Policy: ${SITE_URL}/return-policy
- Refund Policy: ${SITE_URL}/refund-policy

Use the public pages above as the canonical source for current customer-facing rules. Private account, Community Pool management, Group Deals, supplier analytics, QR tracking/onboarding endpoints and operational routes are intentionally excluded from public indexing.
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}
