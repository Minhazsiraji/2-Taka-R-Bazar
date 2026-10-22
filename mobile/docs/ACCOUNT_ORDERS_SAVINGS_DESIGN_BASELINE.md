# 2TBR Mobile — Account, Orders, Tracking and Savings Design Baseline

**Review evidence:** Customer screenshots reviewed 2026-10-18 for Account (EN/BAN), completed/preparing Order Tracking and Savings Report (full-length). 
**Design status:** Reviewed with no further visual corrections identified; preserve these visual layouts while integrating real authentication and data. This document is a design baseline **not** a production-feature signoff, merge approval, or proof of user-authenticated operations.
**Branch / PR:** `feat/mobile-expo-locked-home-v1` / Draft PR #123.

## Preserve screens and UX

1. **Account:** V1 Signature Teal styling, branded header, 5-tab navigation, guest/demo identity clear, 2×2 overview tiles (orders, lifetime savings, completed, cart lines), recent orders, savings preview, account services and explicit website sign-in fallback. Do not claim website login signs in the native demo.
2. **My Orders:** all/active/completed/cancelled filters, human-readable labels in EN/BAN, product thumbnails, order date/number, total, earned saving from completed eligible orders only.
3. **Order Tracking:** ordered status timeline, distinguish finished stages from future steps, separate order items/quantities, delivery/support details and return to Orders; preparing order must never appear completed or as earned savings.
4. **Personal Savings:** four top metrics — This Month, Previous Month, Lifetime, Community total; completed example order savings ledger, earnings explanation, and explicit disclaimers that numbers are illustrative and savings are not cash/withdrawable.
5. Preserve previously locked Home, Group Deal Details, Individual Product Details, Pool Details and Cart/Checkout. Visual changes to other screens must not alter these baselines.

## Demo reconciliation verified in owner screenshots

- October `৳1,250` = `৳195` + `৳1,055`.
- September `৳1,060`.
- August `৳6,140`.
- Lifetime `৳8,450` = 1250+1060+6140; 4 completed illustrative orders.
- Pending/cancelled examples contribute `৳0` to earned savings.
- Community `৳248,620` is an **independent demo aggregate**, never added to a customer's wallet or withdrawable balance.

## Implementation and security boundaries

- Guest/demo data is synthetic and cannot be used as real customer order or financial history.
- Website sign-in links to the existing /login route; it does NOT authenticate native Expo/web preview. Native login is a separate security and user-experience work lane.
- Native sign-in must use existing Supabase Auth providers, deep-link callback allowlist, PKCE/state/session lifecycle, encrypted OS keychain/keystore and valid account/role binding. Login/registration must preserve web and native account identity without creating duplicates.
- Native order history and account/profile endpoints must be authenticated, customer-scoped, RLS/IDOR tested; order lines, fulfilment, refunds and Finance-confirmed saving events must come from server-authoritative records.
- Verified savings formula: eligible completed/fulfilled quantities, using valid verified market reference and final sale price, net of returns/refunds. Pending Group Deal and Pool drafts earn no savings. Monthly/lifetime totals must reconcile by signed-in user and event/fulfilment date.
- Service shortcuts (Saved Addresses, My Money, Notifications, Profile Settings) marked Soon remain unavailable until separately implemented. No assumption of data permissions or real function.
- Keep Production purchases disabled until release qualification. No merge/deployment without authorization.

## Next implementation/review

**Native Authentication and Account Session Flow:** Google and Bangladesh mobile/password supported by existing website as available; test native sign-in/sign-out, verified account identity, secure restoration, expired/revoked session, customer-scoped Orders, and preservation of independent cart state. Then progressively connect real protected order and savings data.
