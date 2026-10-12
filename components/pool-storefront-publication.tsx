import {publishStorefrontPool} from '@/app/actions/storefront-publication'
import {SubmitButton} from '@/components/submit-button'
export function PoolStorefrontPublication({poolId,products,publication}:{poolId:string;products:{id:string;name:string}[];publication:{published:boolean;featured_product_ids:string[];sort_order:number}|null}){
 const ids=publication?.featured_product_ids??[]
 return <section className="card p-5"><h2 className="text-lg font-bold">Home Pool publishing</h2><p className="muted mt-2 text-sm">Choose up to three images in display order. Only active non-demo products in this Pool can be featured. Publishing does not change stock, prices or existing commitments.</p>
 <form action={publishStorefrontPool} className="mt-4 grid gap-3 sm:grid-cols-3">
 <input type="hidden" name="pool_id" value={poolId}/>
 {[0,1,2].map(i=><label key={i}><span className="label">Product image {i+1}</span><select name="product_ids" className="input" defaultValue={ids[i]??''}><option value="">None</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>)}
 <label><span className="label">Display order</span><input type="number" name="sort_order" className="input" defaultValue={publication?.sort_order??100}/></label>
 <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={publication?.published??false}/>Publish on Home</label>
 <SubmitButton className="btn-primary">Save publication</SubmitButton>
 </form></section>
}
