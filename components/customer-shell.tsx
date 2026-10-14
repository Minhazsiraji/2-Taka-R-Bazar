import type {ReactNode} from 'react'
import type {AppRole} from '@/lib/auth'
import {getCustomerLanguage} from '@/lib/customer-language'
import {CustomerShellClient} from '@/components/customer-shell-client'

export async function CustomerShell({children,roles}:{children:ReactNode;roles:Set<AppRole>}){
 return <CustomerShellClient {...await getCustomerLanguage()}
  operations={roles.has('admin')||roles.has('super_admin')}
  pickup={roles.has('pickup_operator')||roles.has('super_admin')}
  superAdmin={roles.has('super_admin')}>{children}</CustomerShellClient>
}
