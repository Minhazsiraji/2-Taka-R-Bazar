import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { OrderJourney } from '@/components/order-journey'
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
  const {data:poolPickupRows}=poolIds.length
    ? await supabase.from('pool_pickup_points').select('pool_id,pickup_points(id,name,address)').in('pool_id',poolIds)
    : {data:[] as any[]}

  const pickupsByPool=new Map<string,any[]>()
  ;(poolPickupRows??[]).forEach((row:any)=>{
    const point=row.pickup_points
    if(!point)return
    if(!pickupsByPool.has(row.pool_id))pickupsByPool.set(row.pool_id,[])
    pickupsByPool.get(row.pool_id)!.push(point)
  })

  const existingOrderByPool=new Map((orders??[]).map((o:any)=>[o.pool_id,o]))
  const activeOrders=(orders??[]).filter((o:any)=>!['completed','cancelled'].includes(o.status))
  const pastOrders=(orders??[]).filter((o:any)=>['completed','cancelled'].includes(o.status))

  const renderOrder=(o:any)=>{
    const marketValue=(o.order_items??[]).reduce((sum:number,i:any)=>sum+Number(i.benchmark_price_snapshot)*Number(i.quantity),0)
    const productSubtotal=Number(o.product_subtotal??(o.order_items??[]).reduce((sum:number,i:any)=>sum+Number(i.unit_price)*Number(i.quantity),0))
    const productSaving=Math.max(0,marketValue-productSubtotal)
    const deliveryFee=Number(o.delivery_fee??0)

    return <article className="card min-w-0 p-4 sm:p-5" key={o.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">{o.order_code}</h3>
          <p className="muted mt-1 text-xs">Confirmed {dateTime(o.confirmed_at)}</p>
        </div>
        <StatusPill status={o.status}/>
      </div>

      {!['completed','cancelled'].includes(o.status)&&<div className="mt-3"><OrderJourney status={o.status} fulfillmentMethod={o.fulfillment_method}/></div>}

      <div className="mt-3 grid gap-2">
        {(o.order_items??[]).map((i:any)=><div className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-100 bg-white/35 p-2" key={i.id}>
          <ProductImage src={i.products?.image_url} name={i.products?.name} variant="thumb" className="!h-14 !w-16"/>
          <span className="min-w-0"><b className="block text-sm">{i.products?.name}</b><span className="muted text-xs">{i.products?.package_size} · Qty {i.quantity}</span></span>
          <b className="text-right text-sm">{taka(Number(i.unit_price)*Number(i.quantity))}</b>
        </div>)}
      </div>

      <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/45">
        <div className="p-2.5"><div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Market</div><b className="mt-1 block text-sm sm:text-base">{taka(marketValue)}</b></div>
        <div className="border-l border-emerald-100 p-2.5"><div className="text-[9px] font-black uppercase tracking-wide text-slate-500">2TBR products</div><b className="mt-1 block text-sm sm:text-base">{taka(productSubtotal)}</b></div>
        <div className="border-l border-emerald-100 p-2.5"><div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Product saving</div><b className="mt-1 block text-sm text-emerald-700 sm:text-base">{taka(productSaving)}</b></div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/55 p-3">
        <div>
          <b className="text-sm">{o.fulfillment_method==='home_delivery'?'Home delivery':'Community pickup'}</b>
          <p className="muted mt-1 text-xs">{o.fulfillment_method==='home_delivery'
            ? o.delivery_address
            : String(o.pickup_points?.name??'')+(o.pickup_points?.address?' · '+o.pickup_points.address:'')}</p>
        </div>
        <b className={o.fulfillment_method==='home_delivery'?'':'text-emerald-700'}>{o.fulfillment_method==='home_delivery'?taka(deliveryFee):'FREE'}</b>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div><div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Total payable</div><div className="mt-1 text-xl font-black">{taka(o.total_amount)}</div></div>
        {productSaving>0&&<div className="text-right text-xs font-black text-emerald-700">You kept {taka(productSaving)} product saving</div>}
      </div>

      {!['completed','cancelled'].includes(o.status)&&<details className="mt-3 border-t border-slate-200 pt-3">
        <summary className="cursor-pointer text-sm font-black text-slate-600">Need help with this order?</summary>
        <form action={reportCustomerIssue} className="mt-3 grid gap-2">
          <input type="hidden" name="order_id" value={o.id}/>
          <select className="input" name="issue_type" required>
            <option value="">Issue type</option><option value="missing">Missing item</option><option value="damaged">Damaged item</option><option value="wrong_item">Wrong item</option><option value="other">Other</option>
          </select>
          <textarea className="input min-h-24" name="description" minLength={5} maxLength={2000} required/>
          <SubmitButton className="btn-secondary">Send issue</SubmitButton>
        </form>
      </details>}
    </article>
  }

  return <AppShell roles={roles}>
    <div className="grid min-w-0 gap-4 sm:gap-5">
      <section>
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Your buying journey</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">Orders</h1>
        <p className="muted mt-1 text-sm">Track commitments, final confirmation and fulfilment without mixing delivery cost into product savings.</p>
        <div className="cx-compact-strip mt-3">
          <span className="cx-compact-chip text-emerald-700">✓ Community pickup FREE</span>
          <span className="cx-compact-chip">Home delivery ৳20 up to ৳1,000</span>
          <span className="cx-compact-chip">৳30 above ৳1,000</span>
        </div>
      </section>

      {error&&<div className="error">{error}</div>}
      {notice&&<div className="success">{notice}</div>}

      {confirmable.length>0&&<section className="grid gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-700">Action needed</p><h2 className="mt-1 text-xl font-black">Confirm the final price</h2></div>

        {confirmable.map((c:any)=>{
          const i=c.pool_items
          const pool=i.pools
          const product=i.products
          const qty=Number(c.quantity)
          const unitPrice=Number(i.final_customer_price)
          const benchmark=Number(i.benchmark_price_snapshot)
          const itemSubtotal=unitPrice*qty
          const saving=Math.max(0,benchmark-unitPrice)*qty
          const existingOrder=existingOrderByPool.get(pool?.id) as any
          const pickupOptions=pickupsByPool.get(pool?.id)??[]

          return <div className="card min-w-0 p-4 sm:p-5" key={c.id}>
            <div className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] gap-3 sm:grid-cols-[80px_minmax(0,1fr)]">
              <ProductImage src={product?.image_url} name={product?.name} variant="thumb" className="!h-16 !w-16 sm:!h-20 sm:!w-20"/>
              <div className="min-w-0">
                <span className="chip capitalize">{pool?.cadence??'weekly'} pool</span>
                <h3 className="mt-2 text-base font-black sm:text-lg">{product?.name} · {product?.package_size}</h3>
                <p className="muted mt-1 text-xs">{pool?.title} · Qty {qty}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/45">
              <div className="p-2.5"><div className="text-[9px] font-black uppercase text-slate-500">Market</div><b className="mt-1 block">{taka(benchmark*qty)}</b></div>
              <div className="border-l border-emerald-100 p-2.5"><div className="text-[9px] font-black uppercase text-slate-500">Final products</div><b className="mt-1 block">{taka(itemSubtotal)}</b></div>
              <div className="border-l border-emerald-100 p-2.5"><div className="text-[9px] font-black uppercase text-slate-500">You save</div><b className="mt-1 block text-emerald-700">{taka(saving)}</b></div>
            </div>

            <form action={confirmCommitment} className="mt-3 grid min-w-0 gap-3">
              <input type="hidden" name="commitment_id" value={c.id}/>
              <input type="hidden" name="policy_version" value={CURRENT_POLICY_VERSION}/>

              {existingOrder
                ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <input type="hidden" name="fulfillment_method" value={existingOrder.fulfillment_method??'pickup'}/>
                    <b>Same basket fulfilment</b>
                    {existingOrder.fulfillment_method==='home_delivery'
                      ? <><p className="mt-1">Home delivery · current basket fee {taka(existingOrder.delivery_fee??0)}</p><p className="muted mt-1">{existingOrder.delivery_address}</p></>
                      : <><p className="mt-1 text-emerald-700">FREE community pickup</p><p className="muted mt-1">{existingOrder.pickup_points?.name} · {existingOrder.pickup_points?.address}</p></>}
                  </div>
                : <FulfillmentChoice pickupOptions={pickupOptions} defaultAddress={profile.address_hint??''} estimatedProductSubtotal={itemSubtotal}/>}

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 sm:text-sm">
                <input className="mt-1 h-4 w-4 shrink-0" type="checkbox" name="policy_accepted" required/>
                <span>I agree to the <Link className="font-bold underline" href="/terms" target="_blank">Terms & Conditions / ব্যবহারের শর্তাবলি</Link>, <Link className="font-bold underline" href="/return-policy" target="_blank">Return Policy / রিটার্ন নীতি</Link> and <Link className="font-bold underline" href="/refund-policy" target="_blank">Refund Policy / রিফান্ড নীতি</Link>.<span className="mt-1 block text-slate-600" lang="bn">আমি প্রদর্শিত চূড়ান্ত পণ্যমূল্য এবং নির্বাচিত ডেলিভারি/পিকআপ পদ্ধতিতে এই ক্রয় নিশ্চিত করছি।</span></span>
              </label>

              <SubmitButton>Confirm purchase</SubmitButton>
            </form>
          </div>
        })}
      </section>}

      {activeOrders.length>0&&<section className="grid gap-3">
        <h2 className="text-xl font-black">Active orders</h2>
        {activeOrders.map(renderOrder)}
      </section>}

      {activeOrders.length===0&&pastOrders.length===0&&confirmable.length===0&&<section className="card p-6 text-center">
        <div className="text-3xl">🛒</div>
        <h2 className="mt-3 text-xl font-black">No active orders</h2>
        <p className="muted mx-auto mt-2 max-w-sm text-sm">Join a Pool or Group Deal. Your commitments and fulfilment progress will appear here.</p>
        <div className="mt-4 flex justify-center gap-2"><Link href="/pool" className="btn-primary">Browse Pools</Link><Link href="/group-deals" className="btn-secondary">Group Deals</Link></div>
      </section>}

      {pastOrders.length>0&&<section className="grid gap-3">
        <details>
          <summary className="cursor-pointer text-lg font-black">Completed & past orders ({pastOrders.length})</summary>
          <div className="mt-3 grid gap-3">{pastOrders.map(renderOrder)}</div>
        </details>
      </section>}
    </div>
  </AppShell>
}
