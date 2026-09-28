import { AppShell } from '@/components/app-shell'
import { SubmitButton } from '@/components/submit-button'
import { requireOnboardedUser } from '@/lib/auth'
import { dateTime, shortDate, taka } from '@/lib/format'
import { createMembershipInvoice, redeemMembershipCoupon, submitMembershipPayment } from '@/app/actions/subscription'
import { PILOT_MODE } from '@/lib/pilot-mode'

export const dynamic='force-dynamic'

export default async function SubscriptionPage({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {supabase,roles,user}=await requireOnboardedUser()
  const {error,notice}=await searchParams
  if(PILOT_MODE) return <AppShell roles={roles}><div className="grid gap-5"><section><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Pilot access</p><h1 className="mt-1 text-3xl font-black">Membership is not charging customers yet</h1><p className="muted mt-1">During the first 3–4 month pilot, every onboarded household may join community pools without a subscription payment.</p></section><div className="card"><div className="card-title">Pilot rule</div><h2 className="mt-1 text-xl font-black">No membership payment required</h2><p className="muted mt-2">The subscription engine remains preserved for the future launch, but billing CTAs and enforcement are intentionally dormant during pilot. Referral Coins accumulate now and are not automatically redeemed.</p></div></div></AppShell>
  const [{data:statusRows},{data:settings},{data:invoices},{data:redemptions}]=await Promise.all([
    supabase.rpc('get_my_subscription_status'),
    supabase.from('subscription_settings').select('*').eq('singleton',true).maybeSingle(),
    supabase.from('subscription_invoices').select('*').eq('customer_id',user.id).order('created_at',{ascending:false}).limit(24),
    supabase.from('subscription_coupon_redemptions').select('id,months_granted,valid_from,valid_until,redeemed_at').eq('user_id',user.id).order('redeemed_at',{ascending:false}).limit(12),
  ])
  const status=(statusRows??[])[0] as any
  const active=Boolean(status?.active),enforced=Boolean(status?.enforcement_enabled)
  const openInvoice=(invoices??[]).find((i:any)=>['unpaid','payment_pending'].includes(i.status)) as any

  return <AppShell roles={roles}><div className="grid gap-5">
    <section><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Membership</p><h1 className="mt-1 text-3xl font-black">Pool access subscription</h1><p className="muted mt-1">One active paid month or a valid free-use coupon keeps your household eligible to join and confirm pools.</p></section>
    {error&&<div className="error">{error}</div>}{notice&&<div className="success">{notice}</div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="card"><div className="card-title">Access</div><div className="metric text-2xl">{!enforced?'Not enforced':active?'Active':'Locked'}</div><p className="muted mt-2">{active?'You may join pools.':'Renew or redeem a coupon to join pools.'}</p></div>
      <div className="card"><div className="card-title">Valid until</div><div className="metric text-2xl">{status?.valid_until?shortDate(status.valid_until):'—'}</div><p className="muted mt-2">{status?.source??'No entitlement yet'}</p></div>
      <div className="card"><div className="card-title">Monthly fee</div><div className="metric text-2xl">{status?.monthly_price?taka(status.monthly_price):'Not set'}</div><p className="muted mt-2">Billed one month at a time.</p></div>
      <div className="card"><div className="card-title">Current bill</div><div className="metric text-2xl">{openInvoice?taka(openInvoice.amount):'None'}</div><p className="muted mt-2">{openInvoice?openInvoice.status.replaceAll('_',' '):'No unpaid invoice'}</p></div>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <div className="card"><div className="card-title">Free-use coupon</div><h2 className="section-title mt-1">Redeem 1 / 2 / 3 free months</h2><p className="muted mt-2">A valid welcome or campaign coupon extends your pool access immediately.</p><form action={redeemMembershipCoupon} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"><input className="input uppercase" name="code" placeholder="WELCOME1" required/><SubmitButton>Apply coupon</SubmitButton></form></div>
      <div className="card"><div className="card-title">Monthly renewal</div><h2 className="section-title mt-1">Generate your monthly bill</h2><p className="muted mt-2">Your next bill is normally generated automatically before access expires. You can also create it now.</p>{!openInvoice&&status?.monthly_price?<form action={createMembershipInvoice} className="mt-4"><SubmitButton>Create monthly bill</SubmitButton></form>:openInvoice?<p className="success mt-4">Invoice {openInvoice.invoice_no} is already {openInvoice.status.replaceAll('_',' ')}.</p>:<p className="notice mt-4">The monthly price has not been configured by Super Admin yet.</p>}</div>
    </section>

    {settings?.payment_instructions&&<section className="card"><div className="card-title">How to pay</div><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{settings.payment_instructions}</p></section>}
    {openInvoice&&<section className="card"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="card-title">Monthly bill</div><h2 className="mt-1 text-xl font-black">{openInvoice.invoice_no}</h2><p className="muted mt-1">{shortDate(openInvoice.period_start)} → {shortDate(openInvoice.period_end)} · due {shortDate(openInvoice.due_at)}</p></div><div className="text-left sm:text-right"><div className="text-2xl font-black">{taka(openInvoice.amount)}</div><div className="muted uppercase">{openInvoice.status.replaceAll('_',' ')}</div></div></div>
      {openInvoice.status==='unpaid'&&<form action={submitMembershipPayment} className="mt-5 grid gap-3 sm:grid-cols-2"><input type="hidden" name="invoice_id" value={openInvoice.id}/><label><span className="label">Payment method</span><select className="input" name="payment_method" required><option value="">Choose method</option><option>bKash</option><option>Nagad</option><option>Bank transfer</option><option>Cash</option><option>Other</option></select></label><label><span className="label">Transaction / reference</span><input className="input" name="payment_reference" required placeholder="Transaction ID or reference"/></label><label className="sm:col-span-2"><span className="label">Note (optional)</span><input className="input" name="note" placeholder="Sender number or useful payment detail"/></label><SubmitButton className="sm:col-span-2 sm:w-fit">Submit payment for verification</SubmitButton></form>}
      {openInvoice.status==='payment_pending'&&<div className="notice mt-4">Your payment reference has been submitted. Pool access activates when Super Admin verifies the payment.</div>}
    </section>}

    <section><div className="mb-3"><div className="card-title">Billing history</div><h2 className="section-title">Monthly invoices</h2></div><div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Period</th><th>Amount</th><th>Status</th><th>Due</th><th>Paid</th></tr></thead><tbody>{(invoices??[]).length?(invoices??[]).map((i:any)=><tr key={i.id}><td><b>{i.invoice_no}</b></td><td>{shortDate(i.period_start)} → {shortDate(i.period_end)}</td><td>{taka(i.amount)}</td><td className="capitalize">{i.status.replaceAll('_',' ')}</td><td>{shortDate(i.due_at)}</td><td>{i.paid_at?dateTime(i.paid_at):'—'}</td></tr>):<tr><td colSpan={6} className="text-slate-500">No subscription bills yet.</td></tr>}</tbody></table></div></section>

    {(redemptions??[]).length>0&&<section><div className="mb-3"><div className="card-title">Free access</div><h2 className="section-title">Coupon history</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(redemptions??[]).map((r:any)=><div className="card" key={r.id}><div className="card-title">{r.months_granted} free month{r.months_granted===1?'':'s'}</div><div className="mt-2 font-black">Until {shortDate(r.valid_until)}</div><p className="muted mt-1">Redeemed {shortDate(r.redeemed_at)}</p></div>)}</div></section>}
  </div></AppShell>
}
