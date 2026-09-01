import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { socialApi } from '../../api/social';
import { fetchWithCache, TTL } from '../../utils/apiCache';
import { BrandHeader, BrandLoader, BrandEmptyState, BrandToast } from '../../components/brand';
import PuckButton from '../../components/PuckButton';
import { useTabBarInset } from '../../navigation/tabBarLayout';
import { requireAccount } from '../../utils/requireAccount';
import FeedPostCard from './FeedPostCard';
import { FEED_CACHE_KEYS } from './feedHelpers';

export default function FeedScreen({ navigation, route }) {
  const { token, user, isGuest } = useAuth();
  const { colors, isDark } = useTheme();
  const tabInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabInset), [colors, tabInset]);

  const [posts, setPosts] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [tab, setTab] = useState('live');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [upvotingId, setUpvotingId] = useState(null);

  const syncPost = useCallback((postId, patch) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
    setMyPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
  }, []);

  const toggleUpvote = useCallback(async (post) => {
    if (!requireAccount({ isGuest, navigation, feature: 'upvote tips' })) return;
    if (post.status !== 'approved' || upvotingId === post.id) return;

    const nextUpvoted = !post.has_upvoted;
    const nextCount = Math.max(0, (post.upvote_count || 0) + (nextUpvoted ? 1 : -1));
    syncPost(post.id, { has_upvoted: nextUpvoted, upvote_count: nextCount });
    setUpvotingId(post.id);

    try {
      const result = await socialApi.toggleFeedUpvote(token, post.id);
      syncPost(post.id, {
        has_upvoted: result.has_upvoted,
        upvote_count: result.upvote_count,
      });
    } catch {
      syncPost(post.id, {
        has_upvoted: post.has_upvoted,
        upvote_count: post.upvote_count || 0,
      });
      setToast('Could not update upvote. Try again.');
    } finally {
      setUpvotingId(null);
    }
  }, [isGuest, navigation, syncPost, token, upvotingId]);

  const load = useCallback(async ({ force = false } = {}) => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const feedResult = await fetchWithCache(
        FEED_CACHE_KEYS.approved(),
        () => socialApi.getFeed(token),
        { freshMs: TTL.LEADERBOARD_MS, staleMs: TTL.LEADERBOARD_MS * 4, force },
      );
      setPosts(feedResult.data?.results || []);

      if (!isGuest) {
        const mineResult = await fetchWithCache(
          FEED_CACHE_KEYS.mine(user?.id),
          () => socialApi.getMyFeed(token),
          { freshMs: TTL.LEADERBOARD_MS, staleMs: TTL.LEADERBOARD_MS * 4, force },
        );
        setMyPosts(mineResult.data?.results || []);
      } else {
        setMyPosts([]);
      }
    } catch {
      // Keep whatever is already on screen.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, isGuest, user?.id]);

  useFocusEffect(
    useCallback(() => {
      const posted = !!route.params?.posted;
      load({ force: posted });
      if (posted) {
        setToast('Sent for review. It goes live after an admin checks it.');
        setTab('mine');
        navigation.setParams({ posted: undefined });
      }
    }, [load, navigation, route.params?.posted]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ force: true });
  }, [load]);

  const openCompose = () => {
    if (!requireAccount({ isGuest, navigation, feature: 'share a money tip' })) return;
    navigation.navigate('ComposeFeed');
  };

  const openLink = async (url) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      // user dismissed or no browser
    }
  };

  const pendingOrRejected = myPosts.filter(
    (post) => post.status === 'pending' || post.status === 'rejected',
  );
  const data = tab === 'mine' ? myPosts : posts;

  const header = (
    <>
      {tab === 'live' && !isGuest && pendingOrRejected.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR POSTS</Text>
          {pendingOrRejected.map((post) => (
            <FeedPostCard key={post.id} post={post} compact showStatus />
          ))}
        </View>
      )}
      {tab === 'mine' && myPosts.length > 0 && (
        <Text style={styles.sectionHint}>
          Pending tips wait for an admin. Rejected ones stay off the live feed.
        </Text>
      )}
    </>
  );

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.topBarSpacer} />
          <PuckButton
            color={colors.primary}
            width={40}
            height={40}
            borderRadius={14}
            lip={4}
            onPress={openCompose}
            accessibilityLabel="New post"
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </PuckButton>
        </View>

        <BrandHeader
          title="Feed"
          subtitle="Short money tips from the crew"
          style={styles.brandHeader}
        />

        {!isGuest && (
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tabChip, tab === 'live' && styles.tabChipActive]}
              onPress={() => setTab('live')}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, tab === 'live' && styles.tabTextActive]}>Live</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabChip, tab === 'mine' && styles.tabChipActive]}
              onPress={() => setTab('mine')}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>Yours</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <BrandLoader message="Loading the feed…" />
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <FeedPostCard
                post={item}
                showStatus={tab === 'mine'}
                showUpvote={tab === 'live' || item.status === 'approved'}
                onOpenLink={openLink}
                onToggleUpvote={toggleUpvote}
                upvoteDisabled={upvotingId === item.id}
              />
            )}
            ListHeaderComponent={header}
            ListEmptyComponent={(
              <View style={styles.emptyWrap}>
                <BrandEmptyState
                  title={tab === 'mine' ? 'Nothing from you yet' : 'No tips yet'}
                  body={
                    tab === 'mine'
                      ? 'Share a photo + caption. An admin checks it before it goes live.'
                      : 'Be first — drop a money tip. Guests can browse, posting needs an account.'
                  }
                />
                <View style={styles.emptyCta}>
                  <PuckButton
                    color={colors.primary}
                    height={52}
                    borderRadius={16}
                    lip={5}
                    onPress={openCompose}
                    contentStyle={styles.emptyCtaInner}
                  >
                    <Ionicons name="camera" size={18} color="#FFFFFF" />
                    <Text style={styles.emptyCtaText}>Share a tip</Text>
                  </PuckButton>
                </View>
              </View>
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={(
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            )}
          />
        )}

        <BrandToast visible={!!toast} message={toast} onHide={() => setToast(null)} />
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors, tabInset) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    marginBottom: -8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarSpacer: { flex: 1 },
  brandHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChipActive: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.primaryTintStrong,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: -0.2,
  },
  tabTextActive: {
    color: colors.primary,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: tabInset,
    flexGrow: 1,
  },
  section: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionHint: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  emptyWrap: {
    paddingTop: 32,
  },
  emptyCta: {
    marginTop: 20,
    paddingHorizontal: 24,
  },
  emptyCtaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
