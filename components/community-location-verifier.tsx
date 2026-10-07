'use client'

import { useState } from 'react'
import { verifyAdminUatLocation, verifyCommunityLocation } from '@/app/actions/group-deals'

type Props={allowUatFallback?:boolean}

type PositionFailure={code:number;message?:string}

export function CommunityLocationVerifier({allowUatFallback=false}:Props){
  const [busy,setBusy]=useState(false)
  const [uatBusy,setUatBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [ok,setOk]=useState<boolean|null>(null)

  async function permissionState(){
    try{
      if(!navigator.permissions)return 'unknown'
      const result=await navigator.permissions.query({name:'geolocation'})
      return result.state
    }catch{
      return 'unknown'
    }
  }

  function getPosition(options:PositionOptions){
    return new Promise<GeolocationPosition>((resolve,reject)=>{
      navigator.geolocation.getCurrentPosition(resolve,reject,options)
    })
  }

  async function submitPosition(position:GeolocationPosition){
    const fd=new FormData()
    fd.set('latitude',String(position.coords.latitude))
    fd.set('longitude',String(position.coords.longitude))
    fd.set('accuracy',String(position.coords.accuracy))
    const result=await verifyCommunityLocation(fd)
    setOk(result.ok)
    setMessage(result.ok
      ? result.message+' Accuracy: about '+Math.round(position.coords.accuracy)+' m.'
      : result.message)
    if(result.ok)window.location.reload()
  }

  async function describeFailure(error:PositionFailure){
    const permission=await permissionState()
    if(error.code===1){
      if(permission==='granted'){
        return 'Site permission is granted, but the Windows/desktop location provider denied the request. On a PC, enable “Let desktop apps access your location” if available, or verify from a phone for real GPS.'
      }
      return 'Location is blocked for this site. Allow Location in the browser site-permission menu, then retry.'
    }
    if(error.code===2){
      return 'Your device could not determine a location. Try Wi-Fi/mobile data, move near a window, or verify from a phone.'
    }
    if(error.code===3){
      return 'Location lookup timed out. Please retry; a lower-accuracy fallback was also attempted.'
    }
    return error.message||'Could not obtain a reliable location.'
  }

  async function verify(){
    if(!navigator.geolocation){
      setOk(false)
      setMessage('Location is not supported by this device/browser. Use a phone for secure verification.')
      return
    }
    setBusy(true)
    setOk(null)
    setMessage('Checking your community location…')
    try{
      let position:GeolocationPosition
      try{
        position=await getPosition({enableHighAccuracy:true,timeout:12000,maximumAge:0})
      }catch(first){
        const failure=first as PositionFailure
        if(failure.code===2||failure.code===3){
          position=await getPosition({enableHighAccuracy:false,timeout:15000,maximumAge:60000})
        }else{
          throw first
        }
      }
      await submitPosition(position)
    }catch(error){
      setOk(false)
      setMessage(await describeFailure(error as PositionFailure))
    }finally{
      setBusy(false)
    }
  }

  async function useUatFallback(){
    setUatBusy(true)
    setOk(null)
    setMessage('Applying demo-only UAT location…')
    try{
      const result=await verifyAdminUatLocation()
      setOk(result.ok)
      setMessage(result.message)
      if(result.ok)window.location.reload()
    }catch{
      setOk(false)
      setMessage('UAT location fallback failed.')
    }finally{
      setUatBusy(false)
    }
  }

  return <div className="card grid gap-3 p-4">
    <div>
      <div className="card-title">Nearby verification</div>
      <h2 className="mt-1 text-lg font-black">Verify that you are inside your community</h2>
      <p className="muted mt-1 text-sm">Your exact GPS point is used only for secure qualification and nearby-circle matching. Other customers and suppliers never receive your coordinates.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-primary w-fit" onClick={verify} disabled={busy||uatBusy}>{busy?'Checking…':'Verify my location'}</button>
      {allowUatFallback&&<button type="button" className="btn-secondary w-fit" onClick={useUatFallback} disabled={busy||uatBusy}>{uatBusy?'Applying…':'Admin UAT fallback'}</button>}
    </div>
    {allowUatFallback&&<p className="muted text-xs">Preview-only safety valve: it creates a 30-minute, demo-only verification for an admin account. It cannot qualify a non-demo/live Group Deal.</p>}
    {message&&<p className={ok===true?'success':ok===false?'error':'muted'}>{message}</p>}
  </div>
}
