// Free "paste text → organized places" flow. No AI, no backend, no cost.
//   paste a blob → we detect places + country/city/type/address → you review → add.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text, TextInput } from '../Themed';
import { useStore } from '../store';
import { parsePlaces, ParsedPlace } from '../parseText';
import { extractPlacesFromText } from '../api';
import { TYPE_EMOJI, TYPE_LABELS, emptyPlace } from '../types';
import { colors, radius, spacing } from '../theme';

type Step = 'paste' | 'review';
type Mode = 'ai' | 'basic';

export function PasteImport() {
  const { addPlace, addSource, places } = useStore();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('paste');
  const [link, setLink] = useState(''); // IG post / reel / blog — analyzed AND saved as source
  const [text, setText] = useState('');
  const [srcImage, setSrcImage] = useState(''); // IG thumbnail from the scraper
  const [rows, setRows] = useState<ParsedPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds spent on the current lookup
  const [mode, setMode] = useState<Mode>('ai');
  // How to save this batch — you choose, not the AI.
  const [saveMode, setSaveMode] = useState<'spots' | 'route'>('spots');
  const [routeName, setRouteName] = useState('');

  // Tick an elapsed-seconds counter while a lookup is running, so a 20–40s wait
  // looks intentional instead of frozen.
  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const reset = () => {
    setStep('paste');
    setLink('');
    setText('');
    setSrcImage('');
    setRows([]);
    setBusy(false);
    setMode('ai');
    setSaveMode('spots');
    setRouteName('');
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const showReview = (found: ParsedPlace[], usedMode: Mode) => {
    if (found.length === 0) {
      Alert.alert('No places found', "Couldn't find any places in that text.");
      return;
    }
    setMode(usedMode);
    setRows(found);
    setSaveMode('spots'); // default to separate spots
    setRouteName(found.find((f) => f.trip)?.trip || ''); // suggest a name if you switch to route
    setStep('review');
  };

  const organize = async () => {
    const hasLink = !!link.trim();
    const hasText = !!text.trim();
    if ((!hasLink && !hasText) || busy) return;
    // Combine: a link to read and/or pasted text.
    const payload = [
      hasLink ? `Read this link and extract the places it's about: ${link.trim()}` : '',
      text.trim(),
    ]
      .filter(Boolean)
      .join('\n\n');
    setBusy(true);
    try {
      // Primary: AI backend (Gemini + web search) — understands @handles, notes, geo.
      const result = await extractPlacesFromText(payload);
      const found = result.places;
      setSrcImage(result.sourceImage);
      setBusy(false);
      if (found.length === 0 && hasLink && !hasText) {
        // IG often blocks link reading — guide to the fallback instead of a dead end.
        Alert.alert(
          "Couldn't read that link",
          'Instagram often blocks reading posts by link. Paste the caption text below and Organize again.'
        );
        return;
      }
      showReview(found, 'ai');
    } catch (e: any) {
      // Fallback: local rule-based parser (text only — no AI, can't read URLs).
      setBusy(false);
      if (!hasText) {
        Alert.alert(
          'AI unavailable',
          `${e?.message ?? 'AI unavailable'}\n\nReading links needs the AI server — try again later, or paste the text instead.`
        );
        return;
      }
      Alert.alert(
        'Using basic mode',
        `${e?.message ?? 'AI unavailable'}\n\nFalling back to simple offline detection.`
      );
      showReview(parsePlaces(text), 'basic');
    }
  };

  const setName = (i: number, val: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, name: val } : r)));
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const confirmAdd = () => {
    const clean = rows.filter((r) => r.name.trim());
    if (clean.length === 0) {
      Alert.alert('Nothing to add', 'Keep at least one place');
      return;
    }
    // You decide route vs spots — override whatever the AI guessed.
    const asRoute = saveMode === 'route';
    const trip = asRoute ? routeName.trim() || 'My route' : '';
    const srcLink = link.trim();

    // Duplicate check (spots only — routes may legitimately repeat places).
    // Match = same name, and same city when both known (else same country).
    const norm = (s?: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const existing = places.filter((p) => !p.trip);
    const findDup = (r: ParsedPlace) =>
      existing.find((p) => {
        if (norm(p.name) !== norm(r.name)) return false;
        const pc = norm(p.city);
        const rc = norm(r.city);
        if (pc && rc) return pc === rc;
        return norm(p.country) === norm(r.country);
      });

    const skipped: string[] = [];
    let added = 0;
    clean.forEach((r, i) => {
      if (!asRoute) {
        const dup = findDup(r);
        if (dup) {
          skipped.push(r.name.trim());
          // Instead of a duplicate entry, attach this post as another source.
          if (srcLink) addSource(dup.id, srcLink, srcImage || undefined);
          return;
        }
      }
      added += 1;
      addPlace({
        ...emptyPlace(),
        name: r.name.trim(),
        country: r.country,
        city: r.city,
        type: r.type,
        category: r.category,
        trip,
        order: asRoute ? i + 1 : 0,
        status: 'want',
        note: r.note,
        address: r.address,
        // The analyzed link IS the source — one field, no duplication.
        sourceUrl: srcLink,
        sources: srcLink ? [srcLink] : [],
        sourceImage: srcImage,
        sourceImages: srcLink && srcImage ? { [srcLink]: srcImage } : {},
        lat: r.lat ?? null,
        lng: r.lng ?? null,
        rating: r.rating ?? null,
        ratingCount: r.ratingCount ?? null,
      });
    });

    const parts: string[] = [];
    if (added > 0) parts.push(`Added ${added} place${added === 1 ? '' : 's'}.`);
    if (skipped.length > 0) {
      parts.push(
        `Already saved (${skipped.length}): ${skipped.join(', ')}${
          srcLink ? ' — this post was added to their sources.' : '.'
        }`
      );
    }
    Alert.alert(added > 0 ? 'Added' : 'Nothing new', parts.join('\n\n'));
    close();
  };

  return (
    <>
      <Pressable style={styles.fab} onPress={() => setOpen(true)}>
        <Text style={styles.fabText}>📋</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <View style={styles.container}>
          <View style={styles.header}>
            {step === 'review' ? (
              <Pressable onPress={() => setStep('paste')} hitSlop={10}>
                <Text style={styles.headerBtn}>‹ Back</Text>
              </Pressable>
            ) : (
              <Pressable onPress={close} hitSlop={10}>
                <Text style={styles.headerBtn}>Cancel</Text>
              </Pressable>
            )}
            <Text style={styles.headerTitle}>
              {step === 'paste' ? 'Paste text' : `Review ${rows.length}`}
            </Text>
            {step === 'paste' ? (
              busy ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Pressable onPress={organize} hitSlop={10}>
                  <Text style={[styles.headerBtn, styles.primary]}>Organize</Text>
                </Pressable>
              )
            ) : (
              <Pressable onPress={confirmAdd} hitSlop={10}>
                <Text style={[styles.headerBtn, styles.primary]}>Add all</Text>
              </Pressable>
            )}
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {step === 'paste' ? (
              <ScrollView
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                {busy && (
                  <View style={styles.workingBox}>
                    <Text style={styles.working}>
                      🔎 Looking up places…{elapsed > 0 ? `  ${elapsed}s` : ''}
                    </Text>
                    <Text style={styles.workingHint}>
                      Reading the post and finding each place — this usually takes 15–40s. You can
                      put your phone down.
                    </Text>
                  </View>
                )}

                {/* 1 — link first (fastest) */}
                <Text style={styles.sectionTitle}>🔗 Paste a link</Text>
                <Text style={styles.hint}>
                  IG post / reel, Xiaohongshu, or blog URL. The AI tries to read it, and the link
                  is saved on every place as its source. (Some posts block reading — then paste the
                  caption below.)
                </Text>
                <TextInput
                  style={styles.input}
                  value={link}
                  onChangeText={setLink}
                  placeholder="https://www.instagram.com/reel/…  or a blog URL"
                  placeholderTextColor={colors.subtext}
                  autoCapitalize="none"
                  keyboardType="url"
                />

                {/* 2 — pasted text */}
                <Text style={styles.sectionTitle}>📋 Text (optional)</Text>
                <Text style={styles.hint}>
                  Caption or notes — the poster's recommendations end up in each place's Notes.
                </Text>
                <TextInput
                  style={styles.textarea}
                  value={text}
                  onChangeText={setText}
                  placeholder={'Caption or notes, any language\ne.g. ☕ coffee at @bonanzacoffee'}
                  placeholderTextColor={colors.subtext}
                  multiline
                  textAlignVertical="top"
                />
              </ScrollView>
            ) : (
              <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                <Text style={styles.hint}>
                  {mode === 'ai' ? '✨ AI-detected' : '⚙️ Basic mode'} — fix names or delete anything
                  that isn't a place, then Add all. You can edit the rest later from each place.
                </Text>

                {/* You choose: separate spots vs one route */}
                <View style={styles.saveModeRow}>
                  {(['spots', 'route'] as const).map((m) => (
                    <Pressable
                      key={m}
                      style={[styles.saveModeBtn, saveMode === m && styles.saveModeBtnActive]}
                      onPress={() => setSaveMode(m)}
                    >
                      <Text style={[styles.saveModeText, saveMode === m && styles.saveModeTextActive]}>
                        {m === 'spots' ? '📍 Separate spots' : '🧭 One route'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {saveMode === 'route' && (
                  <TextInput
                    style={styles.input}
                    value={routeName}
                    onChangeText={setRouteName}
                    placeholder="Route name (e.g. Berlin Food Tour)"
                    placeholderTextColor={colors.subtext}
                  />
                )}
                {rows.map((r, i) => (
                  <View key={i} style={styles.card}>
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <TextInput
                        style={styles.nameInput}
                        value={r.name}
                        onChangeText={(v) => setName(i, v)}
                        placeholder="Place name"
                        placeholderTextColor={colors.subtext}
                      />
                      <Text style={styles.metaLine}>
                        {TYPE_EMOJI[r.type]} {r.category || TYPE_LABELS[r.type]}
                        {r.rating != null ? ` · ⭐ ${r.rating}` : ''}
                        {r.city ? ` · ${r.city}` : ''}
                        {r.country ? ` · ${r.country}` : ''}
                      </Text>
                      {!!r.note && (
                        <Text style={styles.preview} numberOfLines={2}>
                          📝 {r.note}
                        </Text>
                      )}
                      {!!r.address && (
                        <Text style={styles.preview} numberOfLines={1}>
                          📍 {r.address}
                        </Text>
                      )}
                    </View>
                    <Pressable onPress={() => removeRow(i)} hitSlop={8} style={styles.del}>
                      <Text style={styles.delText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl + 60 + spacing.md,
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
  headerBtn: { fontSize: 16, color: colors.subtext },
  primary: { color: colors.accent, fontWeight: '600' },

  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  hint: { fontSize: 13, color: colors.subtext, lineHeight: 19 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  workingBox: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  working: { fontSize: 15, color: colors.accent, fontWeight: '700' },
  workingHint: { fontSize: 13, color: colors.subtext, lineHeight: 18 },
  saveModeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.chipBg,
    borderRadius: radius.sm,
    padding: 3,
  },
  saveModeBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm - 2 },
  saveModeBtnActive: { backgroundColor: colors.card },
  saveModeText: { fontSize: 14, color: colors.subtext, fontWeight: '600' },
  saveModeTextActive: { color: colors.text },
  fieldLabel: { fontSize: 13, color: colors.subtext, fontWeight: '500', marginTop: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  textarea: {
    // Fixed max height: with very long pastes the input scrolls INSIDE itself
    // instead of growing endlessly and trapping the page scroll.
    minHeight: 110,
    maxHeight: 150,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  nameInput: { fontSize: 16, fontWeight: '600', color: colors.text, padding: 0 },
  metaLine: { fontSize: 13, color: colors.subtext },
  preview: { fontSize: 13, color: colors.text, lineHeight: 18 },
  del: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFECEC',
  },
  delText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
});
