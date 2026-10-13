import {createHash,randomUUID} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
export async function uploadFinanceOriginal(client:SupabaseClient,actor:string,file:FormDataEntryValue|null){
 if(!(file instanceof File)||file.size<=0||file.size>1_500_000)throw new Error('Original PDF/JPEG/PNG up to 1.5 MB required')
 const ext:Record<string,string>={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'}
 const suffix=ext[file.type];if(!suffix)throw new Error('Unsupported original document format')
 const bytes=Buffer.from(await file.arrayBuffer()),magic=bytes.subarray(0,8).toString('hex')
 if(!(suffix==='pdf'&&bytes.subarray(0,5).toString('ascii')==='%PDF-'||suffix==='jpg'&&magic.startsWith('ffd8ff')||suffix==='png'&&magic.startsWith('89504e470d0a1a0a')))throw new Error('Original bytes do not match file format')
 const path=actor+'/'+randomUUID()+'.'+suffix,hash=createHash('sha256').update(bytes).digest('hex')
 const {error}=await client.storage.from('finance-evidence').upload(path,bytes,{contentType:file.type,upsert:false})
 if(error)throw new Error('Original evidence upload failed: '+error.message)
 return {path,hash}
}
