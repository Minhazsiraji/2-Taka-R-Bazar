import type {Offer,Product} from './data';
import {projectPublishedLaunchProducts} from './launch-catalog.mjs';

// Public read-only launch listing. Never use service-role keys or mutate stock,
// payment, customer, cart, community, orders or other private tables.
export async function loadPublicCatalog():Promise<{products:Product[];offers:Offer[]}>{
 const url=process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
 const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
 if(!url||!key||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))
  throw new Error('Public Supabase configuration missing');
 const headers:Record<string,string>={'apikey':key,'Content-Type':'application/json'};
 if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;
 const response=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/get_public_launch_catalog',{
  method:'POST',headers,body:JSON.stringify({p_product_id:null})
 });
 if(!response.ok)throw new Error('Public launch catalog returned HTTP '+response.status);
 const payload:unknown=await response.json();
 return projectPublishedLaunchProducts(payload);
}
