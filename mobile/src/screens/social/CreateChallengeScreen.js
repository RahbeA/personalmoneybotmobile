import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { socialApi } from '../../api/social';

const METRICS = [
  { key: 'xp', label: 'XP earned', icon: 'flash' },
  { key: 'lessons_completed', label: 'Lessons completed', icon: 'book' },
  { key: 'daily_points', label: 'Daily challenge points', icon: 'calendar' },
  { key: 'streak_days', label: 'Streak days', icon: 'flame' },
];

const DURATION_OPTIONS = [
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
];

// The device computes all absolute instants from its own local time zone, so
// the challenge window is anchored to the user's local day (most reliable —
// only the device knows its true UTC offset). The backend just stores/compares
// these instants.
function startOfLocalDayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfLocalDayIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 0);
  return d.toISOString();
}

export default function CreateChallengeScreen({ navigation, route }) {
  const { groupId } = route.params;
  const { token } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState('xp');
  const [target, setTarget] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Give your challenge a name.');
      return;
    }
    const targetNum = parseInt(target, 10);
    if (!targetNum || targetNum <= 0) {
      Alert.alert('Invalid target', 'Enter a positive number for the target.');
      return;
    }

    setSubmitting(true);
    try {
      const challenge = await socialApi.createChallenge(token, groupId, {
        title: title.trim(),
        metric,
        target: targetNum,
        startsAt: startOfLocalDayIso(),
        endsAt: endOfLocalDayIso(durationDays),
      });
      navigation.replace('ChallengeLeaderboard', { challengeId: challenge.id });
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not create challenge.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>New Challenge</Text>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.label}>CHALLENGE NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. XP Sprint"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />

          <Text style={styles.label}>METRIC</Text>
          {METRICS.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.metricRow, metric === m.key && styles.metricRowActive]}
              onPress={() => setMetric(m.key)}
              activeOpacity={0.85}
            >
              <Ionicons name={m.icon} size={20} color={metric === m.key ? colors.primary : colors.textMuted} />
              <Text style={[styles.metricLabel, metric === m.key && styles.metricLabelActive]}>{m.label}</Text>
              {metric === m.key && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
            </TouchableOpacity>
          ))}

          <Text style={styles.label}>TARGET</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 500"
            placeholderTextColor={colors.textMuted}
            value={target}
            onChangeText={setTarget}
            keyboardType="number-pad"
            returnKeyType="done"
          />

          <Text style={styles.label}>DURATION</Text>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d.days}
                style={[styles.durationBtn, durationDays === d.days && styles.durationBtnActive]}
                onPress={() => setDurationDays(d.days)}
              >
                <Text style={[styles.durationText, durationDays === d.days && styles.durationTextActive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleCreate}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitGradient}
            >
              <Text style={styles.submitText}>{submitting ? 'Creating…' : 'Start Challenge'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  title: { fontSize: 24, fontWeight: '900', color: colors.white },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  label: {
    fontSize: 12, fontWeight: '800', color: colors.textSecondary,
    letterSpacing: 0.6, marginTop: 16, marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 14,
    fontSize: 16, color: colors.white, borderWidth: 1, borderColor: colors.border,
  },
  metricRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  metricRowActive: { borderColor: colors.primary + '88', backgroundColor: colors.primaryTint },
  metricLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  metricLabelActive: { color: colors.white, fontWeight: '700' },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  durationBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  durationText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  durationTextActive: { color: colors.primary },
  submitBtn: { marginTop: 24, borderRadius: 14, overflow: 'hidden' },
  submitBtnDisabled: { opacity: 0.6 },
  submitGradient: { paddingVertical: 16, alignItems: 'center' },
  submitText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
