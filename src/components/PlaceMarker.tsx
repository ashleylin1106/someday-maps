// Custom map marker: a white bubble showing the place's type emoji,
// ringed with a color (status color, or matcha for route stops).

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { Text } from '../Themed';
import { Place, TYPE_EMOJI } from '../types';

interface Props {
  place: Place;
  ringColor: string;
  title?: string;
  description?: string;
  highlight?: boolean;
  stopNumber?: number; // route order badge (1,2,3…) shown on the marker
  onCalloutPress?: () => void;
}

export function PlaceMarker({
  place,
  ringColor,
  title,
  description,
  highlight,
  stopNumber,
  onCalloutPress,
}: Props) {
  if (place.lat == null || place.lng == null) return null;
  return (
    <Marker
      coordinate={{ latitude: place.lat, longitude: place.lng }}
      title={title ?? place.name}
      description={description}
      onCalloutPress={onCalloutPress}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={[styles.bubble, { borderColor: ringColor }, highlight && styles.big]}>
        <Text style={[styles.emoji, highlight && styles.emojiBig]}>{TYPE_EMOJI[place.type]}</Text>
        {stopNumber != null && (
          <View style={[styles.stopBadge, { backgroundColor: ringColor }]}>
            <Text style={styles.stopText}>{stopNumber}</Text>
          </View>
        )}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  bubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  big: { width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
  emoji: { fontSize: 16, lineHeight: 20 },
  emojiBig: { fontSize: 22, lineHeight: 26 },
  stopBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  stopText: { color: '#fff', fontSize: 11, fontWeight: '800', lineHeight: 14 },
});
