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
import { dailyApi } from '../../api/daily';
import { BrandAvatar, BrandLoader } from '../../components/brand';

const PODIUM = {
  1: { icon: 'trophy', color: '#F5B72B', bg: 'rgba(245,183,43,0.18)' },
  2: { icon: 'medal', color: '#AEB9C4', bg: 'rgba(174,185,196,0.18)' },
  3: { icon: 'medal', color: '#CD7F32', bg: 'rgba(205,127,50,0.18)' },
};

function formatTime(ms) {
  const s = Math.round((ms || 0) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatName(name) {
  if (!name) return 'Learner';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function Row({ entry, styles, colors, highlighted }) {
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
        </View>
        <View style={styles.metaRow}>
          <View style={styles.tierChip}>
            <Ionicons name={tier.ionIcon} size={11} color={tier.color} />
            <Text style={[styles.tierText, { color: tier.color }]}>{entry.rank_tier?.label}</Text>
          </View>
          <Text style={styles.time}>{formatTime(entry.time_ms)}</Text>
        </View>
      </View>
      <View style={styles.scoreCol}>
        <Text style={styles.score}>{entry.score}</Text>
        <Text style={styles.scoreLbl}>pts</Text>
      </View>
    </View>
  );
}

export default function DailyLeaderboardScreen({ navigation }) {
  const { token } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await dailyApi.getLeaderboard(token);
      setData(res);
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load the leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  if (loading && !data) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <BrandLoader message="Loading leaderboard…" />
      </LinearGradient>
    );
  }

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
            <Text style={styles.title}>Daily Leaderboard</Text>
            <Text style={styles.subtitle}>
              {data ? `Daily #${data.number} · ${data.total_players} played` : 'Today'}
            </Text>
          </View>
        </View>

        <FlatList
          data={top}
          keyExtractor={(item) => String(item.user_id)}
          renderItem={({ item }) => (
            <Row entry={item} styles={styles} colors={colors} highlighted={item.is_me} />
          )}
          ListHeaderComponent={me ? (
            <View style={styles.meSection}>
              <Text style={styles.sectionLabel}>YOUR RANK</Text>
              <Row entry={me} styles={styles} colors={colors} highlighted />
              <Text style={styles.sectionLabel}>TOP {top.length}</Text>
            </View>
          ) : null}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Ionicons name={error ? 'cloud-offline' : 'people-outline'} size={36} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{error ? 'Couldn\u2019t load' : 'No players yet'}</Text>
              <Text style={styles.emptyText}>
                {error || 'Be the first to finish today\u2019s Daily!'}
              </Text>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  headerBody: { flex: 1 },
  title: { fontSize: 24, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
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
  body: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', color: colors.white, flexShrink: 1 },
  youChip: { backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  youChipText: { fontSize: 10, fontWeight: '800', color: colors.background },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tierChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tierText: { fontSize: 11, fontWeight: '600' },
  time: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  scoreCol: { alignItems: 'flex-end' },
  score: { fontSize: 18, fontWeight: '900', color: colors.primary },
  scoreLbl: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.white, marginTop: 8 },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});
