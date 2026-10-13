import 'server-only'
import {redirect} from 'next/navigation'
import {getViewer} from '@/lib/auth'
import {commerceEnabled,commerceProof} from '@/lib/commerce/server'
import {commerceUatLoginEnabled} from '@/lib/commerce/uat-access.mjs'

// Normal customer verification stays unchanged. A private, leased fixture can
// represent an email-only test customer for explicitly approved synthetic SOLO
// offers; it never writes a phone or onboarding state to the customer's profile.
export async function requireCommerceCustomer() {
 const viewer=await getViewer()
 if(viewer.profile?.full_name && viewer.profile?.phone && viewer.profile?.community_id)return {...viewer,isTestFixture:false}
 if(commerceEnabled() && commerceUatLoginEnabled()) {
  const {data,error}=await viewer.supabase.rpc('commerce_uat_customer_context',{p_proof:commerceProof()})
  if(!error && data?.is_test_fixture===true && data.community_id)return {...viewer,profile:data,isTestFixture:true}
 }
 redirect('/onboarding')
}
