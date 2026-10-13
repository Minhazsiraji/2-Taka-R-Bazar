import type {StorefrontArea,StorefrontOffer} from '@/lib/storefront'
import type {ShowcaseProduct} from '@/lib/showcase-media'

// Visual fixture data only. Never insert into Supabase and never enable in Vercel Production.
// All amounts, counters, stock types and community associations are illustrative.
export function demoStorefrontEnabled():boolean {
 return process.env.VERCEL_ENV === 'preview' ||
   (process.env.NODE_ENV === 'development' && process.env.VERCEL_ENV !== 'production')
}
export const DEMO_AREAS:StorefrontArea[]=[
 {community_id:'00000000-0000-4000-8000-0000000000a1',community_name:'Amin Model Town (Demo)',community_slug:'amt-demo',center_latitude:null,center_longitude:null,match_radius_m:null},
 {community_id:'00000000-0000-4000-8000-0000000000a2',community_name:'Savar DOHS (Demo)',community_slug:'dohs-demo',center_latitude:null,center_longitude:null,match_radius_m:null},
 {community_id:'00000000-0000-4000-8000-0000000000a3',community_name:'Niribili (Demo)',community_slug:'niribili-demo',center_latitude:null,center_longitude:null,match_radius_m:null},
]
const products=[
 {id:'00000000-0000-4000-8000-000000000101',image:'/demo-products/rice.svg',en:'Premium Miniket Rice',bn:'প্রিমিয়াম মিনিকেট চাল',category:'Rice',categoryBn:'চাল',size:'5 kg',solo:390,group:365,qty:14,buyers:7,threshold:10},
 {id:'00000000-0000-4000-8000-000000000102',image:'/demo-products/oil.svg',en:'Refined Soybean Oil',bn:'সয়াবিন তেল',category:'Oil',categoryBn:'তেল',size:'2 L',solo:375,group:352,qty:18,buyers:9,threshold:12},
 {id:'00000000-0000-4000-8000-000000000103',image:'/demo-products/lentils.svg',en:'Premium Masoor Dal',bn:'মসুর ডাল',category:'Pulses',categoryBn:'ডাল',size:'1 kg',solo:155,group:143,qty:11,buyers:6,threshold:9},
 {id:'00000000-0000-4000-8000-000000000104',image:'/demo-products/sugar.svg',en:'Refined White Sugar',bn:'সাদা চিনি',category:'Sugar',categoryBn:'চিনি',size:'1 kg',solo:132,group:125,qty:8,buyers:4,threshold:7},
 {id:'00000000-0000-4000-8000-000000000105',image:'/demo-products/flour.svg',en:'Fine Wheat Flour',bn:'ময়দা',category:'Flour',categoryBn:'ময়দা',size:'2 kg',solo:145,group:133,qty:12,buyers:6,threshold:9},
 {id:'00000000-0000-4000-8000-000000000106',image:'/demo-products/detergent.svg',en:'Fresh Clean Detergent',bn:'কাপড় ধোয়ার ডিটারজেন্ট',category:'Household',categoryBn:'গৃহস্থালি',size:'1 kg',solo:168,group:154,qty:9,buyers:5,threshold:8},
] as const

export const DEMO_OFFERS:StorefrontOffer[]=products.map((p,i)=>({
 offer_id:'00000000-0000-4000-8000-'+String(500+i).padStart(12,'0'),
 offer_kind:i===2||i===5?'COMMUNITY_POOL':'GROUP_DEAL',
 community_id:DEMO_AREAS[i%DEMO_AREAS.length].community_id,
 product_id:p.id,product_name:p.en,product_name_bn:p.bn,
 category:p.category,category_bn:p.categoryBn,brand:'2TBR Demo',package_size:p.size,unit:'pack',
 image_url:p.image,offer_title:'Sample design preview · not a real offer',
 reference_price:p.solo,solo_price:p.solo,confirmed_price:p.group,upcoming_price:null,
 buyer_count:p.buyers,quantity_joined:p.qty,next_threshold:p.threshold,
 closes_at:null,price_status:'unlocked',is_demo:true,
}))
export const DEMO_SHOWCASE:ShowcaseProduct[]=products.slice(0,4).map((p,i)=>({
 product_id:p.id,name:p.en,name_bn:p.bn,brand:'2TBR Demo',category:p.category,
 package_size:p.size,unit:'pack',image_url:p.image,source_type:i%2?'EXCLUSIVE_PARTNER':'PRIVATE_LABEL',
 description:'Sample product used only for storefront layout review. Prices are illustrative and cannot be ordered.',
 description_bn:'শুধুমাত্র ওয়েবসাইটের ডিজাইন দেখার জন্য নমুনা পণ্য। দেখানো দাম বাস্তব নয়; অর্ডার করা যাবে না।',
 highlights:['Illustrative product design','No stock, payment or order associated'],
 gallery_urls:[p.image],video_url:null,featured:true,is_demo:true,
}))
export function demoProductById(id:string) {
 const offer=DEMO_OFFERS.find(p=>p.product_id===id)
 if(!offer)return null
 return {offer,showcase:DEMO_SHOWCASE.find(p=>p.product_id===id)??null}
}
