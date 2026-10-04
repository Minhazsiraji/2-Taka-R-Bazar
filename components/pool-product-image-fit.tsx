'use client'

import { useEffect } from 'react'

type Crop={x:number;y:number;width:number;height:number;sourceWidth:number;sourceHeight:number}

function expandAspect(crop:Crop,minAspect=.55,maxAspect=1.6):Crop{
  let {x,y,width,height,sourceWidth,sourceHeight}=crop
  const aspect=width/height
  if(aspect<minAspect){
    const wanted=Math.min(sourceWidth,height*minAspect)
    const extra=wanted-width
    x=Math.max(0,Math.min(sourceWidth-wanted,x-extra/2));width=wanted
  }else if(aspect>maxAspect){
    const wanted=Math.min(sourceHeight,width/maxAspect)
    const extra=wanted-height
    y=Math.max(0,Math.min(sourceHeight-wanted,y-extra/2));height=wanted
  }
  return {x,y,width,height,sourceWidth,sourceHeight}
}

async function analyze(src:string):Promise<Crop|null>{
  return new Promise(resolve=>{
    const probe=new Image();probe.crossOrigin='anonymous';probe.referrerPolicy='no-referrer'
    probe.onload=()=>{
      try{
        const scale=Math.min(1,600/Math.max(probe.naturalWidth,probe.naturalHeight))
        const w=Math.max(1,Math.round(probe.naturalWidth*scale)),h=Math.max(1,Math.round(probe.naturalHeight*scale))
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h
        const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx){resolve(null);return}
        ctx.drawImage(probe,0,0,w,h)
        const data=ctx.getImageData(0,0,w,h).data
        let minX=w,minY=h,maxX=-1,maxY=-1
        for(let py=0;py<h;py++)for(let px=0;px<w;px++){
          const i=(py*w+px)*4,r=data[i],g=data[i+1],b=data[i+2],a=data[i+3]
          const blank=a<24||(r>=244&&g>=244&&b>=244)
          if(!blank){if(px<minX)minX=px;if(px>maxX)maxX=px;if(py<minY)minY=py;if(py>maxY)maxY=py}
        }
        if(maxX<minX||maxY<minY){resolve(null);return}
        const pad=Math.max(3,Math.round(Math.max(maxX-minX+1,maxY-minY+1)*.04))
        minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);maxX=Math.min(w-1,maxX+pad);maxY=Math.min(h-1,maxY+pad)
        const sx=probe.naturalWidth/w,sy=probe.naturalHeight/h
        resolve(expandAspect({x:minX*sx,y:minY*sy,width:(maxX-minX+1)*sx,height:(maxY-minY+1)*sy,sourceWidth:probe.naturalWidth,sourceHeight:probe.naturalHeight}))
      }catch{resolve(null)}
    }
    probe.onerror=()=>resolve(null);probe.src=src
  })
}

function apply(img:HTMLImageElement,crop:Crop){
  const frame=img.parentElement as HTMLElement|null;if(!frame)return
  const available=frame.parentElement?.clientWidth||frame.clientWidth||280
  const aspect=crop.width/crop.height
  const maxH=window.matchMedia('(max-width:639px)').matches?300:320
  let height=Math.min(maxH,available/Math.max(aspect,.01));let width=height*aspect
  if(width>available){width=available;height=width/aspect}
  frame.style.setProperty('position','relative','important');frame.style.setProperty('width',`${Math.round(width)}px`,'important');frame.style.setProperty('height',`${Math.round(height)}px`,'important');frame.style.setProperty('aspect-ratio','auto','important');frame.style.setProperty('padding','0','important');frame.style.setProperty('margin-left','auto','important');frame.style.setProperty('margin-right','auto','important')
  const fx=crop.x/crop.sourceWidth,fy=crop.y/crop.sourceHeight,fw=crop.width/crop.sourceWidth,fh=crop.height/crop.sourceHeight
  img.style.setProperty('position','absolute','important');img.style.setProperty('width',`${100/fw}%`,'important');img.style.setProperty('height',`${100/fh}%`,'important');img.style.setProperty('left',`${-100*fx/fw}%`,'important');img.style.setProperty('top',`${-100*fy/fh}%`,'important');img.style.setProperty('max-width','none','important');img.style.setProperty('max-height','none','important');img.style.setProperty('object-fit','fill','important')
}

export function PoolProductImageFit(){
  useEffect(()=>{
    let cancelled=false
    for(const img of Array.from(document.querySelectorAll<HTMLImageElement>('.pool-view img[alt$=" product image"]'))){
      const src=img.currentSrc||img.src;if(!src)continue
      void analyze(src).then(crop=>{if(!cancelled&&crop)apply(img,crop)})
    }
    return()=>{cancelled=true}
  },[])
  return null
}
