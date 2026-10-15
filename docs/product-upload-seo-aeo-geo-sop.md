# Product Upload SOP — SEO, AEO & GEO
Version: 1.1 · Product Line · 2-TAKA-R-BAZAR · Issue #84
**Official slogans (unchanged):** “Smart shopping. Real savings!” / “একসাথে কিনি, কম দামে পাই!”

> **Meaning of “100%”:** all applicable, verifiable content + technical checks pass before publication. Completing these checks cannot guarantee Google rankings, AI answers/citations, merchant eligibility or sales.

## Start here — one guided Create Product form
1. Open https://2takarbazar.com/admin/products with an authorized Admin or Super Admin account.
2. Select **Create product — one guided form**. All six steps belong to **one form**:
   - **Step 1**: Actual master product, SKU, quantity, brand classification and genuine master photo.
   - **Step 2**: Verified specifications and supplier facts (unknown facts remain blank).
   - **Step 3**: EN/BN product names, descriptions and SEO metadata.
   - **Step 4**: Optional bilingual questions/answers and private verification evidence.
   - **Step 5**: Primary photo alt text and optional verified gallery/marketing URLs.
   - **Step 6**: Final review and **Create product & save SEO draft**.
3. The single creation action writes the master and SEO draft **atomically**. If either fails, no incomplete master/draft is committed. Uploaded files are removed on failure where possible. No price, Pool, cart, procurement or Finance transaction is created.
4. For **existing** products, expand the product card and use the existing SEO editor separately; the two-stage workflow remains supported for edits and maintenance, but is no longer required for new product creation.
5. Complete required publication information and **Submit for independent review**. A **different Super Admin** must approve and note the reason (10+ characters) before publication. Draft, review and published content do not enable purchases.
6. A Super Admin may permanently **Delete unused product** only if it has no business FK records and no prior publication or review history; they must confirm the exact SKU and enter a reason. Any sold, offered, inventoried, procured, supplier-linked, Pool/Group Deal or previously published item can **Archive / deactivate**, not hard delete. Archive keeps identifiers and financial/order history.
7. Verify published EN/BN canonical pages, accessible content and sitemap.

### Current UI field map (do not confuse fields that are not in the admin)
| UI field | Where | Rule / actual limit |
|---|---|---|
| Product Name, Brand, Category, Package size, Unit, SKU | Guided Create step 1 / Existing Edit product panel | Use actual goods; for loose unbranded rice Brand may remain blank; Unit=kg and Package size=1 kg describe the selling measure, **not** a sealed manufacturer bag |
| Primary image | Existing Product image upload | Genuine photo of actual goods; JPEG/PNG/WebP, current form max 5 MB; campaign posters belong elsewhere |
| Brand type | Guided Create step 1 or existing SEO editor → Identity | UNBRANDED_LOOSE / SUPPLIER_BRAND / 2TBR_PRIVATE_LABEL. Own-label requires confirmed 2TBR branding/packaging and corresponding master |
| SEO URL slug | SEO editor → Identity | Lowercase `a-z`, `0-9` and hyphens only, max 120 characters; never recycle an old product's alias |
| English/Bangla titles | SEO editor → Identity | Each 3–180 characters; both languages are required |
| Short EN/BN summary | SEO editor → Identity | Up to 320 characters each |
| Variety, origin, processing, ingredients, storage, package kind, net quantity | Guided Create step 2 or existing SEO editor → Specifications | Only known verified facts; each value up to 500 characters. Unknown attributes remain blank |
| Full EN/BN descriptions | Guided Create step 3 or existing SEO editor → SEO | Up to 8,000 characters each; must be at least 40 EN / 20 BN characters **at submission** |
| Meta title EN/BN | SEO editor → SEO | Up to 110 characters each; at least 10 each **at submission**. Prioritize clarity over artificial character scores |
| Meta description EN/BN | SEO editor → SEO | Up to 320 characters each; at least 30 EN / 20 BN **at submission** |
| Actual primary image alt EN/BN | SEO editor → SEO | Up to 200 characters each; at least 5 characters each **at submission**; describe what is pictured, not a keyword list |
| FAQs | Guided Create step 4 or existing SEO editor → “Bilingual customer questions (AEO)” | Optional: 0–8 **complete pairs** of EN/BN question+answer; question length 5–300, answer length 5–1,200 in each language |
| Gallery 1–6 / Marketing 1–6 | Guided Create step 5 or existing SEO editor → “Additional media” | Optional approved HTTPS image URL + alt EN/BN for each image; max 12 images combined; each alt 3–200 characters. Actual-item gallery is separate from campaign posters |
| Internal verification notes | Guided Create step 4 or existing SEO editor → “GEO verification and publication” | Max 3,000 characters; **at least 10 at submission**. References/notes remain private and should not include passwords or unnecessary personal data |
| Expected version | Hidden revision field | Automatic. If another editor has saved, reload; do not overwrite their changes |

