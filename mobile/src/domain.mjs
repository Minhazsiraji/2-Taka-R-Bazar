// Portable, side-effect-free helpers; no database writes or fake verified savings.
export function customerSaving(retail, price, quantity=1) {
  if (![retail, price, quantity].every(Number.isFinite) || quantity < 0) return 0;
  return Math.round(Math.max(0, retail-price) * quantity * 100)/100;
}
export function cartLineCount(cart) {
  return Object.values(cart).filter(q=>Number.isInteger(q) && q>0).length;
}
export function cartQuantity(cart) {
  return Object.values(cart).reduce((total,quantity)=>total+(Number.isInteger(quantity) && quantity>0?quantity:0),0);
}
export function cartSubtotal(cart, offers) {
  return Math.round(Object.entries(cart).reduce((total,[id,quantity])=>{
    const offer=offers.find(item=>item.id===id);
    return total+(offer && offer.phase==='ready' && Number.isInteger(quantity)&&quantity>0?offer.price*quantity:0);
  },0)*100)/100;
}
export function nextPoolTier(participants, thresholds) {
  return [...thresholds].sort((a,b)=>a-b).find(t=>t>participants) ?? null;
}
export function verifiedTotals(orders, ownerId) {
  const verified=orders.filter(order=>order.customerId===ownerId&&order.status==='completed'&&!order.synthetic);
  return verified.reduce((total,order)=>total+(order.lines||[]).reduce((sum,line)=>{
    const fulfilled=Math.max(0,(line.fulfilledQuantity||0)-(line.returnedQuantity||0));
    return sum+customerSaving(line.referencePrice,line.unitPrice,fulfilled);
  },0),0);
}
