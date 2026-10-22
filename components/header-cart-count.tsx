'use client'
import {useEffect,useState} from 'react'
import {readLaunchCart} from '@/lib/launch-cart'

/** Browser-local cart indicator; an item is not a paid order or a Group Deal commitment. */
export function HeaderCartCount(){
 const [count,setCount]=useState(0)
 useEffect(()=>{
  const refresh=()=>setCount(readLaunchCart().reduce((sum,item)=>sum+item.quantity,0))
  refresh()
  window.addEventListener('2tbr-cart-updated',refresh)
  window.addEventListener('storage',refresh)
  window.addEventListener('focus',refresh)
  return()=>{window.removeEventListener('2tbr-cart-updated',refresh);window.removeEventListener('storage',refresh);window.removeEventListener('focus',refresh)}
 },[])
 if(!count)return null
 return <div className="notification-unread-badge absolute right-[-2px] top-[1px] inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-cyan-300 px-1 text-center text-[10px] font-black leading-none text-slate-950" aria-label={`${count} items in cart`}>{count>99?'99+':count}</div>
}
