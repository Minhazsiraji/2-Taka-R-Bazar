import 'server-only'
import {redirect} from 'next/navigation'
import {requireOnboardedUser} from '@/lib/auth'
import {commerceEnabled,commerceError} from '@/lib/commerce/server'
import {setCommerceCartItem} from '@/app/actions/commerce'

// Existing Pool/Group forms enter the same canonical cart during qualification.
// The server resolves source -> offer inside the authenticated community; callers
// cannot choose another seller/community or pass a price from a legacy form.
export async function routeCommitmentToCommerce(mode:'POOL'|'GROUP_DEAL',sourceId:string,quantity:number){
 if(!commerceEnabled())return
 const {supabase,profile}=await requireOnboardedUser()
 const {data,error}=await supabase.rpc('commerce_catalog',{p_include_synthetic:true,p_community:profile.community_id,p_product:null})
 if(error)redirect('/cart?error='+encodeURIComponent(commerceError('Offer expired or unavailable')))
 const offer=(data??[]).find((o:{mode:string;pool_item_id?:string;group_deal_id?:string})=>o.mode===mode&&(mode==='POOL'?o.pool_item_id:o.group_deal_id)===sourceId)
 if(!offer)redirect('/cart?error=Offer+expired+or+unavailable')
 const fd=new FormData();fd.set('offer_id',offer.offer_id);fd.set('quantity',String(quantity))
 await setCommerceCartItem(fd)
}
