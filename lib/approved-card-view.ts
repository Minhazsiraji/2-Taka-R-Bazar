import type {LiveHomepageData,PublicLiveProduct,PublicLivePool,PublicLiveOffer} from './approved-live-detail-data'
import {publishedLiveOffers,publishedLivePools,confirmedOfferPrice,validMoney,safeTime,uuidPattern} from './approved-live-detail-data'

// Values only: all card and detail markup stays in the owner's approved templates.
export type ApprovedProduct={id:string;name:string;nameBn:string;unit:string;photo:string;image?:string|null;price:number|null;oldPrice:number|null;stock:number|null;empty?:boolean;href?:string;purchasable?:boolean;launchOfferId?:string}
export type ApprovedDeal={purchasable?:boolean;launchOfferId?:string;id:string;offerId?:string;price:number|null;reference?:number|null;joined:number;target:number;days:number|null;community?:string;empty?:boolean}
export type ApprovedPool={launchOfferId?:string;id:string;label:string;labelBn:string;name:string;nameBn:string;products:readonly string[];joined:number;target:number;days:number|null;date:string;closesAt?:string|null;empty?:boolean;productCount?:number}
export type ApprovedHomeView={products:ApprovedProduct[];lookup:ApprovedProduct[];deals:ApprovedDeal[];pools:ApprovedPool[]}
export type ApprovedOffer={oldPrice?:number|null;id:string;label:string;labelBn:string;price:number|null;kind:'solo'|'deal'|'pool';poolId?:string;empty?:boolean;purchasable?:boolean;launchOfferId?:string}
export type ApprovedProductView={initialOfferId?:string;product:ApprovedProduct;deal?:ApprovedDeal;offers:ApprovedOffer[];group:{tiers:{minimum:number;price:number|null;current?:boolean}[];current:{minimum:number;price:number|null};next:{minimum:number;price:number|null}|null}|null;source:PublicLiveProduct;community:string;fields:Record<string,{en:string;bn:string}>}
export type ApprovedPoolLine={product:ApprovedProduct;tiers:{opening:number|null;current:number|null;next:number|null}}
const blank='\u00a0'
export const emptyProduct=(id:string):ApprovedProduct=>({id,name:blank,nameBn:blank,unit:blank,photo:'',image:null,price:null,oldPrice:null,stock:null,empty:true})
const remaining=(date:string|null|undefined)=>safeTime(date)?Math.max(0,Math.ceil((new Date(date!).getTime()-Date.now())/86400000)):null
const stock=(o:PublicLiveOffer|undefined)=>o&&typeof o.commerce_available_quantity==='number'&&Number.isSafeInteger(o.commerce_available_quantity)&&o.commerce_available_quantity>=0?o.commerce_available_quantity:null
export function approvedHomeView(data:LiveHomepageData,area='',search='',selectedAreaName=''):ApprovedHomeView{
 const offers=publishedLiveOffers(data.offers,area),map=new Map<string,ApprovedProduct>()
 for(const p of data.catalog)map.set(p.product_id,{id:p.product_id,name:p.title_en,nameBn:p.title_bn,unit:p.package_size,photo:'',image:p.image_url,price:null,oldPrice:null,stock:null})
 for(const p of data.products.filter(p=>!p.is_demo))if(!map.has(p.product_id))map.set(p.product_id,{id:p.product_id,name:p.name,nameBn:p.name_bn??p.name,unit:p.package_size,photo:'',image:p.image_url,price:null,oldPrice:null,stock:null})
 for(const o of offers){
  const p=map.get(o.product_id)??{id:o.product_id,name:o.product_name,nameBn:o.product_name_bn??o.product_name,unit:o.package_size,photo:'',image:o.image_url,price:null,oldPrice:null,stock:null}
  if(o.offer_kind==='SOLO'&&!p.launchOfferId){p.price=confirmedOfferPrice(o);p.oldPrice=o.reference_price??null;p.stock=stock(o);if(o.launch_offer_id){p.launchOfferId=o.launch_offer_id;p.purchasable=(stock(o)??0)>0}}
  map.set(p.id,p)
 }
 for(const p of data.vendorProducts??[]){
  if(area&&p.community_id&&!(p.community_ids??[p.community_id]).includes(area))continue
  if(!uuidPattern.test(p.product_id)||!p.name?.trim()||!validMoney(p.approved_unit_price))continue
  const row=map.get(p.product_id)??{id:p.product_id,name:p.name,nameBn:p.name,unit:p.package_size,photo:'',image:p.image_url,price:null,oldPrice:null,stock:null}
  if(row.price===null)row.price=p.approved_unit_price
  if(p.launch_enabled&&!row.launchOfferId){row.launchOfferId=p.offer_id;row.stock=p.available_quantity??0;row.oldPrice=p.old_price??0;row.purchasable=(p.available_quantity??0)>0}
  map.set(row.id,row)
 }
 const q=search.trim().toLocaleLowerCase(),matches=(p:ApprovedProduct)=>!q||[p.name,p.nameBn,p.unit].some(s=>s.toLocaleLowerCase().includes(q))
 const products=[...map.values()].filter(matches).slice(0,6)
 const deals:ApprovedDeal[]=offers.filter(o=>o.offer_kind==='GROUP_DEAL'&&matches(map.get(o.product_id)!)).slice(0,6).map(o=>({id:o.product_id,offerId:o.offer_id,launchOfferId:o.launch_offer_id,purchasable:Boolean(o.launch_offer_id&&(stock(o)??0)>0),price:confirmedOfferPrice(o),reference:o.reference_price,joined:o.buyer_count??0,target:o.next_threshold??0,days:remaining(o.closes_at),community:'Community: '+(area&&selectedAreaName?selectedAreaName:'All')}))
 const pools=publishedLivePools(data.pools,area).slice(0,2).map(p=>approvedPoolView(p).pool)
 for(const pool of pools)for(const id of pool.products)if(!map.has(id)){
  const item=publishedLivePools(data.pools,area).find(p=>p.id===pool.id)?.bundle.find(l=>l.offer.product_id===id)?.offer
  map.set(id,item?{id,name:item.product_name,nameBn:item.product_name_bn??item.product_name,unit:item.package_size,photo:'',image:item.image_url,price:confirmedOfferPrice(item),oldPrice:validMoney(item.reference_price),stock:null}:emptyProduct(id))
 }
 // A missing section retains its locked card footprint, with no invented content.
 if(!q&&!products.length)for(let i=0;i<4;i++)products.push(emptyProduct('empty-product-'+i))
 if(!q&&!deals.length)for(let i=0;i<2;i++){const id='empty-deal-'+i;map.set(id,emptyProduct(id));deals.push({id,price:null,joined:0,target:0,days:null,empty:true})}
 if(!pools.length)for(let i=0;i<2;i++){
  const ids=Array.from({length:3},(_,n)=>'empty-pool-'+i+'-'+n);ids.forEach(id=>map.set(id,emptyProduct(id)))
  pools.push({id:'empty-pool-'+i,label:blank,labelBn:blank,name:blank,nameBn:blank,products:ids,joined:0,target:0,days:null,date:blank,productCount:0,empty:true})
 }
 return {products,lookup:[...map.values(),...products.filter(p=>p.empty)],deals,pools}
}
export function approvedProductView(source:PublicLiveProduct,offerId?:string):ApprovedProductView{
 const solo=source.offers.find(o=>o.offer_kind==='SOLO'&&o.launch_offer_id)??source.offers.find(o=>o.offer_kind==='SOLO'),group=source.offers.find(o=>o.offer_id===offerId&&o.offer_kind==='GROUP_DEAL')??source.offers.find(o=>o.offer_kind==='GROUP_DEAL')
 const product:ApprovedProduct={launchOfferId:solo?.launch_offer_id,id:source.id,name:source.name,nameBn:source.nameBn,unit:source.unit,photo:'',image:source.image,price:solo?confirmedOfferPrice(solo):source.listingPrice??null,oldPrice:solo?.launch_offer_id?solo.reference_price:source.launchEnabled?(source.listingOldPrice??0):source.retail,stock:solo?.launch_offer_id?stock(solo):source.launchEnabled?(source.listingStock??0):stock(solo),purchasable:Boolean((solo?.launch_offer_id&&(stock(solo)??0)>0)||source.launchEnabled&&(source.listingStock??0)>0)}
 const offers:ApprovedOffer[]=source.offers.map(o=>({id:o.offer_id,label:o.offer_kind==='SOLO'?'Direct / Exclusive':o.offer_kind==='GROUP_DEAL'?'Group Deal':'Community Pool',labelBn:o.offer_kind==='SOLO'?'সরাসরি / এক্সক্লুসিভ':o.offer_kind==='GROUP_DEAL'?'গ্রুপ ডিল':'কমিউনিটি পুল',price:confirmedOfferPrice(o),oldPrice:o.reference_price,purchasable:Boolean(o.launch_offer_id&&(stock(o)??0)>0),launchOfferId:o.launch_offer_id,kind:o.offer_kind==='SOLO'?'solo':o.offer_kind==='GROUP_DEAL'?'deal':'pool'}))
 if(!offers.some(o=>o.kind==='solo')){
  const slot=offers.findIndex(o=>o.kind==='pool')
  offers.splice(slot<0?offers.length:slot,0,{id:'solo',label:'Direct / Exclusive',labelBn:'সরাসরি / এক্সক্লুসিভ',price:product.price,kind:'solo',purchasable:product.purchasable,launchOfferId:product.launchOfferId,empty:!product.purchasable})
 }
 const specs=source.seo?.specs??{}
 const spec=(keys:string[])=>keys.map(k=>specs[k]).find(v=>typeof v==='string'&&v.trim())??''
 const fieldKeys:Record<string,string[]>={
  'Manufacturer':['manufacturer','manufacturer_name'],'Country of origin':['country_of_origin','origin_country'],
  'Ingredients / materials':['ingredients','materials'],'Allergen information':['allergens','allergen_information'],
  'Storage instructions':['storage','storage_instructions'],'Shelf life / best before':['shelf_life','best_before'],
  'Verified certification':['certification','certifications'],'Delivery / pickup':['delivery','pickup','delivery_pickup'],
  'Local availability note':['local_availability','availability_note'],
 }
 const fields:Record<string,{en:string;bn:string}>=Object.fromEntries(Object.entries(fieldKeys).map(([label,keys])=>[label,{en:spec(keys),bn:spec(keys.map(k=>k+'_bn'))||spec(keys)}]))
 fields['Product description']={en:source.description,bn:source.descriptionBn}
 fields['Frequently asked question']={en:source.seo?.faqs?.[0]?.question_en??'',bn:source.seo?.faqs?.[0]?.question_bn??''}
 fields['Verified answer']={en:source.seo?.faqs?.[0]?.answer_en??'',bn:source.seo?.faqs?.[0]?.answer_bn??''}
 fields['Available areas']={en:[...new Set(source.offers.map(o=>o.offer_title).filter(Boolean))].join(', '),bn:[...new Set(source.offers.map(o=>o.offer_title).filter(Boolean))].join(', ')}
 return {initialOfferId:offers.some(o=>o.id===offerId)?offerId:undefined,product,offers,source,fields,community:source.offers.find(o=>o.offer_id===offerId)?.offer_title??solo?.offer_title??group?.offer_title??'',deal:group?{id:product.id,offerId:group.offer_id,launchOfferId:group.launch_offer_id,purchasable:Boolean(group.launch_offer_id&&(stock(group)??0)>0),price:confirmedOfferPrice(group),joined:group.buyer_count??0,target:group.next_threshold??0,days:remaining(group.closes_at)}:undefined,
  group:group?{tiers:[{minimum:0,price:null},{minimum:0,price:confirmedOfferPrice(group),current:true},{minimum:group.next_threshold??0,price:validMoney(group.upcoming_price)}],current:{minimum:0,price:confirmedOfferPrice(group)},next:group.next_threshold?{minimum:group.next_threshold,price:validMoney(group.upcoming_price)}:null}:null}
}
export function approvedPoolView(source:PublicLivePool):{pool:ApprovedPool;lines:ApprovedPoolLine[]}{
 const rows=source.bundle.filter(l=>l.offer&&!l.offer.is_demo&&!l.offer.commerce_synthetic)
 const dates=[...new Set(rows.map(l=>safeTime(l.offer.closes_at)).filter(Boolean))],date=dates.length===1?dates[0]:null
 const lines:ApprovedPoolLine[]=rows.map(({offer:o})=>({product:{id:o.product_id,name:o.product_name,nameBn:o.product_name_bn??o.product_name,unit:o.package_size,photo:'',image:o.image_url,price:confirmedOfferPrice(o),oldPrice:o.reference_price,stock:stock(o),purchasable:Boolean(o.launch_offer_id&&(stock(o)??0)>0),launchOfferId:o.launch_offer_id},tiers:{opening:null,current:confirmedOfferPrice(o),next:null}}))
 const ids=source.featuredProductIds.filter(id=>lines.some(l=>l.product.id===id)).slice(0,3)
 if(!ids.length)ids.push(...lines.slice(0,3).map(l=>l.product.id))
 while(ids.length<3)ids.push('empty-pool-photo-'+source.id+'-'+ids.length)
 return {pool:{launchOfferId:rows[0]?.offer.launch_offer_id,id:source.id??'',label:source.slug==='weekly'?'Weekly Pool':source.slug==='monthly'?'Monthly Pool':'Special Pool',labelBn:source.slug==='weekly'?'মার্কেটিং পুল':source.slug==='monthly'?'মাসিক পুল':'বিশেষ পুল',name:source.title.en??blank,nameBn:source.title.bn??source.title.en??blank,products:ids,joined:source.sampleHouseholds??0,target:source.livePricing?.upcoming??0,days:remaining(date),closesAt:date,date:date?new Date(date).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):blank,productCount:rows.length},lines}
}
