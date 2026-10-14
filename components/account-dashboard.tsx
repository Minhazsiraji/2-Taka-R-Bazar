'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {useStorefrontLanguage} from '@/lib/use-storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'

type Props={name:string;communityName:string;needsSetup:boolean;operations:boolean;superAdmin:boolean;pickup:boolean;initialLanguage:MarketplaceLanguage;hasLanguageCookie:boolean}
const tools=[
 {href:'/account/orders',icon:'▤',en:'Orders',bn:'অর্ডার',detail:'Track orders, collection and delivery.',detailBn:'অর্ডার, সংগ্রহ ও ডেলিভারি দেখুন।'},
 {href:'/cart',icon:'▣',en:'Cart & commitments',bn:'কার্ট ও প্রতিশ্রুতি',detail:'Review your basket and waiting commitments.',detailBn:'কার্ট ও অপেক্ষমাণ প্রতিশ্রুতি দেখুন।'},
 {href:'/account/addresses',icon:'⌖',en:'Addresses',bn:'ঠিকানা',detail:'Manage your delivery and pickup details.',detailBn:'ডেলিভারি ও সংগ্রহের ঠিকানা দেখুন।'},
 {href:'/profile',icon:'⌂',en:'Community & profile',bn:'কমিউনিটি ও প্রোফাইল',detail:'View your household and community details.',detailBn:'পরিবার ও কমিউনিটির তথ্য দেখুন।'},
 {href:'/account/savings',icon:'↗',en:'Savings report',bn:'সাশ্রয়ের রিপোর্ট',detail:'See verified savings from your purchases.',detailBn:'কেনাকাটার যাচাইকৃত সাশ্রয় দেখুন।'},
 {href:'/notifications',icon:'◉',en:'Notifications',bn:'বিজ্ঞপ্তি',detail:'Follow price unlocks and order updates.',detailBn:'দাম কমা ও অর্ডারের আপডেট দেখুন।'},
 {href:'/account/security',icon:'◇',en:'Login & security',bn:'লগইন ও নিরাপত্তা',detail:'Manage Google login and your password.',detailBn:'Google লগইন ও পাসওয়ার্ড পরিচালনা করুন।'},
 {href:'/faq',icon:'?',en:'Help & support',bn:'সহায়তা',detail:'Find answers and ways to contact us.',detailBn:'উত্তর ও যোগাযোগের তথ্য দেখুন।'},
]

export function AccountDashboard({name,communityName,needsSetup,operations,superAdmin,pickup,initialLanguage,hasLanguageCookie}:Props){
 const [language,setLanguage]=useStorefrontLanguage(initialLanguage,hasLanguageCookie)
 const router=useRouter()
 const t=(en:string,bn:string)=>language==='bn'?bn:en
 return <main className="public-marketplace-flat account-dashboard min-h-screen" lang={language}>
  <PublicHeader storefront shopBaseHref="/" browseHref="/#deals" language={language} onLanguageChange={next=>{setLanguage(next);router.refresh()}}
   locationLabel={communityName||t('Your community','আপনার কমিউনিটি')} locationAriaLabel={t('View your community profile','আপনার কমিউনিটির প্রোফাইল দেখুন')}
   onLocationClick={()=>router.push('/profile')} actionHref="/" actionLabel={t('Back to shopping','কেনাকাটায় ফিরুন')}/>
  <section className="market-band account-dashboard-band"><div className="market-content">
   <div className="account-dashboard-intro">
    <div><span className="account-dashboard-kicker">{t('Your 2TBR account','আপনার 2TBR অ্যাকাউন্ট')}</span>
     <h1>{t('My dashboard','আমার ড্যাশবোর্ড')}</h1>
     <p>{name?t('Welcome back, ','স্বাগতম, ')+name:t('Your shopping and household tools, together.','কেনাকাটা ও পরিবারের প্রয়োজনীয় টুল, একসাথে।')}</p>
    </div><Link href="/#deals" className="btn-secondary">{t('Explore current offers →','বর্তমান অফার দেখুন →')}</Link>
   </div>
   {needsSetup&&<div className="account-setup-notice"><p>{t('Complete your household details to use community and money tools.','কমিউনিটি ও অর্থের টুল ব্যবহার করতে পরিবারের তথ্য পূরণ করুন।')}</p><Link href="/onboarding" className="btn-secondary">{t('Complete setup','তথ্য পূরণ করুন')}</Link></div>}
   <Link href="/money" className="account-money-card" aria-label={t('Open My Money','আমার অর্থ খুলুন')}>
    <span className="account-tool-icon" aria-hidden="true">৳</span>
    <div><span className="account-dashboard-kicker">{t('Household finances','পরিবারের হিসাব')}</span><h2>{t('My Money','আমার অর্থ')}</h2>
     <p>{t('Track income, expenses, accounts, budgets and reports in one place.','আয়, ব্যয়, অ্যাকাউন্ট, বাজেট ও রিপোর্ট এক জায়গায় দেখুন।')}</p>
     <span className="account-money-action">{t('Open My Money →','আমার অর্থ খুলুন →')}</span>
    </div>
   </Link>
   <section aria-labelledby="account-tools-title" className="account-tools-section">
    <h2 id="account-tools-title">{t('Shopping & account','কেনাকাটা ও অ্যাকাউন্ট')}</h2>
    <div className="account-tools-grid">{tools.map(tool=><Link key={tool.href} href={tool.href} className="account-tool-card">
     <span className="account-tool-icon" aria-hidden="true">{tool.icon}</span><div><h3>{t(tool.en,tool.bn)}</h3><p>{t(tool.detail,tool.detailBn)}</p></div><span className="account-tool-arrow" aria-hidden="true">↗</span>
    </Link>)}</div>
    <p className="account-savings-note">{t('Shopping savings are a report, not a wallet balance.','কেনাকাটার সাশ্রয় একটি রিপোর্ট, ওয়ালেটের ব্যালেন্স নয়।')}</p>
   </section>
   {(operations||superAdmin||pickup)&&<section className="account-tools-section" aria-labelledby="staff-tools-title">
    <h2 id="staff-tools-title">{t('Staff tools','কর্মীদের টুল')}</h2><div className="account-staff-links">
     {operations&&<Link href="/admin" className="btn-secondary">{t('Operations','অপারেশনস')}</Link>}
     {pickup&&<Link href="/community-ops" className="btn-secondary">{t('Community operations','কমিউনিটি অপারেশনস')}</Link>}
     {superAdmin&&<Link href="/super-admin" className="btn-secondary">{t('Super Admin','সুপার অ্যাডমিন')}</Link>}
    </div>
   </section>}
  </div></section>
  <PublicFooter storefront language={language} shopBaseHref="/" activeHref="/account"/>
 </main>
}
