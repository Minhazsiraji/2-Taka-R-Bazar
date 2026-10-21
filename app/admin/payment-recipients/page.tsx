import Link from 'next/link'
import {requireSuperAdmin} from '@/lib/auth'
import {AdminShell} from '@/components/admin-shell'
import {savePilotPaymentRecipient} from '@/app/actions/vendor-offers'
export const dynamic='force-dynamic'
type P={searchParams:Promise<{notice?:string;error?:string}>}
type Recipient={id:string;method:'bkash'|'bank';account_name:string;account_number:string;bank_name:string|null;branch_name:string|null;active:boolean}
const masked=(value:string)=>'•••• '+value.slice(-4)
export default async function PaymentRecipients({searchParams}:P){
 const sp=await searchParams
 const {supabase}=await requireSuperAdmin()
 const [{data:isOwner,error:ownerError},{data:rows,error}]=await Promise.all([
  supabase.rpc('is_current_platform_owner'),
  supabase.from('pilot_payment_recipients').select('id,method,account_name,account_number,bank_name,branch_name,active')
   .order('configured_at',{ascending:false}),
 ])
 const canEdit=isOwner===true&&!error&&!ownerError
 const entries=(rows??[]) as Recipient[]
 return <AdminShell><div className="grid gap-4">
  <section className="card">
   <p className="card-title">OWNER-ONLY · MANUAL PAYMENT RECEIVERS</p>
   <h1 className="mt-2 text-2xl font-black">Customer bKash & bank account setup</h1>
   <p className="muted mt-2">The Treasury database stores masked/test accounts, not public customer-payment instructions. Enter the exact, authorized receiving details here. Recipients default to inactive; only the verified platform owner may activate them.</p>
   <div className="mt-3 flex flex-wrap gap-2"><Link href="/admin/easy-business/quick-offers" className="btn-secondary">← Quick Offer Setup</Link><Link href="/admin/pilot-bookings" className="btn-secondary">Manual booking inbox</Link></div>
  </section>
  {sp.notice&&<p role="status" className="success">{sp.notice}</p>}
  {sp.error&&<p role="alert" className="error">{sp.error}</p>}
  {!canEdit&&<p className="notice">Account configuration is unavailable until the migration is deployed and the logged-in account is verified as the platform owner. No payment account is public.</p>}
  {canEdit&&<section className="card">
   <h2 className="section-title">Add an authorized receiving account</h2>
   <form action={savePilotPaymentRecipient} className="mt-4 grid gap-3 sm:grid-cols-2">
    <label className="grid gap-1 text-sm font-bold">Payment method
     <select className="input" name="method" required><option value="bkash">bKash</option><option value="bank">Bank transfer</option></select>
    </label>
    <label className="grid gap-1 text-sm font-bold">Receiving account holder name
     <input className="input" name="account_name" minLength={2} maxLength={100} required placeholder="Exact registered holder"/>
    </label>
    <label className="grid gap-1 text-sm font-bold">Full receiving account / bKash number
     <input className="input" name="account_number" minLength={8} maxLength={40} required autoComplete="off" placeholder="Only an account you control"/>
    </label>
    <label className="grid gap-1 text-sm font-bold">Bank name (required for bank transfer)
     <input className="input" name="bank_name" maxLength={120} placeholder="Your bank's registered name"/>
    </label>
    <label className="grid gap-1 text-sm font-bold">Bank branch (bank transfer, optional)
     <input className="input" name="branch_name" maxLength={120}/>
    </label>
    <label className="flex items-center gap-2 text-sm font-bold">
     <input name="active" type="checkbox"/> Enable for customers after staff confirm their booking
    </label>
    <div className="sm:col-span-2"><p className="mb-3 text-sm">Bank accounts are shown only for confirmed customer bookings, never on the anonymous storefront. Check the number before activation. Customer references are not bank reconciliation.</p>
     <button className="btn-primary" type="submit">Save receiving account</button></div>
   </form>
  </section>}
  {canEdit&&<section className="grid gap-3">
   <h2 className="section-title">Configured receiving accounts</h2>
   {entries.length===0?<div className="card">No approved customer receiving account yet. Add an account above; masked Treasury/test accounts are never imported automatically.</div>:
    entries.map(item=><details key={item.id} className="card">
     <summary className="cursor-pointer font-bold">{item.method==='bkash'?'bKash':'Bank transfer'} · {item.account_name} · {masked(item.account_number)} · {item.active?'Enabled':'Inactive'}</summary>
     <form action={savePilotPaymentRecipient} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={item.id}/><input type="hidden" name="method" value={item.method}/>
      <label className="grid gap-1 text-sm">Account holder<input className="input" name="account_name" required defaultValue={item.account_name}/></label>
      <label className="grid gap-1 text-sm">Receiving account number<input className="input" name="account_number" required defaultValue={item.account_number}/></label>
      <label className="grid gap-1 text-sm">Bank name<input className="input" name="bank_name" defaultValue={item.bank_name??''}/></label>
      <label className="grid gap-1 text-sm">Branch<input className="input" name="branch_name" defaultValue={item.branch_name??''}/></label>
      <label className="flex items-center gap-2 text-sm font-bold"><input name="active" type="checkbox" defaultChecked={item.active}/> Enabled for confirmed bookings</label>
      <button className="btn-primary" type="submit">Save recipient changes</button>
     </form>
    </details>)}
  </section>}
 </div></AdminShell>
}
