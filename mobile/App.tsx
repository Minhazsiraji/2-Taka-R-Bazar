import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Alert,Image,Linking,Pressable,ScrollView,StyleSheet,View,useWindowDimensions} from 'react-native';
import {useFonts} from 'expo-font';
import {Inter_400Regular,Inter_500Medium,Inter_600SemiBold,Inter_700Bold} from '@expo-google-fonts/inter';
import {HindSiliguri_400Regular,HindSiliguri_500Medium,HindSiliguri_600SemiBold,HindSiliguri_700Bold} from '@expo-google-fonts/hind-siliguri';
import {Text,TextInput,TypographyProvider} from './src/typography';
import Ionicons from '@expo/vector-icons/Ionicons';
import {palette,brandV1} from './src/theme';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import {copy,heroMessages,type Language} from './src/content';
import {demoOrders,demoSavings,offers as demoOffers,pools as demoPools,products as demoProducts,type Offer,type Pool,type Product} from './src/data';
import {cartLineCount,cartQuantity,cartSubtotal,customerSaving} from './src/domain.mjs';
import {loadPublicCatalog} from './src/live';
import {productInfoSections,productMissing} from './src/product-content';
import {useNativeAuth} from './src/auth/use-native-auth';
import {NativeSignIn} from './src/auth/native-sign-in';

