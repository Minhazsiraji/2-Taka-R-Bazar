import { setUserRole } from '@/app/actions/super-admin'

const editableRoles = ['admin','pickup_operator','super_admin'] as const
export function RoleEditor({ userId, roles }: { userId:string; roles:string[] }) {
 return <div className="flex flex-wrap gap-2">
  {editableRoles.map(role => {
   const enabled=roles.includes(role)
   return <form action={setUserRole} key={role}>
    <input type="hidden" name="user_id" value={userId}/><input type="hidden" name="role" value={role}/><input type="hidden" name="enabled" value={String(!enabled)}/>
    <button type="submit" className={enabled?'btn-secondary text-xs':'btn-primary text-xs'} title={`${enabled?'Revoke':'Grant'} ${role}`}>
     {enabled?'Revoke':'Grant'} {role.replaceAll('_',' ')}
    </button>
   </form>
  })}
 </div>
}
