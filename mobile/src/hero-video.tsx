import React,{useEffect,useState} from 'react';
import {AppState,StyleSheet,View} from 'react-native';
import {useVideoPlayer,VideoView} from 'expo-video';

// Bundled locally: 8 seconds, 182 KB, H.264, no audio track or network fetch.
const heroVideo=require('../assets/2TBR-hero-mobile-optimized.mp4');

export function HeroVideo(){
 const [failed,setFailed]=useState(false);
 const [firstFrame,setFirstFrame]=useState(false);
 const player=useVideoPlayer(heroVideo,instance=>{
  instance.loop=true;
  instance.muted=true;
  instance.volume=0;
  instance.audioMixingMode='mixWithOthers';
  instance.staysActiveInBackground=false;
  instance.showNowPlayingNotification=false;
  if(AppState.currentState!=='background'&&AppState.currentState!=='inactive')instance.play();
 });

 useEffect(()=>{
  const fail=()=>{setFailed(true);player.pause()};
  const status=player.addListener('statusChange',event=>{
   if(event.status==='error')fail();
  });
  // A bundled source can finish loading before the listener attaches.
  if(player.status==='error')fail();
  const appState=AppState.addEventListener('change',state=>{
   if(state==='active'&&player.status!=='error')player.play();
   else player.pause();
  });
  return()=>{status.remove();appState.remove()};
 },[player]);

 if(failed)return null;
 return <View pointerEvents="none" accessible={false} accessibilityElementsHidden
  importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
  <VideoView player={player} style={[StyleSheet.absoluteFill,{opacity:firstFrame?1:0}]}
   contentFit="cover" nativeControls={false} fullscreenOptions={{enable:false}}
   allowsPictureInPicture={false} surfaceType="textureView" useExoShutter={false}
   onFirstFrameRender={()=>setFirstFrame(true)}/>
 </View>;
}
