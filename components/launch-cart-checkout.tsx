'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import {readLaunchCart,writeLaunchCart,type LaunchCartItem} from '@/lib/launch-cart'
import type {PublicVendorBookingProduct} from '@/lib/public-vendor-booking'
import {submitLaunchOrder} from '@/app/actions/launch-orders'
import {useFormStatus} from 'react-dom'
function Submit(){const {pending}=useFormStatus();return <button disabled={pending} type="submit" className="btn-primary w-full">{pending?'Submitting / পাঠানো হচ্ছে…':'Place order / অর্ডার দিন'}</button>}
export function LaunchCartCheckout({catalog,checkout=false,authenticated=false,error}:{catalog:PublicVendorBookingProduct[];checkout?:boolean;authenticated?:boolean;error?:string}){
 const [items,setItems]=useState<LaunchCartItem[]>([]),[loaded,setLoaded]=useState(false),[request,setRequest]=useState('')
 useEffect(()=>{setItems(readLaunchCart());setRequest(crypto.randomUUID());setLoaded(true)},[])
 const money=(v:number)=>'৳'+v.toLocaleString('en-BD')
 const change=(id:string,quantity:number)=>{const next=items.map(i=>i.product_id===id?{...i,quantity}:i).filter(i=>i.quantity>0);writeLaunchCart(next);setItems(next)}
 const lines=items.map(item=>({item,product:catalog.find(p=>p.product_id===item.product_id)}))
 const unavailable=lines.some(l=>!l.product?.launch_enabled||l.item.quantity>(l.product.available_quantity??0))
 const total=lines.reduce((s,l)=>s+(l.product?.approved_unit_price??0)*l.item.quantity,0)
 if(!loaded)return <p role="status">Loading / লোড হচ্ছে…</p>
 if(!items.length)return <section className="glass-panel rounded-3xl border border-white/80 p-5"><p>Your cart is empty. / আপনার কার্ট খালি।</p><Link className="btn-primary mt-4 inline-block" href="/#mobile-exclusive">Continue shopping / কেনাকাটা করুন</Link></section>
 return <>{error&&<p className="error mb-4" role="alert">{error}</p>}<section className="glass-panel rounded-3xl border border-white/80 p-5">
 <h2 className="text-xl font-black">Your products / আপনার পণ্য</h2>
 <div className="mt-4 grid gap-4">{lines.map(({item,product:p})=><article key={item.product_id} className="glass-subpanel flex flex-wrap items-center gap-4 rounded-2xl border border-white/80 p-4">
 {p?.image_url&&<img src={p.image_url} width="72" height="72" alt={p.name} className="rounded-xl object-contain"/>}<div className="min-w-0 flex-1"><Link className="font-bold" href={'/preview-live/product/'+item.product_id}>{p?.name??'Unavailable product / অনুপলব্ধ পণ্য'}</Link><p>{p?.package_size} · {money(p?.approved_unit_price??0)}</p>
 <label className="mt-2 inline-flex items-center gap-2">Quantity / পরিমাণ <input aria-label={'Quantity for '+(p?.name??item.product_id)} className="input w-20" type="number" min="1" max={Math.max(1,p?.available_quantity??100)} value={item.quantity} onChange={e=>{const q=Number(e.target.value);if(Number.isInteger(q)&&q>=1&&q<=100)change(item.product_id,q)}}/></label></div>
 <button className="btn-secondary" type="button" onClick={()=>change(item.product_id,0)}>Remove / সরান</button>
 </article>)}</div><p className="mt-5 text-xl font-black">Subtotal / পণ্যের মোট: {money(total)}</p>
 {unavailable&&<p className="error mt-3" role="alert">Some quantities are unavailable. Update your cart. / পরিমাণ পরিবর্তন করুন।</p>}
 {!checkout&&<Link className="btn-primary mt-4 inline-block" href="/checkout">Checkout / চেকআউট</Link>}</section>
 {checkout&&(!authenticated?<Link className="btn-primary mt-5 inline-block" href="/login?next=%2Fcheckout">Sign in to place your order / অর্ডার করতে লগইন করুন</Link>:<form action={submitLaunchOrder} className="glass-panel mt-5 grid gap-4 rounded-3xl border border-white/80 p-5">
 <input type="hidden" name="items" value={JSON.stringify(items)}/><input type="hidden" name="request_key" value={request}/>
 <h2 className="text-xl font-black">Delivery details / ডেলিভারির তথ্য</h2>
 <label className="grid gap-1">Name / নাম<input className="input" name="contact_name" required maxLength={100} autoComplete="name"/></label>
 <label className="grid gap-1">Mobile / মোবাইল<input className="input" type="tel" name="contact_phone" required maxLength={20} autoComplete="tel"/></label>
 <label className="grid gap-1">Receive by / সংগ্রহের পদ্ধতি<select name="fulfillment" className="input"><option value="home_delivery">Home delivery / হোম ডেলিভারি</option><option value="pickup">Pickup / পিকআপ</option></select></label>
 <label className="grid gap-1">Address / ঠিকানা<textarea className="input" name="address" required minLength={10} maxLength={350} autoComplete="street-address"/></label>
 <p className="text-sm">We will approve your order and confirm any delivery charge. Your existing bKash/bank payment instructions will appear after approval. / অর্ডার ও ডেলিভারি চার্জ অনুমোদনের পর বিকাশ/ব্যাংকের তথ্য দেখাবে।</p>
 <label className="flex gap-2"><input type="checkbox" name="terms" required/><span>I accept the <Link className="underline" href="/terms">Terms</Link>, <Link className="underline" href="/return-policy">Return Policy</Link> and <Link className="underline" href="/refund-policy">Refund Policy</Link>. / আমি শর্তাবলিতে সম্মত।</span></label>
 {!unavailable&&<Submit/>}</form>)}
 </>
}
