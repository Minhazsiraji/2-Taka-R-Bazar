import Link from 'next/link'
import {requireAdmin} from '@/lib/auth'
import {AdminShell} from '@/components/admin-shell'
import {AdminSimpleOfferForm} from '@/components/admin-simple-offer-form'
export const dynamic='force-dynamic'
export default async function Offers({searchParams}:{searchParams:Promise<{edit?:string}>}){
 const {supabase:db}=await requireAdmin(),query=await searchParams
 const [products,areas,offers,legacy,stock]=await Promise.all([
  db.from('products').select('id,name,package_size,image_url').eq('active',true).eq('is_demo',false).order('name'),
  db.from('communities').select('id,name').eq('active',true).order('name'),
  db.from('simple_sale_offers').select('id,kind,community_id,title,published,closes_at,simple_sale_offer_communities(community_id),simple_sale_offer_items(product_id,price,old_price)').order('updated_at',{ascending:false}),
  db.rpc('get_public_launch_catalog',{p_product_id:null}),
  db.from('launch_product_stock').select('product_id,available_quantity'),
 ])
 const error=[products,areas,offers,legacy,stock].some(r=>r.error)
 const publicStock=Array.isArray(legacy.data)?legacy.data:[]
 const rows=(products.data??[]).map(p=>{const l=publicStock.find(i=>i.product_id===p.id),s=stock.data?.find(i=>i.product_id===p.id);return {...p,available_quantity:l?.available_quantity??s?.available_quantity??0,price:l?.approved_unit_price,old_price:l?.old_price}})
 const edit=offers.data?.find(o=>o.id===query.edit)
 return <AdminShell><div className="grid min-w-0 gap-4"><section className="card"><p className="card-title">2TBR · Upload once, use everywhere</p><h1 className="text-2xl font-black">Products & Offers</h1><p className="muted mt-2">1. Upload a product. 2. Choose a sale type, products and one or more communities. 3. Set prices and publish.</p><div className="mt-3 flex flex-wrap gap-2"><Link className="btn-primary" href="/admin/products#quick-product-upload">Upload product</Link><Link className="btn-secondary" href="/admin/launch-orders">Manual order approvals</Link></div><p className="muted mt-3 text-sm">Product image: square 1600 × 1600 px, centered with space around it. JPG, PNG or WebP. The same image fits all approved holders.</p></section>
  {error?<p className="error" role="alert">Offer setup could not load. Refresh before editing.</p>:<AdminSimpleOfferForm key={edit?.id??'new'} products={rows} communities={areas.data??[]} offer={edit}/>}
  <section className="card grid gap-3"><h2 className="section-title">Saved offers</h2><Link className="btn-secondary" href="/admin/offers">Create another offer</Link>{offers.data?.map(o=><article key={o.id} className="flex flex-wrap justify-between gap-2 border-b py-3"><div><b>{o.title}</b><p className="muted text-sm">{o.kind} · {(o.simple_sale_offer_communities?.map(a=>areas.data?.find(c=>c.id===a.community_id)?.name).filter(Boolean)??[]).join(', ')||areas.data?.find(c=>c.id===o.community_id)?.name} · {o.published?'Published':'Draft'} · {o.simple_sale_offer_items.length} products</p></div><Link className="btn-secondary" href={'/admin/offers?edit='+o.id}>Edit / unpublish</Link></article>)}</section>
 </div></AdminShell>
}
