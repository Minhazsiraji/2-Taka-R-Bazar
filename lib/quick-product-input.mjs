// Reusable, side-effect-free validation of the admin's one-screen product master.
// SEO/AEO/GEO are optional enrichment after the product is saved.
const LIMITS={name:180,brand:180,category:120,package_size:60,unit:30}
const TYPES=new Set(['SUPPLIER_POOL','DIRECT_PRODUCT','EXCLUSIVE_PARTNER'])

export function quickProductPayload(fields){
 const clean=(key)=>String(fields[key]??'').trim()
 const result={
  name:clean('name'),category:clean('category'),package_size:clean('package_size'),
  unit:clean('unit'),sku:clean('sku').toUpperCase(),brand:clean('brand'),
  source_type:clean('source_type')||'SUPPLIER_POOL',
 }
 for(const [field,max] of Object.entries(LIMITS)){
  const value=result[field]
  if(field==='brand'&&!value)continue
  if(value.length<(field==='name'||field==='category'?2:1)||value.length>max)
   return {ok:false,field,message:'Enter a valid '+field.replaceAll('_',' ')+' ('+(field==='name'||field==='category'?'2':'1')+'–'+max+' characters).'}
 }
 if(!/^[A-Z0-9][A-Z0-9_-]{2,79}$/.test(result.sku))
  return {ok:false,field:'sku',message:'SKU must be 3–80 characters: A–Z, 0–9, hyphen or underscore.'}
 if(!TYPES.has(result.source_type))
  return {ok:false,field:'source_type',message:'Choose a supported product source.'}
 if(/^(2TBR|2-TAKA-R-BAZAR)$/i.test(result.brand))
  return {ok:false,field:'brand',message:'Use the Own Products private-label workflow for 2TBR-branded packaging.'}
 return {ok:true,payload:{
  name:result.name,brand:result.brand||null,category:result.category,
  package_size:result.package_size,unit:result.unit,sku:result.sku,
  source_type:result.source_type,brand_type:result.brand?'SUPPLIER_BRAND':'UNBRANDED_LOOSE',
  is_demo:false,active:true,
 }}
}
