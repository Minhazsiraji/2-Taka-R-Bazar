import Link from 'next/link'
import {requireAdmin} from '@/lib/auth'
import {AdminShell} from '@/components/admin-shell'
import {quoteDeliveryFee,verifyQuotePayment,requestPaymentCorrection} from '@/app/actions/simple-offer-settlement'
export const dynamic='force-dynamic'
type Item={product_id:string;quantity:number;unit_price:number}
type Quote={id:string;cycle_id:string;customer_id:string;product_total:number;delivery_fee:number|null;fulfillment:string|null;pickup_point_id:string|null;home_address:string|null;payment_recipient_id:string|null;payment_reference:string|null;quoted_by:string|null;status:string;order_id:string|null;contact_name:string|null;contact_phone:string|null;created_at:string;simple_sale_cycle_quote_items:Item[]}
const money=(n:number|null|undefined)=>n==null?'Awaiting fee':'৳'+Number(n).toLocaleString('en-BD',{maximumFractionDigits:2})
export default async function OfferSettlement({searchParams}:{searchParams:Promise<{error?:string;verified?:string}>}){
 const params=await searchParams,{supabase:db,user}=await requireAdmin()
 const [qr,cycles,pickups,products,payments]=await Promise.all([
  db.from('simple_sale_cycle_quotes').select('id,cycle_id,customer_id,product_total,delivery_fee,fulfillment,pickup_point_id,home_address,payment_recipient_id,payment_reference,quoted_by,status,order_id,contact_name,contact_phone,created_at,simple_sale_cycle_quote_items(product_id,quantity,unit_price)').order('created_at',{ascending:false}).limit(100),
  db.from('simple_sale_cycles').select('id,offer_id,community_id,cycle_number,locked_threshold,status').order('opened_at',{ascending:false}).limit(150),
  db.from('pickup_points').select('id,name,address').limit(150),
  db.from('products').select('id,name').eq('active',true).limit(250),
  db.from('pilot_payment_recipients').select('id,method,account_name,account_number,bank_name').limit(25)
 ])
 const quotes=(qr.data??[]) as Quote[],cycleRows=(cycles.data??[]) as {id:string;offer_id:string;community_id:string;cycle_number:number;locked_threshold:number;status:string}[]
 const productName=new Map((products.data??[]).map(p=>[p.id,p.name]))
 const pickupName=new Map((pickups.data??[]).map(p=>[p.id,p.name+' · '+p.address]))
 const recipientName=new Map((payments.data??[]).map(p=>[p.id,p.method.toUpperCase()+' · '+p.account_name+' · '+p.account_number]))
 return <AdminShell><main className="grid gap-4">
  <header className="card"><h1 className="text-2xl font-black">Community Deal / Pool settlement</h1><p className="muted mt-2">The order is created only after the cycle closes, a staff delivery quote is accepted by the customer, and a different authorized staff member independently confirms the incoming transfer.</p><Link className="btn-secondary mt-3 inline-flex" href="/admin/offers">Products & offers</Link></header>
  {params.verified&&<p className="card">Verified order: {params.verified}</p>}
  {(params.error||qr.error||cycles.error||pickups.error||products.error||payments.error)&&<p role="alert" className="error">{params.error??'Could not load complete settlement records. Do not approve a payment until records are available.'}</p>}
  <div className="grid gap-4">{quotes.map(q=>{const cy=cycleRows.find(c=>c.id===q.cycle_id);const total=Number(q.product_total)+Number(q.delivery_fee??0)
   return <article className="card grid gap-3" key={q.id}>
    <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-lg font-bold">{q.contact_name??'Customer'} · #{q.id.slice(0,8).toUpperCase()}</h2><p className="muted text-xs">Community {cy?.community_id.slice(0,8)??'—'} · Cycle {cy?.cycle_number??'—'} · Target {cy?.locked_threshold??0}</p></div><strong>{q.status.replaceAll('_',' ')}</strong></div>
    <p>Customer ID: {q.customer_id} · Phone: {q.contact_phone??'Pending'}</p>
    <ul className="text-sm">{q.simple_sale_cycle_quote_items.map(i=><li key={i.product_id}>{productName.get(i.product_id)??i.product_id} × {i.quantity} @ {money(i.unit_price)}</li>)}</ul>
    <p>Product price: <b>{money(q.product_total)}</b> · Delivery: <b>{money(q.delivery_fee)}</b> · Final: <b>{q.delivery_fee===null?'Pending':money(total)}</b></p>
    <p>Delivery: {q.fulfillment??'Not chosen'} — {q.fulfillment==='pickup'?pickupName.get(q.pickup_point_id??'')??'Unconfirmed':q.home_address??'Not supplied'}</p>
    {q.status==='awaiting_delivery'&&q.fulfillment&&<form action={quoteDeliveryFee} className="flex flex-wrap gap-2 items-end">
     <input type="hidden" name="quote_id" value={q.id}/><label>Agreed delivery fee (৳)<input required className="input" type="number" name="delivery_fee" min={0} max={10000} step=".01" defaultValue={q.fulfillment==='pickup'?0:''}/></label>
     <button className="btn-primary">Publish complete quote</button>
    </form>}
    {q.status==='payment_submitted'&&<section className="rounded-2xl border p-4">
     <p>Customer's declared transaction reference: <b>{q.payment_reference??'Missing'}</b></p>
     <p>Recipient account: <b>{recipientName.get(q.payment_recipient_id??'')??'Unknown'}</b></p>
     <form action={requestPaymentCorrection} className="my-3 grid gap-2"><input type="hidden" name="quote_id" value={q.id}/><label>Unmatched transfer / incorrect reference reason<input type="text" className="input w-full" name="reason" required minLength={10} maxLength={500} placeholder="Explain why the transfer cannot be matched"/></label><button className="btn-secondary">Request corrected payment reference (no order)</button></form>
     {q.quoted_by===user.id?<p className="error">You prepared this quote. Another authorized staff member must independently verify the transfer.</p>:
     <form action={verifyQuotePayment} className="mt-3 grid gap-2"><input type="hidden" name="quote_id" value={q.id}/>
      <label>Amount actually received in the official account (৳)<input required type="number" name="verified_amount" min={0} step=".01" className="input w-full" placeholder={String(total)}/></label>
      <label className="flex items-center gap-2"><input type="checkbox" required name="independent_confirmation"/> I personally checked the official bank/bKash transaction and verified the reference, account and exact received amount.</label>
      <button className="btn-primary">Verify transfer and create order once</button>
     </form>}
    </section>}
    {q.status==='verified'&&q.order_id&&<Link className="btn-secondary inline-flex" href={'/admin/launch-orders?order='+q.order_id}>Confirmed order #{q.order_id.slice(0,8)}</Link>}
   </article>})}
   {!quotes.length&&!qr.error&&<p className="card">No closed community offers awaiting settlement.</p>}
  </div>
 </main></AdminShell>
}
