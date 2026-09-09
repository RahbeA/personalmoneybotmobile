import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getRankMeta, useUserProgress } from '../context/UserProgressContext';
import { coursesApi } from '../api/courses';
import { cacheKeys, fetchWithCache, TTL } from '../utils/apiCache';
import { BrandAvatar, BrandLoader } from '../components/brand';
import { useTabBarInset } from '../navigation/tabBarLayout';

const PAGE_SIZE = 20;
const LESSONS_TO_UNLOCK = 2;

// Podium accents mirror the reference design: purple for 1st/2nd, teal for 3rd.
const PODIUM = {
  1: { ring: '#B794F6', bar: ['#7C3AED', '#4C1D95'], num: '#F3E8FF', points: '#C4B5FD', barHeight: 96 },
  2: { ring: '#B794F6', bar: ['#6D28D9', '#3B1D75'], num: '#EDE4FF', points: '#C4B5FD', barHeight: 68 },
  3: { ring: '#5FD0EC', bar: ['#0E7490', '#134E5A'], num: '#DFF7FF', points: '#7FE0F0', barHeight: 56 },
};

function formatDisplayName(name) {
  if (!name) return 'Learner';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function ptsOf(entry) {
  return entry?.literacy_points ?? entry?.xp ?? 0;
}

/* ------------------------------------------------------------------ */
/* Podium                                                              */
/* ------------------------------------------------------------------ */

function PodiumColumn({ entry, styles }) {
  const accent = PODIUM[entry.rank] || PODIUM[3];
  const isFirst = entry.rank === 1;
  const avatarSize = isFirst ? 68 : 54;

  return (
    <View style={[styles.podiumCol, isFirst && styles.podiumColFirst]}>
      <View style={styles.podiumAvatarWrap}>
        <View style={[styles.podiumRing, { borderColor: accent.ring, padding: isFirst ? 4 : 3 }]}>
          <BrandAvatar
            character={entry.equipped_character}
            size={avatarSize}
            autoRotate={!!entry.equipped_character}
          />
        </View>
        <View
          style={[
            styles.podiumBadge,
            { borderColor: accent.ring, backgroundColor: isFirst ? accent.bar[0] : 'rgba(10,10,10,0.85)' },
          ]}
        >
          <Ionicons name="trophy" size={12} color={isFirst ? '#FFFFFF' : accent.ring} />
        </View>
      </View>

      <Text style={styles.podiumName} numberOfLines={1}>
        {formatDisplayName(entry.display_name)}
      </Text>
      <Text style={[styles.podiumPoints, { color: accent.points }]}>
        {ptsOf(entry).toLocaleString()}
      </Text>

      <LinearGradient
        colors={accent.bar}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.podiumBar, { height: accent.barHeight }]}
      >
        <Text style={[styles.podiumBarNum, { color: accent.num }]}>{entry.rank}</Text>
      </LinearGradient>
    </View>
  );
}

function Podium({ topThree, styles }) {
  const byRank = {};
  topThree.forEach((e) => { byRank[e.rank] = e; });
  // Render order: 2nd, 1st, 3rd (podium arrangement).
  const order = [byRank[2], byRank[1], byRank[3]].filter(Boolean);
  if (order.length === 0) return null;

  return <View style={styles.podium}>{order.map((e) => <PodiumColumn key={e.user_id} entry={e} styles={styles} />)}</View>;
}

/* ------------------------------------------------------------------ */
/* List row (rank 4+)                                                  */
/* ------------------------------------------------------------------ */

