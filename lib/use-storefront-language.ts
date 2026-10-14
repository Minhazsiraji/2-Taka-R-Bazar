'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {isValidLanguagePreference,languageFromPreference,
 STOREFRONT_LANGUAGE_COOKIE,STOREFRONT_LANGUAGE_STORAGE} from '@/lib/storefront-language'

function rememberLanguage(next:MarketplaceLanguage){
 if(typeof window==='undefined')return
 try{window.localStorage.setItem(STOREFRONT_LANGUAGE_STORAGE,next)}catch{/* Optional persistence may be blocked */}
 try{
  const secure=window.location.protocol==='https:'?'; Secure':''
  document.cookie=`${STOREFRONT_LANGUAGE_COOKIE}=${next}; Path=/; Max-Age=34560000; SameSite=Lax${secure}`
 }catch{/* Allow switching even when cookies are blocked */}
}

/**
 * Server-provided cookie controls the first render (no reload language flash).
 * localStorage is fallback when a browser expires the preference cookie.
 * Both are updated only for a valid preference, never for auth or location.
 */
export function useStorefrontLanguage(initialLanguage:MarketplaceLanguage,hasLanguageCookie:boolean){
 const [language,setLanguage]=useState<MarketplaceLanguage>(initialLanguage)
 const changedByCustomer=useRef(false)
 useEffect(()=>{
  if(changedByCustomer.current)return
  let desired=initialLanguage
  // Client storage also reconciles an older cached Next.js route after a language
  // switch on another page. The cookie still controls the initial server render.
  try{
   const stored=window.localStorage.getItem(STOREFRONT_LANGUAGE_STORAGE)
   if(isValidLanguagePreference(stored))desired=stored
  }catch{/* Safari/private browsing can disallow storage */}
  if(desired!==initialLanguage)setLanguage(desired)
  rememberLanguage(desired)
  const onStorage=(event:StorageEvent)=>{
   if(event.key!==STOREFRONT_LANGUAGE_STORAGE||!isValidLanguagePreference(event.newValue))return
   setLanguage(event.newValue)
   rememberLanguage(event.newValue)
  }
  window.addEventListener('storage',onStorage)
  return ()=>window.removeEventListener('storage',onStorage)
 },[initialLanguage,hasLanguageCookie])
 const selectLanguage=useCallback((next:MarketplaceLanguage)=>{
  const safe=languageFromPreference(next)
  changedByCustomer.current=true
  setLanguage(safe)
  rememberLanguage(safe)
 },[])
 return [language,selectLanguage] as const
}
