import { AppShell } from '@/components/app-shell'
import { ProductImage } from '@/components/product-image'
import { requireOnboardedUser } from '@/lib/auth'
import { taka, shortDate } from '@/lib/format'

export const dynamic='force-dynamic'

export default async function SavingsPage(){
  const {user,roles,supabase}=await requireOnboardedUser()
  const [{data:rows},{data:completedOrders}]=await Promise.all([
    supabase.from('savings_ledger').select('*,order_items(products(name,package_size,image_url)),orders(order_code)').eq('customer_id',user.id).order('verified_at',{ascending:false}),
    supabase.from('orders').select('id,delivery_fee,fulfillment_method,completed_at').eq('customer_id',user.id).eq('status','completed'),
  ])

  const now=new Date()
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1).toISOString()
  const monthProduct=(rows??[]).filter((r:any)=>r.verified_at>=monthStart).reduce((s:number,r:any)=>s+Number(r.amount),0)
  const lifetimeProduct=(rows??[]).reduce((s:number,r:any)=>s+Number(r.amount),0)
  const monthDelivery=(completedOrders??[]).filter((o:any)=>o.completed_at&&o.completed_at>=monthStart).reduce((s:number,o:any)=>s+Number(o.delivery_fee??0),0)
  const lifetimeDelivery=(completedOrders??[]).reduce((s:number,o:any)=>s+Number(o.delivery_fee??0),0)
  const monthNet=monthProduct-monthDelivery
  const lifetimeNet=lifetimeProduct-lifetimeDelivery
  const freePickupCount=(completedOrders??[]).filter((o:any)=>o.fulfillment_method!=='home_delivery').length

  return <AppShell roles={roles}>
    <div className="grid min-w-0 gap-4 sm:gap-5">
      <section className="cx-savings-hero p-4 sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-700">Proof of value</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">Your real savings</h1>
        <p className="muted mt-1 text-sm">Product savings are verified only after fulfilment. Optional home-delivery fees stay visible so your net saving is honest.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-2xl border border-emerald-200/70 bg-white/55 p-4">
            <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Net saving this month</div>
            <div className={'mt-1 text-4xl font-black '+(monthNet>=0?'text-emerald-700':'text-rose-700')}>{taka(monthNet)}</div>
            <p className="muted mt-1 text-xs">Product saving {taka(monthProduct)} − delivery {taka(monthDelivery)}</p>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/45 p-4">
            <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Lifetime net saving</div>
            <div className="mt-1 text-2xl font-black">{taka(lifetimeNet)}</div>
            <p className="muted mt-1 text-xs">{taka(lifetimeProduct)} verified product saving</p>
          </div>
        </div>

        <div className="cx-compact-strip mt-3">
          <span className="cx-compact-chip">Products saved {taka(monthProduct)}</span>
          <span className="cx-compact-chip">Delivery paid {taka(monthDelivery)}</span>
          <span className="cx-compact-chip text-emerald-700">FREE pickup used {freePickupCount}×</span>
        </div>
      </section>

      <section className="grid gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Verified history</p><h2 className="mt-1 text-xl font-black">Where you saved</h2></div>

        {(rows??[]).length===0
          ? <div className="card p-6 text-center"><div className="text-3xl">🪙</div><h3 className="mt-3 text-lg font-black">Your first saving is ahead</h3><p className="muted mt-2 text-sm">Verified product savings appear here after an order is successfully fulfilled.</p></div>
          : (rows??[]).map((r:any)=>{
              const product=r.order_items?.products
              return <div className="card min-w-0 p-3 sm:p-4" key={r.id}>
                <div className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[76px_minmax(0,1fr)_auto]">
                  <ProductImage src={product?.image_url} name={product?.name} variant="thumb" className="!h-14 !w-16 sm:!h-16 sm:!w-20"/>
                  <div className="min-w-0">
                    <b className="block text-sm sm:text-base">{product?.name}</b>
                    <p className="muted mt-1 text-xs">{product?.package_size} · Qty {r.fulfilled_quantity} · {shortDate(r.verified_at)}</p>
                    <p className="muted mt-1 text-[11px]">Market {taka(r.benchmark_price)} → 2TBR {taka(r.pool_unit_price)} · {r.orders?.order_code}</p>
                  </div>
                  <b className="text-right text-lg text-emerald-700 sm:text-xl">+{taka(r.amount)}</b>
                </div>
              </div>
            })}
      </section>
    </div>
  </AppShell>
}
