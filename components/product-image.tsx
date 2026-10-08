type ProductImageProps={
  src?:string|null
  name?:string|null
  variant?:'card'|'thumb'|'wide'
  className?:string
  eager?:boolean
}

export function ProductImage({src,name,variant='card',className='',eager=false}:ProductImageProps){
  const frame=variant==='thumb'
    ? 'h-16 w-20 shrink-0 rounded-lg p-0.5 sm:h-20 sm:w-24 sm:p-1'
    : variant==='wide'
      ? 'aspect-[16/9] w-full rounded-xl p-1 sm:p-1.5'
      : 'aspect-[4/3] w-full rounded-xl p-1 sm:p-1.5'
  const label=(name||'Product').trim()||'Product'
  return <div className={`product-image-surface flex items-center justify-center overflow-hidden border border-slate-200 bg-white ${frame} ${className}`}>
    {src?<img
      src={src}
      alt={`${label} product photo`}
      className="block h-full w-full object-contain"
      loading={eager?'eager':'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
    />:<div className="px-2 text-center text-[11px] font-semibold text-slate-400 sm:text-xs">No image</div>}
  </div>
}
