/** At most three distinct positions; never pad short collections with duplicates. */
export function featuredProductWindow<T>(products:T[],start:number):T[]{
 if(!products.length)return []
 const index=Number.isFinite(start)?Math.trunc(start):0
 const offset=((index%products.length)+products.length)%products.length
 return Array.from({length:Math.min(3,products.length)},(_,i)=>products[(offset+i)%products.length])
}
