/**
 * Browsing is intentionally open before community selection.
 * Once selected, only offers published for that community may be listed;
 * the backend independently verifies eligibility before any order.
 */
export function browseCatalogOffers(offers,{area='',mode='all',category='all',search=''}={}){
 if(!Array.isArray(offers))return []
 const term=String(search??'').trim().toLocaleLowerCase()
 const matching=offers.filter(offer=>
  (!area||(offer.community_ids??[offer.community_id]).includes(area))&&
  (mode==='all'||(mode==='group'?offer.offer_kind==='GROUP_DEAL':offer.offer_kind==='COMMUNITY_POOL'))&&
  (category==='all'||offer.category===category)&&
  [offer.product_name,offer.product_name_bn,offer.category,offer.category_bn,offer.brand,offer.offer_title]
    .join(' ').toLocaleLowerCase().includes(term)
 )
 // If the same SKU has multiple eligible offers, present one product card.
 // Offer choice and verified server pricing live on the product details.
 const seen=new Set()
 return matching.filter(offer=>{
  const id=offer.product_id||offer.offer_id
  if(!id||seen.has(id))return false
  seen.add(id)
  return true
 })
}
