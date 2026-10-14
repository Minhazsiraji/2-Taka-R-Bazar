# Customer UI contract — 2026-10-14

User approval: consistent UI look, header, footer and branding across customer pages.

The approved storefront is the reference. Customer tools, My Money, authentication,
policies, product details, community invitations and unavailable-page states use
PublicHeader's storefront presentation and StorefrontFooter. Root Home retains its
interactive product search; other pages provide the same styled browse affordance
leading to Home. My Money is available from the common menu and Account dashboard.
Page-specific forms, charts, tabs and permissions retain their functions.

Branding always uses 2-TAKA-R-BAZAR and both exact permanent slogans. Phones use the
approved compact logo row; tablet/desktop show the complete name and slogan pair.
The five-link mobile dock is fixed below 768px. Language selection persists across
headers/footers. Footer contacts, policies and information anchors are identical;
information anchors target / regardless of the current route.

The design lock protects shared chrome, its styles and required wiring. Native
browser assertions verify full-width header/footer, complete branding, contacts,
policy links, canonical Home anchors, notification access, language control,
responsive header geometry and mobile dock scrolling/tap targets in both themes.

## Customer route inventory

- `/about`
- `/account/addresses`
- `/account/orders/[id]`
- `/account/orders`
- `/account`
- `/account/savings`
- `/account/security`
- `/cart`
- `/checkout`
- `/community`
- `/community-invite/[code]`
- `/demo-pool/[slug]`
- `/demo-product/[id]`
- `/faq`
- `/feedback`
- `/group-deals`
- `/login`
- `/money/accounts`
- `/money/budgets`
- `/money/categories`
- `/money/monthly-income`
- `/money`
- `/money/recurring`
- `/money/reports`
- `/money/transactions`
- `/money/transfers`
- `/notifications`
- `/onboarding`
- `/orders`
- `/`
- `/pickup`
- `/pool`
- `/privacy`
- `/products/[id]`
- `/profile`
- `/refund-policy`
- `/return-policy`
- `/savings`
- `/shop/[id]`
- `/signup`
- `/subscription`
- `/terms`

## Redirect and unavailable states

- `/home` uses the current customer destination.
- `/verify-otp` uses the current customer destination.

Invalid/missing public offers or invitations use the branded unavailable-page frame.
Parameterized product and invitation routes are tested with disposable synthetic
published product and QR fixtures. Order details share CommerceFrame; missing or
inaccessible order records remain unavailable without exposing another customer.

## Staff and qualification surfaces

Admin, Super Admin, supplier, supply, community operations and pickup operations
retain their role-specific operational layouts and financial controls. Synthetic
Preview/Finance/Commerce test routes remain gated and are not Production customer
entry points. No live account, product, transaction or payment setting is changed
by this UI task.
