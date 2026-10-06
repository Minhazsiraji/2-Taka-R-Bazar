export const HOME_DELIVERY_THRESHOLD = 1000
export const HOME_DELIVERY_LOW_FEE = 20
export const HOME_DELIVERY_HIGH_FEE = 30

const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100

export function deliveryFee({ fulfillmentMethod, productSubtotal }) {
  if (fulfillmentMethod === 'pickup') return 0
  if (fulfillmentMethod !== 'home_delivery') throw new Error('Invalid fulfilment method')
  return Number(productSubtotal) <= HOME_DELIVERY_THRESHOLD ? HOME_DELIVERY_LOW_FEE : HOME_DELIVERY_HIGH_FEE
}

export function commercialEconomics({
  benchmark,
  supplierLanded,
  variableCost = 0,
  supplierRebate = 0,
  brandSupport = 0,
  finalPrice,
  quantity = 1,
}) {
  const effectiveCost = money(Number(supplierLanded) + Number(variableCost) - Number(supplierRebate) - Number(brandSupport))
  const customerSavingPerUnit = money(Math.max(0, Number(benchmark) - Number(finalPrice)))
  const platformMarginPerUnit = money(Number(finalPrice) - effectiveCost)
  const units = Number(quantity)
  return {
    effectiveCost,
    customerSavingPerUnit,
    platformMarginPerUnit,
    projectedCustomerSaving: money(customerSavingPerUnit * units),
    projectedPlatformMargin: money(platformMarginPerUnit * units),
  }
}

export function validateCommercialPrice({ benchmark, effectiveCost, finalPrice, frozenCeiling = null }) {
  const price = Number(finalPrice)
  if (!(price > 0) || Number(effectiveCost) < 0) return false
  if (price < Number(effectiveCost)) return false
  if (price > Number(benchmark)) return false
  if (frozenCeiling != null && price > Number(frozenCeiling)) return false
  return true
}
