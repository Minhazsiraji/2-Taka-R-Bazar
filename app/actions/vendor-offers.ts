'use server'
import {redirect} from 'next/navigation'
import {revalidatePath} from 'next/cache'
import {requireAdmin,requireSuperAdmin,requireOnboardedUser} from '@/lib/auth'
import {MANUAL_PAYMENT_DESTINATIONS} from '@/lib/manual-payment-destinations'

const input=(f:FormData,k:string)=>String(f.get(k)??'').trim()
const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
const redirectError=(route:string,message:string):never=>
 redirect(route+(route.includes('?')?'&':'?')+'error='+encodeURIComponent(message))
const draftRoute='/admin/easy-business/quick-offers'
const destinationsRoute='/admin/payment-recipients'

export async function saveVendorOfferDraft(fd:FormData){
 const {supabase,user}=await requireAdmin()
 const productId=input(fd,'product_id'),supplierId=input(fd,'supplier_id')
 const cost=Number(input(fd,'cost')),sell=Number(input(fd,'sell'))
 const days=Number(input(fd,'handover_days'))
 if(!uuid(productId)||!uuid(supplierId)||
  !Number.isFinite(cost)||!Number.isFinite(sell)||cost<=0||sell<=cost||
  !Number.isInteger(days)||days<1||days>14||
  Math.round(cost*100)!==cost*100||Math.round(sell*100)!==sell*100)
  redirectError(draftRoute,'Enter a valid product, vendor, positive cost and selling price, and a 1–14 day supplier handover.')
 const [{data:product},{data:link},{data:supplier}]=await Promise.all([
  supabase.from('products').select('id,sku,source_type,active,is_demo')
   .eq('id',productId).maybeSingle(),
  supabase.from('supplier_products').select('supplier_id,product_id,active')
   .eq('supplier_id',supplierId).eq('product_id',productId).eq('active',true).maybeSingle(),
  supabase.from('suppliers').select('id,active,reliability_status')
   .eq('id',supplierId).maybeSingle(),
 ])
 if(!product||!product.active||product.is_demo||product.source_type!=='SUPPLIER_POOL'||
  !link||!supplier||!supplier.active||supplier.reliability_status==='blocked')
  redirectError(draftRoute,'Active product and a non-blocked linked vendor are required.')

 // Read the most recent owner-approved price proposal, never mutate the
 // immutable source audit or count a draft as a Commerce offer.
 const productSku=String(product?.sku??'')
 const {data:sourceLines,error:pricingError}=await supabase.rpc('vendor_offer_admin_price_snapshot')
 if(pricingError)redirectError(draftRoute,'Authoritative pricing snapshot unavailable until the secured migration is deployed.')
 const source=sourceLines?.find((line:{product_id:string;supplier_id:string;sku:string;audit_id:number})=>
  line.product_id===productId&&line.supplier_id===supplierId&&line.sku===productSku)
 const {error}=await supabase.from('vendor_offer_drafts').upsert({
  product_id:productId,supplier_id:supplierId,
  vendor_unit_cost:cost,proposed_sale_price:sell,
  supply_mode:'on_demand',confirmation_policy:'confirm_per_order',
  supplier_handover_days:days,status:'draft',
  source_audit_id:source?.audit_id??null,updated_by:user.id,
 },{onConflict:'product_id,supplier_id'})
 if(error)redirectError(draftRoute,'Draft not saved. Check the Preview database migration and your permissions.')
 revalidatePath(draftRoute)
 revalidatePath('/admin/easy-business')
 redirect(draftRoute+'?notice='+encodeURIComponent('Vendor offer draft saved. No stock, live offer, payment or financial record created.'))
}

/**
 * Link the payment destinations already published to the owner on
 * /super-admin/payment-setup. Each owner's click activates only the chosen
 * canonical account for confirmed customer bookings, not an open payment
 * gateway or a Treasury receipt. Never import synthetic Treasury accounts.
 */
