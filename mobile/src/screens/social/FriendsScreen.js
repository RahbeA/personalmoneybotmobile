import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
import { coursesApi } from '../../api/courses';
import { socialApi } from '../../api/social';
import { cacheKeys, fetchWithCache, TTL } from '../../utils/apiCache';
import { BrandAvatar, BrandLoader } from '../../components/brand';
import PuckButton from '../../components/PuckButton';
import UserProfileSheet from '../../components/social/UserProfileSheet';
import { useTabBarInset } from '../../navigation/tabBarLayout';
import { useTabReselect } from '../../navigation/tabReselect';
import { requireAccount } from '../../utils/requireAccount';

const PAGE_SIZE = 10;
const TOP_DISPLAY = 10;
const SEARCH_DEBOUNCE_MS = 350;

const RANK_STYLE = {
  1: { ring: '#D4AF37', badge: '#D4AF37', label: '1st' },
  2: { ring: '#9AA8B4', badge: '#9AA8B4', label: '2nd' },
  3: { ring: '#B8896A', badge: '#B8896A', label: '3rd' },
};

function formatDisplayName(name) {
  if (!name) return 'Learner';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function ptsOf(entry) {
  return entry?.literacy_points ?? entry?.xp ?? 0;
}

function HubButton({ icon, label, count, alert, onPress, styles, colors }) {
  return (
    <TouchableOpacity style={styles.hubTile} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.hubIcon}>
        <Ionicons name={icon} size={17} color={colors.primary} />
        {alert ? <View style={styles.hubAlert} /> : null}
      </View>
      <Text style={styles.hubLabel} numberOfLines={1}>{label}</Text>
      {count > 0 ? <Text style={styles.hubCount}>{count}</Text> : null}
    </TouchableOpacity>
  );
}

function TopThreeSlot({ entry, place, onPress, styles }) {
  const meta = RANK_STYLE[place];
  const avatarSize = place === 1 ? 56 : 48;
  const isFirst = place === 1;

  if (!entry) {
    return (
      <View style={[styles.topSlot, isFirst && styles.topSlotFirst]}>
        <View style={[styles.topAvatarRing, { width: avatarSize + 6, height: avatarSize + 6, borderRadius: (avatarSize + 6) / 2, borderColor: `${meta.ring}44` }]}>
          <View style={[styles.topAvatarGhost, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]} />
        </View>
        <Text style={styles.topRankLabel}>{meta.label}</Text>
        <Text style={styles.topPtsMuted}>—</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.topSlot, isFirst && styles.topSlotFirst]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.topAvatarRing, { width: avatarSize + 6, height: avatarSize + 6, borderRadius: (avatarSize + 6) / 2, borderColor: meta.ring }]}>
        <BrandAvatar
          character={entry.equipped_character}
          size={avatarSize}
          autoRotate={isFirst}
        />
        <View style={[styles.topRankBadge, { backgroundColor: meta.badge }]}>
          <Text style={styles.topRankBadgeText}>{place}</Text>
        </View>
        {entry.is_me ? (
          <View style={styles.topYouDot} />
        ) : null}
      </View>
      <Text style={[styles.topName, isFirst && styles.topNameFirst]} numberOfLines={1}>
        {formatDisplayName(entry.display_name)}
      </Text>
      <Text style={styles.topPts}>{ptsOf(entry).toLocaleString()} pts</Text>
    </TouchableOpacity>
  );
}

function LeaderboardRow({ entry, colors, styles, onPress, highlight }) {
  return (
    <TouchableOpacity
      style={[styles.lbRow, highlight && styles.lbRowHighlight]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.lbRank}>{entry.rank}</Text>
      <BrandAvatar character={entry.equipped_character} size={40} autoRotate={false} />
      <View style={styles.lbBody}>
        <Text style={styles.lbName} numberOfLines={1}>
          {formatDisplayName(entry.display_name)}
          {entry.is_me ? ' · You' : ''}
        </Text>
        {entry.streak_days > 0 ? (
          <Text style={styles.lbMeta}>{entry.streak_days}-day streak</Text>
        ) : null}
      </View>
      <Text style={styles.lbPts}>{ptsOf(entry).toLocaleString()}</Text>
    </TouchableOpacity>
  );
}

