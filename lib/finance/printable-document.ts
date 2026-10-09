export type PrintableRecord = {
 kind:'purchase_order'|'supplier_bill'
 code:string; supplier:string; product:string; quantity:number; unitPrice:number; amount:number
 status:string; reference?:string; date?:string
}
export function escapeDocument(value:unknown):string {
 return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))
}
export function renderFinanceDocument(d:PrintableRecord):string {
 if(!['purchase_order','supplier_bill'].includes(d.kind)||!Number.isSafeInteger(d.quantity)||d.quantity<=0||
 !Number.isFinite(d.unitPrice)||d.unitPrice<=0||!Number.isFinite(d.amount)||Math.abs(d.amount-d.quantity*d.unitPrice)>.02)
 throw new Error('Invalid document transaction')
 const e=escapeDocument
 const bill=d.kind==='supplier_bill'
 const label=bill?'SUPPLIER BILL REGISTER':'PURCHASE ORDER'
 const note=bill?'INTERNAL REGISTER COPY — Not a supplier-issued tax invoice. Verify original supplier invoice evidence.':'INTERNAL PURCHASE ORDER — Validity and approval subject to recorded workflow status.'
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'+
 '<title>'+e(label)+' '+e(d.code)+'</title><style>body{font-family:Arial,sans-serif;color:#142a34;margin:35px auto;max-width:780px;padding:15px}h1{color:#076663}header{border-bottom:3px solid #076663;padding-bottom:14px}.muted{color:#52636d}table{width:100%;border-collapse:collapse;margin:25px 0}th,td{border:1px solid #a8b8bd;padding:12px;text-align:left}th{background:#ecf7f5}footer{border-top:1px solid #ccc;padding-top:16px;font-size:12px}.action{background:#076663;color:white;padding:10px 16px;border:0;border-radius:6px;cursor:pointer}@media print{.actions{display:none}body{margin:0;max-width:none}}</style></head><body>'+
 '<div class="actions"><button class="action" onclick="window.print()">Print / Save as PDF</button> <span class="muted">For file fallback, print to PDF and retain a signed copy as evidence.</span></div>'+
 '<header><strong>2-TAKA-R-BAZAR</strong><p>Smart shopping. Real savings!</p><h1>'+e(label)+'</h1><p>Document '+e(d.code)+' · Status: '+e(d.status.toUpperCase())+'</p></header>'+
 '<p><strong>Supplier:</strong> '+e(d.supplier)+'</p><p><strong>Product:</strong> '+e(d.product)+'</p>'+
 (bill?'<p><strong>Supplier invoice reference:</strong> '+e(d.reference)+'</p>':'')+
 (d.date?'<p><strong>Invoice date:</strong> '+e(d.date)+'</p>':'')+
 '<table><thead><tr><th>Item</th><th>Units</th><th>Unit cost (BDT)</th><th>Total (BDT)</th></tr></thead><tbody><tr><td>'+e(d.product)+'</td><td>'+e(d.quantity)+'</td><td>'+e(d.unitPrice.toFixed(2))+'</td><td>'+e(d.amount.toFixed(2))+'</td></tr></tbody></table>'+
 '<p><strong>Total BDT '+e(d.amount.toFixed(2))+'</strong></p>'+
 '<footer><p>'+e(note)+'</p><p>Document values reflect the authorized system record at printing. Keep the original uploaded evidence and approval trail.</p><p>Manually signed by: _________________________ Date: ______________</p></footer></body></html>'
}
