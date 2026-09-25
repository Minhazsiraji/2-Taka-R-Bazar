import { AdminShell } from '@/components/admin-shell'
import { Flash } from '@/components/flash'
import { SubmitButton } from '@/components/submit-button'
import { createCommunity, updateCommunity } from '@/app/actions/admin'
import { requireAdmin } from '@/lib/auth'

export const dynamic='force-dynamic'
export default async function Page({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {supabase}=await requireAdmin();const sp=await searchParams
  const {data:rows}=await supabase.from('communities').select('*').order('sort_order')
  return <AdminShell><h1 className="text-3xl font-black mb-4">Communities</h1><Flash {...sp}/>
    <form action={createCommunity} className="card form-grid mb-5"><label><span className="label">Name</span><input className="input" name="name" required/></label><label><span className="label">Slug</span><input className="input" name="slug" required/></label><label><span className="label">Sort order</span><input className="input" name="sort_order" type="number" defaultValue="100"/></label><div className="flex items-end"><SubmitButton>Create community</SubmitButton></div></form>
    <div className="grid gap-3">{rows?.map((r:any)=><details className="card" key={r.id}><summary className="cursor-pointer flex justify-between gap-3"><span><b>{r.name}</b> <span className="muted">· {r.slug}</span></span><span className="chip">{r.active?'Active':'Inactive'}</span></summary><form action={updateCommunity} className="form-grid mt-4"><input type="hidden" name="id" value={r.id}/><input className="input" name="name" defaultValue={r.name} required/><input className="input" name="slug" defaultValue={r.slug} required/><input className="input" name="sort_order" type="number" defaultValue={r.sort_order}/><label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={r.active}/><span>Active</span></label><SubmitButton>Save community</SubmitButton></form></details>)}</div>
    <p className="muted mt-4">Historical communities are soft-deactivated instead of hard-deleted so orders and savings remain auditable.</p>
  </AdminShell>
}
