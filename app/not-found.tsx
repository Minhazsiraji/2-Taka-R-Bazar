import {CustomerHeader} from '@/components/customer-header'
import {CustomerFooter} from '@/components/customer-footer'
import Link from 'next/link'

export default function NotFound(){
 return <main className="public-marketplace-flat customer-page-shell min-h-screen">
  <CustomerHeader/>
  <section className="customer-page-content mx-auto max-w-4xl px-5 py-12">
   <h1 className="text-3xl font-black">Page unavailable</h1>
   <p className="mt-4">This page or offer is no longer available.</p>
   <Link href="/" className="btn-primary mt-6 inline-flex">Back to shopping</Link>
  </section>
  <CustomerFooter/>
 </main>
}
