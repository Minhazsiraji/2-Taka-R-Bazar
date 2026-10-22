'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import {readLaunchCart,writeLaunchCart,type LaunchCartItem} from '@/lib/launch-cart'
import {leaveSimpleSaleDeal} from '@/app/actions/simple-offer-joins'
import type {PublicVendorBookingProduct} from '@/lib/public-vendor-booking'
import {submitLaunchOrder} from '@/app/actions/launch-orders'
import {useFormStatus} from 'react-dom'
function Submit(){const {pending}=useFormStatus();return <button disabled={pending} type="submit" className="btn-primary w-full">{pending?'Submitting / পাঠানো হচ্ছে…':'Place order / অর্ডার দিন'}</button>}
export function LaunchCartCheckout({catalog,checkout=false,authenticated=false,error,pickupPoints=[]}:{catalog:PublicVendorBookingProduct[];checkout?:boolean;authenticated?:boolean;error?:string;pickupPoints?:{id:string;name:string;address:string}[]}){
 const [items,setItems]=useState<LaunchCartItem[]>([]),[loaded,setLoaded]=useState(false),[request,setRequest]=useState(''),[cartNotice,setCartNotice]=useState(''),[fulfillment,setFulfillment]=useState<'pickup'|'home_delivery'>(pickupPoints.length?'pickup':'home_delivery')
 useEffect(()=>{setItems(readLaunchCart());setRequest(crypto.randomUUID());setLoaded(true)},[])
 const money=(v:number)=>'৳'+v.toLocaleString('en-BD')
 const change=async(id:string,quantity:number)=>{
  if(quantity===0){
   const removing=items.find(item=>item.product_id===id)
   if(removing?.offer_id){
    const result=await leaveSimpleSaleDeal(removing.offer_id,id)
    if(!result.ok){setCartNotice(result.message);return}
    window.dispatchEvent(new Event('2tbr-notifications-refresh'))
   }
  }
  const next=items.map(i=>i.product_id===id?{...i,quantity}:i).filter(i=>i.quantity>0)
  writeLaunchCart(next);setItems(next);setCartNotice('')
 }
 const lines=items.map(item=>({item,product:catalog.find(p=>p.product_id===item.product_id&&(!item.offer_id||p.offer_id===item.offer_id))}))
 const unavailable=lines.some(l=>!l.product?.launch_enabled||l.item.quantity>(l.product.available_quantity??0))
 const total=lines.reduce((s,l)=>s+(l.product?.approved_unit_price??0)*l.item.quantity,0)
 if(!loaded)return <p role="status">Loading / লোড হচ্ছে…</p>
 if(!items.length)return <section className="glass-panel rounded-3xl border border-white/80 p-5"><p>Your cart is empty. / আপনার কার্ট খালি।</p><Link className="btn-primary mt-4 inline-block" href="/#mobile-exclusive">Continue shopping / কেনাকাটা করুন</Link></section>
 return <>{error&&<p className="error mb-4" role="alert">{error}</p>}{cartNotice&&<p className="error mb-4" role="alert">{cartNotice}</p>}<section className="glass-panel rounded-3xl border border-white/80 p-5">
 <h2 className="text-xl font-black">Your products / আপনার পণ্য</h2>
 <div className="mt-4 grid gap-4">{lines.map(({item,product:p})=><article key={item.product_id} className="glass-subpanel grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-white/80 p-4 sm:grid-cols-[72px_minmax(0,1fr)_auto]">
 {p?.image_url&&<img src={p.image_url} width="72" height="72" alt={p.name} className="aspect-square h-16 w-16 rounded-xl object-contain sm:h-[72px] sm:w-[72px]"/>}<div className="min-w-0"><Link className="font-bold" href={'/preview-live/product/'+item.product_id+(item.offer_id?'?offer='+item.offer_id:'')}>{p?.name??'Unavailable product / অনুপলব্ধ পণ্য'}</Link><p>{p?.package_size} · {money(p?.approved_unit_price??0)}</p>{p?.offer_title&&<p className="text-sm">{p.offer_title}</p>}
 <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={'Quantity for '+(p?.name??item.product_id)}>
 <span className="w-full text-xs font-semibold sm:w-auto">Quantity / পরিমাণ</span>
 <div className="inline-flex max-w-full items-center gap-2 whitespace-nowrap"><button type="button" className="btn-secondary min-h-9 min-w-9 px-2" aria-label={'Decrease '+(p?.name??'product')+' quantity'} disabled={item.quantity<=1} onClick={()=>void change(item.product_id,item.quantity-1)}>−</button>
 <output className="input flex min-h-9 min-w-12 items-center justify-center px-2 text-center" aria-live="polite">{item.quantity}</output>
 <button type="button" className="btn-secondary min-h-9 min-w-9 px-2" aria-label={'Increase '+(p?.name??'product')+' quantity'} disabled={item.quantity>=Math.min(100,Math.max(0,p?.available_quantity??100))} onClick={()=>void change(item.product_id,item.quantity+1)}>+</button></div>
 </div></div>
 <button className="btn-secondary col-start-2 justify-self-end sm:col-start-3" type="button" onClick={()=>change(item.product_id,0)}>Remove / সরান</button>
 </article>)}</div><p className="mt-5 text-xl font-black">Subtotal / পণ্যের মোট: {money(total)}</p>
 {unavailable&&<p className="error mt-3" role="alert">Some quantities are unavailable. Update your cart. / পরিমাণ পরিবর্তন করুন।</p>}
 {!checkout&&<Link className="btn-primary mt-4 inline-block" href="/checkout">Checkout / চেকআউট</Link>}</section>
 {checkout&&(!authenticated?<Link className="btn-primary mt-5 inline-block" href="/login?next=%2Fcheckout">Sign in to place your order / অর্ডার করতে লগইন করুন</Link>:<form action={submitLaunchOrder} className="glass-panel mt-5 grid gap-4 rounded-3xl border border-white/80 p-5">
 <input type="hidden" name="items" value={JSON.stringify(items)}/><input type="hidden" name="request_key" value={request}/>
 <h2 className="text-xl font-black">Delivery details / ডেলিভারির তথ্য</h2>
 <label className="grid gap-1">Name / নাম<input className="input" name="contact_name" required maxLength={100} autoComplete="name"/></label>
 <label className="grid gap-1">Mobile / মোবাইল<input className="input" type="tel" name="contact_phone" required maxLength={20} autoComplete="tel"/></label>
 <fieldset className="grid gap-2"><legend className="font-bold">Receive by / সংগ্রহের পদ্ধতি</legend>
 <label className="flex items-center gap-2"><input type="radio" name="fulfillment" value="pickup" checked={fulfillment==='pickup'} onChange={()=>setFulfillment('pickup')}/> Community gate / pickup point — collection</label>
 <label className="flex items-center gap-2"><input type="radio" name="fulfillment" value="home_delivery" checked={fulfillment==='home_delivery'} onChange={()=>setFulfillment('home_delivery')}/> Home delivery / হোম ডেলিভারি</label>
 </fieldset>
 {fulfillment==='pickup'?<label className="grid gap-1">Select your community pickup point / পিকআপ পয়েন্ট
  <select className="input" name="pickup_point_id" required disabled={!pickupPoints.length}>
   <option value="">Choose a gate / pickup point</option>
   {pickupPoints.map(point=><option key={point.id} value={point.id}>{point.name} — {point.address}</option>)}
  </select>{!pickupPoints.length&&<span className="text-sm">No active pickup points for your nominated community. Choose home delivery.</span>}
 </label>:<label className="grid gap-1">Home delivery address / বাসার ঠিকানা<textarea className="input" name="address" required minLength={10} maxLength={350} autoComplete="street-address"/></label>}
 <p className="text-sm">Delivery charges are confirmed by staff before payment. Pickup point must match your account community.</p>
 <p className="text-sm">We will approve your order and confirm any delivery charge. Your existing bKash/bank payment instructions will appear after approval. / অর্ডার ও ডেলিভারি চার্জ অনুমোদনের পর বিকাশ/ব্যাংকের তথ্য দেখাবে।</p>
 <label className="flex gap-2"><input type="checkbox" name="terms" required/><span>I accept the <Link className="underline" href="/terms">Terms</Link>, <Link className="underline" href="/return-policy">Return Policy</Link> and <Link className="underline" href="/refund-policy">Refund Policy</Link>. / আমি শর্তাবলিতে সম্মত।</span></label>
 {!unavailable&&<Submit/>}</form>)}
 </>
}
