import Image from 'next/image'
import { SITE_NAME, SITE_TAGLINE_EN } from '@/lib/site'

export function BrandLogo({ size = 56, alt = `${SITE_NAME} - ${SITE_TAGLINE_EN}` }: { size?: number; alt?: string }) {
  return (
    <Image
      className="brand-logo"
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
