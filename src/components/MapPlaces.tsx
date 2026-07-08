// Map view. Shows your scattered saved pins (colored by status). Route/itinerary
// stops are hidden by default — tap the matcha "Routes" button to reveal them
// as connected lines, so they don't clutter the map.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { Text } from '../Themed';
import MapView, { Polyline } from 'react-native-maps';
import { Place, STATUS_COLORS, STATUS_LABELS, TYPE_LABELS } from '../types';
import { PlaceMarker } from './PlaceMarker';
import { useStore } from '../store';
import { geocode } from '../geocode';
import { colors, radius, spacing } from '../theme';

interface Props {
  places: Place[]; // scattered (non-route) places — always shown
  routePlaces: Place[]; // route/itinerary stops — shown only when toggled on
  onSelect: (place: Place) => void;
}

const hasCoords = (p: Place) => typeof p.lat === 'number' && typeof p.lng === 'number';

export function MapPlaces({ places, routePlaces, onSelect }: Props) {
  const { setCoords } = useStore();
  const mapRef = useRef<MapView | null>(null);
  const attempted = useRef<Set<string>>(new Set());
  const [showRoutes, setShowRoutes] = useState(false);

  const pinned = useMemo(() => places.filter(hasCoords), [places]);
  const routePinned = useMemo(() => routePlaces.filter(hasCoords), [routePlaces]);
  const missing = places.length - pinned.length;

  // Your own position on the map.
  const [locGranted, setLocGranted] = useState(false);
  useEffect(() => {
    Location.requestForegroundPermissionsAsync()
      .then((r) => setLocGranted(r.granted))
      .catch(() => {});
  }, []);
  const centerOnMe = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion(
        {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        400
      );
    } catch {
      // location unavailable — ignore
    }
  };

  // Group route stops by trip and draw ONE sensible path per route.
  // Post numbering is usually list order, not walking order — connecting stops
  // by it makes a scribble. So we re-order geographically: start from stop 1,
  // then always hop to the nearest unvisited stop. Badges follow this path.
  const { routeLines, routeSeq } = useMemo(() => {
    const byTrip = new Map<string, Place[]>();
    for (const p of routePinned) {
      if (!p.trip) continue;
      if (!byTrip.has(p.trip)) byTrip.set(p.trip, []);
      byTrip.get(p.trip)!.push(p);
    }
    const seq = new Map<string, number>(); // place id → display stop number
    const lines: { trip: string; coords: { latitude: number; longitude: number }[] }[] = [];
    for (const [trip, ps] of byTrip.entries()) {
      const rest = [...ps].sort(
        (a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)
      );
      const path: Place[] = [rest.shift()!];
      while (rest.length > 0) {
        const last = path[path.length - 1];
        let bestI = 0;
        let bestD = Infinity;
        rest.forEach((p, i) => {
          const d =
            ((p.lat as number) - (last.lat as number)) ** 2 +
            ((p.lng as number) - (last.lng as number)) ** 2;
          if (d < bestD) {
            bestD = d;
            bestI = i;
          }
        });
        path.push(rest.splice(bestI, 1)[0]);
      }
      path.forEach((p, i) => seq.set(p.id, i + 1));
      if (path.length >= 2) {
        lines.push({
          trip,
          coords: path.map((p) => ({ latitude: p.lat as number, longitude: p.lng as number })),
        });
      }
    }
    return { routeLines: lines, routeSeq: seq };
  }, [routePinned]);

  // Geocode any place without coordinates (once each), in the background.
  useEffect(() => {
    let cancelled = false;
    const all = showRoutes ? [...places, ...routePlaces] : places;
    (async () => {
      for (const p of all) {
        if (cancelled) return;
        if (p.lat != null && p.lng != null) continue;
        if (attempted.current.has(p.id)) continue;
        attempted.current.add(p.id);
        const query = p.address || [p.name, p.city, p.country].filter(Boolean).join(' ');
        const g = await geocode(query);
        if (!cancelled && g) setCoords(p.id, g.lat, g.lng);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [places, routePlaces, showRoutes, setCoords]);

  // Fit the map to the visible pins.
  useEffect(() => {
    const shown = showRoutes ? [...pinned, ...routePinned] : pinned;
    if (shown.length === 0 || !mapRef.current) return;
    const coords = shown.map((p) => ({ latitude: p.lat as number, longitude: p.lng as number }));
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 70, right: 60, bottom: 70, left: 60 },
        animated: true,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [pinned, routePinned, showRoutes]);

  const initialRegion = useMemo(() => {
    if (pinned.length === 0) {
      return { latitude: 20, longitude: 0, latitudeDelta: 100, longitudeDelta: 100 };
    }
    const lats = pinned.map((p) => p.lat as number);
    const lngs = pinned.map((p) => p.lng as number);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    return { latitude: midLat, longitude: midLng, latitudeDelta: 20, longitudeDelta: 20 };
  }, [pinned]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={locGranted}
      >
        {pinned.map((p) => (
          <PlaceMarker
            key={p.id}
            place={p}
            ringColor={STATUS_COLORS[p.status]}
            description={`${p.category || TYPE_LABELS[p.type]} · ${STATUS_LABELS[p.status]}`}
            onCalloutPress={() => onSelect(p)}
          />
        ))}
        {showRoutes &&
          routeLines.map((r) => (
            <Polyline key={r.trip} coordinates={r.coords} strokeColor={colors.matcha} strokeWidth={4} />
          ))}
        {showRoutes &&
          routePinned.map((p) => (
            <PlaceMarker
              key={`r-${p.id}`}
              place={p}
              ringColor={colors.matcha}
              stopNumber={routeSeq.get(p.id)}
              description={`🧭 ${p.trip}${routeSeq.has(p.id) ? ` · stop ${routeSeq.get(p.id)}` : ''}`}
              onCalloutPress={() => onSelect(p)}
            />
          ))}
      </MapView>

      {/* Center on my location */}
      {locGranted && (
        <Pressable style={styles.locBtn} onPress={centerOnMe}>
          <Text style={styles.locBtnText}>📍</Text>
        </Pressable>
      )}

      {/* Matcha "Routes" toggle */}
      {routePlaces.length > 0 && (
        <Pressable
          style={[styles.routeBtn, showRoutes && { backgroundColor: colors.matcha, borderColor: colors.matcha }]}
          onPress={() => setShowRoutes((v) => !v)}
        >
          <Text style={[styles.routeBtnText, showRoutes && { color: '#fff' }]}>
            🧭 Routes
          </Text>
        </Pressable>
      )}

      {missing > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {missing} place{missing === 1 ? '' : 's'} not located yet
          </Text>
        </View>
      )}

      {places.length === 0 && !showRoutes && (
        <View style={styles.empty} pointerEvents="none">
          <Text style={styles.emptyText}>Nothing to show on the map for this filter</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  locBtn: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  locBtnText: { fontSize: 22 },
  routeBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  routeBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
  badge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  badgeText: { color: '#fff', fontSize: 12 },
  empty: { position: 'absolute', top: '45%', left: 0, right: 0, alignItems: 'center' },
  emptyText: { color: colors.subtext, fontSize: 14 },
});
