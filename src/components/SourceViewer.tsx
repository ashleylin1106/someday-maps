// In-app viewer for a place's source post (IG / blog), like Yaay's "Source".
// Opens the page in an embedded WebView so you never leave the app; the ↗
// button hands off to the real browser/IG app if you want it.

import React from 'react';
import { Modal, View, Pressable, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Text } from '../Themed';
import { colors, spacing } from '../theme';

interface Props {
  url: string;
  visible: boolean;
  onClose: () => void;
}

export function SourceViewer({ url, visible, onClose }: Props) {
  if (!url) return null;

  const openExternal = () => Linking.openURL(url).catch(() => {});

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.headerBtn}>Close</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Source
          </Text>
          <Pressable onPress={openExternal} hitSlop={10}>
            <Text style={[styles.headerBtn, styles.open]}>Open ↗</Text>
          </Pressable>
        </View>
        <WebView
          source={{ uri: url }}
          style={styles.web}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" />
            </View>
          )}
          allowsBackForwardNavigationGestures
          sharedCookiesEnabled
        />
      </View>
    </Modal>
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
    gap: spacing.md,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text },
  headerBtn: { fontSize: 16, color: colors.subtext },
  open: { color: colors.accent, fontWeight: '600' },
  web: { flex: 1 },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
