import { NextRequest,NextResponse } from 'next/server'
import { renderFinancePdf } from '@/lib/finance/printable-pdf'
import { requireAdmin } from '@/lib/auth'
import { renderFinanceDocument, type PrintableRecord } from '@/lib/finance/printable-document'

export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request:NextRequest,context:{params:Promise<{kind:string;id:string}>}){
 const {supabase}=await requireAdmin()
 const {kind,id}=await context.params
 if(!uuid.test(id)||!['po','bill','proof'].includes(kind)) return new NextResponse('Invalid document',{status:400})
 const {data,error}=await supabase.rpc('procurement_workbench')
 if(error)return new NextResponse('Document access unavailable',{status:503})
 const record=data as {purchase_orders?:Array<Record<string,unknown>>;bills?:Array<Record<string,unknown>>}
 const bill=record.bills?.find(x=>x.id===id)
 const po=record.purchase_orders?.find(x=>x.id===(kind==='po'?id:bill?.po_id))
 if(kind==='proof'){
  if(!bill||typeof bill.evidence_path!=='string'||!bill.evidence_path) return new NextResponse('Evidence not found',{status:404})
  const {data:file,error:downloadError}=await supabase.storage.from('finance-evidence').download(bill.evidence_path)
  if(downloadError||!file)return new NextResponse('Private proof unavailable',{status:404})
  const buf=await file.arrayBuffer()
  const type=file.type
  if(!['application/pdf','image/jpeg','image/png'].includes(type))return new NextResponse('Unsupported proof format',{status:415})
  const extension=type==='application/pdf'?'pdf':type==='image/png'?'png':'jpg'
  return new NextResponse(buf,{headers:{
   'Content-Type':type,
   'Content-Disposition':'attachment; filename="supplier-proof-'+id+'.'+extension+'"',
   'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
  }})
 }
 if(!po||(kind==='bill'&&!bill))return new NextResponse('Document not found or outside current workbench',{status:404})
 const d:PrintableRecord=kind==='po'?{
  kind:'purchase_order',code:String(po.code),supplier:String(po.supplier),product:String(po.product),
  quantity:Number(po.quantity),unitPrice:Number(po.unit_cost),amount:Number(po.value),status:String(po.status)
 }:{
  kind:'supplier_bill',code:String(bill?.ref),supplier:String(bill?.vendor),product:String(po.product),
  quantity:Number(bill?.quantity),unitPrice:Number(bill?.amount)/Number(bill?.quantity),
  amount:Number(bill?.amount),status:String(bill?.status),reference:String(bill?.ref)
 }
 try{
  const download=request.nextUrl.searchParams.get('download')==='1'
  if(download){
   const pdf=renderFinancePdf(d)
   return new NextResponse(new Uint8Array(pdf),{headers:{
    'Content-Type':'application/pdf',
    'Content-Disposition':'attachment; filename="'+kind+'-'+d.code.replace(/[^a-zA-Z0-9-]/g,'_')+'.pdf"',
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
   }})
  }
  const html=renderFinanceDocument(d)
  return new NextResponse(html,{headers:{
   'Content-Type':'text/html; charset=utf-8',
   'Content-Disposition':'inline',
   'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
   'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
  }})
 }catch{return new NextResponse('Document data validation failed',{status:422})}
}
