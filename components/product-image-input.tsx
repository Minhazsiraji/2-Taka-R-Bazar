'use client'

import { useEffect, useRef, useState } from 'react'

const SOURCE_MAX_BYTES=5*1024*1024
const TARGET_BYTES=850*1024
const MAX_EDGE=1600
const ANALYSIS_EDGE=900
const ACCEPTED=new Set(['image/jpeg','image/png','image/webp'])

type Crop={x:number;y:number;width:number;height:number;trimmed:boolean}

async function canvasBlob(canvas:HTMLCanvasElement,quality:number){
  return new Promise<Blob|null>((resolve)=>canvas.toBlob(resolve,'image/webp',quality))
}

function detectContentCrop(bitmap:ImageBitmap):Crop{
  const scale=Math.min(1,ANALYSIS_EDGE/Math.max(bitmap.width,bitmap.height))
  const width=Math.max(1,Math.round(bitmap.width*scale))
  const height=Math.max(1,Math.round(bitmap.height*scale))
  const canvas=document.createElement('canvas')
  canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d',{alpha:true,willReadFrequently:true})
  if(!ctx)return {x:0,y:0,width:bitmap.width,height:bitmap.height,trimmed:false}
  ctx.drawImage(bitmap,0,0,width,height)
  const data=ctx.getImageData(0,0,width,height).data

  const corner=Math.max(2,Math.min(12,Math.round(Math.min(width,height)*.025)))
  const cornerPoints=[[0,0],[width-corner,0],[0,height-corner],[width-corner,height-corner]]
  let lightCorners=0
  for(const [sx,sy] of cornerPoints){
    let light=0,total=0
    for(let y=sy;y<sy+corner;y++)for(let x=sx;x<sx+corner;x++){
      const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2],a=data[i+3]
      if(a<24||(r>=238&&g>=238&&b>=238))light++
      total++
    }
    if(light/Math.max(1,total)>.82)lightCorners++
  }
  if(lightCorners<3)return {x:0,y:0,width:bitmap.width,height:bitmap.height,trimmed:false}

  let minX=width,minY=height,maxX=-1,maxY=-1
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2],a=data[i+3]
    const background=a<24||(r>=246&&g>=246&&b>=246)
    if(!background){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}
  }
  if(maxX<minX||maxY<minY)return {x:0,y:0,width:bitmap.width,height:bitmap.height,trimmed:false}

  const foundW=maxX-minX+1,foundH=maxY-minY+1
  const pad=Math.max(3,Math.round(Math.max(foundW,foundH)*.045))
  minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad)
  maxX=Math.min(width-1,maxX+pad);maxY=Math.min(height-1,maxY+pad)
  const cropW=maxX-minX+1,cropH=maxY-minY+1
  const removesUsefulMargin=(cropW/width<.94)||(cropH/height<.94)
  if(!removesUsefulMargin)return {x:0,y:0,width:bitmap.width,height:bitmap.height,trimmed:false}

  const invX=bitmap.width/width,invY=bitmap.height/height
  const x=Math.max(0,Math.floor(minX*invX)),y=Math.max(0,Math.floor(minY*invY))
  const right=Math.min(bitmap.width,Math.ceil((maxX+1)*invX)),bottom=Math.min(bitmap.height,Math.ceil((maxY+1)*invY))
  return {x,y,width:Math.max(1,right-x),height:Math.max(1,bottom-y),trimmed:true}
}

async function optimizeImage(file:File){
  if(!ACCEPTED.has(file.type))throw new Error('Choose a JPEG, PNG or WebP image.')
  if(file.size>SOURCE_MAX_BYTES)throw new Error('Choose an image that is 5 MB or smaller.')

  const bitmap=await createImageBitmap(file)
  try{
    const crop=detectContentCrop(bitmap)
    if(file.size<=TARGET_BYTES&&!crop.trimmed)return {file,trimmed:false}

    let scale=Math.min(1,MAX_EDGE/Math.max(crop.width,crop.height))
    let quality=.86
    let best:Blob|null=null
    for(let attempt=0;attempt<6;attempt++){
      const canvas=document.createElement('canvas')
      canvas.width=Math.max(1,Math.round(crop.width*scale))
      canvas.height=Math.max(1,Math.round(crop.height*scale))
      const ctx=canvas.getContext('2d',{alpha:true})
      if(!ctx)throw new Error('This browser could not prepare the image.')
      ctx.drawImage(bitmap,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height)
      const blob=await canvasBlob(canvas,quality)
      if(!blob)throw new Error('This browser could not optimize the image.')
      best=blob
      if(blob.size<=TARGET_BYTES)break
      quality=Math.max(.58,quality-.08)
      scale*=.86
    }
    if(!best||best.size>1200*1024)throw new Error('Please choose a smaller or lower-resolution image.')
    const stem=file.name.replace(/\.[^.]+$/,'')||'product'
    return {file:new File([best],`${stem}.webp`,{type:'image/webp',lastModified:Date.now()}),trimmed:crop.trimmed}
  }finally{bitmap.close()}
}

export function ProductImageInput(){
  const inputRef=useRef<HTMLInputElement>(null)
  const busyRef=useRef(false)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('JPEG, PNG or WebP — max 5 MB. Blank outer margins are trimmed and large photos are optimized automatically.')
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
    const source=input?.files?.[0]
    if(!input||!source)return
    busyRef.current=true;setBusy(true);setError('')
    try{
      const result=await optimizeImage(source)
      const dt=new DataTransfer();dt.items.add(result.file);input.files=dt.files
      const size=Math.max(1,Math.round(result.file.size/1024))
      setMessage(result.trimmed?`Ready · blank margins trimmed · ${size} KB.`:(result.file.size<source.size?`Ready · optimized to ${size} KB for faster mobile upload.`:'Ready to upload.'))
    }catch(e){input.value='';setError(e instanceof Error?e.message:'Image preparation failed. Please try another image.')}
    finally{busyRef.current=false;setBusy(false)}
  }

  return <label className="md:col-span-2"><span className="label">Product image</span><input ref={inputRef} className="input" type="file" name="image_file" accept="image/jpeg,image/png,image/webp" onChange={onChange} disabled={busy}/><span className="muted mt-1 block text-xs">{busy?'Preparing image…':message}</span>{error&&<span className="mt-1 block text-xs font-semibold text-red-700">{error}</span>}</label>
}
