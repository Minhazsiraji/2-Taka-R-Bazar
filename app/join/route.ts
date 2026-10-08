import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  COMMUNITY_QR_CODE_COOKIE,
  COMMUNITY_QR_COOKIE_MAX_AGE,
  COMMUNITY_QR_SCAN_COOKIE,
  COMMUNITY_QR_SOURCE_COOKIE,
  normalizeCommunityQrCode,
  normalizeCommunityQrSource,
} from '@/lib/community-qr'

export const dynamic='force-dynamic'

export async function GET(request:NextRequest){
  const url=request.nextUrl
  const code=normalizeCommunityQrCode(url.searchParams.get('community'))
  const source=normalizeCommunityQrSource(url.searchParams.get('source'))

  if(!code){
    return NextResponse.redirect(new URL('/?qr_error=missing',url))
  }

  const existingCode=normalizeCommunityQrCode(request.cookies.get(COMMUNITY_QR_CODE_COOKIE)?.value)
  const existingToken=request.cookies.get(COMMUNITY_QR_SCAN_COOKIE)?.value
  if(existingCode===code&&existingToken){
    const response=NextResponse.redirect(new URL('/community-invite/'+encodeURIComponent(code),url))
    response.cookies.set(COMMUNITY_QR_SOURCE_COOKIE,source,{httpOnly:true,sameSite:'lax',secure:url.protocol==='https:',maxAge:COMMUNITY_QR_COOKIE_MAX_AGE,path:'/'})
    return response
  }

  const supabase=await createClient()
  const {data,error}=await supabase.rpc('register_community_qr_scan',{p_code:code,p_source:source})
  const row=Array.isArray(data)?data[0]:null

  if(error||!row?.scan_token){
    console.warn('Community QR scan rejected',{code,error:error?.message})
    return NextResponse.redirect(new URL('/?qr_error=invalid',url))
  }

  const response=NextResponse.redirect(new URL('/community-invite/'+encodeURIComponent(code),url))
  const secure=url.protocol==='https:'
  response.cookies.set(COMMUNITY_QR_CODE_COOKIE,code,{httpOnly:true,sameSite:'lax',secure,maxAge:COMMUNITY_QR_COOKIE_MAX_AGE,path:'/'})
  response.cookies.set(COMMUNITY_QR_SCAN_COOKIE,String(row.scan_token),{httpOnly:true,sameSite:'lax',secure,maxAge:COMMUNITY_QR_COOKIE_MAX_AGE,path:'/'})
  response.cookies.set(COMMUNITY_QR_SOURCE_COOKIE,source,{httpOnly:true,sameSite:'lax',secure,maxAge:COMMUNITY_QR_COOKIE_MAX_AGE,path:'/'})
  return response
}
