import type {Product,Offer,Pool} from './data';
export function projectPublicSimpleOffers(
 payload:unknown,catalog:{products:Product[];offers:Offer[]},selectedCommunityId?:string|null
):{products:Product[];offers:Offer[];pools:Pool[]};
