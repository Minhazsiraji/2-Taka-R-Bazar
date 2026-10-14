'use client'

import {useState} from 'react'
import {showcaseVideo} from '@/lib/showcase-media'

export function ShowcaseProductGallery({name,images,videoUrl}:{name:string;images:string[];videoUrl:string|null}){
  const [selected,setSelected]=useState(0)
  const video=showcaseVideo(videoUrl)
  const media=[...images.map(src=>({kind:'image' as const,src})),...(video?[video]:[])]
  const current=media[selected]??media[0]
  return <div className="min-w-0">
    <div className="showcase-detail-media flex min-h-64 items-center justify-center overflow-hidden rounded-[26px] p-3 sm:min-h-[420px]">
      {current?.kind==='image'
        ?<img src={current.src} alt={`${name} — view ${selected+1}`} className="max-h-[450px] w-full object-contain"/>
        :current?.kind==='mp4'
          ?<video className="max-h-[450px] w-full rounded-xl" controls playsInline preload="metadata" src={current.src}>Your browser does not support video playback.</video>
          :current?.kind==='youtube'
            ?<iframe title={`${name} product video`} className="aspect-video w-full rounded-xl" loading="lazy" src={current.src} referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/>
            :<div className="py-24 text-center text-slate-500"><span className="text-6xl" aria-hidden="true">🛍️</span><p>Images coming soon</p></div>}
    </div>
    {media.length>1&&<div className="mt-3 flex flex-wrap gap-2" aria-label="Product media gallery">
      {media.map((item,index)=><button type="button" key={item.kind+item.src+index} onClick={()=>setSelected(index)} aria-label={item.kind==='image'?`View product image ${index+1}`:'Play product video'} aria-pressed={selected===index} className={`showcase-thumbnail ${selected===index?'is-active':''}`}>
        {item.kind==='image'?<img src={item.src} alt="" className="h-full w-full object-contain"/>:<span className="text-sm font-bold">▶ Video</span>}
      </button>)}
    </div>}
  </div>
}
