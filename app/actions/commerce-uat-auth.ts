'use server'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {passwordCredentials} from '@/lib/password-login.mjs'
import {commerceUatLoginEnabled} from '@/lib/commerce/uat-access.mjs'

export async function signInCommerceUat(form:FormData) {
 if(!commerceUatLoginEnabled())throw new Error('Preview test sign-in unavailable')
 const credentials=passwordCredentials(form,true)
 if(!credentials || !('email' in credentials))redirect('/commerce-uat/login?error=Enter+a+test+email+and+password')
 const db=await createClient()
 const {error}=await db.auth.signInWithPassword(credentials)
 const authorization=error?null:await db.rpc('commerce_uat_session_active')
 if(error || authorization?.error || authorization?.data!==true){
  await db.auth.signOut()
  redirect('/commerce-uat/login?error=Test+email+or+password+was+not+accepted,+or+test+access+has+expired')
 }
 redirect('/account')
}
