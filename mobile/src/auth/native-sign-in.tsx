import React,{useState} from 'react';
import {Alert,Pressable,Text,TextInput,View} from 'react-native';
import type {Language} from '../content';
import type {AppTheme} from '../theme';
import {useNativeAuth} from './use-native-auth';

export function NativeSignIn({auth,lang,theme,onSuccess}:{auth:ReturnType<typeof useNativeAuth>;lang:Language;theme:AppTheme;onSuccess:()=>void}){
 const [phone,setPhone]=useState('');
 const [password,setPassword]=useState('');
 const label=(en:string,bn:string)=>lang==='bn'?bn:en;
 const field={borderWidth:1,borderColor:theme.line,backgroundColor:theme.field,color:theme.text,borderRadius:11,padding:11,marginTop:6,marginBottom:15};
 const beginPhone=async()=>{
  try{await auth.signInPhone(phone,password);setPassword('');setPhone('');onSuccess()}
  catch{Alert.alert(label('Sign-in failed','লগইন হয়নি'),label('Check your mobile number and password.','মোবাইল নম্বর ও পাসওয়ার্ড পরীক্ষা করুন।'))}
 };
 const beginGoogle=async()=>{
  try{if(await auth.signInGoogle())onSuccess()}
  catch{Alert.alert(label('Google sign-in unavailable','Google লগইন বন্ধ'),label('Check the allowlisted callback and test on an installed development build.','অনুমোদিত রিডিরেক্ট ও ইনস্টল করা ডেভেলপমেন্ট বিল্ড যাচাই করুন।'))}
 };
 const action=(name:string,run:()=>void,disabled:boolean,primary:boolean)=><Pressable accessibilityRole="button" disabled={disabled} onPress={run} style={{padding:12,borderRadius:10,alignItems:'center',marginTop:9,opacity:disabled?.4:1,borderWidth:primary?0:1,borderColor:theme.line,backgroundColor:primary?theme.accent:theme.field}}><Text style={{color:primary?theme.onPrimary:theme.text,fontWeight:'900'}}>{name}</Text></Pressable>;
 return <View style={{paddingBottom:20}}>
  <Text style={{fontSize:10,fontWeight:'900',color:theme.accent,letterSpacing:1.2,marginTop:12}}>SECURE SIGN IN</Text>
  <Text style={{fontSize:21,color:theme.text,fontWeight:'900',marginBottom:15}}>{label('Your existing 2TBR account','আপনার বিদ্যমান 2TBR অ্যাকাউন্ট')}</Text>
  <View style={{borderWidth:1,borderRadius:14,borderColor:theme.line,backgroundColor:theme.card,padding:13}}>
   <Text style={{fontSize:12,color:theme.text,fontWeight:'800'}}>{label('Bangladesh mobile number','বাংলাদেশি মোবাইল নম্বর')}</Text>
   <TextInput accessibilityLabel="Bangladesh mobile number" keyboardType="phone-pad" textContentType="telephoneNumber" placeholder="01XXXXXXXXX" value={phone} onChangeText={setPhone} placeholderTextColor={theme.muted} style={field}/>
   <Text style={{fontSize:12,color:theme.text,fontWeight:'800'}}>{label('Password','পাসওয়ার্ড')}</Text>
   <TextInput accessibilityLabel="Password" secureTextEntry textContentType="password" autoCapitalize="none" value={password} onChangeText={setPassword} placeholder={label('Password','পাসওয়ার্ড')} placeholderTextColor={theme.muted} style={field}/>
   {action(auth.busy?label('Signing in…','লগইন হচ্ছে…'):label('Sign in with mobile','মোবাইল দিয়ে লগইন'),()=>{void beginPhone()},!auth.ready||auth.busy||!phone||!password,true)}
   {action(label('Continue with Google','Google দিয়ে লগইন')+(auth.googleEnabled?'':' · '+label('Setup required','সেটআপ প্রয়োজন')),()=>{void beginGoogle()},!auth.googleEnabled||auth.busy,false)}
   <Text style={{fontSize:11,color:theme.muted,marginTop:12,lineHeight:17}}>{label('Google requires the approved twotbr://auth/callback redirect and a native development build. Link Google to an existing account on the website first; do not create a duplicate account.','Google এর জন্য নিরাপদ রিডিরেক্ট ও ডেভেলপমেন্ট বিল্ড প্রয়োজন। আগে ওয়েবসাইটে Google অ্যাকাউন্ট যুক্ত করুন।')}</Text>
  </View>
  <Text style={{fontSize:11,color:theme.muted,marginTop:12}}>{label('After sign-in, the order history and savings shown here remain demo data pending customer-scoped backend verification.','লগইনের পরও গ্রাহক-নিরাপত্তা যাচাই না হওয়া পর্যন্ত অর্ডার ও সাশ্রয় ডেমো তথ্য থাকবে।')}</Text>
 </View>;
}
