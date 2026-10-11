import type {StorefrontOffer} from '@/lib/storefront'

export type FeaturedPoolKind='weekly'|'monthly'|'special'
export type DemoFeaturedPool={
 slug:FeaturedPoolKind
 title:{en:string;bn:string}
 subtitle:{en:string;bn:string}
 description:{en:string;bn:string}
 image:string
 bundle: {offer:StorefrontOffer;qty:number}[]
 minHouseholds:number
 sampleHouseholds:number
 collection:{en:string;bn:string}
 isDemo:true
}
export function getDemoFeaturedPools(offers:StorefrontOffer[]):DemoFeaturedPool[]{
 const item=(id:string,qty:number)=>{
  const offer=offers.find(x=>x.product_id.endsWith(id))
  return offer?{offer,qty}:null
 }
 const pack=(items:(ReturnType<typeof item>)[])=>items.filter((x):x is NonNullable<typeof x>=>Boolean(x))
 return [
  {slug:'weekly',title:{en:'Weekly Essentials Pool',bn:'সাপ্তাহিক বাজার পুল'},
   subtitle:{en:'Groceries for the coming week',bn:'সপ্তাহের নিত্যপ্রয়োজনীয় বাজার'},
   description:{en:'Illustrative weekly grocery basket. Review item prices and quantities before any future real Pool opens.',bn:'সাপ্তাহিক বাজারের নমুনা পুল। বাস্তব পুল চালুর আগে এখানে পণ্য, দাম ও পরিমাণের ডিজাইন দেখুন।'},
   image:'/demo-products/rice.svg',bundle:pack([item('0101',1),item('0102',1),item('0103',2)]),
   minHouseholds:20,sampleHouseholds:8,collection:{en:'Community pickup (when enabled)',bn:'কমিউনিটি সংগ্রহ পয়েন্ট (চালু হলে)'},isDemo:true},
  {slug:'monthly',title:{en:'Monthly Family Basket',bn:'মাসিক পরিবার বাজার পুল'},
   subtitle:{en:'Plan household essentials together',bn:'পরিবারের মাসিক প্রয়োজন একসাথে'},
   description:{en:'Illustrative monthly basket for community buying. All prices and participation counts are sample numbers.',bn:'কমিউনিটি কেনাকাটার মাসিক নমুনা বাজার। দাম ও অংশগ্রহণের সব সংখ্যা কাল্পনিক।'},
   image:'/demo-products/oil.svg',bundle:pack([item('0101',2),item('0102',2),item('0103',2),item('0104',2),item('0105',2),item('0106',1)]),
   minHouseholds:50,sampleHouseholds:18,collection:{en:'Community pickup (when enabled)',bn:'কমিউনিটি সংগ্রহ পয়েন্ট (চালু হলে)'},isDemo:true},
  {slug:'special',title:{en:'Special Savings Pool',bn:'বিশেষ সাশ্রয় পুল'},
   subtitle:{en:'Selected products for a future offer',bn:'ভবিষ্যৎ বিশেষ অফারের নির্বাচিত পণ্য'},
   description:{en:'Demonstrates a special limited-offer Pool. No live promotion, discount, stock or deadline is implied.',bn:'বিশেষ পুলের ডিজাইন নমুনা। কোনো বাস্তব ছাড়, মজুত বা শেষ তারিখ ঘোষণা করা হয়নি।'},
   image:'/demo-products/detergent.svg',bundle:pack([item('0102',1),item('0105',1),item('0106',2)]),
   minHouseholds:30,sampleHouseholds:12,collection:{en:'Community pickup (when enabled)',bn:'কমিউনিটি সংগ্রহ পয়েন্ট (চালু হলে)'},isDemo:true},
 ]
}
export function featuredPoolTotals(pool:DemoFeaturedPool){
 return pool.bundle.reduce((sum,row)=>({
  solo:sum.solo+(Number(row.offer.solo_price)||0)*row.qty,
  group:sum.group+(Number(row.offer.confirmed_price)||0)*row.qty,
  units:sum.units+row.qty
 }),{solo:0,group:0,units:0})
}
