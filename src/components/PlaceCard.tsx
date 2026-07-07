// List row: name with a small type label underneath, a status dot, and a
// Google Maps link. Long-press starts multi-select; in select mode the dot
// becomes a checkmark and tapping toggles selection.

import React from 'react';
import { View, Pressable, StyleSheet, Linking } from 'react-native';
import { Text } from '../Themed';
import { Place, STATUS_COLORS, TYPE_EMOJI, TYPE_LABELS } from '../types';
import { mapsUrl } from '../maps';
import { colors, radius, spacing } from '../theme';

interface Props {
  place: Place;
  onPress: () => void;
  onLongPress?: () => void;
  selectMode?: boolean;
  selected?: boolean;
}

export function PlaceCard({ place, onPress, onLongPress, selectMode, selected }: Props) {
  const openMaps = () => {
    Linking.openURL(mapsUrl(place)).catch(() => {});
  };

  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
      {selectMode ? (
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected && <Text style={styles.checkMark}>✓</Text>}
        </View>
      ) : (
        <View style={[styles.dot, { backgroundColor: STATUS_COLORS[place.status] }]} />
      )}
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {place.name}
        </Text>
        <Text style={styles.type} numberOfLines={1}>
          {TYPE_EMOJI[place.type]} {place.category || TYPE_LABELS[place.type]}
          {place.rating != null ? ` · ⭐ ${place.rating}` : ''}
          {place.city ? ` · ${place.city}` : ''}
        </Text>
        {!!place.trip && (
          <Text style={styles.trip} numberOfLines={1}>
            🧭 {place.trip}
            {place.order ? ` · stop ${place.order}` : ''}
          </Text>
        )}
      </View>
      {!selectMode && (
        <Pressable onPress={openMaps} hitSlop={8} style={styles.maps}>
          <Text style={styles.mapsText}>🗺️</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  dot: { width: 11, height: 11, borderRadius: 5.5 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  main: { flex: 1, gap: 2 },
  name: { fontSize: 18, color: colors.text, fontWeight: '600' },
  type: { fontSize: 14, color: colors.subtext },
  trip: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  maps: { paddingHorizontal: spacing.sm },
  mapsText: { fontSize: 22 },
});
