/** Owner-only release checklist: reads records; never authorizes Commerce writes. */
export const PILOT_RETAIL_PROPOSALS = [
 {sku:'BUTTER-EXC-1KG',label:'Butter · 1 kg',price:1240,unit:'1 kg',requiresColdChain:false},
 {sku:'GHEE-1KG-UNB-001',label:'Ghee · 1 kg',price:1450,unit:'1 kg',requiresColdChain:false},
 {sku:'DUC-ESC-001',label:'Duck Meat · per kg',price:950,unit:'1 kg',requiresColdChain:true},
] as const

export type PilotProductRecord={
 sku:string;name:string;active:boolean;is_demo:boolean;package_size:string|null;unit:string|null
}
export type PilotOfferRecord={
 sku_id:string;community_id:string;mode:string;status:string;is_synthetic:boolean;unit_price:number|string;
 valid_until:string
}
export type PilotInventory={product_id:string;stock_on_hand:number;reserved_quantity:number}
export type PilotSku={id:string;product_id:string;sku:string;active:boolean}

export function evaluatePilotProduct(input:{
 expected:typeof PILOT_RETAIL_PROPOSALS[number];
 product:(PilotProductRecord&{id:string})|null;
 sku:PilotSku|null;
 inventory:PilotInventory|null;
 offers:PilotOfferRecord[];
 communityId:string|null;
 now:number;
 physicalStockVerified:boolean;
 fulfillmentVerified:boolean
}){
 const {expected,product,sku,inventory,offers,communityId,now,physicalStockVerified,fulfillmentVerified}=input
 const stockOnHand=Number(inventory?.stock_on_hand??0),reserved=Number(inventory?.reserved_quantity??0)
 const eligible=offers.find(o=>o.mode==='SOLO'&&!o.is_synthetic&&o.status==='approved'&&
  o.sku_id===sku?.id&&o.community_id===communityId&&Number(o.unit_price)===expected.price&&
  Date.parse(o.valid_until)>now)
 const checks=[
  {id:'catalog',label:'SKU and product active',ok:Boolean(product?.active&&!product?.is_demo&&sku?.active),help:'Keep the existing product and Commerce SKU active.'},
  {id:'unit',label:'Selling unit correctly recorded',ok:Boolean(product&&
    /(?:^|\s)1\s*kg/i.test(product.package_size??'')&&
    (/(?:kg|kilogram)/i.test(product.unit??'')) &&
    !/(?:pcs|piece|bird)/i.test(product.unit??'')),help:'Use 1 kg packaging and kg units. Duck must not be sold as a whole bird by mistake.'},
  {id:'stock',label:'Available stock recorded',ok:Boolean(inventory&&stockOnHand>reserved&&reserved>=0),help:'Available quantity must be positive. Database quantities alone are not physical verification.'},
  {id:'physical',label:'Physical stock evidence independently checked',ok:physicalStockVerified,help:'Confirm actual owned/custodied stock, batch, weight, receiving evidence and independent verification; never treat previous synthetic values as proof.'},
  {id:'offer',label:'Real individual offer independently approved',ok:Boolean(eligible),help:'Requires the correct seller, Amin Model Town community, retail price, expiry and independent checker.'},
  {id:'fulfillment',label:'Fulfillment evidence and policy verified',ok:fulfillmentVerified,help:expected.requiresColdChain?'Confirm per-kg quantity, food safety, cold-chain handling, expiry, pickup/delivery charges and returns.':'Confirm pickup, home-delivery charge, supplier acceptance and returns.'},
 ]
 return {checks,ready:checks.every(x=>x.ok),eligibleOfferId:eligible?.sku_id??null,availableUnits:Math.max(0,stockOnHand-reserved),grossPrice:expected.price}
}
