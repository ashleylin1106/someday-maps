// Segmented single-select control (used for type / status)

import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../Themed';
import { colors, radius, spacing } from '../theme';

interface Option<T extends string> {
  value: T;
  label: string;
  color?: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = opt.value === value;
        const activeColor = opt.color ?? colors.accent;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.item,
              active && { backgroundColor: activeColor, borderColor: activeColor },
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  item: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  label: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  labelActive: {
    color: colors.accentText,
    fontWeight: '600',
  },
});
