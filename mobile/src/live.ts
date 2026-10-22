import type {Offer,Product} from './data';
// Public/read-only catalog. Never send a service-role key, privileged RPC, or checkout mutation from the app.
export async function loadPublicCatalog():Promise<{products:Product[];offers:Offer[]}>{
 const url=process.env.EXPO_PUBLIC_SUPABASE_URL;
 const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new Error('Public Supabase configuration missing');
 const headers:Record<string,string>={'apikey':key,'Content-Type':'application/json'};
 if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;
 const response=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/commerce_catalog',{
   method:'POST',headers,body:JSON.stringify({p_include_synthetic:false,p_community:null,p_product:null})
 });
 if(!response.ok)throw new Error('Catalog returned HTTP '+response.status);
 const items:unknown=await response.json();
 if(!Array.isArray(items))throw new Error('Invalid catalog response');
 const products:Product[]=[];const offers:Offer[]=[];
 for(const raw of items){
  if(!raw||typeof raw!=='object')continue;
  const x=raw as Record<string,unknown>;
  if(typeof x.product_id!=='string'||typeof x.offer_id!=='string'||typeof x.product_name!=='string')continue;
  const mode=x.mode;
  if(mode!=='SOLO'&&mode!=='POOL'&&mode!=='GROUP_DEAL')continue;
  const price=Number(x.unit_price);
  if(!Number.isFinite(price)||price<=0)continue;
  const productId=x.product_id;
  if(!products.some(p=>p.id===productId))products.push({
    id:productId,name:x.product_name,nameBn:x.product_name,unit:typeof x.package_size==='string'?x.package_size:'1 unit',
    image:typeof x.image_url==='string'?x.image_url:'',referencePrice:Number(x.reference_price)||price,
    category:typeof x.category==='string'?x.category:'Grocery',
    brand:typeof x.brand==='string'&&x.brand.trim()?x.brand.trim():undefined
  });
  offers.push({id:x.offer_id,productId,mode,price,phase:x.phase==='ready'?'ready':'waiting',
    exclusive:mode==='SOLO',stock:Number(x.available_quantity)||0,
    community:typeof x.community_name==='string'?x.community_name:'Choose community'});
 }
 return {products,offers};
}
