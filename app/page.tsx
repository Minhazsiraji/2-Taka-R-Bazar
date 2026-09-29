import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PublicHeader } from '@/components/public-header'
import { PublicFooter } from '@/components/public-footer'
import { PILOT_AREA, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: claimsResult } = await supabase.auth.getClaims()
  if (claimsResult?.claims?.sub) redirect('/home')
  const schema={"@context":"https://schema.org","@graph":[
    {"@type":"Organization","@id":`${SITE_URL}/#organization`,name:SITE_NAME,url:SITE_URL,description:SITE_DESCRIPTION},
    {"@type":"WebSite","@id":`${SITE_URL}/#website`,url:SITE_URL,name:SITE_NAME,publisher:{"@id":`${SITE_URL}/#organization`},inLanguage:['en-BD','bn-BD']},
    {"@type":"Service","@id":`${SITE_URL}/#service`,name:'Community grocery pooling',provider:{"@id":`${SITE_URL}/#organization`},areaServed:PILOT_AREA,description:SITE_DESCRIPTION}
  ]}
  return (
    <main className="min-h-screen bg-white text-black">
      <PublicHeader actionHref="/login" actionLabel="Sign in" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}} />
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <section className="flex min-w-0 flex-col justify-center rounded-[28px] border border-black/10 bg-white p-6 sm:p-8 lg:min-h-[540px]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Community grocery pooling</p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">Buy together. Pay the real pool price. Keep the savings.</h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">Your community combines demand first. We compare local market prices and supplier offers, publish the final price, and you decide whether to confirm.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link className="btn-primary" href="/signup">Join the community pool</Link><Link className="btn-secondary" href="/login">Sign in</Link></div>
            <div className="mt-8 rounded-2xl bg-black p-5 text-white"><p className="text-sm text-white/65">Our rule</p><p className="mt-1 text-xl font-black">No hidden order. No fake saving.</p></div>
          </section>
          <section className="flex min-w-0 flex-col overflow-hidden rounded-[28px] border border-black/10 bg-slate-50 lg:min-h-[540px]">
            <div className="flex flex-1 items-center justify-center p-4 sm:p-6"><img src="/grocery-hero.svg" alt="Fresh grocery essentials including rice, cooking oil, milk, eggs, bread, fruit and vegetables" decoding="async" fetchPriority="high" className="h-full max-h-[460px] w-full rounded-2xl object-contain" /></div>
            <div className="border-t border-black/10 bg-white px-6 py-5 sm:px-8"><p className="font-black">Everyday essentials, pooled locally.</p><p className="muted mt-1">Start small with the products your community already buys every week.</p></div>
          </section>
        </div>

        <section className="mt-6 rounded-[28px] border border-black/10 bg-slate-50 p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">What is 2-TAKA-R-BAZAR?</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2"><p className="leading-7 text-slate-700">It is a community procurement service: households pool grocery demand first, suppliers quote against the volume, customers confirm only after the final price is published, and verified savings are recorded after pickup.</p><p className="leading-7 text-slate-700" lang="bn">এটি একটি কমিউনিটি procurement সেবা: পরিবারের বাজারের চাহিদা আগে একত্র হয়, মোট পরিমাণ অনুযায়ী supplier দর দেয়, চূড়ান্ত দাম প্রকাশের পর গ্রাহক ক্রয় নিশ্চিত করেন, এবং পিকআপের পর যাচাইকৃত সাশ্রয় রেকর্ড হয়।</p></div>
        </section>

        <section className="mt-6 rounded-[28px] border border-black/10 bg-slate-50 p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">How it works</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-5"><b>1. Join your community</b><p className="muted mt-2">Choose your local community and pickup point.</p></div>
            <div className="rounded-2xl bg-white p-5"><b>2. Pool the demand</b><p className="muted mt-2">Households commit quantity before buying.</p></div>
            <div className="rounded-2xl bg-white p-5"><b>3. Confirm after price</b><p className="muted mt-2">A commitment becomes an order only after you accept the final price.</p></div>
            <div className="rounded-2xl bg-white p-5"><b>4. Verify the savings</b><p className="muted mt-2">Savings are credited only after collection.</p></div>
          </div>
          <div className="mt-6"><Link href="/faq" className="font-black underline">Read FAQ / প্রশ্নোত্তর →</Link></div>
        </section>
      </div>
      <PublicFooter />
    </main>
  )
}
