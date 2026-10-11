'use server'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {revalidatePath} from 'next/cache'
const path='/uat-finance-reviewer'
const email='finance-uat-checker-20261011@example.invalid'
export async function signInFinanceUatReviewer(fd:FormData) {
 if(process.env.VERCEL_ENV!=='preview'||process.env.FINANCE_SHARED_DB_UAT_ENABLED!=='true'||process.env.FINANCE_WRITES_ENABLED!=='true') redirect('/login')
 const pass=String(fd.get('password')||'')
 if(pass.length<12)redirect(path+'?error=Invalid+test+password')
 const supabase=await createClient()
 const {data,error}=await supabase.auth.signInWithPassword({email,password:pass})
 if(error||data.user?.email!==email)redirect(path+'?error=UAT+reviewer+sign-in+failed')
 revalidatePath('/','layout')
 redirect('/super-admin/treasury?demo=0')
}
