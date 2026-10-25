'use server'
import {redirect} from 'next/navigation'
import {requireUser} from '@/lib/auth'
export async function requestAccountDeletion(){
 const {supabase}=await requireUser()
 const {data,error}=await supabase.rpc('request_my_account_deletion')
 if(error||!data)redirect('/account/delete?error='+encodeURIComponent('Could not record deletion request. Please retry.'))
 redirect('/account/delete?requested=1')
}
