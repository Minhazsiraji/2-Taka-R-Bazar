import Image from 'next/image'

export function BrandLogo({ size = 56, alt = '2-TAKA-R-BAZAR - Smart Shopping. Real Savings.' }: { size?: number; alt?: string }) {
  return (
    <Image
      src="/brand-mark-transparent.png"
      alt={alt}
      width={size}
      height={size}
      sizes={`${size}px`}
      loading="eager"
      style={{
        display: 'block',
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        maxWidth: `${size}px`,
        minHeight: `${size}px`,
        maxHeight: `${size}px`,
        objectFit: 'contain',
        flex: '0 0 auto',
      }}
    />
  )
}
