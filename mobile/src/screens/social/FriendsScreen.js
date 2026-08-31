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
import { coursesApi } from '../../api/courses';
import { socialApi } from '../../api/social';
import { cacheKeys, fetchWithCache, TTL } from '../../utils/apiCache';
import { BrandAvatar, BrandLoader } from '../../components/brand';
import PuckButton from '../../components/PuckButton';
import UserProfileSheet from '../../components/social/UserProfileSheet';
import { useTabBarInset } from '../../navigation/tabBarLayout';
import { useTabReselect } from '../../navigation/tabReselect';
import { requireAccount } from '../../utils/requireAccount';

const TOP_N = 10;
const SEARCH_DEBOUNCE_MS = 350;

const PODIUM = {
  1: { color: '#F5B72B', height: 96, avatar: 64, icon: 'trophy' },
  2: { color: '#C5D0DA', height: 72, avatar: 52, icon: 'medal' },
  3: { color: '#D4924A', height: 60, avatar: 48, icon: 'medal' },
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
    <PuckButton
      color={colors.surfaceElevated}
      height={78}
      borderRadius={14}
      lip={5}
      onPress={onPress}
      style={styles.hubPuck}
      contentStyle={styles.hubInner}
    >
      <View style={styles.hubIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        {alert ? <View style={styles.hubAlert} /> : null}
      </View>
      <Text style={styles.hubLabel} numberOfLines={1}>{label}</Text>
      {count > 0 ? <Text style={styles.hubCount}>{count}</Text> : null}
    </PuckButton>
  );
}