## Example — brown rice loose by weight (verify before using)
| Field | Example for direct entry |
|---|---|
| Name | Brown Rice (Loose) – 1 kg |
| Name (Bangla SEO) | ব্রাউন রাইস (খোলা চাল) – ১ কেজি |
| Brand | Blank (unbranded) |
| Brand type | UNBRANDED_LOOSE |
| Category | Rice & Grains; select the actual existing category |
| Package size / Unit | 1 kg / kg (selling weight, not claimed factory packing) |
| SKU | RICE-BRN-LOOSE-1KG **only if available** |
| SEO slug | brown-rice-loose-1kg |
| Meta title EN | Brown Rice (Loose) 1kg | 2-TAKA-R-BAZAR |
| Meta title BN | ব্রাউন রাইস (খোলা) ১ কেজি | 2-TAKA-R-BAZAR |
| Meta description EN | Explore brown rice sold loose by weight (1 kg). See product facts and check currently approved community buying options at 2-TAKA-R-BAZAR. |
| Meta description BN | খোলা ব্রাউন রাইস ১ কেজি: পণ্যের তথ্য, সংরক্ষণ ও আপনার কমিউনিটিতে বর্তমান কেনাকাটার সুযোগ দেখুন। |
| Short EN | Loose brown rice sold by weight for everyday home cooking. Verify actual variety with the supplier before purchase. |
| Short BN | দৈনন্দিন রান্নার জন্য ওজন অনুযায়ী বিক্রি করা খোলা ব্রাউন রাইস। |
| Alt EN | Genuine close-up of loose brown rice grains (use only if this matches the actual uploaded photo) |
| Alt BN | খোলা ব্রাউন রাইসের দানার আসল কাছ থেকে তোলা ছবি |
| Verification notes (private) | [Date] / [Supplier reference] / [Verified product variety, photo and weights] / [Reviewer source] |

**English description example (edit to actual facts):** “This brown rice is sold loose by weight. The 1 kg selection is the purchasing quantity, not a claim of factory-sealed packaging. Use it for everyday rice meals and store it in a dry, sealed container away from moisture. Check the live community listing for availability; no offer or discounted price is guaranteed by this informational page.”

**বাংলা বিবরণ (আসল তথ্য অনুযায়ী সংশোধন করুন):** “এই ব্রাউন রাইস ওজন অনুযায়ী খোলা অবস্থায় বিক্রি করা হয়। ১ কেজি এখানে ক্রয়ের পরিমাণ বোঝায়; এটি কোম্পানির সিল করা প্যাকেট নয়। আর্দ্রতা থেকে দূরে শুকনো ও বন্ধ পাত্রে সংরক্ষণ করুন। কেনার আগে আপনার কমিউনিটির বর্তমান পণ্য ও অফারের তথ্য দেখে নিন।”

**FAQ example (first of up to 8):**
- EN Q: “Is this factory packaged?” A: “No. It is sold loose by weight; 1 kg is the selling quantity.”
- BN Q: “এটি কি কোম্পানির প্যাকেটজাত চাল?” A: “না। এটি ওজন অনুযায়ী খোলা অবস্থায় বিক্রি হয়; ১ কেজি বিক্রয়ের পরিমাণ।”
- EN Q: “Can I buy it through a community Pool?” A: “Check the current 2TBR listing for your area. Pool participation depends on available approved offers.”
- BN Q: “কমিউনিটি পুলে কি এটি কিনতে পারব?” A: “আপনার এলাকার বর্তমান অনুমোদিত অফার দেখুন। পুলে কেনার সুযোগ অফার অনুযায়ী পরিবর্তিত হতে পারে।”

