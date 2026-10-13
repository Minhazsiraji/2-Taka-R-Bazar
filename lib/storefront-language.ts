export type MarketplaceLanguage='bn'|'en'
// Non-sensitive site preference; never use language cookies for access control.
export const STOREFRONT_LANGUAGE_COOKIE='2tbr_storefront_language'
export const STOREFRONT_LANGUAGE_STORAGE='2tbr-storefront-language-v1'
export const DEFAULT_STOREFRONT_LANGUAGE:MarketplaceLanguage='en'
export const chooseText=(lang:MarketplaceLanguage,en:string,bn:string)=>lang==='bn'?bn:en
export function languageFromPreference(value:unknown):MarketplaceLanguage {
 return value==='bn'?'bn':'en'
}
export function isValidLanguagePreference(value:unknown):value is MarketplaceLanguage {
 return value==='bn'||value==='en'
}
