import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import {AppState,Platform} from 'react-native';

// Opt in deliberately; never put service-role keys or secrets in EXPO_PUBLIC variables.
const url=process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()||'';
const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()||'';
const enabled=process.env.EXPO_PUBLIC_NATIVE_AUTH_ENABLED==='true';
export const nativeRedirectUrl='twotbr://auth/callback';
let singleton:SupabaseClient|null=null;
export function nativeAuthConfigured(){
 if(!enabled||!key)return false;
 try{const parsed=new URL(url);return parsed.protocol==='https:'&&!!parsed.hostname}
 catch{return false}
}
export const nativeGoogleConfigured=()=>nativeAuthConfigured()&&process.env.EXPO_PUBLIC_NATIVE_GOOGLE_ENABLED==='true';
// Persistent sessions and PKCE verifiers are encrypted and device-local.
// Versioned, atomic chunks stay exclusively in encrypted OS storage.
// Older secure stores may reject sessions longer than ~2 KiB.
const CHUNK=1400;
type Manifest={version:1;nonce:string;count:number};
const options={keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
const manifestKey=(key:string)=>key+'-manifest';
const chunkKey=(key:string,nonce:string,i:number)=>key+'-'+nonce+'-'+i;
const readManifest=async(key:string):Promise<Manifest|null>=>{
 const value=await SecureStore.getItemAsync(manifestKey(key));
 if(!value)return null;
 try{
  const item=JSON.parse(value) as Manifest;
  if(item.version!==1||!Number.isInteger(item.count)||item.count<1||item.count>200||!/^[-a-zA-Z0-9]+$/.test(item.nonce))return null;
  return item;
 }catch{return null}
};
const cleanChunks=async(key:string,manifest:Manifest)=>{
 for(let i=0;i<manifest.count;i++)await SecureStore.deleteItemAsync(chunkKey(key,manifest.nonce,i));
};
const storage={
 async getItem(key:string):Promise<string|null>{
  const meta=await readManifest(key);
  if(!meta)return null;
  let joined='';
  for(let i=0;i<meta.count;i++){
   const chunk=await SecureStore.getItemAsync(chunkKey(key,meta.nonce,i));
   if(!chunk)return null; // never restore an incomplete credential
   joined+=chunk;
  }
  try{return decodeURIComponent(joined)}catch{return null}
 },
 async setItem(key:string,value:string):Promise<void>{
  const data=encodeURIComponent(value);
  const chunks=data.match(/.{1,1400}/g)||[''];
  if(chunks.length>200)throw new Error('Native session too large');
  const old=await readManifest(key);
  const next:Manifest={version:1,nonce:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),count:chunks.length};
  try{
   for(let i=0;i<chunks.length;i++)await SecureStore.setItemAsync(chunkKey(key,next.nonce,i),chunks[i],options);
   await SecureStore.setItemAsync(manifestKey(key),JSON.stringify(next),options);
  }catch(err){await cleanChunks(key,next).catch(()=>{});throw err}
  if(old)await cleanChunks(key,old).catch(()=>{}); // never revoke a successful new session on cleanup failure
 },
 async removeItem(key:string):Promise<void>{
  const old=await readManifest(key);
  await SecureStore.deleteItemAsync(manifestKey(key));
  if(old)await cleanChunks(key,old);
 }
};

export function nativeClient():SupabaseClient|null{
 if(!nativeAuthConfigured())return null;
 if(!singleton)singleton=createClient(url,key,{
  auth:{storage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'}
 });
 return singleton;
}
export function subscribeAuthRefresh(client:SupabaseClient){
 const sync=(state:string)=>state==='active'?client.auth.startAutoRefresh():client.auth.stopAutoRefresh();
 sync(AppState.currentState);
 const listener=AppState.addEventListener('change',sync);
 return ()=>{listener.remove();client.auth.stopAutoRefresh()};
}
export async function nativeGoogleSignIn(client:SupabaseClient){
 if(!nativeGoogleConfigured())throw new Error('Native Google sign-in is not configured');
 if(Platform.OS!=='ios'&&Platform.OS!=='android')throw new Error('Native development build required');
 const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:nativeRedirectUrl,skipBrowserRedirect:true}});
 if(error||!data.url)throw new Error('Google sign-in could not start');
 const result=await WebBrowser.openAuthSessionAsync(data.url,nativeRedirectUrl);
 if(result.type!=='success')return false;
 const callback=new URL(result.url);
 if(callback.protocol!=='twotbr:'||callback.hostname!=='auth'||callback.pathname!=='/callback'||callback.hash||
 callback.searchParams.has('access_token')||callback.searchParams.has('refresh_token'))throw new Error('Unexpected OAuth callback');
 const code=callback.searchParams.get('code');
 if(!code||callback.searchParams.has('error'))throw new Error('Google authorization cancelled or invalid');
 const completed=await client.auth.exchangeCodeForSession(code);
 if(completed.error||!completed.data.session||!completed.data.user)throw new Error('Google sign-in was not verified');
 return true;
}
