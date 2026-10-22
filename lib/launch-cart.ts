'use client'
export type LaunchCartItem={product_id:string;quantity:number}
const key='2tbr-launch-cart-v1'
export function readLaunchCart():LaunchCartItem[]{
 try{const rows=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(rows)?rows.filter(x=>typeof x.product_id==='string'&&/^[0-9a-f-]{36}$/i.test(x.product_id)&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=100).slice(0,6):[]}catch{return []}
}
export function writeLaunchCart(rows:LaunchCartItem[]){localStorage.setItem(key,JSON.stringify(rows));window.dispatchEvent(new Event('2tbr-cart-updated'))}
export function addLaunchItem(product_id:string){const rows=readLaunchCart();const item=rows.find(x=>x.product_id===product_id);if(item)item.quantity=Math.min(100,item.quantity+1);else rows.push({product_id,quantity:1});writeLaunchCart(rows)}
