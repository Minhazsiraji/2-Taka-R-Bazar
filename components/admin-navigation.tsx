'use client'
import Link from 'next/link'
import {usePathname} from 'next/navigation'

type Item={href:string;label:string;hint?:string}
const main:Item[]=[
 {href:'/admin',label:'Overview',hint:'Live priorities'},
 {href:'/admin/products',label:'Products',hint:'Upload or edit'},
 {href:'/admin/inventory',label:'Inventory',hint:'Vendor allocation'},
 {href:'/admin/offers',label:'Deals & Pools',hint:'Publish prices'},
 {href:'/admin/offer-settlement',label:'Settlement',hint:'Quotes & transfers'},
 {href:'/admin/order-tracking',label:'Order tracking',hint:'Every order lane'},
]
const daily:Item[]=[
 {href:'/admin/customers',label:'Customers'},
 {href:'/admin/deliveries',label:'Deliveries'},
 {href:'/admin/pickup-points',label:'Pickup points'},
 {href:'/admin/communities',label:'Communities'},
 {href:'/admin/notifications',label:'Notifications'},
 {href:'/admin/pilot-bookings',label:'Pilot bookings'},
]
const advanced:Item[]=[
 {href:'/admin/easy-business',label:'Legacy Easy Business'},
 {href:'/admin/own-products',label:'Own-product accounting'},
 {href:'/admin/market-prices',label:'Market prices'},
 {href:'/admin/suppliers',label:'Suppliers'},
 {href:'/admin/supply-control',label:'Supply control'},
 {href:'/admin/procurement',label:'Procurement'},
 {href:'/admin/treasury',label:'Treasury'},
 {href:'/admin/group-deals',label:'Legacy Group Deals'},
 {href:'/admin/pools',label:'Legacy Pool workflow'},
 {href:'/admin/commitments',label:'Legacy commitments'},
 {href:'/admin/orders',label:'Legacy orders'},
 {href:'/admin/launch-orders',label:'Direct-order approvals'},
 {href:'/admin/delivery-locations',label:'Delivery locations'},
 {href:'/admin/savings',label:'Savings'},
 {href:'/admin/feedback',label:'Feedback'},
 {href:'/admin/issues',label:'Issues'},
]
export const ADMIN_PRIMARY_LINKS=main
export function AdminNavigation(){
 const pathname=usePathname()
 const active=(href:string)=>href==='/admin'?pathname===href:pathname===href||pathname.startsWith(href+'/')
 const link=(item:Item)=>(
  <Link key={item.href} href={item.href} aria-current={active(item.href)?'page':undefined}
   className={'admin-nav-link '+(active(item.href)?'is-active':'')}>
   <span className="font-semibold">{item.label}</span>
   {item.hint&&<span className="admin-nav-hint">{item.hint}</span>}
  </Link>
 )
 return <nav aria-label="Admin operations" className="admin-nav grid gap-3">
  <div className="grid gap-1"><p className="admin-nav-eyebrow">Daily workflow</p>{main.map(link)}</div>
  <details className="admin-nav-details">
   <summary>Customers & delivery <span aria-hidden="true">▾</span></summary>
   <div className="mt-2 grid gap-1">{daily.map(link)}</div>
  </details>
  <details className="admin-nav-details">
   <summary>Advanced / legacy tools <span aria-hidden="true">▾</span></summary>
   <div className="mt-2 grid gap-1">{advanced.map(link)}</div>
  </details>
 </nav>
}
