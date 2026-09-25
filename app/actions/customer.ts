'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireOnboardedUser } from '@/lib/auth'

function text(fd: FormData, key: string) { return String(fd.get(key) ?? '').trim() }

export async function commitToPool(formData: FormData) {
  const { supabase } = await requireOnboardedUser()
  const poolItemId = text(formData, 'pool_item_id')
  const quantity = Number(text(formData, 'quantity'))
  if (!poolItemId || !Number.isInteger(quantity) || quantity < 1) redirect('/pool?error=Choose+a+valid+quantity')
  const { error } = await supabase.rpc('commit_to_pool', { p_pool_item_id: poolItemId, p_quantity: quantity })
  if (error) redirect(`/pool?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/pool'); revalidatePath('/home'); revalidatePath('/orders')
  redirect('/pool?notice=Commitment+saved.+This+is+not+a+purchase+until+you+confirm+the+final+price.')
}

export async function confirmCommitment(formData: FormData) {
  const { supabase } = await requireOnboardedUser()
  const commitmentId = text(formData, 'commitment_id')
  const pickupPointId = text(formData, 'pickup_point_id')
  if (!commitmentId || !pickupPointId) redirect('/orders?error=Choose+a+pickup+point+before+confirming+your+purchase')
  const { error } = await supabase.rpc('confirm_commitment_order', { p_commitment_id: commitmentId, p_pickup_point_id: pickupPointId })
  if (error) redirect(`/orders?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/orders'); revalidatePath('/home'); revalidatePath('/pool')
  redirect('/orders?notice=Purchase+confirmed+with+your+selected+pickup+point.')
}

export async function submitFeedback(formData: FormData) {
  const { supabase, user } = await requireOnboardedUser()
  const orderId = text(formData, 'order_id')
  const rating = Number(text(formData, 'rating'))
  const comment = text(formData, 'comment')
  const permission = formData.get('testimonial_permission') === 'on'
  if (!orderId || !Number.isInteger(rating) || rating < 1 || rating > 5) redirect('/feedback?error=Choose+a+rating+from+1+to+5')
  const { data: order } = await supabase.from('orders').select('id,status').eq('id', orderId).eq('customer_id', user.id).maybeSingle()
  if (!order || order.status !== 'completed') redirect('/feedback?error=Feedback+is+available+after+completed+pickup')
  const { error } = await supabase.from('feedback').upsert({ order_id: orderId, customer_id: user.id, rating, comment: comment || null, testimonial_permission: permission }, { onConflict: 'order_id,customer_id' })
  if (error) redirect(`/feedback?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/feedback')
  redirect('/feedback?notice=Thank+you.+Nothing+will+be+published+automatically.')
}

export async function reportCustomerIssue(formData: FormData) {
  const { supabase, user } = await requireOnboardedUser()
  const orderId = text(formData, 'order_id') || null
  const issueType = text(formData, 'issue_type')
  const description = text(formData, 'description')
  if (!issueType || description.length < 5) redirect('/orders?error=Please+describe+the+issue')
  if (orderId) {
    const { data } = await supabase.from('orders').select('id').eq('id',orderId).eq('customer_id',user.id).maybeSingle()
    if (!data) redirect('/orders?error=Order+not+found')
  }
  const { error } = await supabase.from('operational_issues').insert({ order_id: orderId, reported_by: user.id, issue_type: issueType, description })
  if (error) redirect(`/orders?error=${encodeURIComponent(error.message)}`)
  redirect('/orders?notice=Issue+reported+to+operations.')
}
