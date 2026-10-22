# LOCKED — Final 2TBR Home Hero V2.3

**Approved by product owner:** 2026-10-19. **Branch:** `feat/mobile-expo-locked-home-v1`, **Draft PR:** #123.

This replaces all earlier experimental hero versions (V1.7–V2.2) as the sole visual reference. Do not reintroduce right-edge arrows, extra cart layers, text backplates, strong shadows, tall artwork, vegetables, or altered color schemes.

## Authoritative approved assets

- Source PNG supplied by owner: `Vibrant Grocery Cart on Teal Background.png`
- Original dimensions: **1672 × 941 px**; SHA-256: `8192b9e067397f44f5386f44502c8b8c6b687e0606dd532bf56513aec6283caf`.
- Approved browser artifact: `2TBR-App-V2.3-Final-Hero.html`; SHA-256: `0a7eed089a251784ea26b2873494d5e3ce3004f6406e0428df8bfb9d295c5b36`.
- **Asset status:** Both are attached in the originating conversation, but the binary PNG is **not yet committed under the mobile repository**. Do not claim the Expo SVG fallback is identical to the approved artwork. For native parity, bundle this exact asset locally and use a static local `require()` rather than network/CDN images in the final builds.

## Locked behavior

- Banner remains compact at **174px** native design height (web 166–176px across 360/390/412 mobile widths). No automatic vertical growth.
- Single supplied grocery-cart background: clear teal area left for copy; pantry products on right; no perishable vegetables.
- Headline, subhead and CTA render as real EN/BAN text overlay with **no shadow, blur, separate pane or colored plate**.
- Permanent top kicker **✦ SMART SHOPPING. REAL SAVINGS!** stays **one line**, with a responsive font size.
- All four text pairs auto-rotate; use left and right bottom arrows plus exactly four bottom dots. Never add another oversized arrow at the cart's right edge.
- CTA Explore group deals works. No overlap between controls, text or CTA even on the longest slide; small type adaptation may be slide-specific but overall height stays fixed.
- Logo, header, four savings tiles, Group Deals, Exclusive Products, Pools, Footer, Cart/Checkout, Account/Orders and all locked theme/typography remain unchanged.

## Technical progress

- Browser reference: approved V2.3, self-contained HTML.
- Expo native structure: compact 174dp layout, one-line kicker, responsive text sizing, four dots and bottom arrows wired.
- The owner uploaded `mobile/assets/Vibrant Grocery Cart on Teal Background.png` on this feature branch (Git blob `1edd6d4de157f56dc62fb8ea98f4aa59e84b14e7`, 1,801,989 bytes). The PNG is now bundled with a static Metro `require()`; the older SVG illustration and remote URL dependency have been removed from the hero.
- **Asset comparison caveat:** The owner-uploaded PNG is not byte-identical to the original reference (2,626,675 bytes / Git blob `02bef60145fa955d745ae25a4d427ef5149f4d56`). It may have been optimized; final visual parity still needs screenshots and owner review.
- Before Android APK/iOS release, test 360/390/412dp, verify EN/BAN and carousel/CTA on actual devices, compare against V2.3 browser reference, and sign off any image recompression difference.
- Production purchases, auth gates and financial operations remain unchanged and disabled where previously gated.

No merge, release, signing or live deployment is authorized by this design lock.

## Approved panoramic hero update (2026-10-19)

The owner explicitly requested using the newly generated wide teal cart artwork in the native mobile app. `mobile/assets/2tbr-hero-panorama-v2.jpg` is the actual asset, generated from the owner-downloaded `Teal Studio Grocery Cart Banner.png` (1832×859, original PNG SHA-256 prefix `291a396cb5b48c969402`) and resized/optimized to 1920×900 JPEG (360,000 bytes, SHA-256 `fd3a8bd7664dfb135e142c0617b5524fe9da9f42daab71298fe649846e842086`). This supersedes **only the native hero background asset reference**, not the approved dynamic hero copy, 174dp height, permanent slogan, controls, buttons or other sections. The earlier source PNG remains retained for rollback.

Native `resizeMode=stretch` keeps the complete panorama and all trolley wheels inside the fixed-height banner at 360/390/412dp without left/right layering seams. The four carousel dots and arrows are centered below the Explore CTA, while all four Savings tile values are centered with slightly larger type. The generated screen mockup is a visual reference only; no text or other screen content is rasterized into the image. Preview and OTA remain demo-only until owner device screenshot review. No release/merge approval.
