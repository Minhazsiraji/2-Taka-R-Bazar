'use server'
import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'
import {requireAdmin} from '@/lib/auth'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export async function publishStorefrontPool(fd:FormData){
 const {supabase}=await requireAdmin()
 const poolId=String(fd.get('pool_id')??'')
 const ids=fd.getAll('product_ids').map(String).filter(Boolean)
 const order=Number(fd.get('sort_order')??100)
 if(!uuid.test(poolId))redirect('/admin/pools?error=Invalid+Pool')
 const path=`/admin/pools/${poolId}`
 const easy=fd.get('return_to')==='/admin/easy-business'
 const destination=easy?`/admin/easy-business?pool=${encodeURIComponent(poolId)}`:path
 if(ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>!uuid.test(id))||!Number.isInteger(order))redirect(`${destination}${easy?'&':'?'}error=Choose+up+to+three+distinct+products`)
 const {error}=await supabase.rpc('admin_publish_storefront_pool',{p_pool_id:poolId,p_product_ids:ids,p_published:fd.get('published')==='on',p_sort_order:order})
 if(error)redirect(`${destination}${easy?'&':'?'}error=${encodeURIComponent(error.message)}`)
 revalidatePath('/');revalidatePath(path)
 redirect(`${destination}${easy?'&':'?'}notice=Home+Pool+publication+saved`)
}
