import { SITE_URL } from '@/lib/site'

export const COMMUNITY_QR_CODE_COOKIE='bp_community_qr'
export const COMMUNITY_QR_SCAN_COOKIE='bp_community_qr_scan'
export const COMMUNITY_QR_SOURCE_COOKIE='bp_community_qr_source'
export const COMMUNITY_QR_COOKIE_MAX_AGE=60*60*24*7

export function normalizeCommunityQrCode(value:string|null|undefined){
  return String(value??'').toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,24)
}

export function normalizeCommunityQrSource(value:string|null|undefined){
  const cleaned=String(value??'poster').replace(/[^A-Za-z0-9_-]/g,'').slice(0,32)
  return cleaned||'poster'
}

export function communityJoinUrl(code:string,source='poster'){
  const safeCode=normalizeCommunityQrCode(code)
  const safeSource=normalizeCommunityQrSource(source)
  return `${SITE_URL}/join?community=${encodeURIComponent(safeCode)}&source=${encodeURIComponent(safeSource)}`
}
