import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getRankMeta } from '../../context/UserProgressContext';
import { socialApi } from '../../api/social';
import { BrandAvatar, BrandLoader } from '../../components/brand';

const PODIUM = {
  1: { icon: 'trophy', color: '#F5B72B', bg: 'rgba(245,183,43,0.18)' },
  2: { icon: 'medal', color: '#AEB9C4', bg: 'rgba(174,185,196,0.18)' },
  3: { icon: 'medal', color: '#CD7F32', bg: 'rgba(205,127,50,0.18)' },
};

function formatName(name) {
  if (!name) return 'Learner';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function ProgressBar({ percent, styles, colors, completed }) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${Math.min(100, percent)}%`,
            backgroundColor: completed ? colors.primary : colors.primary + 'CC',
          },
        ]}
      />
    </View>
  );
}

function Row({ entry, challenge, styles, colors, highlighted }) {
  const podium = PODIUM[entry.rank];
  const tier = getRankMeta(entry.rank_tier?.key);
  return (
    <View style={[styles.row, highlighted && styles.rowMe]}>
      <View style={styles.rankCol}>
        {podium ? (
          <View style={[styles.podium, { backgroundColor: podium.bg }]}>
            <Ionicons name={podium.icon} size={18} color={podium.color} />
          </View>
        ) : (
          <Text style={styles.rankNum}>#{entry.rank}</Text>
        )}
      </View>
      <BrandAvatar character={entry.equipped_character} size={40} autoRotate={!!entry.equipped_character} />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{formatName(entry.display_name)}</Text>
          {entry.is_me && <View style={styles.youChip}><Text style={styles.youChipText}>You</Text></View>}
          {entry.completed && (
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginLeft: 4 }} />
          )}
        </View>
        <ProgressBar percent={entry.percent} styles={styles} colors={colors} completed={entry.completed} />
        <View style={styles.metaRow}>
          <View style={styles.tierChip}>
            <Ionicons name={tier.ionIcon} size={11} color={tier.color} />
            <Text style={[styles.tierText, { color: tier.color }]}>{entry.rank_tier?.label}</Text>
          </View>
          <Text style={styles.progressText}>
            {entry.progress}/{entry.target} {challenge?.metric_label || ''}
          </Text>
        </View>
      </View>
      <View style={styles.scoreCol}>
        <Text style={styles.score}>{Math.round(entry.percent)}%</Text>
      </View>
    </View>
  );
}

export default function ChallengeLeaderboardScreen({ navigation, route }) {
  const { challengeId } = route.params;
  const { token } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await socialApi.getChallengeLeaderboard(token, challengeId);
      setData(res);
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [token, challengeId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  if (loading && !data) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <BrandLoader message="Loading challenge…" />
      </LinearGradient>
    );
  }

  const challenge = data?.challenge;
  const top = data?.top || [];
  const me = data?.me || null;

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.headerBody}>
            <Text style={styles.title}>{challenge?.title || 'Challenge'}</Text>
            <Text style={styles.subtitle}>
              {challenge?.metric_label} · target {challenge?.target} · {challenge?.state}
            </Text>
          </View>
        </View>

        <FlatList
          data={top}
          keyExtractor={(item) => String(item.user_id)}
          renderItem={({ item }) => (
            <Row
              entry={item}
              challenge={challenge}
              styles={styles}
              colors={colors}
              highlighted={item.is_me}
            />
          )}
          ListHeaderComponent={me && !top.some((e) => e.is_me) ? (
            <View style={styles.meSection}>
              <Text style={styles.sectionLabel}>YOUR PROGRESS</Text>
              <Row entry={me} challenge={challenge} styles={styles} colors={colors} highlighted />
              <Text style={styles.sectionLabel}>ALL PARTICIPANTS</Text>
            </View>
          ) : null}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Ionicons name={error ? 'cloud-offline' : 'flag-outline'} size={36} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{error ? 'Couldn\u2019t load' : 'No participants'}</Text>
              <Text style={styles.emptyText}>{error || 'Invite friends to the group to compete.'}</Text>
            </View>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  headerBody: { flex: 1 },
  title: { fontSize: 22, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  meSection: { marginBottom: 4 },
  sectionLabel: {
    fontSize: 12, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.6,
    marginTop: 12, marginBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  rowMe: { borderColor: colors.primary + '88', backgroundColor: colors.primaryTint },
  rankCol: { width: 36, alignItems: 'center' },
  rankNum: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  podium: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '700', color: colors.white, flexShrink: 1 },
  youChip: { backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  youChipText: { fontSize: 10, fontWeight: '800', color: colors.background },
  progressTrack: {
    height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tierChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tierText: { fontSize: 11, fontWeight: '600' },
  progressText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  scoreCol: { alignItems: 'flex-end', minWidth: 44 },
  score: { fontSize: 16, fontWeight: '900', color: colors.primary },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.white, marginTop: 8 },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});
