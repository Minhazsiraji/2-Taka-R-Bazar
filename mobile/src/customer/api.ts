import {nativeClient} from '../auth/client';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeId=(value:string)=>{if(!uuid.test(value))throw new Error('Invalid identifier');return value};
const errorMessage=(error:{message?:string}|null)=>error?.message||'Request failed. Please try again.';

export type QuoteItem={product_id:string;quantity:number;unit_price:number;retail_reference:number|null};
export type CustomerQuote={
 id:string;cycle_id:string;product_total:number;delivery_fee:number|null;fulfillment:string|null;
 pickup_point_id:string|null;home_address:string|null;status:string;order_id:string|null;
 simple_sale_cycle_quote_items:QuoteItem[]
};
export type CustomerOrder={
 id:string;status:string;total_amount:number;payment_status:string;payment_reference:string|null;
 delivery_fee:number|null;created_at:string
};
export type CustomerNotice={id:string;title:string;body:string;href:string|null;read_at:string|null;created_at:string};
export type PickupPoint={id:string;name:string;address:string;community_id:string};
export type OfficialPayee={id:string;method:string;account_name:string;account_number:string;bank_name:string|null};
export type CustomerSaving={order_id:string;order_code:string;product_saving:number;delivery_charge:number;net_saving:number;is_synthetic:boolean};
export type CustomerSnapshot={
 quotes:CustomerQuote[];orders:CustomerOrder[];notifications:CustomerNotice[];pickupPoints:PickupPoint[];
 savings:CustomerSaving[];userId:string;communityId:string|null;name:string;phone:string;
 cycles:{id:string;offer_id:string;cycle_number:number;community_id:string;locked_threshold:number|null;status:string}[];
};
async function signedIn(){
 const client=nativeClient();
 if(!client)throw new Error('Secure native sign-in has not been configured');
 const {data,error}=await client.auth.getUser();
 if(error||!data.user)throw new Error('Please sign in to your existing 2TBR account');
 return {client,user:data.user};
}
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{
 const {client}=await signedIn();
 const {data,error}=await client.rpc(name,args);
 if(error)throw new Error(errorMessage(error));
 return data as T;
}
export async function getCustomerSnapshot():Promise<CustomerSnapshot>{
 const {client,user}=await signedIn();
 const [profile,quotes,orders,notices,cycles,points,savings]=await Promise.all([
  client.from('profiles').select('community_id,full_name,phone').eq('id',user.id).maybeSingle(),
  client.from('simple_sale_cycle_quotes').select('id,cycle_id,product_total,delivery_fee,fulfillment,pickup_point_id,home_address,status,order_id,simple_sale_cycle_quote_items(product_id,quantity,unit_price,retail_reference)').eq('customer_id',user.id).order('created_at',{ascending:false}).limit(75),
  client.from('launch_orders').select('id,status,total_amount,payment_status,payment_reference,delivery_fee,created_at').eq('customer_id',user.id).order('created_at',{ascending:false}).limit(50),
  client.from('notifications').select('id,title,body,href,read_at,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50),
  client.from('simple_sale_cycles').select('id,offer_id,cycle_number,community_id,locked_threshold,status').order('opened_at',{ascending:false}).limit(120),
  client.from('pickup_points').select('id,name,address,community_id').eq('active',true).limit(120),
  client.rpc('commerce_savings_summary'),
 ]);
 for(const result of [profile,quotes,orders,notices,cycles,points,savings]){
  if(result.error)throw new Error(errorMessage(result.error));
 }
 return {
  userId:user.id,communityId:profile.data?.community_id??null,
  name:profile.data?.full_name||'',phone:profile.data?.phone||user.phone||'',
  quotes:(quotes.data??[]) as CustomerQuote[],
  orders:(orders.data??[]) as CustomerOrder[],
  notifications:(notices.data??[]) as CustomerNotice[],
  cycles:(cycles.data??[]) as CustomerSnapshot['cycles'],
  pickupPoints:(points.data??[]) as PickupPoint[],
  savings:(savings.data??[]) as CustomerSaving[]
 };
}
export async function joinCustomerDeal(offerId:string,productId:string,communityId:string|null,cycleId?:string|null){
 return rpc<boolean>('join_simple_sale_group_deal_quantified',{
  p_offer:safeId(offerId),p_product:safeId(productId),p_area:communityId?safeId(communityId):null,
  p_quantity:1,...(cycleId?{p_expected_cycle:safeId(cycleId)}:{})
 });
}
export async function joinCustomerPool(offerId:string,lines:{product_id:string;quantity:number}[],communityId:string|null,cycleId?:string|null){
 if(!lines.length||lines.length>20||new Set(lines.map(l=>l.product_id)).size!==lines.length||
    lines.some(l=>!uuid.test(l.product_id)||!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>100))
  throw new Error('Select up to 20 valid Pool items and quantities');
 return rpc<boolean>('join_simple_sale_pool_quantified',{
  p_offer:safeId(offerId),p_lines:lines,p_area:communityId?safeId(communityId):null,
  ...(cycleId?{p_expected_cycle:safeId(cycleId)}:{})
 });
}
export async function setQuoteDelivery(id:string,method:'pickup'|'home_delivery',pointId:string|null,address:string){
 if(method==='pickup'&&!pointId)throw new Error('Choose a pickup point');
 if(method==='home_delivery'&&(address.trim().length<10||address.length>350))throw new Error('Enter a complete delivery address');
 await rpc('customer_set_simple_sale_quote_delivery',{
  p_quote:safeId(id),p_fulfillment:method,
  p_pickup_point:method==='pickup'?safeId(pointId!):null,
  p_home_address:method==='home_delivery'?address.trim():null
 });
}
export async function decideCustomerQuote(id:string,decision:'accept'|'cancel',name:string,phone:string,terms:boolean){
 if(decision==='accept'&&(!terms||name.trim().length<2||!/^\+?[0-9]{10,15}$/.test(phone.replace(/\s/g,''))))
  throw new Error('Confirm your full name, mobile number, and accepted total');
 await rpc('customer_decide_simple_sale_quote',{
  p_quote:safeId(id),p_decision:decision,p_name:decision==='accept'?name.trim():null,
  p_phone:decision==='accept'?phone.replace(/\s/g,''):null,p_terms:decision==='accept'&&terms
 });
}
export async function getQuotePayees(id:string):Promise<OfficialPayee[]>{
 const data=await rpc<OfficialPayee[]>('simple_sale_quote_payment_options',{p_quote:safeId(id)});
 return Array.isArray(data)?data:[];
}
export async function submitCustomerPayment(id:string,payeeId:string,reference:string){
 if(reference.trim().length<6||reference.trim().length>80)throw new Error('Enter the bank or bKash transaction reference');
 await rpc('customer_submit_simple_sale_payment',{p_quote:safeId(id),p_recipient:safeId(payeeId),p_reference:reference.trim()});
}
export async function markCustomerNotification(id:string){
 await rpc('mark_notification_read',{p_notification_id:safeId(id)});
}
export async function markAllCustomerNotifications(){
 await rpc('mark_all_notifications_read',{});
}
export async function submitDirectCustomerOrder(items:{product_id:string;quantity:number}[],
 key:string,name:string,phone:string,method:'pickup'|'home_delivery',pickupPoint:string|null,address:string,terms:boolean){
 if(!terms||items.length<1||items.length>6||new Set(items.map(i=>i.product_id)).size!==items.length||
  items.some(i=>!uuid.test(i.product_id)||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>100))
  throw new Error('Review all direct product quantities and accept the terms');
 if(name.trim().length<2||!/^\+?[0-9]{10,15}$/.test(phone.replace(/\s/g,'')))throw new Error('A valid contact name and phone are required');
 const {client,user}=await signedIn();
 let actualAddress=address.trim();
 if(method==='pickup'){
  if(!pickupPoint)throw new Error('Select your community pickup point');
  const [profile,point]=await Promise.all([
   client.from('profiles').select('community_id').eq('id',user.id).maybeSingle(),
   client.from('pickup_points').select('id,community_id,name,address').eq('id',safeId(pickupPoint)).eq('active',true).maybeSingle()
  ]);
  if(profile.error||point.error||!profile.data?.community_id||!point.data||
   profile.data.community_id!==point.data.community_id)throw new Error('Pickup point does not belong to your selected community');
  actualAddress='Community pickup: '+point.data.name+' — '+point.data.address;
 }
 if(actualAddress.length<10||actualAddress.length>350)throw new Error('Enter a complete fulfillment address');
 return rpc<string>('launch_submit_order',{
  p_items:items,p_request_key:safeId(key),p_name:name.trim(),p_phone:phone.replace(/\s/g,''),
  p_address:actualAddress,p_method:method,p_terms:true
 });
}
export async function getDirectOrderPayees(id:string):Promise<OfficialPayee[]>{
 return rpc<OfficialPayee[]>('launch_payment_options',{p_order:safeId(id)});
}
export async function submitDirectOrderPayment(id:string,payeeId:string,reference:string){
 if(reference.trim().length<6||reference.trim().length>80)throw new Error('Enter a valid payment reference');
 await rpc('launch_submit_payment',{p_order:safeId(id),p_recipient:safeId(payeeId),p_reference:reference.trim()});
}

/** Initiates an audited owner-only deletion request; never deletes pending orders or credentials instantly. */
export async function requestCustomerAccountDeletion():Promise<string>{
 return rpc<string>('request_my_account_deletion',{});
}
