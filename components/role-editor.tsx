'use client'

import { useState } from 'react'
import { setUserRole } from '@/app/actions/super-admin'

const editableRoles = ['admin','pickup_operator','super_admin'] as const
export function RoleEditor({ userId, roles }: { userId:string; roles:string[] }) {
 const [open,setOpen]=useState(false)
 return <div className="relative">
  <button type="button" className="btn-secondary whitespace-nowrap text-xs" onClick={()=>setOpen(!open)} aria-expanded={open}>Manage access</button>
  {open&&<div className="absolute right-0 z-20 mt-2 w-52 rounded-2xl border border-white/80 bg-white/95 p-2 shadow-xl backdrop-blur dark:bg-slate-900/95">
   <div className="mb-1 px-2 py-1 text-xs font-black uppercase tracking-wide text-slate-500">Roles</div>
   {editableRoles.map(role=>{const enabled=roles.includes(role);return <form action={setUserRole} key={role} className="m-0">
    <input type="hidden" name="user_id" value={userId}/><input type="hidden" name="role" value={role}/><input type="hidden" name="enabled" value={String(!enabled)}/>
    <button type="submit" className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800">
     <span>{role.replaceAll('_',' ')}</span><span className={enabled?'text-rose-600':'text-cyan-700'}>{enabled?'Revoke':'Grant'}</span>
    </button>
   </form>})}
  </div>}
 </div>
}
