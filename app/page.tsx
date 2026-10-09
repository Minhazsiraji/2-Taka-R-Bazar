import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PublicHeader } from '@/components/public-header'
import { PublicFooter } from '@/components/public-footer'
import { PILOT_AREA, PUBLIC_CONTACT_EMAIL, SEO_UPDATED_AT, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE_EN, SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} | ${SITE_TAGLINE_EN}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: SITE_URL },
}

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: claimsResult } = await supabase.auth.getClaims()
  if (claimsResult?.claims?.sub) redirect('/home')

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/brand-logo-header.png`,
        description: SITE_DESCRIPTION,
        slogan: SITE_TAGLINE_EN,
        email: PUBLIC_CONTACT_EMAIL,
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer service',
          email: PUBLIC_CONTACT_EMAIL,
          availableLanguage: ['English', 'Bangla'],
        },
        areaServed: {
          '@type': 'Place',
          name: PILOT_AREA,
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: ['en-BD', 'bn-BD'],
      },
      {
        '@type': 'ImageObject',
        '@id': `${SITE_URL}/#primaryimage`,
        contentUrl: `${SITE_URL}/grocery-hero-glass.svg`,
        caption: 'Everyday grocery essentials pooled locally through 2-TAKA-R-BAZAR',
        representativeOfPage: true,
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/#webpage`,
        url: SITE_URL,
        name: `${SITE_NAME} | ${SITE_TAGLINE_EN}`,
        description: SITE_DESCRIPTION,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#service` },
        primaryImageOfPage: { '@id': `${SITE_URL}/#primaryimage` },
        dateModified: SEO_UPDATED_AT,
        inLanguage: ['en-BD', 'bn-BD'],
      },
      {
        '@type': 'Service',
        '@id': `${SITE_URL}/#service`,
        name: 'Community grocery buying',
        provider: { '@id': `${SITE_URL}/#organization` },
        areaServed: { '@type': 'Place', name: PILOT_AREA },
        audience: { '@type': 'Audience', audienceType: 'Smart, modern households and community grocery buyers' },
        serviceType: 'Community Pools and nearby Group Deals',
        availableChannel: { '@type': 'ServiceChannel', serviceUrl: SITE_URL },
        description: SITE_DESCRIPTION,
      },
    ],
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <PublicHeader actionHref="/login" actionLabel="Sign in" actionLabelBn="সাইন ইন" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <section className="flex min-w-0 flex-col justify-center rounded-[28px] border border-black/10 bg-white p-6 sm:p-8 lg:min-h-[540px]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Community grocery pooling</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500" lang="bn">কমিউনিটি গ্রোসারি পুলিং</p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">Buy together. Pay the real pool price. Keep the savings.</h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600" lang="bn">একসাথে কিনুন। পুলের আসল দাম দিন। সাশ্রয় নিজের কাছে রাখুন।</p>
            <p className="mt-5 text-lg leading-8 text-slate-600">Buy through Community Pools that combine household demand, or nearby Group Deals where verified neighbours unlock prices together. You see the relevant price before confirming a purchase.</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-500 sm:text-sm" lang="bn">Community Pool-এ পরিবারের চাহিদা একত্র হয়, আর Group Deal-এ কাছাকাছি verified প্রতিবেশীরা একসাথে দাম unlock করেন। কেনার আগে আপনি সংশ্লিষ্ট চূড়ান্ত দাম দেখতে পারবেন।</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link className="btn-primary text-center" href="/signup"><span className="block">Join the community pool</span><span className="block text-[11px] font-medium" lang="bn">কমিউনিটি পুলে যোগ দিন</span></Link><Link className="btn-secondary text-center" href="/login"><span className="block">Sign in</span><span className="block text-[11px] font-medium text-slate-500" lang="bn">সাইন ইন</span></Link></div>
            <div className="public-rule mt-8 rounded-2xl bg-black p-5 text-white"><p className="text-sm text-white/65">Our rule</p><p className="text-[11px] text-white/55" lang="bn">আমাদের নীতি</p><p className="mt-1 text-xl font-black">No hidden order. No fake saving.</p><p className="mt-1 text-[13px] text-white/75" lang="bn">গোপন অর্ডার নয়। ভুয়া সাশ্রয় নয়।</p></div>
          </section>
          <section className="flex min-w-0 flex-col overflow-hidden rounded-[28px] border border-black/10 bg-slate-50 lg:min-h-[540px]">
            <div className="flex flex-1 items-center justify-center p-4 sm:p-6"><img src="/grocery-hero-glass.svg" alt="Fresh grocery essentials in a community grocery basket" decoding="async" fetchPriority="high" className="h-full max-h-[460px] w-full rounded-2xl object-contain" /></div>
            <div className="border-t border-black/10 bg-white px-6 py-5 sm:px-8"><p className="public-essentials-heading font-black">Everyday essentials, pooled locally.</p><p className="mt-1 text-[12px] font-semibold text-slate-500" lang="bn">প্রতিদিনের প্রয়োজনীয় পণ্য, স্থানীয়ভাবে একসাথে কেনা।</p><p className="muted mt-2">Start small with the products your community already buys every week.</p><p className="mt-1 text-[12px] leading-5 text-slate-500" lang="bn">শুরু করুন সেই পণ্য দিয়ে, যেগুলো আপনার কমিউনিটি প্রতি সপ্তাহেই কেনে।</p></div>
          </section>
        </div>

        <section className="mt-6 rounded-[28px] border border-black/10 bg-slate-50 p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">What is 2-TAKA-R-BAZAR?</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500" lang="bn">2-TAKA-R-BAZAR কী?</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2"><p className="leading-7 text-slate-700">It is a community grocery-buying service with two models. Community Pools aggregate household quantity before pricing and confirmation. Group Deals let verified nearby neighbours unlock deal thresholds together. Verified product savings are recorded after successful fulfilment.</p><p className="leading-7 text-slate-700" lang="bn">এটি কমিউনিটি grocery buying-এর দুইটি মডেল ব্যবহার করে। Community Pool-এ পরিবারের প্রয়োজনীয় পরিমাণ আগে একত্র হয়, আর Group Deal-এ verified কাছাকাছি ক্রেতারা একসাথে price threshold unlock করে। সফল fulfilment-এর পর product saving যাচাই করা হয়।</p></div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-[28px] border border-black/10 bg-slate-50 p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Community Pools</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500" lang="bn">কমিউনিটি পুল</p>
            <h2 className="mt-2 text-2xl font-black">Combine quantity before purchase.</h2>
            <p className="mt-1 text-[13px] font-semibold leading-6 text-slate-600" lang="bn">কেনার আগে প্রয়োজনীয় পরিমাণ একত্র করুন।</p>
            <p className="mt-3 leading-7 text-slate-700">Households commit what they need, pooled volume supports better supplier pricing, and the customer confirms only after the final price is published.</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-500" lang="bn">পরিবারগুলো প্রয়োজনীয় পরিমাণ জানায়, মোট ভলিউম ভালো supplier price পেতে সাহায্য করে, এবং final price প্রকাশের পরই customer purchase confirm করেন।</p>
          </article>
          <article className="rounded-[28px] border border-black/10 bg-slate-50 p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Group Deals</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500" lang="bn">গ্রুপ ডিল</p>
            <h2 className="mt-2 text-2xl font-black">Verified neighbours unlock together.</h2>
            <p className="mt-1 text-[13px] font-semibold leading-6 text-slate-600" lang="bn">Verified প্রতিবেশীরা একসাথে দাম unlock করেন।</p>
            <p className="mt-3 leading-7 text-slate-700">Nearby verified buyers count toward deal thresholds without exposing exact household GPS locations. One verified person counts once toward the buyer unlock.</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-500" lang="bn">কাছাকাছি verified buyers deal threshold পূরণে গণনা হন, কিন্তু exact household GPS প্রকাশ করা হয় না। একজন verified ব্যক্তি buyer threshold-এ একবারই গণনা হন।</p>
          </article>
        </section>

        <section className="mt-6 rounded-[28px] border border-black/10 bg-slate-50 p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">How it works</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500" lang="bn">কীভাবে কাজ করে</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-5"><b>1. Join your community</b><p className="mt-1 text-[12px] font-semibold text-slate-500" lang="bn">১. আপনার কমিউনিটিতে যোগ দিন</p><p className="muted mt-2">Choose your local community. At purchase confirmation, select FREE community collection or optional home delivery.</p><p className="mt-1 text-[12px] leading-5 text-slate-500" lang="bn">আপনার স্থানীয় কমিউনিটি বেছে নিন। Purchase confirm করার সময় FREE community collection অথবা optional home delivery নির্বাচন করুন।</p></div>
            <div className="rounded-2xl bg-white p-5"><b>2. Choose the buying mode</b><p className="mt-1 text-[12px] font-semibold text-slate-500" lang="bn">২. কেনার পদ্ধতি বেছে নিন</p><p className="muted mt-2">Use a Community Pool for pooled quantity or a Group Deal for verified-neighbour unlocks.</p><p className="mt-1 text-[12px] leading-5 text-slate-500" lang="bn">পরিমাণ একত্র করতে Community Pool অথবা verified-neighbour price unlock-এর জন্য Group Deal ব্যবহার করুন।</p></div>
            <div className="rounded-2xl bg-white p-5"><b>3. Confirm after price</b><p className="mt-1 text-[12px] font-semibold text-slate-500" lang="bn">৩. দাম দেখে নিশ্চিত করুন</p><p className="muted mt-2">A commitment becomes an order only after you accept the final price.</p><p className="mt-1 text-[12px] leading-5 text-slate-500" lang="bn">Final price গ্রহণ করার পরই commitment একটি order-এ পরিণত হয়।</p></div>
            <div className="rounded-2xl bg-white p-5"><b>4. Verify the savings</b><p className="mt-1 text-[12px] font-semibold text-slate-500" lang="bn">৪. সাশ্রয় যাচাই করুন</p><p className="muted mt-2">Product savings are credited only after successful fulfilment; delivery is separate.</p><p className="mt-1 text-[12px] leading-5 text-slate-500" lang="bn">Successful fulfilment-এর পর product saving যোগ হয়; delivery charge আলাদা।</p></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2"><Link href="/about" className="font-black underline"><span>About the model →</span><span className="ml-1 text-[12px] font-semibold text-slate-500" lang="bn">মডেল সম্পর্কে</span></Link><Link href="/faq" className="font-black underline"><span>Read FAQ →</span><span className="ml-1 text-[12px] font-semibold text-slate-500" lang="bn">প্রশ্নোত্তর</span></Link></div>
        </section>
      </div>
      <PublicFooter />
    </main>
  )
}
