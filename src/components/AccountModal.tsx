// Account: sign up / sign in with email+password (Supabase). While signed in,
// the list syncs to the cloud so it survives phone changes.

import React, { useEffect, useState } from 'react';
import { Modal, View, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Text, TextInput } from '../Themed';
import { supabase } from '../supabase';
import { colors, radius, spacing } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function AccountModal({ visible, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setUserEmail(s?.user.email ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) Alert.alert('Sign in failed', error.message);
  };

  const signUp = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert('Check your details', 'Enter an email and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }
    if (!data.session) {
      Alert.alert('Check your email', 'Confirm your email address, then come back and sign in.');
    }
  };

  const signOut = async () => {
    setBusy(true);
    await supabase.auth.signOut();
    setBusy(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.headerBtn}>Close</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Account</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.body}>
          {userEmail ? (
            <>
              <Text style={styles.bigEmoji}>☁️</Text>
              <Text style={styles.signedInText}>Signed in as</Text>
              <Text style={styles.email}>{userEmail}</Text>
              <Text style={styles.hint}>
                Your list syncs to the cloud automatically — sign in on any phone and it's all
                there.
              </Text>
              <Pressable style={styles.secondaryBtn} onPress={signOut} disabled={busy}>
                {busy ? <ActivityIndicator /> : <Text style={styles.secondaryText}>Sign out</Text>}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.bigEmoji}>👤</Text>
              <Text style={styles.hint}>
                Create an account so your list is backed up and follows you to any phone.
              </Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.subtext}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password (6+ characters)"
                placeholderTextColor={colors.subtext}
                secureTextEntry
              />
              <Pressable style={styles.primaryBtn} onPress={signIn} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryText}>Sign in</Text>
                )}
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={signUp} disabled={busy}>
                <Text style={styles.secondaryText}>Create account</Text>
              </Pressable>
            </>
          )}
        </View>
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
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  headerBtn: { fontSize: 16, color: colors.subtext },
  body: { padding: spacing.xl, gap: spacing.md, alignItems: 'stretch' },
  bigEmoji: { fontSize: 44, textAlign: 'center' },
  signedInText: { fontSize: 14, color: colors.subtext, textAlign: 'center' },
  email: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  hint: { fontSize: 14, color: colors.subtext, lineHeight: 20, textAlign: 'center' },
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
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
