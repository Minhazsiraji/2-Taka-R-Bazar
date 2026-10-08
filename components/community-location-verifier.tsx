'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { verifyAdminUatLocation, verifyCommunityLocation } from '@/app/actions/group-deals'

type Props={
  allowUatFallback?:boolean
  initialVerified?:boolean
}

type PositionFailure={code:number;message?:string}

export function CommunityLocationVerifier({
  allowUatFallback=false,
  initialVerified=false,
}:Props){
  const [busy,setBusy]=useState(false)
  const [uatBusy,setUatBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [ok,setOk]=useState<boolean|null>(initialVerified?true:null)
  const autoStarted=useRef(false)

  const permissionState=useCallback(async()=>{
    try{
      if(!navigator.permissions)return 'unknown'
      const result=await navigator.permissions.query({name:'geolocation'})
      return result.state
    }catch{
      return 'unknown'
    }
  },[])

  const getPosition=useCallback((options:PositionOptions)=>{
    return new Promise<GeolocationPosition>((resolve,reject)=>{
      navigator.geolocation.getCurrentPosition(resolve,reject,options)
    })
  },[])

  const submitPosition=useCallback(async(position:GeolocationPosition)=>{
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
  },[])

  const describeFailure=useCallback(async(error:PositionFailure)=>{
    const permission=await permissionState()
    if(error.code===1){
      if(permission==='granted'){
        return 'Location permission is allowed, but this device could not provide a usable position. On desktop, verify from a phone for real GPS.'
      }
      return 'Location is blocked for this site. Open browser site permissions, allow Location, then tap Verify my location again.'
    }
    if(error.code===2){
      return 'Your device could not determine a location. Turn on Location/GPS and Wi-Fi or mobile data, then try again.'
    }
    if(error.code===3){
      return 'Location lookup timed out. Please retry; a lower-accuracy fallback was also attempted.'
    }
    return error.message||'Could not obtain a reliable location.'
  },[permissionState])

  const verify=useCallback(async(auto=false)=>{
    if(!navigator.geolocation){
      setOk(false)
      setMessage('Location is not supported by this device/browser. Use a phone with Location/GPS enabled.')
      return
    }

    setBusy(true)
    setOk(null)
    setMessage(auto?'Requesting your phone location…':'Checking your community location…')

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
  },[describeFailure,getPosition,submitPosition])

  useEffect(()=>{
    if(initialVerified||autoStarted.current||typeof window==='undefined')return
    const mobileUserAgent=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    const coarsePointer=window.matchMedia?.('(pointer: coarse)').matches??false
    if(!mobileUserAgent&&!coarsePointer)return

    const storageKey='2tbr-group-location-auto-requested-v1'
    if(window.sessionStorage.getItem(storageKey)==='1')return
    autoStarted.current=true

    void (async()=>{
      const state=await permissionState()
      if(state==='denied'){
        setOk(false)
        setMessage('Location is blocked for this site. Allow Location in your mobile browser settings, then tap Verify my location.')
        window.sessionStorage.setItem(storageKey,'1')
        return
      }

      window.sessionStorage.setItem(storageKey,'1')
      await verify(true)
    })()
  },[initialVerified,permissionState,verify])

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
      <p className="muted mt-1 text-sm">On a phone, 2-TAKA-R-BAZAR requests Location automatically once when verification is still needed. Your exact GPS point is used only for secure qualification and nearby-circle matching; other customers and suppliers never receive your coordinates.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-primary w-fit" onClick={()=>void verify(false)} disabled={busy||uatBusy}>{busy?'Checking…':'Verify my location'}</button>
      {allowUatFallback&&<button type="button" className="btn-secondary w-fit" onClick={useUatFallback} disabled={busy||uatBusy}>{uatBusy?'Applying…':'Admin UAT fallback'}</button>}
    </div>
    {allowUatFallback&&<p className="muted text-xs">Preview-only safety valve: it creates a 30-minute, demo-only verification for an admin account. It cannot qualify a non-demo/live Group Deal.</p>}
    {message&&<p className={ok===true?'success':ok===false?'error':'muted'}>{message}</p>}
  </div>
}
