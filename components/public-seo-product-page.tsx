import Link from 'next/link'
import {CustomerHeader as PublicHeader} from '@/components/customer-header'
import {CustomerFooter as PublicFooter} from '@/components/customer-footer'
import {publicShowcaseImageUrl} from '@/lib/showcase-media'
import {productUrls,productJsonLd,safeJsonLd,type ProductSeoPublic} from '@/lib/product-seo-public'
import {SITE_NAME} from '@/lib/site'

export function PublicSeoProductPage({product:p,locale}:{product:ProductSeoPublic;locale:'en'|'bn'}){
 const bn=locale==='bn',urls=productUrls(p.slug)
 const title=bn?p.title_bn:p.title_en
 const short=bn?p.short_bn:p.short_en
 const description=bn?p.description_bn:p.description_en
 const alt=bn?p.alt_bn:p.alt_en
 const faqs=(p.faqs??[]).map(f=>({question:bn?f.question_bn:f.question_en,answer:bn?f.answer_bn:f.answer_en}))
 const gallery=[p.image_url,...(p.media??[]).filter(m=>m.kind==='gallery').map(m=>m.url)].filter((s):s is string=>Boolean(s)&&publicShowcaseImageUrl(s!))
 const imageAlt=[alt,...(p.media??[]).filter(m=>m.kind==='gallery').map(m=>bn?m.alt_bn:m.alt_en)]
 return <main lang={locale==='bn'?'bn':'en'} className="public-marketplace-flat customer-page-shell min-h-screen bg-white text-slate-900">
  <PublicHeader actionHref="/login" actionLabel="Sign in"/>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(productJsonLd(p,locale))}}/>
  <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
   <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-sm">
    <Link href="/" className="underline">{bn?'হোম':'Home'}</Link><span aria-hidden="true">›</span><span>{title}</span>
   </nav>
   <div className="mb-6 flex flex-wrap gap-2 text-sm">
    <Link href={urls.en} hrefLang="en-BD" lang="en" className={'rounded-full border px-3 py-1 '+(!bn?'bg-teal-100 font-bold':'')}>EN</Link>
    <Link href={urls.bn} hrefLang="bn-BD" lang="bn" className={'rounded-full border px-3 py-1 '+(bn?'bg-teal-100 font-bold':'')}>বাংলা</Link>
   </div>
   <div className="grid gap-8 lg:grid-cols-2">
    <div className="min-w-0">
     {gallery.length?<>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-3">
       <img src={gallery[0]} alt={imageAlt[0]||title} className="mx-auto h-auto max-h-[480px] w-full object-contain" loading="eager"/>
      </div>
      {gallery.length>1&&<div className="mt-3 grid grid-cols-3 gap-2">{gallery.slice(1,7).map((url,i)=>
       <div key={url} className="overflow-hidden rounded-xl border border-slate-200 p-2"><img src={url} alt={imageAlt[i+1]||title} loading="lazy" className="h-28 w-full object-contain"/></div>)}</div>}
     </>:<div className="rounded-2xl border border-slate-200 p-6 text-sm">{bn?'পণ্যের ছবি শিগগিরই যুক্ত হবে':'A verified product photo is not yet available.'}</div>}
    </div>
    <div>
     <p className="text-sm font-semibold text-teal-700">{p.category}</p>
     <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">{title}</h1>
     <p className="mt-3 text-sm text-slate-600">{p.package_size} · {p.brand_type==='UNBRANDED_LOOSE'?(bn?'ব্র্যান্ডবিহীন':'Unbranded'):p.brand} · SKU {p.sku}</p>
     {short&&<p className="mt-5 text-lg leading-relaxed">{short}</p>}
     {description&&<section className="mt-6"><h2 className="text-lg font-bold">{bn?'পণ্যের বিবরণ':'Product details'}</h2><p className="mt-3 whitespace-pre-line leading-8 text-slate-700">{description}</p></section>}
     <div className="mt-7 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-slate-800">
      <b>{bn?'কমিউনিটিতে কেনাকাটা':'Community buying'}</b>
      <p className="mt-2">{bn?'এটি পণ্যের তথ্য পৃষ্ঠা। আপনার কমিউনিটিতে বর্তমান দাম, স্টক ও পুল বা গ্রুপ ডিলের প্রাপ্যতা যাচাই করুন।':'This is an informational product page. Check your community for currently approved prices, stock and Pool or Group Deal availability.'}</p>
      <Link href="/" className="mt-3 inline-block font-bold underline">{bn?'উপলব্ধ অফার দেখুন':'Browse current offers'} →</Link>
     </div>
    </div>
   </div>
   {Object.entries(p.specs??{}).filter(([,v])=>typeof v==='string'&&Boolean(v)).length>0&&
    <section className="mt-10"><h2 className="text-2xl font-bold">{bn?'পণ্যের বৈশিষ্ট্য':'Specifications'}</h2>
     <dl className="mt-4 grid gap-2 sm:grid-cols-2">{Object.entries(p.specs??{}).filter(([,v])=>typeof v==='string'&&Boolean(v)).map(([k,v])=>
      <div key={k} className="rounded-xl border border-slate-200 p-3"><dt className="text-sm font-semibold capitalize">{k.replaceAll('_',' ')}</dt><dd className="mt-1 text-slate-600">{v}</dd></div>)}</dl>
    </section>}
   {faqs.length>0&&<section className="mt-10"><h2 className="text-2xl font-bold">{bn?'সাধারণ প্রশ্নোত্তর':'Questions and answers'}</h2>
    <div className="mt-4 grid gap-3">{faqs.map((f,i)=><details key={i} className="rounded-xl border border-slate-200 p-4">
     <summary className="cursor-pointer font-semibold">{f.question}</summary><p className="mt-3 whitespace-pre-line leading-7 text-slate-700">{f.answer}</p>
    </details>)}</div>
   </section>}
   <footer className="mt-10 text-sm text-slate-500">{SITE_NAME} · {bn?'পণ্যের তথ্য পরিবর্তিত হতে পারে; কেনার আগে অফার যাচাই করুন।':'Information may change; confirm actual offer details before purchasing.'}</footer>
  </article>
  <PublicFooter/>
 </main>
}
