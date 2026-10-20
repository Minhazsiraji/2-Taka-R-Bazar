import React,{useEffect,useRef,useState} from 'react';
import {AppState,StyleSheet,View} from 'react-native';
import {useVideoPlayer,VideoView} from 'expo-video';

// Bundled locally: 8 seconds, 182 KB, H.264, no audio track or network fetch.
const heroVideo=require('../assets/2TBR-hero-mobile-optimized.mp4');

type Props={restartKey?:number;onLoop?:()=>void;onTime?:(time:number,duration:number)=>void;onFailure?:()=>void};
export function HeroVideo({restartKey=0,onLoop,onTime,onFailure}:Props={}){
 const callbacks=useRef({onLoop,onTime,onFailure});
 callbacks.current={onLoop,onTime,onFailure};
 const previousRestart=useRef(restartKey);
 const [failed,setFailed]=useState(false);
 const [firstFrame,setFirstFrame]=useState(false);
 const player=useVideoPlayer(heroVideo,instance=>{
  instance.loop=true;
  instance.muted=true;
  instance.volume=0;
  instance.timeUpdateEventInterval=.1;
  instance.audioMixingMode='mixWithOthers';
  instance.staysActiveInBackground=false;
  instance.showNowPlayingNotification=false;
  if(AppState.currentState!=='background'&&AppState.currentState!=='inactive')instance.play();
 });

 useEffect(()=>{
  const fail=()=>{setFailed(true);player.pause();callbacks.current.onFailure?.()};
  const status=player.addListener('statusChange',event=>{
   if(event.status==='error')fail();
  });
  const loop=player.addListener('playToEnd',()=>callbacks.current.onLoop?.());
  const time=player.addListener('timeUpdate',event=>callbacks.current.onTime?.(event.currentTime,player.duration));
  // A bundled source can finish loading before the listener attaches.
  if(player.status==='error')fail();
  const appState=AppState.addEventListener('change',state=>{
   if(state==='active'&&player.status!=='error')player.play();
   else player.pause();
  });
  return()=>{status.remove();loop.remove();time.remove();appState.remove()};
 },[player]);

 useEffect(()=>{
  if(previousRestart.current===restartKey)return;
  previousRestart.current=restartKey;
  if(player.status==='error')return;
  // A manual dot/arrow selection starts its message and cart from the same frame.
  player.currentTime=0;
  callbacks.current.onTime?.(0,player.duration);
  if(AppState.currentState==='active')player.play();
 },[player,restartKey]);

 if(failed)return null;
 return <View pointerEvents="none" accessible={false} accessibilityElementsHidden
  importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
  <VideoView player={player} style={[StyleSheet.absoluteFill,{opacity:firstFrame?1:0}]}
   contentFit="cover" nativeControls={false} fullscreenOptions={{enable:false}}
   allowsPictureInPicture={false} surfaceType="textureView" useExoShutter={false}
   onFirstFrameRender={()=>{setFirstFrame(true);callbacks.current.onTime?.(player.currentTime,player.duration)}}/>
 </View>;
}
