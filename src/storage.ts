// Local storage: keep the whole place list in AsyncStorage as JSON

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Place } from './types';

const STORAGE_KEY = 'bucketlist.places.v1';

export async function loadPlaces(): Promise<Place[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migrate older records: ensure `sources` exists (seeded from sourceUrl).
    return (parsed as any[]).map((p) => ({
      ...p,
      sources: Array.isArray(p.sources) ? p.sources : p.sourceUrl ? [p.sourceUrl] : [],
      sourceImage: typeof p.sourceImage === 'string' ? p.sourceImage : '',
    })) as Place[];
  } catch (e) {
    console.warn('Failed to read local data', e);
    return [];
  }
}

export async function savePlaces(places: Place[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  } catch (e) {
    console.warn('Failed to write local data', e);
  }
}
