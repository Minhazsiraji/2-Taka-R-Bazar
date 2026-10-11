import type {PrintableRecord} from './printable-document'

// Small dependency-free PDF writer for the one-line procurement workbench records.
// PDF Standard 14 fonts cover Latin-1, not Bengali. Do not misrepresent unsupported text.
function pdfText(value:unknown){
 return String(value??'').normalize('NFKD').replace(/[^\x20-\x7E]/g,'?')
  .replace(/[\\()]/g,'\\$&').slice(0,190)
}
function money(value:number){return 'BDT '+value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
export function renderFinancePdf(d:PrintableRecord):Buffer{
 if(!['purchase_order','supplier_bill'].includes(d.kind)||!Number.isSafeInteger(d.quantity)||d.quantity<1||
 !Number.isFinite(d.unitPrice)||d.unitPrice<=0||!Number.isFinite(d.amount)||
 Math.abs(d.amount-d.quantity*d.unitPrice)>.02)throw Error('Invalid document transaction')
 const bill=d.kind==='supplier_bill'
 const label=bill?'SUPPLIER BILL REGISTER':'PURCHASE ORDER'
 const lines:string[]=[]
 const draw=(x:number,y:number,size:number,text:string,bold=false)=>{
  // Explicitly reset fill color for every text operation: background rectangles must never tint subsequent text.
  lines.push('0.1 0.22 0.27 rg')
  lines.push('BT /'+(bold?'F2':'F1')+' '+size+' Tf 1 0 0 1 '+x+' '+y+' Tm ('+pdfText(text)+') Tj ET')
 }
 lines.push('0.1 0.22 0.27 rg')
 draw(45,783,14,'2-TAKA-R-BAZAR',true)
 draw(45,763,10,'Smart shopping. Real savings!')
 lines.push('0.03 0.4 0.39 rg')
 draw(45,719,24,label,true)
 lines.push('0.1 0.22 0.27 rg')
 draw(45,691,11,'Document: '+d.code+'  |  Status: '+d.status.toUpperCase())
 lines.push('0.03 0.4 0.39 RG 1.4 w 45 675 m 550 675 l S')
 draw(45,648,11,'Supplier: '+d.supplier,true)
 draw(45,625,11,'Product: '+d.product)
 if(bill)draw(45,602,10,'Supplier invoice reference: '+(d.reference||d.code))
 lines.push('0.87 0.93 0.92 rg 45 545 505 35 re f')
 lines.push('0.65 0.72 0.74 RG 0.7 w 45 510 505 70 re S 45 545 m 550 545 l S')
 draw(55,556,10,'Item',true);draw(315,556,10,'Units',true)
 draw(380,556,10,'Unit cost',true);draw(480,556,10,'Total',true)
 draw(55,523,10,d.product);draw(315,523,10,String(d.quantity))
 draw(380,523,10,d.unitPrice.toFixed(2));draw(480,523,10,d.amount.toFixed(2))
 draw(45,470,15,'Total: '+money(d.amount),true)
 lines.push('0.7 0.75 0.78 RG 0.7 w 45 452 m 550 452 l S')
 draw(45,427,9,bill?'INTERNAL REGISTER - Not a supplier-issued tax invoice.':'INTERNAL PO - Approval subject to recorded workflow status.')
 draw(45,407,9,'Keep original supplier evidence and the independent approval trail.')
 draw(45,374,10,'Manually signed by: _______________________   Date: _____________')
 draw(45,55,9,'2-TAKA-R-BAZAR | System record | Not valid as approval when SUBMITTED')
 const stream=lines.join('\n')+'\n'
 const objects=[
 '<< /Type /Catalog /Pages 2 0 R >>',
 '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
 '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
 '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
 '<< /Length '+Buffer.byteLength(stream,'latin1')+' >>\nstream\n'+stream+'endstream'
 ]
 let body='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
 const offsets=[0]
 for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(body,'latin1'));body+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n'}
 const xref=Buffer.byteLength(body,'latin1')
 body+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'
 for(const offset of offsets.slice(1))body+=String(offset).padStart(10,'0')+' 00000 n \n'
 body+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n'
 return Buffer.from(body,'latin1')
}
