import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationsContext';
import { getRankMeta } from '../../context/UserProgressContext';
import { coursesApi } from '../../api/courses';
import { socialApi } from '../../api/social';
import { cacheKeys, fetchWithCache, TTL } from '../../utils/apiCache';
import { BrandAvatar, BrandLoader } from '../../components/brand';
import UserProfileSheet from '../../components/social/UserProfileSheet';
import { useTabBarInset } from '../../navigation/tabBarLayout';
import { requireAccount } from '../../utils/requireAccount';

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

function LeaderboardRow({ entry, styles, colors, highlighted = false, inset = true, onPress }) {
  const rankMeta = getRankMeta(entry.rank_tier?.key);
  const isTopThree = entry.rank <= 3;

  return (
    <TouchableOpacity
      style={[styles.row, inset && styles.rowInset, highlighted && styles.rowHighlighted, isTopThree && styles.rowTopThree]}
      activeOpacity={0.88}
      onPress={onPress}
      disabled={!onPress}
    >
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
          {entry.streak_days > 0 && (
            <View style={styles.streakChip}>
              <Ionicons name="flame" size={11} color={colors.streak} />
              <Text style={styles.streakText}>{entry.streak_days}</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function FriendsScreen({ navigation }) {
  const { token, isGuest } = useAuth();
  const { colors, isDark } = useTheme();
  const { unreadCount } = useNotifications();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);

  const [top, setTop] = useState([]);
  const [me, setMe] = useState(null);
  const [matches, setMatches] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [friendCount, setFriendCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [inviteCount, setInviteCount] = useState(0);
  const [profileUser, setProfileUser] = useState(null);
  const hasLoadedRef = useRef(false);
  const searchTimer = useRef(null);
  const fetchId = useRef(0);

  const loadSocialChrome = useCallback(async () => {
    if (!token || isGuest) {
      setPendingCount(0);
      setFriendCount(0);
      setGroupCount(0);
      setInviteCount(0);
      return;
    }
    try {
      const [requestsRes, friendsRes, groupsRes, invitesRes] = await Promise.all([
        socialApi.getRequests(token).catch(() => ({ incoming: [] })),
        socialApi.getFriends(token).catch(() => ({ friends: [] })),
        socialApi.getGroups(token).catch(() => ({ groups: [] })),
        socialApi.getGroupInvites(token).catch(() => ({ invites: [] })),
      ]);
      setPendingCount((requestsRes.incoming || []).length);
      setFriendCount((friendsRes.friends || []).length);
      setGroupCount((groupsRes.groups || []).length);
      setInviteCount((invitesRes.invites || []).length);
    } catch {
      // chrome is best-effort
    }
  }, [token, isGuest]);

  const fetchLeaderboard = useCallback(async ({
    force = false,
    soft = false,
    searchQuery = '',
  } = {}) => {
    if (!token || isGuest) {
      setLoading(false);
      return;
    }
    const id = ++fetchId.current;
    const isSearch = !!searchQuery.trim();
    if (isSearch) setSearching(true);
    else if (!soft) setLoading(true);
    setError(null);

    try {
      let data;
      if (isSearch) {
        data = await coursesApi.getLeaderboard(token, {
          page: 1,
          pageSize: 25,
          search: searchQuery.trim(),
        });
      } else {
        const result = await fetchWithCache(
          cacheKeys.leaderboardPage1(),
          () => coursesApi.getLeaderboard(token, { page: 1, pageSize: TOP_N }),
          { freshMs: TTL.LEADERBOARD_MS, staleMs: TTL.LEADERBOARD_MS * 4, force },
        );
        data = result.data;
      }
      if (id !== fetchId.current) return;

      if (isSearch) {
        setMatches(data.entries || []);
      } else {
        const topList = data.top || [];
        let meData = data.me || null;
        const meInTop = topList.find((e) => e.is_me);
        if (meInTop) meData = { ...meInTop, is_me: true };
        setTop(topList);
        setMe(meData);
        setMatches([]);
        setTotalCount(data.total_count || data.pagination?.total_count || 0);
        hasLoadedRef.current = true;
      }
      if (data.me) setMe({ ...data.me, is_me: true });
    } catch (e) {
      if (id !== fetchId.current) return;
      setError(e.message || 'Could not load leaderboard.');
      if (isSearch) setMatches([]);
    } finally {
      if (id === fetchId.current) {
        setLoading(false);
        setSearching(false);
        setRefreshing(false);
      }
    }
  }, [token, isGuest]);

  useFocusEffect(useCallback(() => {
    loadSocialChrome();
    if (!search) fetchLeaderboard({ soft: hasLoadedRef.current });
  }, [loadSocialChrome, fetchLeaderboard, search]));

  useEffect(() => {
    if (!search) return undefined;
    fetchLeaderboard({ searchQuery: search });
    return undefined;
  }, [search, fetchLeaderboard]);

  function handleSearchChange(text) {
    setSearchInput(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(text.trim());
    }, SEARCH_DEBOUNCE_MS);
  }

  function clearSearch() {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchInput('');
    setSearch('');
    setMatches([]);
    fetchLeaderboard({ soft: true });
  }

  function openProfile(entry) {
    if (!entry?.user_id) return;
    setProfileUser(entry);
  }

  function goSocial(feature, route, params) {
    if (!requireAccount({ isGuest, navigation, feature })) return;
    navigation.navigate(route, params);
  }

  const inTop = me && me.rank <= TOP_N;

  // Guests can open the tab, but ranking and friends need a real account
  // (Apple 5.1.1(v) allows gating account-based features).
  if (isGuest) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.listHeader}>
            <View style={styles.heroHeaderLeft}>
              <Text style={styles.heroEyebrow}>COMMUNITY</Text>
              <Text style={styles.title}>Leaderboard</Text>
              <Text style={styles.heroSub}>Compete with friends as you learn</Text>
            </View>
          </View>

          <View style={styles.guestLockCard}>
            <LinearGradient
              colors={['rgba(61,220,95,0.16)', 'rgba(61,220,95,0.02)', 'transparent']}
              style={styles.guestLockGlow}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.guestLockIcon}>
              <Ionicons name="trophy" size={30} color={colors.primary} />
            </View>
            <Text style={styles.guestLockTitle}>Create an account to compete</Text>
            <Text style={styles.guestLockBody}>
              The leaderboard ranks your literacy score against other learners.
              Create a free account to get ranked, add friends, and join groups —
              lessons stay available without signing up.
            </Text>
            <TouchableOpacity
              style={styles.guestCtaBtn}
              activeOpacity={0.9}
              onPress={() => {
                const rootNav = navigation?.getParent?.() ?? navigation;
                rootNav?.navigate?.('AuthUpgrade', { mode: 'register' });
              }}
            >
              <Text style={styles.guestCtaBtnText}>Create free account</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (loading && top.length === 0 && !me) {
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
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={() => {
                setRefreshing(true);
                fetchLeaderboard({ force: true, searchQuery: search });
                loadSocialChrome();
              }}
            />
          )}
        >
          <View style={styles.listHeader}>
            <View style={styles.heroHeader}>
              <View style={styles.heroHeaderLeft}>
                <Text style={styles.heroEyebrow}>COMMUNITY</Text>
                <Text style={styles.title}>Leaderboard</Text>
                <Text style={styles.heroSub}>
                  {search
                    ? 'Find friends and see where they rank'
                    : `Top ${TOP_N} by literacy score · tap anyone to connect`}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.headerBtn}
                  onPress={() => goSocial('view notifications', 'Notifications')}
                  activeOpacity={0.85}
                  accessibilityLabel="Notifications"
                >
                  <Ionicons name="notifications-outline" size={20} color={colors.white} />
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerBtn}
                  onPress={() => goSocial('manage friend requests', 'FriendRequests')}
                  activeOpacity={0.85}
                  accessibilityLabel="Friend requests"
                >
                  <Ionicons name="person-add-outline" size={20} color={colors.white} />
                  {pendingCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{pendingCount > 99 ? '99+' : pendingCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.quickRow}>
              <TouchableOpacity
                style={styles.quickChip}
                activeOpacity={0.85}
                onPress={() => goSocial('view friends', 'MyFriends')}
              >
                <Ionicons name="people" size={16} color={colors.primary} />
                <Text style={styles.quickChipText}>
                  Friends{friendCount > 0 ? ` · ${friendCount}` : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickChip}
                activeOpacity={0.85}
                onPress={() => goSocial('view groups', 'Groups')}
              >
                <Ionicons name="people-circle" size={16} color={colors.primary} />
                <Text style={styles.quickChipText}>
                  Groups{groupCount > 0 ? ` · ${groupCount}` : ''}
                </Text>
                {inviteCount > 0 && <View style={styles.quickDot} />}
              </TouchableOpacity>
            </View>

            {pendingCount > 0 && !search && (
              <TouchableOpacity
                style={styles.pendingBanner}
                activeOpacity={0.88}
                onPress={() => navigation.navigate('FriendRequests')}
              >
                <Ionicons name="mail-unread" size={18} color={colors.primary} />
                <Text style={styles.pendingBannerText}>
                  {pendingCount} friend request{pendingCount !== 1 ? 's' : ''} waiting
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}

            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search friends by name or email"
                placeholderTextColor={colors.textMuted}
                value={searchInput}
                onChangeText={handleSearchChange}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searching ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : !!searchInput && (
                <TouchableOpacity
                  onPress={clearSearch}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {me && !search && (
              <View style={styles.myRankCard}>
                <LinearGradient
                  colors={['rgba(61,220,95,0.20)', 'rgba(61,220,95,0.04)']}
                  style={styles.myRankGlow}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text style={styles.myRankLabel}>Your rank</Text>
                <View style={styles.myRankRow}>
                  <Text style={styles.myRankNum}>#{me.rank}</Text>
                  <View style={styles.myRankBody}>
                    <Text style={styles.myRankName} numberOfLines={1}>
                      {formatDisplayName(me.display_name)}
                    </Text>
                    <Text style={styles.myRankMeta}>
                      {(me.literacy_points ?? me.xp ?? 0).toLocaleString()} pts
                      {totalCount > 0 ? ` · of ${totalCount.toLocaleString()} learners` : ''}
                    </Text>
                  </View>
                  {inTop ? (
                    <View style={styles.inTopPill}>
                      <Ionicons name="trophy" size={12} color={colors.background} />
                      <Text style={styles.inTopPillText}>Top {TOP_N}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.viewMeBtn}
                      onPress={() => openProfile(me)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.viewMeBtnText}>You</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {!inTop && (
                  <Text style={styles.myRankHint}>
                    Keep learning to climb into the Top {TOP_N}.
                  </Text>
                )}
              </View>
            )}

            {error && top.length === 0 && !search ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="cloud-offline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>Couldn't load leaderboard</Text>
                <Text style={styles.emptyText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => fetchLeaderboard({ force: true })}
                >
                  <Text style={styles.retryBtnText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : search ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Results</Text>
                {searching && matches.length === 0 ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
                ) : matches.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Ionicons name="search-outline" size={36} color={colors.textMuted} />
                    <Text style={styles.emptyTitle}>No matches</Text>
                    <Text style={styles.emptyText}>Try a different name or email.</Text>
                  </View>
                ) : (
                  matches.map((entry) => (
                    <LeaderboardRow
                      key={entry.user_id}
                      entry={entry}
                      styles={styles}
                      colors={colors}
                      highlighted={entry.is_me}
                      inset={false}
                      onPress={() => openProfile(entry)}
                    />
                  ))
                )}
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top {TOP_N}</Text>
                {top.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Ionicons name="people-outline" size={36} color={colors.textMuted} />
                    <Text style={styles.emptyTitle}>No learners yet</Text>
                    <Text style={styles.emptyText}>Complete a lesson to appear on the board.</Text>
                  </View>
                ) : (
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
                        onPress={() => openProfile(entry)}
                      />
                    ))}
                  </LinearGradient>
                )}
              </View>
            )}

            {!search && totalCount > TOP_N && (
              <Text style={styles.footerMeta}>
                Showing Top {TOP_N} of {totalCount.toLocaleString()} learners
              </Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <UserProfileSheet
        visible={!!profileUser}
        userId={profileUser?.user_id}
        seed={profileUser}
        onClose={() => setProfileUser(null)}
        navigation={navigation}
        onChanged={() => {
          loadSocialChrome();
        }}
      />
    </LinearGradient>
  );
}

