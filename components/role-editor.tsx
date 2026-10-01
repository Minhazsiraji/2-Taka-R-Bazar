'use client'

import { setUserRole } from '@/app/actions/super-admin'

const editableRoles = ['admin','pickup_operator','super_admin'] as const
export function RoleEditor({ userId, roles }: { userId:string; roles:string[] }) {
 return <div className="role-editor-panel">
  <div className="role-editor-title">Access roles</div>
  <p className="muted">Grant or revoke operational access for this user.</p>
  <div className="role-editor-list">
   {editableRoles.map(role=>{const enabled=roles.includes(role);return <form action={setUserRole} key={role} className="role-editor-row">
    <input type="hidden" name="user_id" value={userId}/><input type="hidden" name="role" value={role}/><input type="hidden" name="enabled" value={String(!enabled)}/>
    <div><div className="font-semibold capitalize">{role.replaceAll('_',' ')}</div><div className="muted">{enabled?'Currently granted':'Not granted'}</div></div>
    <button type="submit" className={enabled?'btn-danger role-action-btn':'btn-secondary role-action-btn'}>{enabled?'Revoke':'Grant'}</button>
   </form>})}
  </div>
 </div>
}
