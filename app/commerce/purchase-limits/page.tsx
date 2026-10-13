import Link from 'next/link'
import {requireUser} from '@/lib/auth'
import {commerceEnabled} from '@/lib/commerce/server'
import {CommerceFrame} from '@/components/commerce-frame'
import {requestCommercePurchaseLimit,reviewCommercePurchaseLimit,verifyCommerceHouseholdAddress} from '@/app/actions/commerce'
export const dynamic='force-dynamic'
type Offer={id:string;mode:string;status:string;unit_price:number}
type Limit={id:string;offer_id:string;campaign_key:string;max_per_account:number|null;max_per_household:number|null;status:string;reason:string;requested_by:string}
type Address={id:string;community_id:string;building_label:string;unit_label:string}
type Response={limits:Limit[];household_addresses:Address[]}
export default async function CommercePurchaseLimitsPage({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
 const {supabase,user}=await requireUser()
 const [q,workbench,limits]=await Promise.all([
  searchParams,supabase.rpc('commerce_workbench'),supabase.rpc('commerce_purchase_limit_workbench'),
 ])
 const w=(workbench.data??{}) as {can_admin?:boolean;can_review?:boolean;offers?:Offer[]}
 const l=(limits.data??{limits:[],household_addresses:[]}) as Response
 const canRequest=Boolean(w.can_admin)
 const canReview=Boolean(w.can_review)
 const active=(w.offers??[]).filter(o=>o.status==='approved')
 return <CommerceFrame title="Promotional purchase limits / প্রমোশনাল ক্রয়সীমা"
  error={q.error||(limits.error?'Promotion limit service awaits isolated database migration.':undefined)}>
  <div className="grid gap-5">
   <Link href="/commerce" className="font-bold underline">← Commerce operations / কমার্স অপারেশন</Link>
   {q.notice&&<p role="status" className="rounded-xl border border-teal-200 p-3 text-sm">{q.notice}</p>}
   <section className="rounded-2xl border p-4">
    <h2 className="text-lg font-black">Rules and customer experience / নিয়ম ও গ্রাহক অভিজ্ঞতা</h2>
    <p className="mt-2 text-sm">Set an offer cap of 1 or 2 bottles, or any integer up to 100. Accounts cannot exceed the campaign allowance across multiple orders. If the verified-household cap is enabled, checkout requires a staff-verified household assignment; the customer does not complete another form. Unverified identity fails closed. Cancellation and return do not automatically reset discounted allowances.</p>
    <p className="mt-2 text-xs">Each limited offer needs an independent Super Admin approval. Use the same campaign code for the same SKU and community across buying modes so separate orders do not restart the allowance.</p>
   </section>
   {canRequest&&<section className="rounded-2xl border p-4"><h2 className="text-lg font-black">Request a promotion limit / ক্রয়সীমা প্রস্তাব করুন</h2>
    <form action={requestCommercePurchaseLimit} className="mt-4 grid gap-3 sm:grid-cols-2">
     <label className="sm:col-span-2"><span className="block text-xs font-bold">Approved offer</span><select name="offer_id" className="input" required>{active.map(o=><option key={o.id} value={o.id}>{o.mode} · ৳{o.unit_price} · {o.id.slice(0,8)}</option>)}</select></label>
     <label><span className="block text-xs font-bold">Campaign code, shared across equivalent offers</span><input name="campaign_key" className="input" required minLength={3} maxLength={64} pattern="[A-Za-z0-9_-]{3,64}" placeholder="SOY5L_20PCT_OCT26"/></label>
     <label><span className="block text-xs font-bold">Max per account</span><input name="max_per_account" className="input" type="number" min="1" max="100" step="1" defaultValue="1"/></label>
     <label><span className="block text-xs font-bold">Max per verified household (optional)</span><input name="max_per_household" className="input" type="number" min="1" max="100" step="1" placeholder="1"/></label>
     <label className="sm:col-span-2"><span className="block text-xs font-bold">Reason / approved promotion evidence</span><textarea name="reason" className="input min-h-20" required minLength={10} maxLength={500} placeholder="5L soybean oil 20% off, maximum one per verified household"/></label>
     <div className="sm:col-span-2"><button type="submit" disabled={!commerceEnabled()||active.length===0} className="btn-primary">Submit to independent checker</button></div>
    </form>
   </section>}
   {l.limits?.length>0&&<section className="rounded-2xl border p-4">
    <h2 className="text-lg font-black">Campaign rules / ক্যাম্পেইন সীমা</h2>
    <div className="grid gap-3">{l.limits.map(rule=><div key={rule.id} className="rounded-xl border p-3 text-sm">
     <p><b>{rule.campaign_key}</b> · {rule.status} · offer {rule.offer_id.slice(0,8)}</p>
     <p>Per account: {rule.max_per_account??'—'} · Per verified household: {rule.max_per_household??'—'}</p>
     <p className="mt-1 text-xs">{rule.reason}</p>
     {canReview&&rule.status==='pending'&&<form action={reviewCommercePurchaseLimit} className="mt-3 grid gap-2">
      <input type="hidden" name="limit_id" value={rule.id}/>
      {rule.requested_by===user.id?<p className="text-xs">You requested this limit; independent checker required.</p>:<>
       <label>Decision<select name="decision" className="input"><option value="reject">Reject</option><option value="approve">Approve</option></select></label>
       <label>Checker evidence<textarea name="reason" className="input min-h-20" required minLength={10} maxLength={500}/></label>
       <button type="submit" disabled={!commerceEnabled()} className="btn-secondary">Record independent review</button>
      </>}
     </form>}
    </div>)}</div>
   </section>}
   {canReview&&<section className="rounded-2xl border p-4"><h2 className="text-lg font-black">Associate an independently verified household / পরিবার যাচাই</h2>
    <p className="mt-1 text-xs">Only addresses already independently operator-verified and matched to an approved building can become trusted household memberships. The same building and flat are linked without an extra customer login screen.</p>
    <form action={verifyCommerceHouseholdAddress} className="mt-3 grid gap-3">
     <label>Operator-verified customer address<select name="address_id" className="input" required><option value="">Select verified address</option>{(l.household_addresses??[]).map(a=><option key={a.id} value={a.id}>{a.building_label}, {a.unit_label} · {a.id.slice(0,8)}</option>)}</select></label>
     <label>Independent verification evidence<textarea name="reason" className="input min-h-20" required minLength={10} maxLength={500} placeholder="Confirmed exact flat and occupants from operational verification"/></label>
     <button type="submit" disabled={!commerceEnabled()||!l.household_addresses?.length} className="btn-secondary">Confirm household membership</button>
    </form>
   </section>}
  </div>
 </CommerceFrame>
}
