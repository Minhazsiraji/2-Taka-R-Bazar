'use client'

import { useEffect, useRef, useState } from 'react'

const SOURCE_MAX_BYTES=5*1024*1024
const TARGET_BYTES=850*1024
const MAX_EDGE=1600
const ACCEPTED=new Set(['image/jpeg','image/png','image/webp'])

async function canvasBlob(canvas:HTMLCanvasElement,quality:number){
  return new Promise<Blob|null>((resolve)=>canvas.toBlob(resolve,'image/webp',quality))
}

async function optimizeImage(file:File){
  if(!ACCEPTED.has(file.type))throw new Error('Choose a JPEG, PNG or WebP image.')
  if(file.size>SOURCE_MAX_BYTES)throw new Error('Choose an image that is 5 MB or smaller.')
  if(file.size<=TARGET_BYTES)return file

  const bitmap=await createImageBitmap(file)
  try{
    let scale=Math.min(1,MAX_EDGE/Math.max(bitmap.width,bitmap.height))
    let quality=.84
    let best:Blob|null=null
    for(let attempt=0;attempt<6;attempt++){
      const canvas=document.createElement('canvas')
      canvas.width=Math.max(1,Math.round(bitmap.width*scale))
      canvas.height=Math.max(1,Math.round(bitmap.height*scale))
      const ctx=canvas.getContext('2d',{alpha:true})
      if(!ctx)throw new Error('This browser could not prepare the image.')
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height)
      const blob=await canvasBlob(canvas,quality)
      if(!blob)throw new Error('This browser could not optimize the image.')
      best=blob
      if(blob.size<=TARGET_BYTES)break
      quality=Math.max(.58,quality-.08)
      scale*=.86
    }
    if(!best||best.size>1200*1024)throw new Error('Please choose a smaller or lower-resolution image.')
    const stem=file.name.replace(/\.[^.]+$/,'')||'product'
    return new File([best],`${stem}.webp`,{type:'image/webp',lastModified:Date.now()})
  }finally{bitmap.close()}
}

export function ProductImageInput(){
  const inputRef=useRef<HTMLInputElement>(null)
  const busyRef=useRef(false)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('JPEG, PNG or WebP — max 5 MB. Large photos are optimized automatically before secure upload.')
  const [error,setError]=useState('')

  useEffect(()=>{
    const form=inputRef.current?.closest('form')
    if(!form)return
    const block=(event:SubmitEvent)=>{if(busyRef.current){event.preventDefault();setError('Please wait for the image to finish optimizing.')}}
    form.addEventListener('submit',block)
    return()=>form.removeEventListener('submit',block)
  },[])

  async function onChange(){
    const input=inputRef.current
    const file=input?.files?.[0]
    if(!input||!file)return
    busyRef.current=true;setBusy(true);setError('')
    try{
      const optimized=await optimizeImage(file)
      const dt=new DataTransfer();dt.items.add(optimized);input.files=dt.files
      const saved=Math.max(0,file.size-optimized.size)
      setMessage(saved>0?`Ready · optimized to ${Math.max(1,Math.round(optimized.size/1024))} KB for faster mobile upload.`:'Ready to upload.')
    }catch(e){input.value='';setError(e instanceof Error?e.message:'Image preparation failed. Please try another image.')}
    finally{busyRef.current=false;setBusy(false)}
  }

  return <label className="md:col-span-2"><span className="label">Product image</span><input ref={inputRef} className="input" type="file" name="image_file" accept="image/jpeg,image/png,image/webp" onChange={onChange} disabled={busy}/><span className="muted mt-1 block text-xs">{busy?'Optimizing image…':message}</span>{error&&<span className="mt-1 block text-xs font-semibold text-red-700">{error}</span>}</label>
}
