'use client'

import Link from 'next/link'
import {useEffect,useRef,useState} from 'react'
import {usePathname} from 'next/navigation'
import {HeaderActionIcon} from '@/components/header-action-icon'

type Status={authenticated:boolean;unread:number;latest:string|null}
export function NotificationBell(){
 const pathname=usePathname()
 const [status,setStatus]=useState<Status>({authenticated:false,unread:0,latest:null})
 const previous=useRef<Status|null>(null)
 useEffect(()=>{
  const controller=new AbortController()
  let running=false
  async function refresh(){
   if(running||document.visibilityState==='hidden')return
   running=true
   try{
    const response=await fetch('/api/notifications/status',{cache:'no-store',signal:controller.signal})
    if(!response.ok)return
    const next=await response.json() as Status
    if(controller.signal.aborted)return
    const changed=previous.current&&JSON.stringify(previous.current)!==JSON.stringify(next)
    previous.current=next
    setStatus(next)
    if(changed)window.dispatchEvent(new Event('2tbr-notifications-updated'))
   }catch{/* Retain the last known count during a temporary network failure. */}
   finally{running=false}
  }
  void refresh()
  const timer=window.setInterval(refresh,15000)
  window.addEventListener('focus',refresh)
  window.addEventListener('2tbr-notifications-refresh',refresh)
  document.addEventListener('visibilitychange',refresh)
  return()=>{controller.abort();window.clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('2tbr-notifications-refresh',refresh);document.removeEventListener('visibilitychange',refresh)}
 },[pathname])
 const unread=status.unread
 return <Link href="/notifications" className="customer-notification-bell relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm" aria-label={unread?`${unread} unread notifications`:'Notifications'} title="Notifications">
  <HeaderActionIcon kind="bell"/>
  {unread>0&&<span className="notification-unread-badge absolute right-[-2px] top-[1px] inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-cyan-300 px-1 text-center text-[10px] font-black leading-none text-slate-950" aria-hidden="true">{unread>99?'99+':unread}</span>}
 </Link>
}
