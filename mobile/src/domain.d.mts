export function customerSaving(retail:number,price:number,quantity?:number):number;
export function cartLineCount(cart:Record<string,number>):number;
export function cartQuantity(cart:Record<string,number>):number;
export function cartSubtotal(cart:Record<string,number>,offers:ReadonlyArray<{id:string;price:number;phase:string}>):number;
export function nextPoolTier(participants:number,thresholds:number[]):number|null;
export function verifiedTotals(orders:ReadonlyArray<{customerId:string;status:string;synthetic:boolean;lines:{referencePrice:number;unitPrice:number;fulfilledQuantity:number;returnedQuantity:number}[]}>,ownerId:string):number;
