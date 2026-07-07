// Data model

export type PlaceType = 'attraction' | 'activity' | 'restaurant' | 'cafe' | 'shop';
export type PlaceStatus = 'want' | 'confirmed' | 'visited';

export interface Place {
  id: string;
  name: string;
  country: string;
  city: string;
  type: PlaceType;
  category: string; // specific descriptor from Google Maps (e.g. "Bookstore", "Ramen restaurant", "Park")
  trip: string; // route/itinerary name if this came from a shared itinerary, else ''
  order: number; // sequence within the trip (1,2,3…); 0 if not part of a route
  rating: number | null; // Google Maps star rating found at import time (e.g. 4.6)
  ratingCount: number | null; // approximate review count at import time
  status: PlaceStatus;
  note: string;
  sourceUrl: string; // primary IG post / blog link (kept for backwards compat)
  sources: string[]; // ALL source links — re-saving the same place appends here
  sourceImage: string; // preview image of the source post (IG thumbnail via Apify)
  address: string; // for Google My Maps import (optional)
  lat: number | null;
  lng: number | null;
  createdAt: number;
  updatedAt: number;
}

// Display labels
export const TYPE_LABELS: Record<PlaceType, string> = {
  attraction: 'Attraction', // places you go SEE (sights, museums, parks, landmarks)
  activity: 'Activity', // things you go DO (hikes, tours, spas, classes)
  restaurant: 'Restaurant',
  cafe: 'Cafe',
  shop: 'Shop',
};

export const TYPE_EMOJI: Record<PlaceType, string> = {
  attraction: '📍',
  activity: '🥾',
  restaurant: '🍽️',
  cafe: '☕',
  shop: '🛍️',
};

export const STATUS_LABELS: Record<PlaceStatus, string> = {
  want: 'Want to go',
  confirmed: 'Confirmed',
  visited: 'Visited',
};

export const STATUS_COLORS: Record<PlaceStatus, string> = {
  want: '#DCA1A1', // dusty rose
  confirmed: '#7FB3D5', // legacy (no longer selectable)
  visited: '#A7C7E7', // baby blue
};

export const TYPE_ORDER: PlaceType[] = ['attraction', 'activity', 'restaurant', 'cafe', 'shop'];
// 'confirmed' intentionally omitted — not shown in filters or the form.
export const STATUS_ORDER: PlaceStatus[] = ['want', 'visited'];

// Blank defaults for a new place
export function emptyPlace(): Omit<Place, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: '',
    country: '',
    city: '',
    type: 'attraction',
    category: '',
    trip: '',
    order: 0,
    rating: null,
    ratingCount: null,
    status: 'want',
    note: '',
    sourceUrl: '',
    sources: [],
    sourceImage: '',
    address: '',
    lat: null,
    lng: null,
  };
}
