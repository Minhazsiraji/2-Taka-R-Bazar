'use client'

import { useState } from 'react'

export function ReferralShare({code}:{code:string}) {
  const [copied,setCopied]=useState(false)
  function inviteUrl(){return `${window.location.origin}/signup?ref=${encodeURIComponent(code)}`}
  async function copy(){await navigator.clipboard.writeText(inviteUrl());setCopied(true);setTimeout(()=>setCopied(false),1800)}
  async function share(){
    const url=inviteUrl()
    const text=`Join my 2-TAKA-R-BAZAR community invite with code ${code}. Your signup alone does not create a reward; a successful first collected order does.`
    if(navigator.share) await navigator.share({title:'2-TAKA-R-BAZAR neighbour invite',text,url})
    else await copy()
  }
  return <div className="flex flex-wrap gap-2">
    <button type="button" className="btn-primary" onClick={share}>Share invite</button>
    <button type="button" className="btn-secondary" onClick={copy}>{copied?'Copied':'Copy link'}</button>
  </div>
}
