// Build a Google Maps search link for a place. Tapping it opens Google Maps
// (app or web) to that search — which shows the place, its rating and reviews.
// Free, no API key needed.

interface MapsQueryable {
  name: string;
  city?: string;
  country?: string;
  address?: string;
}

export function mapsUrl(place: MapsQueryable): string {
  // Lead with the place NAME so Google resolves to the actual business POI
  // (searching a bare address just drops a pin on the address). Add the address
  // (or city/country) after it for disambiguation.
  const context =
    (place.address && place.address.trim()) ||
    [place.city, place.country].filter(Boolean).join(' ').trim();
  const query = [place.name.trim(), context].filter(Boolean).join(', ') || place.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
