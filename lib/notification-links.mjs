const origin='https://notifications.invalid'
const allowed=['/','/pool','/orders','/pickup','/notifications','/cart','/account','/group-deals']
export function safeNotificationHref(value){
 if(typeof value!=='string'||value.length>500||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020]/.test(value))return '/notifications'
 try{
  const url=new URL(value,origin)
  if(url.origin!==origin||!allowed.some(path=>url.pathname===path||(path!=='/'&&url.pathname.startsWith(path+'/'))))return '/notifications'
  return url.pathname+url.search+url.hash
 }catch{return '/notifications'}
}