function PodiumSlot({ entry, place, onPress, styles }) {
  const meta = PODIUM[place];
  if (!entry) {
    return (
      <View style={[styles.podiumSlot, place === 1 && styles.podiumSlotFirst]}>
        <View style={[styles.podiumAvatarRing, { borderColor: meta.color, width: meta.avatar + 8, height: meta.avatar + 8, borderRadius: (meta.avatar + 8) / 2 }]}>
          <View style={[styles.podiumGhost, { width: meta.avatar, height: meta.avatar, borderRadius: meta.avatar / 2 }]} />
        </View>
        <View style={[styles.podiumColumn, { height: meta.height, backgroundColor: `${meta.color}22`, borderColor: `${meta.color}55` }]}>
          <Ionicons name={meta.icon} size={18} color={meta.color} />
          <Text style={[styles.podiumPlace, { color: meta.color }]}>#{place}</Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.podiumSlot, place === 1 && styles.podiumSlotFirst]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[styles.podiumAvatarRing, { borderColor: meta.color, width: meta.avatar + 8, height: meta.avatar + 8, borderRadius: (meta.avatar + 8) / 2 }]}>
        <BrandAvatar
          character={entry.equipped_character}
          size={meta.avatar}
          autoRotate={place === 1}
        />
        {entry.is_me ? (
          <View style={styles.podiumYou}>
            <Text style={styles.podiumYouText}>YOU</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.podiumName} numberOfLines={1}>
        {formatDisplayName(entry.display_name)}
      </Text>
      <Text style={styles.podiumPts}>{ptsOf(entry).toLocaleString()} pts</Text>
      <View style={[styles.podiumColumn, { height: meta.height, backgroundColor: `${meta.color}22`, borderColor: `${meta.color}66` }]}>
        <Ionicons name={meta.icon} size={place === 1 ? 22 : 18} color={meta.color} />
        <Text style={[styles.podiumPlace, { color: meta.color }]}>#{place}</Text>
      </View>
    </TouchableOpacity>
  );
}

function PackRow({ entry, colors, styles, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.packRow, entry.is_me && styles.packRowMe]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <Text style={styles.packRank}>#{entry.rank}</Text>
      <BrandAvatar
        character={entry.equipped_character}
        size={36}
        autoRotate={false}
      />
      <Text style={styles.packName} numberOfLines={1}>
        {formatDisplayName(entry.display_name)}
      </Text>
      {entry.streak_days > 0 ? (
        <View style={styles.packStreak}>
          <Ionicons name="flame" size={11} color={colors.streak} />
          <Text style={styles.packStreakText}>{entry.streak_days}</Text>
        </View>
      ) : null}
      <Text style={styles.packPts}>{ptsOf(entry).toLocaleString()}</Text>
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
  const scrollRef = useRef(null);

  useTabReselect('SocialTab', () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
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

  const first = top.find((e) => e.rank === 1) || top[0];
  const second = top.find((e) => e.rank === 2) || top[1];
  const third = top.find((e) => e.rank === 3) || top[2];
  const thePack = top.filter((e) => e.rank > 3);
  const inTop = me && me.rank <= TOP_N;

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
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
          {hub}

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
              ) : (
                matches.map((entry) => (
                  <PackRow
                    key={entry.user_id}
                    entry={entry}
                    colors={colors}
                    styles={styles}
                    onPress={() => openProfile(entry)}
                  />
                ))
              )}
            </View>
          ) : (
            <>
              <View style={styles.podiumCard}>
                <LinearGradient
                  colors={['rgba(245,183,43,0.14)', 'rgba(61,220,95,0.05)', 'transparent']}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.podiumKicker}>THIS WEEK&apos;S PODIUM</Text>
                {top.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>No learners yet</Text>
                    <Text style={styles.emptyBody}>Finish a lesson to take a spot.</Text>
                  </View>
                ) : (
                  <View style={styles.podiumRow}>
                    <PodiumSlot entry={second} place={2} onPress={() => openProfile(second)} styles={styles} />
                    <PodiumSlot entry={first} place={1} onPress={() => openProfile(first)} styles={styles} />
                    <PodiumSlot entry={third} place={3} onPress={() => openProfile(third)} styles={styles} />
                  </View>
                )}
              </View>

              {thePack.length > 0 ? (
                <View>
                  <Text style={styles.sectionLabel}>The pack</Text>
                  <View style={styles.packCard}>
                    {thePack.map((entry) => (
                      <PackRow
                        key={entry.user_id}
                        entry={entry}
                        colors={colors}
                        styles={styles}
                        onPress={() => openProfile(entry)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {totalCount > TOP_N ? (
                <Text style={styles.footerMeta}>
                  Top {TOP_N} of {totalCount.toLocaleString()}
                </Text>
              ) : null}
            </>
          )}
        </ScrollView>

        {me && !search ? (
          <TouchableOpacity
            style={styles.youBar}
            activeOpacity={0.88}
            onPress={() => openProfile(me)}
          >
            <View style={styles.youBarLeft}>
              <Text style={styles.youBarKicker}>YOU</Text>
              <Text style={styles.youBarRank}>#{me.rank}</Text>
            </View>
            <View style={styles.youBarMid}>
              <Text style={styles.youBarName} numberOfLines={1}>
                {formatDisplayName(me.display_name)}
              </Text>
              <Text style={styles.youBarMeta}>
                {ptsOf(me).toLocaleString()} pts
                {totalCount ? ` · ${totalCount.toLocaleString()} learners` : ''}
              </Text>
            </View>
            <View style={[styles.youBarPill, !inTop && styles.youBarPillMuted]}>
              <Text style={[styles.youBarPillText, !inTop && styles.youBarPillTextMuted]}>
                {inTop ? `Top ${TOP_N}` : 'Climb'}
              </Text>
            </View>
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

  hubRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  hubPuck: { flex: 1 },
  hubInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  hubIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
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

  podiumCard: {
    borderRadius: 24,
    paddingTop: 14,
    paddingHorizontal: 8,
    paddingBottom: 6,
    marginBottom: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(245,183,43,0.22)',
    overflow: 'hidden',
  },
  podiumKicker: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#F5B72B',
    marginBottom: 12,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  podiumSlot: { flex: 1, alignItems: 'center', minWidth: 0 },
  podiumSlotFirst: { marginBottom: 8 },
  podiumAvatarRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 6,
    backgroundColor: colors.surfaceElevated,
  },
  podiumGhost: { backgroundColor: colors.surfaceElevated },
  podiumYou: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  podiumYouText: { fontSize: 8, fontWeight: '900', color: '#0A0A0A', letterSpacing: 0.4 },
  podiumName: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.white,
    maxWidth: 96,
    textAlign: 'center',
  },
  podiumPts: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
  podiumColumn: {
    width: '88%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  podiumPlace: { fontSize: 13, fontWeight: '900', letterSpacing: -0.3 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  packCard: {
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 8,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  packRowMe: { backgroundColor: colors.primaryTint },
  packRank: { width: 28, fontSize: 13, fontWeight: '800', color: colors.textMuted },
  packName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.white },
  packStreak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  packStreakText: { fontSize: 11, fontWeight: '700', color: colors.streak },
  packPts: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, minWidth: 40, textAlign: 'right' },

  footerMeta: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
    marginBottom: 4,
  },

  youBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: tabBarInset,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  youBarLeft: { alignItems: 'flex-start' },
  youBarKicker: { fontSize: 9, fontWeight: '900', color: colors.primary, letterSpacing: 1 },
  youBarRank: { fontSize: 20, fontWeight: '800', color: colors.white, letterSpacing: -0.6 },
  youBarMid: { flex: 1, minWidth: 0 },
  youBarName: { fontSize: 14, fontWeight: '800', color: colors.white },
  youBarMeta: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginTop: 1 },
  youBarPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  youBarPillMuted: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  youBarPillText: { fontSize: 11, fontWeight: '800', color: '#0A0A0A' },
  youBarPillTextMuted: { color: colors.white },

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
