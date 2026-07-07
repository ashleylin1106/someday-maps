// Add / edit place form (shown as a full-screen modal)

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Text, TextInput } from '../Themed';
import {
  Place,
  PlaceType,
  PlaceStatus,
  TYPE_ORDER,
  STATUS_ORDER,
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  emptyPlace,
} from '../types';
import { Segmented } from './Segmented';
import { colors, radius, spacing } from '../theme';

type Draft = Omit<Place, 'id' | 'createdAt' | 'updatedAt'>;

interface Props {
  visible: boolean;
  editing: Place | null; // null = add mode
  onClose: () => void;
  onSave: (draft: Draft) => void;
  onDelete?: (id: string) => void;
}

export function PlaceForm({ visible, editing, onClose, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyPlace());

  // Reset the form each time it opens, based on `editing`
  useEffect(() => {
    if (!visible) return;
    if (editing) {
      const { id, createdAt, updatedAt, ...rest } = editing;
      setDraft(rest);
    } else {
      setDraft(emptyPlace());
    }
  }, [visible, editing]);

  const set = <K extends keyof Draft>(key: K, val: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const handleSave = () => {
    if (!draft.name.trim()) {
      Alert.alert('Missing name', 'Please enter at least a place name');
      return;
    }
    if (!draft.country.trim()) {
      Alert.alert('Missing country', 'Please enter a country — the list and export group by country');
      return;
    }
    onSave({ ...draft, name: draft.name.trim(), country: draft.country.trim() });
  };

  const handleDelete = () => {
    if (!editing || !onDelete) return;
    Alert.alert('Delete place', `Delete "${editing.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(editing.id) },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top bar */}
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.headerBtn}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{editing ? 'Edit Place' : 'New Place'}</Text>
          <Pressable onPress={handleSave} hitSlop={10}>
            <Text style={[styles.headerBtn, styles.headerSave]}>Save</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <Field label="Name">
              <TextInput
                style={styles.input}
                value={draft.name}
                onChangeText={(t) => set('name', t)}
                placeholder="e.g. Senso-ji Temple"
                placeholderTextColor={colors.subtext}
              />
            </Field>

            <View style={styles.rowTwo}>
              <Field label="Country" style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  value={draft.country}
                  onChangeText={(t) => set('country', t)}
                  placeholder="Japan"
                  placeholderTextColor={colors.subtext}
                />
              </Field>
              <Field label="City" style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  value={draft.city}
                  onChangeText={(t) => set('city', t)}
                  placeholder="Tokyo"
                  placeholderTextColor={colors.subtext}
                />
              </Field>
            </View>

            <Field label="Type">
              <Segmented<PlaceType>
                options={TYPE_ORDER.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
                value={draft.type}
                onChange={(v) => set('type', v)}
              />
            </Field>

            <Field label="Status">
              <Segmented<PlaceStatus>
                options={STATUS_ORDER.map((s) => ({
                  value: s,
                  label: STATUS_LABELS[s],
                  color: STATUS_COLORS[s],
                }))}
                value={draft.status}
                onChange={(v) => set('status', v)}
              />
            </Field>

            <Field label="Source link (IG / blog)">
              <TextInput
                style={styles.input}
                value={draft.sourceUrl}
                onChangeText={(t) => set('sourceUrl', t)}
                placeholder="Paste a URL"
                placeholderTextColor={colors.subtext}
                autoCapitalize="none"
                keyboardType="url"
              />
            </Field>

            <Field label="Address (for Google My Maps; leave blank to use Name + City + Country)">
              <TextInput
                style={styles.input}
                value={draft.address}
                onChangeText={(t) => set('address', t)}
                placeholder="Optional"
                placeholderTextColor={colors.subtext}
              />
            </Field>

            <Field label="Note">
              <TextInput
                style={[styles.input, styles.multiline]}
                value={draft.note}
                onChangeText={(t) => set('note', t)}
                placeholder="What to eat, opening hours, a friend's tip…"
                placeholderTextColor={colors.subtext}
                multiline
              />
            </Field>

            {editing && onDelete && (
              <Pressable style={styles.deleteBtn} onPress={handleDelete}>
                <Text style={styles.deleteText}>Delete this place</Text>
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
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
  headerTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  headerBtn: { fontSize: 16, color: colors.subtext },
  headerSave: { color: colors.accent, fontWeight: '600' },
  body: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.lg },
  field: { gap: spacing.sm },
  fieldLabel: { fontSize: 13, color: colors.subtext, fontWeight: '500' },
  rowTwo: { flexDirection: 'row', gap: spacing.md },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  deleteBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.sm,
    backgroundColor: '#FFECEC',
  },
  deleteText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
