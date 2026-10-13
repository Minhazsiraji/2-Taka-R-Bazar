import Link from 'next/link'
import {CommerceFrame} from '@/components/commerce-frame'
import {requireUser} from '@/lib/auth'
import {formatPrice} from '@/lib/storefront'
export const dynamic='force-dynamic'
export default async function CommerceOrdersPage(){const {supabase}=await requireUser();const {data,error}=await supabase.rpc('commerce_orders_list',{p_staff:false});const orders=(data??[]) as Array<{id:string;order_code:string;status:string;payment_status:string;total_amount:number;created_at:string}>;return <CommerceFrame title="অর্ডার / Your orders" error={error?'অর্ডার লোড হয়নি। Your orders could not be loaded.':undefined}><div className="grid gap-3">{orders.map(o=><Link className="rounded-2xl border p-4" href={'/account/orders/'+o.id} key={o.id}><strong>{o.order_code}</strong><p>{o.status} · {o.payment_status}</p><p className="mt-2 font-black">{formatPrice(o.total_amount)}</p></Link>)}</div>{orders.length===0&&<p>এখন কোনো অর্ডার নেই। No orders yet.</p>}<Link className="mt-5 inline-block underline" href="/orders">আগের পুল অর্ডার / Earlier Pool orders</Link></CommerceFrame>}
