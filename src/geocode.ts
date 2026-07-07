// Turn an address / place string into coordinates using the on-device geocoder
// (Apple on iOS). Free, no API key, works in Expo Go. Best-effort.

import * as Location from 'expo-location';

export async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const results = await Location.geocodeAsync(q);
    if (results && results.length > 0) {
      return { lat: results[0].latitude, lng: results[0].longitude };
    }
  } catch {
    // ignore — geocoding is best-effort
  }
  return null;
}
