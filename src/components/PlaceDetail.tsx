// Full detail view for one place. Opened by tapping a card.
// Shows notes / address / links and offers Edit and Delete.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  Linking,
  Alert,
  Image,
} from 'react-native';
import MapView from 'react-native-maps';
import { Text } from '../Themed';
import {
  Place,
  TYPE_EMOJI,
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '../types';
import { mapsUrl } from '../maps';
import { useStore } from '../store';
import { geocode } from '../geocode';
import {
  distanceMeters,
  travelMinutes,
  TravelMode,
  MODE_RADIUS,
  MODE_LABEL,
  MODE_HEADER,
} from '../distance';
import { SourceViewer } from './SourceViewer';
import { PlaceMarker } from './PlaceMarker';
import { colors, radius, spacing } from '../theme';

interface Props {
  place: Place | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (place: Place) => void;
  onDelete: (id: string) => void;
  onOpenPlace?: (place: Place) => void; // jump to another place from "nearby"
}

export function PlaceDetail({ place: placeProp, visible, onClose, onEdit, onDelete, onOpenPlace }: Props) {
  const [viewSource, setViewSource] = useState<string | null>(null);
  const [mode, setMode] = useState<TravelMode>('walk');
  const { places, setCoords } = useStore();

  // Read the freshest copy from the store (so a background geocode shows up).
  const place = useMemo(
    () => (placeProp ? places.find((p) => p.id === placeProp.id) ?? placeProp : null),
    [placeProp, places]
  );

  // If this place has no coordinates yet, locate it so the mini-map can show.
  useEffect(() => {
    if (!visible || !place || (place.lat != null && place.lng != null)) return;
    let alive = true;
    const query = place.address || [place.name, place.city, place.country].filter(Boolean).join(' ');
    geocode(query).then((g) => {
      if (alive && g) setCoords(place.id, g.lat, g.lng);
    });
    return () => {
      alive = false;
    };
  }, [visible, place?.id, place?.lat, place?.lng]);

  // Other saved places with coordinates — shown as context pins on the mini-map.
  const others = useMemo(
    () => places.filter((p) => p.id !== place?.id && p.lat != null && p.lng != null),
    [places, place?.id]
  );

  // Saved places reachable in the selected mode's window (walk 15 min / drive
  // ~20 min / transit ~20 min — straight-line estimates). Ignore anything
  // closer than 20 m: that's almost always a stacked/unreliable duplicate.
  const nearby = useMemo(() => {
    if (!place || place.lat == null || place.lng == null) return [];
    return others
      .map((p) => ({
        p,
        d: distanceMeters(place.lat as number, place.lng as number, p.lat as number, p.lng as number),
      }))
      .filter((x) => x.d > 20 && x.d <= MODE_RADIUS[mode])
      .sort((a, b) => a.d - b.d)
      .slice(0, 12);
  }, [others, place?.id, place?.lat, place?.lng, mode]);

  if (!place) return null;
  const hasCoords = place.lat != null && place.lng != null;
  // Every post this place was saved from (older data may only have sourceUrl).
  const sources =
    place.sources && place.sources.length > 0
      ? place.sources
      : place.sourceUrl
        ? [place.sourceUrl]
        : [];

  const openMaps = () => Linking.openURL(mapsUrl(place)).catch(() => {});

  const confirmDelete = () => {
    Alert.alert('Delete place', `Delete "${place.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(place.id) },
    ]);
  };

  const location = [place.city, place.country].filter(Boolean).join(', ');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.headerBtn}>Close</Text>
          </Pressable>
          <Pressable onPress={() => onEdit(place)} hitSlop={10}>
            <Text style={[styles.headerBtn, styles.edit]}>Edit</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>
            {TYPE_EMOJI[place.type]} {place.name}
          </Text>

          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: STATUS_COLORS[place.status] }]}>
              <Text style={styles.badgeText}>{STATUS_LABELS[place.status]}</Text>
            </View>
            <View style={styles.badgeOutline}>
              <Text style={styles.badgeOutlineText}>
                {TYPE_EMOJI[place.type]} {place.category || TYPE_LABELS[place.type]}
              </Text>
            </View>
            {place.rating != null && (
              <View style={styles.badgeOutline}>
                <Text style={styles.badgeOutlineText}>
                  ⭐ {place.rating}
                  {place.ratingCount != null
                    ? ` (${place.ratingCount >= 1000 ? `${(place.ratingCount / 1000).toFixed(1)}k` : place.ratingCount})`
                    : ''}
                </Text>
              </View>
            )}
          </View>

          {!!place.trip && (
            <Field
              label="Part of route"
              value={`🧭 ${place.trip}${place.order ? ` · stop ${place.order}` : ''}`}
            />
          )}
          {!!location && <Field label="Location" value={location} />}
          {!!place.address && <Field label="Address" value={place.address} />}
          {!!place.note && <Field label="Notes" value={place.note} />}

          {/* Primary action: open in Google Maps */}
          <Pressable style={styles.mapsBtn} onPress={openMaps}>
            <Text style={styles.mapsBtnText}>🗺️  Open in Google Maps</Text>
          </Pressable>

          {/* Mentioned in — every post this place was saved from, as tappable
              thumbnail cards (Yaay-style). Tap opens the post in-app. */}
          {sources.length > 0 && (
            <View style={styles.mentionBlock}>
              <Text style={styles.fieldLabel}>Mentioned in</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mentionRow}
              >
                {sources.map((u, i) => {
                  const thumb =
                    (place.sourceImages && place.sourceImages[u]) ||
                    (i === 0 ? place.sourceImage : '');
                  return (
                    <Pressable key={u} style={styles.mentionCard} onPress={() => setViewSource(u)}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.mentionImg} resizeMode="cover" />
                      ) : (
                        <View style={styles.mentionPlaceholder}>
                          <Text style={styles.mentionPlaceholderEmoji}>📄</Text>
                        </View>
                      )}
                      <View style={styles.mentionLabel}>
                        <Text style={styles.mentionLabelText} numberOfLines={1}>
                          {u.includes('instagram.com') ? '📸 Instagram' : '🔗 Post'}
                          {sources.length > 1 ? ` ${i + 1}` : ''}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Mini-map: this place + your other saved places around it */}
          {hasCoords && (
            <View style={styles.miniMapBlock}>
              <Text style={styles.fieldLabel}>Nearby — your other saved places</Text>
              <View style={styles.miniMapWrap}>
                <MapView
                  key={place.id} // re-center when jumping between places
                  style={styles.miniMap}
                  initialRegion={{
                    latitude: place.lat as number,
                    longitude: place.lng as number,
                    latitudeDelta: 0.03,
                    longitudeDelta: 0.03,
                  }}
                >
                  {others.map((p) => (
                    <PlaceMarker
                      key={p.id}
                      place={p}
                      ringColor={STATUS_COLORS[p.status]}
                      description={p.category || TYPE_LABELS[p.type]}
                    />
                  ))}
                  <PlaceMarker place={place} ringColor={STATUS_COLORS[place.status]} highlight />
                </MapView>
              </View>

              {/* Reachable suggestions from your own list */}
              <View style={styles.nearbyList}>
                <View style={styles.modeRow}>
                  {(['walk', 'drive', 'transit'] as TravelMode[]).map((m) => (
                    <Pressable
                      key={m}
                      style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                      onPress={() => setMode(m)}
                    >
                      <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                        {MODE_LABEL[m]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>{MODE_HEADER[mode]}</Text>
                {nearby.length === 0 ? (
                  <Text style={styles.nearbyEmpty}>None of your saved places are that close.</Text>
                ) : (
                  nearby.map(({ p, d }) => (
                    <Pressable key={p.id} style={styles.nearbyRow} onPress={() => onOpenPlace?.(p)}>
                      <Text style={styles.nearbyEmoji}>{TYPE_EMOJI[p.type]}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nearbyName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={styles.nearbyMeta} numberOfLines={1}>
                          {p.category || TYPE_LABELS[p.type]}
                          {p.rating != null ? ` · ⭐ ${p.rating}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.nearbyWalk}>~{travelMinutes(d, mode)} min</Text>
                    </Pressable>
                  ))
                )}
              </View>
            </View>
          )}

          <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
            <Text style={styles.deleteText}>Delete this place</Text>
          </Pressable>
        </ScrollView>

        {/* In-app viewer for the original post(s) */}
        <SourceViewer
          url={viewSource ?? ''}
          visible={!!viewSource}
          onClose={() => setViewSource(null)}
        />
      </View>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerBtn: { fontSize: 16, color: colors.subtext },
  edit: { color: colors.accent, fontWeight: '600' },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  badge: {
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#1C1C1E', fontSize: 14, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
  badgeOutline: {
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOutlineText: { color: colors.text, fontSize: 14, lineHeight: 18, fontWeight: '500', textAlign: 'center' },
  field: { gap: 2, marginTop: spacing.sm },
  fieldLabel: { fontSize: 13, color: colors.subtext, fontWeight: '500' },
  fieldValue: { fontSize: 16, color: colors.text, lineHeight: 22 },
  mentionBlock: { gap: spacing.sm },
  mentionRow: { gap: spacing.md },
  mentionCard: {
    width: 140,
    height: 180,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  mentionImg: { width: '100%', height: '100%' },
  mentionPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mentionPlaceholderEmoji: { fontSize: 36 },
  mentionLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  mentionLabelText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  miniMapBlock: { gap: spacing.sm, marginTop: spacing.sm },
  miniMapWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  miniMap: { height: 240 },
  nearbyList: { gap: spacing.sm, marginTop: spacing.xs },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: colors.chipBg,
    borderRadius: radius.sm,
    padding: 3,
    gap: 3,
  },
  modeBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm - 2 },
  modeBtnActive: { backgroundColor: colors.card },
  modeText: { fontSize: 14, color: colors.subtext, fontWeight: '600' },
  modeTextActive: { color: colors.text },
  nearbyEmpty: { fontSize: 14, color: colors.subtext },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  nearbyEmoji: { fontSize: 20 },
  nearbyName: { fontSize: 16, fontWeight: '600', color: colors.text },
  nearbyMeta: { fontSize: 13, color: colors.subtext },
  nearbyWalk: { fontSize: 14, fontWeight: '600', color: colors.accent },
  mapsBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  mapsBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  linkBtnText: { color: colors.text, fontSize: 16, fontWeight: '500' },
  deleteBtn: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: '#FFECEC',
    alignItems: 'center',
  },
  deleteText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
