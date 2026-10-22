import type {Product,Offer,Pool} from './data';
export function projectPublicSimpleOffers(
 payload:unknown,catalog:{products:Product[];offers:Offer[]}
):{products:Product[];offers:Offer[];pools:Pool[]};
