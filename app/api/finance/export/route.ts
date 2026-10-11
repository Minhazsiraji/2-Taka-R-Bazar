import {NextRequest,NextResponse} from 'next/server'
import {requireSuperAdmin} from '@/lib/auth'
export const dynamic='force-dynamic'
export async function GET(request:NextRequest){
 const {supabase}=await requireSuperAdmin();const month=request.nextUrl.searchParams.get('month')??''
 if(!/^\d{4}-\d{2}$/.test(month))return new NextResponse('Valid accounting month required',{status:400})
 const after=request.nextUrl.searchParams.get('after')??'0';if(!/^\d{1,15}$/.test(after))return new NextResponse('Invalid audit cursor',{status:400})
 const [{data:report,error},{data:audit,error:auditError}]=await Promise.all([supabase.rpc('finance_integrated_report',{p_month:month+'-01'}),supabase.rpc('finance_audit_export',{p_month:month+'-01',p_after:Number(after)})])
 if(error||auditError)return new NextResponse('Export unavailable',{status:503})
 return new NextResponse(JSON.stringify({schema:'2tbr-finance-export-v1',report,audit},null,2),{headers:{'Content-Type':'application/json','Content-Disposition':`attachment; filename="finance-${month}-audit-after-${after}.json"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
}