const makeStyles = (colors, tabBarInset) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  listContent: { paddingBottom: tabBarInset },
  listHeader: { paddingHorizontal: 20, paddingTop: 4 },

  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroHeaderLeft: { flex: 1, marginRight: 12 },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.8,
    marginBottom: 4,
  },
  heroSub: { fontSize: 13, color: colors.textSecondary, fontWeight: '500', lineHeight: 18 },
  headerActions: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.background },

  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipText: { fontSize: 13, fontWeight: '700', color: colors.white },
  quickDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primaryTint,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
  },
  pendingBannerText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.primary },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    marginBottom: 16,
    gap: 10,
  },
  searchIcon: { marginRight: -2 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.white,
    paddingVertical: 13,
  },

  myRankCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
    overflow: 'hidden',
  },
  myRankGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 18 },
  myRankLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  myRankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  myRankNum: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.8,
    minWidth: 56,
  },
  myRankBody: { flex: 1, minWidth: 0 },
  myRankName: { fontSize: 16, fontWeight: '700', color: colors.white },
  myRankMeta: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },
  myRankHint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  inTopPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  inTopPillText: { fontSize: 11, fontWeight: '800', color: colors.background },
  viewMeBtn: {
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
  },
  viewMeBtnText: { fontSize: 12, fontWeight: '800', color: colors.primary },

  guestLockCard: {
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
    overflow: 'hidden',
  },
  guestLockGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 24 },
  guestLockIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
    marginBottom: 16,
  },
  guestLockTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  guestLockBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    fontWeight: '500',
  },
  guestCtaBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  guestCtaBtnText: { fontSize: 15, fontWeight: '800', color: colors.background },

  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 13,
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
  footerMeta: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
});
