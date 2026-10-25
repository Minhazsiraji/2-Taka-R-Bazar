import Link from 'next/link'
import {AdminShell} from '@/components/admin-shell'
import {requireAdmin} from '@/lib/auth'

export const dynamic='force-dynamic'
type SharedQuote={
 id:string;cycle_id:string;customer_id:string;status:string;product_total:number;delivery_fee:number|null;
 fulfillment:string|null;contact_name:string|null;contact_phone:string|null;payment_reference:string|null;order_id:string|null;
 created_at:string;simple_sale_cycle_quote_items:{product_id:string;quantity:number;unit_price:number}[]
}
type DirectOrder={
 id:string;status:string;payment_status:string;contact_name:string;contact_phone:string;payment_reference:string|null;
 address:string;fulfillment:string;subtotal:number;delivery_fee:number;total_amount:number;
 created_at:string;launch_order_items:{product_name:string;quantity:number;unit_price:number}[]
}
type Tracking={
 id:string;created_at:string;lane:'deal'|'pool'|'direct';title:string;customer:string;contactPhone:string|null;transactionRef:string|null;
 status:string;stage:'staff'|'customer'|'complete'|'cancelled';
 guidance:string;productTotal:number;deliveryFee:number|null;total:number|null;
 lines:string[];href:string;action:string;cycle?:string
}
const money=(n:number|null)=>n===null?'Pending':'৳'+Number(n).toLocaleString('en-BD',{maximumFractionDigits:2})
const stamp=(v:string)=>new Date(v).toLocaleString('en-BD',{timeZone:'Asia/Dhaka',dateStyle:'medium',timeStyle:'short'})
type Search={lane?:string;stage?:string;q?:string}
export default async function OrderTracking({searchParams}:{searchParams:Promise<Search>}){
 const sp=await searchParams
 const {supabase:db}=await requireAdmin()
 const [quotesResult,directResult,legacyResult]=await Promise.all([
  db.from('simple_sale_cycle_quotes').select('id,cycle_id,customer_id,status,product_total,delivery_fee,fulfillment,contact_name,contact_phone,payment_reference,order_id,created_at,simple_sale_cycle_quote_items(product_id,quantity,unit_price)').order('created_at',{ascending:false}).limit(150),
  db.from('launch_orders').select('id,status,payment_status,contact_name,contact_phone,payment_reference,address,fulfillment,subtotal,delivery_fee,total_amount,created_at,launch_order_items(product_name,quantity,unit_price)').order('created_at',{ascending:false}).limit(150),
  db.from('orders').select('id',{head:true,count:'exact'}),
 ])
 const quotes=(quotesResult.data??[]) as SharedQuote[]
 const direct=(directResult.data??[]) as DirectOrder[]
 const cycleIds=[...new Set(quotes.map(q=>q.cycle_id))]
 const cycles=cycleIds.length?await db.from('simple_sale_cycles').select('id,offer_id,community_id,cycle_number').in('id',cycleIds):{data:[],error:null}
 const offers=cycles.data?.length?await db.from('simple_sale_offers').select('id,title,kind').in('id',[...new Set(cycles.data.map(c=>c.offer_id))]):{data:[],error:null}
 const products=quotes.length?await db.from('products').select('id,name').in('id',[...new Set(quotes.flatMap(q=>q.simple_sale_cycle_quote_items.map(i=>i.product_id)))]):{data:[],error:null}
 const communities=cycles.data?.length?await db.from('communities').select('id,name').in('id',[...new Set(cycles.data.map(c=>c.community_id))]):{data:[],error:null}
 const cyclesById=new Map((cycles.data??[]).map(x=>[x.id,x]))
 const offersById=new Map((offers.data??[]).map(x=>[x.id,x]))
 const productsById=new Map((products.data??[]).map(x=>[x.id,x.name]))
 const communityById=new Map((communities.data??[]).map(x=>[x.id,x.name]))
 const shared:Tracking[]=quotes.map(q=>{
  const c=cyclesById.get(q.cycle_id),offer=offersById.get(c?.offer_id??'')
  const status=q.status
  const stage:Tracking['stage']=status==='awaiting_delivery'
   ?q.fulfillment?'staff':'customer'
   :status==='payment_submitted'?'staff'
   :status==='verified'?'complete'
   :status==='cancelled'?'cancelled':'customer'
  const guidance=status==='awaiting_delivery'
   ?q.fulfillment?'Delivery selected — staff must publish the fee.':'Customer must choose pickup or home delivery.'
   :status==='quoted'?'Customer must accept or cancel the delivery-inclusive quote.'
   :status==='accepted'?'Waiting for customer to pay and submit reference.'
   :status==='payment_submitted'?'A different staff member must check actual received funds.'
   :status==='verified'?'Payment verified; order created.':'Cancelled without a new order.'
  const productTotal=Number(q.product_total),fee=q.delivery_fee===null?null:Number(q.delivery_fee)
  return {id:q.id,created_at:q.created_at,lane:offer?.kind==='COMMUNITY_POOL'?'pool':'deal',
   title:offer?.title??'Community Deal / Pool',
   customer:q.contact_name??('Customer '+q.customer_id.slice(0,8)),contactPhone:q.contact_phone,transactionRef:q.payment_reference,
   status,stage,guidance,productTotal,deliveryFee:fee,total:fee===null?null:productTotal+fee,
   cycle:'Round '+(c?.cycle_number??'?')+' · '+(communityById.get(c?.community_id??'')??'Community'),
   lines:q.simple_sale_cycle_quote_items.map(i=>(productsById.get(i.product_id)??'Product')+' × '+i.quantity+' @ '+money(Number(i.unit_price))),
   href:status==='verified'&&q.order_id?'/launch-orders/'+q.order_id:'/admin/offer-settlement',
   action:status==='verified'&&q.order_id?'View confirmed order':'Open settlement'}
 })
 const directItems:Tracking[]=direct.map(o=>{
  const stage:Tracking['stage']=o.status==='cancelled'?'cancelled':
    o.status==='requested'||o.status==='confirmed'&&o.payment_status==='submitted'?'staff':
    o.payment_status==='verified'?'complete':'customer'
  return {
   id:o.id,created_at:o.created_at,lane:'direct',title:'Direct order',
   customer:o.contact_name??'Customer',contactPhone:o.contact_phone,transactionRef:o.payment_reference,status:o.status+' · '+o.payment_status,
   stage,guidance:stage==='staff'?(o.status==='requested'?'Admin must review order and delivery fee.':'Verify actual received transfer before marking paid.')
    :stage==='customer'?'Waiting for customer action or payment.':stage==='complete'?'Payment verified.':'Cancelled',
   productTotal:Number(o.subtotal),deliveryFee:Number(o.delivery_fee),total:Number(o.total_amount),
   lines:o.launch_order_items.map(i=>i.product_name+' × '+i.quantity+' @ '+money(Number(i.unit_price))),
   href:'/admin/launch-orders',action:'Open direct approvals'
  }
 })
 const all=[...shared,...directItems].sort((a,b)=>b.created_at.localeCompare(a.created_at))
 const needle=(sp.q??'').trim().toLocaleLowerCase().slice(0,90)
 const lane=['deal','pool','direct'].includes(sp.lane??'')?sp.lane:'all'
 const stage=['staff','customer','complete','cancelled'].includes(sp.stage??'')?sp.stage:'all'
 const rows=all.filter(r=>(lane==='all'||r.lane===lane)&&(stage==='all'||r.stage===stage)&&
  (!needle||[r.id,r.customer,r.contactPhone??'',r.transactionRef??'',r.title,r.status,r.cycle??'',...r.lines].some(x=>x.toLocaleLowerCase().includes(needle))))
 const fail=quotesResult.error||directResult.error||cycles.error||offers.error||products.error||communities.error
 const n=(state:Tracking['stage'])=>all.filter(x=>x.stage===state).length
 return <AdminShell><div className="grid gap-4">
  <header className="card">
   <p className="card-title">2TBR · Order journey / অর্ডার ট্র্যাকিং</p>
   <h1 className="mt-1 text-2xl font-black sm:text-3xl">One place to track every order</h1>
   <p className="muted mt-2">Group Deals and Pools remain commitments until locked quotes are approved and payment is independently verified. Direct orders use a separate approval lane. No order is created merely by joining.</p>
   <nav className="mt-3 flex flex-wrap gap-2" aria-label="Order workflows">
    <Link className="btn-primary" href="/admin/offer-settlement">Review Deal / Pool quotes</Link>
    <Link className="btn-secondary" href="/admin/launch-orders">Direct order approvals</Link>
    <Link className="btn-secondary" href="/admin/orders">Legacy orders ({legacyResult.count??0})</Link>
    <Link className="btn-secondary" href="/admin/deliveries">Delivery tracking</Link>
   </nav>
  </header>
  {fail&&<p className="error" role="alert">Some operational records could not be loaded. Do not approve a payment from an incomplete view; open the appropriate settlement screen directly.</p>}
  <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Recent order journey counts">
   {([
    ['Needs staff action',n('staff')],
    ['Waiting for customer',n('customer')],
    ['Verified / completed',n('complete')],
    ['Cancelled',n('cancelled')]
   ] as const).map(([label,num])=><div className="admin-ops-stat" key={label}>
     <p className="card-title">{label}</p><strong className="metric block">{num}</strong></div>)}
  </section>
  <form className="card grid gap-3 md:grid-cols-[minmax(100px,1fr)_minmax(120px,1fr)_minmax(160px,2fr)_auto]" action="/admin/order-tracking" method="get" role="search">
   <label><span className="label">Sale module</span><select className="input" name="lane" defaultValue={lane??'all'}>
    <option value="all">All</option><option value="deal">Group Deals</option><option value="pool">Community Pools</option><option value="direct">Direct orders</option>
   </select></label>
   <label><span className="label">Next owner</span><select className="input" name="stage" defaultValue={stage??'all'}>
    <option value="all">All stages</option><option value="staff">Staff action</option><option value="customer">Customer action</option><option value="complete">Completed</option><option value="cancelled">Cancelled</option>
   </select></label>
   <label><span className="label">Order, customer, SKU or offer</span><input className="input" name="q" type="search" maxLength={90} defaultValue={needle} placeholder="Search recent records"/></label>
   <button className="btn-primary self-end" type="submit">Filter orders</button>
  </form>
  <p className="muted">Showing {rows.length} of the most recent {all.length} Deal/Pool quotes and direct orders (up to 150 per lane); historical legacy orders open separately.</p>
  <section className="grid gap-3" aria-label="Tracked orders">
   {!fail&&rows.map(r=><article key={r.lane+'-'+r.id} className="card grid gap-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div className="min-w-0 flex-1">
      <p className="card-title">{r.lane==='deal'?'Group Deal':r.lane==='pool'?'Community Pool':'Direct order'} · {stamp(r.created_at)}</p>
      <h2 className="text-lg font-bold">{r.title} · #{r.id.slice(0,8).toUpperCase()}</h2>
      <p className="muted">{r.customer}{r.contactPhone?' · '+r.contactPhone:''}{r.cycle?' · '+r.cycle:''}</p>
     </div>
     <span className="chip">{r.status.replaceAll('_',' ')}</span>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
     <div className="rounded-xl border border-white/70 p-3">
      <p className="card-title">Line items</p>
      <ul className="mt-2 grid gap-1 text-sm">{r.lines.map((line,i)=><li key={i}>{line}</li>)}</ul>
     </div>
     <div className="rounded-xl border border-white/70 p-3">
      <p className="card-title">Locked / quoted totals</p>
      <p>Products: <b>{money(r.productTotal)}</b></p>
      <p>Delivery: <b>{money(r.deliveryFee)}</b></p>
      <p className="font-bold">Payable: {money(r.total)}</p>
     </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/70 p-3">
     <p className="text-sm"><b>{r.stage==='staff'?'Staff action required':r.stage==='customer'?'Waiting on customer':r.stage==='complete'?'Confirmed / verified':'Cancelled'}</b><span className="block muted">{r.guidance}</span></p>
     <Link href={r.href} className="btn-secondary">{r.action}</Link>
    </div>
   </article>)}
   {!fail&&!rows.length&&<div className="card muted">No records match this filter. Try another module or stage.</div>}
  </section>
 </div></AdminShell>
}
