# Admin-entered product master fields — mobile presentation
**Design lane:** Draft PR #123. No production schema, admin endpoint or existing website screens are modified here.

The Individual Product Details page shows the master Product Brand after Product Name, then three compact collapsible customer-friendly sections: (1) SEO/product description and verifiable specification fields; (2) AEO/FAQ questions and answers; (3) GEO/local availability and delivery service areas. Admin will populate these when creating/updating a product. Missing data is **Not provided yet**, never invented.

Types and field descriptions: `mobile/src/product-content.ts`.
Future admin integration: populate `Product.brand` and optional `Product.content` from the *existing shared product master* via permission-controlled server response. The read-only catalog will map a returned `brand` string only if actually present.

Future private/search metadata fields represented in ProductContent but not exposed as consumer facts include: bilingual SEO titles/descriptions, canonical URL, slug, bilingual image alt, structured-data status. Canonicals/JSON-LD/dynamic sitemap must be implemented server-side for discoverability, not only by the Expo screen.

**Publication gate:** Product claims, country of origin, ingredients, certifications, allergens and FAQ answers must have authorized, verified input; no generated or assumed certifications or origin. Only publish metadata matching real products and permitted community delivery coverage. Version the content and preserve prior confirmed checkout price/reference snapshots.

Customer retail details page uses only the retail reference. Group Deal/Pool prices remain on their own pages. The Home screen lock, approved product cards, theme and Group Deal layout remain unchanged.
