'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requirePickupOperator } from '@/lib/auth'

export async function markCollected(fd:FormData){const {supabase}=await requirePickupOperator();const orderId=String(fd.get('order_id')??'');const notes=String(fd.get('notes')??'').trim()||null;const {data,error}=await supabase.rpc('mark_order_collected',{p_order_id:orderId,p_notes:notes});if(error)redirect(`/pickup-ops?error=${encodeURIComponent(error.message)}`);revalidatePath('/pickup-ops');revalidatePath('/savings');redirect(`/pickup-ops?notice=${encodeURIComponent(`Collected. Verified savings credited: ৳${Number(data??0).toLocaleString('en-BD')}`)}`)}

export async function reportPickupIssue(fd:FormData){const {supabase,user}=await requirePickupOperator();const orderId=String(fd.get('order_id')??'');const description=String(fd.get('description')??'').trim();if(description.length<5)redirect('/pickup-ops?error=Describe+the+issue');const {error}=await supabase.from('operational_issues').insert({order_id:orderId,reported_by:user.id,issue_type:'pickup_issue',description});if(error)redirect(`/pickup-ops?error=${encodeURIComponent(error.message)}`);redirect('/pickup-ops?notice=Issue+reported')}
