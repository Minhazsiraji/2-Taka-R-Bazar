import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const {verifyOriginal}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(readFileSync('lib/finance/original-integrity.ts','utf8'),{mode:'strip'})).toString('base64'))
const original=new TextEncoder().encode('%PDF-1.4\nSynthetic signed invoice\n%%EOF').buffer
const hash=createHash('sha256').update(Buffer.from(original)).digest('hex')
test('original document integrity accepts exactly the original bytes',()=>assert.equal(verifyOriginal(original,hash),true))
test('original document integrity rejects a modified or truncated file',()=>{
 assert.equal(verifyOriginal(new TextEncoder().encode('%PDF-1.4\nModified invoice').buffer,hash),false)
 assert.equal(verifyOriginal(original.slice(0,10),hash),false)
})
test('missing or malformed fingerprints cannot certify originals',()=>{
 for(const invalid of [null,undefined,'',hash.toUpperCase(),'g'.repeat(64),hash.slice(1)])assert.equal(verifyOriginal(original,invalid),false)
})
