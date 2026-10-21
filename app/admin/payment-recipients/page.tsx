import Link from 'next/link'
import {requireSuperAdmin} from '@/lib/auth'
import {AdminShell} from '@/components/admin-shell'
import {setExistingPaymentRecipientActive} from '@/app/actions/vendor-offers'
import {MANUAL_PAYMENT_DESTINATIONS as accounts} from '@/lib/manual-payment-destinations'

export const dynamic='force-dynamic'
type Props={searchParams:Promise<{notice?:string;error?:string}>}
type Recipient={id:string;method:'bkash'|'bank';account_name:string;account_number:string;bank_name:string|null;branch_name:string|null;active:boolean}
const masked=(value:string)=>'•••• '+value.slice(-4)
export default async function PaymentRecipients({searchParams}:Props){
 const sp=await searchParams
 const {supabase}=await requireSuperAdmin()
 const [{data:isOwner,error:ownerError},{data:rows,error}]=await Promise.all([
  supabase.rpc('is_current_platform_owner'),
  supabase.from('pilot_payment_recipients')
   .select('id,method,account_name,account_number,bank_name,branch_name,active')
   .order('configured_at',{ascending:false}),
 ])
 const canEdit=isOwner===true&&!ownerError&&!error
 const entries=(rows??[]) as Recipient[]
 const methods=[
  {method:'bkash' as const,label:'bKash Personal Retail Account (PRA)',
   name:accounts.bkash.name,number:accounts.bkash.accountNumber,
   bank:null as string|null,branch:null as string|null,
   detail:'Use bKash Payment, not Send Money. The customer must verify the recipient in their bKash app. Never request PIN or OTP.'},
  {method:'bank' as const,label:'Bank transfer',
   name:accounts.bank.accountHolder,number:accounts.bank.accountNumber,
   bank:accounts.bank.institution as string|null,branch:accounts.bank.branch as string|null,
   detail:'Use a bank transfer to the named account; confirm bank requirements such as routing details separately.'},
 ]
 return <AdminShell><div className="grid gap-4">
  <section className="card">
   <p className="card-title">OWNER-ONLY · EXISTING REAL PAYMENT SETUP</p>
   <h1 className="mt-2 text-2xl font-black">Enable existing bKash and bank receiving accounts</h1>
   <p className="muted mt-2">These details come directly from the existing <Link className="underline font-bold" href="/super-admin/payment-setup">Real payment setup</Link>, not synthetic Treasury bank records. You do not need to enter the numbers again. Each method requires explicit owner activation before a staff-confirmed booking customer can see its payment instructions.</p>
   <div className="mt-3 flex flex-wrap gap-2"><Link href="/admin/easy-business/quick-offers" className="btn-secondary">← Quick Offer Setup</Link><Link href="/admin/pilot-bookings" className="btn-secondary">Manual booking inbox</Link></div>
  </section>
  {sp.notice&&<p role="status" className="success">{sp.notice}</p>}
  {sp.error&&<p role="alert" className="error">{sp.error}</p>}
  {!canEdit&&<p role="status" className="notice">Owner activation is unavailable until the migration is installed and the logged-in account is verified as the platform owner. No payment account is enabled by merely viewing this page.</p>}
  {canEdit&&<section className="grid gap-3 sm:grid-cols-2">
   {methods.map(entry=>{
    const saved=entries.filter(r=>r.method===entry.method)
    const record=saved[0]
    const matches=saved.length<=1&&(!record||
     record.account_name===entry.name&&record.account_number===entry.number&&
     record.bank_name===entry.bank&&record.branch_name===entry.branch)
    const active=Boolean(record?.active)
    return <article key={entry.method} className="card">
     <h2 className="text-lg font-black">{entry.label}</h2>
     <p className="muted mt-2 text-sm">Account holder / type: {entry.name}</p>
     <p className="mt-2 font-mono text-lg font-black">{masked(entry.number)}</p>
     {entry.bank&&<p className="mt-1 text-sm">{entry.bank} · {entry.branch}</p>}
     <p className="muted mt-3 text-sm">{entry.detail}</p>
     <p className="mt-3 text-sm font-bold">{!matches?'Account mismatch / duplicate — disabled for editing':active?'Enabled for confirmed bookings':'Not enabled for customer payments'}</p>
     {matches&&<form action={setExistingPaymentRecipientActive} className="mt-3">
      <input type="hidden" name="method" value={entry.method}/>
      <button className={active?'btn-secondary':'btn-primary'} name="operation" value={active?'disable':'enable'} type="submit">
       {active?'Disable customer payment instructions':'Activate existing '+(entry.method==='bkash'?'bKash':'bank')+' account'}
      </button>
     </form>}
     {!matches&&<p className="notice mt-3 text-sm">Existing database recipient differs from the canonical setup. No auto-overwrite or activation is permitted. Review the record securely.</p>}
    </article>
   })}
  </section>}
  <section className="notice">
   <b>Manual approval only:</b> A customer requests a booking, 2TBR staff verify vendor supply and confirm price and delivery fee, then that customer sees only the explicitly activated receiving methods. The customer submits a transaction reference. Staff verify the actual bank/bKash transaction independently; Finance reconciliation remains separate. No automatic order payment, stock allocation or purchase gateway is enabled.
  </section>
 </div></AdminShell>
}
