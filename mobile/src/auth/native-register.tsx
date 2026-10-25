import React,{useEffect,useState} from 'react';
import {Alert,Pressable,ScrollView,View} from 'react-native';
import {Text,TextInput} from '../typography';
import type {Language} from '../content';
import type {AppTheme} from '../theme';
import {nativeClient} from './client';
import {toBdE164Phone} from './phone.mjs';

type Community={id:string;name:string};
type Props={lang:Language;theme:AppTheme;mode:'signUp'|'onboarding';onDone:()=>void;onBack:()=>void};
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
export function NativeCustomerRegistration({lang,theme,mode,onDone,onBack}:Props){
 const [phone,setPhone]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [fullName,setFullName]=useState(''),[household,setHousehold]=useState(''),[address,setAddress]=useState('');
 const [community,setCommunity]=useState(''),[communities,setCommunities]=useState<Community[]>([]),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const t=(en:string,bn:string)=>lang==='bn'?bn:en;
 const field={borderWidth:1,borderColor:theme.line,backgroundColor:theme.field,borderRadius:11,color:theme.text,padding:11,marginTop:6};
 useEffect(()=>{
  if(mode!=='onboarding')return;
  const client=nativeClient();
  if(!client)return;
  let active=true;
  void client.from('communities').select('id,name').eq('active',true).order('name').then(({data,error})=>{
   if(!active)return;
   if(error)setMessage('Community list unavailable. Reconnect and retry.');
   else setCommunities((data??[]) as Community[]);
  });
  void client.auth.getUser().then(({data})=>{if(active)setPhone(data.user?.phone??'')});
  return()=>{active=false};
 },[mode]);
 const button=(name:string,onPress:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled||busy} onPress={onPress} style={{borderColor:theme.line,borderWidth:1,borderRadius:11,padding:13,marginTop:12,opacity:disabled||busy?0.45:1}}>
  <Text style={{color:theme.accent,textAlign:'center',fontWeight:'800'}}>{name}</Text>
 </Pressable>;
 const input=(title:string,value:string,change:(v:string)=>void,secret=false)=><View style={{marginTop:12}}>
  <Text style={{color:theme.text,fontWeight:'700',fontSize:12}}>{title}</Text>
  <TextInput accessibilityLabel={title} secureTextEntry={secret} autoCapitalize="none" value={value} onChangeText={change} style={field}/>
 </View>;
 const create=async()=>{
  const mobile=toBdE164Phone(phone);
  if(!mobile||password.length<12||password.length>128||password!==confirm){
   setMessage(t('Enter a valid Bangladesh number and matching passwords of at least 12 characters.','সঠিক মোবাইল নম্বর ও কমপক্ষে ১২ অক্ষরের একই পাসওয়ার্ড দিন।'));return
  }
  const client=nativeClient();if(!client){setMessage('Secure sign-up is not configured.');return}
  setBusy(true);setMessage('');
  try{
   const {data,error}=await client.auth.signUp({phone:mobile,password});
   if(error||!data.session||!data.user||data.user.phone!==mobile.replace(/^\+/,'')){
    setMessage(t('Could not create a verified session. If you already registered, sign in instead. No SMS was sent.','নিবন্ধন সম্ভব হয়নি। আগে থেকে অ্যাকাউন্ট থাকলে লগইন করুন।'));return
   }
   Alert.alert(t('Account created','অ্যাকাউন্ট তৈরি হয়েছে'),t('Choose your household and community to finish setting up.','আপনার পরিবার ও কমিউনিটি নির্বাচন করুন।'));
   onDone();
  }catch{setMessage('Could not register. Check your connection.')}
  finally{setBusy(false)}
 };
 const complete=async()=>{
  if(fullName.trim().length<2||household.trim().length<2||!uuid.test(community)){
   setMessage(t('Enter your full name, household name and select your community.','নাম, পরিবারের নাম এবং কমিউনিটি নির্বাচন করুন।'));return
  }
  const client=nativeClient();if(!client)return;
  setBusy(true);setMessage('');
  try{
   const {data:{user},error:userError}=await client.auth.getUser();
   if(userError||!user)throw new Error('Sign in first');
   const current=await client.from('profiles').select('onboarding_completed_at').eq('id',user.id).single();
   if(current.error||current.data.onboarding_completed_at)throw new Error('Account already configured. Use Profile settings to change community.');
   const verifiedPhone=user.phone||toBdE164Phone(phone)?.replace(/^\+/,'');
   if(!verifiedPhone)throw new Error('Add a Bangladesh mobile contact number first');
   const updated=await client.from('profiles').update({
    full_name:fullName.trim(),household_name:household.trim(),phone:verifiedPhone,community_id:community,
    address_hint:address.trim()||null,pickup_point_id:null,onboarding_completed_at:new Date().toISOString()
   }).eq('id',user.id).select('id').maybeSingle();
   if(updated.error||!updated.data)throw new Error(updated.error?.message??'Could not save your household');
   Alert.alert(t('Ready to shop','কেনাকাটার জন্য প্রস্তুত'),t('Your community is now associated with your account.','আপনার কমিউনিটি অ্যাকাউন্টে সংযুক্ত হয়েছে।'));
   onDone();
  }catch(e){setMessage(e instanceof Error?e.message:'Please retry')}
  finally{setBusy(false)}
 };
 return <View style={{padding:12,paddingBottom:50}}>
  <Text style={{fontSize:21,fontWeight:'900',color:theme.text}}>{mode==='signUp'?t('Create your 2TBR account','2TBR অ্যাকাউন্ট তৈরি'):t('Set up your household','আপনার পরিবারের তথ্য')}</Text>
  <Text style={{fontSize:11,color:theme.muted,marginTop:6}}>{mode==='signUp'?t('No SMS/OTP is used in the current pilot. Number ownership and community eligibility are checked separately.','এই পাইলটে OTP নেই। কমিউনিটি যোগ্যতা আলাদাভাবে যাচাই হয়।'):t('Registered members can join deals in their chosen community only.','আপনার নির্বাচিত কমিউনিটিতে ডিলে যোগ দিতে পারবেন।')}</Text>
  {mode==='signUp'?<>
   {input(t('Mobile number','মোবাইল নম্বর'),phone,setPhone)}
   {input(t('Password (12–128 characters)','পাসওয়ার্ড (১২–১২৮ অক্ষর)'),password,setPassword,true)}
   {input(t('Confirm password','পাসওয়ার্ড আবার দিন'),confirm,setConfirm,true)}
   {button(t('Create account','অ্যাকাউন্ট তৈরি করুন'),()=>void create(),!phone||!password||!confirm)}
  </>:<>
   {input(t('Full name','পুরো নাম'),fullName,setFullName)}
   {input(t('Household name','পরিবারের নাম'),household,setHousehold)}
   {!phone&&input(t('Bangladesh contact mobile','মোবাইল নম্বর'),phone,setPhone)}
   {input(t('Address / building (optional)','ঠিকানা / বাড়ি (ঐচ্ছিক)'),address,setAddress)}
   <Text style={{color:theme.text,fontWeight:'800',marginTop:13}}>{t('Select community','কমিউনিটি বাছুন')}</Text>
   {communities.map(item=>button((community===item.id?'✓  ':'')+item.name,()=>setCommunity(item.id)))}
   {!communities.length&&<Text style={{color:theme.muted,marginTop:9}}>{t('No communities available. Check your connection.','কোনো কমিউনিটি পাওয়া যায়নি। ইন্টারনেট দেখুন।')}</Text>}
   {button(t('Save household','পরিবার সংরক্ষণ'),()=>void complete(),!community||!fullName||!household)}
  </>}
  {!!message&&<Text accessibilityRole="alert" style={{color:'#B33C3C',marginTop:12}}>{message}</Text>}
  {button(t('Back','ফিরে যান'),onBack)}
 </View>;
}
