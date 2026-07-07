// Straight-line distance between two coordinates (haversine), plus a
// rough walking-time estimate (~80 m per minute ≈ 4.8 km/h).

export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 80));
}

// Travel-mode estimates (straight-line distance ÷ typical average speed).
// Rough by design — good enough for "what's near this?" browsing.
export type TravelMode = 'walk' | 'drive' | 'transit';

const MODE_SPEED: Record<TravelMode, number> = {
  walk: 80, // m/min ≈ 4.8 km/h
  drive: 583, // ≈ 35 km/h urban average
  transit: 417, // ≈ 25 km/h incl. waiting
};

// Radius covered in the mode's suggestion window (walk 15 min, drive/transit 20 min).
export const MODE_RADIUS: Record<TravelMode, number> = {
  walk: 15 * MODE_SPEED.walk,
  drive: 20 * MODE_SPEED.drive,
  transit: 20 * MODE_SPEED.transit,
};

export const MODE_LABEL: Record<TravelMode, string> = {
  walk: '🚶 Walk',
  drive: '🚗 Drive',
  transit: '🚌 Transit',
};

export const MODE_HEADER: Record<TravelMode, string> = {
  walk: 'Within a 15-min walk',
  drive: 'Within a ~20-min drive',
  transit: 'Within ~20 min by transit',
};

export function travelMinutes(meters: number, mode: TravelMode): number {
  return Math.max(1, Math.round(meters / MODE_SPEED[mode]));
}
