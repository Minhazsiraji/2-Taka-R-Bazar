/**
 * Read-only projection of the owner-published launch catalog.
 * Only product information can reach the native browse UI; no vendor costs,
 * payment data, privileged attributes, synthetic fixtures, or write endpoints.
 */
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
export function projectPublishedLaunchProducts(payload){
 if(!Array.isArray(payload))throw new Error('Invalid launch catalog response');
 const products=[],offers=[],seen=new Set();
 for(const entry of payload){
  if(!entry||typeof entry!=='object'||Array.isArray(entry))continue;
  const id=entry.product_id;
  const name=typeof entry.name==='string'?entry.name.trim():'';
  const price=Number(entry.approved_unit_price);
  const quantity=Number(entry.available_quantity);
  // Do not display unpublished, invalid, duplicate, unpriced or synthetic rows.
  if(entry.launch_enabled!==true||typeof id!=='string'||!UUID.test(id)||seen.has(id)||
     !name||!Number.isFinite(price)||price<=0||!Number.isInteger(quantity)||quantity<0)continue;
  const image=typeof entry.image_url==='string'&&
   /^https:\/\/[^\s]+$/.test(entry.image_url)?entry.image_url:'';
  const publishedOldPrice=Number(entry.old_price);
  const referencePrice=Number.isFinite(publishedOldPrice)&&publishedOldPrice>price?publishedOldPrice:price;
  seen.add(id);
  products.push({
   id,name,nameBn:name,unit:typeof entry.package_size==='string'&&entry.package_size.trim()?entry.package_size.trim():'1 unit',
   image,referencePrice,category:typeof entry.category==='string'?entry.category:'Grocery'
  });
  offers.push({
   id:'launch:'+id,productId:id,mode:'SOLO',price,phase:'ready',exclusive:true,
   stock:quantity,community:'All areas'
  });
 }
 return {products,offers};
}
