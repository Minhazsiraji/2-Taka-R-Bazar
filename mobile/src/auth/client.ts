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
const storage={
 getItem:(name:string)=>SecureStore.getItemAsync(name),
 setItem:(name:string,value:string)=>SecureStore.setItemAsync(name,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY}),
 removeItem:(name:string)=>SecureStore.deleteItemAsync(name),
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
