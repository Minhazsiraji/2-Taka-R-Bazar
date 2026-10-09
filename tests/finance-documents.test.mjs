import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const source=stripTypeScriptTypes(readFileSync('lib/finance/printable-document.ts','utf8'),{mode:'strip'})
const {renderFinanceDocument,escapeDocument}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
const sample={kind:'purchase_order',code:'PO-001',supplier:'Sample FMCG Ltd',product:'Rice 10 kg',quantity:12,unitPrice:950,amount:11400,status:'approved'}
test('print-ready PO contains exact supplier, quantities, BDT totals and browser PDF fallback',()=>{
 const html=renderFinanceDocument(sample)
 assert.match(html,/PO-001/)
 assert.match(html,/11400\.00/)
 assert.match(html,/Rice 10 kg/)
 assert.match(html,/Print \/ Save as PDF/)
 assert.match(html,/INTERNAL PURCHASE ORDER/)
})
test('manual original supplier invoice must not be confused with internal bill register',()=>{
 const html=renderFinanceDocument({...sample,kind:'supplier_bill',reference:'INV-2026-01'})
 assert.match(html,/Not a supplier-issued tax invoice/)
 assert.match(html,/INV-2026-01/)
})
test('untrusted document fields are safely escaped',()=>{
 assert.equal(escapeDocument('<script>"&</script>'),'&lt;script&gt;&quot;&amp;&lt;/script&gt;')
 const html=renderFinanceDocument({...sample,supplier:'<img src=x onerror=alert(1)>'})
 assert.doesNotMatch(html,/<img src=x/)
 assert.match(html,/&lt;img/)
})
test('reject inconsistent or nonfinite financial amounts',()=>{
 assert.throws(()=>renderFinanceDocument({...sample,amount:11401}),/Invalid document/)
 assert.throws(()=>renderFinanceDocument({...sample,unitPrice:Infinity}),/Invalid document/)
 assert.throws(()=>renderFinanceDocument({...sample,quantity:0}),/Invalid document/)
})
test('private evidence download requires authenticated finance workbench and original bucket',()=>{
 const route=readFileSync('app/api/finance/documents/[kind]/[id]/route.ts','utf8')
 assert.match(route,/requireAdmin\(\)/)
 assert.match(route,/procurement_workbench/)
 assert.match(route,/storage\.from\('finance-evidence'\)\.download/)
 assert.match(route,/no-store/)
 assert.match(route,/nosniff/)
})
