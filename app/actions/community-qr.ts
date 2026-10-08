'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import {
  COMMUNITY_QR_CODE_COOKIE,
  COMMUNITY_QR_SCAN_COOKIE,
  COMMUNITY_QR_SOURCE_COOKIE,
  normalizeCommunityQrCode,
} from '@/lib/community-qr'

function validUuid(value:string|undefined){
  return value&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)?value:null
}

export async function confirmCommunityQrJoin(formData:FormData){
  const code=normalizeCommunityQrCode(String(formData.get('community_code')??''))
  if(!code)redirect('/?qr_error=invalid')

  const {supabase,user}=await requireUser()
  const {data:qrRows,error:qrError}=await supabase.rpc('get_public_community_qr',{p_code:code})
  const qr=Array.isArray(qrRows)?qrRows[0]:null
  if(qrError||!qr)redirect('/?qr_error=invalid')

  const {data:profile}=await supabase.from('profiles').select('community_id,onboarding_completed_at,full_name,phone').eq('id',user.id).maybeSingle()
  if(!profile?.community_id||!profile.onboarding_completed_at||!profile.full_name||!profile.phone){
    redirect('/onboarding?notice='+encodeURIComponent('Complete your household profile to join '+qr.community_name))
  }
  if(profile.community_id!==qr.community_id){
    redirect('/community-invite/'+encodeURIComponent(code)+'?error='+encodeURIComponent('Your account already belongs to another community. Contact Operations if you need to move communities.'))
  }

  const store=await cookies()
  const scanToken=validUuid(store.get(COMMUNITY_QR_SCAN_COOKIE)?.value)
  const {error}=await supabase.rpc('complete_community_qr_conversion',{p_code:code,p_scan_token:scanToken})
  if(error){
    console.error('Community QR conversion failed',{code,message:error.message})
    redirect('/community-invite/'+encodeURIComponent(code)+'?error='+encodeURIComponent('We could not record the community join. Please try again.'))
  }

  store.delete(COMMUNITY_QR_CODE_COOKIE)
  store.delete(COMMUNITY_QR_SCAN_COOKIE)
  store.delete(COMMUNITY_QR_SOURCE_COOKIE)
  redirect('/home?notice='+encodeURIComponent('Welcome to '+qr.community_name+'. You can now browse active Pools and Group Deals.'))
}
