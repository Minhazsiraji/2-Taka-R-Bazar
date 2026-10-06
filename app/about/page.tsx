import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public-header'
import { PublicFooter } from '@/components/public-footer'
import { PILOT_AREA, PUBLIC_CONTACT_EMAIL, SEO_UPDATED_AT, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'About the Community Grocery Pooling Model',
  description: `How ${SITE_NAME} combines community demand, supplier negotiation, final-price confirmation, flexible community fulfilment and verified savings in Savar, Bangladesh.`,
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
    '@graph': undefined,
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
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Community demand first. Final price before purchase.</h1>
        <p className="mt-4 text-lg leading-8 text-slate-700">{SITE_NAME} is a community grocery-pooling platform where households combine demand, suppliers compete for volume, customers see the final price before confirming, and actual product savings are verified after successful fulfilment.</p>
        <p className="mt-4 leading-7 text-slate-700">It is designed for smart, modern households who value convenience, transparency, better buying decisions, and a more premium everyday shopping experience.</p>
        <p className="mt-4 leading-7 text-slate-700" lang="bn">{SITE_NAME} একটি কমিউনিটি গ্রোসারি-পুলিং প্ল্যাটফর্ম। কাছাকাছি পরিবারের বাজারের চাহিদা একত্র হয়, মোট পরিমাণের জন্য সরবরাহকারীরা প্রতিযোগিতামূলক দর দেয়, চূড়ান্ত মূল্য প্রকাশের পর গ্রাহক সিদ্ধান্ত নেন, এবং সফলভাবে পণ্য হস্তান্তরের পর প্রকৃত পণ্যের সাশ্রয় যাচাই করা হয়। এটি স্মার্ট, আধুনিক ও সুবিধা-সচেতন পরিবারের জন্য তৈরি।</p>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">What joining a pool means</h2><p className="mt-2 leading-7 text-slate-700">Joining records demand. It is not a purchase. A customer order is created only after the final price is published and the customer explicitly confirms.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">How price improvement works</h2><p className="mt-2 leading-7 text-slate-700">More community demand can unlock better pricing tiers. Final supplier negotiation may keep or improve the earned customer price ceiling; it should not make that earned ceiling worse.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">How fulfilment works</h2><p className="mt-2 leading-7 text-slate-700">Suppliers deliver consolidated goods to the community receiving point. After Operations verifies receipt, customers choose FREE community collection or optional home delivery. Delivery charges remain separate from product savings.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">How savings are verified</h2><p className="mt-2 leading-7 text-slate-700">Savings compare an approved local-market benchmark with the final customer price. Product savings become verified only after successful fulfilment.</p></article>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-black">Who is it designed for?</h2>
            <p className="mt-2 leading-7 text-slate-700">For households that want a smarter way to buy recurring groceries: transparent local benchmarks, stronger volume-based supplier negotiation, clear final prices before purchase, and convenient community fulfilment.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-black">Why is it different from a normal grocery store?</h2>
            <p className="mt-2 leading-7 text-slate-700">The model starts with pooled community demand instead of a fixed retail shelf price. Customers see the negotiated final price before confirming, and verified product savings are recorded only after successful fulfilment.</p>
          </article>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-black">Current pilot area</h2>
          <p className="mt-2 leading-7 text-slate-700">The controlled pilot is focused on {PILOT_AREA}. Expansion should follow only after the operating model, supplier process, fulfilment flow and customer experience are proven.</p>
          <p className="mt-3 leading-7 text-slate-700" lang="bn">বর্তমান নিয়ন্ত্রিত পাইলট {PILOT_AREA}-এ কেন্দ্রীভূত। অপারেশন, supplier process, fulfilment flow এবং customer experience প্রমাণিত হওয়ার পর ধাপে ধাপে নতুন কমিউনিটিতে সম্প্রসারণ করা হবে।</p>
        </section>

        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2"><Link href="/faq" className="font-black underline">FAQ / প্রশ্নোত্তর →</Link><Link href="/terms" className="font-black underline">Terms & Conditions →</Link></div>
      </div>
      <PublicFooter />
    </main>
  )
}
