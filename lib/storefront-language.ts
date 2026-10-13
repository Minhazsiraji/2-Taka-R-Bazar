export type MarketplaceLanguage='bn'|'en'
export const chooseText=(lang:MarketplaceLanguage,en:string,bn:string)=>lang==='bn'?bn:en
