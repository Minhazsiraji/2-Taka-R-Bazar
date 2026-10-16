/** Read-only guide. Actual release rules stay enforced by DB procedures. */
export function poolLaunchChecklist({pool,itemCount,supplierItemTierCounts,ownPricingReady,pickupCount,homePublished}:{pool:{
 status:string;is_paused:boolean;opens_at:string|null;commitment_closes_at:string|null;
 confirmation_closes_at:string|null;supplier_delivery_at:string|null;pickup_at:string|null;
 receiving_pickup_point_id:string|null
},itemCount:number,supplierItemTierCounts:number[],ownPricingReady:boolean,pickupCount:number,homePublished:boolean}){
 const requirements=[
  {key:'item',label:'Product added',ok:itemCount>0,help:'Add an active product with a verified market benchmark.'},
  {key:'pricing',label:'Pricing planned',ok:itemCount>0&&supplierItemTierCounts.every(q=>q>=2)&&ownPricingReady,
   help:'Each supplier-backed product needs 2–3 verified quantity/price tiers; own products need approved pricing.'},
  {key:'schedule',label:'Bangladesh schedule',ok:Boolean(pool.commitment_closes_at&&pool.confirmation_closes_at&&pool.supplier_delivery_at&&pool.pickup_at),
   help:'Set commitment close, confirmation close, supplier delivery and customer pickup in Bangladesh time.'},
  {key:'receiving',label:'Receiving location',ok:Boolean(pool.receiving_pickup_point_id),help:'Choose the supplier receiving point in this community.'},
  {key:'pickup',label:'Customer pickup choices',ok:pickupCount>0,help:'Choose at least one customer pickup point including the receiving point.'}
 ]
 const canOpen=requirements.every(r=>r.ok)&&!pool.is_paused&&pool.status==='draft'
 const scheduled=pool.status==='open'&&Boolean(pool.opens_at)&&Date.parse(pool.opens_at!)>Date.now()
 const live=pool.status==='open'&&!pool.is_paused&&!scheduled
 return {requirements,canOpen,scheduled,live,homePublished,readyCount:requirements.filter(r=>r.ok).length}
}
