import {NextResponse} from 'next/server'
import {requireAdmin} from '@/lib/auth'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 const {supabase}=await requireAdmin()
 const {id}=await context.params
 if(!uuid.test(id))return new NextResponse('Invalid attachment',{status:400})
 const {data:path,error}=await supabase.rpc('finance_attachment_download_path',{p_id:id})
 if(error||!path)return new NextResponse('Attachment not found',{status:404})
 const {data:file,error:failed}=await supabase.storage.from('finance-evidence').download(path)
 if(failed||!file)return new NextResponse('Evidence unavailable',{status:404})
 const type=file.type
 if(!['application/pdf','image/jpeg','image/png'].includes(type))return new NextResponse('Unsupported file',{status:415})
 const ext=type==='application/pdf'?'pdf':type==='image/png'?'png':'jpg'
 return new NextResponse(await file.arrayBuffer(),{headers:{
  'Content-Type':type,'Content-Disposition':'attachment; filename="finance-attachment-'+id+'.'+ext+'"',
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
 }})
}
