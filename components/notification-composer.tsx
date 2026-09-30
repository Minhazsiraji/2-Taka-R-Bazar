'use client'
import { useMemo, useState } from 'react'

type Community={id:string;name:string}; type Pool={id:string;title:string}
export function NotificationComposer({communities,pools,customerCount}:{communities:Community[];pools:Pool[];customerCount:number}){
 const [title,setTitle]=useState(''),[message,setMessage]=useState(''),[audience,setAudience]=useState('all'),[community,setCommunity]=useState('')
 const [priority,setPriority]=useState('normal'),[action,setAction]=useState('none'),[target,setTarget]=useState(''),[show,setShow]=useState(false)
 const href=useMemo(()=>action==='pool'&&target?`/pool#pool-${target}`:action==='orders'?'/orders':action==='payment'?'/orders':action==='pickup'?'/pickup':action==='notifications'?'/notifications':'',[action,target])
 return <section className="card grid gap-5">
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="card-title">New announcement</div><h2 className="section-title">Compose notification</h2></div><span className="chip">{customerCount} registered profiles</span></div>
  <div className="grid gap-4 md:grid-cols-2">
   <label className="md:col-span-2"><span className="label">Title</span><input className="input" maxLength={80} value={title} onChange={e=>setTitle(e.target.value)} placeholder="October grocery pool is open"/></label>
   <label className="md:col-span-2"><span className="label">Message</span><textarea className="input min-h-28" maxLength={500} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Save up to ৳200. Commit before the deadline."/></label>
   <label><span className="label">Audience</span><select className="input" value={audience} onChange={e=>setAudience(e.target.value)}><option value="all">All users</option><option value="community">One community</option></select></label>
   <label><span className="label">Community</span><select className="input" value={community} onChange={e=>setCommunity(e.target.value)} disabled={audience!=='community'}><option value="">Choose community</option>{communities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <label><span className="label">Priority</span><select className="input" value={priority} onChange={e=>setPriority(e.target.value)}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
   <label><span className="label">Action</span><select className="input" value={action} onChange={e=>{setAction(e.target.value);setTarget('')}}><option value="none">No action</option><option value="pool">Open pool</option><option value="orders">Confirm / view order</option><option value="payment">Make payment</option><option value="pickup">Pickup details</option><option value="notifications">Open notifications</option></select></label>
   {action==='pool'&&<label className="md:col-span-2"><span className="label">Pool</span><select className="input" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choose exact pool</option>{pools.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>}
   <div className="md:col-span-2 rounded-xl border border-slate-200 p-3 text-sm"><b>Generated destination:</b> {href||'No link — informational notification only'}</div>
  </div>
  <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><b>In-app notification</b><div className="text-xs text-slate-500">Customer notification timeline.</div></div><div className="rounded-xl border border-slate-200 p-4"><b>Browser / PWA push</b><div className="text-xs text-slate-500">Subscribed customer devices.</div></div></div>
  <div className="notice"><b>Safety gate:</b> review the exact message and destination before customer delivery is enabled.</div>
  <div className="flex justify-end gap-2"><button className="btn-secondary" type="button" onClick={()=>setShow(true)} disabled={!title||!message}>Preview message</button><button className="btn-primary opacity-60" type="button" disabled>Review & send</button></div>
  {show&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={()=>setShow(false)}><div className="card w-full max-w-lg" onClick={e=>e.stopPropagation()}><div className="card-title">Customer preview</div><h3 className="section-title mt-1">{title}</h3><p className="mt-3 whitespace-pre-wrap">{message}</p><div className="mt-4 text-sm"><b>Action:</b> {href?href:'None'}</div>{href&&<div className="mt-3 font-bold text-cyan-700">{action==='pool'?'Tap to view the pool':action==='payment'?'Make payment':action==='pickup'?'View pickup details':'Open'}</div>}<button className="btn-secondary mt-5" onClick={()=>setShow(false)}>Close preview</button></div></div>}
 </section>
}
