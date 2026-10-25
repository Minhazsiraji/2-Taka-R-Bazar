import type {Offer,Pool,Product} from './data';
import {projectPublicSimpleOffers} from './public-simple-offers.mjs';
import {nativeClient} from './auth/client';
import {projectPublishedLaunchProducts} from './launch-catalog.mjs';

// Public read-only launch listing. Never use service-role keys or mutate stock,
// payment, customer, cart, community, orders or other private tables.
export async function loadPublicCatalog():Promise<{products:Product[];offers:Offer[];pools:Pool[]}>{
 const url=process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
 const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
 if(!url||!key||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))
  throw new Error('Public Supabase configuration missing');
 const headers:Record<string,string>={'apikey':key,'Content-Type':'application/json'};
 if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;
 const rpc=async(name:string,body:Record<string,unknown>):Promise<unknown>=>{
  const response=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{
   method:'POST',headers,body:JSON.stringify(body)
  });
  if(!response.ok)throw new Error(name+' returned HTTP '+response.status);
  return response.json();
 };
 const [catalogPayload,offersPayload]=await Promise.all([
  rpc('get_public_launch_catalog',{p_product_id:null}),
  rpc('get_public_simple_offers',{})
 ]);
 let registeredArea:string|null=null;
 const client=nativeClient();
 if(client){
  try{
   const {data:{user}}=await client.auth.getUser();
   if(user){
    const {data}=await client.from('profiles').select('community_id').eq('id',user.id).maybeSingle();
    registeredArea=data?.community_id??null;
   }
  }catch{/* Public catalog remains available to guests and offline auth errors. */}
 }
 return projectPublicSimpleOffers(offersPayload,projectPublishedLaunchProducts(catalogPayload),registeredArea);
}
