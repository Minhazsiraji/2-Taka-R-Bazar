import {NextResponse} from 'next/server'
import {requireAdmin} from '@/lib/auth'
import {verifyOriginal} from '@/lib/finance/original-integrity'
export const dynamic='force-dynamic'
export async function GET(_request:Request,{params}:{params:Promise<{kind:string;id:string}>}){
 const {supabase}=await requireAdmin();const {kind,id}=await params
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||!['customer_event','supplier_credit_note','cash_transaction','attachment','bill'].includes(kind))return new NextResponse('Invalid original',{status:400})
 const {data,error}=await supabase.rpc('finance_original_descriptor',{p_kind:kind,p_id:id})
 if(error||!data)return new NextResponse('Original not found',{status:404})
 const record=data as {path:string;sha256:string}
 const {data:file,error:failed}=await supabase.storage.from('finance-evidence').download(record.path)
 if(failed||!file)return new NextResponse('Original unavailable',{status:404})
 const bytes=await file.arrayBuffer()
 if(!verifyOriginal(bytes,record.sha256))return new NextResponse('Original evidence integrity failed',{status:409})
 const type=file.type,ext=type==='application/pdf'?'pdf':type==='image/png'?'png':type==='image/jpeg'?'jpg':null
 if(!ext)return new NextResponse('Unsupported original format',{status:415})
 return new NextResponse(bytes,{headers:{'Content-Type':type,'Content-Disposition':`attachment; filename="${kind}-${id}.${ext}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
}