export async function setExistingPaymentRecipientActive(fd:FormData){
 const {supabase,user}=await requireSuperAdmin()
 const {data:isOwner,error:ownerError}=await supabase.rpc('is_current_platform_owner')
 if(ownerError||!isOwner)redirectError(destinationsRoute,'Only the verified platform owner can approve receiving accounts.')
 const method=input(fd,'method'),operation=input(fd,'operation')
 if(!['bkash','bank'].includes(method)||!['enable','disable'].includes(operation))
  redirectError(destinationsRoute,'Choose a valid canonical recipient and enable/disable decision.')
 const existing=method==='bkash'?{
  method:'bkash',account_name:MANUAL_PAYMENT_DESTINATIONS.bkash.name,
  account_number:MANUAL_PAYMENT_DESTINATIONS.bkash.accountNumber,
  bank_name:null,branch_name:null,
 }:{
  method:'bank',account_name:MANUAL_PAYMENT_DESTINATIONS.bank.accountHolder,
  account_number:MANUAL_PAYMENT_DESTINATIONS.bank.accountNumber,
  bank_name:MANUAL_PAYMENT_DESTINATIONS.bank.institution,
  branch_name:MANUAL_PAYMENT_DESTINATIONS.bank.branch,
 }
 // Fail closed on conflicts, rather than silently overwriting any historic
 // owner-recipient or activating a different number for this method.
 const {data:rows,error:queryError}=await supabase.from('pilot_payment_recipients')
  .select('id,method,account_name,account_number,bank_name,branch_name,configured_by')
  .eq('method',method)
 if(queryError)redirectError(destinationsRoute,'Recipient activation is not available until the secure database migration is deployed.')
 if((rows??[]).length>1)redirectError(destinationsRoute,'Multiple recipients exist for this method. Resolve the conflict with Admin before activation.')
 const row=rows?.[0]
 if(row&&(row.account_name!==existing.account_name||row.account_number!==existing.account_number||
  row.bank_name!==existing.bank_name||row.branch_name!==existing.branch_name))
  redirectError(destinationsRoute,'Stored payee differs from the existing verified payment setup. No activation was changed.')
 const active=operation==='enable'
 if(!row&&!active)
  redirect(destinationsRoute+'?notice='+encodeURIComponent('Already disabled. No account created.'))
 const result=row
  ?await supabase.from('pilot_payment_recipients').update({active}).eq('id',row.id).eq('configured_by',user.id).select('id').single()
  :await supabase.from('pilot_payment_recipients').insert({...existing,active,configured_by:user.id}).select('id').single()
 if(result.error||!result.data)redirectError(destinationsRoute,'Payment recipient status could not be saved. Check verified ownership and deployment.')
 revalidatePath(destinationsRoute)
 revalidatePath('/pilot-bookings')
 redirect(destinationsRoute+'?notice='+encodeURIComponent(active
  ?'Existing '+(method==='bkash'?'bKash':'City Bank')+' receiving account enabled for staff-confirmed pilot bookings only.'
  :'Existing '+(method==='bkash'?'bKash':'City Bank')+' receiving account disabled for future payment instructions.'))
}

export async function savePilotPaymentRecipient(fd:FormData){
 const {supabase,user}=await requireSuperAdmin()
 const {data:isOwner,error:ownerError}=await supabase.rpc('is_current_platform_owner')
 if(ownerError||!isOwner)redirectError(destinationsRoute,'Only the verified platform owner may configure customer payment recipients.')
 const id=input(fd,'id'),method=input(fd,'method')
 const name=input(fd,'account_name'),number=input(fd,'account_number')
 const bank=input(fd,'bank_name'),branch=input(fd,'branch_name')
 const active=fd.get('active')==='on'
 if(!['bkash','bank'].includes(method)||name.length<2||name.length>100||
  !/^[+0-9A-Za-z-]{8,40}$/.test(number)||
  (method==='bank'&&(bank.length<2||bank.length>120))||
  branch.length>120)
  redirectError(destinationsRoute,'Enter the exact receiving account holder, account number and bank name when applicable.')
 if(id&&!uuid(id))redirectError(destinationsRoute,'Invalid payment recipient identifier.')
 const row={method,account_name:name,account_number:number,
  bank_name:method==='bank'?bank:null,
  branch_name:method==='bank'?(branch||null):null,active,configured_by:user.id}
 // Owner can explicitly disable/edit an existing recipient; no silent account
 // selection from test Treasury accounts or subscription settings.
 let error
 if(id){
  ({error}=await supabase.from('pilot_payment_recipients').update(row).eq('id',id))
 }else{
  ({error}=await supabase.from('pilot_payment_recipients').insert(row))
 }
 if(error)redirectError(destinationsRoute,'Recipient could not be saved. Check the account details and Preview migration.')
 revalidatePath(destinationsRoute)
 revalidatePath('/pilot-bookings')
 redirect(destinationsRoute+'?notice='+encodeURIComponent(active
  ?'Payment recipient saved and enabled for confirmed pilot bookings.'
  :'Payment recipient saved inactive; customers cannot see it.'))
}

export async function submitPilotPaymentReference(fd:FormData){
 const {supabase}=await requireOnboardedUser()
 const bookingId=input(fd,'booking_id'),recipientId=input(fd,'recipient_id')
 const reference=input(fd,'reference_code')
 if(!uuid(bookingId)||!uuid(recipientId)||!/^[A-Za-z0-9/_-]{6,80}$/.test(reference))
  redirectError('/pilot-bookings','Choose a valid approved recipient and enter your actual transaction ID.')
 const {error}=await supabase.rpc('pilot_submit_payment_reference',{
  p_booking:bookingId,p_recipient:recipientId,p_reference:reference,
 })
 if(error)redirectError('/pilot-bookings',error.message)
 revalidatePath('/pilot-bookings')
 revalidatePath('/admin/pilot-bookings')
 redirect('/pilot-bookings?notice='+encodeURIComponent('Transfer reference submitted for verification. No payment has been automatically marked received.'))
}

export async function reviewPilotPaymentReference(fd:FormData){
 const {supabase}=await requireAdmin()
 const id=input(fd,'claim_id'),decision=input(fd,'decision'),note=input(fd,'review_note')
 if(!uuid(id)||!['approve','reject'].includes(decision)||note.length<10||note.length>500)
  redirectError('/admin/pilot-bookings','Choose approve/reject and enter at least 10 characters about external transaction verification.')
 const {error}=await supabase.rpc('pilot_staff_review_payment_reference',{
  p_claim:id,p_approve:decision==='approve',p_note:note,
 })
 if(error)redirectError('/admin/pilot-bookings',error.message)
 revalidatePath('/admin/pilot-bookings')
 revalidatePath('/pilot-bookings')
 redirect('/admin/pilot-bookings?notice='+encodeURIComponent('Manual payment reference reviewed. Finance reconciliation and posting remain separate.'))
}
