import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getRankMeta } from '../context/UserProgressContext';
import { coursesApi } from '../api/courses';
import { cacheKeys, fetchWithCache, TTL } from '../utils/apiCache';
import { BrandAvatar, BrandLoader } from '../components/brand';
import { useTabBarInset } from '../navigation/tabBarLayout';

const PAGE_SIZE = 20;
const TOP_N = 10;
const SEARCH_DEBOUNCE_MS = 350;

function formatDisplayName(name) {
  if (!name) return 'Learner';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

const PODIUM_META = {
  1: { icon: 'trophy', color: '#F5B72B', bg: 'rgba(245,183,43,0.18)' },
  2: { icon: 'medal', color: '#AEB9C4', bg: 'rgba(174,185,196,0.18)' },
  3: { icon: 'medal', color: '#CD7F32', bg: 'rgba(205,127,50,0.18)' },
};

function RankBadge({ rank, styles }) {
  const podium = PODIUM_META[rank];
  if (podium) {
    return (
      <View style={[styles.podiumBadge, { backgroundColor: podium.bg }]}>
        <Ionicons name={podium.icon} size={18} color={podium.color} />
      </View>
    );
  }
  return <Text style={styles.rankNum}>#{rank}</Text>;
}

function LeaderboardRow({ entry, styles, colors, highlighted = false, inset = true }) {
  const rankMeta = getRankMeta(entry.rank_tier?.key);
  const isTopThree = entry.rank <= 3;

  return (
    <View style={[styles.row, inset && styles.rowInset, highlighted && styles.rowHighlighted, isTopThree && styles.rowTopThree]}>
      <View style={styles.rankCol}>
        <RankBadge rank={entry.rank} styles={styles} />
      </View>
      <BrandAvatar character={entry.equipped_character} size={40} autoRotate={!!entry.equipped_character} />
      <View style={styles.rowBody}>
        <View style={styles.nameRow}>
          <Text style={styles.rowName} numberOfLines={1}>
            {formatDisplayName(entry.display_name)}
          </Text>
          {entry.is_me && (
            <View style={styles.youChip}>
              <Text style={styles.youChipText}>You</Text>
            </View>
          )}
        </View>
        <View style={styles.rowMeta}>
          <View style={styles.tierChip}>
            <Ionicons name={rankMeta.ionIcon} size={11} color={rankMeta.color} />
            <Text style={[styles.tierText, { color: rankMeta.color }]}>{entry.rank_tier?.label}</Text>
          </View>
          <Text style={styles.rowXp}>{entry.literacy_points?.toLocaleString() ?? entry.xp.toLocaleString()} pts</Text>
          <Text style={styles.rowXpSub}>{entry.xp.toLocaleString()} XP</Text>
          {entry.streak_days > 0 && (
            <View style={styles.streakChip}>
              <Ionicons name="flame" size={11} color={colors.streak} />
              <Text style={styles.streakText}>{entry.streak_days}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function ListHeader({
  top,
  me,
  search,
  searchInput,
  onSearchChange,
  onClearSearch,
  onBack,
  styles,
  colors,
}) {
  const showMeCard = me && !search && me.rank > TOP_N;

  return (
    <View style={styles.listHeader}>
      <View style={styles.titleRow}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.85}
          onPress={onBack}
        >
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.titleBody}>
          <Text style={styles.pageTitle}>Leaderboard</Text>
          <Text style={styles.pageSubtitle}>
            {search ? 'Search results' : 'Ranked by literacy score (onboarding + XP)'}
          </Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Find friends by name or email"
          placeholderTextColor={colors.textMuted}
          value={searchInput}
          onChangeText={onSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {!!searchInput && (
          <TouchableOpacity onPress={onClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {!search && top.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top {TOP_N}</Text>
          <LinearGradient
            colors={['rgba(61,220,95,0.14)', 'rgba(61,220,95,0.03)']}
            style={styles.topCard}
          >
            {top.map((entry) => (
              <LeaderboardRow
                key={entry.user_id}
                entry={entry}
                styles={styles}
                colors={colors}
                highlighted={entry.is_me}
                inset={false}
              />
            ))}
          </LinearGradient>
        </View>
      )}

      {showMeCard && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your rank</Text>
          <LeaderboardRow entry={me} styles={styles} colors={colors} highlighted inset={false} />
        </View>
      )}

      {!search && me && me.rank <= TOP_N && (
        <View style={styles.youInTopBanner}>
          <Ionicons name="trophy" size={16} color={colors.primary} />
          <Text style={styles.youInTopText}>You're #{me.rank} — nice work!</Text>
        </View>
      )}

      {(search || (top.length > 0 && !search)) && (
        <Text style={styles.sectionTitle}>
          {search ? (top.length === 0 ? 'Matches' : 'More results') : 'Everyone else'}
        </Text>
      )}
    </View>
  );
}

export default function LeaderboardScreen({ navigation }) {
  const { token } = useAuth();
  const { colors, isDark } = useTheme();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);

  const [top, setTop] = useState([]);
  const [me, setMe] = useState(null);
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const searchTimer = useRef(null);
  const fetchId = useRef(0);

  const fetchLeaderboard = useCallback(async ({ pageNum = 1, searchQuery = '', append = false, force = false }) => {
    if (!token) return;
    const id = ++fetchId.current;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const useCache = !append && pageNum === 1 && !searchQuery.trim();
      const cacheKey = cacheKeys.leaderboardPage1();

      let data;
      if (useCache) {
        const result = await fetchWithCache(
          cacheKey,
          () => coursesApi.getLeaderboard(token, {
            page: pageNum,
            pageSize: PAGE_SIZE,
            search: searchQuery,
          }),
          { freshMs: TTL.LEADERBOARD_MS, staleMs: TTL.LEADERBOARD_MS * 4, force },
        );
        data = result.data;
      } else {
        data = await coursesApi.getLeaderboard(token, {
          page: pageNum,
          pageSize: PAGE_SIZE,
          search: searchQuery,
        });
      }

      if (id !== fetchId.current) return;

      if (append) {
        setEntries((prev) => [...prev, ...(data.entries || [])]);
      } else {
        const topList = data.top || [];
        let meData = data.me || null;
        const meInTop = topList.find((e) => e.is_me);
        if (meInTop) {
          meData = { ...meInTop, is_me: true };
        }
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
  }, [token]);

  useEffect(() => {
    fetchLeaderboard({ pageNum: 1, searchQuery: search });
  }, [search, fetchLeaderboard]);

  function handleSearchChange(text) {
    setSearchInput(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(text.trim());
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleClearSearch() {
    setSearchInput('');
    setSearch('');
  }

  function handleShowMore() {
    if (!hasNext || loadingMore) return;
    fetchLeaderboard({ pageNum: page + 1, searchQuery: search, append: true });
  }

  const listData = useMemo(() => {
    if (search) return entries;
    const topIds = new Set(top.map((e) => e.user_id));
    return entries.filter((e) => !topIds.has(e.user_id) && e.user_id !== me?.user_id);
  }, [entries, top, me, search]);

  if (loading && entries.length === 0 && top.length === 0) {
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
          renderItem={({ item }) => (
            <LeaderboardRow entry={item} styles={styles} colors={colors} highlighted={item.is_me} />
          )}
          ListHeaderComponent={(
            <ListHeader
              top={top}
              me={me}
              search={search}
              searchInput={searchInput}
              onSearchChange={handleSearchChange}
              onClearSearch={handleClearSearch}
              onBack={() => navigation.goBack()}
              styles={styles}
              colors={colors}
            />
          )}
          ListEmptyComponent={(
            <View style={styles.emptyWrap}>
              {error ? (
                <>
                  <Ionicons name="cloud-offline" size={36} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>Couldn't load leaderboard</Text>
                  <Text style={styles.emptyText}>{error}</Text>
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => fetchLeaderboard({ pageNum: 1, searchQuery: search })}
                  >
                    <Text style={styles.retryBtnText}>Try again</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="people-outline" size={36} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>
                    {search ? 'No matches found' : 'No learners yet'}
                  </Text>
                  <Text style={styles.emptyText}>
                    {search
                      ? 'Try a different name or email.'
                      : 'Complete a lesson to appear on the board.'}
                  </Text>
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
              {!search && totalCount > 0 && (
                <Text style={styles.footerMeta}>
                  {totalCount.toLocaleString()} learner{totalCount === 1 ? '' : 's'} ranked
                </Text>
              )}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors, tabBarInset) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  listContent: { paddingBottom: tabBarInset },
  listHeader: { paddingHorizontal: 20, paddingTop: 4 },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  titleBody: { flex: 1, minWidth: 0 },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  pageSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 10,
  },
  searchIcon: { marginRight: -2 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.white,
    paddingVertical: 13,
  },

  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topCard: {
    borderRadius: 18,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(61,220,95,0.22)',
    gap: 2,
  },

  youInTopBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryTint,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
  },
  youInTopText: { fontSize: 14, fontWeight: '600', color: colors.primary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowInset: { marginHorizontal: 20 },
  rowHighlighted: {
    borderColor: colors.primary + '88',
    backgroundColor: colors.primaryTint,
  },
  rowTopThree: {
    backgroundColor: colors.surface,
  },
  rankCol: { width: 36, alignItems: 'center' },
  rankNum: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  podiumBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.white, flexShrink: 1 },
  youChip: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  youChipText: { fontSize: 10, fontWeight: '800', color: colors.background },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  tierChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tierText: { fontSize: 11, fontWeight: '600' },
  rowXp: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  rowXpSub: { fontSize: 10, color: colors.textMuted },
  streakChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  streakText: { fontSize: 11, color: colors.streak, fontWeight: '600' },

  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    gap: 8,
  },
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

  footer: { alignItems: 'center', paddingTop: 8, paddingBottom: 16, gap: 12 },
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
});
