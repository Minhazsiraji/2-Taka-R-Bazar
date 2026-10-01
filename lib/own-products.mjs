export const OWN_PRODUCT_TYPES=['DIRECT_PRODUCT','PRIVATE_LABEL','EXCLUSIVE_PARTNER']

export function landedCost(parts={}){
  return ['purchase_cost','packaging_cost','inbound_transport','handling_cost','other_landed_cost']
    .reduce((sum,key)=>sum+Number(parts[key]??0),0)
}

export function customerSaving({benchmark,price,quantity=1}){
  return Math.max(0,(Number(benchmark)-Number(price))*Number(quantity))
}

export function grossContribution({price,landed,quantity=1}){
  return (Number(price)-Number(landed))*Number(quantity)
}

export function selectOwnTier(tiers,demand){
  return tiers.filter(t=>Number(t.min_quantity)<=Number(demand)).sort((a,b)=>Number(b.min_quantity)-Number(a.min_quantity))[0]??null
}

export function nextOwnTier(tiers,demand){
  return tiers.filter(t=>Number(t.min_quantity)>Number(demand)).sort((a,b)=>Number(a.min_quantity)-Number(b.min_quantity))[0]??null
}

export function resolveOwnPrice({mode,fixedPrice,targetQuantity,targetPrice,tiers=[]},demand){
  if(mode==='FIXED_POOL_PRICE')return Number(fixedPrice)||null
  if(mode==='TARGET_PRICE')return Number(demand)>=Number(targetQuantity)?Number(targetPrice)||null:Number(fixedPrice)||null
  if(mode==='QUANTITY_TIER')return selectOwnTier(tiers,demand)?.unit_price??null
  return null
}
