import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { socialApi } from '../../api/social';
import { BrandAvatar, BrandLoader } from '../../components/brand';
import UserProfileSheet from '../../components/social/UserProfileSheet';
import { useTabBarInset } from '../../navigation/tabBarLayout';
import { requireAccount } from '../../utils/requireAccount';
import { localDate } from '../../utils/localDate';

function formatName(name) {
  if (!name) return 'Learner';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export default function MyFriendsScreen({ navigation }) {
  const { token, isGuest } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const tabInset = useTabBarInset(24);

  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [profileUser, setProfileUser] = useState(null);

  const load = useCallback(async () => {
    if (!token || isGuest) {
      setLoading(false);
      return;
    }
    try {
      const friendsRes = await socialApi.getFriends(token, localDate());
      setFriends(friendsRes.friends || []);
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
    if (isGuest || !token || q.trim().length < 2) {
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
      setSearchQuery('');
      setSearchResults([]);
      Alert.alert('Sent', 'Friend request sent!');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not send request.');
    } finally {
      setActionId(null);
    }
  };

  const handleNudge = async (friend) => {
    if (!requireAccount({ isGuest, navigation, feature: 'nudge friends' })) return;
    if (friend.can_nudge === false) {
      Alert.alert('Already nudged', 'You already nudged them today. Try again tomorrow!');
      return;
    }
    setActionId(`nudge-${friend.user_id}`);
    try {
      await socialApi.nudgeFriend(token, friend.user_id, localDate());
      setFriends((prev) => prev.map((f) => (
        f.user_id === friend.user_id ? { ...f, can_nudge: false } : f
      )));
      Alert.alert(
        'Nudge sent!',
        `${formatName(friend.display_name)} will get a push to hop back on MoneyBot.`,
      );
    } catch (e) {
      const msg = e.message || 'Could not send nudge.';
      Alert.alert(e.code === 'nudge_limit' ? 'Already nudged' : 'Error', msg);
      if (e.code === 'nudge_limit' || /already nudged/i.test(msg)) {
        setFriends((prev) => prev.map((f) => (
          f.user_id === friend.user_id ? { ...f, can_nudge: false } : f
        )));
      }
    } finally {
      setActionId(null);
    }
  };

  const handleRemove = (friend) => {
    if (!requireAccount({ isGuest, navigation, feature: 'manage friends' })) return;
    Alert.alert(
      'Remove friend',
      `Remove ${formatName(friend.display_name)} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionId(`remove-${friend.user_id}`);
            try {
              await socialApi.removeFriend(token, friend.user_id);
              setFriends((prev) => prev.filter((f) => f.user_id !== friend.user_id));
            } catch (e) {
              Alert.alert('Error', e.message || 'Could not remove friend.');
            } finally {
              setActionId(null);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <BrandLoader message="Loading friends…" />
      </LinearGradient>
    );
  }

  const isSearching = searchQuery.length >= 2;
  const data = isSearching ? searchResults : friends;

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.headerBody}>
            <Text style={styles.title}>Friends</Text>
            <Text style={styles.subtitle}>
              {friends.length} friend{friends.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.requestsBtn}
            onPress={() => navigation.navigate('FriendRequests')}
            activeOpacity={0.85}
          >
            <Ionicons name="person-add" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Find people by name or email"
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

        <FlatList
          data={data}
          keyExtractor={(item) => String(item.user_id)}
          contentContainerStyle={[styles.list, { paddingBottom: tabInset }]}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Ionicons name={isSearching ? 'search-outline' : 'people-outline'} size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {isSearching ? 'No users found' : 'No friends yet'}
              </Text>
              <Text style={styles.emptyBody}>
                {isSearching
                  ? 'Try a different name or email.'
                  : 'Search above or add someone from the leaderboard.'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const nudging = actionId === `nudge-${item.user_id}`;
            const removing = actionId === `remove-${item.user_id}`;
            const busy = nudging || removing || actionId === item.user_id;
            const canNudge = item.can_nudge !== false;

            return (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.88}
                onPress={() => setProfileUser(item)}
              >
                <BrandAvatar character={item.equipped_character} size={46} autoRotate={!!item.equipped_character} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>{formatName(item.display_name)}</Text>
                  <Text style={styles.rowSub}>
                    {isSearching
                      ? (item.friendship_status === 'pending' ? 'Request pending' : 'Tap to view')
                      : (canNudge ? 'Friend' : 'Nudged today')}
                  </Text>
                </View>

                {!isSearching && (
                  <View style={styles.friendActions}>
                    <TouchableOpacity
                      style={[styles.iconBtn, styles.nudgeBtn, !canNudge && styles.iconBtnDisabled]}
                      onPress={() => handleNudge(item)}
                      disabled={busy || !canNudge}
                      accessibilityLabel={canNudge ? 'Nudge friend' : 'Already nudged today'}
                    >
                      {nudging ? (
                        <ActivityIndicator size="small" color={colors.background} />
                      ) : (
                        <Ionicons name="hand-left" size={16} color={colors.background} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconBtn, styles.removeBtn]}
                      onPress={() => handleRemove(item)}
                      disabled={busy}
                      accessibilityLabel="Remove friend"
                    >
                      {removing ? (
                        <ActivityIndicator size="small" color={colors.error} />
                      ) : (
                        <Ionicons name="person-remove-outline" size={16} color={colors.error} />
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {isSearching && item.friendship_status !== 'pending' && item.friendship_status !== 'accepted' && (
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => handleSendRequest(item.user_id)}
                    disabled={busy}
                  >
                    <Ionicons name="person-add" size={15} color={colors.background} />
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                )}
                {isSearching && item.friendship_status === 'pending' && (
                  <Text style={styles.pendingLabel}>Pending</Text>
                )}
                {isSearching && item.friendship_status === 'accepted' && (
                  <Text style={styles.pendingLabel}>Friends</Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>

      <UserProfileSheet
        visible={!!profileUser}
        userId={profileUser?.user_id}
        seed={profileUser}
        onClose={() => setProfileUser(null)}
        navigation={navigation}
        onChanged={load}
      />
    </LinearGradient>
  );
}

const makeStyles = (colors, isDark) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
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
  headerBody: { flex: 1 },
  title: { fontSize: 24, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  requestsBtn: {
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
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.white,
    paddingVertical: 13,
  },
  list: { paddingHorizontal: 20, paddingTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.white },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  friendActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeBtn: { backgroundColor: colors.primary },
  iconBtnDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.65,
  },
  removeBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addBtnText: { fontSize: 13, fontWeight: '800', color: colors.background },
  pendingLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.white, marginTop: 8 },
  emptyBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});
