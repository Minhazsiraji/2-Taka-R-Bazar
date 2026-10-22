'use server'
import {revalidatePath} from 'next/cache'
import {requireAdmin} from '@/lib/auth'
export async function saveSimpleOffer(fd:FormData):Promise<{ok:boolean;message:string;id?:string}>{
 const {supabase}=await requireAdmin()
 let items:unknown
 try{items=JSON.parse(String(fd.get('items')??'[]'))}catch{return {ok:false,message:'Choose products and enter their prices.'}}
 const closes=String(fd.get('closes_at')??'').trim()
 if(closes&&!Number.isFinite(Date.parse(closes)))return {ok:false,message:'Choose a valid closing date.'}
 const communities=[...new Set(fd.getAll('community_ids').map(id=>String(id)).filter(Boolean))]
 if(!communities.length)return {ok:false,message:'Select at least one community / area.'}
 const kind=String(fd.get('kind')??'')
 let tiers:unknown
 try{tiers=JSON.parse(String(fd.get('tiers')??'[]'))}catch{return {ok:false,message:'Enter valid price tiers.'}}
 if(!Array.isArray(tiers)||kind!=='SOLO'&&!(tiers.length>=1&&tiers.length<=3))
  return {ok:false,message:'Choose 1, 2 or 3 price tiers with people targets.'}
 const {data,error}=await supabase.rpc('admin_save_simple_offer_with_tiers',{
  p_id:String(fd.get('id')??'')||null,p_kind:kind,p_communities:communities,
  p_title:String(fd.get('title')??'').trim(),p_items:items,p_published:fd.get('published')==='on',p_closes:closes||null,
  p_tiers:tiers,
 })
 if(error)return {ok:false,message:error.message}
 for(const path of ['/','/products','/cart','/checkout','/admin/offers','/admin/products','/preview-live'])revalidatePath(path,'layout')
 return {ok:true,id:data,message:fd.get('published')==='on'?'Offer published. The same product images and shared stock are used.':'Draft saved. Publish when ready.'}
}
