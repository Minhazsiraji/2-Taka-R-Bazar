export type QuickProductMaster={
 name:string
 brand:string|null
 category:string
 package_size:string
 unit:string
 sku:string
 source_type:'SUPPLIER_POOL'|'DIRECT_PRODUCT'|'EXCLUSIVE_PARTNER'
 brand_type:'UNBRANDED_LOOSE'|'SUPPLIER_BRAND'
 is_demo:false
 active:true
}
export type QuickProductParseResult=
 |{ok:true;payload:QuickProductMaster}
 |{ok:false;field:string;message:string}
export function quickProductPayload(fields:Record<string,unknown>):QuickProductParseResult
