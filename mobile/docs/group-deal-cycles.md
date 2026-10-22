# 2TBR Group Deal cycle and expiration policy — design, NOT deployed

Source: current SQL \`group_deals\`, \`group_circles\`, \`group_deal_commitments\`, \`private.process_expired_group_deals\`, \`public.join_group_deal\`. This document does **not** change SQL, payment, Commerce or Finance controls.

## A. Filled before deadline
1. Under a published Group Deal, each buying *circle* has its own \`circle_id\`, target size (currently 5 or 10), community and participant commitments. Joining the target closes that circle. Price must be valid for the group's published tier; do **not** equate filling a circle with a settled sale.
2. Further eligible customers may join a **new circle** in the **same published Group Deal**, provided its time window, quantity, verified location, stock, fraud controls and community rules remain valid. The existing \`join_group_deal\` already selects an open circle or creates a new one under the current deal.
3. At group deal expiry, \`process_expired_group_deals\` settles qualified groups per current configured rules. Creating a *new deal ID* is different from opening a new circle: optional **Auto-repeat** should clone a published offer with fresh dates, unique deal ID, price/benchmark snapshot, quantity cap and version after requalification. It must be opt-in and max-cycle/stock guarded.
4. Never silently rejoin a buyer or copy payment authorizations into a new cycle. No duplicate notification/order/revenue or stock reservation on retries (unique idempotency key + transactional locking + audit entries).

## B. Not filled at closing time
1. If qualified buyers < \`min_group_size\`, the current expiry worker **cancels** the deal and remaining commitments, notifies people and states no order and no payment due. No savings are earned.
2. Buyers may explicitly opt into the next qualifying Group Deal/Direct offer after reviewing the new price and deadline; never silently substitute a more expensive order.
3. If the qualified minimum is reached but not an optional higher tier, the **earned qualified price** can lock at deadline (if safe), as already documented in the current expiry migration. Do not falsely label it failed solely because the next tier wasn't reached.
4. Any reserved quantity must be released atomically if a specific flow has actually held stock. \`pilot_booking_requests\` are not stock-reserved orders and must not be treated as such.

## C. 3-person target requires independent schema qualification
Current group circle \`target_size\` and \`circle_capacity\` are constrained to 5/10, and \`min_group_size\` / tier thresholds are >= 5. Adding 3 requires a planned migration, requalification of threshold pricing, unique commitments, geolocation verification, stock eligibility, expiry, refunds, IDOR/RLS and browser concurrency tests. No 3-person option is presently enabled in production.

## D. Safe Auto-repeat eligibility (future implementation)
Require: feature enabled by Owner/Admin; valid product/SKU; verified market reference and selling tiers; stock availability; community; allowed repeat count / date horizon; proper sourcing policy; offer end time; delivery commitment; duplicate protection; fail-safe notification and reconciliation. Each cycle gets a new \`group_deal_id\`; each group within a cycle keeps its own \`circle_id\`. Respect all maker-checker finance rules and do not auto-post to Finance.

## Mobile UX
- Group card: bright blue people icon + n/target; clock icon + exact ending time.
- Filled group: “Group filled — waiting for confirmation”; show next circle if eligible.
- Below minimum at deadline: “Deal not unlocked — no payment due”; offer “Notify me about next deal” / “Buy alone” with explicit opt-in.
- Qualified lower tier: show earned tier and its amount without implying the next tier has unlocked.
- The mobile prototype is read-only/dummy for groups: no actual enrollment or order creation.