export default function FriendsScreen({ navigation }) {
  const { token, isGuest } = useAuth();
  const { colors, isDark } = useTheme();
  const { unreadCount } = useNotifications();
  const tabBarInset = useTabBarInset(18);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);

  const [top, setTop] = useState([]);
  const [rest, setRest] = useState([]);
  const [me, setMe] = useState(null);
  const [matches, setMatches] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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
  const scrollRef = useRef(null);

  useTabReselect('SocialTab', () => {
    scrollRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  });

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
    pageNum = 1,
    append = false,
  } = {}) => {
    if (!token || isGuest) {
      setLoading(false);
      return;
    }
    const id = ++fetchId.current;
    const isSearch = !!searchQuery.trim();
    if (isSearch) setSearching(true);
    else if (append) setLoadingMore(true);
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
      } else if (pageNum === 1 && !append) {
        const result = await fetchWithCache(
          cacheKeys.leaderboardPage1(),
          () => coursesApi.getLeaderboard(token, { page: 1, pageSize: PAGE_SIZE }),
          { freshMs: TTL.LEADERBOARD_MS, staleMs: TTL.LEADERBOARD_MS * 4, force },
        );
        data = result.data;
      } else {
        data = await coursesApi.getLeaderboard(token, {
          page: pageNum,
          pageSize: PAGE_SIZE,
        });
      }
      if (id !== fetchId.current) return;

      if (isSearch) {
        setMatches(data.entries || []);
      } else if (append) {
        setRest((prev) => {
          const seen = new Set(prev.map((e) => e.user_id));
          const incoming = (data.entries || []).filter((e) => !seen.has(e.user_id));
          return [...prev, ...incoming];
        });
      } else {
        const topList = data.top || [];
        let meData = data.me || null;
        const meInTop = topList.find((e) => e.is_me);
        if (meInTop) meData = { ...meInTop, is_me: true };
        setTop(topList);
        setRest([]);
        setMe(meData);
        setMatches([]);
        setTotalCount(data.total_count || data.pagination?.total_count || 0);
        hasLoadedRef.current = true;
      }
      if (!isSearch) {
        setPage(pageNum);
        setHasNext(!!data.pagination?.has_next);
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
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [token, isGuest]);

  const loadMore = useCallback(() => {
    if (search || loadingMore || loading || !hasNext) return;
    fetchLeaderboard({ pageNum: page + 1, append: true, soft: true });
  }, [search, loadingMore, loading, hasNext, page, fetchLeaderboard]);

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

  const first = top.find((e) => e.rank === 1) || top[0];
  const second = top.find((e) => e.rank === 2) || top[1];
  const third = top.find((e) => e.rank === 3) || top[2];
  const thePack = top.filter((e) => e.rank > 3);
  const inTop = me && me.rank <= TOP_DISPLAY;
  const loadedCount = top.length + rest.length;

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>Leaderboard</Text>
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => goSocial('view notifications', 'Notifications')}
          activeOpacity={0.85}
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={18} color={colors.white} />
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
          <Ionicons name="person-add-outline" size={18} color={colors.white} />
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount > 99 ? '99+' : pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const hub = (
    <View style={styles.hubRow}>
      <HubButton icon="people" label="Friends" count={friendCount} onPress={() => goSocial('view friends', 'MyFriends')} styles={styles} colors={colors} />
      <HubButton icon="people-circle" label="Groups" count={groupCount} alert={inviteCount > 0} onPress={() => goSocial('view groups', 'Groups')} styles={styles} colors={colors} />
      <HubButton icon="newspaper" label="Feed" onPress={() => navigation.navigate('Feed')} styles={styles} colors={colors} />
      <HubButton icon="share-social" label="Contacts" onPress={() => goSocial('invite from contacts', 'ContactInvite')} styles={styles} colors={colors} />
    </View>
  );

  const listHeader = (
    <>
      {pendingCount > 0 && !search ? (
        <TouchableOpacity
          style={styles.pendingBanner}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('FriendRequests')}
        >
          <Ionicons name="mail-unread" size={16} color={colors.primary} />
          <Text style={styles.pendingText}>
            {pendingCount} friend request{pendingCount !== 1 ? 's' : ''}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search learners"
          placeholderTextColor={colors.textMuted}
          value={searchInput}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searching ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : searchInput ? (
          <TouchableOpacity onPress={clearSearch} hitSlop={10}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {error && top.length === 0 && !search ? (
        <View style={styles.empty}>
          <Ionicons name="cloud-offline" size={32} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Couldn't load the board</Text>
          <Text style={styles.emptyBody}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={() => fetchLeaderboard({ force: true })}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : search ? (
        <View>
          <Text style={styles.sectionLabel}>Results</Text>
          {searching && matches.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
          ) : matches.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptyBody}>Try a different name or email.</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.leaderboardCard}>
          <View style={styles.leaderboardHeader}>
            <Text style={styles.leaderboardTitle}>Top 3</Text>
            <Text style={styles.leaderboardSub}>Literacy points this week</Text>
          </View>

          {top.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No learners yet</Text>
              <Text style={styles.emptyBody}>Finish a lesson to take a spot.</Text>
            </View>
          ) : (
            <>
              <View style={styles.topRow}>
                <TopThreeSlot entry={second} place={2} onPress={() => openProfile(second)} styles={styles} />
                <TopThreeSlot entry={first} place={1} onPress={() => openProfile(first)} styles={styles} />
                <TopThreeSlot entry={third} place={3} onPress={() => openProfile(third)} styles={styles} />
              </View>

              {thePack.length > 0 ? (
                <View style={styles.lbDivider} />
              ) : null}

              {thePack.map((entry) => (
                <LeaderboardRow
                  key={entry.user_id}
                  entry={entry}
                  colors={colors}
                  styles={styles}
                  onPress={() => openProfile(entry)}
                  highlight={entry.is_me}
                />
              ))}
            </>
          )}
        </View>
      )}
    </>
  );

  const listFooter = !search && top.length > 0 ? (
    <View style={styles.listFooter}>
      {loadingMore ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
      ) : null}
      {totalCount > 0 ? (
        <Text style={styles.footerMeta}>
          {hasNext
            ? `Showing ${Math.min(loadedCount, totalCount).toLocaleString()} of ${totalCount.toLocaleString()} learners`
            : `${totalCount.toLocaleString()} learners ranked`}
        </Text>
      ) : null}
    </View>
  ) : null;

  if (isGuest) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe} edges={['top']}>
          {header}
          <View style={styles.guestCard}>
            <LinearGradient
              colors={['rgba(245,183,43,0.18)', 'rgba(61,220,95,0.06)', 'transparent']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.guestIcon}>
              <Ionicons name="trophy" size={28} color="#F5B72B" />
            </View>
            <Text style={styles.guestTitle}>Get ranked</Text>
            <Text style={styles.guestBody}>
              Literacy score vs other learners. Friends, groups, and the podium need a free account. Lessons stay open either way.
            </Text>
            <PuckButton
              color={colors.primary}
              height={52}
              borderRadius={16}
              lip={5}
              onPress={() => {
                const rootNav = navigation?.getParent?.() ?? navigation;
                rootNav?.navigate?.('AuthUpgrade', { mode: 'register' });
              }}
            >
              <Text style={styles.guestCta}>Create free account</Text>
            </PuckButton>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (loading && top.length === 0 && !me) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <BrandLoader message="Loading the board…" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <View style={styles.hubWrap}>{hub}</View>
        <FlatList
          ref={scrollRef}
          data={search ? matches : rest}
          keyExtractor={(item) => String(item.user_id)}
          renderItem={({ item }) => (
            <LeaderboardRow
              entry={item}
              colors={colors}
              styles={styles}
              onPress={() => openProfile(item)}
              highlight={item.is_me}
            />
          )}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
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
        />

        {me && !search ? (
          <TouchableOpacity
            style={styles.youBar}
            activeOpacity={0.75}
            onPress={() => openProfile(me)}
          >
            <Text style={styles.youBarRank}>{me.rank}</Text>
            <View style={styles.youBarMid}>
              <Text style={styles.youBarName} numberOfLines={1}>
                {formatDisplayName(me.display_name)}
              </Text>
              <Text style={styles.youBarMeta}>
                {inTop ? `Top ${TOP_DISPLAY} · ${ptsOf(me).toLocaleString()} pts` : 'Keep learning to reach the top 3'}
              </Text>
            </View>
            <Text style={styles.youBarPts}>{ptsOf(me).toLocaleString()}</Text>
          </TouchableOpacity>
        ) : null}
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
  scroll: { paddingHorizontal: 16, paddingBottom: 88 },
  listFooter: {
    paddingTop: 4,
    paddingBottom: 8,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.7,
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: colors.background },

  hubRow: { flexDirection: 'row', gap: 8 },
  hubWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  hubTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hubIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubAlert: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  hubLabel: { fontSize: 11, fontWeight: '700', color: colors.white },
  hubCount: { fontSize: 10, fontWeight: '800', color: colors.textMuted, marginTop: -2 },

  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryTint,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
  },
  pendingText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.primary },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.white, paddingVertical: 0 },

  leaderboardCard: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  leaderboardHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  leaderboardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.3,
  },
  leaderboardSub: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 20,
  },
  topSlot: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    paddingHorizontal: 4,
  },
  topSlotFirst: {
    marginTop: -8,
  },
  topAvatarRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 8,
    backgroundColor: colors.surfaceElevated,
  },
  topAvatarGhost: {
    backgroundColor: colors.surfaceElevated,
  },
  topRankBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  topRankBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A0A0A',
  },
  topYouDot: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  topRankLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 2,
  },
  topName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
    maxWidth: 88,
    textAlign: 'center',
  },
  topNameFirst: {
    fontSize: 14,
    fontWeight: '700',
  },
  topPts: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  topPtsMuted: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  lbDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lbRowHighlight: {
    backgroundColor: colors.primaryTint,
  },
  lbRank: {
    width: 22,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  lbBody: {
    flex: 1,
    minWidth: 0,
  },
  lbName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
    letterSpacing: -0.2,
  },
  lbMeta: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  lbPts: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
    fontVariant: ['tabular-nums'],
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  footerMeta: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
    marginBottom: 4,
  },

  youBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: tabBarInset,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  youBarRank: {
    width: 28,
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  youBarMid: { flex: 1, minWidth: 0 },
  youBarName: { fontSize: 14, fontWeight: '600', color: colors.white },
  youBarMeta: { fontSize: 12, fontWeight: '500', color: colors.textMuted, marginTop: 2 },
  youBarPts: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  guestCard: {
    margin: 16,
    padding: 24,
    borderRadius: 24,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    overflow: 'hidden',
    gap: 10,
  },
  guestIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245,183,43,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  guestTitle: { fontSize: 22, fontWeight: '800', color: colors.white, letterSpacing: -0.4 },
  guestBody: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', fontWeight: '500', marginBottom: 8 },
  guestCta: { fontSize: 15, fontWeight: '800', color: '#0A0A0A' },

  empty: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.white },
  emptyBody: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  retry: {
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryText: { fontSize: 13, fontWeight: '800', color: '#0A0A0A' },
});
