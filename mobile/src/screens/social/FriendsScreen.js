import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationsContext';
import { socialApi } from '../../api/social';
import { BrandAvatar, BrandLoader } from '../../components/brand';
import { useTabBarInset } from '../../navigation/tabBarLayout';
import { requireAccount } from '../../utils/requireAccount';
import { GroupIcon } from './groupIcons';

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
};

function hairlineBorder(isDark) {
  return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
}

function formatName(name) {
  if (!name) return 'Learner';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function UserRow({
  user, styles, colors, onPress, rightSlot, subtitle,
}) {
  return (
    <TouchableOpacity
      style={styles.userRow}
      activeOpacity={onPress ? 0.88 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
        style={styles.userRowSheen}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={styles.userAvatarRing}>
        <BrandAvatar character={user.equipped_character} size={46} autoRotate={!!user.equipped_character} />
      </View>
      <View style={styles.userBody}>
        <Text style={styles.userName} numberOfLines={1}>{formatName(user.display_name)}</Text>
        {subtitle ? <Text style={styles.userSub}>{subtitle}</Text> : null}
      </View>
      {rightSlot}
    </TouchableOpacity>
  );
}

function FriendsEmptyHero({ styles, colors }) {
  return (
    <View style={styles.emptyHero}>
      <LinearGradient
        colors={['rgba(61,220,95,0.16)', 'rgba(61,220,95,0.02)', 'transparent']}
        style={styles.emptyHeroGlow}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.emptyHeroIcon}>
        <Ionicons name="people" size={32} color={colors.primary} />
      </View>
      <Text style={styles.emptyHeroTitle}>Build your crew</Text>
      <Text style={styles.emptyHeroBody}>
        Find friends to compete on leaderboards, join groups, and learn together.
      </Text>
      <View style={styles.emptyHeroHint}>
        <Ionicons name="search" size={14} color={colors.primary} />
        <Text style={styles.emptyHeroHintText}>Search by name or email above</Text>
      </View>
    </View>
  );
}

export default function FriendsScreen({ navigation }) {
  const { token, isGuest } = useAuth();
  const { colors, isDark } = useTheme();
  const { unreadCount } = useNotifications();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const tabInset = useTabBarInset(24);

  const [segment, setSegment] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [groups, setGroups] = useState([]);
  const [invites, setInvites] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [actionId, setActionId] = useState(null);

  const goCreateAccount = useCallback(() => {
    requireAccount({ isGuest: true, navigation, feature: 'add friends and join groups' });
  }, [navigation]);

  const load = useCallback(async () => {
    if (!token || isGuest) {
      setLoading(false);
      return;
    }
    try {
      const [friendsRes, requestsRes, groupsRes, invitesRes] = await Promise.all([
        socialApi.getFriends(token),
        socialApi.getRequests(token),
        socialApi.getGroups(token).catch(() => ({ groups: [] })),
        socialApi.getGroupInvites(token).catch(() => ({ invites: [] })),
      ]);
      setFriends(friendsRes.friends || []);
      setIncoming(requestsRes.incoming || []);
      setGroups(groupsRes.groups || []);
      setInvites(invitesRes.invites || []);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not load friends.');
    } finally {
      setLoading(false);
    }
  }, [token, isGuest]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const runSearch = useCallback(async (q) => {
    if (isGuest) {
      setSearchResults([]);
      return;
    }
    if (!token || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await socialApi.searchUsers(token, q.trim());
      setSearchResults(res.results || []);
    } catch (e) {
      Alert.alert('Error', e.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  }, [token, isGuest]);

  const handleSendRequest = async (userId) => {
    if (!requireAccount({ isGuest, navigation, feature: 'send friend requests' })) return;
    setActionId(userId);
    try {
      await socialApi.sendRequest(token, userId);
      await load();
      setSearchQuery('');
      setSearchResults([]);
      Alert.alert('Sent', 'Friend request sent!');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not send request.');
    } finally {
      setActionId(null);
    }
  };

  const handleAcceptInvite = async (inviteId) => {
    if (!requireAccount({ isGuest, navigation, feature: 'join groups' })) return;
    setActionId(inviteId);
    try {
      await socialApi.acceptGroupInvite(token, inviteId);
      await load();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not accept invite.');
    } finally {
      setActionId(null);
    }
  };

  const handleDeclineInvite = async (inviteId) => {
    if (!requireAccount({ isGuest, navigation, feature: 'manage group invites' })) return;
    setActionId(inviteId);
    try {
      await socialApi.declineGroupInvite(token, inviteId);
      await load();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not decline invite.');
    } finally {
      setActionId(null);
    }
  };

  const handleRemoveFriend = (userId, name) => {
    if (!requireAccount({ isGuest, navigation, feature: 'manage friends' })) return;
    Alert.alert('Remove friend', `Remove ${formatName(name)} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await socialApi.removeFriend(token, userId);
            await load();
          } catch (e) {
            Alert.alert('Error', e.message || 'Could not remove friend.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <BrandLoader message="Loading friends…" />
      </LinearGradient>
    );
  }

  // Guests can browse the Community tab, but social actions need a real account
  // (Apple 5.1.1(v) allows gating account-based features).
  if (isGuest) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <ScrollView
            contentContainerStyle={[styles.guestScroll, { paddingBottom: tabInset }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroHeader}>
              <View style={styles.heroHeaderLeft}>
                <Text style={styles.heroEyebrow}>COMMUNITY</Text>
                <Text style={styles.title}>Friends</Text>
                <Text style={styles.heroSub}>Learn, compete, and grow together</Text>
              </View>
            </View>

            <View style={styles.guestLockCard}>
              <LinearGradient
                colors={['rgba(61,220,95,0.16)', 'rgba(61,220,95,0.02)', 'transparent']}
                style={styles.emptyHeroGlow}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.emptyHeroIcon}>
                <Ionicons name="lock-closed" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyHeroTitle}>Create an account to connect</Text>
              <Text style={styles.emptyHeroBody}>
                Friends, groups, and challenges need a free account so your connections stay with you.
                Lessons and learning stay available without signing up.
              </Text>
              <TouchableOpacity
                style={styles.guestCtaBtn}
                activeOpacity={0.9}
                onPress={goCreateAccount}
              >
                <Text style={styles.guestCtaBtnText}>Create free account</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const pendingCount = incoming.length;
  const isSearching = searchQuery.length >= 2;

  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.heroHeader}>
        <View style={styles.heroHeaderLeft}>
          <Text style={styles.heroEyebrow}>COMMUNITY</Text>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.heroSub}>Learn, compete, and grow together</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.requestsBtn}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.85}
          >
            <Ionicons name="notifications" size={20} color={colors.white} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.requestsBtn}
            onPress={() => navigation.navigate('FriendRequests')}
            activeOpacity={0.85}
          >
            <Ionicons name="person-add" size={20} color={colors.white} />
            {pendingCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount > 99 ? '99+' : pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statVal}>{friends.length}</Text>
          <Text style={styles.statLbl}>Friends</Text>
        </View>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statChip}
          onPress={() => pendingCount > 0 && navigation.navigate('FriendRequests')}
          activeOpacity={pendingCount > 0 ? 0.8 : 1}
        >
          <Text style={[styles.statVal, pendingCount > 0 && styles.statValAccent]}>{pendingCount}</Text>
          <Text style={styles.statLbl}>Pending</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <View style={styles.statChip}>
          <Text style={styles.statVal}>{groups.length}</Text>
          <Text style={styles.statLbl}>Groups</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email"
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={(t) => {
            setSearchQuery(t);
            runSearch(t);
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searching && <Ionicons name="hourglass-outline" size={16} color={colors.textMuted} />}
        {searchQuery.length > 0 && !searching && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {!isSearching && (
        <View style={styles.segmentPill}>
          {['friends', 'groups'].map((key) => {
            const active = segment === key;
            const showDot = key === 'groups' && invites.length > 0;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.segmentOption, active && styles.segmentOptionActive]}
                onPress={() => setSegment(key)}
                activeOpacity={0.85}
              >
                {active && (
                  <LinearGradient
                    colors={[colors.primaryLight, colors.primary]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                )}
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {key === 'friends' ? 'Friends' : 'Groups'}
                </Text>
                {showDot && !active && <View style={styles.segmentDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!isSearching && segment === 'friends' && pendingCount > 0 && (
        <TouchableOpacity
          style={styles.pendingBanner}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('FriendRequests')}
        >
          <LinearGradient
            colors={['rgba(61,220,95,0.14)', 'rgba(61,220,95,0.04)']}
            style={styles.pendingBannerGlow}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <View style={styles.pendingBannerIcon}>
            <Ionicons name="mail-unread" size={20} color={colors.primary} />
          </View>
          <View style={styles.pendingBannerBody}>
            <Text style={styles.pendingBannerTitle}>
              {pendingCount} friend request{pendingCount !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.pendingBannerSub}>Tap to review and accept</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>
      )}

      {!isSearching && segment === 'groups' && (
        <TouchableOpacity
          style={styles.createGroupHero}
          activeOpacity={0.9}
          onPress={() => {
            if (!requireAccount({ isGuest, navigation, feature: 'create a group' })) return;
            navigation.navigate('CreateGroup');
          }}
        >
          <LinearGradient
            colors={['rgba(61,220,95,0.2)', 'rgba(61,220,95,0.04)', 'transparent']}
            style={styles.createGroupGlow}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.createGroupIcon}>
            <Ionicons name="add" size={24} color={colors.background} />
          </View>
          <View style={styles.createGroupBody}>
            <Text style={styles.createGroupEyebrow}>NEW GROUP</Text>
            <Text style={styles.createGroupTitle}>Start a crew</Text>
            <Text style={styles.createGroupSub}>Compete with friends on challenges</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderGroupsContent = () => (
    <ScrollView
      contentContainerStyle={[styles.groupsScroll, { paddingBottom: tabInset }]}
      showsVerticalScrollIndicator={false}
    >
      {listHeader}

      {invites.length > 0 && (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionEyebrow}>INVITATIONS</Text>
          {invites.map((inv) => (
            <View key={inv.invite_id} style={styles.inviteCard}>
              <View style={styles.groupIconWrap}>
                <GroupIcon iconKey={inv.group.emoji} size={24} color={colors.primary} />
              </View>
              <View style={styles.groupBody}>
                <Text style={styles.groupName} numberOfLines={1}>{inv.group.name}</Text>
                <Text style={styles.groupMeta}>Invited by {inv.invited_by}</Text>
              </View>
              <View style={styles.requestActions}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleAcceptInvite(inv.invite_id)}
                  disabled={actionId === inv.invite_id}
                >
                  <Ionicons name="checkmark" size={18} color={colors.background} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={() => handleDeclineInvite(inv.invite_id)}
                  disabled={actionId === inv.invite_id}
                >
                  <Ionicons name="close" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {groups.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionEyebrow}>YOUR GROUPS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupCarousel}>
            {groups.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.groupCarouselCard}
                activeOpacity={0.88}
                onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
              >
                <View style={styles.groupCarouselIcon}>
                  <GroupIcon iconKey={item.emoji} size={28} color={colors.primary} />
                </View>
                <Text style={styles.groupCarouselName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.groupCarouselMeta}>
                  {item.member_count} member{item.member_count !== 1 ? 's' : ''}
                </Text>
                {item.active_challenge ? (
                  <View style={styles.challengePill}>
                    <Ionicons name="trophy" size={10} color={colors.primary} />
                    <Text style={styles.challengePillText} numberOfLines={1}>{item.active_challenge.title}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.groupsEmpty}>
          <Ionicons name="people-circle-outline" size={48} color={colors.textMuted} />
          <Text style={styles.groupsEmptyTitle}>No groups yet</Text>
          <Text style={styles.groupsEmptyBody}>Create a group and invite friends to compete together.</Text>
        </View>
      )}
    </ScrollView>
  );

  if (isSearching) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => String(item.user_id)}
            ListHeaderComponent={listHeader}
            contentContainerStyle={[styles.list, { paddingBottom: tabInset }]}
            ListEmptyComponent={(
              <View style={styles.searchEmpty}>
                <Ionicons name="search-outline" size={40} color={colors.textMuted} />
                <Text style={styles.searchEmptyTitle}>No users found</Text>
                <Text style={styles.searchEmptyBody}>Try a different name or email.</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <UserRow
                user={item}
                styles={styles}
                colors={colors}
                rightSlot={(
                  item.friendship_status === 'pending' ? (
                    <Text style={styles.pendingLabel}>Pending</Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => handleSendRequest(item.user_id)}
                      disabled={actionId === item.user_id}
                    >
                      <Ionicons name="person-add" size={15} color={colors.background} />
                      <Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                  )
                )}
              />
            )}
          />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (segment === 'groups') {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe} edges={['top']}>
          {renderGroupsContent()}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <FlatList
          data={friends}
          keyExtractor={(item) => String(item.user_id)}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[styles.list, { paddingBottom: tabInset }]}
          ListEmptyComponent={<FriendsEmptyHero styles={styles} colors={colors} />}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              styles={styles}
              colors={colors}
              subtitle="Friend"
              rightSlot={(
                <TouchableOpacity
                  onPress={() => handleRemoveFriend(item.user_id, item.display_name)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            />
          )}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors, isDark) => {
  const hairline = hairlineBorder(isDark);
  const cardBase = {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: hairline,
    overflow: 'hidden',
    ...CARD_SHADOW,
  };

  return StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    listHeader: { marginBottom: 8 },
    list: { paddingHorizontal: 20 },

    heroHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingTop: 8,
      marginBottom: 28,
    },
    heroHeaderLeft: { flex: 1, marginRight: 12 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    heroEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: 4,
    },
    title: { fontSize: 30, fontWeight: '800', color: colors.white, letterSpacing: -0.8, marginBottom: 4 },
    heroSub: { fontSize: 14, color: colors.textSecondary, fontWeight: '500', lineHeight: 20 },
    requestsBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: hairline,
      ...CARD_SHADOW,
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#FF3B30',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
      borderWidth: 2,
      borderColor: colors.background,
    },
    badgeText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },

    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      ...cardBase,
      borderRadius: 18,
      paddingVertical: 14,
      marginBottom: 16,
      shadowOpacity: 0.25,
      elevation: 4,
    },
    statChip: { flex: 1, alignItems: 'center', gap: 2 },
    statVal: { fontSize: 20, fontWeight: '800', color: colors.white, letterSpacing: -0.3 },
    statValAccent: { color: colors.primary },
    statLbl: { fontSize: 10, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.3 },
    statDivider: { width: 1, height: 28, backgroundColor: hairline },

    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderWidth: 1,
      borderColor: hairline,
      ...CARD_SHADOW,
    },
    searchInput: { flex: 1, fontSize: 15, color: colors.white, padding: 0, fontWeight: '500' },

    segmentPill: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
      borderRadius: 14,
      padding: 4,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: hairline,
    },
    segmentOption: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 11,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      overflow: 'hidden',
    },
    segmentOptionActive: {},
    segmentText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    segmentTextActive: { color: colors.background, fontWeight: '800' },
    segmentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF3B30' },

    pendingBanner: {
      ...cardBase,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      marginBottom: 16,
      borderColor: isDark ? 'rgba(61,220,95,0.25)' : 'rgba(22,163,74,0.25)',
      position: 'relative',
    },
    pendingBannerGlow: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 20,
    },
    pendingBannerIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primaryTintStrong,
    },
    pendingBannerBody: { flex: 1 },
    pendingBannerTitle: { fontSize: 15, fontWeight: '800', color: colors.white, letterSpacing: -0.2 },
    pendingBannerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

    createGroupHero: {
      ...cardBase,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 18,
      marginBottom: 8,
      borderColor: isDark ? 'rgba(61,220,95,0.2)' : 'rgba(22,163,74,0.2)',
      position: 'relative',
    },
    createGroupGlow: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 20,
    },
    createGroupIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createGroupBody: { flex: 1 },
    createGroupEyebrow: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 1,
      marginBottom: 2,
    },
    createGroupTitle: { fontSize: 17, fontWeight: '800', color: colors.white, letterSpacing: -0.3 },
    createGroupSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

    groupsScroll: { paddingHorizontal: 20 },
    sectionBlock: { marginBottom: 20 },
    sectionEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: 12,
    },

    userRow: {
      ...cardBase,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      marginBottom: 10,
      position: 'relative',
      shadowOpacity: 0.22,
      elevation: 4,
    },
    userRowSheen: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 50,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    userAvatarRing: {
      borderRadius: 25,
      borderWidth: 2,
      borderColor: colors.primaryTintStrong,
      padding: 1,
    },
    userBody: { flex: 1, minWidth: 0 },
    userName: { fontSize: 16, fontWeight: '800', color: colors.white, letterSpacing: -0.2 },
    userSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '500' },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 12,
      ...CARD_SHADOW,
    },
    addBtnText: { fontSize: 12, fontWeight: '800', color: colors.background },
    pendingLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },

    emptyHero: {
      ...cardBase,
      alignItems: 'center',
      padding: 32,
      marginTop: 8,
      position: 'relative',
      borderColor: isDark ? 'rgba(61,220,95,0.15)' : 'rgba(22,163,74,0.15)',
    },
    emptyHeroGlow: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 20,
    },
    emptyHeroIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: colors.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primaryTintStrong,
      marginBottom: 16,
    },
    emptyHeroTitle: { fontSize: 20, fontWeight: '800', color: colors.white, letterSpacing: -0.3, marginBottom: 8 },
    emptyHeroBody: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: 16,
    },
    emptyHeroHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primaryTint,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.primaryTintStrong,
    },
    emptyHeroHintText: { fontSize: 12, fontWeight: '700', color: colors.primary },

    searchEmpty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
    searchEmptyTitle: { fontSize: 17, fontWeight: '800', color: colors.white },
    searchEmptyBody: { fontSize: 14, color: colors.textSecondary },

    requestActions: { flexDirection: 'row', gap: 8 },
    acceptBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    declineBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: hairline,
    },

    inviteCard: {
      ...cardBase,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      marginBottom: 10,
      borderColor: isDark ? 'rgba(61,220,95,0.3)' : 'rgba(22,163,74,0.3)',
    },
    groupIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryTint,
      borderWidth: 1,
      borderColor: colors.primaryTintStrong,
    },
    groupBody: { flex: 1, minWidth: 0 },
    groupName: { fontSize: 16, fontWeight: '800', color: colors.white, letterSpacing: -0.2 },
    groupMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3, fontWeight: '500' },

    groupCarousel: { gap: 12, paddingRight: 4 },
    groupCarouselCard: {
      width: 156,
      ...cardBase,
      padding: 16,
      shadowOpacity: 0.22,
      elevation: 4,
    },
    groupCarouselIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primaryTintStrong,
      marginBottom: 12,
    },
    groupCarouselName: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.white,
      letterSpacing: -0.2,
      marginBottom: 4,
      minHeight: 36,
    },
    groupCarouselMeta: { fontSize: 11, color: colors.textMuted, fontWeight: '500', marginBottom: 8 },
    challengePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primaryTint,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    challengePillText: { fontSize: 10, fontWeight: '700', color: colors.primary, maxWidth: 120 },

    groupsEmpty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
    groupsEmptyTitle: { fontSize: 17, fontWeight: '800', color: colors.white },
    groupsEmptyBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

    guestScroll: { paddingHorizontal: 20, paddingTop: 8 },
    guestLockCard: {
      ...cardBase,
      alignItems: 'center',
      padding: 32,
      marginTop: 8,
      position: 'relative',
      borderColor: isDark ? 'rgba(61,220,95,0.15)' : 'rgba(22,163,74,0.15)',
    },
    guestCtaBtn: {
      marginTop: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 14,
      ...CARD_SHADOW,
    },
    guestCtaBtnText: { fontSize: 15, fontWeight: '800', color: colors.background },
  });
};
