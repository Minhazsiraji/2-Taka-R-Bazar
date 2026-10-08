import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { communityJoinUrl, normalizeCommunityQrCode, normalizeCommunityQrSource } from '@/lib/community-qr'

export const dynamic='force-dynamic'

export async function GET(request:Request,{params}:{params:Promise<{code:string}>}){
  const {code:rawCode}=await params
  const code=normalizeCommunityQrCode(rawCode)
  const url=new URL(request.url)
  const source=normalizeCommunityQrSource(url.searchParams.get('source'))
  if(!code)return new Response('Invalid QR code',{status:404})

  const supabase=await createClient()
  const {data,error}=await supabase.rpc('get_public_community_qr',{p_code:code})
  const row=Array.isArray(data)?data[0]:null
  if(error||!row)return new Response('QR code not found',{status:404})

  const target=communityJoinUrl(code,source)
  const svg=await QRCode.toString(target,{
    type:'svg',
    errorCorrectionLevel:'H',
    margin:2,
    width:900,
    color:{dark:'#071827',light:'#FFFFFF'},
  })

  const headers=new Headers({
    'Content-Type':'image/svg+xml; charset=utf-8',
    'Cache-Control':'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    'X-Content-Type-Options':'nosniff',
    'X-Robots-Tag':'noindex, noimageindex, noarchive',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'",
  })
  if(url.searchParams.get('download')==='1'){
    headers.set('Content-Disposition','attachment; filename="'+code+'-community-qr.svg"')
  }
  return new Response(svg,{headers})
}