function LeaderRow({ entry, styles, colors }) {
  const tier = getRankMeta(entry.rank_tier?.key);

  return (
    <View style={[styles.row, entry.is_me && styles.rowMe]}>
      <Text style={styles.rowRank}>{entry.rank}</Text>
      <View style={[styles.rowRing, { borderColor: entry.is_me ? colors.primary : tier.color }]}>
        <BrandAvatar
          character={entry.equipped_character}
          size={38}
          autoRotate={!!entry.equipped_character}
        />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {formatDisplayName(entry.display_name)}
        </Text>
        {!!entry.rank_tier?.label && (
          <Text style={[styles.rowTier, { color: tier.color }]}>{entry.rank_tier.label}</Text>
        )}
      </View>
      <View style={styles.rowRight}>
        {entry.streak_days > 0 && (
          <View style={styles.streakChip}>
            <Ionicons name="flame" size={14} color={colors.streak} />
            <Text style={styles.streakText}>{entry.streak_days}</Text>
          </View>
        )}
        <Text style={styles.rowPoints}>{ptsOf(entry).toLocaleString()}</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Pinned "You" row                                                    */
/* ------------------------------------------------------------------ */

function PinnedYouRow({ me, ptsToNext, styles, colors }) {
  if (!me) return null;
  return (
    <View style={styles.pinnedWrap}>
      <View style={styles.pinnedRow}>
        <Text style={styles.pinnedRank}>#{me.rank}</Text>
        <View style={[styles.rowRing, { borderColor: colors.primary }]}>
          <BrandAvatar
            character={me.equipped_character}
            size={38}
            autoRotate={!!me.equipped_character}
          />
        </View>
        <Text style={styles.pinnedName} numberOfLines={1}>You</Text>
        <View style={styles.pinnedRight}>
          {ptsToNext != null ? (
            <Text style={styles.pinnedMeta}>{ptsToNext.toLocaleString()} pts to #{me.rank - 1}</Text>
          ) : (
            <Text style={styles.pinnedPoints}>{ptsOf(me).toLocaleString()}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Locked state (fewer than 2 lessons completed)                       */
/* ------------------------------------------------------------------ */

function LockedLeaderboard({ lessonsCompleted, onStart, styles, colors }) {
  const progress = Math.min(lessonsCompleted / LESSONS_TO_UNLOCK, 1);
  const remaining = Math.max(LESSONS_TO_UNLOCK - lessonsCompleted, 0);

  return (
    <View style={styles.lockWrap}>
      <View style={styles.lockIconWrap}>
        <Ionicons name="lock-closed" size={40} color={colors.primary} />
      </View>
      <Text style={styles.lockTitle}>Leaderboard locked</Text>
      <Text style={styles.lockText}>
        Finish {LESSONS_TO_UNLOCK} lessons to unlock the leaderboard and see how you rank against every learner.
      </Text>

      <View style={styles.lockProgressTrack}>
        <View style={[styles.lockProgressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.lockProgressLabel}>
        {lessonsCompleted} / {LESSONS_TO_UNLOCK} lessons completed
      </Text>

      <TouchableOpacity style={styles.lockBtn} activeOpacity={0.85} onPress={onStart}>
        <Ionicons name="play" size={16} color={colors.background} />
        <Text style={styles.lockBtnText}>
          {remaining === 1 ? 'Finish 1 more lesson' : 'Start a lesson'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function LeaderboardScreen({ navigation }) {
  const { token, isGuest } = useAuth();
  const { colors, isDark } = useTheme();
  const { lessonsCompleted } = useUserProgress();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);

  const unlocked = lessonsCompleted >= LESSONS_TO_UNLOCK;

  const [top, setTop] = useState([]);
  const [me, setMe] = useState(null);
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchId = useRef(0);

  const fetchLeaderboard = useCallback(async ({ pageNum = 1, append = false, force = false } = {}) => {
    if (!token || isGuest) {
      setLoading(false);
      return;
    }
    const id = ++fetchId.current;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const useCache = !append && pageNum === 1;
      const cacheKey = cacheKeys.leaderboardPage1();

      let data;
      if (useCache) {
        const result = await fetchWithCache(
          cacheKey,
          () => coursesApi.getLeaderboard(token, { page: pageNum, pageSize: PAGE_SIZE }),
          { freshMs: TTL.LEADERBOARD_MS, staleMs: TTL.LEADERBOARD_MS * 4, force },
        );
        data = result.data;
      } else {
        data = await coursesApi.getLeaderboard(token, { page: pageNum, pageSize: PAGE_SIZE });
      }

      if (id !== fetchId.current) return;

      if (append) {
        setEntries((prev) => [...prev, ...(data.entries || [])]);
      } else {
        const topList = data.top || [];
        let meData = data.me || null;
        const meInTop = topList.find((e) => e.is_me);
        if (meInTop) meData = { ...meInTop, is_me: true };
        setTop(topList);
        setMe(meData);
        setEntries(data.entries || []);
      }
      setPage(pageNum);
      setHasNext(!!data.pagination?.has_next);
      setTotalCount(data.pagination?.total_count || 0);
    } catch (e) {
      if (id !== fetchId.current) return;
      setError(e.message || 'Could not load leaderboard.');
    } finally {
      if (id === fetchId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [token, isGuest]);

  // Refresh whenever the tab regains focus (and on mount), once unlocked.
  useFocusEffect(
    useCallback(() => {
      if (unlocked && !isGuest) fetchLeaderboard({ pageNum: 1 });
    }, [unlocked, isGuest, fetchLeaderboard]),
  );

  function handleShowMore() {
    if (!hasNext || loadingMore) return;
    fetchLeaderboard({ pageNum: page + 1, append: true });
  }

  function goToLessons() {
    const parent = navigation.getParent?.();
    if (parent) parent.navigate('HomeTab');
    else if (navigation.canGoBack()) navigation.goBack();
  }

  function goCreateAccount() {
    const rootNav = navigation?.getParent?.() ?? navigation;
    rootNav?.navigate?.('AuthUpgrade', { mode: 'register' });
  }

  const topThree = useMemo(() => top.filter((e) => e.rank <= 3), [top]);

  // Ranks 4+ from the top board plus any loaded pages, de-duplicated.
  const listData = useMemo(() => {
    const seen = new Set();
    return [...top, ...entries].filter((e) => {
      if (e.rank <= 3) return false;
      if (seen.has(e.user_id)) return false;
      seen.add(e.user_id);
      return true;
    });
  }, [top, entries]);

  // Points needed to pass the learner directly above me, when that row is loaded.
  const ptsToNext = useMemo(() => {
    if (!me || me.rank <= 1) return null;
    const above = [...top, ...entries].find((e) => e.rank === me.rank - 1);
    if (!above) return null;
    const diff = ptsOf(above) - ptsOf(me);
    return diff > 0 ? diff : null;
  }, [me, top, entries]);

  const headerElement = (
    <View style={styles.header}>
      <Text style={styles.title}>Leaderboard</Text>
      <Text style={styles.subtitle}>All learners · this week</Text>
      {topThree.length > 0 && <Podium topThree={topThree} styles={styles} />}
    </View>
  );

  // --- Guests can't be ranked (account required) ------------------
  if (isGuest) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.title}>Leaderboard</Text>
            <Text style={styles.subtitle}>All learners · this week</Text>
          </View>
          <View style={styles.lockWrap}>
            <View style={styles.lockIconWrap}>
              <Ionicons name="trophy" size={40} color={colors.primary} />
            </View>
            <Text style={styles.lockTitle}>Get ranked</Text>
            <Text style={styles.lockText}>
              Create a free account to climb the leaderboard and compete with other learners. Lessons stay open either way.
            </Text>
            <TouchableOpacity style={styles.lockBtn} activeOpacity={0.85} onPress={goCreateAccount}>
              <Ionicons name="person-add" size={16} color={colors.background} />
              <Text style={styles.lockBtnText}>Create free account</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // --- Locked gate -------------------------------------------------
  if (!unlocked) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.title}>Leaderboard</Text>
            <Text style={styles.subtitle}>All learners · this week</Text>
          </View>
          <LockedLeaderboard
            lessonsCompleted={lessonsCompleted}
            onStart={goToLessons}
            styles={styles}
            colors={colors}
          />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // --- Initial loading --------------------------------------------
  if (loading && top.length === 0 && entries.length === 0) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <BrandLoader message="Loading leaderboard…" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <FlatList
          data={listData}
          keyExtractor={(item) => String(item.user_id)}
          renderItem={({ item }) => <LeaderRow entry={item} styles={styles} colors={colors} />}
          ListHeaderComponent={headerElement}
          ListEmptyComponent={(
            <View style={styles.emptyWrap}>
              {error ? (
                <>
                  <Ionicons name="cloud-offline" size={36} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>Couldn't load leaderboard</Text>
                  <Text style={styles.emptyText}>{error}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={() => fetchLeaderboard({ pageNum: 1 })}>
                    <Text style={styles.retryBtnText}>Try again</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="people-outline" size={36} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>No other learners yet</Text>
                  <Text style={styles.emptyText}>Complete more lessons to climb the board.</Text>
                </>
              )}
            </View>
          )}
          ListFooterComponent={(
            <View style={styles.footer}>
              {hasNext && (
                <TouchableOpacity
                  style={styles.showMoreBtn}
                  activeOpacity={0.85}
                  onPress={handleShowMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Text style={styles.showMoreText}>Show more</Text>
                      <Ionicons name="chevron-down" size={16} color={colors.primary} />
                    </>
                  )}
                </TouchableOpacity>
              )}
              {totalCount > 0 && (
                <Text style={styles.footerMeta}>
                  {totalCount.toLocaleString()} learner{totalCount === 1 ? '' : 's'} ranked
                </Text>
              )}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        <PinnedYouRow me={me} ptsToNext={ptsToNext} styles={styles} colors={colors} />
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors, tabBarInset) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  // Leave room for both the pinned You row (~78) and the overlay tab bar.
  listContent: { paddingBottom: tabBarInset + 78 },

  header: { paddingHorizontal: 20, paddingTop: 8 },
  title: { fontSize: 30, fontWeight: '800', color: colors.white, letterSpacing: -0.6 },
  subtitle: { marginTop: 4, fontSize: 14, color: colors.textSecondary },

  /* Podium */
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 12,
  },
  podiumCol: { flex: 1, alignItems: 'center' },
  podiumColFirst: { marginBottom: 0 },
  podiumAvatarWrap: { position: 'relative' },
  podiumRing: {
    borderWidth: 2,
    borderRadius: 999,
  },
  podiumBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumName: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
    maxWidth: '100%',
  },
  podiumPoints: { marginTop: 2, fontSize: 13, fontWeight: '700' },
  podiumBar: {
    marginTop: 10,
    width: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
  },
  podiumBarNum: { fontSize: 30, fontWeight: '800' },

  /* Rows */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowMe: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  rowRank: { width: 20, fontSize: 15, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
  rowRing: {
    borderWidth: 2,
    borderRadius: 999,
    padding: 2,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.white },
  rowTier: { marginTop: 2, fontSize: 12, fontWeight: '700' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  streakText: { fontSize: 13, fontWeight: '700', color: colors.streak },
  rowPoints: { fontSize: 16, fontWeight: '800', color: colors.white, minWidth: 52, textAlign: 'right' },

  /* Pinned You row */
  pinnedWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: tabBarInset - 12,
  },
  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(61,220,95,0.10)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  pinnedRank: { width: 34, fontSize: 15, fontWeight: '800', color: colors.primary },
  pinnedName: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.white },
  pinnedRight: { alignItems: 'flex-end' },
  pinnedMeta: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  pinnedPoints: { fontSize: 16, fontWeight: '800', color: colors.white },

  /* Empty / footer */
  emptyWrap: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.white, marginTop: 8 },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: colors.background },

  footer: { alignItems: 'center', paddingTop: 16, gap: 12 },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.primary + '55',
    minWidth: 160,
    justifyContent: 'center',
  },
  showMoreText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  footerMeta: { fontSize: 12, color: colors.textMuted },

  /* Locked state */
  lockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 4 },
  lockIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  lockTitle: { fontSize: 22, fontWeight: '800', color: colors.white },
  lockText: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  lockProgressTrack: {
    marginTop: 24,
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  lockProgressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  lockProgressLabel: { marginTop: 10, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  lockBtn: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  lockBtnText: { fontSize: 15, fontWeight: '800', color: colors.background },
});
