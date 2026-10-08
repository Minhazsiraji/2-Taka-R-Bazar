'use client'

import { useState } from 'react'

type Props={
  title:string
  text:string
  label?:string
  className?:string
}

export function ShareUnlockButton({title,text,label='Share to unlock faster',className=''}:Props){
  const [state,setState]=useState<'idle'|'shared'|'copied'>('idle')

  async function share(){
    const url=window.location.href
    try{
      if(navigator.share){
        await navigator.share({title,text,url})
        setState('shared')
      }else{
        await navigator.clipboard.writeText(text+' '+url)
        setState('copied')
      }
    }catch(error){
      if((error as Error)?.name==='AbortError')return
      try{
        await navigator.clipboard.writeText(text+' '+url)
        setState('copied')
      }catch{
        setState('idle')
      }
    }
    window.setTimeout(()=>setState('idle'),2200)
  }

  const current=state==='shared'?'Shared ✓':state==='copied'?'Link copied ✓':label
  return <button type="button" onClick={share} className={'cx-share-button '+className}>{current}</button>
}
