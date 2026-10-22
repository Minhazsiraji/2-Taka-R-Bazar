import {useCallback,useEffect,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {nativeClient,nativeAuthConfigured,nativeGoogleConfigured,nativeGoogleSignIn,subscribeAuthRefresh} from './client';
import {toBdE164Phone,validPassword} from './phone.mjs';

type Identity={id:string;email?:string;phone?:string};
const identity=(user:User):Identity=>({id:user.id,email:user.email,phone:user.phone});

export function useNativeAuth(){
 const client=nativeClient();
 const configured=nativeAuthConfigured();
 const googleEnabled=nativeGoogleConfigured();
 const [ready,setReady]=useState(!configured);
 const [user,setUser]=useState<Identity|null>(null);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!client)return;
  let active=true,epoch=0;
  const verify=async(hasSession:boolean)=>{
   const request=++epoch;
   if(!hasSession){if(active){setUser(null);setReady(true)}return}
   try {
    const result=await client.auth.getUser();
    if(active&&epoch===request)setUser(result.error||!result.data.user?null:identity(result.data.user));
   }catch{
    if(active&&epoch===request)setUser(null);
   }finally{if(active&&epoch===request)setReady(true)}
  };
  const listener=client.auth.onAuthStateChange((_type,session)=>{
   // Never await another Supabase call inside its auth event callback.
   void Promise.resolve().then(()=>verify(!!session));
  });
  const stopRefresh=subscribeAuthRefresh(client);
  void client.auth.getSession().then(v=>verify(!!v.data.session)).catch(()=>verify(false));
  return ()=>{active=false;epoch++;listener.data.subscription.unsubscribe();stopRefresh()};
 },[client]);

 const signInPhone=useCallback(async(raw:string,password:string)=>{
  if(!client)throw new Error('Native authentication is not configured');
  const phone=toBdE164Phone(raw);
  if(!phone||!validPassword(password))throw new Error('Enter a valid Bangladesh mobile number and password');
  setBusy(true);
  try{
   const result=await client.auth.signInWithPassword({phone,password});
   if(result.error||!result.data.session||!result.data.user)throw new Error('Credentials not accepted');
   const checked=await client.auth.getUser();
   if(checked.error||!checked.data.user||checked.data.user.id!==result.data.user.id){
    await client.auth.signOut({scope:'local'});
    throw new Error('Identity verification failed');
   }
   setUser(identity(checked.data.user));
  }finally{setBusy(false)}
 },[client]);

 const signInGoogle=useCallback(async()=>{
  if(!client||!googleEnabled)throw new Error('Google sign-in is not configured');
  setBusy(true);
  try{
   if(!await nativeGoogleSignIn(client))return false;
   const checked=await client.auth.getUser();
   if(checked.error||!checked.data.user)throw new Error('Identity verification failed');
   setUser(identity(checked.data.user));return true;
  }finally{setBusy(false)}
 },[client,googleEnabled]);

 const signOut=useCallback(async()=>{
  if(!client)return;
  setBusy(true);
  try{
   const result=await client.auth.signOut({scope:'local'});
   if(result.error)throw new Error('Could not sign out. Please try again.');
   setUser(null);
  }finally{setBusy(false)}
 },[client]);
 return {configured,googleEnabled,ready,user,busy,signInPhone,signInGoogle,signOut};
}
