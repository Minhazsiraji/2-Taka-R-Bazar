import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public-header'
import { PublicFooter } from '@/components/public-footer'
import { PILOT_AREA, PUBLIC_CONTACT_EMAIL, SEO_UPDATED_AT, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'About Community Pools & Group Deals',
  description: `How ${SITE_NAME} uses Community Pools, nearby Group Deals, transparent price confirmation, community fulfilment and verified savings in Savar, Bangladesh.`,
  alternates: { canonical: `${SITE_URL}/about` },
}

export default function AboutPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${SITE_URL}/about#about`,
    url: `${SITE_URL}/about`,
    name: `About ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    inLanguage: ['en-BD', 'bn-BD'],
    dateModified: SEO_UPDATED_AT,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    breadcrumb: { '@id': `${SITE_URL}/about#breadcrumb` },
    about: { '@id': `${SITE_URL}/#organization` },
    mainEntity: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/brand-logo-header.png`,
      description: SITE_DESCRIPTION,
      email: PUBLIC_CONTACT_EMAIL,
      areaServed: { '@type': 'Place', name: PILOT_AREA },
    },
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${SITE_URL}/about#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'About', item: `${SITE_URL}/about` },
    ],
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <PublicHeader actionHref="/" actionLabel="Home" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">About {SITE_NAME}</p>
        <p className="mt-1 text-[11px] font-semibold text-slate-500" lang="bn">{SITE_NAME} সম্পর্কে</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Community Pools and Group Deals, built around verified demand.</h1>
        <p className="mt-1 text-sm font-semibold leading-6 text-slate-600" lang="bn">Verified demand-এর ভিত্তিতে Community Pool ও Group Deal।</p>
        <p className="mt-4 text-lg leading-8 text-slate-700">{SITE_NAME} is a community grocery-buying platform with two distinct customer buying modes. Community Pools combine household quantity before supplier pricing and purchase confirmation. Group Deals use verified nearby buyers to unlock deal prices together. Actual product savings are verified only after successful fulfilment.</p>
        <p className="mt-2 text-[13px] leading-6 text-slate-500 sm:text-sm" lang="bn">{SITE_NAME} একটি কমিউনিটি grocery-buying platform। Community Pool-এ supplier pricing ও purchase confirmation-এর আগে পরিবারের প্রয়োজনীয় পরিমাণ একত্র হয়। Group Deal-এ verified কাছাকাছি buyers একসাথে deal price unlock করেন। Successful fulfilment-এর পর actual product saving যাচাই করা হয়।</p>
        <p className="mt-4 leading-7 text-slate-700">It is designed for smart, modern households who value convenience, transparency, better buying decisions, and a more premium everyday shopping experience.</p>
        <p className="mt-1 text-[13px] leading-6 text-slate-500 sm:text-sm" lang="bn">এটি এমন স্মার্ট ও আধুনিক পরিবারের জন্য তৈরি, যারা convenience, transparency এবং ভালো buying decision-কে গুরুত্ব দেন।</p>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">Community Pools</h2><p className="mt-1 text-[12px] font-semibold text-slate-500" lang="bn">কমিউনিটি পুল</p><p className="mt-2 leading-7 text-slate-700">Households commit quantity first so the platform can aggregate demand and negotiate against volume. A commitment is not a purchase; an order is created only after the final price is published and the customer explicitly confirms.</p><p className="mt-2 text-[13px] leading-6 text-slate-500" lang="bn">পরিবারগুলো আগে প্রয়োজনীয় পরিমাণ জানায়, যাতে মোট demand একত্র করে volume অনুযায়ী ভালো দর নেওয়া যায়। Commitment purchase নয়; final price প্রকাশের পর customer confirm করলে order তৈরি হয়।</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">Group Deals</h2><p className="mt-1 text-[12px] font-semibold text-slate-500" lang="bn">গ্রুপ ডিল</p><p className="mt-2 leading-7 text-slate-700">Nearby verified buyers can unlock deal prices together. One verified person counts once toward buyer thresholds, regardless of how many units they request, and exact household GPS coordinates stay private.</p><p className="mt-2 text-[13px] leading-6 text-slate-500" lang="bn">কাছাকাছি verified buyers একসাথে deal price unlock করতে পারেন। Buyer threshold-এ একজন verified ব্যক্তি একবারই গণনা হন এবং exact household GPS private থাকে।</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">How price improvement works</h2><p className="mt-1 text-[12px] font-semibold text-slate-500" lang="bn">দাম কীভাবে ভালো হয়</p><p className="mt-2 leading-7 text-slate-700">Pool volume or qualified-neighbour thresholds can unlock better pricing. Final pricing and confirmation rules remain explicit so customers can see the relevant price before a purchase is created.</p><p className="mt-2 text-[13px] leading-6 text-slate-500" lang="bn">Pool volume বা qualified-neighbour threshold ভালো price unlock করতে পারে। Purchase তৈরির আগে customer সংশ্লিষ্ট price দেখতে পারেন।</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">How fulfilment works</h2><p className="mt-1 text-[12px] font-semibold text-slate-500" lang="bn">পণ্য কীভাবে পাওয়া যায়</p><p className="mt-2 leading-7 text-slate-700">Suppliers deliver consolidated goods to the community receiving point. After Operations verifies receipt, customers choose FREE community collection or optional home delivery. Delivery charges remain separate from product savings.</p><p className="mt-2 text-[13px] leading-6 text-slate-500" lang="bn">Supplier একত্রিত পণ্য community receiving point-এ দেয়। Verification-এর পর customer FREE community collection অথবা optional home delivery বেছে নিতে পারেন। Delivery charge product saving থেকে আলাদা।</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">How savings are verified</h2><p className="mt-1 text-[12px] font-semibold text-slate-500" lang="bn">সাশ্রয় কীভাবে যাচাই হয়</p><p className="mt-2 leading-7 text-slate-700">Savings compare an approved local-market benchmark with the final customer price. Product savings become verified only after successful fulfilment.</p><p className="mt-2 text-[13px] leading-6 text-slate-500" lang="bn">Approved local-market benchmark-এর সাথে final customer price তুলনা করে saving হিসাব করা হয়। Successful fulfilment-এর পর saving verified হয়।</p></article>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-black">Who is it designed for?</h2>
            <p className="mt-1 text-[12px] font-semibold text-slate-500" lang="bn">কার জন্য তৈরি?</p>
            <p className="mt-2 leading-7 text-slate-700">For households that want a smarter way to buy recurring groceries: transparent local benchmarks, stronger volume-based supplier negotiation, clear final prices before purchase, and convenient community fulfilment.</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-500" lang="bn">যেসব পরিবার নিয়মিত grocery কেনায় আরও smart, transparent এবং convenient পদ্ধতি চান—তাদের জন্য।</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-black">Why is it different from a normal grocery store?</h2>
            <p className="mt-1 text-[12px] font-semibold text-slate-500" lang="bn">সাধারণ grocery store থেকে আলাদা কেন?</p>
            <p className="mt-2 leading-7 text-slate-700">The model starts with pooled community demand instead of a fixed retail shelf price. Customers see the negotiated final price before confirming, and verified product savings are recorded only after successful fulfilment.</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-500" lang="bn">Fixed shelf price-এর বদলে pooled community demand থেকে model শুরু হয়। Confirm করার আগে negotiated final price দেখা যায়, আর successful fulfilment-এর পর verified saving record হয়।</p>
          </article>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-black">Community QR onboarding</h2>
          <p className="mt-1 text-[12px] font-semibold text-slate-500" lang="bn">কমিউনিটি QR দিয়ে শুরু</p>
          <p className="mt-2 leading-7 text-slate-700">Community-specific QR links help households reach the correct launch community. Scanning a QR never creates an account, commitment, order or saving by itself. Mobile verification and an explicit community confirmation still happen before buying begins.</p>
          <p className="mt-2 text-[13px] leading-6 text-slate-500" lang="bn">Community-specific QR household-কে সঠিক community onboarding flow-এ নেয়। শুধু QR scan করলেই account, commitment, order বা saving তৈরি হয় না।</p>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-black">Current pilot area</h2>
          <p className="mt-1 text-[12px] font-semibold text-slate-500" lang="bn">বর্তমান পাইলট এলাকা</p>
          <p className="mt-2 leading-7 text-slate-700">The controlled pilot is focused on {PILOT_AREA}. Expansion should follow only after the operating model, supplier process, fulfilment flow and customer experience are proven.</p>
          <p className="mt-3 leading-7 text-slate-700" lang="bn">বর্তমান নিয়ন্ত্রিত পাইলট {PILOT_AREA}-এ কেন্দ্রীভূত। অপারেশন, supplier process, fulfilment flow এবং customer experience প্রমাণিত হওয়ার পর ধাপে ধাপে নতুন কমিউনিটিতে সম্প্রসারণ করা হবে।</p>
        </section>

        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2"><Link href="/faq" className="font-black underline">FAQ / প্রশ্নোত্তর →</Link><Link href="/terms" className="font-black underline">Terms & Conditions →</Link></div>
      </div>
      <PublicFooter />
    </main>
  )
}
