import Link from 'next/link'
import {notFound,redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {CommerceFrame} from '@/components/commerce-frame'
import {ClearLaunchCart} from '@/components/clear-launch-cart'
import {submitLaunchPayment} from '@/app/actions/launch-orders'
export const dynamic='force-dynamic'
type Payee={id:string;method:string;account_name:string;account_number:string;bank_name:string|null;branch_name:string|null}
export default async function LaunchOrderPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{placed?:string;error?:string}>}){
 const [{id},query]=await Promise.all([params,searchParams]);if(!/^[0-9a-f-]{36}$/i.test(id))notFound()
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login?next='+encodeURIComponent('/launch-orders/'+id))
 const {data:order}=await db.from('launch_orders').select('id,status,subtotal,delivery_fee,total_amount,payment_status,payment_reference,staff_note,address,contact_name').eq('id',id).eq('customer_id',user.id).maybeSingle()
 if(!order)notFound()
 const [{data:items},{data:payees}]=await Promise.all([db.from('launch_order_items').select('product_name,package_size,quantity,unit_price').eq('order_id',id),db.rpc('launch_payment_options',{p_order:id})])
 const options=(payees??[]) as Payee[];const cash=(v:number)=>'৳'+Number(v).toLocaleString('en-BD')
 return <CommerceFrame launch title="Your order / আপনার অর্ডার" error={query.error}>
 {query.placed==='1'&&<ClearLaunchCart orderId={id}/>}
 <section className="glass-panel rounded-3xl border border-white/80 p-5"><h2 className="text-xl font-black">Order #{id.slice(0,8).toUpperCase()}</h2><p className="mt-2">{order.status==='requested'?'Awaiting manual approval / অনুমোদনের অপেক্ষায়':order.status==='confirmed'?'Approved / অনুমোদিত':'Cancelled / বাতিল'}</p>
 <ul className="my-4 space-y-2">{(items??[]).map((i,n)=><li key={n}>{i.product_name} · {i.package_size} × {i.quantity} — {cash(Number(i.unit_price)*i.quantity)}</li>)}</ul>
 <p>Products / পণ্য: {cash(order.subtotal)}</p><p>Delivery / ডেলিভারি: {order.delivery_fee===null?'To be confirmed / নিশ্চিত করা হবে':cash(order.delivery_fee)}</p><p className="mt-3 text-xl font-black">{order.status==='confirmed'?'Total / সর্বমোট':'Subtotal / পণ্যের মোট'}: {cash(order.total_amount)}</p><p className="mt-3">{order.contact_name} · {order.address}</p>{order.staff_note&&<p className="mt-3">{order.staff_note}</p>}</section>
 {order.status==='confirmed'&&order.payment_status!=='verified'&&<section className="glass-panel mt-5 rounded-3xl border border-white/80 p-5"><h2 className="text-xl font-black">Pay by bKash or bank / বিকাশ বা ব্যাংকে পেমেন্ট</h2>
 {options.length===0?<p className="mt-3">Payment instructions are temporarily unavailable. Please contact support.</p>:<><div className="my-4 grid gap-4">{options.map(p=><div className="glass-subpanel rounded-2xl border p-4" key={p.id}><b>{p.method==='bkash'?'bKash Payment':p.bank_name}</b><p>{p.account_name}</p><p className="text-lg font-bold">{p.account_number}</p>{p.branch_name&&<p>{p.branch_name}</p>}</div>)}</div><form action={submitLaunchPayment} className="grid gap-3"><input type="hidden" name="order_id" value={id}/><label className="grid gap-1">Receiving account / প্রাপক<select className="input" name="recipient_id" required>{options.map(p=><option key={p.id} value={p.id}>{p.method==='bkash'?'bKash':p.bank_name} · {p.account_number}</option>)}</select></label><label className="grid gap-1">Transaction ID / লেনদেন নম্বর<input className="input" name="reference" required minLength={6} maxLength={80}/></label><button className="btn-primary" type="submit">Submit payment reference / পেমেন্ট তথ্য পাঠান</button></form></>}
 <p className="mt-3 text-sm">{order.payment_status==='submitted'?'Reference submitted. Staff will verify the transfer. / পেমেন্ট যাচাইয়ের অপেক্ষায়।':'Payment is verified manually after transfer. / টাকা পাঠানোর পর ম্যানুয়ালি যাচাই হবে।'}</p></section>}
 {order.payment_status==='verified'&&<p className="mt-5" role="status">Payment verified / পেমেন্ট যাচাই হয়েছে।</p>}
 <Link href="/account/orders" className="btn-secondary mt-5 inline-block">My orders / আমার অর্ডার</Link>
 </CommerceFrame>
}
