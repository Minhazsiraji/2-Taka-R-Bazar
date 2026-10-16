import Link from 'next/link'
import {AdminShell} from '@/components/admin-shell'
import {Flash} from '@/components/flash'
import {SubmitButton} from '@/components/submit-button'
import {EasyTierForm} from '@/components/easy-tier-form'
import {requireAdmin} from '@/lib/auth'
import {taka} from '@/lib/format'
import {utcToBangladeshInput,displayBangladeshDateTime} from '@/lib/bangladesh-datetime.mjs'
import {poolLaunchChecklist} from '@/lib/easy-business-readiness'
import {createPoolV2,updateDraftPool,setPoolPickupOptions} from '@/app/actions/pools'
import {addPoolItem,setPoolStatus} from '@/app/actions/admin'
import {publishStorefrontPool} from '@/app/actions/storefront-publication'

export const dynamic='force-dynamic'
type Search={pool?:string;notice?:string;error?:string}
const validUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Pool={id:string;community_id:string;title:string;status:string;cadence:string|null;opens_at:string|null;
 commitment_closes_at:string|null;confirmation_closes_at:string|null;supplier_delivery_at:string|null;
 pickup_at:string|null;receiving_pickup_point_id:string|null;notes:string|null;is_paused:boolean}

export default async function EasyBusiness({searchParams}:{searchParams:Promise<Search>}){
 const {supabase:db}=await requireAdmin()
 const sp=await searchParams
 const [productRes,seoRes,communityRes,supplierRes,pickupRes,poolsRes]=await Promise.all([
  db.from('products').select('id,name,package_size,source_type,active,is_demo').eq('active',true).eq('is_demo',false).order('name').limit(150),
  db.from('product_seo_content').select('product_id,status').eq('status','published').limit(150),
  db.from('communities').select('id,name').eq('active',true).order('sort_order'),
  db.from('suppliers').select('id,business_name').eq('active',true).order('business_name'),
  db.from('pickup_points').select('id,community_id,name,address').eq('active',true).order('name'),
  db.from('pools').select('id,community_id,title,status,cadence,opens_at,commitment_closes_at,confirmation_closes_at,supplier_delivery_at,pickup_at,receiving_pickup_point_id,notes,is_paused').order('created_at',{ascending:false}).limit(30)
 ])
 const criticalError=productRes.error||communityRes.error||poolsRes.error
 const products=productRes.data??[],publishedIds=new Set((seoRes.data??[]).map(r=>r.product_id))
 const communities=communityRes.data??[],suppliers=supplierRes.data??[],pickups=pickupRes.data??[],pools=(poolsRes.data??[]) as Pool[]
 const selection=validUuid.test(sp.pool??'')?sp.pool:null
 const pool=pools.find(p=>p.id===selection)??pools.find(p=>p.status==='draft')??pools.find(p=>p.status==='open')??null
 const poolId=pool?.id??null
 const [itemsRes,benchmarkRes,pickupOptionsRes,publicationRes]=await Promise.all([
  poolId?db.from('pool_items').select('id,product_id,benchmark_price_snapshot,pricing_mode,active').eq('pool_id',poolId):Promise.resolve({data:[],error:null}),
  db.from('market_price_benchmarks').select('product_id,community_id,benchmark_price').eq('approved',true).is('superseded_at',null),
  poolId?db.from('pool_pickup_points').select('pickup_point_id').eq('pool_id',poolId):Promise.resolve({data:[],error:null}),
  poolId?db.from('pool_storefront_publication').select('published,featured_product_ids').eq('pool_id',poolId).maybeSingle():Promise.resolve({data:null,error:null})
 ])
 // Benchmark result is the second element above; keep the separate query explicit.
 const benchmarks=benchmarkRes.data??[]
 const items=itemsRes.data??[]
 const itemIds=items.map(i=>i.id)
 const tierRes=itemIds.length?await db.from('supplier_quotes')
  .select('id,pool_item_id,quote_phase,threshold_quantity,customer_ceiling_price,landed_unit_price')
  .in('pool_item_id',itemIds).eq('quote_phase','planning_tier'):({data:[],error:null})
 const quotes=tierRes.data??[]
 const poolPickups=new Set((pickupOptionsRes.data??[]).map(p=>p.pickup_point_id))
 const featured=publicationRes.data
 const benchmarkByProduct=new Map((benchmarks??[]).filter(b=>b.community_id===pool?.community_id)
  .map(b=>[b.product_id,Number(b.benchmark_price)]))
 const productsById=new Map(products.map(p=>[p.id,p]))
 const readyProducts=products.filter(p=>benchmarkByProduct.has(p.id)&&publishedIds.has(p.id)&&!items.some(i=>i.product_id===p.id))
 const community=communities.find(c=>c.id===pool?.community_id)
 const communityPickups=pickups.filter(p=>p.community_id===pool?.community_id)
 const getTiers=(id:string)=>quotes.filter(q=>q.pool_item_id===id).sort((a,b)=>Number(a.threshold_quantity)-Number(b.threshold_quantity))
 const supplierTierCounts=items.filter(i=>productsById.get(i.product_id)?.source_type==='SUPPLIER_POOL').map(i=>getTiers(i.id).length)
 const ownPricingReady=items.filter(i=>productsById.get(i.product_id)?.source_type!=='SUPPLIER_POOL').every(i=>Boolean(i.pricing_mode))
 const progress=pool?poolLaunchChecklist({pool,itemCount:items.length,
  supplierItemTierCounts:supplierTierCounts,ownPricingReady,
  pickupCount:poolPickups.size,receivingIncluded:Boolean(pool.receiving_pickup_point_id&&poolPickups.has(pool.receiving_pickup_point_id)),homePublished:featured?.published??false}):null
 const loadError=criticalError||itemsRes.error||benchmarkRes.error||tierRes.error||pickupOptionsRes.error||publicationRes.error||seoRes.error||supplierRes.error||pickupRes.error

 return <AdminShell><div className="grid min-w-0 gap-4">
  <section className="card">
   <div className="card-title">OWNER & OPERATIONS · EASY BUSINESS MODE</div>
   <h1 className="mt-1 text-2xl font-black sm:text-3xl">Get a product ready to sell</h1>
   <p className="muted mt-2">One guided place for products, local offers, verified pricing and publication. Your existing brand design and Finance approvals stay unchanged.</p>
   <div className="mt-4 flex flex-wrap gap-2">
    <Link className="btn-primary" href="/admin/products">+ Add a product</Link>
    <Link className="btn-secondary" href="/admin/orders">Orders</Link>
    <Link className="btn-secondary" href="/admin/treasury">Finance requests</Link>
    <details className="relative self-center"><summary className="chip cursor-pointer">Advanced tools</summary><div className="mt-2 flex flex-wrap gap-2">
     <Link className="chip" href="/admin/pools/workflow">Advanced Pool workflow</Link>
     <Link className="chip" href="/admin/market-prices">Market price evidence</Link>
     <Link className="chip" href="/admin/suppliers">Suppliers</Link>
    </div></details>
   </div>
  </section>
  <Flash notice={sp.notice} error={sp.error}/>
  {loadError&&<div className="error" role="alert">Some operational data could not be loaded. Please refresh before making changes. Nothing was published.</div>}
  {!loadError&&<>
  <section className="card" aria-labelledby="easy-step-one">
   <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="easy-step-one" className="text-xl font-black">1. Choose your product</h2><span className="chip">{products.filter(p=>publishedIds.has(p.id)).length} published</span></div>
   <p className="muted mt-2 text-sm">Published product details are already visible in All Products. A local selling offer is separate.</p>
   <div className="mt-3 grid gap-2 sm:grid-cols-2">
    {products.filter(p=>publishedIds.has(p.id)).slice(0,10).map(p=><div key={p.id} className="rounded-xl border border-slate-200 bg-white/60 p-3">
     <b className="block truncate">{p.name}</b><p className="muted text-xs">{p.package_size} · Published</p>
    </div>)}
   </div>
   {!products.some(p=>publishedIds.has(p.id))&&<p className="notice mt-3">No published products yet. Add a product, verify its facts, and publish its information first.</p>}
   <Link className="mt-3 inline-block text-sm font-bold text-cyan-800 underline" href="/admin/products">Manage products and images →</Link>
  </section>

  <section className="card" aria-labelledby="easy-step-two">
   <h2 id="easy-step-two" className="text-xl font-black">2. Choose where to sell</h2>
   <p className="muted mt-2 text-sm">One Pool belongs to one community. Your product information stays visible in all areas. Local availability is shown only through eligible offers.</p>
   <div className="mt-3 flex flex-wrap gap-2">
    {pools.filter(p=>!['completed','cancelled'].includes(p.status)).slice(0,10).map(p=><Link key={p.id} href={'/admin/easy-business?pool='+p.id}
     className={p.id===pool?.id?'btn-primary':'btn-secondary'}>{p.title} · {p.status==='open'?'Open':p.status==='draft'?'Draft':p.status.replaceAll('_',' ')}</Link>)}
   </div>
   <details className="mt-4 rounded-xl border border-slate-200 p-3" open={!pool}>
    <summary className="cursor-pointer font-bold">+ Create a new local offer (Pool)</summary>
    <form action={createPoolV2} className="mt-3 grid gap-3 sm:grid-cols-2">
     <input type="hidden" name="return_to" value="/admin/easy-business"/>
     <label><span className="label">Community / selling area</span><select className="input" name="community_id" required defaultValue=""><option value="">Choose community</option>{communities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
     <label><span className="label">Pool cycle</span><select className="input" name="cadence" defaultValue="weekly"><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
     <label className="sm:col-span-2"><span className="label">Offer title</span><input className="input" name="title" required placeholder="Weekly community groceries"/></label>
     <details className="sm:col-span-2 rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-bold">Optional: schedule and receiving point (Bangladesh time UTC+06)</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
       {([['opens_at','Opens at'],['commitment_closes_at','Commitment closes'],['confirmation_closes_at','Confirmation closes'],['supplier_delivery_at','Supplier delivery'],['pickup_at','Customer pickup']] as const).map(([name,label])=><label key={name}><span className="label">{label}</span><input className="input" name={name} type="datetime-local"/></label>)}
       <label><span className="label">Supplier receiving point</span><select className="input" name="receiving_pickup_point_id" defaultValue=""><option value="">Choose after creating area</option>{pickups.map(p=><option key={p.id} value={p.id}>{p.name} · {communities.find(c=>c.id===p.community_id)?.name}</option>)}</select></label>
      </div>
     </details>
     <div className="sm:col-span-2"><SubmitButton>Create Draft Pool</SubmitButton></div>
    </form>
   </details>
   {!communities.length&&<p className="notice mt-3">No active communities. <Link className="underline" href="/admin/communities">Configure a selling area first →</Link></p>}
  </section>

  {pool&&progress&&<section className="card" id="easy-active-pool" aria-labelledby="easy-step-three">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div><div className="card-title">{community?.name??'Community'} · {pool.cadence}</div><h2 id="easy-step-three" className="mt-1 text-xl font-black">3. Prepare: {pool.title}</h2></div>
    <span className="chip">{pool.status==='open'?(progress.scheduled?'Scheduled':progress.live?'Open':'Open'):pool.status.toUpperCase()}</span>
   </div>
   <div className="mt-3 grid gap-2 sm:grid-cols-2">
    {progress.requirements.map(check=><div key={check.key} className="rounded-xl border border-slate-200 bg-white/60 p-3">
     <b>{check.ok?'✓':'○'} {check.label}</b>
     {!check.ok&&<p className="muted mt-1 text-xs">{check.help}</p>}
    </div>)}
   </div>
   <p className="muted mt-2 text-sm">{progress.readyCount}/5 basic preparation checks complete. The database still performs all final security and commercial validation.</p>

   {pool.status==='draft'&&<div className="mt-4 grid gap-4">
    <div className="rounded-xl border border-slate-200 p-3">
     <h3 className="font-black">Add products to this Pool</h3>
     {readyProducts.length>0?<form action={addPoolItem} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-end">
      <input type="hidden" name="return_to" value="/admin/easy-business"/><input type="hidden" name="pool_id" value={pool.id}/>
      <label><span className="label">Published product with verified local benchmark</span><select className="input" name="product_id" required defaultValue=""><option value="">Choose product</option>{readyProducts.map(p=><option value={p.id} key={p.id}>{p.name} · {taka(benchmarkByProduct.get(p.id)??0)} benchmark</option>)}</select></label>
      <label><span className="label">Max / buyer</span><input name="max_quantity" className="input" type="number" min="1" defaultValue="20"/></label>
      <SubmitButton className="btn-primary">Add</SubmitButton>
     </form>:<p className="notice mt-3">No additional approved products are eligible for this area. Verify the local market price before adding a product. <Link className="underline font-bold" href="/admin/market-prices">Market prices →</Link></p>}
    </div>
    {items.map(item=>{
     const product=productsById.get(item.product_id),tier=getTiers(item.id),benchmark=Number(item.benchmark_price_snapshot??0)
     return <div key={item.id} className="rounded-xl border border-slate-200 p-3">
      <h3 className="font-black">{product?.name??'Product'} · Price planning</h3>
      <p className="muted text-sm">Approved local benchmark {taka(benchmark)} · {tier.length} price tiers saved</p>
      {!!tier.length&&<div className="mt-3 grid gap-2">{tier.map(q=><div key={q.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-200 p-2 text-sm">
       <span><b>{q.threshold_quantity}+ units</b> · customer price ceiling {taka(Number(q.customer_ceiling_price))}</span>
       <span>Gross contribution {taka(Number(q.customer_ceiling_price)-Number(q.landed_unit_price))}/unit</span>
      </div>)}</div>}
      {product?.source_type==='SUPPLIER_POOL'?
       tier.length<3?<EasyTierForm poolId={pool.id} itemId={item.id} suppliers={suppliers} benchmark={benchmark} count={tier.length}/>:<p className="muted mt-2">Three pricing tiers already configured.</p>:
       <div className="notice mt-3">Own-product pricing follows its existing stock and margin controls. <Link className="underline" href={'/admin/pools/workflow#pool-'+pool.id}>Set up own-product price →</Link></div>}
     </div>
    })}
    <details className="rounded-xl border border-slate-200 p-3">
     <summary className="cursor-pointer font-black">Schedule & receiving point — Bangladesh time (UTC+06)</summary>
     <form action={updateDraftPool} className="mt-3 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="return_to" value="/admin/easy-business"/><input type="hidden" name="pool_id" value={pool.id}/>
      <label className="sm:col-span-2"><span className="label">Pool title</span><input name="title" className="input" required defaultValue={pool.title}/></label>
      <label><span className="label">Cycle</span><select className="input" name="cadence" defaultValue={pool.cadence??'weekly'}><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
      <label><span className="label">Supplier receiving point</span><select className="input" name="receiving_pickup_point_id" defaultValue={pool.receiving_pickup_point_id??''}><option value="">Choose pickup location</option>{communityPickups.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      {([['opens_at','Opens at'],['commitment_closes_at','Commitment closes'],['confirmation_closes_at','Confirmation closes'],['supplier_delivery_at','Supplier delivery'],['pickup_at','Customer pickup']] as const).map(([name,label])=><label key={name}><span className="label">{label}</span><input className="input" name={name} type="datetime-local" defaultValue={utcToBangladeshInput(pool[name])}/></label>)}
      <label className="sm:col-span-2"><span className="label">Internal notes</span><textarea className="input min-h-20" name="notes" defaultValue={pool.notes??''}/></label>
      <div className="sm:col-span-2"><SubmitButton>Save schedule</SubmitButton></div>
     </form>
    </details>
   </div>}

   {['draft','open','pricing','final_price','confirmation'].includes(pool.status)&&<details className="mt-4 rounded-xl border border-slate-200 p-3" open={pool.status==='draft'&&poolPickups.size===0}>
    <summary className="cursor-pointer font-black">Customer pickup choices ({poolPickups.size} selected)</summary>
    <form action={setPoolPickupOptions} className="mt-3 grid gap-2 sm:grid-cols-2">
     <input type="hidden" name="pool_id" value={pool.id}/><input type="hidden" name="return_to" value="/admin/easy-business"/>
     {communityPickups.map(p=><label key={p.id} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white/70 p-3 text-sm">
      <input type="checkbox" name="pickup_point_ids" value={p.id} defaultChecked={poolPickups.has(p.id)}/>
      <span><b>{p.name}</b><span className="muted block">{p.address}</span>{p.id===pool.receiving_pickup_point_id&&<span className="text-xs font-bold text-emerald-700">Supplier receiving point</span>}</span>
     </label>)}
     <div className="sm:col-span-2"><SubmitButton className="btn-secondary">Save pickup options</SubmitButton></div>
    </form>
   </details>}
  </section>}

  {pool&&progress&&<section className="card" aria-labelledby="easy-step-four">
   <h2 id="easy-step-four" className="text-xl font-black">4. Open & show on storefront</h2>
   <p className="muted mt-2 text-sm">A Pool being Open does not automatically mean it has started. Homepage featuring is a separate visibility setting. This never enables Production purchases.</p>
   {pool.status==='draft'&&<div className="mt-4">
    {progress.canOpen?<form action={setPoolStatus}>
     <input type="hidden" name="return_to" value="/admin/easy-business"/><input type="hidden" name="pool_id" value={pool.id}/><input type="hidden" name="status" value="open"/>
     <SubmitButton confirmMessage="Open this Pool for your community? Existing database rules and the scheduled start time will still apply.">Open community Pool</SubmitButton>
    </form>:<div className="notice">Finish the checks above first. The system will not publish incomplete pricing or missing pickup information.</div>}
   </div>}
   {pool.status==='open'&&<p className="notice mt-3">{progress.scheduled?
    'Scheduled: this Pool opens at '+displayBangladeshDateTime(pool.opens_at)+'. It is not live yet.':
    'Pool status is Open. Public visibility still depends on schedule, availability, and homepage publication.'}</p>}
   {pool.status!=='draft'&&items.length>0&&!['cancelled','completed'].includes(pool.status)&&<form action={publishStorefrontPool} className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
    <input name="return_to" type="hidden" value="/admin/easy-business"/><input type="hidden" name="pool_id" value={pool.id}/>
    <h3 className="font-black sm:col-span-2">Homepage featured Pool</h3>
    {([0,1,2] as const).map(n=><label key={n}><span className="label">Product image {n+1}</span><select className="input" name="product_ids" defaultValue={featured?.featured_product_ids?.[n]??''}><option value="">None</option>{items.filter(i=>i.active&&productsById.has(i.product_id)).map(i=><option key={i.id} value={i.product_id}>{productsById.get(i.product_id)?.name}</option>)}</select></label>)}
    <label><span className="label">Display order</span><input className="input" type="number" name="sort_order" defaultValue="100"/></label>
    <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={featured?.published??false}/>Publish on Home</label>
    <div className="sm:col-span-2"><SubmitButton>Save homepage publication</SubmitButton></div>
    <p className="muted text-xs sm:col-span-2">Featuring changes presentation only. It does not change price, supplier quote, inventory or checkout approval.</p>
   </form>}
   {pool.status==='cancelled'&&<p className="notice mt-3">Cancelled Pools are archived, not reopened automatically. Create a new Pool for another offer.</p>}
   <div className="mt-4 flex flex-wrap gap-2">
    <Link className="btn-secondary" href={'/admin/pools/'+pool.id}>Pool details</Link>
    <Link className="btn-secondary" href={'/admin/pools/workflow#pool-'+pool.id}>Advanced operations</Link>
    <Link className="btn-secondary" href="/">View customer storefront</Link>
   </div>
  </section>}
  </>}
  <div className="notice"><b>Financial safety stays ON.</b> Verified costs and planning prices are not financial postings. Independent maker-checker, procurement, refund, ledger and bank controls remain in their existing protected workflows. Checkout remains disabled until qualified.</div>
 </div></AdminShell>
}
