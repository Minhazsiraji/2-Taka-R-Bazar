import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public-header'
import { PublicFooter } from '@/components/public-footer'
import { PILOT_AREA, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'About the Community Grocery Pooling Model',
  description: `How ${SITE_NAME} combines community demand, supplier negotiation, final-price confirmation, local pickup and verified savings in Savar, Bangladesh.`,
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
    about: { '@id': `${SITE_URL}/#organization` },
    mainEntity: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/brand-logo-header.png`,
      description: SITE_DESCRIPTION,
      areaServed: { '@type': 'Place', name: PILOT_AREA },
    },
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <PublicHeader actionHref="/" actionLabel="Home" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">About {SITE_NAME}</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Community demand first. Final price before purchase.</h1>
        <p className="mt-4 text-lg leading-8 text-slate-700">{SITE_NAME} is a community grocery-pooling service designed to help nearby households combine demand, negotiate against real volume, and see the final customer price before deciding whether to buy.</p>
        <p className="mt-4 leading-7 text-slate-700" lang="bn">{SITE_NAME} একটি কমিউনিটি গ্রোসারি-পুলিং সেবা। কাছাকাছি পরিবারের বাজারের চাহিদা একত্র করে মোট পরিমাণ অনুযায়ী সরবরাহকারীর দর নেওয়া হয়, এবং চূড়ান্ত গ্রাহক মূল্য প্রকাশের পর প্রত্যেকে কিনবেন কি না তা সিদ্ধান্ত নেন।</p>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">What joining a pool means</h2><p className="mt-2 leading-7 text-slate-700">Joining records demand. It is not a purchase. A customer order is created only after the final price is published and the customer explicitly confirms.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">How price improvement works</h2><p className="mt-2 leading-7 text-slate-700">More community demand can unlock better pricing tiers. Final supplier negotiation may keep or improve the earned customer price ceiling; it should not make that earned ceiling worse.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">How pickup works</h2><p className="mt-2 leading-7 text-slate-700">Suppliers deliver consolidated goods to the designated community receiving point. Operations verifies receipt before customers collect from the enabled pickup point.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">How savings are verified</h2><p className="mt-2 leading-7 text-slate-700">Savings compare an approved local-market benchmark with the final customer price. Savings become verified only after successful collection.</p></article>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-black">Current pilot area</h2>
          <p className="mt-2 leading-7 text-slate-700">The controlled pilot is focused on {PILOT_AREA}. Expansion should follow only after the operating model, supplier process, pickup flow and customer experience are proven.</p>
          <p className="mt-3 leading-7 text-slate-700" lang="bn">বর্তমান নিয়ন্ত্রিত পাইলট {PILOT_AREA}-এ কেন্দ্রীভূত। অপারেশন, supplier process, pickup flow এবং customer experience প্রমাণিত হওয়ার পর ধাপে ধাপে নতুন কমিউনিটিতে সম্প্রসারণ করা হবে।</p>
        </section>

        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2"><Link href="/faq" className="font-black underline">FAQ / প্রশ্নোত্তর →</Link><Link href="/terms" className="font-black underline">Terms & Conditions →</Link></div>
      </div>
      <PublicFooter />
    </main>
  )
}
