export const PRODUCT_IMAGE_BUCKET: string
export const MAX_PRODUCT_IMAGE_BYTES: number
export const PRODUCT_IMAGE_TYPES: Map<string,string>
export function productImageExtension(type:string): string | null
export function hasValidProductImageSignature(type:string,bytes:Uint8Array|ArrayBuffer): boolean
export function validateProductImage(input:{type:string;size:number;bytes:Uint8Array|ArrayBuffer}): {ok:true;extension:string}|{ok:false;error:string}
