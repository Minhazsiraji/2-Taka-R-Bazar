/**
 * Commerce boundary shared by SOLO, POOL and GROUP_DEAL journeys.
 * These pure functions do not create orders, collect money or mutate Finance.
 * Always re-verify amounts, identity, stock and eligibility on the server.
 */
export const BUY_MODE = Object.freeze({
  SOLO: 'SOLO',
  POOL: 'POOL',
  GROUP_DEAL: 'GROUP_DEAL',
});

export const COMMITMENT_STATUS = Object.freeze({
  WAITING: 'WAITING',
  PRICE_LOCKED: 'PRICE_LOCKED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  CONFIRMED: 'CONFIRMED',
});

/** Waiting commitments must never appear in an immediately payable cart. */
export function classifyShoppingEntry(entry) {
  if (!entry || !Object.values(BUY_MODE).includes(entry.mode)) {
    throw new TypeError('Unknown buying mode');
  }
  if (entry.mode === BUY_MODE.SOLO) {
    return { tab: 'ready', checkoutAllowed: true, requiresServerQuote: true };
  }
  if (!Object.values(COMMITMENT_STATUS).includes(entry.status)) {
    throw new TypeError('Unknown commitment status');
  }
  if (entry.status === COMMITMENT_STATUS.WAITING) {
    return { tab: 'waiting', checkoutAllowed: false, requiresServerQuote: true };
  }
  if (entry.status === COMMITMENT_STATUS.PRICE_LOCKED) {
    return { tab: 'ready', checkoutAllowed: true, requiresServerQuote: true };
  }
  return { tab: 'history', checkoutAllowed: false, requiresServerQuote: false };
}

/**
 * Display-only amount calculation. Integer minor currency units only.
 * Server-side checkout must independently validate and freeze the quote.
 */
export function summarizeVerifiedQuote({ lines, deliveryMinor = 0, adjustmentMinor = 0 }) {
  if (!Array.isArray(lines) || lines.length === 0) throw new TypeError('Quote requires lines');
  for (const value of [deliveryMinor, adjustmentMinor]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Invalid amount');
  }
  let subtotalMinor = 0;
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1
      || !Number.isSafeInteger(line.unitPriceMinor) || line.unitPriceMinor < 0
      || !line.serverVerified) throw new RangeError('Unverified quote line');
    const amount = line.quantity * line.unitPriceMinor;
    if (!Number.isSafeInteger(amount)) throw new RangeError('Amount overflow');
    subtotalMinor += amount;
    if (!Number.isSafeInteger(subtotalMinor)) throw new RangeError('Amount overflow');
  }
  const totalMinor = subtotalMinor + deliveryMinor - adjustmentMinor;
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) throw new RangeError('Invalid total');
  return Object.freeze({ subtotalMinor, deliveryMinor, adjustmentMinor, totalMinor });
}

/** Caller must validate locked offer, stock, area and price on the server. */
export function requirePayableEntry(entry) {
  const classification = classifyShoppingEntry(entry);
  if (!classification.checkoutAllowed) {
    throw new Error('Commitment is not ready for checkout');
  }
  return classification;
}
