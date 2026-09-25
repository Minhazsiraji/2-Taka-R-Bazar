import { requirePickupOperator } from '@/lib/auth'
import { markCollected, reportPickupIssue } from '@/app/actions/pickup'
import { SubmitButton } from '@/components/submit-button'
import { StatusPill } from '@/components/status-pill'
import { Flash } from '@/components/flash'
import Link from 'next/link'
import { taka } from '@/lib/format'

export const dynamic='force-dynamic'
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;error?:string;notice?:string}>}){
  const {user,roles,supabase}=await requirePickupOperator()
  const sp=await searchParams
  let pointIds:string[]=[]
  if(roles.has('admin')){
    const {data}=await supabase.from('pickup_points').select('id').eq('active',true)
    pointIds=(data??[]).map((x:any)=>x.id)
  } else {
    const {data}=await supabase.from('pickup_operator_assignments').select('pickup_point_id').eq('user_id',user.id)
    pointIds=(data??[]).map((x:any)=>x.pickup_point_id)
  }
  let orders:any[]=[]
  if(pointIds.length){
    const {data}=await supabase.from('orders').select('*,pickup_points(name,address),order_items(*,products(name,package_size))').in('pickup_point_id',pointIds).in('status',['ready_for_pickup','completed']).order('ready_at',{ascending:false})
    orders=data??[]
  }
  const {data:contacts}=await supabase.rpc('get_pickup_customer_contacts')
  const pm=new Map((contacts??[]).map((p:any)=>[p.order_id,p]))
  const q=(sp.q??'').trim().toLowerCase()
  if(q)orders=orders.filter(o=>{const p=pm.get(o.id) as any;return o.order_code.toLowerCase().includes(q)||(p?.full_name??'').toLowerCase().includes(q)||(p?.phone??'').includes(q)})
  return <div className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex max-w-4xl justify-between px-4 py-3"><b className="text-emerald-700">1TAKA Pickup</b><Link href="/home" className="text-sm font-bold">Customer app →</Link></div></header><main className="mx-auto grid max-w-4xl gap-4 px-4 py-5"><section><h1 className="text-3xl font-black">Pickup operations</h1><p className="muted">Only orders assigned to your pickup location are shown.</p></section><Flash error={sp.error} notice={sp.notice}/><form className="card flex gap-2" method="get"><input className="input" name="q" defaultValue={sp.q??''} placeholder="Search order ID, customer name or phone"/><button className="btn-secondary">Search</button></form>{orders.length===0?<div className="card muted">No matching pickup orders.</div>:orders.map(o=>{const p=pm.get(o.id) as any;return <article className="card" key={o.id}><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-black">{o.order_code}</h2><p className="muted">{p?.full_name} · {p?.phone}</p><p className="muted">{o.pickup_points?.name}</p></div><StatusPill status={o.status}/></div><div className="mt-3 grid gap-2">{o.order_items?.map((i:any)=><div key={i.id} className="flex justify-between border-t border-slate-100 pt-2"><span>{i.products?.name} · {i.products?.package_size} × <b>{i.quantity}</b></span><span>{taka(Number(i.unit_price)*Number(i.quantity))}</span></div>)}</div>{o.status==='ready_for_pickup'&&<div className="mt-4 grid gap-3 md:grid-cols-2"><form action={markCollected} className="grid gap-2 rounded-xl bg-emerald-50 p-3"><input type="hidden" name="order_id" value={o.id}/><input className="input" name="notes" placeholder="Collection note (optional)"/><SubmitButton>Mark collected</SubmitButton><p className="text-xs text-emerald-900">This action completes the order and generates verified savings exactly once.</p></form><form action={reportPickupIssue} className="grid gap-2 rounded-xl bg-amber-50 p-3"><input type="hidden" name="order_id" value={o.id}/><textarea className="input min-h-20" name="description" placeholder="Missing/damaged/wrong goods detail" required/><SubmitButton className="btn-secondary">Report issue</SubmitButton></form></div>}</article>})}</main></div>
}
