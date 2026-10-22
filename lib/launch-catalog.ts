import 'server-only'
import {simpleCartCatalog,type SimpleOffer} from './simple-offers'
import {createClient} from '@/lib/supabase/server'
import type {PublicVendorBookingProduct} from './public-vendor-booking'
export async function loadLaunchCatalog():Promise<PublicVendorBookingProduct[]>{
 const db=await createClient()
 const [result,offers]=await Promise.all([db.rpc('get_public_launch_catalog',{p_product_id:null}),db.rpc('get_public_simple_offers')])
 return [...(result.error||!Array.isArray(result.data)?[]:result.data),...simpleCartCatalog((offers.error?[]:offers.data??[]) as SimpleOffer[])]
}
