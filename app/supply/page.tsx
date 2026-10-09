import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { requireUser } from '@/lib/auth'
import { BrandLogo } from '@/components/brand-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Flash } from '@/components/flash'
import { SubmitButton } from '@/components/submit-button'
import { createSupplyDispatch,sealSupplyDispatch,carrierAcknowledgeSupplyDispatch } from '@/app/actions/supply'

export const dynamic='force-dynamic'
export const metadata:Metadata={robots:{index:false,follow:false,noarchive:true}}

export default async function SupplyPage({searchParams}:{searchParams:Promise<{source_kind?:string;source_id?:string;error?:string;notice?:string}>}){
  const {supabase,user}=await requireUser();const sp=await searchParams
  const [{data:sources,error:sourceError},{data:dispatches,error:dispatchError},{data:communities}]=await Promise.all([
    supabase.rpc('get_my_supply_sources'),
    supabase.rpc('get_my_supply_dispatches'),
    supabase.from('communities').select('id,name').eq('active',true).order('sort_order'),
  ])
  const selected=(sources??[]).find((s:any)=>s.source_kind===sp.source_kind&&s.source_id===sp.source_id)??(sources??[])[0]
  const {data:products,error:productError}=selected
    ?await supabase.rpc('get_supply_source_products',{p_source_kind:selected.source_kind,p_source_id:selected.source_id})
    :{data:[] as any[],error:null as any}
  const manage=selected&&(
    (selected.source_kind==='supplier'&&['owner','manager'].includes(selected.member_role))
    ||(selected.source_kind==='2tbr_store'&&['manager','storekeeper'].includes(selected.member_role))
  )
  const jar=await cookies()
  let codeNotice:{dispatchId:string;code:string}|null=null
  try{const raw=jar.get('supply_handover_code')?.value;if(raw)codeNotice=JSON.parse(raw)}catch{}
  return <div className="min-h-screen bg-slate-50 text-slate-950">
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/home" className="flex items-center gap-2"><BrandLogo size={42}/><div><div className="font-black">Supply Handover</div><div className="text-xs text-slate-500">2-TAKA-R-BAZAR verified chain of custody</div></div></Link>
        <div className="flex items-center gap-2"><ThemeToggle/><Link href="/supplier" className="btn-secondary">Supplier demand</Link><Link href="/home" className="btn-secondary">Customer app</Link></div>
      </div>
    </header>
    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-5">
      <section><div className="card-title">Supply verification</div><h1 className="text-3xl font-black">Dispatch → custody → Community Ops verification</h1><p className="muted mt-1">Sealed quantities become immutable. Community Ops independently counts the batch using a one-time handover code. Mismatches are blocked from verified inventory until an independent Admin resolves them.</p></section>
      <Flash error={sp.error} notice={sp.notice}/>
      {sourceError&&<div className="error">{sourceError.message}</div>}
      {dispatchError&&<div className="error">{dispatchError.message}</div>}
      {productError&&<div className="error">{productError.message}</div>}

      {!(sources??[]).length?<section className="card"><h2 className="section-title">No supply account linked</h2><p className="muted mt-2">Admin must link your signed-in account to an approved supplier or a 2TBR Store/Warehouse before you can use Supply Handover.</p></section>:<>
        <section className="card">
          <div className="card-title">Authorized source</div>
          <div className="mt-3 flex flex-wrap gap-2">{(sources??[]).map((s:any)=><Link className={'chip '+(selected?.source_id===s.source_id&&selected?.source_kind===s.source_kind?'border-cyan-400 bg-cyan-50':'')} key={s.source_kind+'-'+s.source_id} href={'/supply?source_kind='+encodeURIComponent(s.source_kind)+'&source_id='+encodeURIComponent(s.source_id)}>{s.source_name} · {s.member_role}</Link>)}</div>
        </section>

        {codeNotice&&<section className="card border-emerald-300 bg-emerald-50">
          <div className="card-title text-emerald-700">One-time receiving code</div>
          <h2 className="mt-1 text-xl font-black">{codeNotice.dispatchId}</h2>
          <div className="mt-3 inline-flex rounded-xl border-2 border-emerald-400 bg-white px-5 py-3 font-mono text-3xl font-black tracking-[.25em]">{codeNotice.code}</div>
          <p className="mt-3 text-sm font-bold text-emerald-900">Give this code only to the assigned Community Ops officer after they physically receive and count the goods. It expires in 24 hours and is one-time use.</p>
        </section>}

        {manage&&<section className="card">
          <div className="card-title">Create dispatch</div><h2 className="mt-1 text-xl font-black">{selected.source_name}</h2>
          <p className="muted mt-1 text-sm">Add up to 8 products here. Duplicate products are rejected. After sealing, quantities cannot be edited.</p>
          <form action={createSupplyDispatch} className="mt-4 grid gap-3">
            <input type="hidden" name="source_kind" value={selected.source_kind}/><input type="hidden" name="source_id" value={selected.source_id}/>
            <label><span className="label">Destination community</span><select className="input" name="community_id" required><option value="">Choose community</option>{(communities??[]).map((c:any)=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
            <div className="grid gap-2">{Array.from({length:8}).map((_,i)=><div className="grid gap-2 sm:grid-cols-[1fr_150px]" key={i}><select className="input" name="product_id" required={i===0}><option value="">{i===0?'Product':'Optional product'}</option>{(products??[]).map((p:any)=><option key={p.product_id} value={p.product_id}>{p.product_name} · {p.package_size} · {p.sku}</option>)}</select><input className="input" type="number" min="1" max="100000" name="quantity" placeholder="Quantity" required={i===0}/></div>)}</div>
            <textarea className="input min-h-20" name="notes" placeholder="Dispatch note / invoice / vehicle / batch reference"/>
            <SubmitButton>Create draft dispatch</SubmitButton>
          </form>
        </section>}

        <section className="grid gap-3">
          <div><div className="card-title">My supply chain</div><h2 className="section-title">Recent dispatches</h2></div>
          {(dispatches??[]).length===0?<div className="card muted">No dispatches yet.</div>:(dispatches??[]).map((d:any)=><article className="card" key={d.dispatch_id}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-black">{d.dispatch_code}</h3><p className="muted">{d.source_name} → {d.destination_name}</p><p className="muted text-xs">{new Date(d.created_at).toLocaleString('en-BD')}</p></div><span className="chip capitalize">{String(d.status).replaceAll('_',' ')}</span></div>
            <div className="mt-3 grid gap-2">{(d.items??[]).map((i:any)=><div className="flex justify-between border-t border-slate-100 pt-2 text-sm" key={i.product_id}><span>{i.product_name} · {i.package_size}</span><b>× {i.quantity}</b></div>)}</div>
            {d.package_count!=null&&<div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">Packages <b>{d.package_count}</b>{d.seal_reference?<> · Seal <b>{d.seal_reference}</b></>:null}</div>}
            {d.variance_reason&&<div className="error mt-3">{d.variance_reason}</div>}
            {d.resolution&&<div className="success mt-3">Admin resolution: {String(d.resolution).replaceAll('_',' ')}</div>}
            {d.status==='draft'&&d.source_kind==='supplier'&&!d.authorized_at&&<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">Waiting for independent 2-TAKA-R-BAZAR Admin authorization before this external supplier dispatch can be sealed.</div>}
            {d.status==='draft'&&manage&&selected?.source_name===d.source_name&&(d.source_kind!=='supplier'||d.authorized_at)&&<form action={sealSupplyDispatch} className="mt-4 grid gap-2 sm:grid-cols-[150px_1fr_auto] sm:items-end"><input type="hidden" name="dispatch_id" value={d.dispatch_id}/><label><span className="label">Package count</span><input className="input" type="number" min="1" max="10000" name="package_count" required/></label><label><span className="label">Physical seal reference</span><input className="input" name="seal_reference" placeholder="Tamper seal/bag number (optional)"/></label><SubmitButton>Seal & generate code</SubmitButton></form>}
            {d.status==='sealed'&&d.carrier_user_id===user.id&&<form action={carrierAcknowledgeSupplyDispatch} className="mt-4"><input type="hidden" name="dispatch_id" value={d.dispatch_id}/><SubmitButton>Acknowledge carrier custody</SubmitButton></form>}
          </article>)}
        </section>
      </>}
    </main>
  </div>
}
