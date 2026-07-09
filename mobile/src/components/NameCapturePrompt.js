import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Modal,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { syncStreakNotifications, areNotificationsSupported } from '../utils/notifications';
import { localDate } from '../utils/localDate';

/**
 * One-time prompt to capture a name from existing users who signed up before
 * we collected it (email/password accounts with a blank `name`). Shown once per
 * session after onboarding; skippable but encouraged. New signups and Google/
 * Apple users already have a name, so they never see this.
 */
export default function NameCapturePrompt() {
  const { user, updateProfile } = useAuth();
  const { onboardingCompleted, streakDays, lastActive } = useUserProgress();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const needsName = !!user && onboardingCompleted && !(user.name || '').trim();
  const visible = needsName && !dismissed;

  async function handleSave() {
    if (!first.trim()) {
      setError('Please enter your first name.');
      return;
    }
    setError('');
    setSaving(true);
    const fullName = `${first.trim()} ${last.trim()}`.trim();
    try {
      await updateProfile({ name: fullName });
      // Refresh notifications so the new name is used right away.
      if (areNotificationsSupported()) {
        syncStreakNotifications({
          firstName: first.trim(),
          streakDays: streakDays || 0,
          activeToday: lastActive === localDate(),
        }).catch(() => {});
      }
      setDismissed(true);
    } catch (err) {
      setError(err.message || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setDismissed(true)}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="person-circle" size={44} color={colors.primary} />
          </View>
          <Text style={styles.title}>What should we call you?</Text>
          <Text style={styles.sub}>
            Add your name so MoneyBot can greet you and personalize your reminders.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              value={first}
              onChangeText={setFirst}
              placeholder="Jordan"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={last}
              onChangeText={setLast}
              placeholder="Rivera"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.saveBtn} activeOpacity={0.85} onPress={handleSave} disabled={saving}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.saveGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skip} activeOpacity={0.7} onPress={() => setDismissed(true)} disabled={saving}>
            <Text style={styles.skipText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  inputGroup: { gap: 6, marginBottom: 14 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.white,
  },
  error: { color: colors.error, fontSize: 13, textAlign: 'center', marginBottom: 8 },
  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  saveGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 14 },
  saveText: { color: colors.background, fontSize: 17, fontWeight: '800' },
  skip: { alignSelf: 'center', paddingVertical: 12, marginTop: 6 },
  skipText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
});
