// Keep post-OTP navigation strictly within internal customer-facing routes.
const ALLOWED=new Set(['/group-deals','/pool','/shop','/home','/cart','/checkout','/account'])
export function safeAuthReturnPath(value:string|null|undefined){
 const raw=String(value??'').trim()
 if(!raw.startsWith('/')||raw.startsWith('//')||raw.includes('\\')||raw.includes('#')||raw.length>100)return null
 try{
  const url=new URL(raw,'https://2takarbazar.com')
  if(url.origin!=='https://2takarbazar.com')return null
  return ALLOWED.has(url.pathname)?url.pathname:null
 }catch{return null}
}
