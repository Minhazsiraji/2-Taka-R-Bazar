import Link from 'next/link'
import {requireAdmin} from '@/lib/auth'
import {AdminShell} from '@/components/admin-shell'
import {reviewLaunchOrder} from '@/app/actions/launch-orders'
export const dynamic='force-dynamic'
export default async function LaunchOrderInbox({searchParams}:{searchParams:Promise<{error?:string;order?:string}>}){
 const query=await searchParams;const {supabase}=await requireAdmin()
 const requestedOrder=query.order??''
 const selectedOrder=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedOrder)?requestedOrder:null
 const orderQuery=supabase.from('launch_orders').select('id,contact_name,contact_phone,address,status,payment_status,payment_reference,subtotal,delivery_fee,total_amount,created_at,launch_order_items(product_name,quantity,unit_price)')
 const {data:orders,error}=await (selectedOrder?orderQuery.eq('id',selectedOrder):orderQuery.order('created_at',{ascending:false}).limit(100))
 return <AdminShell><h1 className="text-2xl font-black">Customer orders</h1><Link className="underline" href="/admin/pilot-bookings">Booking inbox</Link>{selectedOrder&&<Link className="btn-secondary ml-2" href="/admin/launch-orders">All recent orders</Link>}{(query.error||error)&&<p className="error" role="alert">{query.error??'Orders could not be loaded.'}</p>}
 <div className="mt-5 grid gap-4">{(orders??[]).map(o=><article className="card scroll-mt-24" id={"order-"+o.id} key={o.id}><h2 className="text-xl font-bold">#{o.id.slice(0,8)} · {o.contact_name}</h2><p>{o.contact_phone} · {o.address}</p><p>{o.status} · Payment: {o.payment_status}</p><ul className="my-3">{o.launch_order_items.map((i,n)=><li key={n}>{i.product_name} × {i.quantity} · ৳{i.unit_price}</li>)}</ul><p>Products: ৳{o.subtotal} · Total: ৳{o.total_amount}</p>{o.payment_reference&&<p>Transfer reference: {o.payment_reference}</p>}
 <form action={reviewLaunchOrder} className="mt-4 flex flex-wrap items-end gap-3"><input type="hidden" name="order_id" value={o.id}/><label>Delivery fee<input name="delivery_fee" type="number" min="0" step="0.01" defaultValue={o.delivery_fee??0} className="input"/></label><label>Note<input name="note" maxLength={500} className="input"/></label>{o.status==='requested'&&<button name="decision" value="confirm" className="btn-primary">Approve order</button>}{o.status!=='cancelled'&&o.payment_status==='pending'&&<button name="decision" value="cancel" className="btn-secondary">Cancel & release stock</button>}{o.status==='confirmed'&&o.payment_status==='submitted'&&<button name="decision" value="verify_payment" className="btn-primary">I verified the transfer</button>}</form>
 </article>)}</div>{!orders?.length&&!error&&<p className="mt-5">{selectedOrder?'The requested order was not found or is not accessible.':'No customer orders yet.'}</p>}</AdminShell>
}
