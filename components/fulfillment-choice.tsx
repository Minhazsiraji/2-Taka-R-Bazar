'use client'

import { useMemo, useState } from 'react'
import { taka } from '@/lib/format'

type PickupOption={id:string;name:string;address:string}
export type SavedDeliveryAddress={
 id:string;address_text:string;verification_status:'customer_confirmed'|'operator_verified'|'rejected';is_default:boolean
}

export function FulfillmentChoice({pickupOptions,defaultAddress,estimatedProductSubtotal,savedAddresses=[],allowSaveAddress=true}:{
 pickupOptions:PickupOption[];defaultAddress:string;estimatedProductSubtotal:number;savedAddresses?:SavedDeliveryAddress[];allowSaveAddress?:boolean
}){
 const [method,setMethod]=useState<'pickup'|'home_delivery'>('pickup')
 const eligible=savedAddresses.filter(a=>a.verification_status!=='rejected')
 const [selectedId,setSelectedId]=useState(eligible.find(a=>a.is_default)?.id??eligible[0]?.id??'')
 const [addressMode,setAddressMode]=useState<'saved'|'new'>(eligible.length?'saved':'new')
 const [building,setBuilding]=useState('')
 const [unit,setUnit]=useState('')
 const [street,setStreet]=useState('')
 const [landmark,setLandmark]=useState('')
 const chosen=eligible.find(a=>a.id===selectedId)
 const deliveryFee=useMemo(()=>method==='pickup'?0:(estimatedProductSubtotal<=1000?20:30),[method,estimatedProductSubtotal])
 const newAddress=[unit,building,street,landmark].map(x=>x.trim()).filter(Boolean).join(', ')
 return <div className="grid gap-3">
  <fieldset className="grid gap-2"><legend className="label">How do you want to receive this order?</legend>
   <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><input className="mt-1" type="radio" name="fulfillment_method" value="pickup" checked={method==='pickup'} onChange={()=>setMethod('pickup')}/><span><b>Community delivery-point collection — FREE</b><span className="mt-1 block text-xs text-slate-600">Collect from an enabled point and keep your full product saving.</span></span></label>
   <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3"><input className="mt-1" type="radio" name="fulfillment_method" value="home_delivery" checked={method==='home_delivery'} onChange={()=>setMethod('home_delivery')}/><span><b>Home delivery inside your community</b><span className="mt-1 block text-xs text-slate-600">৳20 when the confirmed product basket is ৳1,000 or less; ৳30 above ৳1,000. Delivery stays separate from product savings.</span></span></label>
  </fieldset>
  {method==='pickup'?<label><span className="label">Pickup point</span><select className="input" name="pickup_point_id" required disabled={pickupOptions.length===0}><option value="">Choose an available pickup point</option>{pickupOptions.map(p=><option key={p.id} value={p.id}>{p.name} · {p.address}</option>)}</select>{pickupOptions.length===0&&<span className="mt-1 block text-xs text-amber-700">Operations has not enabled a pickup point yet.</span>}</label>:
   <section className="grid gap-3 rounded-xl border border-sky-200 bg-white/45 p-3">
    <div><b className="text-sm">Deliver to</b><p className="mt-1 text-xs text-slate-600">Confirm an address only for home delivery. Your community is checked separately.</p></div>
    {eligible.length>0&&<div className="flex flex-wrap gap-2">
     <button type="button" aria-pressed={addressMode==='saved'} onClick={()=>setAddressMode('saved')} className={addressMode==='saved'?'btn-primary text-xs':'btn-secondary text-xs'}>Saved address</button>
     <button type="button" aria-pressed={addressMode==='new'} onClick={()=>setAddressMode('new')} className={addressMode==='new'?'btn-primary text-xs':'btn-secondary text-xs'}>Use another address</button>
    </div>}
    {addressMode==='saved'&&chosen?<div className="grid gap-2">
      <label><span className="label">Saved home</span><select className="input" value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{eligible.map(a=><option key={a.id} value={a.id}>{a.address_text}</option>)}</select></label>
      <p className="text-xs text-slate-600">The delivery zone is checked before dispatch. A saved address is not automatic proof of residence.</p>
      <input type="hidden" name="delivery_address_id" value={selectedId}/>
     </div>:<div className="grid gap-2 sm:grid-cols-2">
      <label><span className="label">Building / house</span><input className="input" name="building_label" value={building} onChange={e=>setBuilding(e.target.value)} maxLength={120} minLength={2} required placeholder="e.g. Building A"/></label>
      <label><span className="label">Floor / flat</span><input className="input" name="unit_label" value={unit} onChange={e=>setUnit(e.target.value)} maxLength={80} required placeholder="e.g. Floor 2, Flat B"/></label>
      <label className="sm:col-span-2"><span className="label">Road / block / address</span><input className="input" name="street_line" value={street} onChange={e=>setStreet(e.target.value)} maxLength={240} minLength={3} required placeholder={defaultAddress||'Road, block or neighborhood'}/></label>
      <label className="sm:col-span-2"><span className="label">Landmark (optional)</span><input className="input" name="landmark" value={landmark} onChange={e=>setLandmark(e.target.value)} maxLength={240}/></label>
      <input type="hidden" name="delivery_address" value={newAddress}/>
      {allowSaveAddress&&<label className="sm:col-span-2 flex items-center gap-2 text-xs"><input type="checkbox" name="save_address" defaultChecked/> Save this address for faster checkout next time</label>}
     </div>}
    <p className="text-xs text-slate-600">Estimated delivery: <b>{taka(deliveryFee)}</b>. The database recalculates the final fee from the entire basket.</p>
   </section>}
 </div>
}
