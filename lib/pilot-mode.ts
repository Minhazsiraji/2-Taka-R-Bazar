export const PILOT_MODE = true

export function membershipVisibleToCustomers() {
  return !PILOT_MODE
}
