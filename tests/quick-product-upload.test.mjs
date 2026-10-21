import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import {resolve} from 'node:path'
import {quickProductPayload} from '../lib/quick-product-input.mjs'
import {validateProductImage,PRODUCT_IMAGE_BUCKET} from '../lib/product-image.mjs'

const require=createRequire(import.meta.url)
const swc=require('next/dist/build/swc')
await swc.loadBindings()
const source=readFileSync(resolve('app/actions/quick-product.ts'),'utf8')

class FakeFile{
 constructor(bytes,type){this.bytes=bytes;this.type=type;this.size=bytes.byteLength}
 async arrayBuffer(){return this.bytes.buffer.slice(this.bytes.byteOffset,this.bytes.byteOffset+this.bytes.byteLength)}
}

function setup({insertError=null,authError=null}={}){
 const calls={writes:[],uploads:[],removals:[],paths:[]}
 const storage={
  upload:async(path,bytes,opts)=>{calls.uploads.push({path,bytes,opts});return {error:null}},
  getPublicUrl:path=>({data:{publicUrl:'https://example.supabase.co/storage/v1/object/public/product-images/'+path}}),
  remove:async paths=>{calls.removals.push(...paths);return {error:null}},
 }
 const supabase={
  storage:{from:bucket=>{assert.equal(bucket,PRODUCT_IMAGE_BUCKET);return storage}},
  from:table=>{
   assert.equal(table,'products')
   return {insert:payload=>{
    calls.writes.push(payload)
    return {select:fields=>{
     assert.equal(fields,'id,sku')
     return {single:async()=>insertError?{data:null,error:insertError}:{data:{id:'11111111-1111-4111-8111-111111111111',sku:payload.sku},error:null}}
    }}
   }}
  },
 }
 const mocks={
  'node:crypto':require('node:crypto'),
  'next/cache':{revalidatePath:path=>calls.paths.push(path)},
  '@/lib/auth':{requireAdmin:async()=>{
   if(authError)throw authError
   return {supabase,user:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},roles:new Set(['admin'])}
  }},
  '@/lib/quick-product-input.mjs':{quickProductPayload},
  '@/lib/product-image.mjs':{validateProductImage,PRODUCT_IMAGE_BUCKET},
 }
 return {mocks,calls}
}
async function action(mocks){
 const filename=resolve('app/actions/quick-product.ts')
 const {code}=await swc.transform(source,{
  filename,jsc:{parser:{syntax:'typescript',tsx:false}},module:{type:'commonjs'},
 })
 const exports={}
 vm.runInNewContext(code,{
  exports,require:name=>name in mocks?mocks[name]:require(name),
  File:FakeFile,Uint8Array,console,process:{env:{NODE_ENV:'test'}},
 })
 return exports.createQuickProduct
}
const baseline={
 name:'Chinigura Rice',category:'Rice & Grains',sku:'rice-chini-1kg',
 unit:'kg',package_size:'1 kg',brand:'',source_type:'SUPPLIER_POOL',
}
const fd=(fields=baseline)=>({get:key=>fields[key]??null})

test('Quick Product requires only master fields and never invents price, stock, SEO or offers',()=>{
 const parsed=quickProductPayload(baseline)
 assert.equal(parsed.ok,true)
 assert.equal(parsed.payload.sku,'RICE-CHINI-1KG')
 assert.equal(parsed.payload.brand_type,'UNBRANDED_LOOSE')
 assert.equal(parsed.payload.active,true)
 assert.equal(parsed.payload.is_demo,false)
 assert.deepEqual(Object.keys(parsed.payload).sort(),[
  'name','brand','category','package_size','unit','sku','source_type','brand_type','is_demo','active'
 ].sort())
 assert.equal(quickProductPayload({...baseline,brand:'Fresh'}).payload.brand_type,'SUPPLIER_BRAND')
 assert.equal(quickProductPayload({...baseline,brand:'2TBR'}).ok,false)
 assert.equal(quickProductPayload({...baseline,source_type:'EXCLUSIVE_PARTNER'}).ok,true)
 for(const changed of [
  {...baseline,sku:'x'},
  {...baseline,category:''},
  {...baseline,source_type:'PRIVATE_LABEL'},
  {...baseline,name:''},
 ]){
  assert.equal(quickProductPayload(changed).ok,false)
 }
})

test('Quick Product action creates an active master without SEO RPC or payment writes',async()=>{
 const {mocks,calls}=setup()
 const result=await (await action(mocks))(fd())
 assert.equal(result.ok,true)
 assert.equal(result.sku,'RICE-CHINI-1KG')
 assert.equal(calls.writes.length,1)
 assert.equal(calls.writes[0].image_url,null)
 assert.equal(calls.writes[0].active,true)
 assert.equal(calls.writes[0].is_demo,false)
 assert.ok(calls.paths.includes('/admin/products'))
 assert.equal(calls.uploads.length,0)
})

test('Invalid SKU, duplicates and unauthorized roles never create extra product records',async()=>{
 const a=setup()
 const run=await action(a.mocks)
 const invalid=await run(fd({...baseline,sku:'bad sku'}))
 assert.equal(invalid.ok,false)
 assert.equal(invalid.field,'sku')
 assert.equal(a.calls.writes.length,0)
 const b=setup({insertError:{code:'23505',message:'unique constraint'}})
 const duplicate=await (await action(b.mocks))(fd())
 assert.equal(duplicate.ok,false)
 assert.equal(duplicate.field,'sku')
 assert.match(duplicate.message,/archived/)
 const c=setup({authError:new Error('Not authorized')})
 await assert.rejects((await action(c.mocks))(fd()),/Not authorized/)
 assert.equal(c.calls.writes.length,0)
})

test('Optional image is magic-byte validated before upload and cleaned up if insert fails',async()=>{
 const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,0])
 const good=setup()
 const input=fd({...baseline,image_file:new FakeFile(png,'image/png')})
 const ok=await (await action(good.mocks))(input)
 assert.equal(ok.ok,true)
 assert.equal(good.calls.uploads.length,1)
 assert.match(good.calls.writes[0].image_url,/product-images/)
 const invalid=setup()
 const bad=await (await action(invalid.mocks))(fd({...baseline,image_file:new FakeFile(new Uint8Array([1,2,3]),'image/png')}))
 assert.equal(bad.ok,false)
 assert.equal(invalid.calls.uploads.length,0)
 assert.equal(invalid.calls.writes.length,0)
 const failed=setup({insertError:{code:'23505',message:'duplicate'}})
 const res=await (await action(failed.mocks))(input)
 assert.equal(res.ok,false)
 assert.equal(failed.calls.removals.length,1)
})
test('Admin page defaults to the new one-step form and keeps archived product history read-only',()=>{
 const page=readFileSync('app/admin/products/page.tsx','utf8')
 const ui=readFileSync('components/admin-quick-product-form.tsx','utf8')
 assert.match(page,/AdminQuickProductForm/)
 assert.doesNotMatch(page,/AdminProductCreateWizard/)
 assert.match(page,/archived\?<p/)
 assert.match(ui,/SEO, AEO, GEO/)
 assert.match(ui,/ProductImageInput/)
 assert.match(ui,/sessionStorage/)
 assert.match(ui,/startTransition/)
 assert.match(ui,/router\.refresh/)
 assert.match(ui,/Save & activate product/)
 const server=source
 assert.doesNotMatch(server,/admin_create_product_with_seo|admin_review_product_seo|admin_submit_product_seo|service_role|skipBrowserRedirect/)
 assert.match(server,/requireAdmin\(\)/)
 assert.match(server,/\.insert\(/)
})