**Do not use these claims without applicable proof:** “Full Fiber”, “high-fiber”, “unpolished”, “chemical-free”, “organic”, “good for diabetes”, “prevents heart disease”. Brown/red grain appearance does not by itself verify variety. Keep unknown origin/processing blank.

**Future 2TBR brand:** Create a **distinct** SKU/product with actual 2TBR-branded packaging and verified brand details; do not turn historical loose/unbranded transactions into own-brand transactions.

## Checklist A — factual content & claim verification (9 checks)
- [ ] Actual physical variety, item name and selling form verified.
- [ ] Brand type corresponds to item and packaging, and does not imply future branding.
- [ ] Selling quantity, unit, category and SKU match real operations.
- [ ] Origin/processing/ingredients/storage are evidenced or left blank where unknown.
- [ ] Product descriptions in EN/BN are consistent and helpful, without invented facts.
- [ ] Health/nutrition/organic/chemical-free statements have evidence or are excluded.
- [ ] Master photo depicts genuine goods; alt EN/BN describe that exact photograph.
- [ ] Gallery only shows goods; campaign artwork is isolated under Marketing.
- [ ] Internal reviewer can find evidence, source and date without exposing supplier costs to guests.

## Checklist B — technical publication & discovery verification (9 checks)
- [ ] Slug unique and lowercase; no old aliases collide.
- [ ] Both EN/BN titles, summaries, descriptions and search metadata satisfy UI/server length checks.
- [ ] Bilingual FAQs are complete and actually useful; FAQ rich results are not assumed.
- [ ] Draft/review approval uses a different authorized Super Admin and notes.
- [ ] No inactive, demo, unpublished or unlisted item appears in public projection.
- [ ] Canonical routes are `/p/[slug]` and `/bn/p/[slug]`; `hreflang` en-BD/bn-BD/x-default and self-canonical verified.
- [ ] Approved product pages appear in XML sitemap; unlisted entries disappear.
- [ ] Product/BreadcrumbList JSON-LD matches visible names, SKU and image. No fake Offer/price/stock/rating/GTIN; Product content does not turn on checkout.
- [ ] Public page mobile/desktop and both languages tested, and no private supplier/customer/Finance data is exposed.

## QA evidence sheet
| Item | Value |
|---|---|
| Product UUID / SKU | [PRODUCT ID] / [SKU] |
| Physical goods verification | [SOURCE] / [DATE] |
| Preview EN / BN | [URL] / [URL] |
| Public canonical EN / BN | https://2takarbazar.com/p/[slug] / https://2takarbazar.com/bn/p/[slug] |
| Submitter / independent reviewer | [EDITOR] / [SEPARATE SUPER ADMIN] |
| Claim checklist | [9 / 9 or justified N/A] |
| Technical checklist | [9 / 9 or justified N/A] |
| Review decision / note | [APPROVE OR RETURN TO DRAFT] / [NOTE] |

## Publishing and SEO accuracy notes
- Status Draft / Review: not indexed. Published active non-demo only: crawlable. Unlisted: removed from public SEO projection.
- There is **no verified shopping Offer schema** generated by this SEO content route unless a future independently approved Commerce source is integrated. Check current community offer/stock separately.
- AEO/GEO describe writing useful answers and clearly verifiable product facts, not secret ranking mechanisms. Visible FAQs are for visitors; Google generally restricts FAQ rich results.
- Product master image upload uses existing **Product image** input. The SEO editor's gallery and campaign images currently take trusted URLs; it does **not** provide a second file uploader.
- Search engines can choose not to index eligible pages; 100% checklist completion is quality readiness only.
- Main brand slogans are permanent; promotional artwork and campaign messages must not replace product identity or make unverified claims.

## Owner references
- Product master: https://2takarbazar.com/admin/products
- Issue #80 (implemented): https://github.com/Minhazsiraji/2-Taka-R-Bazar/issues/80
- Issue #84 (SOP): https://github.com/Minhazsiraji/2-Taka-R-Bazar/issues/84
- Google product data guidance: https://developers.google.com/search/docs/appearance/structured-data/product
- Google AI Search visibility: https://developers.google.com/search/docs/appearance/ai-features
