'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireOnboardedUser, requireSuperAdmin } from '@/lib/auth'

const t=(fd:FormData,k:string)=>String(fd.get(k)??'').trim()
const n=(fd:FormData,k:string)=>Number(t(fd,k))
const done=(path:string,message:string):never=>{revalidatePath('/subscription');revalidatePath('/pool');revalidatePath('/home');revalidatePath('/super-admin/subscriptions');redirect(`${path}?notice=${encodeURIComponent(message)}`)}
const fail=(path:string,message:string):never=>redirect(`${path}?error=${encodeURIComponent(message)}`)

export async function redeemMembershipCoupon(fd:FormData){
  const {supabase}=await requireOnboardedUser()
  const code=t(fd,'code')
  if(!code)fail('/subscription','Enter a coupon code')
  const {data,error}=await supabase.rpc('redeem_subscription_coupon',{p_code:code})
  if(error)fail('/subscription',error.message)
  done('/subscription',`Free membership activated until ${new Date(String(data)).toLocaleDateString('en-BD')}`)
}

export async function createMembershipInvoice(){
  const {supabase}=await requireOnboardedUser()
  const {error}=await supabase.rpc('create_my_subscription_invoice')
  if(error)fail('/subscription',error.message)
  done('/subscription','Monthly membership bill is ready')
}
export async function submitMembershipPayment(fd:FormData){
  const {supabase}=await requireOnboardedUser()
  const invoiceId=t(fd,'invoice_id'),method=t(fd,'payment_method'),reference=t(fd,'payment_reference')
  if(!invoiceId||!method||!reference)fail('/subscription','Payment method and transaction/reference number are required')
  const {error}=await supabase.rpc('submit_subscription_payment_reference',{p_invoice_id:invoiceId,p_method:method,p_reference:reference,p_note:t(fd,'note')||null})
  if(error)fail('/subscription',error.message)
  done('/subscription','Payment reference submitted for verification')
}

export async function updateSubscriptionSettings(fd:FormData){
  const {supabase}=await requireSuperAdmin()
  const price=n(fd,'monthly_price')
  if(!(price>0))fail('/super-admin/subscriptions','Set a monthly price greater than zero')
  const {error}=await supabase.rpc('admin_update_subscription_settings',{
    p_monthly_price:price,p_enforcement_enabled:fd.get('enforcement_enabled')==='on',
    p_payment_instructions:t(fd,'payment_instructions'),p_invoice_lead_days:n(fd,'invoice_lead_days')||7,p_due_days:n(fd,'due_days')||7,
  })
  if(error)fail('/super-admin/subscriptions',error.message)
  done('/super-admin/subscriptions','Subscription settings updated')
}

export async function createFreeCoupon(fd:FormData){
  const {supabase}=await requireSuperAdmin()
  const months=n(fd,'months_free'),maxRaw=t(fd,'max_redemptions'),expires=t(fd,'expires_at')
  const {error}=await supabase.rpc('admin_create_subscription_coupon',{
    p_code:t(fd,'code'),p_months:months,p_max_redemptions:maxRaw?Number(maxRaw):null,
    p_expires_at:expires?new Date(expires).toISOString():null,p_notes:t(fd,'notes')||null,
    p_new_customers_only:fd.get('new_customers_only')==='on',
  })
  if(error)fail('/super-admin/subscriptions',error.message)
  done('/super-admin/subscriptions',`${months}-month free coupon created`)
}
export async function markMembershipInvoicePaid(fd:FormData){
  const {supabase}=await requireSuperAdmin()
  const invoiceId=t(fd,'invoice_id')
  if(!invoiceId)fail('/super-admin/subscriptions','Invoice not found')
  const {error}=await supabase.rpc('admin_mark_subscription_invoice_paid',{
    p_invoice_id:invoiceId,p_method:t(fd,'payment_method')||'manual',
    p_reference:t(fd,'payment_reference')||'',p_note:t(fd,'admin_note')||null,
  })
  if(error)fail('/super-admin/subscriptions',error.message)
  done('/super-admin/subscriptions','Subscription payment confirmed and access extended')
}
