'use client'

import {useState} from 'react'
import Link from 'next/link'
import type {PublicVendorBookingProduct} from '@/lib/public-vendor-booking'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import './home-card-preview.css'

/** Approved card presentation, with the existing vendor booking links and public data. */
export function VendorProductCard({product,language}:{product:PublicVendorBookingProduct;language:MarketplaceLanguage}){
 const [failed,setFailed]=useState(false)
 const bn=language==='bn'
 const href='/vendor-products/'+product.product_id
 return <article className="mhome-exclusive-card app-card-preview-product vendor-product-card">
  <div className="app-card-preview-product-main">
   <Link href={href} className="app-card-preview-product-image" aria-label={(bn?'দেখুন: ':'View ')+product.name}>
    {product.image_url&&!failed?<img src={product.image_url} alt={product.name} loading="lazy" decoding="async" onError={()=>setFailed(true)}/>:
     <span className="vendor-product-photo-fallback">2TBR · {bn?'ছবি আসছে':'Photo coming soon'}</span>}
   </Link>
   <div className="app-card-preview-copy">
    <h3><Link href={href}>{product.name}</Link></h3>
    <p className="app-card-preview-meta">{product.package_size}</p>
    <div className="app-card-preview-price"><strong>৳{Number(product.approved_unit_price).toLocaleString('en-BD')}</strong></div>
    <p className="app-card-preview-stock">{bn?'ভেন্ডরের কাছে':'Vendor-held'}</p>
    <p className="app-card-preview-stock">{bn?'নিশ্চিতকরণ সাপেক্ষে':'Subject to confirmation'}</p>
   </div>
  </div>
  <div className="app-card-preview-actions">
   <Link href={href}>{bn?'বিস্তারিত':'View details'}</Link>
   <Link className="app-card-preview-primary" href={'/pilot-book?product='+product.product_id}>{bn?'বুকিং অনুরোধ':'Request booking'} →</Link>
  </div>
 </article>
}
