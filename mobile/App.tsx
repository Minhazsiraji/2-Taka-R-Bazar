import React,{useEffect,useMemo,useState} from 'react';
import {Alert,Image,Linking,Pressable,ScrollView,StyleSheet,Text,TextInput,View,useWindowDimensions} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import {copy,heroMessages,type Language} from './src/content';
import {demoOrders,demoSavings,offers as demoOffers,pools as demoPools,products as demoProducts,type Offer,type Pool,type Product} from './src/data';
import {cartLineCount,cartQuantity,cartSubtotal,customerSaving} from './src/domain.mjs';
import {loadPublicCatalog} from './src/live';

type Tab='home'|'pools'|'deals'|'exclusive'|'cart';
type Screen=Tab|'account'|'orders'|'savings'|'product'|'group'|'pool'|'menu';
type IconName=React.ComponentProps<typeof Ionicons>['name'];
const SITE=(process.env.EXPO_PUBLIC_SITE_URL || 'https://2takarbazar.com').replace(/\/$/,'');
const requestedDemo=process.env.EXPO_PUBLIC_DEMO_MODE!=='false';
const palette={
 light:{background:'#e7e2e8',card:'#f9f7fa',text:'#17213b',muted:'#60708d',line:'#fff',field:'#ffffffb5',accent:'#0b8995',soft:'#d7f5f5'},
 dark:{background:'#090f19',card:'#172233',text:'#f1f5ff',muted:'#a7b4c9',line:'#42516a',field:'#1f2c40',accent:'#35cfcf',soft:'#163f48'}
};
const money=(n:number)=>'৳'+Math.round(n).toLocaleString('en-US');
function ProductPhoto({item,height=134}:{item:Product;height?:number}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[item.image]);
 return <View style={{height,backgroundColor:'#f7eac8',borderRadius:13,overflow:'hidden',justifyContent:'center',alignItems:'center'}}>
  {failed?<Ionicons name="bag-handle-outline" size={46} color="#aa8a48"/>:<Image source={{uri:item.image}} style={{width:'100%',height:'100%'}} resizeMode="cover" onError={()=>setFailed(true)}/>}
 </View>;
}
function Shop(){
 const {width}=useWindowDimensions();
 const [lang,setLang]=useState<Language>('en');
 const [dark,setDark]=useState(false);
 const [screen,setScreen]=useState<Screen>('home');
 const [selectedOffer,setSelectedOffer]=useState<Offer|null>(null);
 const [selectedPool,setSelectedPool]=useState<Pool|null>(null);
 const [slide,setSlide]=useState(0);
 const [query,setQuery]=useState('');
 const [cart,setCart]=useState<Record<string,number>>({});
 const [demo,setDemo]=useState(requestedDemo);
 const [products,setProducts]=useState<Product[]>(demoProducts);
 const [offers,setOffers]=useState<Offer[]>(demoOffers);
 const [pools,setPools]=useState<Pool[]>(demoPools);
 const [busy,setBusy]=useState(false);
 const theme=dark?palette.dark:palette.light;
 const t=copy[lang];
 useEffect(()=>{const tick=setInterval(()=>setSlide(s=>(s+1)%heroMessages.length),9000);return()=>clearInterval(tick)},[]);
 useEffect(()=>{
  if(requestedDemo)return;
  let alive=true;
  setBusy(true);
  loadPublicCatalog().then(result=>{
    if(!alive)return;
    setProducts(result.products);setOffers(result.offers);setPools([]);setDemo(false);
  }).catch(()=>{
    if(alive){setDemo(true);Alert.alert('Live catalog unavailable','Showing clearly labeled demo products. No purchases are enabled.')}
  }).finally(()=>{if(alive)setBusy(false)});
  return()=>{alive=false};
 },[]);
 const byId=(id:string)=>products.find(p=>p.id===id);
 const filtered=(list:Offer[])=>list.filter(o=>{
   const p=byId(o.productId);return p && (p.name+' '+p.nameBn+' '+p.category).toLowerCase().includes(query.toLowerCase());
 });
 const group=filtered(offers.filter(o=>o.mode==='GROUP_DEAL'));
 const solo=filtered(offers.filter(o=>o.mode==='SOLO'&&o.exclusive));
 const onTab=(tab:Tab)=>{setSelectedOffer(null);setSelectedPool(null);setScreen(tab)};
 const selectOffer=(offer:Offer)=>{setSelectedOffer(offer);setScreen(offer.mode==='GROUP_DEAL'?'group':'product')};
 const selectPool=(pool:Pool)=>{setSelectedPool(pool);setScreen('pool')};
 const updateCart=(id:string,delta:number)=>setCart(previous=>{
  const current=previous[id]||0;const next=Math.max(0,Math.min(100,current+delta));
  const clone={...previous};if(next)clone[id]=next;else delete clone[id];return clone;
 });
 const add=(offer:Offer)=>{if(!demo){Alert.alert('Checkout not enabled','Live mobile purchasing requires separate qualification. Continue via the current website.');return}updateCart(offer.id,1)};
 const notify=()=>Alert.alert(demo?'Demo preview':'Information','No real order or savings transaction has been created.');
 const link=(path:string)=>{void Linking.openURL(SITE+path)};
 const small=width<385;
 const pill=(label:string,active=false)=><View style={{backgroundColor:active?theme.soft:theme.field,paddingHorizontal:8,paddingVertical:4,borderRadius:16}}><Text style={{fontSize:10,fontWeight:'700',color:active?'#086a74':theme.text}}>{label}</Text></View>;
 const button=(label:string,action:()=>void,solid=true,compact=false)=><Pressable accessibilityRole="button" onPress={action} style={{backgroundColor:solid?theme.accent:theme.field,borderRadius:10,paddingVertical:compact?8:11,paddingHorizontal:compact?8:13,alignItems:'center',justifyContent:'center',flex:1,borderWidth:solid?0:1,borderColor:theme.line}}>
  <Text style={{fontSize:compact?11:13,fontWeight:'800',color:solid?(dark?'#082d34':'white'):theme.text}} numberOfLines={1}>{label}</Text>
 </Pressable>;
 const panel=(child:React.ReactNode)=><View style={[styles.panel,{backgroundColor:theme.card,borderColor:theme.line}]}>{child}</View>;
 const title=(k:string,name:string,action?:()=>void)=><View style={styles.titleRow}><View style={{flex:1}}><Text style={{color:theme.accent,fontWeight:'900',fontSize:10,letterSpacing:1.5}}>{k}</Text><Text style={{color:theme.text,fontSize:21,fontWeight:'900',letterSpacing:-.65}}>{name}</Text></View>{action&&<Pressable onPress={action}><Text style={{color:theme.accent,fontWeight:'700',fontSize:12}}>{t.viewAll}  ›</Text></Pressable>}</View>;
 const headerAction=(name:IconName,fn:()=>void,badge=0)=><Pressable accessibilityRole="button" accessibilityLabel={name} onPress={fn} style={[styles.headerIcon,{borderColor:theme.line,backgroundColor:theme.field}]}>
   <Ionicons name={name} size={18} color={theme.text}/>{badge>0&&<View style={styles.badge}><Text style={styles.badgeText}>{badge>99?'99+':badge}</Text></View>}
  </Pressable>;
 const savingTile=(name:string,value:string,icon:IconName,tint:string)=> <Pressable onPress={()=>setScreen('savings')} style={[styles.savingTile,{backgroundColor:dark?theme.field:tint,borderColor:theme.line}]}>
  <Ionicons name={icon} size={18} color={theme.accent}/><View style={{flex:1}}><Text style={{fontSize:11,color:theme.muted}}>{name}</Text><Text style={{fontSize:17,fontWeight:'900',color:theme.text}}>{value}</Text></View>
 </Pressable>;
 function Savings(){return panel(<><View style={styles.between}><Text style={{fontSize:16,fontWeight:'900',color:theme.text}}>▥  {t.savings}</Text><Pressable onPress={()=>setScreen('savings')}><Text style={{color:theme.accent,fontSize:12}}>{t.viewReport} ›</Text></Pressable></View>
  <View style={styles.twoCol}>
   {savingTile(t.thisMonth,demo?money(demoSavings.thisMonth):'—','calendar-outline','#e2faed')}
   {savingTile(t.lastMonth,demo?money(demoSavings.lastMonth):'—','time-outline','#e8f2fe')}
   {savingTile(t.lifetime,demo?money(demoSavings.lifetime):'—','star-outline','#fff7df')}
   {savingTile(t.communityTotal,demo?money(demoSavings.community):'—','people-outline','#f2e8ff')}
  </View><Text style={{color:theme.muted,fontSize:10,marginTop:7}}>{demo?'Illustrative only · Verified savings after eligible completion.':t.notEarned}</Text>
 </>)}
 function DealCard({offer}:{offer:Offer}){
  const item=byId(offer.productId);if(!item)return null;
  const ratio=Math.min(100,100*(offer.joined||0)/(offer.groupSize||5));
  return panel(<View style={{flexDirection:'row',gap:10}}>
    <Pressable onPress={()=>selectOffer(offer)} style={{width:'42%'}}>
      <ProductPhoto item={item} height={small?166:178}/>
      <View style={{position:'absolute',top:7,left:7}}>{pill('GROUP DEAL',true)}</View>
    </Pressable>
    <View style={{flex:1,justifyContent:'space-between',gap:4}}>
     <View><Text style={{color:theme.accent,fontSize:9,fontWeight:'900'}}>BUY TOGETHER · SAVE MORE</Text><Text style={{color:theme.text,fontSize:15,fontWeight:'900'}} numberOfLines={2}>{lang==='bn'?item.nameBn:item.name}</Text><Text style={{color:theme.muted,fontSize:11}}>{item.unit} · {offer.community}</Text></View>
     <View style={{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'}}><Text style={{fontSize:21,fontWeight:'900',color:theme.accent}}>{money(offer.price)}</Text><Text style={{fontSize:11,color:theme.muted,textDecorationLine:'line-through'}}>{money(item.referencePrice)}</Text></View>
     <View style={{alignSelf:'flex-start'}}>{pill(t.save+' '+money(customerSaving(item.referencePrice,offer.price)),true)}</View>
     <Text style={{color:theme.muted,fontSize:10}}>{offer.joined||0}/{offer.groupSize||5} joined · {offer.daysLeft} day(s) left</Text>
     <View style={{height:5,backgroundColor:theme.field,borderRadius:5,overflow:'hidden'}}><View style={{height:5,width:String(ratio)+'%',backgroundColor:'#2ec9b5'}}/></View>
     <View style={{flexDirection:'row',gap:5}}>{button(t.details,()=>selectOffer(offer),false,true)}{button(t.join,()=>selectOffer(offer),true,true)}</View>
    </View>
   </View>);
 }
 function ExclusiveCard({offer}:{offer:Offer}){
  const item=byId(offer.productId);if(!item)return null;
  return <View style={[styles.exclusiveCard,{backgroundColor:theme.card,borderColor:theme.line}]}>
   <View style={{flexDirection:'row',gap:6,flex:1}}>
    <Pressable onPress={()=>selectOffer(offer)} style={{width:'49%'}}><ProductPhoto item={item} height={120}/></Pressable>
    <View style={{flex:1,justifyContent:'space-around'}}>
     <Text numberOfLines={2} style={{fontSize:12,fontWeight:'800',color:theme.text}}>{lang==='bn'?item.nameBn:item.name}</Text>
     <Text style={{fontSize:10,color:theme.muted}}>{item.unit}</Text>
     <Text style={{fontSize:16,fontWeight:'900',color:theme.accent}}>{money(offer.price)}</Text>
     <Text style={{fontSize:10,color:theme.muted,textDecorationLine:'line-through'}}>{money(item.referencePrice)}</Text>
     <View>{pill(t.save+' '+money(customerSaving(item.referencePrice,offer.price)),true)}</View>
     <Text style={{fontSize:9,color:theme.muted}}>{t.stock} · {offer.stock||0}</Text>
    </View>
   </View>
   <View style={{marginTop:6,flexDirection:'row'}}>{button('🛒 '+t.add,()=>add(offer),true,true)}</View>
  </View>;
 }
 function PoolCard({pool}:{pool:Pool}){
  return panel(<Pressable onPress={()=>selectPool(pool)} style={{flexDirection:'row',alignItems:'center',gap:10}}>
   <View style={{width:'41%',flexDirection:'row',gap:3}}>
    {pool.productIds.slice(0,3).map(id=>{const p=byId(id);return p?<View key={id} style={{flex:1}}><ProductPhoto item={p} height={88}/></View>:null})}
   </View>
   <View style={{flex:1,gap:5}}>
    <View style={styles.between}>{pill(pool.frequency==='weekly'?t.weekly:t.monthly,true)}{pill('ACTIVE')}</View>
    <Text style={{fontSize:13,fontWeight:'900',color:theme.text}} numberOfLines={1}>{lang==='bn'?pool.nameBn:pool.name}</Text>
    <Text style={{fontSize:10,color:theme.muted}}>{pool.productIds.length} {t.products} · {pool.participants.toLocaleString('en-US')} {t.members}</Text>
    <View style={{height:5,borderRadius:6,backgroundColor:theme.field}}><View style={{height:5,width:String(Math.min(100,100*pool.participants/pool.nextTier))+'%',backgroundColor:'#35cdb9',borderRadius:5}}/></View>
    <Text style={{fontSize:10,color:theme.accent,fontWeight:'700'}}>{t.next}: {pool.nextTier.toLocaleString('en-US')}</Text>
   </View>
  </Pressable>);
 }
 const Hero=()=><View style={[styles.hero,{backgroundColor:dark?'#063f48':'#087682'}]}>
  <Text style={{color:'#a5fbef',fontWeight:'800',fontSize:10,letterSpacing:1.5}}>✦ SMART SHOPPING. REAL SAVINGS!</Text>
  <Text style={{fontSize:small?20:23,fontWeight:'900',color:'white',lineHeight:26,marginTop:7}}>{heroMessages[slide][lang][0]}</Text>
  <Text style={{fontSize:small?16:18,fontWeight:'900',color:'#cbffea',marginTop:1}}>{heroMessages[slide][lang][1]}</Text>
  <Text style={{color:'#e9fffa',fontSize:11,marginTop:8,maxWidth:'83%'}}>{heroMessages[slide][lang][2]}</Text>
  <View style={[styles.between,{marginTop:12}]}>
   <Pressable onPress={()=>onTab('deals')} style={{backgroundColor:'white',paddingVertical:8,paddingHorizontal:12,borderRadius:18}}><Text style={{color:'#086a74',fontWeight:'800',fontSize:11}}>Explore group deals →</Text></Pressable>
   <View style={{flexDirection:'row',gap:8}}><Pressable onPress={()=>setSlide(v=>(v+3)%4)}><Text style={styles.heroArrow}>‹</Text></Pressable><Pressable onPress={()=>setSlide(v=>(v+1)%4)}><Text style={styles.heroArrow}>›</Text></Pressable></View>
  </View>
  <View style={{alignSelf:'center',flexDirection:'row',gap:5,marginTop:8}}>{heroMessages.map((_,i)=><Pressable key={i} accessibilityLabel={'Slide '+(i+1)} onPress={()=>setSlide(i)} style={{height:5,width:i===slide?14:5,borderRadius:5,backgroundColor:i===slide?'white':'#8ac8cb'}}/>)}</View>
 </View>;
 function Home(){return <>
  <View style={[styles.between,{marginVertical:10}]}><Text style={{color:theme.text,fontSize:12,fontWeight:'700'}}>⌖ {t.community} · <Text style={{fontWeight:'500',color:theme.muted}}>Savar DOHS⌄</Text></Text>{pill(t.demo,true)}</View>
  <Hero/><View style={{marginTop:10}}><Savings/></View>
  {title('01 · COMMUNITY SAVINGS',t.groups,()=>onTab('deals'))}{group.slice(0,2).map(o=><DealCard key={o.id} offer={o}/>)}
  {title('02 · CURATED FOR YOU',t.exclusive,()=>onTab('exclusive'))}
  <View style={styles.twoCol}>{solo.slice(0,4).map(o=><ExclusiveCard key={o.id} offer={o}/>)}</View>
  {title('03 · BUY IN A POOL',t.pools,()=>onTab('pools'))}{pools.map(p=><PoolCard key={p.id} pool={p}/>)}
  <Footer/>
 </>}
 function Footer(){return <View style={{paddingVertical:16,marginTop:12,borderTopWidth:1,borderColor:theme.line}}>
  <Text style={{fontSize:13,fontWeight:'900',color:theme.text}}>2-TAKA-R-BAZAR</Text><Text style={{fontSize:11,color:theme.muted}}>Smart shopping. Real savings!</Text><Text style={{fontSize:11,color:theme.muted}}>একসাথে কিনি, কম দামে পাই!</Text>
  <Text style={{fontSize:11,color:theme.muted,marginTop:9}}>About 2TBR  ·  FAQ  ·  How it works  ·  Terms & Policies</Text>
  <Text style={{fontSize:11,color:theme.muted,marginTop:3}}>support@2takarbazar.com</Text>
  <Text style={{fontSize:10,color:theme.muted,marginTop:8}}>© 2026 2-TAKA-R-BAZAR · Developed by agentsiraji.com</Text>
 </View>}
 function OfferDetails(){const offer=selectedOffer;if(!offer)return null;const p=byId(offer.productId);if(!p)return null;
  const all=offers.filter(o=>o.productId===p.id);
  return <>{title(offer.mode==='GROUP_DEAL'?'GROUP DEAL':'PRODUCT DETAILS',lang==='bn'?p.nameBn:p.name)}
    <ProductPhoto item={p} height={260}/>
    {panel(<><Text style={{color:theme.muted,marginBottom:8}}>{p.unit} · {offer.community}</Text>
      <View style={styles.between}><Text style={{color:theme.accent,fontSize:27,fontWeight:'900'}}>{money(offer.price)}</Text><Text style={{textDecorationLine:'line-through',color:theme.muted}}>{money(p.referencePrice)}</Text></View>
      <View style={{marginVertical:8,alignSelf:'flex-start'}}>{pill(t.save+' '+money(customerSaving(p.referencePrice,offer.price)),true)}</View>
      {offer.mode==='GROUP_DEAL'&&<><Text style={{color:theme.text,fontWeight:'800',marginBottom:5}}>{offer.joined}/{offer.groupSize} neighbours joined</Text>
       <View style={{height:8,backgroundColor:theme.field,borderRadius:5}}><View style={{height:8,width:String(Math.min(100,100*(offer.joined||0)/(offer.groupSize||5)))+'%',backgroundColor:theme.accent,borderRadius:5}}/></View>
       <Text style={{color:theme.muted,marginVertical:7,fontSize:11}}>Target: {offer.groupSize} people · Ends in {offer.daysLeft} day(s). Confirmation depends on the published deal rules.</Text></>}
      <Text style={{fontSize:12,fontWeight:'900',color:theme.text,marginBottom:5,marginTop:7}}>Same product · Available offers</Text>
      {all.map(o=><Pressable key={o.id} onPress={()=>setSelectedOffer(o)} style={[styles.priceOption,{borderColor:o.id===offer.id?theme.accent:theme.line}]}>
       <Text style={{color:theme.text,fontSize:12}}>{o.mode==='SOLO'?'Direct / Exclusive':o.mode==='GROUP_DEAL'?String(o.groupSize)+'-person Group Deal':'Community Pool'}</Text>
       <Text style={{color:theme.accent,fontSize:14,fontWeight:'900'}}>{money(o.price)}</Text>
      </Pressable>)}
      <View style={{flexDirection:'row',gap:8,marginTop:10}}>{button(t.details,()=>link('/products/'+p.id),false)}{button(offer.mode==='SOLO'?t.add:t.join,()=>offer.mode==='SOLO'?add(offer):notify())}</View>
      <Text style={{color:theme.muted,fontSize:10,marginTop:8}}>{demo?t.notice:'Native checkout is not enabled. Current website flows remain authoritative.'}</Text>
    </>)}
  </>;
 }
 function PoolDetails(){const pool=selectedPool;if(!pool)return null;const list=offers.filter(o=>o.mode==='POOL'&&o.poolId===pool.id);return <>
   {title(pool.frequency.toUpperCase()+' POOL',lang==='bn'?pool.nameBn:pool.name)}
   {panel(<><Text style={{color:theme.accent,fontWeight:'900'}}>{pool.productIds.length} {t.products} · {pool.participants.toLocaleString('en-US')} {t.members}</Text>
    <Text style={{color:theme.muted,marginTop:6,fontSize:12}}>No cap on people · Next savings milestone: {pool.nextTier.toLocaleString('en-US')} households.</Text>
    <View style={{height:8,backgroundColor:theme.field,borderRadius:5,marginTop:9}}><View style={{height:8,width:String(Math.min(100,100*pool.participants/pool.nextTier))+'%',backgroundColor:theme.accent,borderRadius:5}}/></View>
   </>)}
   {list.map(o=>{const p=byId(o.productId);if(!p)return null;return panel(<View style={{flexDirection:'row',gap:9,alignItems:'center'}}>
    <View style={{width:80}}><ProductPhoto item={p} height={76}/></View>
    <View style={{flex:1}}><Text style={{color:theme.text,fontSize:13,fontWeight:'800'}}>{lang==='bn'?p.nameBn:p.name} · {p.unit}</Text>
    <Text style={{color:theme.accent,fontWeight:'900'}}>{money(o.price)}  <Text style={{color:theme.muted,textDecorationLine:'line-through',fontSize:10}}>{money(p.referencePrice)}</Text></Text>
    <Text style={{color:theme.muted,fontSize:10}}>{t.save} {money(customerSaving(p.referencePrice,o.price))}</Text></View>
    <Pressable onPress={notify} style={{padding:8,borderRadius:8,backgroundColor:theme.accent}}><Text style={{color:'#fff',fontWeight:'800'}}>Join</Text></Pressable>
   </View>)})}
   {panel(<Text style={{color:theme.muted,fontSize:11}}>{t.notice} Pool quantities and the final selling price will be confirmed by the real system.</Text>)}
  </>;
 }
 function Cart(){const rows=Object.entries(cart).filter(([,q])=>q>0);return <>
  {title('SHOPPING BAG',t.cart)}
  {rows.length===0?panel(<Text style={{color:theme.muted}}>{t.empty}</Text>):rows.map(([id,q])=>{
   const offer=offers.find(o=>o.id===id);const p=offer&&byId(offer.productId);if(!offer||!p)return null;
   return panel(<View style={{flexDirection:'row',gap:9,alignItems:'center'}}><View style={{width:80}}><ProductPhoto item={p} height={76}/></View><View style={{flex:1}}>
    <Text style={{fontSize:13,fontWeight:'800',color:theme.text}}>{lang==='bn'?p.nameBn:p.name}</Text>
    <Text style={{color:theme.muted,fontSize:11}}>{money(offer.price)} · {p.unit}</Text>
    <Text style={{color:theme.accent,fontWeight:'800'}}>{money(offer.price*q)}</Text></View>
    <View style={{flexDirection:'row',gap:8,alignItems:'center'}}><Pressable onPress={()=>updateCart(id,-1)}><Ionicons name="remove-circle-outline" size={24} color={theme.text}/></Pressable><Text style={{color:theme.text}}>{q}</Text><Pressable onPress={()=>updateCart(id,1)}><Ionicons name="add-circle-outline" size={24} color={theme.accent}/></Pressable></View>
   </View>);
  })}
  {panel(<><Text style={{color:theme.text,fontWeight:'900',fontSize:17}}>{t.cart}: {cartLineCount(cart)} product lines · {cartQuantity(cart)} units</Text>
   <Text style={{color:theme.accent,fontSize:22,fontWeight:'900',marginVertical:8}}>{money(cartSubtotal(cart,offers))}</Text>
   <View style={{flexDirection:'row'}}>{button(t.checkout,notify)}</View>
   <Text style={{color:theme.muted,fontSize:11,marginTop:8}}>{t.notice}</Text></>)}
 </>}
 function Account(){return <>
  {title('2TBR ACCOUNT',t.account)}{panel(<><Text style={{color:theme.text,fontWeight:'800',fontSize:18}}>Welcome to 2TBR</Text><Text style={{color:theme.muted,marginTop:3}}>Savar DOHS · {demo?'Demo account':'Sign in to view private data'}</Text></>)}
  <Savings/>
  {[[t.orders,'receipt-outline','orders'],[t.savings,'stats-chart-outline','savings'],['Saved addresses','location-outline','/account/addresses'],['My Money','wallet-outline','/money'],['Notifications','notifications-outline','/notifications'],['Preferences','settings-outline','/account']].map(([label,icon,destination])=><Pressable key={label} onPress={()=>destination==='orders'||destination==='savings'?setScreen(destination):link(destination)} style={[styles.menuRow,{backgroundColor:theme.card,borderColor:theme.line}]}>
    <Ionicons name={icon as IconName} size={21} color={theme.accent}/><Text style={{color:theme.text,flex:1,fontWeight:'700'}}>{label}</Text><Ionicons name="chevron-forward" color={theme.muted} size={16}/>
   </Pressable>)}
   {panel(<View style={{flexDirection:'row'}}>{button(t.signin,()=>link('/login'),false)}</View>)}
 </>}
 function Orders(){return <>{title('ORDER HISTORY',t.orders)}
  {demo?demoOrders.map(order=>panel(<><View style={styles.between}><Text style={{color:theme.text,fontWeight:'800'}}>{order.id}</Text>{pill(order.status,true)}</View><Text style={{color:theme.muted,fontSize:11,marginVertical:7}}>{order.date} · {order.items.length} items</Text>
   <View style={{flexDirection:'row',gap:5}}>{order.items.map(id=>{const p=byId(id);return p?<View key={id} style={{width:64}}><ProductPhoto item={p} height={60}/></View>:null})}</View>
   <Text style={{color:theme.accent,fontSize:18,fontWeight:'900',marginTop:7}}>{money(order.value)}</Text>
   <Text style={{color:theme.muted,fontSize:11}}>{order.status==='Completed'?'Illustrative saving '+money(order.saving):'Potential savings are not yet earned.'}</Text></>)):panel(<><Text style={{color:theme.muted,marginBottom:12}}>Native authenticated order history is pending qualification. Your real order records remain available on the website.</Text><View style={{flexDirection:'row'}}>{button('Open my orders',()=>link('/account/orders'))}</View></>)}
 </>}
 function Menu(){return <>{title('EXPLORE', '2TBR Menu')}{[['My Orders','orders'],['Savings','savings'],['My Account','account'],['Community Pools','pools'],['Group Deals','deals']].map(([text,destination])=><Pressable key={text} onPress={()=>setScreen(destination as Screen)} style={[styles.menuRow,{backgroundColor:theme.card,borderColor:theme.line}]}><Text style={{color:theme.text}}>{text}</Text></Pressable>)}<Footer/></>}
 function body(){
 switch(screen){
 case 'home':return <Home/>;
 case 'deals':return <>{title('GROUP SHOPPING',t.groups)}{group.map(o=><DealCard key={o.id} offer={o}/>)}</>;
 case 'exclusive':return <>{title('CURATED FOR YOU',t.exclusive)}<View style={styles.twoCol}>{solo.map(o=><ExclusiveCard key={o.id} offer={o}/>)}</View></>;
 case 'pools':return <>{title('BUY TOGETHER',t.pools)}{pools.map(p=><PoolCard key={p.id} pool={p}/>)}</>;
 case 'cart':return <Cart/>;
 case 'account':return <Account/>;
 case 'orders':return <Orders/>;
 case 'savings':return <>{title('VERIFIED REPORT',t.savings)}<Savings/>{panel(<Text style={{color:theme.muted}}>{demo?'All values on this screen are illustrative.':t.notEarned} Verified orders only; this is not a withdrawable cash balance.</Text>)}</>;
 case 'group':case 'product':return <OfferDetails/>;
 case 'pool':return <PoolDetails/>;
 case 'menu':return <Menu/>;
 }}
 const tabs:[Tab,IconName][]=[['home','home-outline'],['pools','people-outline'],['deals','pricetag-outline'],['exclusive','basket-outline'],['cart','cart-outline']];
 return <SafeAreaView style={{flex:1,backgroundColor:theme.background}} edges={['top','left','right','bottom']}>
  <StatusBar style={dark?'light':'dark'}/>
  <View style={{paddingHorizontal:12,paddingTop:6,paddingBottom:8,backgroundColor:theme.background,borderBottomWidth:1,borderColor:theme.line}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
    <Pressable accessibilityLabel="Home" onPress={()=>onTab('home')}><Image source={{uri:SITE+'/brand-mark-transparent.png'}} style={{width:small?32:36,height:36}} resizeMode="contain"/></Pressable>
    <Pressable onPress={()=>onTab('home')} style={{flex:1,minWidth:72}}><Text style={{fontSize:small?11:13,fontWeight:'900',color:theme.text}} numberOfLines={1}>2-TAKA-R-BAZAR</Text>
     <Text style={{fontSize:small?8:9,color:theme.muted}} numberOfLines={1}>Smart shopping. Real savings!</Text>
     <Text style={{fontSize:small?8:9,color:theme.muted}} numberOfLines={1}>একসাথে কিনি, কম দামে পাই!</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={()=>setLang(v=>v==='en'?'bn':'en')} style={[styles.headerIcon,{borderColor:theme.line,backgroundColor:theme.field}]}><Text style={{fontSize:10,fontWeight:'900',color:theme.text}}>{lang==='en'?'BAN':'EN'}</Text></Pressable>
    {headerAction(dark?'sunny-outline':'moon-outline',()=>setDark(v=>!v))}
    {headerAction('notifications-outline',()=>demo?notify():link('/notifications'),demo?1:0)}
    {headerAction('person-outline',()=>setScreen('account'))}
    {headerAction('menu-outline',()=>setScreen('menu'))}
   </View>
   <View style={[styles.search,{backgroundColor:theme.field,borderColor:theme.line}]}><Ionicons name="search-outline" size={17} color={theme.accent}/>
    <TextInput accessibilityLabel={t.search} placeholder={t.search} placeholderTextColor={theme.muted} value={query} onChangeText={setQuery} style={{flex:1,fontSize:12,color:theme.text,paddingVertical:5}} returnKeyType="search"/>
   </View>
  </View>
  {busy&&<Text style={{textAlign:'center',color:theme.accent,fontSize:11}}>Loading public product catalog…</Text>}
  <ScrollView key={screen} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:12,paddingTop:4,paddingBottom:30}}>
   {!tabs.some(([tab])=>tab===screen)&&<Pressable onPress={()=>onTab('home')} style={{marginTop:8,flexDirection:'row',gap:5,alignItems:'center'}}><Ionicons name="chevron-back" size={16} color={theme.text}/><Text style={{color:theme.text}}>{t.back}</Text></Pressable>}
   {body()}
  </ScrollView>
  <View style={[styles.bottom,{backgroundColor:theme.card,borderColor:theme.line}]}>
   {tabs.map(([tab,icon])=>{const active=screen===tab;const label=tab==='exclusive'?t.shop:t[tab==='pools'?'pool':tab==='deals'?'deals':tab==='cart'?'cart':'home'];
    return <Pressable key={tab} accessibilityRole="tab" accessibilityState={{selected:active}} onPress={()=>onTab(tab)} style={{flex:1,alignItems:'center',gap:2,paddingVertical:6,backgroundColor:active?theme.soft:'transparent',borderRadius:12}}>
     <View><Ionicons name={icon} size={23} color={active?'#08717d':theme.text}/>{tab==='cart'&&cartLineCount(cart)>0&&<View style={styles.badge}><Text style={styles.badgeText}>{cartLineCount(cart)>99?'99+':cartLineCount(cart)}</Text></View>}</View>
     <Text style={{fontSize:small?9:10,fontWeight:active?'900':'600',color:active?'#08717d':theme.text}}>{label}</Text>
    </Pressable>
   })}
  </View>
 </SafeAreaView>;
}
export default function App(){return <SafeAreaProvider><Shop/></SafeAreaProvider>}
const styles=StyleSheet.create({
 between:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6},
 headerIcon:{width:31,height:32,borderRadius:20,borderWidth:1,justifyContent:'center',alignItems:'center',position:'relative'},
 badge:{position:'absolute',right:-8,top:-8,minWidth:17,height:17,borderRadius:10,backgroundColor:'#ed3035',paddingHorizontal:3,justifyContent:'center',alignItems:'center'},
 badgeText:{color:'white',fontSize:9,fontWeight:'900'},
 search:{marginTop:8,borderRadius:30,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:7,borderWidth:1},
 titleRow:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginTop:16,marginBottom:8},
 panel:{borderWidth:1,borderRadius:17,padding:10,marginBottom:9,shadowColor:'#18213b',shadowOpacity:.04,shadowRadius:9,elevation:1},
 twoCol:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'space-between'},
 savingTile:{width:'48.6%',minHeight:65,padding:8,borderRadius:12,flexDirection:'row',alignItems:'center',gap:7,borderWidth:1},
 hero:{padding:15,borderRadius:17,marginBottom:1,minHeight:196},
 heroArrow:{fontSize:24,color:'white',fontWeight:'700'},
 exclusiveCard:{width:'48.6%',borderRadius:15,padding:7,borderWidth:1,marginBottom:2,minHeight:168},
 bottom:{flexDirection:'row',paddingTop:5,borderTopWidth:1,paddingHorizontal:7},
 priceOption:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:10,borderRadius:9,borderWidth:1,marginTop:5},
 menuRow:{borderWidth:1,padding:14,borderRadius:12,flexDirection:'row',alignItems:'center',gap:10,marginTop:6}
});
