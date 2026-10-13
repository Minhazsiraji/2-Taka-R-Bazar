/**
 * Discovery is not eligibility. Public catalog search can show other areas,
 * but it must always prefer the selected community and avoid repeating an SKU.
 * Purchases remain server-validated and outside-community actions are gated in UI.
 */
export function browseCatalogOffers(offers,{area='',mode='all',category='all',search=''}={}){
 if(!Array.isArray(offers))return []
 const term=String(search??'').trim().toLocaleLowerCase()
 const matching=offers.filter(offer=>
  (mode==='all'||(mode==='group'?offer.offer_kind==='GROUP_DEAL':offer.offer_kind==='COMMUNITY_POOL'))&&
  (category==='all'||offer.category===category)&&
  [offer.product_name,offer.product_name_bn,offer.category,offer.category_bn,offer.brand,offer.offer_title]
    .join(' ').toLocaleLowerCase().includes(term)
 )
 const ordered=area
  ?[...matching.filter(o=>o.community_id===area),...matching.filter(o=>o.community_id!==area)]
  :matching
 const seen=new Set()
 return ordered.filter(offer=>{
  const id=offer.product_id||offer.offer_id
  if(!id||seen.has(id))return false
  seen.add(id)
  return true
 })
}
