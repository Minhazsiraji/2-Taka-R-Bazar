import type {StorefrontOffer} from './storefront'
export declare function browseCatalogOffers<T extends StorefrontOffer>(
 offers:readonly T[],
 options?:{area?:string;mode?:'all'|'group'|'pool';category?:string;search?:string}
):T[]
