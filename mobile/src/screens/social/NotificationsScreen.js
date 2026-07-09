import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationsContext';
import { BrandLoader, BrandEmptyState } from '../../components/brand';
import { useTabBarInset } from '../../navigation/tabBarLayout';

const KIND_META = {
  friend_request: { icon: 'person-add', tint: '#3DDC5F' },
  friend_accepted: { icon: 'checkmark-circle', tint: '#3DDC5F' },
  friend_declined: { icon: 'close-circle', tint: '#FF8C42' },
};

function metaFor(kind) {
  return KIND_META[kind] || { icon: 'notifications', tint: '#56C8E8' };
}

function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export default function NotificationsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const tabInset = useTabBarInset(24);
  const {
    notifications, unreadCount, loading, refresh, markRead, markAllRead,
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);

  useFocusEffect(useCallback(() => {
    refresh({ silent: false }).finally(() => setFirstLoad(false));
  }, [refresh]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh({ silent: true });
    setRefreshing(false);
  }, [refresh]);

  const handlePress = (item) => {
    if (!item.is_read) markRead(item.id);
    if (item.kind === 'friend_request') {
      navigation.navigate('FriendRequests');
    } else if (item.kind === 'friend_accepted') {
      navigation.navigate('Friends');
    }
  };

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllRead} hitSlop={8}>
              <Text style={styles.markAll}>Read all</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
        </View>

        {firstLoad && loading ? (
          <BrandLoader message="Loading notifications…" />
        ) : (
          <ScrollView
            contentContainerStyle={[styles.list, { paddingBottom: tabInset }]}
            refreshControl={(
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            )}
            showsVerticalScrollIndicator={false}
          >
            {notifications.length === 0 ? (
              <BrandEmptyState
                title="You're all caught up"
                body="Friend requests and updates from your crew will show up here."
              />
            ) : (
              notifications.map((item) => {
                const meta = metaFor(item.kind);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.row, !item.is_read && styles.rowUnread]}
                    activeOpacity={0.85}
                    onPress={() => handlePress(item)}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: `${meta.tint}1F` }]}>
                      <Ionicons name={meta.icon} size={22} color={meta.tint} />
                    </View>
                    <View style={styles.body}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                      {!!item.body && <Text style={styles.rowBody} numberOfLines={2}>{item.body}</Text>}
                      <Text style={styles.rowTime}>{timeAgo(item.created_at)}</Text>
                    </View>
                    {!item.is_read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors, isDark) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { width: 60, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: colors.white, letterSpacing: -0.3 },
  markAll: {
    width: 60, textAlign: 'right', fontSize: 14, fontWeight: '800', color: colors.primary,
  },
  list: { paddingHorizontal: 20, paddingTop: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  rowUnread: {
    borderColor: isDark ? 'rgba(61,220,95,0.3)' : 'rgba(22,163,74,0.3)',
    backgroundColor: isDark ? 'rgba(61,220,95,0.06)' : 'rgba(61,220,95,0.05)',
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: colors.white, letterSpacing: -0.2 },
  rowBody: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  rowTime: { fontSize: 11, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
  unreadDot: {
    width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.primary,
  },
});
