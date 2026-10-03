import { AdminShell } from '@/components/admin-shell'
import { Flash } from '@/components/flash'
import { ProductImage } from '@/components/product-image'
import { SubmitButton } from '@/components/submit-button'
import { requireAdmin } from '@/lib/auth'
import { taka } from '@/lib/format'
import { upsertOwnProductWithImage as upsertOwnProduct } from '@/app/actions/product-images'
import { adjustOwnProductStock, addOwnProductToPool } from '@/app/actions/admin'

export const dynamic='force-dynamic'
const sourceLabels:Record<string,string>={DIRECT_PRODUCT:'Direct product',PRIVATE_LABEL:'2-TAKA-R-BAZAR private label',EXCLUSIVE_PARTNER:'Exclusive partner'}

function ProductFields({row}:{row?:any}){
  return <>
    <label><span className="label">Name</span><input className="input" name="name" defaultValue={row?.name??''} required/></label>
    <label><span className="label">Brand</span><input className="input" name="brand" defaultValue={row?.brand??''}/></label>
    <label><span className="label">Source type</span><select className="input" name="source_type" defaultValue={row?.source_type??'DIRECT_PRODUCT'}>{Object.entries(sourceLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <label><span className="label">Category</span><input className="input" name="category" defaultValue={row?.category??''} required/></label>
    <label><span className="label">Pack size</span><input className="input" name="package_size" defaultValue={row?.package_size??''} placeholder="1 kg" required/></label>
    <label><span className="label">Unit</span><input className="input" name="unit" defaultValue={row?.unit??''} placeholder="pack" required/></label>
    <label><span className="label">SKU</span><input className="input" name="sku" defaultValue={row?.sku??''} required/></label>
    <label className="md:col-span-2"><span className="label">Product image</span><input className="input" type="file" name="image_file" accept="image/jpeg,image/png,image/webp"/><span className="muted mt-1 block text-xs">JPEG, PNG or WebP — max 5 MB. Upload once and the same master image appears in Pools and customer views.</span></label>
    {row?.image_url&&<label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm md:col-span-2"><input className="mt-1" type="checkbox" name="remove_image"/><span><b>Remove current image</b><span className="muted block">Uploading a replacement automatically supersedes the previous managed image.</span></span></label>}
    <label><span className="label">Manufacturer / supplier ref.</span><input className="input" name="manufacturer_reference" defaultValue={row?.manufacturer_reference??''}/></label>
    <label><span className="label">Batch / lot</span><input className="input" name="batch_number" defaultValue={row?.batch_number??''}/></label>
    <label><span className="label">Manufacture date</span><input className="input" type="date" name="manufacture_date" defaultValue={row?.manufacture_date??''}/></label>
    <label><span className="label">Expiry date</span><input className="input" type="date" name="expiry_date" defaultValue={row?.expiry_date??''}/></label>
  </>
}
function CostFields({cost}:{cost?:any}){
  return <>
    <label><span className="label">Purchase / manufacturing</span><input className="input" type="number" min="0" step="0.01" name="purchase_cost" defaultValue={cost?.purchase_cost??0}/></label>
    <label><span className="label">Packaging</span><input className="input" type="number" min="0" step="0.01" name="packaging_cost" defaultValue={cost?.packaging_cost??0}/></label>
    <label><span className="label">Inbound transport</span><input className="input" type="number" min="0" step="0.01" name="inbound_transport" defaultValue={cost?.inbound_transport??0}/></label>
    <label><span className="label">Handling</span><input className="input" type="number" min="0" step="0.01" name="handling_cost" defaultValue={cost?.handling_cost??0}/></label>
    <label><span className="label">Other landed cost</span><input className="input" type="number" min="0" step="0.01" name="other_landed_cost" defaultValue={cost?.other_landed_cost??0}/></label>
  </>
}

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {supabase}=await requireAdmin(); const sp=await searchParams
  const [{data:products},{data:costs,error:costsError},{data:inventory,error:inventoryError},{data:performance,error:performanceError},{data:pools},{data:benchmarks}]=await Promise.all([
    supabase.from('products').select('*').in('source_type',['DIRECT_PRODUCT','PRIVATE_LABEL','EXCLUSIVE_PARTNER']).order('created_at',{ascending:false}),
    supabase.from('own_product_costs').select('*'), supabase.from('own_product_inventory').select('*'), supabase.from('admin_own_product_performance').select('*'),
    supabase.from('pools').select('id,title,community_id,status').eq('status','draft').order('created_at',{ascending:false}),
    supabase.from('market_price_benchmarks').select('product_id,community_id,benchmark_price').eq('approved',true).is('superseded_at',null),
  ])
  const ownProductInfrastructureReady=!costsError&&!inventoryError&&!performanceError
  const costBy=new Map((costs??[]).map((x:any)=>[x.product_id,x])),invBy=new Map((inventory??[]).map((x:any)=>[x.product_id,x])),perfBy=new Map((performance??[]).map((x:any)=>[x.product_id,x]))
  const benchmarkBy=new Map((benchmarks??[]).map((x:any)=>[`${x.product_id}:${x.community_id}`,x.benchmark_price]))
  return <AdminShell><div className="grid min-w-0 gap-5"><section><div className="card-title">Products</div><h1 className="text-2xl font-black sm:text-3xl">2-TAKA-R-BAZAR Products</h1><p className="muted mt-1">Own inventory, landed cost, Pool pricing and contribution. Internal economics are admin-only.</p></section><Flash {...sp}/>{!ownProductInfrastructureReady&&<div className="notice"><b>Own Product storage is not configured in this environment.</b><p className="mt-1">Functional Own Product testing is unavailable here. No migration or storage configuration has been applied automatically.</p></div>}
    <form action={upsertOwnProduct} className="card grid min-w-0 gap-4 p-4 sm:p-5 md:grid-cols-2"><h2 className="section-title md:col-span-2">Create own product</h2><ProductFields/><CostFields/><label><span className="label">Initial stock</span><input className="input" type="number" min="0" name="initial_stock" defaultValue="0"/></label><label className="flex items-center gap-2 self-end"><input type="checkbox" name="is_demo"/><span>Demo/test product</span></label><SubmitButton className="md:w-fit">Create own product</SubmitButton></form>

    <section className="grid gap-3">{(products??[]).map((p:any)=>{const c:any=costBy.get(p.id),i:any=invBy.get(p.id),m:any=perfBy.get(p.id);const available=Number(i?.stock_on_hand??0)-Number(i?.reserved_quantity??0);return <details className="card min-w-0 p-0" key={p.id}><summary className="cursor-pointer list-none p-3 sm:p-4"><div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:gap-4"><ProductImage src={p.image_url} name={p.name} variant="thumb"/><div className="min-w-0"><div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><b className="block truncate">{p.name}</b><p className="muted truncate">{sourceLabels[p.source_type]} · {p.package_size} · {p.sku}</p></div><div className="flex flex-wrap gap-2"><span className="chip">Stock {i?.stock_on_hand??0}</span><span className="chip">Reserved {i?.reserved_quantity??0}</span><span className="chip">Available {available}</span></div></div></div></div></summary>
      <div className="border-t border-slate-200 p-4 sm:p-5">
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(220px,.7fr)_minmax(0,1.3fr)]"><div><ProductImage src={p.image_url} name={p.name}/><p className="muted mt-2 text-xs">Master product image used automatically in Pool and customer views.</p></div><div className="min-w-0">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Landed / unit</div><b>{taka(Number(c?.total_landed_cost??0))}</b></div><div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Completed revenue</div><b>{taka(Number(m?.revenue??0))}</b></div><div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Gross contribution</div><b>{taka(Number(m?.gross_contribution??0))}</b><p className="muted">Before overhead</p></div><div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Verified customer saving</div><b>{taka(Number(m?.verified_customer_saving??0))}</b></div></div>
      <form action={upsertOwnProduct} className="mt-4 grid min-w-0 gap-4 md:grid-cols-2"><input type="hidden" name="product_id" value={p.id}/><ProductFields row={p}/><CostFields cost={c}/><label className="flex items-center gap-2"><input type="checkbox" name="is_demo" defaultChecked={p.is_demo}/><span>Demo/test</span></label><label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={p.active}/><span>Active</span></label><SubmitButton className="md:w-fit">Save product & economics</SubmitButton></form>
      </div></div>
      <form action={adjustOwnProductStock} className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[160px_1fr_auto] sm:items-end"><input type="hidden" name="product_id" value={p.id}/><label><span className="label">Stock adjustment</span><input className="input" type="number" name="delta" placeholder="+50 or -5" required/></label><label><span className="label">Reason</span><input className="input" name="reason" placeholder="Purchase received / correction" required/></label><SubmitButton>Adjust stock</SubmitButton></form>
      <form action={addOwnProductToPool} className="mt-4 grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 md:grid-cols-3"><input type="hidden" name="product_id" value={p.id}/><div className="md:col-span-3"><b>Add to a draft community Pool</b><p className="muted">The selected community must already have an approved market benchmark for this product.</p></div><label><span className="label">Draft pool</span><select className="input" name="pool_id" required><option value="">Choose pool</option>{(pools??[]).filter((pool:any)=>benchmarkBy.has(`${p.id}:${pool.community_id}`)).map((pool:any)=><option key={pool.id} value={pool.id}>{pool.title} · benchmark {taka(Number(benchmarkBy.get(`${p.id}:${pool.community_id}`)??0))}</option>)}</select></label><label><span className="label">Pricing mode</span><select className="input" name="pricing_mode" defaultValue="FIXED_POOL_PRICE"><option value="FIXED_POOL_PRICE">Fixed Pool price</option><option value="QUANTITY_TIER">Quantity-tier price</option><option value="TARGET_PRICE">Target price</option></select></label><label><span className="label">Max / household</span><input className="input" type="number" min="1" name="max_quantity" defaultValue="20"/></label><label><span className="label">Fixed / pre-target price</span><input className="input" type="number" min="0.01" step="0.01" name="fixed_price"/></label><label><span className="label">Target quantity</span><input className="input" type="number" min="1" name="target_quantity"/></label><label><span className="label">Target price</span><input className="input" type="number" min="0.01" step="0.01" name="target_price"/></label><label className="md:col-span-2"><span className="label">Quantity tiers</span><input className="input" name="tiers" placeholder="1:160,50:155,100:149,200:145"/></label><label><span className="label">Minimum quantity</span><input className="input" type="number" min="1" name="min_quantity" defaultValue="1"/></label><SubmitButton className="md:w-fit">Add to Pool</SubmitButton></form>
      </div>
    </details>})}{!(products??[]).length&&<div className="card"><b>No own products yet.</b></div>}</section>
    <div className="notice"><b>Accounting rule:</b> customer saving uses the approved market benchmark minus actual selling price. Gross contribution uses actual selling price minus landed cost. Contribution is not net profit.</div>
  </div></AdminShell>
}
