'use server'
import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'
import {requireAdmin} from '@/lib/auth'

const validUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const inventory='/admin/inventory'
const err=(message:string):never=>redirect(inventory+'?error='+encodeURIComponent(message))

export async function updatePilotInventoryAvailability(formData:FormData){
 const {supabase}=await requireAdmin()
 const productId=String(formData.get('product_id')??'')
 const expected=String(formData.get('expected_quantity')??'')
 const quantity=String(formData.get('available_quantity')??'')
 const reason=String(formData.get('reason')??'').trim()
 if(!validUuid.test(productId))err('Choose a valid published supplier product.')
 if(!/^\d{1,6}$/.test(expected)||!/^\d{1,6}$/.test(quantity)||
    Number(quantity)>100000)err('Enter a non-negative available quantity up to 100,000.')
 if(reason.length<8||reason.length>300)err('Explain the stock change in 8–300 characters.')
 const {error}=await supabase.rpc('admin_set_pilot_listing_availability',{
  p_product_id:productId,p_expected_quantity:Number(expected),
  p_available_quantity:Number(quantity),p_reason:reason
 })
 if(error){
  if(/Availability changed since loading/i.test(error.message))
   err('Another order or administrator changed availability. Refresh to see the latest quantity before saving.')
  if(/no approved pilot supplier listing/i.test(error.message))
   err('This product has no approved supplier listing. Set up the supplier offer first.')
  err('Availability was not updated. Refresh and check your administrator permissions.')
 }
 revalidatePath('/admin/inventory')
 revalidatePath('/admin/offers')
 revalidatePath('/admin/order-tracking')
 revalidatePath('/cart')
 redirect(inventory+'?notice='+encodeURIComponent('Pilot availability updated and audit reason recorded. Locked customer prices and existing orders were not changed.'))
}
