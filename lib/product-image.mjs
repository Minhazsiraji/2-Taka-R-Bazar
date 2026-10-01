export const PRODUCT_IMAGE_BUCKET = 'product-images'
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024
export const PRODUCT_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])

export function productImageExtension(type) {
  return PRODUCT_IMAGE_TYPES.get(type) ?? null
}

export function hasValidProductImageSignature(type, bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (type === 'image/jpeg') return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  if (type === 'image/png') return b.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((v,i)=>b[i]===v)
  if (type === 'image/webp') return b.length >= 12 && String.fromCharCode(...b.slice(0,4)) === 'RIFF' && String.fromCharCode(...b.slice(8,12)) === 'WEBP'
  return false
}

export function validateProductImage({ type, size, bytes }) {
  const extension = productImageExtension(type)
  if (!extension) return { ok:false, error:'Product image must be JPEG, PNG or WebP' }
  if (!(size > 0) || size > MAX_PRODUCT_IMAGE_BYTES) return { ok:false, error:'Product image must be 5 MB or smaller' }
  if (!hasValidProductImageSignature(type, bytes)) return { ok:false, error:'Product image contents do not match the selected image format' }
  return { ok:true, extension }
}
