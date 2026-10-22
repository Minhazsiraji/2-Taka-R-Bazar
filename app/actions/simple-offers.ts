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
 const targetRaw=String(fd.get('buyer_target')??'').trim()
 const buyerTarget=targetRaw===''?null:Number(targetRaw)
 if(targetRaw!==''&&(!Number.isInteger(buyerTarget)||buyerTarget!<2||buyerTarget!>100000))
  return {ok:false,message:'Buyer target must be a whole number between 2 and 100,000.'}
 if(kind==='GROUP_DEAL'&&(buyerTarget===null||buyerTarget<5))
  return {ok:false,message:'A Group Deal needs a minimum target of 5 confirmed buyers.'}
 const {data,error}=await supabase.rpc('admin_save_simple_offer_with_target',{
  p_id:String(fd.get('id')??'')||null,p_kind:kind,p_communities:communities,
  p_title:String(fd.get('title')??'').trim(),p_items:items,p_published:fd.get('published')==='on',p_closes:closes||null,
  p_target:kind==='SOLO'?null:buyerTarget,
 })
 if(error)return {ok:false,message:error.message}
 for(const path of ['/','/products','/cart','/checkout','/admin/offers','/admin/products','/preview-live'])revalidatePath(path,'layout')
 return {ok:true,id:data,message:fd.get('published')==='on'?'Offer published. The same product images and shared stock are used.':'Draft saved. Publish when ready.'}
}