type Tab='home'|'pools'|'deals'|'exclusive'|'cart';
type Screen=Tab|'checkout'|'account'|'orders'|'orderDetail'|'savings'|'notifications'|'signIn'|'product'|'group'|'retail'|'pool'|'menu';
type PreviewNotice={id:number;enTitle:string;bnTitle:string;enBody:string;bnBody:string;read:boolean};
type IconName=React.ComponentProps<typeof Ionicons>['name'];
const SITE=(process.env.EXPO_PUBLIC_SITE_URL || 'https://2takarbazar.com').replace(/\/$/,'');
// Offline-bundled, owner-uploaded approved art; static require is necessary for Metro assets.
const approvedHeroImage=require('./assets/Vibrant Grocery Cart on Teal Background.png');
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
function Shop({fontsReady}:{fontsReady:boolean}){
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
 const [groupDrafts,setGroupDrafts]=useState<Record<string,number>>({});
 const [poolDrafts,setPoolDrafts]=useState<Record<string,Record<string,number>>>({});
 const [delivery,setDelivery]=useState<'home'|'pickup'>('home');
 const [payment,setPayment]=useState<'cod'|'online'>('cod');
 const [orderFilter,setOrderFilter]=useState<'all'|'active'|'completed'|'cancelled'>('all');
 const [selectedOrderId,setSelectedOrderId]=useState<string|null>(null);
 const [notices,setNotices]=useState<PreviewNotice[]>([]);
 const noticeSerial=useRef(0);
 const auth=useNativeAuth();
 const cartOwner=useRef<string|undefined>(undefined);
 const [demo,setDemo]=useState(requestedDemo);
 const [products,setProducts]=useState<Product[]>(demoProducts);
 const [offers,setOffers]=useState<Offer[]>(demoOffers);
 const [pools,setPools]=useState<Pool[]>(demoPools);
 const [busy,setBusy]=useState(false);
 const theme=dark?palette.dark:palette.light;
 useEffect(()=>{
  if(!auth.ready)return;
  const owner=auth.user?.id??'guest';
  if(cartOwner.current!==undefined&&cartOwner.current!==owner){
   setCart({});setGroupDrafts({});setPoolDrafts({});setPoolQuantities({});setNotices([]);
   setSelectedOffer(null);setSelectedPool(null);setScreen('account');
  }
  cartOwner.current=owner;
 },[auth.ready,auth.user?.id]);
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
 const pushDemoNotice=(enTitle:string,bnTitle:string,enBody:string,bnBody:string)=>{
  const id=++noticeSerial.current;
  setNotices(old=>[{id,enTitle,bnTitle,enBody,bnBody,read:false},...old].slice(0,20));
 };
 const add=(offer:Offer)=>{
  if(!demo){Alert.alert('Checkout not enabled','Live mobile purchasing requires separate qualification. Continue via the current website.');return}
  updateCart(offer.id,1);
  const product=byId(offer.productId);
  pushDemoNotice(
   (product?.name||'Product')+' added to demo cart',
   (product?.nameBn||'পণ্য')+' ডেমো কার্টে যোগ হয়েছে',
   'Your selection is saved in this local preview. No order or payment was created.',
   'পণ্যটি এই ডেমো কার্টে যোগ হয়েছে। কোনো অর্ডার বা পেমেন্ট হয়নি।'
  );
 };
 const openNotifications=()=>{
  setNotices(old=>old.map(item=>item.read?item:{...item,read:true}));
  setScreen('notifications');
 };
 const unreadNotices=notices.filter(item=>!item.read).length;
 const draftGroup=(o:Offer)=>{if(o.mode!=='GROUP_DEAL')return;setGroupDrafts(old=>({...old,[o.id]:(old[o.id]||0)+1}));setScreen('cart');};
 const draftPool=(pool:Pool,items:Record<string,number>)=>{const safe=Object.fromEntries(Object.entries(items).filter(([id,q])=>pool.productIds.includes(id)&&Number.isInteger(q)&&q>0&&q<=20));if(!Object.keys(safe).length)return;setPoolDrafts(old=>({...old,[pool.id]:safe}));setScreen('cart');};
 const demoNum=(n:number)=>new Intl.NumberFormat(lang==='bn'?'bn-BD':'en-US',{maximumFractionDigits:0}).format(n);
 const demoMoney=(n:number)=>'৳'+demoNum(n);
 const pendingLines=Object.values(groupDrafts).filter(q=>q>0).length+Object.values(poolDrafts).reduce((sum,item)=>sum+Object.values(item).filter(q=>q>0).length,0);
 const totalBadge=cartLineCount(cart)+pendingLines;
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
   <View style={{flexDirection:'row',alignItems:'center',gap:3,width:'100%',minWidth:0}}>
    <Ionicons name={icon} size={14} color={theme.accent}/>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{fontSize:small?8:9,lineHeight:14,color:theme.muted,flexShrink:1}}>{name}</Text>
   </View>
   <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{fontSize:small?11:12,fontWeight:'700',color:theme.text,width:'100%'}}>{value}</Text>
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
 const Hero=()=>{
  const longSlide=slide===0||slide===1;
  const titleSize=small?(longSlide?12.5:13.2):(longSlide?13.5:14.3);
  const titleMax=small?'62%':'60%';
  return <View style={[styles.hero,{backgroundColor:dark?palette.dark.hero:palette.light.hero}]}>
   <Image accessibilityIgnoresInvertColors source={approvedHeroImage} resizeMode="cover"
    style={{position:'absolute',top:0,right:0,bottom:0,left:0,width:'100%',height:'100%'}}/>
   <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
    style={{color:brandV1.accentPale,fontWeight:'600',fontSize:small?8:8.8,letterSpacing:small?.55:.85,marginBottom:4}}>
    ✦ SMART SHOPPING. REAL SAVINGS!
   </Text>
   <Text numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.85}
    style={{fontSize:titleSize,fontWeight:'700',color:brandV1.white,lineHeight:titleSize*1.07,maxWidth:titleMax}}>
    {heroMessages[slide][lang][0]}
   </Text>
   <Text numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.85}
    style={{fontSize:titleSize,fontWeight:'700',color:brandV1.accentPale,lineHeight:titleSize*1.07,maxWidth:titleMax,marginTop:1}}>
    {heroMessages[slide][lang][1]}
   </Text>
   <Text numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.8}
    style={{color:brandV1.white,fontSize:small?8.2:8.8,lineHeight:small?9.4:10.2,marginTop:4,maxWidth:small?'59%':'56%'}}>
    {heroMessages[slide][lang][2]}
   </Text>
   <Pressable accessibilityRole="button" accessibilityLabel="Explore group deals" onPress={()=>onTab('deals')}
    style={{position:'absolute',left:13,bottom:30,backgroundColor:brandV1.white,paddingVertical:7,paddingHorizontal:12,borderRadius:18}}>
    <Text style={{color:brandV1.primary,fontWeight:'600',fontSize:9}}>{lang==='bn'?'গ্রুপ ডিল দেখুন':'Explore group deals'} →</Text>
   </Pressable>
   <View style={{position:'absolute',left:13,bottom:7,flexDirection:'row',alignItems:'center',gap:6}}>
    <Pressable accessibilityRole="button" accessibilityLabel="Previous hero slide" onPress={()=>setSlide(v=>(v+3)%4)}>
     <Text style={styles.heroArrow}>‹</Text>
    </Pressable>
    {heroMessages.map((_,i)=><Pressable key={i} accessibilityRole="button" accessibilityLabel={'Slide '+(i+1)}
     accessibilityState={{selected:slide===i}} onPress={()=>setSlide(i)}
     style={{height:7,width:7,borderRadius:7,backgroundColor:i===slide?brandV1.white:brandV1.accent}}/>)}
    <Pressable accessibilityRole="button" accessibilityLabel="Next hero slide" onPress={()=>setSlide(v=>(v+1)%4)}>
     <Text style={styles.heroArrow}>›</Text>
    </Pressable>
   </View>
  </View>;
 }
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
    <View style={{flexDirection:'row',gap:8,marginBottom:10}}>{button('Product Details',()=>setScreen('retail'),false)}{button('Join Deal · Preview',()=>draftGroup(offer))}</View>
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
  const opening=selected.reduce((v,r)=>v+(r.offer?.openingPrice??r.offer?.price??0)*(quantities[r.offer!.productId]||0),0);
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
   {panel(<>
    <Text style={{fontSize:13,fontWeight:'900',color:theme.text,marginBottom:8}}>{label('How Pool prices unlock','পুলের দাম কীভাবে কমে')}</Text>
    <View style={{flexDirection:'row',gap:5}}>
      {[
        {name:label('Starting total','শুরুর মোট মূল্য'),value:opening},
        {name:label('Current Pool total','বর্তমান পুল মূল্য'),value:current},
        {name:label('Next-tier total','পরবর্তী স্তরের মূল্য'),value:next}
      ].map((tier,index)=><View key={index} style={{flex:1,minWidth:0,paddingVertical:9,paddingHorizontal:5,borderRadius:10,borderWidth:1,borderColor:index===1?theme.accent:theme.line,backgroundColor:index===1?theme.soft:theme.field}}>
        <Text style={{fontSize:10,lineHeight:14,color:theme.muted}}>{tier.name}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={{fontSize:14,fontWeight:'900',color:theme.accent,marginTop:6}}>{units?cash(tier.value):'—'}</Text>
      </View>)}
    </View>
    <Text style={{fontSize:11,lineHeight:16,color:theme.muted,marginTop:9}}>
      {units
        ?label('Illustrative totals for selected quantities. All final prices require qualification and confirmation.','নির্বাচিত পরিমাণের নমুনা মোট দাম। চূড়ান্ত মূল্য যাচাই ও নিশ্চিতকরণ সাপেক্ষ।')
        :label('Select one or more products above to compare starting, current and next-tier prices.','শুরুর, বর্তমান ও পরবর্তী স্তরের দাম তুলনা করতে ওপর থেকে এক বা একাধিক পণ্য বেছে নিন।')}
    </Text>
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
    <Pressable accessibilityRole="button" disabled={!units} onPress={()=>draftPool(pool,quantities)} style={{flex:1,paddingVertical:11,paddingHorizontal:7,borderRadius:10,backgroundColor:theme.accent,opacity:units?1:.35,alignItems:'center'}}><Text style={{fontSize:11,color:theme.onPrimary,fontWeight:'900'}}>{label('Review Join Pool · Demo','পুলে যোগদান দেখুন · ডেমো')} →</Text></Pressable>
   </View>
  </>;
 }

 function Cart(){
  const direct=Object.entries(cart).filter(([id,q])=>q>0&&offers.some(o=>o.id===id&&o.mode==='SOLO'));
  const groups=Object.entries(groupDrafts).filter(([id,q])=>q>0&&offers.some(o=>o.id===id&&o.mode==='GROUP_DEAL'));
  const drafts=Object.entries(poolDrafts).filter(([pid,lines])=>pools.some(p=>p.id===pid)&&Object.values(lines).some(q=>q>0));
  const subtotal=cartSubtotal(cart,offers);
  const text=(en:string,bn:string)=>lang==='bn'?bn:en;
  const header=(en:string,bn:string,count:number)=> <View style={[styles.between,{marginBottom:8}]}>
    <Text style={{color:theme.text,fontSize:14,fontWeight:'900',flex:1}}>{text(en,bn)}</Text>
    <Text style={{color:theme.muted,fontSize:10}}>{demoNum(count)}</Text>
  </View>;
  const empty=(en:string,bn:string,go:Tab,ctaEn:string,ctaBn:string)=> <View style={{backgroundColor:theme.field,borderRadius:9,padding:9,gap:6}}>
    <Text style={{color:theme.muted,fontSize:11}}>{text(en,bn)}</Text>
    <Pressable onPress={()=>onTab(go)}><Text style={{color:theme.accent,fontSize:11,fontWeight:'800'}}>{text(ctaEn,ctaBn)} →</Text></Pressable>
  </View>;
  return <>
   {title('',text('Your cart','আপনার কার্ট'))}
   <Text style={{color:theme.muted,fontSize:11,marginBottom:10}}>{text('Direct items and pending community-buy drafts, clearly separated.','সরাসরি পণ্য এবং কমিউনিটির অপেক্ষমাণ খসড়া আলাদা।')}</Text>
   {panel(<>
    {header('Direct / Exclusive · ready to order','সরাসরি / বিশেষ পণ্য · অর্ডারের জন্য',direct.length)}
    {direct.length?direct.map(([id,q])=>{
      const offer=offers.find(o=>o.id===id),p=offer&&byId(offer.productId);if(!offer||!p)return null;
      return <View key={id} style={{flexDirection:'row',gap:9,paddingVertical:9,borderTopWidth:1,borderColor:theme.line,alignItems:'center'}}>
       <View style={{width:72}}><ProductPhoto item={p} height={76}/></View>
       <View style={{flex:1,minWidth:0,gap:4}}>
        <Text style={{fontSize:12,fontWeight:'900',color:theme.text}}>{lang==='bn'?p.nameBn:p.name}</Text>
        <Text style={{fontSize:10,color:theme.muted}}>{p.unit} · {demoMoney(offer.price)} / unit</Text>
        <Text style={{fontSize:13,color:theme.accent,fontWeight:'900'}}>{demoMoney(offer.price*q)}</Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
         <Pressable onPress={()=>updateCart(id,-1)}><Ionicons name="remove-circle-outline" size={24} color={theme.accent}/></Pressable><Text style={{color:theme.text,fontWeight:'800'}}>{demoNum(q)}</Text><Pressable onPress={()=>updateCart(id,1)}><Ionicons name="add-circle-outline" size={24} color={theme.accent}/></Pressable>
         <Pressable onPress={()=>setCart(old=>{const next={...old};delete next[id];return next})}><Text style={{fontSize:10,color:theme.muted,textDecorationLine:'underline'}}>{text('Remove','বাদ দিন')}</Text></Pressable>
        </View>
       </View>
      </View>;
    }):empty('No direct products yet.','সরাসরি পণ্য যোগ হয়নি।','exclusive','Browse Exclusive','বিশেষ পণ্য দেখুন')}
   </>)}
   {panel(<>
    {header('Group Deal requests · Pending','গ্রুপ ডিলের অনুরোধ · অপেক্ষমাণ',groups.length)}
    {groups.length?groups.map(([id,q])=>{
      const o=offers.find(o=>o.id===id),p=o&&byId(o.productId);if(!o||!p)return null;
      const price=demoGroupTierPrices(o,p)?.current.price??o.price;
      return <View key={id} style={{flexDirection:'row',gap:9,paddingTop:8,borderTopWidth:1,borderColor:theme.line}}>
       <View style={{width:66}}><ProductPhoto item={p} height={69}/></View>
       <View style={{flex:1,gap:3}}>
        <Text style={{fontSize:12,fontWeight:'900',color:theme.text}}>{lang==='bn'?p.nameBn:p.name}</Text>
        <Text style={{fontSize:10,color:theme.muted}}>{demoNum(o.joined||0)}/{demoNum(o.groupSize||5)} {text('joined','যুক্ত')} · {demoNum(o.daysLeft||0)} {text('days left','দিন বাকি')}</Text>
        <Text style={{fontSize:12,fontWeight:'800',color:theme.accent}}>{demoMoney(price)} · {text('indicative only','শুধু আনুমানিক')}</Text>
        <Text style={{fontSize:10,color:theme.muted}}>{text('Not payable or confirmed','পরিশোধযোগ্য বা নিশ্চিত নয়')}</Text>
        <Pressable onPress={()=>setGroupDrafts(old=>{const v={...old};delete v[id];return v})}><Text style={{color:theme.accent,fontSize:10,textDecorationLine:'underline'}}>{text('Remove draft','খসড়া বাদ দিন')}</Text></Pressable>
       </View>
      </View>;
    }):empty('No Group Deal draft.','গ্রুপ ডিলের খসড়া নেই।','deals','Browse Deals','গ্রুপ ডিল দেখুন')}
   </>)}
   {panel(<>
    {header('Community Pool selections · pending','কমিউনিটি পুল নির্বাচন · অপেক্ষমাণ',drafts.length)}
    {drafts.length?drafts.map(([pid,lines])=>{
      const pool=pools.find(p=>p.id===pid);if(!pool)return null;
      const entries=Object.entries(lines).filter(([id,q])=>q>0&&pool.productIds.includes(id));
      const estimate=entries.reduce((sum,[id,q])=>sum+(offers.find(o=>o.mode==='POOL'&&o.poolId===pid&&o.productId===id)?.price||0)*q,0);
      return <View key={pid} style={{borderTopWidth:1,borderColor:theme.line,paddingVertical:9,gap:6}}>
       <Text style={{fontWeight:'900',fontSize:12,color:theme.text}}>{lang==='bn'?pool.nameBn:pool.name}</Text>
       {entries.map(([id,q])=>{const p=byId(id);return <View key={id} style={styles.between}><Text style={{color:theme.muted,fontSize:11,flex:1}}>{p?(lang==='bn'?p.nameBn:p.name):id} × {demoNum(q)}</Text></View>})}
       <Text style={{color:theme.accent,fontWeight:'900'}}>{text('Indicative total','আনুমানিক মোট')}: {demoMoney(estimate)}</Text>
       <Text style={{color:theme.muted,fontSize:10}}>{text('Not included in direct checkout','সরাসরি চেকআউটে অন্তর্ভুক্ত নয়')}</Text>
       <View style={{flexDirection:'row',gap:14}}>
         <Pressable onPress={()=>selectPool(pool)}><Text style={{fontSize:11,color:theme.accent,fontWeight:'800'}}>{text('Edit quantities','পরিমাণ বদলান')}</Text></Pressable>
         <Pressable onPress={()=>setPoolDrafts(old=>{const v={...old};delete v[pid];return v})}><Text style={{fontSize:11,color:theme.muted,textDecorationLine:'underline'}}>{text('Remove draft','খসড়া বাদ দিন')}</Text></Pressable>
       </View>
      </View>;
    }):empty('No Pool draft selected.','কোনো পুল খসড়া নেই।','pools','Browse Pools','পুল দেখুন')}
   </>)}
   {panel(<>
    {header('Cart summary','কার্টের সারসংক্ষেপ',direct.length)}
    <Text style={{color:theme.text,backgroundColor:theme.field,borderRadius:8,padding:8,fontSize:10,marginBottom:9}}>
     {text('Cart badge: ','কার্ট ব্যাজ: ')}{demoNum(direct.length)} {text('Direct','সরাসরি')} · {demoNum(groups.length)} {text('Group Deal','গ্রুপ ডিল')} · {demoNum(drafts.reduce((n,[,items])=>n+Object.values(items).filter(q=>q>0).length,0))} {text('Pool product lines','পুল পণ্যের লাইন')} = {demoNum(totalBadge)} {text('lines','লাইন')}
    </Text>
    <View style={styles.between}><Text style={{fontSize:11,color:theme.muted}}>{text('Direct subtotal','সরাসরি পণ্যের মূল্য')}</Text><Text style={{fontSize:19,fontWeight:'900',color:theme.accent}}>{demoMoney(subtotal)}</Text></View>
    <Text style={{fontSize:11,color:theme.muted,marginTop:9}}>{text('Delivery fee is determined after address confirmation.','ঠিকানা নিশ্চিতের পর ডেলিভারি চার্জ নির্ধারিত হবে।')}</Text>
    <Text style={{fontSize:10,color:theme.muted,marginTop:7}}>{text('Pending Group Deal and Pool totals are not payable or included in this amount.','গ্রুপ ডিল ও পুলের অপেক্ষমাণ মূল্য এই মোটে অন্তর্ভুক্ত নয়।')}</Text>
    <Pressable accessibilityRole="button" disabled={!direct.length} onPress={()=>setScreen('checkout')} style={{backgroundColor:theme.accent,opacity:direct.length?1:0.38,borderRadius:10,padding:12,marginTop:12,alignItems:'center'}}><Text style={{color:theme.onPrimary,fontSize:12,fontWeight:'900'}}>{text('Review direct checkout · Demo','সরাসরি চেকআউট · ডেমো')} →</Text></Pressable>
    {!direct.length&&<Text style={{fontSize:10,color:theme.muted,marginTop:7}}>{text('Add an Exclusive Product before checkout.','চেকআউটের আগে বিশেষ পণ্য যোগ করুন।')}</Text>}
   </>)}
   <Text style={{fontSize:10,color:theme.muted,marginBottom:12}}>{t.notice} {text('No stock is held and no transaction is created.','কোনো স্টক সংরক্ষণ বা লেনদেন হয় না।')}</Text>
  </>;
 }
 function Checkout(){
  const direct=Object.entries(cart).filter(([id,q])=>q>0&&offers.some(o=>o.id===id&&o.mode==='SOLO'));
  const text=(en:string,bn:string)=>lang==='bn'?bn:en;
  if(!direct.length)return <>{title('',text('Checkout preview','চেকআউট ডেমো'))}
    {panel(<><Text style={{color:theme.muted,fontSize:12,marginBottom:10}}>{text('Add an Exclusive Product to review checkout.','চেকআউট দেখতে আগে বিশেষ পণ্য যোগ করুন।')}</Text><View style={{flexDirection:'row'}}>{button(t.shop,()=>onTab('exclusive'))}</View></>)}
   </>;
  const subtotal=cartSubtotal(cart,offers);
  const section=(en:string,bn:string,children:React.ReactNode)=>panel(<><Text style={{fontSize:14,fontWeight:'900',color:theme.text,marginBottom:9}}>{text(en,bn)}</Text>{children}</>);
  const option=(name:string,active:boolean,fn:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{selected:active,disabled}} onPress={fn} style={{flex:1,borderRadius:10,borderWidth:1,borderColor:active?theme.accent:theme.line,padding:10,backgroundColor:active?theme.soft:theme.field,alignItems:'center',opacity:disabled?.4:1}}><Text style={{color:theme.text,fontSize:11,fontWeight:active?'900':'600'}}>{name}</Text></Pressable>;
  return <>{title('',text('Review checkout','চেকআউট পর্যালোচনা'))}
   <Text style={{fontSize:11,color:theme.accent,marginBottom:10}}>{text('1 · Items → 2 · Delivery → 3 · Review','১ · পণ্য → ২ · ডেলিভারি → ৩ · পর্যালোচনা')}</Text>
   {section('Direct items','সরাসরি পণ্য',<>{direct.map(([id,q])=>{const o=offers.find(o=>o.id===id),p=o&&byId(o.productId);return o&&p?<View key={id} style={[styles.between,{marginBottom:8}]}><Text style={{color:theme.text,fontSize:11,flex:1}}>{lang==='bn'?p.nameBn:p.name} × {demoNum(q)}</Text><Text style={{color:theme.accent,fontWeight:'800'}}>{demoMoney(o.price*q)}</Text></View>:null})}<View style={styles.between}><Text style={{color:theme.muted}}>{text('Product subtotal','পণ্যের মোট')}</Text><Text style={{fontWeight:'900',color:theme.text}}>{demoMoney(subtotal)}</Text></View></>)}
   {section('Delivery method','ডেলিভারির পদ্ধতি',<><View style={{flexDirection:'row',gap:8}}>{option(text('Home delivery','বাসায় ডেলিভারি'),delivery==='home',()=>setDelivery('home'))}{option(text('Pickup point','সংগ্রহের স্থান'),delivery==='pickup',()=>setDelivery('pickup'))}</View><Text style={{color:theme.muted,fontSize:11,marginTop:9}}>{delivery==='home'?text('Savar DOHS · SAMPLE address. Account, delivery coverage and fees require confirmation.','সাভার ডিওএইচএস · ডেমো ঠিকানা। ডেলিভারি ও চার্জ নিশ্চিত করা হবে।'):text('Pickup point and opening hours will be confirmed.','সংগ্রহের স্থান ও সময় নিশ্চিত করা হবে।')}</Text></>)}
   {section('Payment method','পেমেন্ট পদ্ধতি',<><View style={{flexDirection:'row',gap:8}}>{option(text('Cash on delivery','ক্যাশ অন ডেলিভারি'),payment==='cod',()=>setPayment('cod'))}{option(text('Online (future) · Unavailable','অনলাইন (পরে) · বন্ধ'),false,()=>{},true)}</View><Text style={{color:theme.muted,fontSize:11,marginTop:9}}>{text('No money is collected. COD eligibility and any advance delivery fee require confirmation.','এখানে পেমেন্ট হয় না। ক্যাশ অন ডেলিভারি ও আগাম ডেলিভারি চার্জ নিশ্চিত করা হবে।')}</Text></>)}
   {section('Estimated checkout summary','আনুমানিক চেকআউট',<><View style={styles.between}><Text style={{color:theme.muted}}>{text('Products','পণ্য')}</Text><Text style={{color:theme.text,fontWeight:'900'}}>{demoMoney(subtotal)}</Text></View><View style={[styles.between,{marginTop:8}]}><Text style={{color:theme.muted}}>{text('Delivery fee','ডেলিভারি চার্জ')}</Text><Text style={{color:theme.text}}>{text('Not yet quoted','নির্ধারিত নয়')}</Text></View><View style={[styles.between,{marginTop:8}]}><Text style={{color:theme.muted}}>{text('Amount payable','পরিশোধযোগ্য মূল্য')}</Text><Text style={{color:theme.accent,fontWeight:'900'}}>{text('Awaiting final quote','চূড়ান্ত দাম বাকি')}</Text></View><Text style={{color:theme.muted,fontSize:10,marginTop:12}}>{text('Group Deals and Pools are excluded until separately qualified. This checkout cannot place an order.','গ্রুপ ডিল ও পুল যোগ হবে না যতক্ষণ না আলাদাভাবে অনুমোদিত হয়। এখানে কোনো অর্ডার দেওয়া যায় না।')}</Text></>)}
   <View style={{flexDirection:'row'}}>{button(text('Check readiness · Demo only','প্রস্তুতি দেখুন · ডেমো'),notify)}</View>
  </>;
 }

 function Account(){
  const fmt=(v:number)=>new Intl.NumberFormat(lang==='bn'?'bn-BD':'en-US',{maximumFractionDigits:0}).format(v);
  const price=(v:number)=>'৳'+fmt(v);
  const text=(en:string,bn:string)=>lang==='bn'?bn:en;
  const active=demoOrders.filter(o=>o.status==='preparing'||o.status==='in_transit').length;
  const completed=demoOrders.filter(o=>o.status==='completed').length;
  const goOrder=(id:string)=>{setSelectedOrderId(id);setScreen('orderDetail')};
  const quick=(name:string,value:string,sub:string,target:Screen)=><Pressable onPress={()=>setScreen(target)} style={{width:'48.5%',minHeight:88,backgroundColor:theme.card,borderColor:theme.line,borderWidth:1,borderRadius:12,padding:11,justifyContent:'space-between'}}>
   <Text style={{fontSize:11,color:theme.muted}}>{name}</Text><Text style={{fontSize:19,fontWeight:'900',color:theme.accent}}>{value}</Text><Text style={{fontSize:10,color:theme.muted}}>{sub}</Text>
  </Pressable>;
  return <>
   {title('CUSTOMER ACCOUNT',t.account)}
   {panel(<View style={{flexDirection:'row',gap:12,alignItems:'center'}}>
    <View style={{width:44,height:44,borderRadius:22,backgroundColor:theme.soft,justifyContent:'center',alignItems:'center'}}><Ionicons name="person-outline" size={23} color={theme.accent}/></View>
    <View style={{flex:1}}>
     <Text style={{fontSize:14,fontWeight:'900',color:theme.text}}>{auth.user?text('Signed in · Verified account','লগইন · যাচাইকৃত অ্যাকাউন্ট'):text('Guest · Demo account','অতিথি · ডেমো অ্যাকাউন্ট')}</Text>
     <Text style={{fontSize:11,color:theme.muted,marginTop:3}}>{text('Sample community','নমুনা কমিউনিটি')}: Savar DOHS</Text>
     <Text style={{fontSize:10,color:theme.muted,marginTop:2}}>{auth.user?(auth.user.phone||auth.user.email||text('Verified identity','যাচাইকৃত পরিচয়')):text('Not signed in · No private records shown','লগইন নেই · ব্যক্তিগত রেকর্ড দেখানো হচ্ছে না')}</Text>
     {auth.user&&<Text style={{fontSize:10,color:theme.muted}}>{text('Orders and Savings remain DEMO','অর্ডার ও সাশ্রয় এখনো ডেমো')}</Text>}
    </View>
   </View>)}
   <View style={[styles.twoCol,{marginTop:3,marginBottom:11}]}>
    {quick(text('Orders · Demo','অর্ডার · ডেমো'),fmt(demoOrders.length),fmt(active)+' '+text('in progress','চলমান'),'orders')}
    {quick(text('Lifetime savings · Demo','সর্বমোট সাশ্রয় · ডেমো'),price(demoSavings.lifetime),text('Completed orders only','শুধু সম্পন্ন অর্ডার'),'savings')}
    {quick(text('Completed · Demo','সম্পন্ন · ডেমো'),fmt(completed),text('Illustrative status','নমুনা অবস্থা'),'orders')}
    {quick(text('Cart lines','কার্টের লাইন'),fmt(totalBadge),text('Local preview','স্থানীয় প্রিভিউ'),'cart')}
   </View>
   {panel(<>
    <View style={styles.between}><Text style={{fontSize:13,color:theme.text,fontWeight:'900'}}>{text('Recent orders','সাম্প্রতিক অর্ডার')}</Text><Pressable onPress={()=>setScreen('orders')}><Text style={{color:theme.accent,fontSize:11,fontWeight:'800'}}>{t.viewAll} →</Text></Pressable></View>
    {demoOrders.slice(0,2).map(o=><Pressable key={o.id} onPress={()=>goOrder(o.id)} style={[styles.between,{paddingVertical:11,borderTopWidth:1,borderColor:theme.line,marginTop:7}]}>
      <View><Text style={{fontSize:11,fontWeight:'800',color:theme.text}}>{o.id}</Text><Text style={{fontSize:10,color:theme.muted}}>{o.date} · DEMO</Text></View>
      <Text style={{fontSize:10,fontWeight:'800',color:theme.accent}}>{o.status==='completed'?text('Completed','সম্পন্ন'):text('Preparing','প্রস্তুত হচ্ছে')} ›</Text>
    </Pressable>)}
   </>)}
   {panel(<>
    <View style={styles.between}><Text style={{fontSize:13,color:theme.text,fontWeight:'900'}}>{text('My savings','আমার সাশ্রয়')}</Text><Pressable onPress={()=>setScreen('savings')}><Text style={{color:theme.accent,fontSize:11,fontWeight:'800'}}>{text('Full report','পূর্ণ রিপোর্ট')} →</Text></Pressable></View>
    <Text style={{color:theme.muted,fontSize:11,marginTop:9}}>{text('This month · demo','এই মাস · ডেমো')}: <Text style={{color:theme.accent,fontWeight:'900'}}>{price(demoSavings.thisMonth)}</Text></Text>
    <Text style={{color:theme.muted,fontSize:11,marginTop:6}}>{text('Community total · demo','কমিউনিটির মোট · ডেমো')}: <Text style={{color:theme.accent,fontWeight:'900'}}>{price(demoSavings.community)}</Text></Text>
   </>)}
   {panel(<>
    <Text style={{fontSize:13,fontWeight:'900',color:theme.text,marginBottom:8}}>{text('Account services','অ্যাকাউন্ট সেবা')}</Text>
    {[[t.orders,'receipt-outline','orders'],[t.savings,'stats-chart-outline','savings'],['Saved addresses · Soon','location-outline',''],['My Money · Soon','wallet-outline',''],['Notifications · Soon','notifications-outline',''],['Profile & settings · Soon','settings-outline','']].map(([name,icon,nav])=><Pressable key={name} onPress={()=>nav?setScreen(nav as Screen):notify()} style={{paddingVertical:11,flexDirection:'row',gap:8,borderTopWidth:1,borderColor:theme.line,alignItems:'center'}}>
     <Ionicons name={icon as IconName} color={theme.accent} size={19}/><Text style={{fontSize:11,flex:1,fontWeight:'700',color:theme.text}}>{name}</Text><Ionicons name="chevron-forward" color={theme.muted} size={15}/>
    </Pressable>)}
   </>)}
   {auth.user?<View style={{flexDirection:'row',marginBottom:9}}>{button(text('Sign out','লগআউট'),()=>Alert.alert(text('Sign out?','লগআউট করবেন?'),text('Account drafts are cleared on sign-out.','লগআউট করলে খসড়া মুছে যাবে।'),[{text:text('Cancel','বাতিল'),style:'cancel'},{text:text('Sign out','লগআউট'),onPress:()=>{void auth.signOut().catch(()=>Alert.alert('Sign out unavailable','Try again when connected.'))}}]),false)}</View>
    :auth.configured?<View style={{flexDirection:'row',marginBottom:9}}>{button(text('Sign in securely','নিরাপদে লগইন'),()=>setScreen('signIn'),false)}</View>
    :<View style={{flexDirection:'row',marginBottom:7}}>{button(lang==='bn'?'ওয়েবসাইটে নিরাপদে লগইন করুন':'Sign in on 2takarbazar.com',()=>Alert.alert(lang==='bn'?'ওয়েবসাইটে লগইন':'Website sign-in',lang==='bn'?'ওয়েবসাইটে লগইন করলে ডেমো অ্যাপে লগইন হবে না।':'Website sign-in does not authenticate this demo app.',[{text:lang==='bn'?'বাতিল':'Cancel',style:'cancel'},{text:lang==='bn'?'লগইন খুলুন':'Open sign-in',onPress:()=>link('/login?next=%2Faccount')}]),false)}</View>}
   <Text style={{color:theme.muted,fontSize:10,marginBottom:9}}>{auth.configured?text('Existing 2TBR account; sample Orders/Savings are still demo data.','বিদ্যমান 2TBR অ্যাকাউন্ট; অর্ডার ও সাশ্রয় এখনো ডেমো।'):text('Website supports Google or mobile-number/password login. Native sign-in requires a configured build.','ওয়েবসাইটে Google বা মোবাইল লগইন আছে। নেটিভ লগইনের জন্য কনফিগার করা বিল্ড প্রয়োজন।')}</Text>
   <Text style={{fontSize:10,color:theme.muted,marginBottom:15}}>{text('Demo profile and savings are not linked to real accounts or financial balances.','ডেমো অ্যাকাউন্ট ও সাশ্রয় আসল গ্রাহক বা ব্যালেন্সের সাথে যুক্ত নয়।')}</Text>
  </>;
 }
 function Orders(){
  const fmt=(v:number)=>new Intl.NumberFormat(lang==='bn'?'bn-BD':'en-US').format(v);
  const price=(v:number)=>'৳'+fmt(v);
  const text=(en:string,bn:string)=>lang==='bn'?bn:en;
  const status=(v:string)=>v==='completed'?text('Completed','সম্পন্ন'):v==='preparing'?text('Preparing','প্রস্তুত হচ্ছে'):v==='cancelled'?text('Cancelled','বাতিল'):text('In transit','পথে আছে');
  const records=demoOrders.filter(o=>orderFilter==='all'||orderFilter==='active'&&['preparing','in_transit'].includes(o.status)||orderFilter===o.status);
  return <>
   {title('ORDER HISTORY',t.orders)}
   <Text style={{fontSize:11,color:theme.muted,marginBottom:10}}>{text('Illustrative history; real order records need authenticated access.','এটি নমুনা ইতিহাস; আসল অর্ডারে লগইন প্রয়োজন।')}</Text>
   <View style={{flexDirection:'row',gap:5,marginBottom:10}}>
    {([['all','All','সব'],['active','In progress','চলমান'],['completed','Completed','সম্পন্ন'],['cancelled','Cancelled','বাতিল']] as const).map(([k,en,bn])=><Pressable key={k} onPress={()=>setOrderFilter(k)} style={{flex:1,borderRadius:18,borderWidth:1,borderColor:orderFilter===k?theme.accent:theme.line,backgroundColor:orderFilter===k?theme.soft:theme.card,paddingVertical:8,alignItems:'center'}}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{fontSize:10,fontWeight:'800',color:orderFilter===k?theme.accent:theme.text}}>{text(en,bn)}</Text>
    </Pressable>)}
   </View>
   {records.length?records.map(o=>panel(<>
     <View style={styles.between}><View><Text style={{fontWeight:'900',fontSize:12,color:theme.text}}>{o.id}</Text><Text style={{fontSize:10,color:theme.muted,marginTop:2}}>{o.date} · DEMO</Text></View>{pill(status(o.status),true)}</View>
     <View style={{flexDirection:'row',gap:5,marginTop:9,marginBottom:7}}>{o.items.slice(0,4).map(id=>{const p=byId(id);return p?<View key={id} style={{width:62}}><ProductPhoto item={p} height={58}/></View>:null})}</View>
     <View style={styles.between}><Text style={{color:theme.muted,fontSize:11}}>{text('Order total','অর্ডারের মোট')}</Text><Text style={{color:theme.accent,fontWeight:'900'}}>{price(o.value)}</Text></View>
     <View style={[styles.between,{marginTop:7}]}><Text style={{color:theme.muted,fontSize:11}}>{text('Earned savings','অর্জিত সাশ্রয়')}</Text><Text style={{color:theme.accent,fontWeight:'900'}}>{price(o.status==='completed'?o.saving:0)}</Text></View>
     <Pressable onPress={()=>{setSelectedOrderId(o.id);setScreen('orderDetail')}} style={{marginTop:11,backgroundColor:theme.accent,borderRadius:10,padding:10,alignItems:'center'}}><Text style={{color:theme.onPrimary,fontWeight:'900',fontSize:11}}>{text('View tracking & details','ট্র্যাকিং ও বিস্তারিত')} →</Text></Pressable>
   </>)) : panel(<Text style={{color:theme.muted}}>{text('No demo orders for this status.','এই অবস্থায় নমুনা অর্ডার নেই।')}</Text>)}
   <Text style={{fontSize:10,color:theme.muted,marginBottom:15}}>{text('No real order, invoice, refund or delivery tracking is accessed here.','এখানে আসল অর্ডার, চালান, রিফান্ড বা ডেলিভারি ট্র্যাকিং নেই।')}</Text>
  </>;
 }
 function OrderDetail(){
  const o=demoOrders.find(x=>x.id===selectedOrderId);
  const text=(en:string,bn:string)=>lang==='bn'?bn:en;
  const fmt=(v:number)=>new Intl.NumberFormat(lang==='bn'?'bn-BD':'en-US').format(v);
  if(!o)return <View>{button(t.orders,()=>setScreen('orders'))}</View>;
  const stages=[['Order placed','অর্ডার দেওয়া হয়েছে'],['Confirmed','নিশ্চিত হয়েছে'],['Preparing','প্রস্তুত হচ্ছে'],['Out for delivery','ডেলিভারির পথে'],['Completed','সম্পন্ন']] as const;
  const completedSteps=o.status==='completed'?5:o.status==='preparing'?3:o.status==='in_transit'?4:1;
  return <>
   {title('DEMO ORDER TRACKING',o.id)}
   <Text style={{color:theme.muted,fontSize:11,marginBottom:11}}>{o.date} · {text('Sample order, not live tracking','নমুনা অর্ডার, আসল ট্র্যাকিং নয়')}</Text>
   {panel(<><View style={styles.between}><Text style={{fontSize:13,fontWeight:'900',color:theme.text}}>{text('Order timeline','অর্ডারের অগ্রগতি')}</Text>{pill(o.status==='completed'?text('Completed','সম্পন্ন'):o.status==='cancelled'?text('Cancelled','বাতিল'):text('In progress','চলমান'),true)}</View>
    {o.status==='cancelled'?<Text style={{color:theme.muted,marginTop:10,fontSize:11}}>{text('Cancelled example: no savings earned.','বাতিল নমুনায় কোনো সাশ্রয় অর্জিত হয়নি।')}</Text>:stages.map(([en,bn],i)=><View key={en} style={{flexDirection:'row',alignItems:'center',gap:9,paddingTop:13}}>
       <Ionicons name={i<completedSteps?'checkmark-circle':'ellipse-outline'} size={18} color={i<completedSteps?theme.accent:theme.muted}/>
       <View style={{flex:1}}><Text style={{color:theme.text,fontWeight:'800',fontSize:11}}>{text(en,bn)}</Text><Text style={{fontSize:9,color:theme.muted,marginTop:2}}>{i<completedSteps?text('Demo stage','ডেমো ধাপ'):text('Not completed','এখনো হয়নি')}</Text></View>
      </View>)}
   </>)}
   {panel(<>
    <Text style={{fontSize:13,fontWeight:'900',color:theme.text,marginBottom:9}}>{text('Products','পণ্য')}</Text>
    {o.items.map(id=>{const p=byId(id);return p?<View key={id} style={{flexDirection:'row',gap:9,marginVertical:7,alignItems:'center'}}>
      <View style={{width:63}}><ProductPhoto item={p} height={61}/></View><View style={{flex:1}}><Text style={{fontSize:12,color:theme.text,fontWeight:'800'}}>{lang==='bn'?p.nameBn:p.name}</Text><Text style={{fontSize:10,color:theme.muted}}>{p.unit} · × {fmt(o.units[id]||1)}</Text></View>
     </View>:null})}
    <View style={[styles.between,{borderTopWidth:1,borderColor:theme.line,paddingTop:9}]}><Text style={{fontSize:11,color:theme.muted}}>{text('Illustrative order total','নমুনা অর্ডারের মোট')}</Text><Text style={{fontWeight:'900',color:theme.accent}}>৳{fmt(o.value)}</Text></View>
    <View style={[styles.between,{marginTop:8}]}><Text style={{fontSize:11,color:theme.muted}}>{text('Eligible completed-order saving','সম্পন্ন অর্ডারের সাশ্রয়')}</Text><Text style={{fontWeight:'900',color:theme.accent}}>৳{fmt(o.status==='completed'?o.saving:0)}</Text></View>
   </>)}
   {panel(<>
    <Text style={{fontSize:13,fontWeight:'900',color:theme.text}}>{text('Delivery & support','ডেলিভারি ও সহায়তা')}</Text>
    <Text style={{color:theme.muted,fontSize:11,marginTop:8}}>{text('SAMPLE address: Savar DOHS. Real order address, payment, support and proof of delivery require authentication.','ডেমো ঠিকানা: সাভার ডিওএইচএস। আসল ঠিকানা, পেমেন্ট ও ডেলিভারি প্রমাণ দেখতে লগইন প্রয়োজন।')}</Text>
   </>)}
   <View style={{flexDirection:'row'}}>{button(text('Back to Orders','অর্ডারসমূহে ফিরুন'),()=>setScreen('orders'))}</View>
  </>;
 }
 function SavingsReport(){
  const text=(en:string,bn:string)=>lang==='bn'?bn:en;
  const fmt=(v:number)=>new Intl.NumberFormat(lang==='bn'?'bn-BD':'en-US').format(v);
  const price=(v:number)=>'৳'+fmt(v);
  const completed=demoOrders.filter(o=>o.status==='completed');
  const current=completed.filter(o=>o.date.startsWith('2026-10')).reduce((n,o)=>n+o.saving,0);
  const previous=completed.filter(o=>o.date.startsWith('2026-09')).reduce((n,o)=>n+o.saving,0);
  const lifetime=completed.reduce((n,o)=>n+o.saving,0);
  const tile=(name:string,value:number)=><View style={{width:'48.5%',borderRadius:12,borderWidth:1,borderColor:theme.line,backgroundColor:theme.card,padding:11}}><Text style={{fontSize:11,color:theme.muted}}>{name}</Text><Text style={{fontSize:19,fontWeight:'900',color:theme.accent,marginTop:5}}>{price(value)}</Text></View>;
  return <>
   {title('PERSONAL SAVINGS · DEMO',text('Savings report','সাশ্রয়ের রিপোর্ট'))}
   <View style={[styles.twoCol,{marginBottom:11}]}>{tile(t.thisMonth,current)}{tile(t.lastMonth,previous)}{tile(t.lifetime,lifetime)}{tile(t.communityTotal,demoSavings.community)}</View>
   {panel(<>
    <Text style={{fontWeight:'900',fontSize:13,color:theme.text,marginBottom:10}}>{text('Where savings come from','সাশ্রয় কোথা থেকে আসে')}</Text>
    <View style={styles.between}><Text style={{color:theme.muted,fontSize:11}}>{text('Completed example orders','সম্পন্ন নমুনা অর্ডার')}</Text><Text style={{color:theme.accent,fontWeight:'900'}}>{fmt(completed.length)}</Text></View>
    <View style={[styles.between,{marginTop:9}]}><Text style={{color:theme.muted,fontSize:11}}>{text('Earned this month · demo','এই মাসের অর্জিত · ডেমো')}</Text><Text style={{color:theme.accent,fontWeight:'900'}}>{price(current)}</Text></View>
    <View style={[styles.between,{marginTop:9}]}><Text style={{color:theme.muted,fontSize:11}}>{text('Pending/cancelled order savings','অপেক্ষমাণ/বাতিলের সাশ্রয়')}</Text><Text style={{color:theme.accent,fontWeight:'900'}}>{price(0)}</Text></View>
   </>)}
   {panel(<>
    <Text style={{color:theme.text,fontSize:13,fontWeight:'900',marginBottom:9}}>{text('Completed order savings · examples','সম্পন্ন অর্ডারের সাশ্রয় · নমুনা')}</Text>
    {completed.map(o=><Pressable key={o.id} onPress={()=>{setSelectedOrderId(o.id);setScreen('orderDetail')}} style={[styles.between,{paddingVertical:10,borderTopWidth:1,borderColor:theme.line}]}>
     <View><Text style={{fontSize:11,color:theme.text,fontWeight:'800'}}>{o.id}</Text><Text style={{fontSize:10,color:theme.muted}}>{o.date}</Text></View><Text style={{fontSize:11,color:theme.accent,fontWeight:'900'}}>{price(o.saving)} ›</Text>
    </Pressable>)}
   </>)}
   {panel(<>
    <Text style={{color:theme.text,fontWeight:'900',fontSize:13}}>{text('How verified savings work','যাচাইকৃত সাশ্রয় কীভাবে গণনা হয়')}</Text>
    <Text style={{color:theme.muted,fontSize:11,marginTop:9,lineHeight:17}}>{text('For completed eligible units: (verified retail reference − final selling price) × fulfilled quantity, net of returns and refunds. Pending Group/Pool commitments do not earn savings. This is not a withdrawable balance.','সম্পন্ন যোগ্য পণ্যের ক্ষেত্রে (যাচাইকৃত বাজারদর − চূড়ান্ত বিক্রয়মূল্য) × সরবরাহকৃত পরিমাণ, ফেরত ও রিফান্ড বাদ দিয়ে। অপেক্ষমাণ পুল বা গ্রুপ ডিলে সাশ্রয় হয় না। এটি উত্তোলনযোগ্য নয়।')}</Text>
   </>)}
   <Text style={{color:theme.muted,fontSize:10,marginBottom:16}}>{text('Every amount on this screen is illustrative. Community savings is a separate demo aggregate.','এখানকার সব সংখ্যাই নমুনা। কমিউনিটির সাশ্রয়ও আলাদা ডেমো হিসাব।')}</Text>
  </>;
 }
 function Notifications(){return <>
  {title('DEMO NOTIFICATIONS',lang==='bn'?'নোটিফিকেশন':'Notifications')}
  {panel(<>
   <View style={[styles.between,{marginBottom:10}]}>
    <Text style={{fontSize:12,color:theme.text,fontWeight:'700'}}>
     {lang==='bn'?'শুধু এই অ্যাপের ডেমো আপডেট':'Local demo activity'}
    </Text>
    {!!notices.length&&<Pressable accessibilityRole="button" accessibilityLabel="Clear notifications" onPress={()=>setNotices([])}>
      <Text style={{color:theme.accent,fontWeight:'600',fontSize:11}}>{lang==='bn'?'সব মুছুন':'Clear all'}</Text>
    </Pressable>}
   </View>
   {notices.length?notices.map((notice,i)=><View key={notice.id} style={{paddingVertical:12,borderTopWidth:i?1:0,borderColor:theme.line}}>
      <View style={{flexDirection:'row',gap:9,alignItems:'flex-start'}}>
       <Ionicons name="cart-outline" size={19} color={theme.accent}/>
       <View style={{flex:1,gap:5}}>
        <Text style={{fontSize:12,color:theme.text,fontWeight:'700'}}>{lang==='bn'?notice.bnTitle:notice.enTitle}</Text>
        <Text style={{fontSize:11,color:theme.muted,lineHeight:16}}>{lang==='bn'?notice.bnBody:notice.enBody}</Text>
       </View>
      </View>
      <Pressable accessibilityRole="button" onPress={()=>onTab('cart')} style={{alignSelf:'flex-end',marginTop:7}}>
       <Text style={{fontSize:11,color:theme.accent,fontWeight:'600'}}>{lang==='bn'?'কার্ট দেখুন →':'View cart →'}</Text>
      </Pressable>
     </View>):<View style={{paddingVertical:14,alignItems:'center',gap:7}}>
      <Ionicons name="notifications-outline" size={29} color={theme.accent}/>
      <Text style={{color:theme.text,fontWeight:'600',fontSize:12}}>{lang==='bn'?'কোনো নতুন আপডেট নেই':'No notifications yet'}</Text>
      <Text style={{color:theme.muted,textAlign:'center',fontSize:11,lineHeight:16}}>
       {lang==='bn'?'বিশেষ পণ্য ডেমো কার্টে যোগ করলে এখানে আপডেট দেখাবে।':'Add an Exclusive Product to your demo cart to see a local update here.'}
      </Text>
     </View>}
  </>)}
  <Text style={{color:theme.muted,fontSize:11,marginBottom:15,lineHeight:17}}>
   {lang==='bn'?'এটি শুধু ডেমো। আসল গ্রাহক, অর্ডার ও ডেলিভারি নোটিফিকেশন এখনো সংযুক্ত নয়।':'Preview only. Real customer, order and delivery notifications are not connected.'}
  </Text>
 </>}
 function Menu(){return <>{title('EXPLORE', '2TBR Menu')}{[['My Orders','orders'],['Savings','savings'],['My Account','account'],['Community Pools','pools'],['Group Deals','deals']].map(([text,destination])=><Pressable key={text} onPress={()=>setScreen(destination as Screen)} style={[styles.menuRow,{backgroundColor:theme.card,borderColor:theme.line}]}><Text style={{color:theme.text}}>{text}</Text></Pressable>)}<Footer/></>}
 function body(){
 switch(screen){
 case 'home':return <Home/>;
 case 'deals':return <>{title('GROUP SHOPPING',t.groups)}{group.map(o=><DealCard key={o.id} offer={o}/>)}</>;
 case 'exclusive':return <>{title('CURATED FOR YOU',t.exclusive)}<View style={styles.twoCol}>{solo.map(o=><ExclusiveCard key={o.id} offer={o}/>)}</View></>;
 case 'pools':return <>{title('BUY TOGETHER',t.pools)}{pools.map(p=><PoolCard key={p.id} pool={p}/>)}</>;
 case 'cart':return <Cart/>;
 case 'checkout':return <Checkout/>;
 case 'account':return <Account/>;
 case 'signIn':return <NativeSignIn auth={auth} lang={lang} theme={theme} onSuccess={()=>setScreen('account')}/>;
 case 'orders':return <Orders/>;
 case 'orderDetail':return <OrderDetail/>;
 case 'savings':return <SavingsReport/>;
 case 'notifications':return <Notifications/>;
 case 'group':case 'product':return <OfferDetails/>;
 case 'retail':return <RetailDetails/>;
 case 'pool':return <PoolDetails/>;
 case 'menu':return <Menu/>;
 }}
 const tabs:[Tab,IconName][]=[['home','home-outline'],['pools','people-outline'],['deals','pricetag-outline'],['exclusive','basket-outline'],['cart','cart-outline']];
 return <TypographyProvider language={lang} loaded={fontsReady}><SafeAreaView style={{flex:1,backgroundColor:theme.background}} edges={['top','bottom']}>
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
    {headerAction('notifications-outline',openNotifications,unreadNotices)}
    {headerAction('person-outline',()=>setScreen('account'))}
    {headerAction('menu-outline',()=>setScreen('menu'))}
   </View>
   <View style={[styles.search,{backgroundColor:theme.field,borderColor:theme.line}]}><Ionicons name="search-outline" size={17} color={theme.accent}/>
    <TextInput accessibilityLabel={t.search} placeholder={t.search} placeholderTextColor={theme.muted} value={query} onChangeText={setQuery} style={{flex:1,fontSize:12,color:theme.text,paddingVertical:5}} returnKeyType="search"/>
   </View>
  </View>
  {busy&&<Text style={{textAlign:'center',color:theme.accent,fontSize:11}}>Loading public product catalog…</Text>}
  <ScrollView key={screen} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:12,paddingTop:4,paddingBottom:screen==='pool'?110:30}}>
   {!tabs.some(([tab])=>tab===screen)&&<Pressable onPress={()=>screen==='orderDetail'?setScreen('orders'):screen==='checkout'?setScreen('cart'):screen==='orders'||screen==='savings'||screen==='signIn'?setScreen('account'):screen==='notifications'?onTab('home'):screen==='retail'&&selectedOffer?setScreen(selectedOffer.mode==='POOL'&&selectedPool?'pool':selectedOffer.mode==='GROUP_DEAL'?'group':'product'):onTab('home')} style={{marginTop:8,flexDirection:'row',gap:5,alignItems:'center'}}><Ionicons name="chevron-back" size={16} color={theme.text}/><Text style={{color:theme.text}}>{t.back}</Text></Pressable>}
   {body()}
  </ScrollView>
  <View style={[styles.bottom,{backgroundColor:theme.card,borderColor:theme.line}]}>
   {tabs.map(([tab,icon])=>{const active=screen===tab;const label=tab==='exclusive'?t.shop:t[tab==='pools'?'pool':tab==='deals'?'deals':tab==='cart'?'cart':'home'];
    return <Pressable key={tab} accessibilityRole="tab" accessibilityState={{selected:active}} onPress={()=>onTab(tab)} style={{flex:1,alignItems:'center',gap:2,paddingVertical:6,backgroundColor:active?theme.soft:'transparent',borderRadius:12}}>
     <View><Ionicons name={icon} size={23} color={active?'#08717d':theme.text}/>{tab==='cart'&&totalBadge>0&&<View style={styles.badge}><Text style={styles.badgeText}>{totalBadge>99?'99+':demoNum(totalBadge)}</Text></View>}</View>
     <Text style={{fontSize:small?9:10,fontWeight:active?'900':'600',color:active?theme.brandText:theme.text}}>{label}</Text>
    </Pressable>
   })}
  </View>
 </SafeAreaView></TypographyProvider>;
}
export default function App(){
 const [loaded,error]=useFonts({
  Inter_400Regular,Inter_500Medium,Inter_600SemiBold,Inter_700Bold,
  HindSiliguri_400Regular,HindSiliguri_500Medium,HindSiliguri_600SemiBold,HindSiliguri_700Bold
 });
 if(!loaded&&!error)return null;
 return <SafeAreaProvider><Shop fontsReady={loaded}/></SafeAreaProvider>;
}
const styles=StyleSheet.create({
 between:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6},
 headerIcon:{width:31,height:32,borderRadius:20,borderWidth:1,justifyContent:'center',alignItems:'center',position:'relative'},
 badge:{position:'absolute',right:-8,top:-8,minWidth:17,height:17,borderRadius:10,backgroundColor:'#ed3035',paddingHorizontal:3,justifyContent:'center',alignItems:'center'},
 badgeText:{color:'white',fontSize:9,fontWeight:'900'},
 search:{marginTop:8,borderRadius:30,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:7,borderWidth:1},
 titleRow:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginTop:16,marginBottom:8},
 panel:{borderWidth:1,borderRadius:17,padding:10,marginBottom:9,shadowColor:brandV1.text,shadowOpacity:.04,shadowRadius:9,elevation:1},
 twoCol:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'space-between'},
 savingTile:{width:'23.9%',minHeight:54,paddingHorizontal:5,paddingVertical:5,borderRadius:12,alignItems:'stretch',justifyContent:'center',gap:3,borderWidth:1},
 savingsFour:{flexDirection:'row',alignItems:'stretch',justifyContent:'space-between',gap:4},
 hero:{height:174,minHeight:174,maxHeight:174,paddingHorizontal:13,paddingTop:10,paddingBottom:28,borderRadius:17,marginBottom:1,overflow:'hidden',position:'relative'},
 heroArrow:{fontSize:24,color:'white',fontWeight:'700'},
 exclusiveCard:{width:'48.6%',borderRadius:15,padding:7,borderWidth:1,marginBottom:2,minHeight:168},
 bottom:{flexDirection:'row',paddingTop:5,borderTopWidth:1,paddingHorizontal:7},
 priceOption:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:10,borderRadius:9,borderWidth:1,marginTop:5},
 menuRow:{borderWidth:1,padding:14,borderRadius:12,flexDirection:'row',alignItems:'center',gap:10,marginTop:6}
});
