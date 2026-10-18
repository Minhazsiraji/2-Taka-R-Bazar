import React,{useEffect,useMemo,useState} from 'react';
import {Alert,Image,Linking,Pressable,ScrollView,StyleSheet,Text,TextInput,View,useWindowDimensions} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {palette,brandV1} from './src/theme';
import {NonperishableCart} from './src/nonperishable-cart';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import {copy,heroMessages,type Language} from './src/content';
import {demoOrders,demoSavings,offers as demoOffers,pools as demoPools,products as demoProducts,type Offer,type Pool,type Product} from './src/data';
import {cartLineCount,cartQuantity,cartSubtotal,customerSaving} from './src/domain.mjs';
import {loadPublicCatalog} from './src/live';
import {productInfoSections,productMissing} from './src/product-content';

type Tab='home'|'pools'|'deals'|'exclusive'|'cart';
type Screen=Tab|'account'|'orders'|'savings'|'product'|'group'|'retail'|'pool'|'menu';
type IconName=React.ComponentProps<typeof Ionicons>['name'];
const SITE=(process.env.EXPO_PUBLIC_SITE_URL || 'https://2takarbazar.com').replace(/\/$/,'');
const requestedDemo=process.env.EXPO_PUBLIC_DEMO_MODE!=='false';
// Shared V1 colors are managed in src/theme.ts; do not define screen-specific palettes here.
const money=(n:number)=>'৳'+Math.round(n).toLocaleString('en-US');
function ProductPhoto({item,height=134}:{item:Product;height?:number}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[item.image]);
 return <View style={{height,backgroundColor:brandV1.background,borderRadius:13,overflow:'hidden',justifyContent:'center',alignItems:'center'}}>
  {failed?<Ionicons name="bag-handle-outline" size={46} color={brandV1.primary}/>:<Image source={{uri:item.image}} style={{width:'100%',height:'100%'}} resizeMode="cover" onError={()=>setFailed(true)}/>}
 </View>;
}
function Shop(){
 const {width}=useWindowDimensions();
 const [lang,setLang]=useState<Language>('en');
 const [dark,setDark]=useState(false);
 const [screen,setScreen]=useState<Screen>('home');
 const [selectedOffer,setSelectedOffer]=useState<Offer|null>(null);
 const [selectedPool,setSelectedPool]=useState<Pool|null>(null);
 const [poolQuantities,setPoolQuantities]=useState<Record<string,Record<string,number>>>({});
 const [productInfoOpen,setProductInfoOpen]=useState<Record<string,boolean>>({});
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
 const changePoolQty=(poolId:string,id:string,delta:number)=>setPoolQuantities(old=>{const before=old[poolId]||{};return {...old,[poolId]:{...before,[id]:Math.max(0,Math.min(20,(before[id]||0)+delta))}}});
 const updateCart=(id:string,delta:number)=>setCart(previous=>{
  const current=previous[id]||0;const next=Math.max(0,Math.min(100,current+delta));
  const clone={...previous};if(next)clone[id]=next;else delete clone[id];return clone;
 });
 const add=(offer:Offer)=>{if(!demo){Alert.alert('Checkout not enabled','Live mobile purchasing requires separate qualification. Continue via the current website.');return}updateCart(offer.id,1)};
 const notify=()=>Alert.alert(demo?'Demo preview':'Information','No real order or savings transaction has been created.');
 const link=(path:string)=>{void Linking.openURL(SITE+path)};
 const small=width<385;
 const pill=(label:string,active=false)=><View style={{backgroundColor:active?theme.soft:theme.field,paddingHorizontal:8,paddingVertical:4,borderRadius:16}}><Text style={{fontSize:10,fontWeight:'700',color:active?theme.brandText:theme.text}}>{label}</Text></View>;
 const button=(label:string,action:()=>void,solid=true,compact=false)=><Pressable accessibilityRole="button" onPress={action} style={{backgroundColor:solid?theme.accent:theme.field,borderRadius:10,paddingVertical:compact?8:11,paddingHorizontal:compact?8:13,alignItems:'center',justifyContent:'center',flex:1,borderWidth:solid?0:1,borderColor:theme.line}}>
  <Text style={{fontSize:compact?11:13,fontWeight:'800',color:solid?theme.onPrimary:theme.text}} numberOfLines={1}>{label}</Text>
 </Pressable>;
 const panel=(child:React.ReactNode)=><View style={[styles.panel,{backgroundColor:theme.card,borderColor:theme.line}]}>{child}</View>;
 const title=(k:string,name:string,action?:()=>void)=><View style={[styles.titleRow,!k&&{marginTop:9,marginBottom:6}]}><View style={{flex:1}}>{!!k&&<Text style={{color:theme.accent,fontWeight:'900',fontSize:10,letterSpacing:1.5}}>{k}</Text>}<Text style={{color:theme.text,fontSize:21,fontWeight:'900',letterSpacing:-.65}}>{name}</Text></View>{action&&<Pressable onPress={action}><Text style={{color:theme.accent,fontWeight:'700',fontSize:12}}>{t.viewAll}  ›</Text></Pressable>}</View>;
 const headerAction=(name:IconName,fn:()=>void,badge=0)=><Pressable accessibilityRole="button" accessibilityLabel={name} onPress={fn} style={[styles.headerIcon,{borderColor:theme.line,backgroundColor:theme.field}]}>
   <Ionicons name={name} size={18} color={theme.text}/>{badge>0&&<View style={styles.badge}><Text style={styles.badgeText}>{badge>99?'99+':badge}</Text></View>}
  </Pressable>;
 const savingTile=(name:string,value:string,icon:IconName,tint:string)=> <Pressable onPress={()=>setScreen('savings')} style={[styles.savingTile,{backgroundColor:dark?theme.field:tint,borderColor:theme.line}]}>
   <Ionicons name={icon} size={16} color={theme.accent}/>
   <Text numberOfLines={2} style={{fontSize:small?8:9,lineHeight:11,color:theme.muted}}>{name}</Text>
   <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68} style={{fontSize:small?11:12,fontWeight:'900',color:theme.text,width:'100%'}}>{value}</Text>
 </Pressable>;
 function Savings({home=false}:{home?:boolean}={}){return panel(<><View style={styles.between}><Text style={{fontSize:16,fontWeight:'900',color:theme.text}}>▥  {t.savings}</Text><Pressable onPress={()=>setScreen('savings')}><Text style={{color:theme.accent,fontSize:12}}>{t.viewReport} ›</Text></Pressable></View>
  <View style={styles.savingsFour}>
   {savingTile(t.thisMonth,demo?money(demoSavings.thisMonth):'—','calendar-outline','#E2F9F6')}
   {savingTile(t.lastMonth,demo?money(demoSavings.lastMonth):'—','time-outline','#EAF6F8')}
   {savingTile(t.lifetime,demo?money(demoSavings.lifetime):'—','star-outline','#F0FBF8')}
   {savingTile(t.communityTotal,demo?money(demoSavings.community):'—','people-outline','#E8F7F6')}
  </View>{!home&&<Text style={{color:theme.muted,fontSize:10,marginTop:7}}>{demo?'Illustrative only · Verified savings after eligible completion.':t.notEarned}</Text>}
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
     <View style={{flexDirection:'row',alignItems:'center',gap:5,flexWrap:'wrap'}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="people" size={14} color="#149be7"/><Text style={{color:theme.text,fontSize:10,fontWeight:'800'}}>{offer.joined||0}/{offer.groupSize||5}</Text><Text style={{color:theme.muted,fontSize:9}}>joined</Text></View>
  <View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="time-outline" size={14} color="#6385b1"/><Text style={{color:theme.muted,fontSize:9}}>Ends in {offer.daysLeft} day{offer.daysLeft===1?'':'s'}</Text></View>
 </View>
     <View style={{height:5,backgroundColor:theme.field,borderRadius:5,overflow:'hidden'}}><View style={{height:5,width:(ratio+'%') as `${number}%`,backgroundColor:theme.highlight}}/></View>
     <View style={{flexDirection:'row',gap:5}}>{button(t.details,()=>selectOffer(offer),false,true)}{button(t.join,()=>selectOffer(offer),true,true)}</View>
    </View>
   </View>);
 }
 function ExclusiveCard({offer}:{offer:Offer}){
  const item=byId(offer.productId);if(!item)return null;
  return <View style={[styles.exclusiveCard,{backgroundColor:theme.card,borderColor:theme.line}]}>
   <View style={{flexDirection:'row',gap:6,flex:1}}>
    <Pressable onPress={()=>selectOffer(offer)} style={{width:'49%'}}><ProductPhoto item={item} height={128}/></Pressable>
    <View style={{flex:1,justifyContent:'space-around'}}>
     <Text numberOfLines={2} style={{fontSize:12,fontWeight:'800',color:theme.text}}>{lang==='bn'?item.nameBn:item.name}</Text>
     <Text style={{fontSize:10,color:theme.muted}}>{item.unit}</Text>
     <View style={{flexDirection:'row',alignItems:'center',gap:4,flexWrap:'wrap'}}><Text style={{fontSize:16,fontWeight:'900',color:theme.accent}}>{money(offer.price)}</Text><Text style={{fontSize:10,color:theme.muted,textDecorationLine:'line-through'}}>{money(item.referencePrice)}</Text></View>
     <View>{pill(t.save+' '+money(customerSaving(item.referencePrice,offer.price)),true)}</View>
     <Text numberOfLines={1} style={{fontSize:9,color:theme.muted}}>{t.stock} · {offer.stock||0} available</Text>
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
    <View style={styles.between}>{pill(pool.frequency==='weekly'?t.weekly:t.monthly,true)}<View style={{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:dark?'#184f3b':'#d9fbea',paddingVertical:3,paddingHorizontal:6,borderRadius:15}}><View style={{width:6,height:6,borderRadius:4,backgroundColor:'#0caf6a'}}/><Text style={{fontSize:9,fontWeight:'900',color:dark?'#bdfad9':'#087c4b'}}>ACTIVE</Text></View></View>
    <Text style={{fontSize:13,fontWeight:'900',color:theme.text}} numberOfLines={1}>{lang==='bn'?pool.nameBn:pool.name}</Text>
    <Text style={{fontSize:10,color:theme.muted}}>{pool.productIds.length} {t.products} · {pool.participants.toLocaleString('en-US')} {t.members}</Text>
    <View style={{height:5,borderRadius:6,backgroundColor:theme.field}}><View style={{height:5,width:(Math.min(100,100*pool.participants/pool.nextTier)+'%') as `${number}%`,backgroundColor:theme.highlight,borderRadius:5}}/></View>
    <View style={{flexDirection:'row',alignItems:'center',gap:5,flexWrap:'wrap'}}><Ionicons name="time-outline" size={12} color={theme.accent}/><Text style={{fontSize:9,fontWeight:'800',color:theme.accent}}>{lang==='bn'?'যোগদান শেষ':'Commit ends in'} {pool.commitDaysLeft||0} {lang==='bn'?'দিনে':'days'}</Text><Text style={{fontSize:9,color:theme.muted}}>· {pool.commitEndsLabel||'TBD'}</Text></View>
    <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text numberOfLines={1} style={{fontSize:9,color:theme.muted,flex:1}}>{t.next}: {pool.nextTier.toLocaleString('en-US')}</Text><Pressable onPress={()=>selectPool(pool)} style={{backgroundColor:theme.accent,borderRadius:8,paddingVertical:6,paddingHorizontal:8}}><Text style={{fontSize:9,fontWeight:'800',color:theme.onPrimary}}>Explore Pool →</Text></Pressable></View>
   </View>
  </Pressable>);
 }
 const Hero=()=><View style={[styles.hero,{backgroundColor:dark?palette.dark.hero:palette.light.hero}]}><NonperishableCart style={{position:'absolute',right:-4,top:3,width:'53%',height:'98%',opacity:.98}}/>
  <Text style={{color:brandV1.accentPale,fontWeight:'800',fontSize:9,letterSpacing:1.2}}>✦ SMART SHOPPING. REAL SAVINGS!</Text>
  <Text style={{fontSize:small?14:15,fontWeight:'900',color:'white',lineHeight:small?16:17,maxWidth:'55%',marginTop:5}}>{heroMessages[slide][lang][0]}</Text>
  <Text style={{fontSize:small?14:15,fontWeight:'900',color:brandV1.accentPale,lineHeight:small?16:17,maxWidth:'55%',marginTop:2}}>{heroMessages[slide][lang][1]}</Text>
  <Text style={{color:brandV1.white,fontSize:small?8.5:9,lineHeight:small?10:11,marginTop:5,maxWidth:'54%'}}>{heroMessages[slide][lang][2]}</Text>
  <View style={[styles.between,{marginTop:8}]}>
   <Pressable onPress={()=>onTab('deals')} style={{backgroundColor:'white',paddingVertical:7,paddingHorizontal:10,borderRadius:18}}><Text style={{color:brandV1.primary,fontWeight:'800',fontSize:9}}>Explore group deals →</Text></Pressable>
   <View style={{flexDirection:'row',gap:8}}><Pressable onPress={()=>setSlide(v=>(v+3)%4)}><Text style={styles.heroArrow}>‹</Text></Pressable><Pressable onPress={()=>setSlide(v=>(v+1)%4)}><Text style={styles.heroArrow}>›</Text></Pressable></View>
  </View>
  <View style={{alignSelf:'center',flexDirection:'row',gap:5,marginTop:5}}>{heroMessages.map((_,i)=><Pressable key={i} accessibilityLabel={'Slide '+(i+1)} onPress={()=>setSlide(i)} style={{height:5,width:i===slide?14:5,borderRadius:5,backgroundColor:i===slide?'white':brandV1.accent}}/>)}</View>
 </View>;
 function Home(){return <>
  <View style={[styles.between,{marginVertical:10}]}><Text style={{color:theme.text,fontSize:12,fontWeight:'700'}}>⌖ {t.community} · <Text style={{fontWeight:'500',color:theme.muted}}>Savar DOHS⌄</Text></Text>{demo?pill(t.demo,true):pill('PUBLIC CATALOG')}</View>
  <Hero/><View style={{marginTop:7}}><Savings home/></View>
  {title('',t.groups,()=>onTab('deals'))}{group.slice(0,2).map(o=><DealCard key={o.id} offer={o}/>)}
  {title('',t.exclusive,()=>onTab('exclusive'))}
  <View style={styles.twoCol}>{solo.slice(0,4).map(o=><ExclusiveCard key={o.id} offer={o}/>)}</View>
  {title('',t.pools,()=>onTab('pools'))}{pools.map(p=><PoolCard key={p.id} pool={p}/>)}
  <Footer/>
 </>}
 function Footer(){return <View style={{paddingVertical:16,marginTop:12,borderTopWidth:1,borderColor:theme.line}}>
  <Text style={{fontSize:13,fontWeight:'900',color:theme.text}}>2-TAKA-R-BAZAR</Text><Text style={{fontSize:11,color:theme.muted}}>Smart shopping. Real savings!</Text><Text style={{fontSize:11,color:theme.muted}}>একসাথে কিনি, কম দামে পাই!</Text>
  <View style={{flexDirection:'row',gap:12,marginTop:8}}>
    <View style={{flex:1}}><Text style={{color:theme.text,fontSize:10,fontWeight:'900'}}>Explore & get help</Text><Text style={{color:theme.muted,fontSize:9,marginTop:3}}>About 2TBR · FAQ · How it works · Pickup & delivery · Communities</Text></View>
    <View style={{flex:1}}><Text style={{color:theme.text,fontSize:10,fontWeight:'900'}}>Terms & policies</Text><Text style={{color:theme.muted,fontSize:9,marginTop:3}}>Privacy · Terms · Returns · Refunds</Text></View>
  </View>
  <Text style={{color:theme.text,fontSize:10,fontWeight:'900',marginTop:9}}>Contact us</Text>
  <View style={{flexDirection:'row',gap:12,marginTop:4}}>
    <View style={{flex:1,minWidth:0}}><Text style={{color:theme.muted,fontSize:9}}>Business & supplier enquiries</Text><Text style={{color:theme.accent,fontSize:9}} numberOfLines={2}>business@2takarbazar.com</Text><Text style={{color:theme.muted,fontSize:9}}>Become a supply partner →</Text></View>
    <View style={{flex:1,minWidth:0}}><Text style={{color:theme.muted,fontSize:9}}>Customer support</Text><Text style={{color:theme.accent,fontSize:9}} numberOfLines={2}>support@2takarbazar.com</Text></View>
  </View>
  <Text style={{fontSize:10,color:theme.muted,marginTop:8}}>© 2026 2-TAKA-R-BAZAR · Developed by agentsiraji.com</Text>
 </View>}

 type DemoTier={minimum:number;price:number};
 function demoGroupTierPrices(offer:Offer,product:Product):{list:DemoTier[];current:DemoTier;next:DemoTier|undefined}|null {
   if(!demo||offer.mode!=='GROUP_DEAL')return null;
   const list:DemoTier[]=offer.groupSize===10?[{minimum:1,price:1160},{minimum:5,price:1120},{minimum:10,price:offer.price}]
     :[{minimum:1,price:155},{minimum:5,price:offer.price}];
   const valid=list.filter(x=>x.price>0&&x.price<=product.referencePrice);
   const current=valid.filter(x=>x.minimum<=(offer.joined||0)).at(-1)||valid[0];
   return current?{list:valid,current,next:valid.find(x=>x.minimum>(offer.joined||0))}:null;
 }
 function GroupDealDetails({offer,product}:{offer:Offer;product:Product}){
   const tiers=demoGroupTierPrices(offer,product);
   const currentPrice=tiers?.current.price??offer.price;
   return <>
    <ProductPhoto item={product} height={small?330:360}/>
    <View style={[styles.between,{marginTop:9,marginBottom:8}]}>
     <Text style={{color:theme.accent,fontSize:11,fontWeight:'900'}}>GROUP DEAL</Text>
     <Pressable accessibilityRole="button" onPress={()=>setScreen('retail')} style={{paddingVertical:9,paddingHorizontal:10,borderRadius:10,borderWidth:1,borderColor:theme.accent,backgroundColor:theme.field}}>
       <Text style={{color:theme.accent,fontSize:12,fontWeight:'900'}}>Product Details →</Text>
     </Pressable>
    </View>
    <Text style={{fontSize:23,fontWeight:'900',color:theme.text}}>{lang==='bn'?product.nameBn:product.name}</Text>
    <Text style={{fontSize:11,color:theme.muted,marginVertical:4}}>{product.unit} · {offer.community} · SKU {product.id}</Text>
    {panel(<>
     <Text style={{color:theme.muted,fontSize:11,fontWeight:'700'}}>Current qualifying tier · Price not final</Text>
     <Text style={{color:theme.accent,fontSize:29,fontWeight:'900',marginTop:4}}>{money(currentPrice)}</Text>
     <Text style={{color:theme.muted,fontSize:11,marginTop:4}}>Market retail: {money(product.referencePrice)}</Text>
     {tiers&&<Text style={{color:theme.accent,fontSize:11,fontWeight:'800',marginTop:5}}>Potential saving: {money(customerSaving(product.referencePrice,currentPrice))}</Text>}
     {tiers?.next&&<Text style={{color:theme.muted,fontSize:11,marginTop:8}}>Next tier at {tiers.next.minimum} people: {money(tiers.next.price)} · {tiers.next.minimum-(offer.joined||0)} more needed</Text>}
    </>)}
    {tiers&&panel(<>
      <Text style={{color:theme.text,fontSize:13,fontWeight:'900',marginBottom:8}}>Group Deal price tiers</Text>
      <View style={{flexDirection:'row',gap:6}}>
      {tiers.list.map(tier=><View key={tier.minimum} style={{flex:1,minWidth:0,borderRadius:10,paddingVertical:9,paddingHorizontal:5,alignItems:'center',borderWidth:1,borderColor:tiers.current.minimum===tier.minimum?theme.accent:theme.line,backgroundColor:tiers.current.minimum===tier.minimum?theme.soft:theme.field}}>
       <Text style={{color:theme.muted,fontSize:10}}>{tier.minimum===1?'Starting':tier.minimum+' people'}</Text>
       <Text style={{color:theme.accent,fontWeight:'900',fontSize:15,marginTop:6}}>{money(tier.price)}</Text>
       <Text style={{color:theme.muted,fontSize:9,marginTop:4}}>{tiers.current.minimum===tier.minimum?'Current tier':tier.minimum>(offer.joined||0)?'Not yet unlocked':'Unlocked'}</Text>
      </View>)}
      </View>
      <Text style={{color:theme.muted,fontSize:10,marginTop:9}}>Demo price tiers only. Server-authoritative prices required before checkout.</Text>
    </>)}
    {panel(<>
      <Text style={{color:theme.text,fontWeight:'900',fontSize:13}}>Community progress</Text>
      <View style={[styles.between,{marginTop:9}]}>
       <Text style={{color:theme.text,fontSize:11,fontWeight:'800'}}>👥 {offer.joined||0}/{offer.groupSize||5} joined</Text>
       <Text style={{color:theme.muted,fontSize:10}}>◷ Ends in {offer.daysLeft||0} day(s)</Text>
      </View>
      <View style={{height:7,backgroundColor:theme.field,borderRadius:6,overflow:'hidden',marginVertical:9}}>
       <View style={{height:7,width:(Math.min(100,100*(offer.joined||0)/(offer.groupSize||5))+'%') as any,backgroundColor:theme.accent,borderRadius:6}}/>
      </View>
      <Text style={{color:theme.muted,fontSize:11}}>Qualified buyers and closing rules determine the final price. Below-minimum groups expire without payment.</Text>
    </>)}
    <View style={{flexDirection:'row',gap:8,marginBottom:10}}>{button('Product Details',()=>setScreen('retail'),false)}{button('Join Deal · Preview',notify)}</View>
    <Text style={{fontSize:10,color:theme.muted,marginBottom:8}}>{t.notice}</Text>
   </>;
 }
 function RetailDetails(){
   const offer=selectedOffer;if(!offer)return null;const product=byId(offer.productId);if(!product)return null;
   return <>
     <ProductPhoto item={product} height={small?330:360}/>
     {title('PRODUCT INFORMATION',lang==='bn'?product.nameBn:product.name)}
     <Text style={{color:theme.muted,fontSize:11,marginBottom:9}}>{product.unit} · SKU {product.id}</Text>
     {panel(<>
      <Text style={{color:theme.muted,fontWeight:'800',fontSize:12}}>Market retail reference price</Text>
      <Text style={{color:theme.accent,fontSize:29,fontWeight:'900',marginVertical:8}}>{money(product.referencePrice)}</Text>
      <Text style={{color:theme.muted,fontSize:11}}>Retail reference only. Group Deal and Pool tier prices are not displayed on the individual product page.</Text>
     </>)}
     {panel(<>
      <Text style={{color:theme.text,fontWeight:'900',fontSize:13,marginBottom:9}}>{lang==='bn'?'পণ্যের তথ্য':'Product information'}</Text>
      <Text style={{color:theme.text,fontSize:12}}>{lang==='bn'?'পণ্যের নাম':'Name'}: {lang==='bn'?product.nameBn:product.name}</Text>
      <Text style={{color:theme.text,fontSize:12,marginTop:5}}>{lang==='bn'?'পণ্যের ব্র্যান্ড':'Product brand'}: <Text style={{color:product.brand?theme.text:theme.muted}}>{productMissing(product.brand,lang)}</Text></Text>
      <Text style={{color:theme.text,fontSize:12,marginTop:5}}>{lang==='bn'?'প্যাকেটের পরিমাণ':'Package'}: {product.unit}</Text>
      <Text style={{color:theme.text,fontSize:12,marginTop:5}}>SKU: {product.id}</Text>
      <Text style={{color:theme.text,fontSize:12,marginTop:5}}>{lang==='bn'?'বিভাগ':'Category'}: {product.category}</Text>
     </>)}
     {productInfoSections.map(section=><View key={section.id} style={{borderRadius:12,borderWidth:1,borderColor:theme.line,backgroundColor:theme.card,marginBottom:8,overflow:'hidden'}}>
       <Pressable accessibilityRole="button" accessibilityLabel={lang==='bn'?section.titleBn:section.titleEn}
         accessibilityState={{expanded:!!productInfoOpen[section.id]}}
         onPress={()=>setProductInfoOpen(current=>({...current,[section.id]:!current[section.id]}))}
         style={{paddingVertical:12,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:7}}>
         <Text style={{fontSize:12,fontWeight:'900',color:theme.text,flex:1}}>{lang==='bn'?section.titleBn:section.titleEn}</Text>
         <Text style={{fontSize:10,color:theme.muted}}>{lang==='bn'?'অ্যাডমিন নিয়ন্ত্রিত':'Admin-managed'}</Text>
         <Ionicons name={productInfoOpen[section.id]?'remove':'add'} size={17} color={theme.accent}/>
       </Pressable>
       {!!productInfoOpen[section.id]&&<View style={{paddingHorizontal:12,paddingBottom:12,gap:8,borderTopWidth:1,borderColor:theme.line}}>
         <Text style={{fontSize:10,color:theme.muted,paddingTop:8}}>{lang==='bn'?'অ্যাডমিন যাচাইকৃত তথ্য দিলে এখানে দেখানো হবে।':'Verified product data will appear when Admin supplies it.'}</Text>
         {section.fields.map(field=>{
           const key=lang==='bn'&&field.keyBn?field.keyBn:field.keyEn;
           const value=product.content?.[key];
           return <View key={field.keyEn} style={{flexDirection:'row',gap:8}}>
             <Text style={{fontSize:11,color:theme.muted,width:108}}>{lang==='bn'?field.labelBn:field.labelEn}</Text>
             <Text style={{fontSize:11,color:theme.text,flex:1}}>{productMissing(value,lang)}</Text>
           </View>;
         })}
       </View>}
     </View>)}
     <View style={{flexDirection:'row',marginBottom:12}}>{button(offer.mode==='POOL'&&selectedPool?'Back to Pool':offer.mode==='GROUP_DEAL'?'Back to Group Deal':'Back to Offer',()=>setScreen(offer.mode==='POOL'&&selectedPool?'pool':offer.mode==='GROUP_DEAL'?'group':'product'))}</View>
   </>;
 }
 function OfferDetails(){const offer=selectedOffer;if(!offer)return null;const p=byId(offer.productId);if(!p)return null;
  if(offer.mode==='GROUP_DEAL')return <GroupDealDetails offer={offer} product={p}/>;
  const all=offers.filter(o=>o.productId===p.id);
  return <>{title('PRODUCT DETAILS',lang==='bn'?p.nameBn:p.name)}
    <ProductPhoto item={p} height={260}/>
    {panel(<><Text style={{color:theme.muted,marginBottom:8}}>{p.unit} · {offer.community}</Text>
      <View style={styles.between}><Text style={{color:theme.accent,fontSize:27,fontWeight:'900'}}>{money(offer.price)}</Text><Text style={{textDecorationLine:'line-through',color:theme.muted}}>{money(p.referencePrice)}</Text></View>
      <View style={{marginVertical:8,alignSelf:'flex-start'}}>{pill(t.save+' '+money(customerSaving(p.referencePrice,offer.price)),true)}</View>

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

 function PoolDetails(){
  const pool=selectedPool;if(!pool)return null;
  const label=(en:string,bn:string)=>lang==='bn'?bn:en;
  const n=(v:number)=>new Intl.NumberFormat(lang==='bn'?'bn-BD':'en-US',{maximumFractionDigits:0}).format(v);
  const cash=(v:number)=>'৳'+n(v);
  const unit=(v:string)=>lang==='bn'?v.replace(/\d+/g,d=>n(Number(d))):v;
  const endDate=()=>{
    const match=(pool.commitEndsLabel||'').match(/^(\d+)\s+([A-Za-z]+)$/);
    if(!match)return pool.commitEndsLabel||'TBD';
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const month=months.indexOf(match[2]);if(month<0)return pool.commitEndsLabel||'TBD';
    return new Intl.DateTimeFormat(lang==='bn'?'bn-BD':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(2026,month,Number(match[1]))));
  };
  const records=pool.productIds.map(id=>({product:byId(id),offer:offers.find(o=>o.mode==='POOL'&&o.poolId===pool.id&&o.productId===id)}));
  const quantities=poolQuantities[pool.id]||{};
  const selected=records.filter(r=>r.offer&&(quantities[r.offer.productId]||0)>0);
  const units=selected.reduce((v,r)=>v+(quantities[r.offer!.productId]||0),0);
  const retail=selected.reduce((v,r)=>v+(r.product?.referencePrice||0)*(quantities[r.offer!.productId]||0),0);
  const current=selected.reduce((v,r)=>v+(r.offer?.price||0)*(quantities[r.offer!.productId]||0),0);
  const next=selected.reduce((v,r)=>v+(r.offer?.nextTierPrice??r.offer?.price??0)*(quantities[r.offer!.productId]||0),0);
  const progress=Math.min(100,Math.round(100*pool.participants/pool.nextTier));
  const sumRow=(name:string,value:number,big=false)=><View style={[styles.between,{paddingVertical:6,borderBottomWidth:1,borderColor:theme.line}]}>
   <Text style={{fontSize:11,color:theme.muted,flex:1}}>{name}</Text><Text style={{fontSize:big?18:13,color:theme.accent,fontWeight:'900'}}>{cash(value)}</Text>
  </View>;
  return <>
   <View style={[styles.between,{marginTop:10,marginBottom:6,flexWrap:'wrap'}]}>
    {pill(pool.frequency==='weekly'?label('WEEKLY POOL','সাপ্তাহিক পুল'):label('MONTHLY POOL','মাসিক পুল'),true)}
    <View style={{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:dark?'#154F39':'#DDF8E9',paddingHorizontal:8,paddingVertical:5,borderRadius:14}}>
     <View style={{height:6,width:6,backgroundColor:'#11A865',borderRadius:4}}/><Text style={{fontSize:10,color:dark?'#A9F9CF':'#087B4F',fontWeight:'900'}}>ACTIVE</Text>
    </View>
    {demo&&pill('DEMO DATA')}
   </View>
   <Text style={{fontSize:22,color:theme.text,fontWeight:'900'}}>{lang==='bn'?pool.nameBn:pool.name}</Text>
   <Text style={{fontSize:11,color:theme.muted,marginBottom:10}}>{n(pool.productIds.length)} {t.products} · {n(pool.participants)} {t.members}</Text>
   {panel(<>
    <Text style={{fontSize:14,color:theme.text,fontWeight:'900',marginBottom:7}}>{label('Community savings progress','কমিউনিটির অগ্রগতি')}</Text>
    <View style={styles.between}><Text style={{fontSize:13,color:theme.accent,fontWeight:'900'}}>{n(pool.participants)} {label('households joined','পরিবার যুক্ত')}</Text><Text style={{fontSize:10,color:theme.muted}}>{n(pool.nextTier)} {label('next milestone','পরের ধাপ')}</Text></View>
    <View style={{height:7,backgroundColor:theme.field,borderRadius:6,marginVertical:9,overflow:'hidden'}}><View style={{height:7,width:(progress+'%') as any,backgroundColor:theme.highlight,borderRadius:6}}/></View>
    <Text style={{fontSize:10,color:theme.muted}}>{label('No cap on participation. Progress shows the next price milestone, not Pool capacity.','অংশগ্রহণ সীমাহীন। এটি পরের সাশ্রয় স্তর, সদস্যসীমা নয়।')}</Text>
    <View style={[styles.between,{paddingTop:9,marginTop:9,borderTopWidth:1,borderColor:theme.line}]}>
     <View style={{flexDirection:'row',gap:4,alignItems:'center'}}><Ionicons name="time-outline" color={theme.accent} size={14}/><Text style={{fontSize:10,color:theme.text,fontWeight:'800'}}>{label('Commitment ends','যোগদান শেষ')}: {endDate()}</Text></View>
     <Text style={{fontSize:10,fontWeight:'800',color:theme.accent}}>{n(pool.commitDaysLeft??0)} {label('days left','দিন বাকি')}</Text>
    </View>
   </>)}
   <View style={[styles.between,{marginBottom:8,marginTop:4}]}>
    <View style={{flex:1}}><Text style={{fontSize:18,fontWeight:'900',color:theme.text}}>{label('Choose your products','প্রয়োজনীয় পণ্য বেছে নিন')}</Text><Text style={{fontSize:10,color:theme.muted}}>{label('Pick only what you need · 1–20 products per Pool','যা প্রয়োজন শুধু তাই নিন · পুলে ১–২০টি পণ্য')}</Text></View>
    {pill(n(selected.length)+' '+label('selected','নির্বাচিত'),true)}
   </View>
   {records.map(({product,offer})=>{
    if(!product)return null;
    const q=offer?quantities[offer.productId]||0:0;
    return <View key={product.id} style={[styles.panel,{backgroundColor:theme.card,borderColor:q?theme.accent:theme.line,padding:9,flexDirection:'row',gap:8,alignItems:'stretch'}]}>
     <Pressable style={{width:small?88:102}} onPress={()=>{if(offer){setSelectedOffer(offer);setScreen('retail')}}}><ProductPhoto item={product} height={134}/></Pressable>
     <View style={{flex:1,minWidth:0,justifyContent:'space-between',gap:4}}>
      <View style={styles.between}><Text numberOfLines={2} style={{fontSize:13,fontWeight:'900',color:theme.text,flex:1}}>{lang==='bn'?product.nameBn:product.name}</Text><Text style={{fontSize:9,color:theme.muted}}>{unit(product.unit)}</Text></View>
      <View style={{flexDirection:'row',alignItems:'baseline',gap:5,flexWrap:'wrap'}}><Text style={{fontSize:18,fontWeight:'900',color:theme.accent}}>{offer?cash(offer.price):label('Pending','অপেক্ষমাণ')}</Text><Text style={{color:theme.muted,fontSize:10,textDecorationLine:'line-through'}}>{cash(product.referencePrice)}</Text></View>
      {offer?<Text style={{fontSize:11,color:theme.accent,fontWeight:'800'}}>{label('Potential saving','সম্ভাব্য সাশ্রয়')} {cash(customerSaving(product.referencePrice,offer.price))} / {unit(product.unit)}</Text>:<Text style={{fontSize:10,color:theme.muted}}>{label('Price pending','দাম নির্ধারণ বাকি')}</Text>}
      {offer?.nextTierPrice!==undefined&&<Text style={{fontSize:11,color:theme.muted}}>{label('Next tier','পরবর্তী স্তর')}: {cash(offer.nextTierPrice)} · {n(pool.nextTier)} {label('households','পরিবার')}</Text>}
      <View style={[styles.between,{gap:4,marginTop:4}]}>
       <Pressable accessibilityRole="button" onPress={()=>{if(offer){setSelectedOffer(offer);setScreen('retail')}}}><Text style={{fontSize:11,fontWeight:'900',color:theme.accent,textDecorationLine:'underline'}}>{label('Product Details','পণ্যের বিস্তারিত')} →</Text></Pressable>
       <View style={{flexDirection:'row',gap:5,alignItems:'center'}}>
        <Pressable accessibilityLabel={'Decrease '+product.name} disabled={!q} onPress={()=>changePoolQty(pool.id,product.id,-1)} style={{width:29,height:29,backgroundColor:theme.soft,borderRadius:8,alignItems:'center',justifyContent:'center',opacity:q?1:.3}}><Ionicons name="remove" color={theme.accent} size={17}/></Pressable>
        <Text style={{fontSize:12,fontWeight:'900',color:theme.text,minWidth:14,textAlign:'center'}}>{n(q)}</Text>
        <Pressable accessibilityLabel={'Increase '+product.name} disabled={!offer||q>=20} onPress={()=>changePoolQty(pool.id,product.id,1)} style={{width:29,height:29,backgroundColor:theme.soft,borderRadius:8,alignItems:'center',justifyContent:'center',opacity:!offer||q>=20?.3:1}}><Ionicons name="add" color={theme.accent} size={17}/></Pressable>
       </View>
      </View>
     </View>
    </View>;
   })}
   {panel(<><Text style={{fontSize:13,fontWeight:'900',color:theme.text,marginBottom:8}}>{label('How Pool prices unlock','পুলের দাম কীভাবে কমে')}</Text>
    <View style={{flexDirection:'row',gap:5}}>
     {[label('Starting','শুরু'),label('Current tier','বর্তমান'),label('Next unlock','পরবর্তী')].map((name,index)=><View key={index} style={{flex:1,minWidth:0,padding:7,borderRadius:10,borderWidth:1,borderColor:index===1?theme.accent:theme.line,backgroundColor:index===1?theme.soft:theme.field}}><Text style={{fontSize:9,color:theme.muted}}>{name}</Text><Text style={{fontSize:11,fontWeight:'900',color:theme.accent,marginTop:6}}>{index===0?label('Opening','শুরুর দাম'):index===1?n(pool.participants):n(pool.nextTier)}</Text></View>)}
    </View>
    <Text style={{fontSize:10,color:theme.muted,marginTop:9}}>{label('Each item has an independent tier price. Final prices require server qualification.','প্রতিটি পণ্যের আলাদা স্তরভিত্তিক দাম; নিশ্চিতকরণ জরুরি।')}</Text>
   </>)}
   {panel(<>
    <View style={styles.between}><Text style={{fontSize:14,fontWeight:'900',color:theme.text}}>{label('Your Pool basket','আপনার পুলের বাজার')}</Text><Text style={{fontSize:10,color:theme.muted}}>{n(selected.length)} {t.products} · {n(units)} {label('units','ইউনিট')}</Text></View>
    <View style={{marginTop:8}}>{sumRow(label('Market retail total','খুচরা বাজারমূল্য'),retail)}</View>
    {sumRow(label('Current estimated Pool total','বর্তমান পুলের আনুমানিক মূল্য'),current,true)}
    {sumRow(label('Potential savings','সম্ভাব্য সাশ্রয়'),Math.max(0,retail-current))}
    {sumRow(label('Total at next tier','পরবর্তী স্তরে মোট মূল্য'),next)}
    <Text style={{fontSize:10,color:theme.muted,marginTop:9}}>{label('Excludes delivery fees. No real stock, booking or payment occurs in demo.','ডেলিভারি চার্জ বাদে। ডেমোতে আসল স্টক, বুকিং বা পেমেন্ট হয় না।')}</Text>
   </>)}
   {panel(<>
    <Text style={{fontSize:12,color:theme.text,fontWeight:'900'}}>{label('Before you join','যোগদানের আগে জানুন')}</Text>
    <Text style={{fontSize:11,lineHeight:17,color:theme.muted,marginTop:7}}>{label('Select only what you need. The final price, availability, deadline and delivery rules must be confirmed.','শুধু প্রয়োজনীয় পণ্য নিন। মূল্য, স্টক, সময় ও ডেলিভারি নিশ্চিত করতে হবে।')}</Text>
    <Text style={{fontSize:11,lineHeight:17,color:theme.muted,marginTop:7}}>{label('No order, Pool commitment or payment is created from this preview.','ডেমোতে কোনো অর্ডার, পুলে যোগদান বা পেমেন্ট হয় না।')}</Text>
   </>)}
   <View style={{borderRadius:12,borderWidth:1,borderColor:theme.line,padding:10,marginBottom:8,backgroundColor:theme.card,flexDirection:'row',alignItems:'center',gap:9}}>
    <View><Text style={{fontSize:10,color:theme.muted}}>{n(units)} {label('units selected','টি ইউনিট নির্বাচিত')}</Text><Text style={{fontSize:18,fontWeight:'900',color:theme.accent}}>{cash(current)}</Text></View>
    <Pressable accessibilityRole="button" disabled={!units} onPress={notify} style={{flex:1,paddingVertical:11,paddingHorizontal:7,borderRadius:10,backgroundColor:theme.accent,opacity:units?1:.35,alignItems:'center'}}><Text style={{fontSize:11,color:theme.onPrimary,fontWeight:'900'}}>{label('Review Join Pool · Demo','পুলে যোগদান দেখুন · ডেমো')} →</Text></Pressable>
   </View>
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
 case 'retail':return <RetailDetails/>;
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
  <ScrollView key={screen} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:12,paddingTop:4,paddingBottom:screen==='pool'?110:30}}>
   {!tabs.some(([tab])=>tab===screen)&&<Pressable onPress={()=>screen==='retail'&&selectedOffer?setScreen(selectedOffer.mode==='POOL'&&selectedPool?'pool':selectedOffer.mode==='GROUP_DEAL'?'group':'product'):onTab('home')} style={{marginTop:8,flexDirection:'row',gap:5,alignItems:'center'}}><Ionicons name="chevron-back" size={16} color={theme.text}/><Text style={{color:theme.text}}>{t.back}</Text></Pressable>}
   {body()}
  </ScrollView>
  <View style={[styles.bottom,{backgroundColor:theme.card,borderColor:theme.line}]}>
   {tabs.map(([tab,icon])=>{const active=screen===tab;const label=tab==='exclusive'?t.shop:t[tab==='pools'?'pool':tab==='deals'?'deals':tab==='cart'?'cart':'home'];
    return <Pressable key={tab} accessibilityRole="tab" accessibilityState={{selected:active}} onPress={()=>onTab(tab)} style={{flex:1,alignItems:'center',gap:2,paddingVertical:6,backgroundColor:active?theme.soft:'transparent',borderRadius:12}}>
     <View><Ionicons name={icon} size={23} color={active?'#08717d':theme.text}/>{tab==='cart'&&cartLineCount(cart)>0&&<View style={styles.badge}><Text style={styles.badgeText}>{cartLineCount(cart)>99?'99+':cartLineCount(cart)}</Text></View>}</View>
     <Text style={{fontSize:small?9:10,fontWeight:active?'900':'600',color:active?theme.brandText:theme.text}}>{label}</Text>
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
 panel:{borderWidth:1,borderRadius:17,padding:10,marginBottom:9,shadowColor:brandV1.text,shadowOpacity:.04,shadowRadius:9,elevation:1},
 twoCol:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'space-between'},
 savingTile:{width:'23.9%',minHeight:72,paddingHorizontal:5,paddingVertical:6,borderRadius:12,alignItems:'flex-start',justifyContent:'center',gap:2,borderWidth:1},
 savingsFour:{flexDirection:'row',alignItems:'stretch',justifyContent:'space-between',gap:4},
 hero:{padding:12,borderRadius:17,marginBottom:1,minHeight:181,overflow:'hidden'},
 heroArrow:{fontSize:24,color:'white',fontWeight:'700'},
 exclusiveCard:{width:'48.6%',borderRadius:15,padding:7,borderWidth:1,marginBottom:2,minHeight:168},
 bottom:{flexDirection:'row',paddingTop:5,borderTopWidth:1,paddingHorizontal:7},
 priceOption:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:10,borderRadius:9,borderWidth:1,marginTop:5},
 menuRow:{borderWidth:1,padding:14,borderRadius:12,flexDirection:'row',alignItems:'center',gap:10,marginTop:6}
});
