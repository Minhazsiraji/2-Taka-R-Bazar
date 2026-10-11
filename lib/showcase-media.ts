export type ShowcaseProduct = {
  product_id: string
  name: string
  brand: string | null
  category: string
  package_size: string
  unit: string
  image_url: string | null
  source_type: string
  description: string
  highlights: string[]
  gallery_urls: string[]
  video_url: string | null
  featured: boolean
}

const VALID_YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/

export function publicShowcaseImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
    const isManaged = !!supabaseOrigin && url.origin === new URL(supabaseOrigin).origin &&
      url.pathname.startsWith('/storage/v1/object/public/product-images/')
    const isCloudinary = url.hostname === 'res.cloudinary.com' &&
      url.pathname.includes('/image/upload/')
    return isManaged || isCloudinary
  } catch {
    return false
  }
}

export function showcaseVideo(value: string | null | undefined): {kind:'youtube'|'mp4';src:string}|null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    let videoId = ''
    if (url.hostname === 'youtu.be') videoId = url.pathname.slice(1).split('/')[0]
    else if (['www.youtube.com','youtube.com','m.youtube.com'].includes(url.hostname)) {
      if (url.pathname === '/watch') videoId = url.searchParams.get('v') ?? ''
      else if (/^\/(shorts|embed)\//.test(url.pathname)) videoId = url.pathname.split('/')[2]
    }
    if (VALID_YOUTUBE_ID.test(videoId))
      return {kind:'youtube',src:`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
    if (url.hostname === 'res.cloudinary.com' &&
        url.pathname.includes('/video/upload/') &&
        url.pathname.toLowerCase().endsWith('.mp4'))
      return {kind:'mp4',src:url.toString()}
    return null
  } catch {
    return null
  }
}
