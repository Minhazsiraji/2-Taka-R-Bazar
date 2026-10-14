'use client'
import {useEffect} from 'react'
import {useRouter} from 'next/navigation'

export function NotificationInboxRefresh({unread}:{unread:number}){
 const router=useRouter()
 useEffect(()=>{window.dispatchEvent(new Event('2tbr-notifications-refresh'))},[unread])
 useEffect(()=>{
  const refresh=()=>router.refresh()
  window.addEventListener('2tbr-notifications-updated',refresh)
  return()=>window.removeEventListener('2tbr-notifications-updated',refresh)
 },[router])
 return null
}
