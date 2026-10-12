import Link from 'next/link'
import {BrandLogo} from '@/components/brand-logo'
import {LEGAL_LINKS} from '@/lib/legal'
import {BUSINESS_CONTACT_EMAIL,SUPPORT_CONTACT_EMAIL,SITE_TAGLINE_BN,SITE_TAGLINE_EN} from '@/lib/site'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'

export function StorefrontFooter({language='bn'}:{language?:MarketplaceLanguage}){
 const t=(en:string,bn:string)=>chooseText(language,en,bn)
 return <><footer className="market-information-footer" lang={language}>
  <div className="market-content market-footer-information">
   <div className="market-footer-brand"><BrandLogo size={44}/><div><strong>2-TAKA-R-BAZAR</strong><p>{t(SITE_TAGLINE_EN,SITE_TAGLINE_BN)}</p></div></div>
   <nav aria-label={t('About and shopping help','পরিচিতি ও কেনাকাটার সহায়তা')}><h2>{t('Explore & get help','পরিচিতি ও সহায়তা')}</h2>
    <Link href="/about">{t('About 2TBR','2TBR পরিচিতি')}</Link><Link href="/faq">{t('FAQ','প্রশ্নোত্তর')}</Link>
    <a href="#how-it-works">{t('How it works','যেভাবে কাজ করে')}</a><a href="#why-2tbr">{t('Pickup & delivery','সংগ্রহ ও ডেলিভারি')}</a><a href="#our-communities">{t('Our communities','আমাদের কমিউনিটি')}</a>
   </nav>
   <nav aria-label={t('Terms and policies','শর্তাবলি ও নীতিমালা')}><h2>{t('Terms & policies','শর্তাবলি ও নীতিমালা')}</h2>
    {LEGAL_LINKS.filter(([href])=>href!=='/about'&&href!=='/faq').map(([href,en,bn])=><Link key={href} href={href}>{t(en,bn)}</Link>)}
   </nav>
   <div className="market-footer-contact"><h2>{t('Contact us','যোগাযোগ করুন')}</h2><p>{t('For business and supplier enquiries','ব্যবসা ও সরবরাহকারী সংক্রান্ত যোগাযোগ')}</p>
    <a href={`mailto:${BUSINESS_CONTACT_EMAIL}`}>{BUSINESS_CONTACT_EMAIL}</a>
    <p>{t('For customer support','গ্রাহক সহায়তার জন্য')}</p><a href={`mailto:${SUPPORT_CONTACT_EMAIL}`}>{SUPPORT_CONTACT_EMAIL}</a>
    <a href="#supplier-network">{t('Become a supply partner →','সরবরাহকারী হতে যোগাযোগ করুন →')}</a>
   </div>
  </div>
  <div className="market-content market-footer-credits">© 2026 2-TAKA-R-BAZAR · {t('Developed by','তৈরি করেছেন')}: <a href="https://agentsiraji.com" target="_blank" rel="noreferrer">agentsiraji.com</a>
   <div className="market-footer-developer-contact">{t('Contact','যোগাযোগ')}: <a href="mailto:business@agentsiraji.com">Business@agentsiraji.com</a></div>
  </div>
 </footer>
  <nav className="app-mobile-nav market-storefront-dock" aria-label={t('Shopping navigation','কেনাকাটার নেভিগেশন')} lang={language}>
   <div className="app-mobile-nav-inner">
   {[
    ['/', 'Home','হোম'],['/pool','Pools','পুল'],['/group-deals','Deals','ডিল'],['/orders','Orders','অর্ডার'],['/savings','Savings','সাশ্রয়'],
   ].map(([href,en,bn])=><Link className={'app-mobile-nav-link'+(href==='/'?' is-active':'')} key={href} href={href} aria-current={href==='/'?'page':undefined}><span>{t(en,bn)}</span></Link>)}
   </div>
  </nav>
 </>
}
