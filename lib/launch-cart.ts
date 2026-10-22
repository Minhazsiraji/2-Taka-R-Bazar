'use client'
export type LaunchCartItem={product_id:string;quantity:number;offer_id?:string}
const key='2tbr-launch-cart-v1'
export function readLaunchCart():LaunchCartItem[]{
 try{const rows=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(rows)?rows.filter(x=>typeof x.product_id==='string'&&/^[0-9a-f-]{36}$/i.test(x.product_id)&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=100&&(!x.offer_id||typeof x.offer_id==='string'&&/^[0-9a-f-]{36}$/i.test(x.offer_id))).slice(0,6):[]}catch{return []}
}
export function writeLaunchCart(rows:LaunchCartItem[]){localStorage.setItem(key,JSON.stringify(rows));window.dispatchEvent(new Event('2tbr-cart-updated'))}
export function addLaunchItem(product_id:string,offer_id?:string){addLaunchItems([{product_id,offer_id,quantity:1}])}
/** One selection per master product. Switching offer replaces that product's prior selection. */
export function addLaunchItems(incoming:LaunchCartItem[]){
 const rows=readLaunchCart()
 if(new Set([...rows,...incoming].map(i=>i.product_id)).size>6)return false
 for(const line of incoming){
  const index=rows.findIndex(x=>x.product_id===line.product_id),prior=rows[index]
  const quantity=Math.min(100,Math.max(1,line.quantity)+(prior?.offer_id===line.offer_id?(prior?.quantity??0):0))
  const item={product_id:line.product_id,quantity,...(line.offer_id?{offer_id:line.offer_id}:{})}
  if(index>=0)rows[index]=item;else if(rows.length<6)rows.push(item)
 }
 writeLaunchCart(rows)
 return true
}
