import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { ProductImage } from '@/components/product-image'
import { StatusPill } from '@/components/status-pill'
import { SubmitButton } from '@/components/submit-button'
import { FulfillmentChoice } from '@/components/fulfillment-choice'
import { confirmCommitment, reportCustomerIssue } from '@/app/actions/customer'
import { requireOnboardedUser } from '@/lib/auth'
import { taka, dateTime } from '@/lib/format'
import { CURRENT_POLICY_VERSION } from '@/lib/legal'

export const dynamic='force-dynamic'

export default async function OrdersPage({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {user,profile,roles,supabase}=await requireOnboardedUser()
  const {error,notice}=await searchParams
  const [{data:commitments},{data:orders}]=await Promise.all([
    supabase.from('commitments').select('*,pool_items(*,products(name,package_size,image_url),pools(id,title,status,cadence))').eq('customer_id',user.id).order('committed_at',{ascending:false}),
    supabase.from('orders').select('*,pickup_points(id,name,address,google_maps_url),order_items(*,products(name,package_size,image_url))').eq('customer_id',user.id).order('created_at',{ascending:false}),
  ])
  const confirmable=(commitments??[]).filter((c:any)=>c.status==='active'&&c.pool_items?.pools?.status==='confirmation')
  const poolIds=[...new Set(confirmable.map((c:any)=>c.pool_items?.pools?.id).filter(Boolean))] as string[]
  const {data:poolPickupRows}=poolIds.length?await supabase.from('pool_pickup_points').select('pool_id,pickup_points(id,name,address)').in('pool_id',poolIds):{data:[] as any[]}
  const pickupsByPool=new Map<string,any[]>()
  ;(poolPickupRows??[]).forEach((row:any)=>{const point=row.pickup_points;if(!point)return;if(!pickupsByPool.has(row.pool_id))pickupsByPool.set(row.pool_id,[]);pickupsByPool.get(row.pool_id)!.push(point)})
  const existingOrderByPool=new Map((orders??[]).map((o:any)=>[o.pool_id,o]))

  return <AppShell roles={roles}><div className="grid min-w-0 gap-5">
    <section><h1 className="text-2xl font-black sm:text-3xl">My commitments & orders</h1><p className="muted">Confirm only after the final pooled price is published. Product savings stay separate from the optional home-delivery service.</p></section>
    {error&&<div className="error">{error}</div>}{notice&&<div className="success">{notice}</div>}
    <div className="notice"><b>Delivery rule</b><p className="mt-1">Community delivery-point collection is <b>FREE</b>. Home delivery inside your community is <b>৳20</b> for a confirmed product basket of ৳1,000 or less and <b>৳30</b> above ৳1,000.</p></div>

    {confirmable.length>0&&<section className="grid gap-3"><h2 className="section-title">Final price needs your confirmation</h2>
      {confirmable.map((c:any)=>{
        const i=c.pool_items;const pool=i.pools;const product=i.products;const qty=Number(c.quantity)
        const unitPrice=Number(i.final_customer_price);const benchmark=Number(i.benchmark_price_snapshot)
        const itemSubtotal=unitPrice*qty;const saving=Math.max(0,benchmark-unitPrice)*qty
        const existingOrder=existingOrderByPool.get(pool?.id) as any
        const pickupOptions=pickupsByPool.get(pool?.id)??[]
        return <div className="card min-w-0" key={c.id}><div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,390px)] lg:items-start">
          <div className="grid min-w-0 gap-3"><div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 sm:gap-4"><ProductImage src={product?.image_url} name={product?.name} variant="thumb"/><div className="min-w-0"><div className="flex flex-wrap gap-2"><span className="chip capitalize">{pool?.cadence??'weekly'}</span></div><b className="mt-2 block text-lg">{product?.name} · {product?.package_size}</b><p className="muted">{pool?.title} · Quantity {qty}</p></div></div>
            <div className="grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 sm:grid-cols-3"><div><div className="card-title">Market value</div><b>{taka(benchmark*qty)}</b></div><div><div className="card-title">2-TBR product price</div><b>{taka(itemSubtotal)}</b></div><div><div className="card-title">You save on products</div><b className="text-emerald-700">{taka(saving)}</b></div></div>
          </div>
          <form action={confirmCommitment} className="grid min-w-0 gap-3">
            <input type="hidden" name="commitment_id" value={c.id}/><input type="hidden" name="policy_version" value={CURRENT_POLICY_VERSION}/>
            {existingOrder?<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><input type="hidden" name="fulfillment_method" value={existingOrder.fulfillment_method??'pickup'}/><b>Whole-basket fulfilment already selected</b>{existingOrder.fulfillment_method==='home_delivery'?<><p className="mt-1">Home delivery · current basket delivery fee {taka(existingOrder.delivery_fee??0)}</p><p className="muted mt-1">{existingOrder.delivery_address}</p></>:<><p className="mt-1">FREE community collection</p><p className="muted mt-1">{existingOrder.pickup_points?.name} · {existingOrder.pickup_points?.address}</p></>}<p className="mt-2 text-xs text-slate-500">This item will join the same Pool basket. Delivery is recalculated from the complete confirmed product subtotal.</p></div>:<FulfillmentChoice pickupOptions={pickupOptions} defaultAddress={profile.address_hint??''} estimatedProductSubtotal={itemSubtotal}/>}
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6"><input className="mt-1 h-4 w-4 shrink-0" type="checkbox" name="policy_accepted" required/><span>I agree to the <Link className="font-bold underline" href="/terms" target="_blank">Terms & Conditions / ব্যবহারের শর্তাবলি</Link>, <Link className="font-bold underline" href="/return-policy" target="_blank">Return Policy / রিটার্ন নীতি</Link>, and <Link className="font-bold underline" href="/refund-policy" target="_blank">Refund Policy / রিফান্ড নীতি</Link>.<span className="mt-1 block text-slate-600" lang="bn">আমি প্রদর্শিত চূড়ান্ত পণ্যমূল্য এবং নির্বাচিত ডেলিভারি/পিকআপ পদ্ধতিতে এই ক্রয় নিশ্চিত করছি।</span></span></label>
            <p className="text-xs leading-5 text-slate-500">Confirming creates a real order at the displayed product price. Optional home delivery is charged separately at basket level.</p>
            <SubmitButton>Confirm purchase / ক্রয় নিশ্চিত করুন</SubmitButton>
          </form>
        </div></div>
      })}
    </section>}

    <section className="grid gap-3"><h2 className="section-title">Confirmed orders</h2>{(orders??[]).length===0?<div className="card muted">No confirmed orders yet.</div>:(orders??[]).map((o:any)=>{
      const marketValue=(o.order_items??[]).reduce((sum:number,i:any)=>sum+Number(i.benchmark_price_snapshot)*Number(i.quantity),0)
      const productSubtotal=Number(o.product_subtotal??(o.order_items??[]).reduce((sum:number,i:any)=>sum+Number(i.unit_price)*Number(i.quantity),0))
      const productSaving=Math.max(0,marketValue-productSubtotal);const deliveryFee=Number(o.delivery_fee??0)
      return <article className="card min-w-0" key={o.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">{o.order_code}</h3><p className="muted">Confirmed {dateTime(o.confirmed_at)}</p></div><StatusPill status={o.status}/></div>
        <div className="mt-3 grid gap-2">{(o.order_items??[]).map((i:any)=><div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-slate-100 pt-3" key={i.id}><ProductImage src={i.products?.image_url} name={i.products?.name} variant="thumb"/><span className="min-w-0"><b className="block">{i.products?.name}</b><span className="muted text-sm">{i.products?.package_size} · Qty {i.quantity}</span></span><b className="text-right">{taka(Number(i.unit_price)*Number(i.quantity))}</b></div>)}</div>
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3"><div className="card-title">Savings board</div><div className="mt-2 grid gap-2 sm:grid-cols-3"><div><span className="muted text-xs">Market product value</span><b className="block">{taka(marketValue)}</b></div><div><span className="muted text-xs">2-TBR product subtotal</span><b className="block">{taka(productSubtotal)}</b></div><div><span className="muted text-xs">Product saving</span><b className="block text-emerald-700">{taka(productSaving)}</b></div></div></div>
        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><b>{o.fulfillment_method==='home_delivery'?'Home delivery':'Community collection'}</b><p className="muted mt-1 text-sm">{o.fulfillment_method==='home_delivery'?o.delivery_address:`${o.pickup_points?.name??''}${o.pickup_points?.address?` · ${o.pickup_points.address}`:''}`}</p></div><b>{o.fulfillment_method==='home_delivery'?taka(deliveryFee):'FREE'}</b></div></div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3"><div><span className="muted text-xs">Total payable</span><div className="text-xl font-black">{taka(o.total_amount)}</div></div><p className="muted text-xs">Product subtotal {taka(productSubtotal)} + delivery {taka(deliveryFee)}</p></div>
        {o.status!=='completed'&&o.status!=='cancelled'&&<details className="mt-4"><summary className="cursor-pointer font-bold">Report an issue</summary><form action={reportCustomerIssue} className="mt-3 grid gap-2"><input type="hidden" name="order_id" value={o.id}/><select className="input" name="issue_type" required><option value="">Issue type</option><option value="missing">Missing item</option><option value="damaged">Damaged item</option><option value="wrong_item">Wrong item</option><option value="other">Other</option></select><textarea className="input min-h-24" name="description" minLength={5} maxLength={2000} required/><SubmitButton className="btn-secondary">Send issue</SubmitButton></form></details>}
      </article>})}</section>
  </div></AppShell>
}
