/**
 * Public location utilities. No location coordinates are stored in this module.
 * A selected browsing area is not verified household residency.
 */
export function pickStoredBrowsingArea(value, allowedIds) {
  if (typeof value !== 'string' || !Array.isArray(allowedIds)) return '';
  return allowedIds.includes(value) ? value : '';
}

/** Avoid claiming a community match when accuracy overlaps the boundary. */
export function matchConfidentCommunity(areas, latitude, longitude, accuracy, distanceMeters) {
  if (!Array.isArray(areas) || typeof distanceMeters !== 'function' ||
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
    !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 750) return null;
  const candidates = areas
    .filter(area => area.center_latitude != null && area.center_longitude != null &&
      Number.isFinite(Number(area.center_latitude)) &&
      Number.isFinite(Number(area.center_longitude)) &&
      Number.isFinite(Number(area.match_radius_m)) &&
      Number(area.match_radius_m) > 0)
    .map(area => ({area, distance:distanceMeters(latitude,longitude,
      Number(area.center_latitude),Number(area.center_longitude))}))
    .filter(candidate => Number.isFinite(candidate.distance) &&
      candidate.distance + accuracy <= Number(candidate.area.match_radius_m))
    .sort((a,b)=>a.distance-b.distance);
  // Overlapping verified circles remain suggestions; cannot uniquely infer membership.
  return candidates.length === 1 ? candidates[0].area : null;
}

/**
 * Deterministic allocation candidate. The warehouse must still validate capacity,
 * cutoff, inventory, dispatch ownership and actual order before assigning.
 * Never group by approximate GPS coordinates or a customer's typed building name.
 */
export function deliveryBundleCandidate(order) {
  if (!order || order.fulfillment !== 'home_delivery' ||
    order.addressVerification !== 'verified' ||
    order.buildingVerification !== 'verified') return null;
  const keys = ['communityId','zoneId','buildingId','supplierGroupId','deliveryDate','windowId'];
  if (keys.some(key=>typeof order[key] !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,72}$/.test(order[key]))) return null;
  const date = order.deliveryDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date+'T00:00:00Z'))) return null;
  return keys.map(key => order[key]).join('|');
}
