import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { taka } from '@/lib/format'
import { ThemeToggle } from '@/components/theme-toggle'
import { BrandLogo } from '@/components/brand-logo'

export const dynamic='force-dynamic'

export const metadata: Metadata = { robots: { index: false, follow: false, noarchive: true } }

export default async function SupplierPortalPage(){
  const {supabase}=await requireUser()
  const [{data:contexts,error:contextError},{data:daily,error:dailyError},{data:open,error:openError}]=await Promise.all([
    supabase.rpc('get_my_supplier_context'),
    supabase.rpc('get_supplier_demand_summary',{p_days:7}),
    supabase.rpc('get_supplier_open_demand'),
  ])

  const rows=(daily??[]) as any[]
  const weekByProduct=new Map<string,{supplier:string;name:string;sku:string;pool:number;group:number;sold:number}>()
  for(const row of rows){
    const key=String(row.supplier_id)+'|'+String(row.product_id)
    const current=weekByProduct.get(key)??{supplier:row.business_name,name:row.product_name,sku:row.sku,pool:0,group:0,sold:0}
    current.pool+=Number(row.pool_required_units||0)
    current.group+=Number(row.group_required_units||0)
    current.sold+=Number(row.sold_units||0)
    weekByProduct.set(key,current)
  }

  return <div className="min-h-screen bg-slate-50 text-slate-950">
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/home" className="flex items-center gap-2"><BrandLogo size={42}/><div><div className="font-black">Supplier Portal</div><div className="text-xs text-slate-500">2-TAKA-R-BAZAR demand network</div></div></Link>
        <div className="flex items-center gap-2"><ThemeToggle/><Link href="/supply" className="btn-secondary">Supply handover</Link><Link href="/home" className="btn-secondary">Customer app</Link></div>
      </div>
    </header>
    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-5">
      <section><p className="card-title">Verified aggregate demand</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">What customers are buying</h1><p className="muted mt-1">Only products linked to your supplier account are visible. Customer names, phones, exact locations and individual baskets are never exposed.</p></section>

      {contextError&&<div className="error">{contextError.message}</div>}
      {dailyError&&<div className="error">{dailyError.message}</div>}
      {openError&&<div className="error">{openError.message}</div>}

      {!contexts?.length?<div className="card p-5"><h2 className="text-xl font-black">Supplier access is not linked yet</h2><p className="muted mt-2">Operations must link this signed-in account to an approved supplier and approved product list.</p></div>:<>
        <div className="flex flex-wrap gap-2">{contexts.map((c:any)=><span className="chip" key={c.supplier_id}>{c.business_name} · {c.member_role}</span>)}</div>

        <section className="card p-4 sm:p-5">
          <div className="card-title">Open buying requirements</div>
          <h2 className="mt-1 text-xl font-black">Demand that is live now</h2>
          <p className="muted mt-1 text-sm">For privacy, an open requirement appears only after at least 5 qualified buyers exist.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b border-slate-200"><th className="py-2 pr-3">Source</th><th className="py-2 pr-3">Product</th><th className="py-2 pr-3">Buyers</th><th className="py-2 pr-3">Required units</th><th className="py-2 pr-3">Closes</th></tr></thead>
              <tbody>{(open??[]).map((r:any)=><tr className="border-b border-slate-100" key={String(r.supplier_id)+String(r.demand_source)+String(r.reference_id)}><td className="py-3 pr-3 capitalize">{String(r.demand_source).replaceAll('_',' ')}</td><td className="py-3 pr-3"><b>{r.product_name}</b><div className="muted text-xs">{r.sku} · {r.title}</div></td><td className="py-3 pr-3">{r.buyer_count}</td><td className="py-3 pr-3 font-black">{r.required_units}</td><td className="py-3 pr-3">{new Date(r.closes_at).toLocaleString('en-BD')}</td></tr>)}</tbody>
            </table>
            {!(open??[]).length&&<p className="muted py-4">No privacy-qualified open requirement yet.</p>}
          </div>
        </section>

        <section className="card p-4 sm:p-5">
          <div className="card-title">7-day product summary</div>
          <h2 className="mt-1 text-xl font-black">Weekly demand + sales</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[...weekByProduct.values()].map(r=><div className="rounded-xl border border-slate-200 p-4" key={r.supplier+'|'+r.sku}><b>{r.name}</b><p className="muted text-xs">{r.supplier} · {r.sku}</p><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div><div className="card-title">Pool</div><b>{r.pool}</b></div><div><div className="card-title">Group</div><b>{r.group}</b></div><div><div className="card-title">Sold</div><b>{r.sold}</b></div></div></div>)}</div>
        </section>

        <section className="card p-4 sm:p-5">
          <div className="card-title">Daily detail</div>
          <h2 className="mt-1 text-xl font-black">Last 7 days</h2>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-slate-200"><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Product</th><th className="py-2 pr-3">Pool units</th><th className="py-2 pr-3">Group units</th><th className="py-2 pr-3">Sold units</th></tr></thead><tbody>{rows.map((r:any)=><tr className="border-b border-slate-100" key={String(r.supplier_id)+String(r.product_id)+String(r.demand_date)}><td className="py-3 pr-3">{r.demand_date}</td><td className="py-3 pr-3"><b>{r.product_name}</b><div className="muted text-xs">{r.sku}</div></td><td className="py-3 pr-3">{r.pool_required_units}</td><td className="py-3 pr-3">{r.group_required_units}</td><td className="py-3 pr-3">{r.sold_units}</td></tr>)}</tbody></table></div>
        </section>
      </>}
    </main>
  </div>
}
