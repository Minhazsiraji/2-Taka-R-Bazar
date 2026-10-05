'use client'

import { useMemo, useState } from 'react'
import { taka } from '@/lib/format'

type PickupOption={id:string;name:string;address:string}

export function FulfillmentChoice({pickupOptions,defaultAddress,estimatedProductSubtotal}:{pickupOptions:PickupOption[];defaultAddress:string;estimatedProductSubtotal:number}){
  const [method,setMethod]=useState<'pickup'|'home_delivery'>('pickup')
  const deliveryFee=useMemo(()=>method==='pickup'?0:(estimatedProductSubtotal<=1000?20:30),[method,estimatedProductSubtotal])
  return <div className="grid gap-3">
    <fieldset className="grid gap-2"><legend className="label">How do you want to receive this Pool basket?</legend>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><input className="mt-1" type="radio" name="fulfillment_method" value="pickup" checked={method==='pickup'} onChange={()=>setMethod('pickup')}/><span><b>Community delivery-point collection — FREE</b><span className="mt-1 block text-xs text-slate-600">Collect from an enabled point and keep your full product saving.</span></span></label>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3"><input className="mt-1" type="radio" name="fulfillment_method" value="home_delivery" checked={method==='home_delivery'} onChange={()=>setMethod('home_delivery')}/><span><b>Home delivery inside your community</b><span className="mt-1 block text-xs text-slate-600">৳20 when the confirmed product basket is ৳1,000 or less; ৳30 above ৳1,000. Delivery stays separate from product savings.</span></span></label>
    </fieldset>
    {method==='pickup'?<label><span className="label">Pickup point</span><select className="input" name="pickup_point_id" required disabled={pickupOptions.length===0}><option value="">Choose an available pickup point</option>{pickupOptions.map(p=><option key={p.id} value={p.id}>{p.name} · {p.address}</option>)}</select>{pickupOptions.length===0&&<span className="mt-1 block text-xs text-amber-700">Operations has not enabled a pickup point yet.</span>}</label>:<label><span className="label">Home-delivery address inside your community</span><textarea className="input min-h-20" name="delivery_address" defaultValue={defaultAddress} required placeholder="House/road/block/landmark"/><span className="mt-1 block text-xs text-slate-600">Estimated delivery for the currently confirmed product total: <b>{taka(deliveryFee)}</b>. The database recalculates the final fee from the complete confirmed basket.</span></label>}
  </div>
}
