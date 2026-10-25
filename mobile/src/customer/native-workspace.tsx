import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Alert,Linking,Pressable,View} from 'react-native';
import {Text,TextInput} from '../typography';
import type {Language} from '../content';
import type {AppTheme} from '../theme';
import {glassSurfaces} from '../theme';
import type {Offer,Product} from '../data';
import {
 getCustomerSnapshot,setQuoteDelivery,decideCustomerQuote,getQuotePayees,submitCustomerPayment,
 submitDirectCustomerOrder,getDirectOrderPayees,submitDirectOrderPayment,markAllCustomerNotifications,
 type CustomerSnapshot,type CustomerQuote,type CustomerOrder,type OfficialPayee
} from './api';

type Pane='overview'|'commitments'|'orders'|'savings'|'notifications'|'checkout';
const taka=(n:number|null|undefined)=>n==null?'Pending':'৳'+Number(n).toLocaleString('en-BD',{maximumFractionDigits:2});
const makeUuid=()=>{
 const a=new Uint8Array(16);
 crypto.getRandomValues(a);a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
 const hex=Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
};
export function NativeCustomerWorkspace({pane,userId,lang,theme,cart,offers,products,onSignIn,onCart,onClearCart,onNavigate}:{
 pane:Pane;userId:string|null;lang:Language;theme:AppTheme;cart:Record<string,number>;offers:Offer[];products:Product[];
 onSignIn:()=>void;onCart:()=>void;onClearCart:()=>void;onNavigate:(pane:Pane)=>void
}){
 const [snapshot,setSnapshot]=useState<CustomerSnapshot|null>(null);
 const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [selectedQuote,setSelectedQuote]=useState<string|null>(null);
 const [fulfillment,setFulfillment]=useState<'pickup'|'home_delivery'>('pickup');
 const [pickup,setPickup]=useState(''),[address,setAddress]=useState('');
 const [name,setName]=useState(''),[phone,setPhone]=useState(''),[terms,setTerms]=useState(false);
 const [reference,setReference]=useState(''),[recipient,setRecipient]=useState('');
 const [payees,setPayees]=useState<OfficialPayee[]>([]);
 const [deliveryMethod,setDeliveryMethod]=useState<'pickup'|'home_delivery'>('pickup');
 const [directPickup,setDirectPickup]=useState(''),[directAddress,setDirectAddress]=useState('');
 const [directOrderId,setDirectOrderId]=useState<string|null>(null);
 const requestId=useRef(makeUuid());
 const loadedFor=useRef<string|null>(null);
 const t=(en:string,bn:string)=>lang==='bn'?bn:en;
 const surfaces=theme.background==='#0D1424'?glassSurfaces.dark:glassSurfaces.light;
 const paneTitle={overview:t('My account','আমার অ্যাকাউন্ট'),commitments:t('My Deals & Pools','আমার ডিল ও পুল'),
 orders:t('My orders','আমার অর্ডার'),savings:t('Verified savings','যাচাইকৃত সাশ্রয়'),
 notifications:t('Notifications','নোটিফিকেশন'),checkout:t('Direct checkout','সরাসরি চেকআউট')};
 const panel={...surfaces.outer,padding:14,borderRadius:17,marginTop:12};
 const buttonStyle={...surfaces.control,paddingHorizontal:14,paddingVertical:12,borderRadius:11,marginTop:9,minHeight:42};
 const fieldStyle={...surfaces.control,color:theme.text,paddingHorizontal:12,paddingVertical:9,borderRadius:10,marginTop:5,minHeight:44};
 const refresh=useCallback(async()=>{
  if(!userId){setSnapshot(null);return}
  setLoading(true);setError('');
  try{const result=await getCustomerSnapshot();setSnapshot(result);setName(result.name);setPhone(result.phone)}
  catch(e){setError(e instanceof Error?e.message:'Unable to load your information');setSnapshot(null)}
  finally{setLoading(false)}
 },[userId]);
 useEffect(()=>{if(loadedFor.current===userId)return;loadedFor.current=userId;void refresh()},[refresh,userId]);
 useEffect(()=>{if(userId)void refresh()},[pane,refresh,userId]);
 const action=async(work:()=>Promise<unknown>,success:string,after?:()=>void)=>{
  if(saving)return;
  setSaving(true);
  try{await work();setReference('');setTerms(false);setSelectedQuote(null);after?.();await refresh();Alert.alert(t('Saved','সংরক্ষিত'),success)}
  catch(e){Alert.alert(t('Unable to complete','সম্পন্ন করা যায়নি'),e instanceof Error?e.message:'Please check your network connection.')}
  finally{setSaving(false)}
 };
 const btn=(label:string,run:()=>void,disabled=false)=><Pressable accessible accessibilityRole="button" disabled={disabled||saving||loading} onPress={run} style={[buttonStyle,{opacity:disabled||saving||loading?0.45:1}]}><Text style={{fontSize:12,fontWeight:'800',color:theme.accent,textAlign:'center'}}>{label}</Text></Pressable>;
 const input=(label:string,value:string,change:(v:string)=>void,multiline=false)=><View style={{marginTop:10}}><Text style={{color:theme.text,fontSize:11,fontWeight:'800'}}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={change} multiline={multiline} maxLength={multiline?350:100} style={[fieldStyle,multiline?{minHeight:75,textAlignVertical:'top'}:{}]}/></View>;
 const choose=(label:string,chosen:boolean,onPress:()=>void)=><Pressable accessibilityRole="radio" accessibilityState={{selected:chosen}} onPress={onPress} style={[buttonStyle,{backgroundColor:chosen?surfaces.selected.backgroundColor:surfaces.control.backgroundColor,flex:1}]}><Text style={{color:theme.text,fontWeight:chosen?'800':'500',textAlign:'center',fontSize:11}}>{label}</Text></Pressable>;
 const openQuote=async(quote:CustomerQuote)=>{
  setSelectedQuote(quote.id);
  setFulfillment(quote.fulfillment==='home_delivery'?'home_delivery':'pickup');
  setPickup(quote.pickup_point_id??'');setAddress(quote.home_address??'');
  setReference('');setRecipient('');setPayees([]);
  if(quote.status==='accepted'){
   try{setPayees(await getQuotePayees(quote.id))}
   catch{setError('Unable to load official payment instructions. Do not transfer money yet.')}
  }
 };
 const openOrder=async(order:CustomerOrder)=>{
  setDirectOrderId(order.id);setPayees([]);setReference('');setRecipient('');
  if(order.status==='confirmed'&&order.payment_status!=='verified'){
   try{setPayees(await getDirectOrderPayees(order.id))}
   catch{setError('Official payment instructions could not be verified.')}
  }
 };
 const ownQuotes=snapshot?.quotes??[];
 const ownOrders=snapshot?.orders??[];
 const direct=Object.entries(cart).filter(([id,q])=>q>0&&offers.some(o=>o.id===id&&o.mode==='SOLO'))
  .map(([id,quantity])=>({offer:offers.find(o=>o.id===id)!,quantity}));
 const subtotal=direct.reduce((n,row)=>n+row.offer.price*row.quantity,0);
 const relevantPoints=snapshot?.pickupPoints.filter(p=>p.community_id===snapshot.communityId)??[];
 const disabled=!userId||!snapshot;
 return <View style={{paddingBottom:24}}>
  <Text style={{color:theme.accent,fontWeight:'900',fontSize:21,marginTop:12}}>{paneTitle[pane]}</Text>
  {!userId?<View style={panel}><Text style={{color:theme.text}}>{t('Browse without signing in. Sign in to see private orders, commitments and savings or to complete a purchase.','লগইন ছাড়া পণ্য দেখতে পারবেন। ডিল, অর্ডার ও কেনাকাটার জন্য লগইন করুন।')}</Text>{btn(t('Sign in','লগইন'),onSignIn)}</View>:null}
  {loading&&<Text accessibilityRole="text" style={{color:theme.muted,marginTop:12}}>{t('Loading your private customer information…','আপনার তথ্য লোড হচ্ছে…')}</Text>}
  {!!error&&<View style={panel}><Text style={{color:'#D54E4E'}}>{error}</Text>{btn(t('Retry','আবার চেষ্টা করুন'),()=>void refresh())}</View>}
  {userId&&snapshot&&pane==='overview'&&<View>
   <View style={panel}><Text style={{color:theme.text,fontWeight:'800'}}>{snapshot.name||t('Your verified account','আপনার অ্যাকাউন্ট')}</Text>
    <Text style={{color:theme.muted,fontSize:12}}>{snapshot.phone}</Text>
    <Text style={{color:theme.muted,fontSize:11,marginTop:8}}>{snapshot.communityId?t('Your registered community is used for Deals and pickup.','ডিল ও পিকআপের জন্য অ্যাকাউন্টের কমিউনিটি ব্যবহৃত হয়।'):t('Select your community in website Account Settings before joining local offers.','লোকাল অফারে যোগ দিতে ওয়েবসাইটের অ্যাকাউন্ট সেটিংসে কমিউনিটি বাছুন।')}</Text>
   </View>
   {btn(t('My Group Deals & Pools','আমার ডিল ও পুল')+' · '+ownQuotes.length,()=>onNavigate('commitments'))}
   {btn(t('Orders','অর্ডার')+' · '+ownOrders.length,()=>onNavigate('orders'))}
   {btn(t('Verified savings','যাচাইকৃত সাশ্রয়'),()=>onNavigate('savings'))}
   {btn(t('Notifications','নোটিফিকেশন')+' · '+snapshot.notifications.filter(n=>!n.read_at).length,()=>onNavigate('notifications'))}
   {btn(t('Community settings','কমিউনিটি সেটিংস'),()=>void Linking.openURL('https://2takarbazar.com/account/settings'))}
   {btn(t('Privacy policy','গোপনীয়তা নীতি'),()=>void Linking.openURL('https://2takarbazar.com/privacy'))}
  </View>}
  {userId&&snapshot&&pane==='commitments'&&<View>
   <Text style={{color:theme.muted,fontSize:11,marginTop:7}}>{t('Commit first. At closure prices lock; choose delivery, accept the exact fee-inclusive total, then submit payment details. Only staff-verified payment creates an order.','প্রথমে যোগ দিন। ডিল বন্ধ হলে চূড়ান্ত দাম ও ডেলিভারি চার্জ মেনে পেমেন্ট রেফারেন্স দিন। যাচাইকৃত পেমেন্টেই অর্ডার হয়।')}</Text>
   {ownQuotes.map(q=>{
    const cycle=snapshot.cycles.find(c=>c.id===q.cycle_id);
    const total=q.delivery_fee==null?null:Number(q.product_total)+Number(q.delivery_fee);
    return <View key={q.id} style={panel}>
     <Text style={{color:theme.text,fontWeight:'800'}}>#{q.id.slice(0,8).toUpperCase()} · {t('Cycle','রাউন্ড')} {cycle?.cycle_number??'—'}</Text>
     <Text style={{color:theme.accent,fontSize:12,fontWeight:'700'}}>{q.status.replaceAll('_',' ')}</Text>
     {q.simple_sale_cycle_quote_items.map(i=><Text key={i.product_id} style={{color:theme.text,fontSize:11,marginTop:5}}>{products.find(p=>p.id===i.product_id)?.name??t('Product','পণ্য')} × {i.quantity} · {taka(i.quantity*Number(i.unit_price))}</Text>)}
     <Text style={{color:theme.text,marginTop:8}}>{t('Locked products','চূড়ান্ত পণ্য মূল্য')}: {taka(q.product_total)}</Text>
     <Text style={{color:theme.text}}>{t('Delivery','ডেলিভারি')}: {taka(q.delivery_fee)}</Text>
     {total!==null&&<Text style={{color:theme.accent,fontWeight:'900',fontSize:16}}>{t('Final total','মোট মূল্য')}: {taka(total)}</Text>}
     {q.status==='awaiting_delivery'&&btn(t('Select pickup or home delivery','পিকআপ বা হোম ডেলিভারি বাছুন'),()=>void openQuote(q))}
     {q.status==='quoted'&&btn(t('Review & accept or cancel','চূড়ান্ত মূল্য মেনে নিন বা বাতিল করুন'),()=>void openQuote(q))}
     {q.status==='accepted'&&btn(t('Submit verified account transfer reference','পেমেন্টের রেফারেন্স দিন'),()=>void openQuote(q))}
     {q.status==='payment_submitted'&&<Text style={{color:theme.muted,marginTop:8,fontSize:11}}>{t('Payment reference sent. Await independent staff verification; no order yet.','পেমেন্ট রেফারেন্স জমা হয়েছে। যাচাই না হওয়া পর্যন্ত অর্ডার নয়।')}</Text>}
     {q.status==='verified'&&q.order_id&&btn(t('View confirmed order','নিশ্চিত অর্ডার দেখুন'),()=>onNavigate('orders'))}
     {selectedQuote===q.id&&q.status==='awaiting_delivery'&&<View>
      <View style={{flexDirection:'row',gap:7}}>{choose(t('Pickup','পিকআপ'),fulfillment==='pickup',()=>setFulfillment('pickup'))}{choose(t('Home delivery','হোম ডেলিভারি'),fulfillment==='home_delivery',()=>setFulfillment('home_delivery'))}</View>
      {fulfillment==='pickup'?<View>{relevantPoints.map(p=>choose(p.name+' · '+p.address,pickup===p.id,()=>setPickup(p.id)))}</View>:input(t('Complete delivery address','সম্পূর্ণ ঠিকানা'),address,setAddress,true)}
      {btn(t('Save delivery choice','ডেলিভারি পছন্দ সংরক্ষণ'),()=>void action(()=>setQuoteDelivery(q.id,fulfillment,pickup,address),t('Delivery request saved. Staff must confirm its fee. Do not pay yet.','ডেলিভারি অনুরোধ জমা হয়েছে। চার্জ নিশ্চিত না হওয়া পর্যন্ত পেমেন্ট নয়।')),fulfillment==='pickup'?!pickup:address.length<10)}
     </View>}
     {selectedQuote===q.id&&q.status==='quoted'&&<View>
      {input(t('Full name','পুরো নাম'),name,setName)}
      {input(t('Mobile number','মোবাইল'),phone,setPhone)}
      {choose(t('I accept this exact final total and policies','আমি এই চূড়ান্ত মূল্য ও শর্ত মেনে নিচ্ছি'),terms,()=>setTerms(v=>!v))}
      {btn(t('Accept '+taka(total),'মেনে নিন '+taka(total)),()=>void action(()=>decideCustomerQuote(q.id,'accept',name,phone,terms),t('Final total accepted. Follow official payment instructions only.','চূড়ান্ত মূল্য মেনে নেওয়া হয়েছে। অফিসিয়াল অ্যাকাউন্টে পেমেন্ট করুন।')),!terms||total===null)}
     </View>}
     {selectedQuote===q.id&&q.status==='accepted'&&<View>
      <Text style={{color:theme.text,fontSize:11,marginTop:8}}>{t('Pay only the exact accepted total to the official recipient. A transaction reference is not verification.','শুধু অফিসিয়াল অ্যাকাউন্টে নির্ধারিত টাকা পাঠান। রেফারেন্স যাচাইয়ের প্রমাণ নয়।')}</Text>
      {payees.map(p=>choose(p.method.toUpperCase()+' · '+p.account_name+' · '+p.account_number,recipient===p.id,()=>setRecipient(p.id)))}
      {input(t('Transaction reference','ট্রানজেকশন আইডি'),reference,setReference)}
      {btn(t('Submit for staff verification','যাচাইয়ের জন্য জমা দিন'),()=>void action(()=>submitCustomerPayment(q.id,recipient,reference),t('Reference received. Wait for independent verification.','রেফারেন্স জমা হয়েছে। যাচাইয়ের জন্য অপেক্ষা করুন।')),!recipient||reference.length<6)}
     </View>}
     {['awaiting_delivery','quoted','accepted'].includes(q.status)&&btn(t('Cancel quote without creating an order','অর্ডার ছাড়াই বাতিল করুন'),()=>Alert.alert(t('Cancel final quote?','চূড়ান্ত দাম বাতিল করবেন?'),t('Your joined round cannot be changed after closure. Confirm cancellation?','বন্ধ রাউন্ড বদলানো যায় না। বাতিল করবেন?'),[
      {text:t('Keep','রাখুন'),style:'cancel'},
      {text:t('Cancel quote','বাতিল'),style:'destructive',onPress:()=>void action(()=>decideCustomerQuote(q.id,'cancel','','',false),t('Quote cancelled; no order was created.','বাতিল হয়েছে; অর্ডার তৈরি হয়নি।'))}
     ]))}
    </View>
   })}
   {!ownQuotes.length&&<View style={panel}><Text style={{color:theme.muted}}>{t('No closed Deal or Pool quotes yet. After the round closes, your locked quote appears here.','ডিল বা পুল বন্ধ হলে চূড়ান্ত দাম এখানে দেখা যাবে।')}</Text></View>}
  </View>}
  {userId&&snapshot&&pane==='orders'&&<View>
   {ownOrders.map(o=><View key={o.id} style={panel}>
    <Text style={{color:theme.text,fontWeight:'900'}}>#{o.id.slice(0,8).toUpperCase()}</Text>
    <Text style={{color:theme.muted,fontSize:12}}>{o.status} · {o.payment_status} · {new Date(o.created_at).toLocaleDateString('en-BD')}</Text>
    <Text style={{color:theme.accent,fontSize:16,fontWeight:'900',marginTop:7}}>{taka(o.total_amount)}</Text>
    {o.status==='confirmed'&&o.payment_status!=='verified'&&btn(t('Payment instructions','পেমেন্ট নির্দেশনা'),()=>void openOrder(o))}
    {directOrderId===o.id&&o.status==='confirmed'&&o.payment_status!=='verified'&&<View>
     <Text style={{color:theme.muted,fontSize:11,marginTop:8}}>{t('Only staff-verified bank/bKash transfer confirms payment.','শুধু ব্যাংক/বিকাশ পেমেন্ট যাচাই হলে পেমেন্ট নিশ্চিত হবে।')}</Text>
     {payees.map(p=>choose(p.method+' · '+p.account_name+' · '+p.account_number,recipient===p.id,()=>setRecipient(p.id)))}
     {input(t('Transaction ID','ট্রানজেকশন আইডি'),reference,setReference)}
     {btn(t('Submit payment reference','পেমেন্ট রেফারেন্স জমা'),()=>void action(()=>submitDirectOrderPayment(o.id,recipient,reference),t('Staff will independently verify this transfer.','স্টাফ পেমেন্ট যাচাই করবে।')),!recipient||reference.length<6)}
    </View>}
   </View>)}
   {!ownOrders.length&&<View style={panel}><Text style={{color:theme.muted}}>{t('No confirmed or requested direct orders yet.','এখনো কোনো সরাসরি অর্ডার নেই।')}</Text></View>}
  </View>}
  {userId&&snapshot&&pane==='savings'&&<View style={panel}>
   <Text style={{color:theme.muted,fontSize:11}}>{t('Only fulfilled, verified orders count, net of returns and delivery. Savings are not wallet money.','সম্পন্ন ও যাচাইকৃত অর্ডারের সাশ্রয় দেখানো হয়। এটি ওয়ালেট টাকা নয়।')}</Text>
   <Text style={{color:theme.accent,fontSize:22,fontWeight:'900',marginTop:12}}>{t('Verified net','যাচাইকৃত সাশ্রয়')}: {taka(snapshot.savings.filter(x=>!x.is_synthetic).reduce((n,s)=>n+Number(s.net_saving),0))}</Text>
   {snapshot.savings.filter(x=>!x.is_synthetic).map(s=><Text key={s.order_id} style={{color:theme.text,marginTop:9}}>{s.order_code} · {taka(s.net_saving)}</Text>)}
   {!snapshot.savings.some(s=>!s.is_synthetic)&&<Text style={{color:theme.muted,marginTop:8}}>{t('No eligible savings yet.','এখনো সাশ্রয় নেই।')}</Text>}
  </View>}
  {userId&&snapshot&&pane==='notifications'&&<View>
   {btn(t('Mark all read','সব পড়া হয়েছে'),()=>void action(markAllCustomerNotifications,t('Notifications marked read.','নোটিফিকেশন পড়া হয়েছে।')))}
   {snapshot.notifications.map(n=><View key={n.id} style={panel}>
    <Text style={{color:theme.text,fontSize:12,fontWeight:n.read_at?'500':'900'}}>{n.title}</Text>
    <Text style={{color:theme.muted,fontSize:11,marginTop:4}}>{n.body}</Text>
    <Text style={{color:theme.muted,fontSize:10}}>{new Date(n.created_at).toLocaleString('en-BD')}</Text>
    {btn(t('View my commitments','আমার ডিল ও পুল দেখুন'),()=>onNavigate('commitments'))}
   </View>)}
   {!snapshot.notifications.length&&<Text style={{color:theme.muted,marginTop:10}}>{t('No notifications yet.','এখনো নোটিফিকেশন নেই।')}</Text>}
  </View>}
  {pane==='checkout'&&<View>
   <View style={panel}>
    {direct.map(row=><Text key={row.offer.id} style={{color:theme.text,marginBottom:6}}>{products.find(p=>p.id===row.offer.productId)?.name??t('Product','পণ্য')} × {row.quantity} · {taka(row.offer.price*row.quantity)}</Text>)}
    <Text style={{color:theme.accent,fontWeight:'900',fontSize:18,marginTop:8}}>{t('Estimated product subtotal','পণ্যের আনুমানিক মূল্য')}: {taka(subtotal)}</Text>
    <Text style={{color:theme.muted,fontSize:11,marginTop:6}}>{t('Staff confirms any delivery fee and approves the direct request before payment. Group Deal and Pool drafts are excluded.','পেমেন্টের আগে ডেলিভারি চার্জ ও সরাসরি অর্ডার স্টাফ নিশ্চিত করবে। গ্রুপ ডিল ও পুল এখানে নেই।')}</Text>
   </View>
   {!direct.length&&btn(t('Back to cart','কার্টে ফিরুন'),onCart)}
   {!!direct.length&&snapshot&&<View style={panel}>
    {input(t('Full name','পুরো নাম'),name,setName)}
    {input(t('Mobile number','মোবাইল'),phone,setPhone)}
    <View style={{flexDirection:'row',gap:7}}>{choose(t('Pickup','পিকআপ'),deliveryMethod==='pickup',()=>setDeliveryMethod('pickup'))}{choose(t('Home delivery','হোম ডেলিভারি'),deliveryMethod==='home_delivery',()=>setDeliveryMethod('home_delivery'))}</View>
    {deliveryMethod==='pickup'?relevantPoints.map(p=>choose(p.name+' · '+p.address,directPickup===p.id,()=>setDirectPickup(p.id)))
     :input(t('Complete address','সম্পূর্ণ ঠিকানা'),directAddress,setDirectAddress,true)}
    {choose(t('I accept the Terms, Return and Refund Policies','আমি শর্ত, রিটার্ন ও রিফান্ড নীতিমালা মেনে নিচ্ছি'),terms,()=>setTerms(v=>!v))}
    {btn(t('Submit direct order for review','সরাসরি অর্ডার জমা দিন'),()=>void action(async()=>{
      const location=deliveryMethod==='pickup'?relevantPoints.find(p=>p.id===directPickup):null;
      if(deliveryMethod==='pickup'&&!location)throw new Error('Select your community pickup point');
      await submitDirectCustomerOrder(direct.map(x=>({product_id:x.offer.productId,quantity:x.quantity})),
       requestId.current,name,phone,deliveryMethod,directPickup,
       deliveryMethod==='pickup'?'Community pickup: '+location!.name+' — '+location!.address:directAddress,terms);
     },t('Order request submitted. Staff will review delivery fee before any payment.','অর্ডার অনুরোধ জমা হয়েছে। পেমেন্টের আগে স্টাফ যাচাই করবে।'),()=>{
      onClearCart();requestId.current=makeUuid();onNavigate('orders');
     }),disabled||!terms||!name||!phone||(deliveryMethod==='pickup'?!directPickup:directAddress.length<10))}
    <Text style={{color:theme.muted,marginTop:9,fontSize:11}}>{t('Read policies: 2takarbazar.com/terms, /return-policy, /refund-policy','নীতিমালা দেখুন: 2takarbazar.com/terms, /return-policy, /refund-policy')}</Text>
   </View>}
  </View>}
  {userId&&btn(t('Refresh latest status','সর্বশেষ অবস্থা দেখুন'),()=>void refresh())}
 </View>;
}
