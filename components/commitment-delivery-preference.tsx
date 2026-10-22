'use client'
import {useState} from 'react'
import {saveSimpleSaleDeliveryPreference} from '@/app/actions/simple-offer-delivery'
type Point={id:string;name:string;address:string}
type Previous={offer_id:string;fulfillment:'pickup'|'home_delivery';pickup_point_id:string|null;home_address:string|null}
export function CommitmentDeliveryPreference({offerId,title,points,previous}:{
 offerId:string;title:string;points:Point[];previous?:Previous
}){
 const [method,setMethod]=useState<'pickup'|'home_delivery'>(previous?.fulfillment??(points.length?'pickup':'home_delivery'))
 const [pickupPoint,setPickupPoint]=useState(previous?.pickup_point_id??'')
 const [address,setAddress]=useState(previous?.home_address??'')
 const [saving,setSaving]=useState(false)
 const [notice,setNotice]=useState('')
 const save=async()=>{
  setSaving(true);try{
   const result=await saveSimpleSaleDeliveryPreference({
    offerId,fulfillment:method,pickupPointId:pickupPoint,homeAddress:address
   })
   setNotice(result.message)
  }catch{setNotice('Could not save delivery preference. Please retry.')}
  finally{setSaving(false)}
 }
 return <section className="glass-subpanel grid gap-3 rounded-2xl border border-white/80 p-4" aria-label={'Delivery preference for '+title}>
  <h3 className="font-bold">{title} — Delivery preference / ডেলিভারি পছন্দ</h3>
  <p className="text-sm">This is not a checkout. Staff will quote the fee with your final unlocked price for your approval. / এটি অর্ডার নয়, চার্জ পরে নিশ্চিত হবে।</p>
  <fieldset className="grid gap-2"><legend className="font-semibold">Receive by / সংগ্রহের পদ্ধতি</legend>
   <label className="flex items-center gap-2"><input type="radio" checked={method==='pickup'} onChange={()=>setMethod('pickup')}/> Community gate / pickup point</label>
   <label className="flex items-center gap-2"><input type="radio" checked={method==='home_delivery'} onChange={()=>setMethod('home_delivery')}/> Home delivery</label>
  </fieldset>
  {method==='pickup'?<label className="grid gap-1 text-sm">Community gate / pickup point
   <select className="input" value={pickupPoint} onChange={e=>setPickupPoint(e.target.value)} disabled={!points.length}>
    <option value="">Choose your community gate</option>
    {points.map(p=><option value={p.id} key={p.id}>{p.name} — {p.address}</option>)}
   </select>
   {!points.length&&<span>No active pickup point in your nominated community. Select home delivery.</span>}
  </label>:<label className="grid gap-1 text-sm">Home delivery address / বাসার ঠিকানা
   <textarea className="input" value={address} onChange={e=>setAddress(e.target.value)} minLength={10} maxLength={350} rows={2} placeholder="Address for staff to calculate delivery charge"/>
  </label>}
  <p className="text-sm font-semibold">Delivery fee: Not quoted / ডেলিভারি চার্জ: এখনও নির্ধারিত নয়</p>
  <button type="button" className="btn-secondary" disabled={saving||method==='pickup'&&!pickupPoint||method==='home_delivery'&&address.trim().length<10}
   onClick={()=>void save()}>{saving?'Saving…':'Save delivery preference / সংরক্ষণ করুন'}</button>
  {notice&&<p role="status" className="text-sm">{notice}</p>}
 </section>
}
