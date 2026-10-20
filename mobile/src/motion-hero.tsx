import React,{useRef,useState} from 'react';
import {Animated,ImageBackground,Pressable,StyleSheet,View,type StyleProp,type ViewStyle} from 'react-native';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {Text} from './typography';
import {HeroVideo} from './hero-video';
import {brandV1,gloss,palette} from './theme';
import {heroMessages,type Language} from './content';

const approvedHeroImage=require('../assets/2tbr-hero-panorama-v2.jpg');
// Fade only at the video boundary; the playback clock also freezes on pause/buffering.
export function heroTextOpacity(time:number,duration:number){
 if(duration<=0)return 1;
 return Math.max(0,Math.min(1,time/.24,(duration-time)/.3));
}
export function MotionHero({lang,dark,small,frameStyle,onExplore}:{
 lang:Language;dark:boolean;small:boolean;frameStyle:StyleProp<ViewStyle>;onExplore:()=>void;
}){
 const [slide,setSlide]=useState(0);
 const [restartKey,setRestartKey]=useState(0);
 const [ctaWidth,setCtaWidth]=useState(123);
 const opacity=useRef(new Animated.Value(1)).current;
 const failed=useRef(false);
 const titleSize=small?14:15;
 const select=(next:number)=>{if(!failed.current)opacity.setValue(0);setSlide((next+heroMessages.length)%heroMessages.length);setRestartKey(v=>v+1)};
 return <ImageBackground source={approvedHeroImage} resizeMode="stretch" imageStyle={{borderRadius:17}}
  style={[frameStyle,{backgroundColor:dark?palette.dark.hero:palette.light.hero}]}>
  <HeroVideo restartKey={restartKey} onLoop={()=>{opacity.setValue(0);setSlide(v=>(v+1)%heroMessages.length)}}
   onTime={(time,duration)=>{if(!failed.current)opacity.setValue(heroTextOpacity(time,duration))}}
   onFailure={()=>{failed.current=true;opacity.setValue(1)}}/>
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
   <Svg width="100%" height="100%"><Defs><LinearGradient id="textSafe" x1="0" y1="0" x2="0" y2="1">
    <Stop offset="0" stopColor="#003B40" stopOpacity=".34"/><Stop offset=".68" stopColor="#003B40" stopOpacity=".15"/><Stop offset="1" stopColor="#003B40" stopOpacity="0"/>
   </LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#textSafe)"/></Svg>
  </View>
  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.75}
   style={{color:brandV1.accentPale,fontWeight:'600',fontSize:small?8:8.8,letterSpacing:small?.55:.85,marginBottom:4}}>
   ✦ SMART SHOPPING. REAL SAVINGS!
  </Text>
  <Animated.View style={{opacity,maxWidth:'94%'}}>
   <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={.9}
    style={{...gloss.heroInk,fontSize:titleSize,fontWeight:'700',color:brandV1.white,lineHeight:titleSize*1.1}}>{heroMessages[slide][lang][0]}</Text>
   <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={.9}
    style={{...gloss.heroInk,fontSize:titleSize,fontWeight:'700',color:brandV1.accentPale,lineHeight:titleSize*1.1,marginTop:1}}>{heroMessages[slide][lang][1]}</Text>
   <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={.9}
    style={{...gloss.heroInk,color:brandV1.white,fontSize:small?9:9.6,lineHeight:small?10.8:11.5,marginTop:4,maxWidth:'96%'}}>{heroMessages[slide][lang][2]}</Text>
  </Animated.View>
  <Pressable accessibilityRole="button" accessibilityLabel="Explore group deals" onPress={onExplore}
   onLayout={event=>setCtaWidth(event.nativeEvent.layout.width)}
   style={[gloss.glass,{position:'absolute',left:13,bottom:30,paddingVertical:7,paddingHorizontal:12,borderRadius:18}]}>
   <View pointerEvents="none" style={[StyleSheet.absoluteFill,{borderRadius:18,borderWidth:1,borderColor:gloss.edge,borderTopWidth:1.25}]}/>
   <Text style={{...gloss.heroInk,color:brandV1.white,fontWeight:'600',fontSize:9}}>{lang==='bn'?'গ্রুপ ডিল দেখুন':'Explore group deals'} →</Text>
  </Pressable>
  <View testID="hero-controls" style={{position:'absolute',left:13+(ctaWidth-132)/2,bottom:5,width:132,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8}}>
   <Pressable accessibilityRole="button" accessibilityLabel="Previous hero slide" onPress={()=>select(slide-1)}><Text style={styles.arrow}>‹</Text></Pressable>
   {heroMessages.map((_,i)=><Pressable key={i} accessibilityRole="button" accessibilityLabel={'Slide '+(i+1)}
    accessibilityState={{selected:slide===i}} onPress={()=>select(i)}
    style={{height:7,width:7,borderRadius:7,backgroundColor:i===slide?brandV1.white:brandV1.accent}}/>)}
   <Pressable accessibilityRole="button" accessibilityLabel="Next hero slide" onPress={()=>select(slide+1)}><Text style={styles.arrow}>›</Text></Pressable>
  </View>
  <View pointerEvents="none" style={[StyleSheet.absoluteFill,{borderRadius:17,borderWidth:1,borderColor:gloss.edge,borderTopWidth:1.25}]}/>
 </ImageBackground>;
}
const styles=StyleSheet.create({arrow:{fontSize:22,lineHeight:24,color:'white',fontWeight:'700'}});
