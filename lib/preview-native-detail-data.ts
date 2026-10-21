import {previewProducts,previewDeals,previewPools} from '@/lib/home-card-preview-fixtures'

// Matched to owner-approved Expo fixture mobile/src/data.ts and mobile/App.tsx
// at 88c65a008e3ee6669f6f386b86233ea00ef57d9c. Preview presentation only.
export const nativePoolPrices={
 weekly:{
  butter:{opening:1160,current:1100,next:1050},rice:{opening:155,current:140,next:130},
  eggs:{opening:155,current:145,next:140}
 },
 monthly:{
  rice:{opening:155,current:140,next:130},ghee:{opening:720,current:690,next:660},
  butter:{opening:1160,current:1100,next:1050}
 }
} as const

export function previewPoolItems(poolId:string){
 const pool=previewPools.find(p=>p.id===poolId)
 if(!pool)return []
 const prices=nativePoolPrices[pool.id]
 return pool.products.flatMap(id=>{
  const product=previewProducts.find(p=>p.id===id)
  const tiers=(prices as Record<string,{opening:number;current:number;next:number}>)[id]
  return product&&tiers?[{product,tiers}]:[]
 })
}

export function previewGroupPriceTiers(id:string){
 const deal=previewDeals.find(d=>d.id===id)
 if(!deal)return null
 const tiers=id==='butter'?[
  {minimum:1,price:1160},{minimum:5,price:1120},{minimum:10,price:1075}
 ]:[{minimum:1,price:155},{minimum:5,price:135}]
 const current=tiers.filter(t=>t.minimum<=deal.joined).at(-1)??tiers[0]
 return {deal,tiers,current,next:tiers.find(t=>t.minimum>deal.joined)??null}
}

export function previewAvailableOffers(id:string){
 const product=previewProducts.find(p=>p.id===id)
 if(!product)return []
 const group=previewDeals.find(d=>d.id===id)
 const poolLines=previewPools.flatMap(pool=>previewPoolItems(pool.id)
  .filter(line=>line.product.id===id)
  .map(line=>({id:'pool-'+pool.id,label:'Community Pool',labelBn:'কমিউনিটি পুল',
    price:line.tiers.current,kind:'pool' as const,poolId:pool.id})))
 const groupRow=group?[{id:'deal',label:group.target+'-person Group Deal',
  labelBn:group.target+' জনের গ্রুপ ডিল',price:group.price,kind:'deal' as const,poolId:undefined}]:[]
 return [...groupRow,{id:'solo',label:'Direct / Exclusive',labelBn:'সরাসরি / এক্সক্লুসিভ',
  price:product.price,kind:'solo' as const,poolId:undefined},...poolLines]
}

export const nativeProductMeta={
 butter:{category:'Dairy',categoryBn:'দুগ্ধজাত'},ghee:{category:'Dairy',categoryBn:'দুগ্ধজাত'},
 rice:{category:'Grocery',categoryBn:'মুদি পণ্য'},eggs:{category:'Grocery',categoryBn:'মুদি পণ্য'}
} as const

export const nativeProductSections=[
 {id:'seo',title:'Description & specifications (SEO)',titleBn:'বিবরণ ও বৈশিষ্ট্য (SEO)',
  fields:[['Product description','পণ্যের বিবরণ'],['Manufacturer','উৎপাদনকারী'],
   ['Country of origin','উৎপত্তির দেশ'],['Ingredients / materials','উপাদান'],
   ['Allergen information','অ্যালার্জি তথ্য'],['Storage instructions','সংরক্ষণের নির্দেশনা'],
   ['Shelf life / best before','সংরক্ষণকাল / মেয়াদ'],['Verified certification','যাচাইকৃত সনদ']]},
 {id:'aeo',title:'Questions & answers (AEO)',titleBn:'প্রশ্ন ও উত্তর (AEO)',
  fields:[['Frequently asked question','প্রায়শই জিজ্ঞাসিত প্রশ্ন'],['Verified answer','যাচাইকৃত উত্তর']]},
 {id:'geo',title:'Local availability (GEO)',titleBn:'এলাকাভিত্তিক প্রাপ্যতা (GEO)',
  fields:[['Available areas','যেসব এলাকায় পাওয়া যায়'],['Delivery / pickup','ডেলিভারি / সংগ্রহ'],
   ['Local availability note','স্থানীয় প্রাপ্যতার তথ্য']]}
] as const
