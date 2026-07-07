// "Import from screenshot" flow:
//   pick screenshot(s) → send to Claude backend → review extracted places → add.

import React, { useState } from 'react';
import {
  View,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text } from '../Themed';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store';
import { extractPlacesFromImage, Candidate } from '../api';
import {
  TYPE_LABELS,
  TYPE_EMOJI,
  emptyPlace,
} from '../types';
import { colors, radius, spacing } from '../theme';

interface ReviewItem extends Candidate {
  added: boolean;
}

export function ScreenshotImport() {
  const { addPlace } = useStore();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);

  const pickAndExtract = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo access needed', 'Please allow photo access to import screenshots');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 6,
      base64: true,
      quality: 0.6,
    });

    if (result.canceled) return;

    const assets = result.assets.filter((a) => a.base64);
    if (assets.length === 0) {
      Alert.alert('Could not read image', 'Please try again');
      return;
    }

    setBusy(true);
    const collected: ReviewItem[] = [];
    try {
      for (let i = 0; i < assets.length; i++) {
        setStatus(`Analyzing… (${i + 1}/${assets.length})`);
        // base64 from the picker is always JPEG data
        const found = await extractPlacesFromImage(assets[i].base64 as string, 'image/jpeg');
        for (const c of found) collected.push({ ...c, added: false });
      }
    } catch (e: any) {
      setBusy(false);
      setStatus('');
      Alert.alert('Analysis failed', e?.message ?? 'Unknown error');
      return;
    }

    setBusy(false);
    setStatus('');

    if (collected.length === 0) {
      Alert.alert('No places found', "Couldn't find any places to save in those images");
      return;
    }
    setItems(collected);
    setReviewOpen(true);
  };

  const addOne = (index: number) => {
    const item = items[index];
    if (!item || item.added) return;
    addPlace({
      ...emptyPlace(),
      name: item.name,
      country: item.country,
      city: item.city,
      type: item.type,
      status: 'want',
      note: item.note,
    });
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, added: true } : it)));
  };

  const addAll = () => {
    items.forEach((it) => {
      if (!it.added) {
        addPlace({
          ...emptyPlace(),
          name: it.name,
          country: it.country,
          city: it.city,
          type: it.type,
          status: 'want',
          note: it.note,
        });
      }
    });
    setItems((prev) => prev.map((it) => ({ ...it, added: true })));
  };

  const remaining = items.filter((it) => !it.added).length;

  return (
    <>
      {/* Floating "import from screenshot" button (sits above the + button) */}
      <Pressable style={styles.fab} onPress={pickAndExtract} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.fabText}>🖼️</Text>
        )}
      </Pressable>

      {busy && !!status && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{status}</Text>
        </View>
      )}

      {/* Review modal */}
      <Modal
        visible={reviewOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReviewOpen(false)}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              Found {items.length} place{items.length === 1 ? '' : 's'}
            </Text>
            <Pressable onPress={() => setReviewOpen(false)} hitSlop={10}>
              <Text style={styles.headerBtn}>Done</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {items.map((it, i) => (
              <View key={i} style={styles.card}>
                <Text style={styles.emoji}>{TYPE_EMOJI[it.type]}</Text>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={styles.name}>{it.name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {TYPE_LABELS[it.type]}
                    {it.city ? ` · ${it.city}` : ''}
                    {it.country ? ` · ${it.country}` : ''}
                  </Text>
                  {!!it.note && <Text style={styles.note}>{it.note}</Text>}
                  {!!it.originalText && (
                    <Text style={styles.original} numberOfLines={2}>
                      “{it.originalText}”
                    </Text>
                  )}
                </View>
                <Pressable
                  style={[styles.addBtn, it.added && styles.addedBtn]}
                  onPress={() => addOne(i)}
                  disabled={it.added}
                >
                  <Text style={[styles.addText, it.added && styles.addedText]}>
                    {it.added ? '✓ Added' : 'Add'}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>

          {remaining > 0 && (
            <Pressable style={styles.addAll} onPress={addAll}>
              <Text style={styles.addAllText}>Add all {remaining} remaining</Text>
            </Pressable>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl + 60 + spacing.md, // above the manual + FAB
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#5C6BC0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  fabText: { fontSize: 26 },
  toast: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  toastText: { color: '#fff', fontSize: 14 },

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
  headerTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  headerBtn: { fontSize: 16, color: colors.accent, fontWeight: '600' },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  emoji: { fontSize: 22, marginTop: 2 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.subtext },
  note: { fontSize: 13, color: colors.text, lineHeight: 18 },
  original: { fontSize: 12, color: colors.subtext, fontStyle: 'italic', lineHeight: 16 },
  addBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    minWidth: 64,
    alignItems: 'center',
  },
  addedBtn: { backgroundColor: '#E5F6E5' },
  addText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  addedText: { color: '#2E9E2E' },
  addAll: {
    margin: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  addAllText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
