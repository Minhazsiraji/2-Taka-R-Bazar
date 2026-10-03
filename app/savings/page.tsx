import { AppShell } from '@/components/app-shell'
import { ProductImage } from '@/components/product-image'
import { requireOnboardedUser } from '@/lib/auth'
import { taka, shortDate } from '@/lib/format'

export const dynamic='force-dynamic'
export default async function SavingsPage(){
  const {user,roles,supabase}=await requireOnboardedUser()
  const {data:rows}=await supabase.from('savings_ledger').select('*,order_items(products(name,package_size,image_url)),orders(order_code)').eq('customer_id',user.id).order('verified_at',{ascending:false})
  const now=new Date();const monthStart=new Date(now.getFullYear(),now.getMonth(),1).toISOString()
  const month=(rows??[]).filter((r:any)=>r.verified_at>=monthStart).reduce((s:number,r:any)=>s+Number(r.amount),0)
  const lifetime=(rows??[]).reduce((s:number,r:any)=>s+Number(r.amount),0)
  return <AppShell roles={roles}><div className="grid min-w-0 gap-5">
    <section><h1 className="text-2xl font-black sm:text-3xl">My savings</h1><p className="muted">Verified only from fulfilled, collected items.</p></section>
    <div className="grid gap-3 sm:grid-cols-2"><div className="card"><div className="card-title">This month</div><div className="metric text-emerald-700">{taka(month)}</div></div><div className="card"><div className="card-title">Lifetime</div><div className="metric">{taka(lifetime)}</div></div></div>
    <section className="grid gap-3"><h2 className="section-title">Savings history</h2>{(rows??[]).length===0?<div className="card muted">Your first verified saving will appear after pickup.</div>:(rows??[]).map((r:any)=>{const product=r.order_items?.products;return <div className="card min-w-0" key={r.id}><div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-4"><ProductImage src={product?.image_url} name={product?.name} variant="thumb"/><div className="min-w-0"><b className="block">{product?.name}</b><p className="muted text-sm">{product?.package_size} · {r.orders?.order_code} · {shortDate(r.verified_at)} · Qty {r.fulfilled_quantity}</p><p className="muted text-sm">Benchmark {taka(r.benchmark_price)} → Pool {taka(r.pool_unit_price)}</p></div><b className="text-right text-lg text-emerald-700 sm:text-xl">+{taka(r.amount)}</b></div></div>})}</section>
  </div></AppShell>
}
