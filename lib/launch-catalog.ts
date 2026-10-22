import 'server-only'
import {createClient} from '@/lib/supabase/server'
import type {PublicVendorBookingProduct} from './public-vendor-booking'
export async function loadLaunchCatalog():Promise<PublicVendorBookingProduct[]>{
 const db=await createClient()
 const result=await db.rpc('get_public_launch_catalog',{p_product_id:null})
 if(result.error)return []
 return Array.isArray(result.data)?result.data:[]
}
