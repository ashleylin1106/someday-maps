// Global state: load / add / update / delete places, auto-synced to local storage

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import { useRef } from 'react';
import { Place, emptyPlace } from './types';
import { loadPlaces, savePlaces } from './storage';
import { supabase } from './supabase';

type NewPlaceInput = Omit<Place, 'id' | 'createdAt' | 'updatedAt'>;

interface StoreValue {
  places: Place[];
  loading: boolean;
  addPlace: (input: NewPlaceInput) => void;
  updatePlace: (id: string, input: NewPlaceInput) => void;
  deletePlace: (id: string) => void;
  deletePlaces: (ids: string[]) => void;
  setCoords: (id: string, lat: number, lng: number) => void;
  addSource: (id: string, url: string) => void;
  userId: string | null; // signed-in Supabase user (null = local only)
}

const StoreContext = createContext<StoreValue | null>(null);

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const normKey = (s?: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const sourcesOf = (p: Place): string[] =>
  p.sources && p.sources.length ? p.sources : p.sourceUrl ? [p.sourceUrl] : [];

// Merge the cloud copy with local: same id → newer updatedAt wins; everything
// else is kept from both sides.
function mergeCloud(local: Place[], cloud: Place[]): Place[] {
  const map = new Map<string, Place>();
  for (const p of cloud) map.set(p.id, p);
  for (const p of local) {
    const c = map.get(p.id);
    if (!c || (p.updatedAt || 0) >= (c.updatedAt || 0)) map.set(p.id, p);
  }
  return [...map.values()];
}

// One-time cleanup at load: merge exact-duplicate list places (same normalized
// name + city + country, not part of a route). The oldest copy survives and
// absorbs the others' source links / missing fields.
function mergeDuplicates(list: Place[]): Place[] {
  const keep = new Map<string, Place>();
  const out: Place[] = [];
  for (const p of [...list].sort((a, b) => a.createdAt - b.createdAt)) {
    if (p.trip) {
      out.push(p);
      continue;
    }
    const key = `${normKey(p.name)}|${normKey(p.city)}|${normKey(p.country)}`;
    const prev = keep.get(key);
    if (!prev) {
      keep.set(key, p);
      out.push(p);
      continue;
    }
    prev.sources = Array.from(new Set([...sourcesOf(prev), ...sourcesOf(p)]));
    if (!prev.sourceUrl && p.sourceUrl) prev.sourceUrl = p.sourceUrl;
    if (!prev.category && p.category) prev.category = p.category;
    if (!prev.note && p.note) prev.note = p.note;
    if (!prev.address && p.address) prev.address = p.address;
    if (prev.rating == null && p.rating != null) {
      prev.rating = p.rating;
      prev.ratingCount = p.ratingCount;
    }
    if (prev.lat == null && p.lat != null) {
      prev.lat = p.lat;
      prev.lng = p.lng;
    }
    // p itself is dropped
  }
  return out;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from local storage on startup
  useEffect(() => {
    let alive = true;
    loadPlaces().then((data) => {
      if (!alive) return;
      setPlaces(mergeDuplicates(data));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // --- Cloud sync (Supabase) ---
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setUserId(s?.user.id ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // Pull + merge the cloud list once per sign-in.
  const pulledFor = useRef<string | null>(null);
  useEffect(() => {
    if (loading || !userId || pulledFor.current === userId) return;
    pulledFor.current = userId;
    (async () => {
      const { data, error } = await supabase
        .from('lists')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.warn('cloud pull failed:', error.message);
        return;
      }
      const cloud = Array.isArray(data?.data) ? (data!.data as Place[]) : [];
      if (cloud.length > 0) setPlaces((prev) => mergeDuplicates(mergeCloud(prev, cloud)));
    })();
  }, [loading, userId]);

  // Push the whole list to the cloud (debounced) whenever it changes.
  useEffect(() => {
    if (loading || !userId) return;
    const t = setTimeout(() => {
      supabase
        .from('lists')
        .upsert({ user_id: userId, data: places, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.warn('cloud push failed:', error.message);
        });
    }, 1500);
    return () => clearTimeout(t);
  }, [places, loading, userId]);

  // Persist whenever places change (only after initial load, to avoid clobbering with [])
  useEffect(() => {
    if (loading) return;
    savePlaces(places);
  }, [places, loading]);

  const addPlace = useCallback((input: NewPlaceInput) => {
    const now = Date.now();
    const place: Place = { ...input, id: makeId(), createdAt: now, updatedAt: now };
    setPlaces((prev) => [place, ...prev]);
  }, []);

  const updatePlace = useCallback((id: string, input: NewPlaceInput) => {
    setPlaces((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...input, updatedAt: Date.now() } : p))
    );
  }, []);

  const deletePlace = useCallback((id: string) => {
    setPlaces((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const deletePlaces = useCallback((ids: string[]) => {
    const gone = new Set(ids);
    setPlaces((prev) => prev.filter((p) => !gone.has(p.id)));
  }, []);

  // Cache geocoded coordinates (used by the map). Doesn't bump updatedAt.
  const setCoords = useCallback((id: string, lat: number, lng: number) => {
    setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, lat, lng } : p)));
  }, []);

  // Append another source link to an existing place (re-saved from a new post).
  const addSource = useCallback((id: string, url: string) => {
    setPlaces((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const cur = sourcesOf(p);
        if (cur.includes(url)) return p;
        return {
          ...p,
          sources: [...cur, url],
          sourceUrl: p.sourceUrl || url,
          updatedAt: Date.now(),
        };
      })
    );
  }, []);

  const value = useMemo(
    () => ({ places, loading, addPlace, updatePlace, deletePlace, deletePlaces, setCoords, addSource, userId }),
    [places, loading, addPlace, updatePlace, deletePlace, deletePlaces, setCoords, addSource, userId]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}

export { emptyPlace };
