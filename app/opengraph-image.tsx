import { ImageResponse } from 'next/og'
import { SITE_NAME, SITE_TAGLINE_EN } from '@/lib/site'

export const alt = `${SITE_NAME} — ${SITE_TAGLINE_EN}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#f5f7f7',
          color: '#0b1018',
          padding: '72px',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>2-TAKA-R-BAZAR</div>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 980 }}>
          <div style={{ display: 'flex', fontSize: 70, lineHeight: 1.05, fontWeight: 900, letterSpacing: -3 }}>Buy together. Pay the real pool price.</div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 32, lineHeight: 1.3, color: '#40505a' }}>Community grocery pooling in Savar, Bangladesh</div>
        </div>
        <div style={{ display: 'flex', fontSize: 26, fontWeight: 700 }}>{SITE_TAGLINE_EN}</div>
      </div>
    ),
    size,
  )
}
