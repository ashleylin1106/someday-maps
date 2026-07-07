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
  onCalloutPress?: () => void;
}

export function PlaceMarker({ place, ringColor, title, description, highlight, onCalloutPress }: Props) {
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
});
