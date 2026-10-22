/**
 * Projects PUBLIC, already published simple offers into the unchanged native cards.
 * This module intentionally contains no privileged fields, mutations or demo data.
 */
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const safeMoney=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
const boundedInt=value=>Number.isInteger(Number(value))&&Number(value)>=0?Number(value):0;
const safeImage=value=>typeof value==='string'&&/^https:\/\/[^\s]+$/.test(value)?value:'';
const safeString=value=>typeof value==='string'?value.trim():'';
const daysRemaining=iso=>{
 if(!iso||Number.isNaN(Date.parse(iso)))return undefined;
 return Math.max(0,Math.ceil((Date.parse(iso)-Date.now())/86400000));
};
const endLabel=iso=>iso&&!Number.isNaN(Date.parse(iso))?
 new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}):undefined;

export function projectPublicSimpleOffers(payload,catalog){
 if(!Array.isArray(payload))throw new Error('Invalid public simple offers payload');
 const products=[...catalog.products], offers=[...catalog.offers], pools=[];
 const known=new Map(products.map(p=>[p.id,p]));
 const offerIds=new Set(offers.map(o=>o.id)), poolIds=new Set();
 for(const row of payload){
  if(!row||typeof row!=='object'||Array.isArray(row)||
     !UUID.test(String(row.id||''))||
     !['GROUP_DEAL','COMMUNITY_POOL'].includes(row.kind)||
     !Array.isArray(row.items)||row.items.length===0)continue;
  const community=safeString(row.community_name)||'Community';
  const realItems=[];
  for(const item of row.items){
   if(!item||typeof item!=='object'||Array.isArray(item)||!UUID.test(String(item.product_id||'')))continue;
   const id=item.product_id,price=safeMoney(item.price),name=safeString(item.name);
   if(price===null||!name||realItems.some(x=>x.id===id))continue;
   const old=safeMoney(item.old_price);
   const existing=known.get(id);
   if(!existing){
    const product={id,name,nameBn:name,unit:safeString(item.package_size)||safeString(item.unit)||'1 unit',
     image:safeImage(item.image_url),referencePrice:old&&old>price?old:price,
     category:safeString(item.category)||'Grocery'};
    if(safeString(item.brand))product.brand=safeString(item.brand);
    products.push(product);known.set(id,product);
   }
   realItems.push({id,price,stock:boundedInt(item.available_quantity)});
  }
  if(realItems.length!==row.items.length)continue; // never show incomplete published offer
  const buyerCount=boundedInt(row.buyer_count);
  const remaining=daysRemaining(row.closes_at);
  if(row.kind==='GROUP_DEAL'){
   if(realItems.length!==1)continue; // native Group Deal detail is single-product
   const item=realItems[0];
   const id='public-deal:'+row.id;
   if(offerIds.has(id))continue;
   offers.push({id,productId:item.id,mode:'GROUP_DEAL',price:item.price,
    phase:'waiting',joined:buyerCount,groupSize:boundedInt(row.buyer_target)||undefined,pendingBuyers:boundedInt(row.pending_buyers),community,daysLeft:remaining});
   offerIds.add(id);
  }else{
   if(poolIds.has(row.id))continue;
   poolIds.add(row.id);
   const title=safeString(row.title)||'Community Pool';
   const frequency=/month|মাস/i.test(title)?'monthly':/week|সাপ্তাহ/i.test(title)?'weekly':'special';
   const nextTier=boundedInt(row.buyer_target); // admin-configured participation goal; never fabricate tier prices
   pools.push({id:row.id,name:title,nameBn:title,frequency,
    productIds:realItems.map(x=>x.id),participants:buyerCount,nextTier,
    commitDaysLeft:remaining,commitEndsLabel:endLabel(row.closes_at)});
   for(const item of realItems){
    const id='public-pool:'+row.id+':'+item.id;
    if(offerIds.has(id))continue;
    offers.push({id,productId:item.id,mode:'POOL',poolId:row.id,
     price:item.price,openingPrice:item.price,phase:'waiting',community,stock:item.stock});
    offerIds.add(id);
   }
  }
 }
 return {products,offers,pools};
}
