export type BrowsingArea = {
  center_latitude: number | null;
  center_longitude: number | null;
  match_radius_m: number | null;
};
export type DeliveryBundleInput = {
  fulfillment?: string;
  addressVerification?: string;
  buildingVerification?: string;
  communityId?: string;
  zoneId?: string;
  buildingId?: string;
  supplierGroupId?: string;
  deliveryDate?: string;
  windowId?: string;
};
export declare function pickStoredBrowsingArea(value: unknown, allowedIds: readonly string[]): string;
export declare function matchConfidentCommunity<T extends BrowsingArea>(
  areas: readonly T[],
  latitude: number,
  longitude: number,
  accuracy: number,
  distanceMeters: (lat: number, lon: number, areaLat: number, areaLon: number) => number
): T | null;
export declare function deliveryBundleCandidate(order: DeliveryBundleInput): string | null;
