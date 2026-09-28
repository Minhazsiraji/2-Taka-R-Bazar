export function selectUnlockedTier(tiers, demand) {
  const eligible = tiers
    .filter(t => Number(t.threshold_quantity) <= Number(demand))
    .sort((a,b) => Number(b.threshold_quantity)-Number(a.threshold_quantity) || Number(a.customer_ceiling_price)-Number(b.customer_ceiling_price))
  return eligible[0] ?? null
}

export function nextImprovingTier(tiers, demand, currentPrice = null) {
  const candidates = tiers
    .filter(t => Number(t.threshold_quantity) > Number(demand))
    .filter(t => currentPrice == null || Number(t.customer_ceiling_price) < Number(currentPrice))
    .sort((a,b) => Number(a.threshold_quantity)-Number(b.threshold_quantity) || Number(a.customer_ceiling_price)-Number(b.customer_ceiling_price))
  return candidates[0] ?? null
}

export function validateFinalPrice({ landedCost, finalPrice, frozenCeiling }) {
  if (!(Number(finalPrice) > 0)) return false
  if (Number(finalPrice) < Number(landedCost)) return false
  if (frozenCeiling != null && Number(finalPrice) > Number(frozenCeiling)) return false
  return true
}

export function receiptAllowsPickup({ expected, received }) {
  return Number(expected) > 0 && Number(received) >= Number(expected)
}

export function shouldRewardReferral({ referralStatus, completedGenuineOrders }) {
  return referralStatus === 'pending' && Number(completedGenuineOrders) === 1
}

export function preserveBestUnlockedTier(tiers, demand, prior = null) {
  const current = selectUnlockedTier(tiers, demand)
  if (!prior) return current
  if (!current) return prior
  const currentPrice = Number(current.customer_ceiling_price)
  const priorPrice = Number(prior.customer_ceiling_price)
  if (currentPrice < priorPrice) return current
  if (currentPrice === priorPrice && Number(current.threshold_quantity) > Number(prior.threshold_quantity)) return current
  return prior
}
