import Link from 'next/link'
import {requireUser} from '@/lib/auth'
import {CommerceFrame} from '@/components/commerce-frame'
import {selectQuoteDelivery,decideQuote,submitQuotePayment} from '@/app/actions/simple-offer-settlement'
export const dynamic='force-dynamic'
type Item={product_id:string;quantity:number;unit_price:number;retail_reference:number|null}
type Quote={id:string;cycle_id:string;product_total:number;delivery_fee:number|null;fulfillment:string|null;pickup_point_id:string|null;home_address:string|null;status:string;order_id:string|null;simple_sale_cycle_quote_items:Item[]}
const money=(n:number|null|undefined)=>n==null?'Pending':'৳'+Number(n).toLocaleString('en-BD',{maximumFractionDigits:2})
export default async function Commitments({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {supabase:db,user}=await requireUser(),params=await searchParams
 const [qr,cr,pr,mr]=await Promise.all([
  db.from('simple_sale_cycle_quotes').select('id,cycle_id,product_total,delivery_fee,fulfillment,pickup_point_id,home_address,status,order_id,simple_sale_cycle_quote_items(product_id,quantity,unit_price,retail_reference)').eq('customer_id',user.id).order('created_at',{ascending:false}).limit(75),
  db.from('simple_sale_cycles').select('id,community_id,cycle_number,locked_threshold,status').order('opened_at',{ascending:false}).limit(120),
  db.from('pickup_points').select('id,community_id,name,address').eq('active',true).limit(120),
  db.from('simple_sale_cycle_members').select('cycle_id').eq('customer_id',user.id).limit(120)
 ])
 const quotes=(qr.data??[]) as Quote[]
 const cycles=(cr.data??[]) as {id:string;community_id:string;cycle_number:number;locked_threshold:number|null;status:string}[]
 const points=(pr.data??[]) as {id:string;community_id:string;name:string;address:string}[]
 const accepted=quotes.filter(q=>q.status==='accepted')
 const paymentResults=await Promise.all(accepted.map(q=>db.rpc('simple_sale_quote_payment_options',{p_quote:q.id})))
 const paymentOptions=new Map(accepted.map((q,i)=>[q.id,((paymentResults[i]?.data??[]) as {id:string;method:string;account_name:string;account_number:string;bank_name:string|null}[])]))
 const names=await db.from('products').select('id,name').in('id',[...new Set(quotes.flatMap(q=>q.simple_sale_cycle_quote_items.map(i=>i.product_id))), '00000000-0000-0000-0000-000000000000'])
 const productName=new Map((names.data??[]).map(p=>[p.id,p.name]))
 return <CommerceFrame launch title="My Group Deals & Pools / আমার গ্রুপ ও পুল">
  <p className="mb-4 text-sm">Joining only saves your commitment; it does not create an order. At cycle closure, you receive the locked tier price. Choose collection or home delivery, wait for a confirmed delivery fee, accept the exact amount, then send your transfer reference. Only independently verified payment creates an order.</p>
  {(params.error||qr.error||cr.error||pr.error||mr.error||names.error)&&<p role="alert" className="mb-4 rounded-xl border p-4">{params.error??'Some commitment details could not load. Do not pay until the entire quote is visible.'}</p>}
  <div className="grid gap-4">
  {quotes.map(q=>{const c=cycles.find(row=>row.id===q.cycle_id);const paymentMethods=paymentOptions.get(q.id)??[]
   return <article className="glass-panel rounded-3xl border border-white/80 p-4 sm:p-5" key={q.id}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Cycle #{c?.cycle_number??'—'} · {q.id.slice(0,8).toUpperCase()}</h2><strong>{q.status.replaceAll('_',' ')}</strong></div>
    <p className="text-xs opacity-70">Community cycle {q.cycle_id.slice(0,8)} · Unlock target: {c?.locked_threshold??0} people</p>
    <ul className="my-3 text-sm">{q.simple_sale_cycle_quote_items.map(i=><li key={i.product_id}>{productName.get(i.product_id)??'Product'} · {i.quantity} × {money(i.unit_price)} = {money(i.quantity*Number(i.unit_price))}</li>)}</ul>
    <p>Locked product amount: <b>{money(q.product_total)}</b> · Delivery: <b>{money(q.delivery_fee)}</b></p>
    {q.delivery_fee!==null&&<p className="text-lg font-black">Total: {money(Number(q.product_total)+Number(q.delivery_fee))}</p>}
    {q.status==='awaiting_delivery'&&<form action={selectQuoteDelivery} className="mt-3 grid gap-3">
     <input type="hidden" name="quote_id" value={q.id}/>
     <label>Delivery method<select className="input w-full" name="fulfillment" defaultValue={q.fulfillment??'pickup'}><option value="pickup">Community pickup / gate</option><option value="home_delivery">Home delivery</option></select></label>
     <label>Pickup location<select name="pickup_point_id" className="input w-full" defaultValue={q.pickup_point_id??''}><option value="">Select pickup point</option>{points.filter(p=>p.community_id===c?.community_id).map(p=><option key={p.id} value={p.id}>{p.name} — {p.address}</option>)}</select></label>
     <label>Home address<textarea name="home_address" className="input w-full" maxLength={350} defaultValue={q.home_address??''} placeholder="Holding, road, block, city"/></label>
     <button className="btn-primary">Submit delivery preference</button>
    </form>}
    {q.status==='quoted'&&<div className="mt-3 grid gap-3">
     <p className="text-sm">Final products and delivery are quoted. The price cannot change after acceptance. You may cancel without placing an order.</p>
     <form action={decideQuote} className="grid gap-2"><input type="hidden" name="quote_id" value={q.id}/><input type="hidden" name="decision" value="accept"/>
      <label>Full name<input className="input w-full" name="contact_name" minLength={2} maxLength={100} required/></label>
      <label>Mobile number<input className="input w-full" name="contact_phone" pattern="\+?[0-9]{10,15}" required/></label>
      <label className="flex gap-2 items-center"><input type="checkbox" name="terms" required/> I accept the locked product price, delivery fee and payment terms.</label>
      <button className="btn-primary">Accept {money(Number(q.product_total)+Number(q.delivery_fee))}</button>
     </form>
     <form action={decideQuote}><input type="hidden" name="quote_id" value={q.id}/><button className="btn-secondary" name="decision" value="cancel">Cancel without order</button></form>
    </div>}
    {q.status==='accepted'&&<form action={submitQuotePayment} className="mt-3 grid gap-3"><input type="hidden" name="quote_id" value={q.id}/>
      <p className="text-sm">Pay exactly {money(Number(q.product_total)+Number(q.delivery_fee))} to an official account. A submitted transaction ID is not proof of payment.</p>
      <label>Official account<select className="input w-full" name="recipient_id" required defaultValue=""><option value="">Select account</option>{paymentMethods.map(p=><option key={p.id} value={p.id}>{p.method.toUpperCase()} · {p.account_name} · {p.account_number} · {p.bank_name??''}</option>)}</select></label>
      <label>Transaction reference<input className="input w-full" name="reference" minLength={6} maxLength={80} required/></label>
      <button className="btn-primary">Submit transfer for independent checking</button>
    </form>}
    {q.status==='payment_submitted'&&<p className="mt-3 font-semibold">Transfer reference submitted. Staff verification is pending; no order has been created yet.</p>}
    {q.status==='verified'&&q.order_id&&<Link className="btn-primary mt-3 inline-flex" href={'/launch-orders/'+q.order_id}>View confirmed order</Link>}
    {q.status==='cancelled'&&<p className="mt-3">Cancelled; no order exists for this quote.</p>}
   </article>})}
   {!quotes.length&&!qr.error&&<p className="glass-panel rounded-3xl p-5">No closed community commitments yet. Return after a Deal or Pool cycle finishes.</p>}
   {((mr.data??[]) as {cycle_id:string}[]).filter(m=>cycles.some(c=>c.id===m.cycle_id&&c.status==='open')).map(m=><p key={m.cycle_id} className="glass-panel rounded-2xl p-3 text-sm">Open commitment in cycle {m.cycle_id.slice(0,8)}. A final quote will become available after closure.</p>)}
  </div>
 </CommerceFrame>
}
