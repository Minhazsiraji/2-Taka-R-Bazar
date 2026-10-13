'use client'

import {useRef} from 'react'
import type {StorefrontArea} from '@/lib/storefront'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'

/** In-flow disclosure: native option popups cannot be constrained by page CSS.
 * Native radio inputs provide Tab/arrow-key selection without a custom listbox. */
export function CommunityPicker({areas,value,onChange,language,statusId}:{areas:StorefrontArea[];value:string;onChange:(value:string)=>void;language:MarketplaceLanguage;statusId?:string}){
 const disclosure=useRef<HTMLDetailsElement>(null)
 const t=(en:string,bn:string)=>chooseText(language,en,bn)
 const label=t('Your community / area','আপনার কমিউনিটি / এলাকা')
 const options=[{community_id:'',community_name:t('All operating areas','সব এলাকা')},...areas]
 return <div className="market-community-picker">
  <span id="market-area-label" className="market-community-label">{label}</span>
  <details ref={disclosure} onKeyDown={event=>{
   if(event.key==='Escape'){
    event.preventDefault()
    if(disclosure.current)disclosure.current.open=false
    disclosure.current?.querySelector('summary')?.focus()
   }
  }}>
   <summary id="market-area-select" aria-labelledby="market-area-label market-area-value" aria-describedby={statusId}>
    <span id="market-area-value">{options.find(option=>option.community_id===value)?.community_name??options[0].community_name}</span>
    <span aria-hidden="true">⌄</span>
   </summary>
   <fieldset className="market-community-options">
    <legend className="sr-only">{label}</legend>
    {options.map(option=><label key={option.community_id}>
     <input type="radio" name="browsing-community" value={option.community_id} checked={value===option.community_id}
      onChange={event=>onChange(event.target.value)}/>
     <span>{option.community_name}</span>
    </label>)}
    <button type="button" className="market-community-done" onClick={()=>{
     if(disclosure.current)disclosure.current.open=false
     disclosure.current?.querySelector('summary')?.focus()
    }}>{t('Done','সম্পন্ন')}</button>
   </fieldset>
  </details>
 </div>
}
