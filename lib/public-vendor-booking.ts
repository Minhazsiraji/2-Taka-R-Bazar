/** Public, owner-authorized browse-only listings.
 * No vendor purchase cost, private audit metadata, stock quantity or Finance details.
 * Selling price is an indicative pilot booking quote subject to staff confirmation.
 */
export type PublicVendorBookingProduct={
 product_id:string
 name:string
 category:string
 package_size:string
 image_url:string|null
 approved_unit_price:number
 supplier_name:string
 supplier_handover_days:number
}
