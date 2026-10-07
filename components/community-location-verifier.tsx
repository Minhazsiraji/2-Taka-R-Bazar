'use client'

import { useState } from 'react'
import { verifyCommunityLocation } from '@/app/actions/group-deals'

export function CommunityLocationVerifier(){
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [ok,setOk]=useState<boolean|null>(null)

  async function verify(){
    if(!navigator.geolocation){
      setOk(false)
      setMessage('Location is not supported by this device/browser.')
      return
    }
    setBusy(true)
    setMessage('Checking your community location…')
    navigator.geolocation.getCurrentPosition(async(position)=>{
      const fd=new FormData()
      fd.set('latitude',String(position.coords.latitude))
      fd.set('longitude',String(position.coords.longitude))
      fd.set('accuracy',String(position.coords.accuracy))
      try{
        const result=await verifyCommunityLocation(fd)
        setOk(result.ok)
        setMessage(result.message)
      }catch{
        setOk(false)
        setMessage('Location verification failed. Please try again.')
      }finally{
        setBusy(false)
      }
    },(error)=>{
      setBusy(false)
      setOk(false)
      setMessage(error.code===1
        ? 'Location permission is required to qualify for nearby Group Deals.'
        : 'Could not get a reliable location. Please try again.')
    },{
      enableHighAccuracy:true,
      timeout:12000,
      maximumAge:0,
    })
  }

  return <div className="card grid gap-3 p-4">
    <div>
      <div className="card-title">Nearby verification</div>
      <h2 className="mt-1 text-lg font-black">Verify that you are inside your community</h2>
      <p className="muted mt-1 text-sm">Your exact GPS point is used only for secure qualification and nearby-circle matching. Other customers and suppliers never receive your coordinates.</p>
    </div>
    <button type="button" className="btn-primary w-fit" onClick={verify} disabled={busy}>{busy?'Checking…':'Verify my location'}</button>
    {message&&<p className={ok===true?'success':ok===false?'error':'muted'}>{message}</p>}
  </div>
}
