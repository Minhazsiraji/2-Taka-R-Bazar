import type { Metadata } from 'next'
import { PolicyPage } from '@/components/policy-page'
import { SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Privacy Policy | গোপনীয়তা নীতি',
  description: 'Bilingual Privacy Policy explaining how 2-TAKA-R-BAZAR handles account, community, order, fulfilment and usage information.',
  alternates: { canonical: `${SITE_URL}/privacy` },
}

const sections = [
  {
    titleEn: 'Information we may process',
    titleBn: 'আমরা কোন তথ্য প্রক্রিয়া করতে পারি',
    bodyEn: <p>Depending on the feature you use, the platform may process your mobile number, account identifiers, selected community, order or commitment details, fulfilment information, referral activity, issue reports and technical usage information needed to operate and secure the service.</p>,
    bodyBn: <p>আপনি কোন feature ব্যবহার করছেন তার ওপর ভিত্তি করে platform আপনার mobile number, account identifier, নির্বাচিত community, order বা commitment-এর তথ্য, fulfilment information, referral activity, issue report এবং service চালানো ও নিরাপদ রাখার জন্য প্রয়োজনীয় technical usage information প্রক্রিয়া করতে পারে।</p>,
  },
  {
    titleEn: 'Why we use information',
    titleBn: 'তথ্য কেন ব্যবহার করা হয়',
    bodyEn: <p>We use information to verify accounts, place households in the correct community, run Community Pools and Group Deals, calculate qualified demand, support fulfilment, prevent abuse, resolve issues, improve the service and meet operational or legal obligations.</p>,
    bodyBn: <p>Account verify করা, সঠিক community-তে household যুক্ত করা, Community Pool ও Group Deal চালানো, qualified demand হিসাব করা, fulfilment support, abuse প্রতিরোধ, সমস্যা সমাধান, service উন্নত করা এবং প্রযোজ্য operational বা legal obligation পূরণের জন্য তথ্য ব্যবহার করা হয়।</p>,
  },
  {
    titleEn: 'Community and location privacy',
    titleBn: 'কমিউনিটি ও লোকেশন গোপনীয়তা',
    bodyEn: <p>Community assignment and nearby-deal features may use location-related information where enabled. Exact household GPS coordinates should not be exposed to other households or ordinary supplier-facing views. Supplier-facing demand is designed to be aggregated or privacy-qualified rather than showing an individual household's exact location or basket.</p>,
    bodyBn: <p>Community assignment এবং nearby-deal feature-এ প্রয়োজন হলে location-related information ব্যবহার হতে পারে। Exact household GPS অন্য household বা সাধারণ supplier-facing view-এ দেখানো উচিত নয়। Supplier-facing demand individual household-এর exact location বা basket দেখানোর বদলে aggregate বা privacy-qualified আকারে দেখানোর জন্য ডিজাইন করা হয়েছে।</p>,
  },
  {
    titleEn: 'Login and account security',
    titleBn: 'লগইন ও অ্যাকাউন্ট নিরাপত্তা',
    bodyEn: <p>Accounts use Google sign-in or a mobile number and password. Google supplies identity information such as your email; mobile contact numbers are not proof of phone ownership. Never share your password with another person. We may keep security logs and technical records needed to detect misuse, investigate incidents and protect accounts.</p>,
    bodyBn: <p>Google অথবা মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে সাইন ইন করা হয়। Google পরিচয়ের তথ্য দেয়, যেমন ইমেইল; মোবাইল যোগাযোগ নম্বর ফোনের মালিকানার প্রমাণ নয়। আপনার পাসওয়ার্ড অন্য কারও সাথে শেয়ার করবেন না। Misuse শনাক্ত করা, incident তদন্ত করা এবং account সুরক্ষিত রাখার জন্য প্রয়োজনীয় security log ও technical record রাখা হতে পারে।</p>,
  },
  {
    titleEn: 'Sharing and service providers',
    titleBn: 'তথ্য শেয়ার ও সেবা প্রদানকারী',
    bodyEn: <p>Information may be processed by service providers that help operate hosting, authentication, communications, analytics, payments or other platform functions. We do not intend supplier-facing workflows to expose more household-level information than is necessary for the relevant operational task.</p>,
    bodyBn: <p>Hosting, authentication, communication, analytics, payment বা অন্যান্য platform function চালাতে সহায়তাকারী service provider তথ্য প্রক্রিয়া করতে পারে। Supplier-facing workflow-এ সংশ্লিষ্ট operational কাজের জন্য যতটুকু household-level information প্রয়োজন তার বেশি দেখানো আমাদের উদ্দেশ্য নয়।</p>,
  },
  {
    titleEn: 'Optional analytics and advertising measurement',
    titleBn: 'ঐচ্ছিক অ্যানালিটিক্স ও বিজ্ঞাপনের পরিমাপ',
    bodyEn: <p>We only load optional Google Analytics 4 or Meta Pixel measurement after you actively choose the relevant consent. You can choose analytics only, allow analytics and marketing, or reject both. We use aggregated shopping activity to improve the service and measure promotions; we do not intentionally transmit passwords, phone numbers, precise locations, payment credentials or delivery addresses in analytics events. You can reopen Privacy choices to change or withdraw your decision. Essential account, security and order processing do not depend on optional tracking.</p>,
    bodyBn: <p>আপনার স্পষ্ট অনুমতি ছাড়া Google Analytics 4 বা Meta Pixel-এর ঐচ্ছিক ট্র্যাকিং চালু করা হয় না। আপনি শুধু অ্যানালিটিক্স অনুমোদন, অ্যানালিটিক্স ও মার্কেটিং উভয় অনুমোদন, অথবা উভয় প্রত্যাখ্যান করতে পারেন। সেবার উন্নয়ন ও প্রচারণার ফল বুঝতে সামগ্রিক কেনাকাটার তথ্য ব্যবহৃত হতে পারে; অ্যানালিটিক্স ইভেন্টে পাসওয়ার্ড, ফোন নম্বর, নির্ভুল অবস্থান, পেমেন্ট তথ্য বা ডেলিভারির ঠিকানা ইচ্ছাকৃতভাবে পাঠানো হয় না। Privacy choices থেকে সিদ্ধান্ত পরিবর্তন বা প্রত্যাহার করা যাবে। অপরিহার্য নিরাপত্তা ও অর্ডার কার্যক্রম ঐচ্ছিক ট্র্যাকিংয়ের উপর নির্ভর করে না।</p>,
  },
  {
    titleEn: 'Retention and account records',
    titleBn: 'তথ্য সংরক্ষণ ও অ্যাকাউন্ট রেকর্ড',
    bodyEn: <p>Different records may need different retention periods for operations, accounting, fraud prevention, dispute handling, security and legal compliance. We aim to keep information only for as long as it remains reasonably needed for those purposes.</p>,
    bodyBn: <p>Operation, accounting, fraud prevention, dispute handling, security এবং legal compliance-এর জন্য বিভিন্ন record ভিন্ন সময় পর্যন্ত রাখতে হতে পারে। এসব উদ্দেশ্যে যতদিন যুক্তিসঙ্গতভাবে প্রয়োজন ততদিনই তথ্য রাখার লক্ষ্য থাকে।</p>,
  },
  {
    titleEn: 'Your choices and support',
    titleBn: 'আপনার পছন্দ ও সহায়তা',
    bodyEn: <p>You can update relevant profile or fulfilment information through available account controls. For privacy questions, corrections or account-related requests, use the official in-app support flow or contact business@agentsiraji.com.</p>,
    bodyBn: <p>Available account control ব্যবহার করে প্রাসঙ্গিক profile বা fulfilment information update করতে পারেন। Privacy question, correction বা account-related request-এর জন্য official in-app support flow ব্যবহার করুন অথবা business@agentsiraji.com-এ যোগাযোগ করুন।</p>,
  },
]

export default function PrivacyPage(){
  return <PolicyPage
    titleEn="Privacy Policy"
    titleBn="গোপনীয়তা নীতি"
    summaryEn="This policy explains what information the platform may process, why it is used, and how community, account and fulfilment information is handled."
    summaryBn="এই নীতিতে platform কোন তথ্য প্রক্রিয়া করতে পারে, কেন ব্যবহার করা হয় এবং community, account ও fulfilment information কীভাবে পরিচালিত হয় তা ব্যাখ্যা করা হয়েছে।"
    sections={sections}
  />
}
