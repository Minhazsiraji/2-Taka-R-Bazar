'use client'
import { useMemo, useState, useTransition } from 'react'
import { sendAdminBroadcast } from '@/app/actions/admin-notifications'

type Community={id:string;name:string}; type Pool={id:string;title:string}
export function NotificationComposer({communities,pools,customerCount}:{communities:Community[];pools:Pool[];customerCount:number}){
 const [title,setTitle]=useState(''),[message,setMessage]=useState(''),[community,setCommunity]=useState('')
 const [priority,setPriority]=useState('normal'),[action,setAction]=useState('none'),[target,setTarget]=useState('')
 const [preview,setPreview]=useState(false),[review,setReview]=useState(false),[result,setResult]=useState('')
 const [pending,startTransition]=useTransition()
 const href=useMemo(()=>action==='pool'&&target?`/pool#pool-${target}`:action==='orders'||action==='payment'?'/orders':action==='pickup'?'/pickup':action==='notifications'?'/notifications':'',[action,target])
 const valid=Boolean(title.trim()&&message.trim()&&(action!=='pool'||target))
 const actionLabel=action==='pool'?'Tap to view the pool':action==='payment'?'Make payment':action==='pickup'?'View pickup details':action==='orders'?'View order':action==='notifications'?'Open notifications':''
 const audienceLabel=community?(communities.find(c=>c.id===community)?.name??'Selected community'):'All users'
 function send(){startTransition(async()=>{setResult('');const r=await sendAdminBroadcast({title,message,communityId:community||null,priority,href:href||'/notifications',poolId:action==='pool'?target:null});if(r.ok){setResult(`Sent to ${r.count} customer${r.count===1?'':'s'}.`);setReview(false);setTitle('');setMessage('');setAction('none');setTarget('')}else setResult(r.error||'Unable to send.')})}
 return <section className="card grid gap-5">
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="card-title">New announcement</div><h2 className="section-title">Compose notification</h2></div><span className="chip">{customerCount} registered profiles</span></div>
  {result&&<div className="notice">{result}</div>}
  <div className="grid gap-4 md:grid-cols-2">
   <label className="md:col-span-2"><span className="label">Title</span><input className="input" maxLength={80} value={title} onChange={e=>setTitle(e.target.value)} placeholder="October grocery pool is open"/></label>
   <label className="md:col-span-2"><span className="label">Message</span><textarea className="input min-h-24" maxLength={500} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Save up to ৳200. Commit before the deadline."/></label>
   <label><span className="label">Audience / community</span><select className="input" value={community} onChange={e=>setCommunity(e.target.value)}><option value="">All users — every community</option>{communities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Choose a community to target only its customers.</span></label>
   <label><span className="label">Priority</span><select className="input" value={priority} onChange={e=>setPriority(e.target.value)}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
   <label><span className="label">Action</span><select className="input" value={action} onChange={e=>{setAction(e.target.value);setTarget('')}}><option value="none">No action — information only</option><option value="pool">Open pool</option><option value="orders">Confirm / view order</option><option value="payment">Make payment</option><option value="pickup">Pickup details</option><option value="notifications">Open notifications</option></select></label>
   {action==='pool'&&<label><span className="label">Pool</span><select className="input" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choose exact pool</option>{pools.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>}
   <div className="md:col-span-2 rounded-xl border border-slate-200 p-3 text-sm"><b>Destination:</b> {href||'No link — informational notification only'}</div>
  </div>
  <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><b>In-app notification</b><div className="text-xs text-slate-500">Customer notification timeline.</div></div><div className="rounded-xl border border-slate-200 p-4"><b>Browser / PWA push</b><div className="text-xs text-slate-500">Subscribed customer devices.</div></div></div>
  <div className="notice"><b>Safety gate:</b> review the exact audience, message and destination before customer delivery.</div>
  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-secondary sm:min-w-36" type="button" onClick={()=>setPreview(true)} disabled={!valid}>Preview message</button><button className="btn-primary sm:min-w-36" type="button" onClick={()=>setReview(true)} disabled={!valid}>Review &amp; send</button></div>
  {preview&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={()=>setPreview(false)}><div className="card w-full max-w-lg" onClick={e=>e.stopPropagation()}><div className="card-title">Customer preview</div><h3 className="section-title mt-1">{title}</h3><p className="mt-3 whitespace-pre-wrap">{message}</p>{actionLabel&&<div className="mt-4 font-bold text-cyan-700">{actionLabel}</div>}<div className="mt-5 flex justify-end"><button className="btn-secondary" onClick={()=>setPreview(false)}>Close preview</button></div></div></div>}
  {review&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="card w-full max-w-lg">
   <div className="card-title">Final review</div><h3 className="section-title mt-1">Ready to send?</h3>
   <dl className="mt-4 grid gap-3 text-sm"><div><dt className="font-bold">Audience</dt><dd>{audienceLabel}</dd></div><div><dt className="font-bold">Title</dt><dd>{title}</dd></div><div><dt className="font-bold">Message</dt><dd className="whitespace-pre-wrap">{message}</dd></div><div><dt className="font-bold">Action</dt><dd>{actionLabel||'No action'}{href?` · ${href}`:''}</dd></div></dl>
   <p className="notice mt-4">This will create an in-app notification for the selected customers. Subscribed devices are eligible for PWA push delivery.</p>
   <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-secondary" type="button" onClick={()=>setReview(false)} disabled={pending}>Cancel</button><button className="btn-primary" type="button" onClick={send} disabled={pending}>{pending?'Sending…':'Send notification'}</button></div>
  </div></div>}
 </section>
}
