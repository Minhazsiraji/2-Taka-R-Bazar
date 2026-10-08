type Props={
  status:string
  fulfillmentMethod?:string|null
}

const pickupSteps=[
  ['confirmed','Confirmed'],
  ['ordered','Supplier preparing'],
  ['ready_for_pickup','Ready for pickup'],
  ['completed','Collected'],
] as const

const deliverySteps=[
  ['confirmed','Confirmed'],
  ['ordered','Supplier preparing'],
  ['ready_for_pickup','Community received'],
  ['completed','Delivered'],
] as const

export function OrderJourney({status,fulfillmentMethod}:Props){
  const steps=fulfillmentMethod==='home_delivery'?deliverySteps:pickupSteps
  const index=status==='cancelled'?-1:Math.max(0,steps.findIndex(([key])=>key===status))
  if(status==='cancelled')return <div className="cx-order-journey is-cancelled"><b>Order cancelled</b></div>
  const activeIndex=index<0?0:index
  return <div className="cx-order-journey" aria-label="Order progress">
    {steps.map(([key,label],i)=><div key={key} className={'cx-order-step '+(i<=activeIndex?'is-done':'')}>
      <span className="cx-order-dot" aria-hidden="true">{i<activeIndex?'✓':i===activeIndex?'●':'○'}</span>
      <span>{label}</span>
    </div>)}
  </div>
}
