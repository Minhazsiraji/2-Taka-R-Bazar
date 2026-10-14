// Bilingual customer copy; CommerceContent applies the persisted language.
export function orderStatusLabel(status:string,method?:string){
 const labels:Record<string,string>={awaiting_supplier:'সরবরাহকারীর সম্মতির অপেক্ষায় / Awaiting supplier acceptance',confirmed:'নিশ্চিত / Confirmed',preparing:'প্রস্তুত হচ্ছে / Preparing',out_for_delivery:'ডেলিভারির পথে / Out for delivery',ready_for_pickup:'সংগ্রহের জন্য প্রস্তুত / Ready for pickup',completed:method==='pickup'?'সংগ্রহ করা হয়েছে / Collected':'ডেলিভারি হয়েছে / Delivered',cancelled:'বাতিল / Cancelled'}
 return labels[status]??status
}
export function paymentStatusLabel(status:string){
 const labels:Record<string,string>={unpaid:'বকেয়া / Unpaid',custody_recorded:'COD সংগ্রহ হয়েছে; যাচাই বাকি / COD collected; verification pending',verified:'পেমেন্ট যাচাইকৃত / Payment verified',refund_pending:'টাকা ফেরত বাকি / Refund pending',partially_refunded:'আংশিক টাকা ফেরত হয়েছে / Partially refunded',refunded:'টাকা ফেরত হয়েছে / Refunded'}
 return labels[status]??status
}
