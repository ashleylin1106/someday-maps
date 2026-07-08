// Talks to the local backend that runs Claude vision on a screenshot.

import { BACKEND_URL } from './config';
import { PlaceType } from './types';
import { ParsedPlace } from './parseText';

export interface Candidate {
  name: string;
  country: string;
  city: string;
  type: PlaceType;
  note: string;
  originalText: string;
}

export interface ImportImage {
  data: string; // base64
  mimeType: string;
}

export interface ExtractResult {
  places: ParsedPlace[];
  sourceImage: string; // IG post thumbnail when the link was scraped via Apify
  readOk: boolean; // the post's caption WAS read (so 0 places ≠ blocked)
}

// Text and/or screenshot extraction via the backend (Gemini + web search).
// Returns the same shape as the local parser so the review UI is identical.
export async function extractPlacesFromText(
  text: string,
  images: ImportImage[] = []
): Promise<ExtractResult> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/extract-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, images }),
    });
  } catch (e) {
    throw new Error(
      `Can't reach the backend (${BACKEND_URL}). Is the server running, and are your phone and computer on the same Wi-Fi?`
    );
  }
  if (!res.ok) {
    let msg = `Server error (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  const rawPlaces = Array.isArray(data?.places) ? data.places : [];
  const sourceImage = typeof data?.sourceImage === 'string' ? data.sourceImage : '';
  const readOk = data?.readOk === true;
  const places = rawPlaces
    .filter((p: any) => p && typeof p.name === 'string' && p.name.trim())
    .map((p: any) => ({
      name: String(p.name).trim(),
      country: String(p.country || '').trim(),
      city: String(p.city || '').trim(),
      type: (['attraction', 'activity', 'restaurant', 'cafe', 'shop'].includes(p.type)
        ? p.type
        : 'attraction') as PlaceType,
      category: String(p.category || '').trim(),
      trip: String(p.trip || '').trim(),
      order: Number.isFinite(p.order) ? Number(p.order) : 0,
      note: String(p.note || '').trim(),
      address: String(p.address || '').trim(),
      lat: typeof p.lat === 'number' ? p.lat : null,
      lng: typeof p.lng === 'number' ? p.lng : null,
      rating: typeof p.rating === 'number' ? p.rating : null,
      ratingCount: typeof p.ratingCount === 'number' ? Math.round(p.ratingCount) : null,
    }));
  return { places, sourceImage, readOk };
}

export async function extractPlacesFromImage(
  base64: string,
  mediaType: string
): Promise<Candidate[]> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mediaType }),
    });
  } catch (e) {
    throw new Error(
      `Can't reach the backend (${BACKEND_URL}). Make sure the server is running and your phone and computer are on the same Wi-Fi.`
    );
  }

  if (!res.ok) {
    let msg = `Server error (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  const places = Array.isArray(data?.places) ? data.places : [];
  // Basic normalisation / guard
  return places
    .filter((p: any) => p && typeof p.name === 'string' && p.name.trim())
    .map((p: any) => ({
      name: String(p.name).trim(),
      country: String(p.country || '').trim(),
      city: String(p.city || '').trim(),
      type: (['attraction', 'restaurant', 'shop'].includes(p.type)
        ? p.type
        : 'attraction') as PlaceType,
      note: String(p.note || '').trim(),
      originalText: String(p.originalText || '').trim(),
    }));
}
