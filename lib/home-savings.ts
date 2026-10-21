import 'server-only'
import {createClient} from '@/lib/supabase/server'

/** Zero values are genuine zero verified savings, never an inferred promotion. 
 * Null community totals mean we lack a verified per-community order attribution. */
export type HomeSavingsSummary={
 thisMonth:number
 previousMonth:number
 lifetime:number
 community:number|null
 verified:boolean
}
const zero:HomeSavingsSummary={thisMonth:0,previousMonth:0,lifetime:0,community:null,verified:false}
const nonnegative=(value:unknown):number=>{
 const amount=Number(value)
 return Number.isFinite(amount)&&amount>=0?Math.round(amount*100)/100:0
}

/** Read-only customer-specific RPC. No legacy Finance access, no direct table writes. */
export async function getHomeSavingsSummary(authenticated:boolean):Promise<HomeSavingsSummary>{
 if(!authenticated)return zero
 try{
  const db=await createClient()
  const {data,error}=await db.rpc('store_home_savings')
  if(error||!data||typeof data!=='object'||Array.isArray(data))return zero
  const raw=data as Record<string,unknown>
  return {
   thisMonth:nonnegative(raw.this_month),
   previousMonth:nonnegative(raw.previous_month),
   lifetime:nonnegative(raw.lifetime),
   community:raw.community===null||raw.community===undefined?null:nonnegative(raw.community),
   verified:true,
  }
 }catch{return zero}
}
