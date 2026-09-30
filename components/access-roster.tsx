'use client'

import { useState } from 'react'
import { dateTime } from '@/lib/format'
import { RoleEditor } from '@/components/role-editor'

type Row = { id:string; full_name:string|null; phone:string|null; email:string|null; community_id:string|null; onboarding_completed_at:string|null; created_at:string }
export function AccessRoster({ rows, roleEntries, communities }: { rows:Row[]; roleEntries:[string,string[]][]; communities:[string,string][] }) {
  const [editing,setEditing]=useState<string|null>(null)
  const roleMap=new Map(roleEntries), communityMap=new Map(communities)
  return <div className="access-roster grid gap-3">
    {rows.map(row=>{const roles=roleMap.get(row.id)??[];return <article className="access-user-card card" key={row.id}>
      <div className="access-user-main">
        <div><div className="access-label">User</div><b>{row.full_name??'Not completed'}</b><div className="muted">{row.id.slice(0,8)}</div></div>
        <div><div className="access-label">Mobile / email</div><span>{row.phone??'—'}</span>{row.email&&<div className="muted">{row.email}</div>}</div>
        <div><div className="access-label">Community</div><span>{communityMap.get(row.community_id??'')??'—'}</span></div>
        <div><div className="access-label">Roles</div><div className="flex flex-wrap gap-1">{roles.map(role=><span key={role} className={`rounded-full px-2 py-1 text-xs font-bold ${role==='super_admin'?'bg-black text-white':'bg-slate-100 text-slate-700'}`}>{role.replaceAll('_',' ')}</span>)}</div></div>
        <div><div className="access-label">Onboarding</div><span>{row.onboarding_completed_at?'Complete':'Pending'}</span></div>
        <div><div className="access-label">Created</div><span>{dateTime(row.created_at)}</span></div>
      </div>
      <div className="access-user-action"><button type="button" className="btn-secondary access-manage-btn" onClick={()=>setEditing(editing===row.id?null:row.id)}>{editing===row.id?'Close':'Manage access'}</button></div>
      {editing===row.id&&<div className="access-editor"><RoleEditor userId={row.id} roles={roles}/></div>}
    </article>})}
  </div>
}
