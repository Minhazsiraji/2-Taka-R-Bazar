import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {createHash} from 'node:crypto'
const {uploadFinanceOriginal}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(readFileSync('lib/finance/upload-original.ts','utf8'),{mode:'strip'})).toString('base64'))
const actor='00000000-0000-4000-8000-000000000057'
function storage(error=null){const calls=[];return {calls,client:{storage:{from:bucket=>({upload:async(path,bytes,options)=>{calls.push({bucket,path,bytes,options});return {error}}})}}}}
test('original upload preserves exact bytes/hash and cannot overwrite a file',async()=>{
 for(const [mime,bytes] of [['application/pdf',Buffer.from('%PDF-1.4\nSynthetic\n%%EOF')],['image/jpeg',Buffer.from('ffd8ff0102','hex')],['image/png',Buffer.from('89504e470d0a1a0a01','hex')]]){
  const s=storage(),r=await uploadFinanceOriginal(s.client,actor,new File([bytes],'original',{type:mime}))
  assert.equal(s.calls.length,1);assert.equal(s.calls[0].bucket,'finance-evidence');assert.equal(s.calls[0].options.upsert,false)
  assert.deepEqual(s.calls[0].bytes,bytes);assert.ok(r.path.startsWith(actor+'/'))
  assert.equal(r.hash,createHash('sha256').update(bytes).digest('hex'))
 }
})
test('forged MIME, unsupported documents and empty evidence never reach storage',async()=>{
 const s=storage()
 for(const file of [null,new File([],'empty.pdf',{type:'application/pdf'}),new File(['<script>bad</script>'],'forged.pdf',{type:'application/pdf'}),new File(['%PDF-1.4'],'fake.png',{type:'image/png'}),new File(['document'],'unsafe.html',{type:'text/html'})])await assert.rejects(uploadFinanceOriginal(s.client,actor,file))
 assert.equal(s.calls.length,0)
})
test('oversized original evidence is rejected before upload',async()=>{
 const s=storage();await assert.rejects(uploadFinanceOriginal(s.client,actor,new File([new Uint8Array(1_500_001)],'large.pdf',{type:'application/pdf'})),/1.5 MB/);assert.equal(s.calls.length,0)
})
test('storage failure cannot return a successful original descriptor',async()=>{
 const s=storage({message:'Synthetic storage unavailable'})
 await assert.rejects(uploadFinanceOriginal(s.client,actor,new File(['%PDF-1.4'],'original.pdf',{type:'application/pdf'})),/Original evidence upload failed/)
 assert.equal(s.calls.length,1)
})
