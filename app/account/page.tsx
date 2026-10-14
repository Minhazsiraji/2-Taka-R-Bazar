import {cookies} from 'next/headers'
import {getViewer} from '@/lib/auth'
import {AccountDashboard} from '@/components/account-dashboard'
import {STOREFRONT_LANGUAGE_COOKIE,isValidLanguagePreference,languageFromPreference} from '@/lib/storefront-language'
import './account-dashboard.css'
export const dynamic='force-dynamic'
export default async function AccountPage(){
 const [viewer,store]=await Promise.all([getViewer(),cookies()])
 const preference=store.get(STOREFRONT_LANGUAGE_COOKIE)?.value
 const {data:community}=viewer.profile?.community_id
  ?await viewer.supabase.from('communities').select('name').eq('id',viewer.profile.community_id).maybeSingle()
  :{data:null}
 const superAdmin=viewer.roles.has('super_admin')
 const operations=superAdmin||viewer.roles.has('admin')
 return <AccountDashboard name={viewer.profile?.full_name??''} communityName={community?.name??''}
  needsSetup={!viewer.profile?.full_name||!viewer.profile.phone||!viewer.profile.community_id||!viewer.profile.onboarding_completed_at}
  operations={operations} superAdmin={superAdmin} pickup={operations||viewer.roles.has('pickup_operator')}
  initialLanguage={languageFromPreference(preference)} hasLanguageCookie={isValidLanguagePreference(preference)}/>
}
