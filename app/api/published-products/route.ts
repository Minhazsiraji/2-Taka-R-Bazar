import {NextResponse,type NextRequest} from 'next/server'
import {loadPublishedCatalogPage} from '@/lib/published-product-catalog-feed'

export const dynamic='force-dynamic'
export async function GET(request:NextRequest){
 const raw=request.nextUrl.searchParams.get('offset')??'0'
 // Guard against negative, nonsensical and excessively large offset inputs.
 if(!/^(0|[1-9]\d{0,6})$/.test(raw)){
  return NextResponse.json({error:'Invalid catalog offset'},{status:400,headers:{'Cache-Control':'no-store'}})
 }
 const page=await loadPublishedCatalogPage(Number(raw))
 if(page.unavailable){
  return NextResponse.json({error:'Published product catalog unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})
 }
 return NextResponse.json(page,{headers:{'Cache-Control':'no-store'}})
}
