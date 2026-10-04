'use client'

import { useLayoutEffect } from 'react'

function applyPoolTarget(){
  const hash=window.location.hash
  const selected=hash.startsWith('#pool-')?hash.slice(1):''
  const sections=Array.from(document.querySelectorAll<HTMLElement>('.pool-view section[id^="pool-"]'))
  for(const section of sections){
    section.hidden=Boolean(selected)&&section.id!==selected
  }
  if(selected){
    const target=document.getElementById(selected)
    target?.scrollIntoView({block:'start'})
  }
}

export function PoolTargetIsolation(){
  useLayoutEffect(()=>{
    applyPoolTarget()
    const onHashChange=()=>applyPoolTarget()
    window.addEventListener('hashchange',onHashChange)
    return()=>window.removeEventListener('hashchange',onHashChange)
  },[])
  return null
}
