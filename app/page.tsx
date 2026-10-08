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
      <PublicHeader actionHref="/login" actionLabel="Sign in" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <section className="flex min-w-0 flex-col justify-center rounded-[28px] border border-black/10 bg-white p-6 sm:p-8 lg:min-h-[540px]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Community grocery pooling</p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">Buy together. Pay the real pool price. Keep the savings.</h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">Buy through Community Pools that combine household demand, or nearby Group Deals where verified neighbours unlock prices together. You see the relevant price before confirming a purchase.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link className="btn-primary" href="/signup">Join the community pool</Link><Link className="btn-secondary" href="/login">Sign in</Link></div>
            <div className="public-rule mt-8 rounded-2xl bg-black p-5 text-white"><p className="text-sm text-white/65">Our rule</p><p className="mt-1 text-xl font-black">No hidden order. No fake saving.</p></div>
          </section>
          <section className="flex min-w-0 flex-col overflow-hidden rounded-[28px] border border-black/10 bg-slate-50 lg:min-h-[540px]">
            <div className="flex flex-1 items-center justify-center p-4 sm:p-6"><img src="/grocery-hero-glass.svg" alt="Fresh grocery essentials in a community grocery basket" decoding="async" fetchPriority="high" className="h-full max-h-[460px] w-full rounded-2xl object-contain" /></div>
            <div className="border-t border-black/10 bg-white px-6 py-5 sm:px-8"><p className="public-essentials-heading font-black">Everyday essentials, pooled locally.</p><p className="muted mt-1">Start small with the products your community already buys every week.</p></div>
          </section>
        </div>

        <section className="mt-6 rounded-[28px] border border-black/10 bg-slate-50 p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">What is 2-TAKA-R-BAZAR?</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2"><p className="leading-7 text-slate-700">It is a community grocery-buying service with two models. Community Pools aggregate household quantity before pricing and confirmation. Group Deals let verified nearby neighbours unlock deal thresholds together. Verified product savings are recorded after successful fulfilment.</p><p className="leading-7 text-slate-700" lang="bn">এটি কমিউনিটি grocery buying-এর দুইটি মডেল ব্যবহার করে। Community Pool-এ পরিবারের প্রয়োজনীয় পরিমাণ আগে একত্র হয়, আর Group Deal-এ verified কাছাকাছি ক্রেতারা একসাথে price threshold unlock করে। সফল fulfilment-এর পর product saving যাচাই করা হয়।</p></div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-[28px] border border-black/10 bg-slate-50 p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Community Pools</p>
            <h2 className="mt-2 text-2xl font-black">Combine quantity before purchase.</h2>
            <p className="mt-3 leading-7 text-slate-700">Households commit what they need, pooled volume supports better supplier pricing, and the customer confirms only after the final price is published.</p>
          </article>
          <article className="rounded-[28px] border border-black/10 bg-slate-50 p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Group Deals</p>
            <h2 className="mt-2 text-2xl font-black">Verified neighbours unlock together.</h2>
            <p className="mt-3 leading-7 text-slate-700">Nearby verified buyers count toward deal thresholds without exposing exact household GPS locations. One verified person counts once toward the buyer unlock.</p>
          </article>
        </section>

        <section className="mt-6 rounded-[28px] border border-black/10 bg-slate-50 p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">How it works</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-5"><b>1. Join your community</b><p className="muted mt-2">Choose your local community. At purchase confirmation, select FREE community collection or optional home delivery.</p></div>
            <div className="rounded-2xl bg-white p-5"><b>2. Choose the buying mode</b><p className="muted mt-2">Use a Community Pool for pooled quantity or a Group Deal for verified-neighbour unlocks.</p></div>
            <div className="rounded-2xl bg-white p-5"><b>3. Confirm after price</b><p className="muted mt-2">A commitment becomes an order only after you accept the final price.</p></div>
            <div className="rounded-2xl bg-white p-5"><b>4. Verify the savings</b><p className="muted mt-2">Product savings are credited only after successful fulfilment; delivery is separate.</p></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2"><Link href="/about" className="font-black underline">About the model →</Link><Link href="/faq" className="font-black underline">Read FAQ / প্রশ্নোত্তর →</Link></div>
        </section>
      </div>
      <PublicFooter />
    </main>
  )
}
