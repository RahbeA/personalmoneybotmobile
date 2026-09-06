import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
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
import { fetchWithCache, invalidateCache, TTL } from '../../utils/apiCache';
import { BrandLoader, BrandEmptyState, BrandToast } from '../../components/brand';
import ScreenAppBar, { screenAppBarTitleStyles } from '../../components/ScreenAppBar';
import PuckButton from '../../components/PuckButton';
import { useTabBarInset } from '../../navigation/tabBarLayout';
import { useTabReselect } from '../../navigation/tabReselect';
import { requireAccount } from '../../utils/requireAccount';
import FeedPostCard from './FeedPostCard';
import FeedTutorial from './FeedTutorial';
import { FEED_CACHE_KEYS } from './feedHelpers';
import { saveRemoteImageToCameraRoll } from './mediaLibrary';
import { readTutorialSeen, persistTutorialSeen } from '../../utils/tutorialStore';

const FEED_TUTORIAL_KEY = 'feedIntro';

export default function FeedScreen({ navigation, route }) {
  const { token, user, isGuest } = useAuth();
  const { colors, isDark } = useTheme();
  const tabInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabInset), [colors, tabInset]);
  const titleStyles = useMemo(() => screenAppBarTitleStyles(colors), [colors]);
  const listRef = useRef(null);

  useTabReselect('FeedTab', () => {
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  });

  const [posts, setPosts] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [vault, setVault] = useState({ mine_private: [], saved: [] });
  const [tab, setTab] = useState('feed');
  const [vaultSection, setVaultSection] = useState('private');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [upvotingId, setUpvotingId] = useState(null);
  const [bookmarkingId, setBookmarkingId] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  // Show the one-time Feed intro once we know who the user is.
  const tutorialUserId = user?.id || (isGuest ? 'guest' : null);
  useEffect(() => {
    let active = true;
    if (!tutorialUserId) return undefined;
    (async () => {
      const seen = await readTutorialSeen(FEED_TUTORIAL_KEY, tutorialUserId);
      if (active && !seen) {
        // Persist as seen the moment we show it, so it never reappears even if
        // the app is closed mid-tutorial (before the user taps Got it/Skip).
        persistTutorialSeen(FEED_TUTORIAL_KEY, tutorialUserId);
        setShowTutorial(true);
      }
    })();
    return () => { active = false; };
  }, [tutorialUserId]);

  const dismissTutorial = useCallback(() => {
    setShowTutorial(false);
    if (tutorialUserId) persistTutorialSeen(FEED_TUTORIAL_KEY, tutorialUserId);
  }, [tutorialUserId]);

  const syncPost = useCallback((postId, patch) => {
    const apply = (p) => (p.id === postId ? { ...p, ...patch } : p);
    setPosts((prev) => prev.map(apply));
    setMyPosts((prev) => prev.map(apply));
    setVault((prev) => ({
      mine_private: prev.mine_private.map(apply),
      saved: prev.saved.map(apply),
    }));
  }, []);

  const reloadVault = useCallback(async () => {
    if (!token || isGuest) return;
    try {
      const res = await fetchWithCache(
        FEED_CACHE_KEYS.vault(user?.id),
        () => socialApi.getVault(token),
        { freshMs: TTL.LEADERBOARD_MS, staleMs: TTL.LEADERBOARD_MS * 4, force: true },
      );
      setVault({
        mine_private: res.data?.mine_private || [],
        saved: res.data?.saved || [],
      });
    } catch {
      // keep current vault
    }
  }, [token, isGuest, user?.id]);

  const toggleUpvote = useCallback(async (post) => {
    if (!requireAccount({ isGuest, navigation, feature: 'like tips' })) return;
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
      setToast('Could not update like. Try again.');
    } finally {
      setUpvotingId(null);
    }
  }, [isGuest, navigation, syncPost, token, upvotingId]);

  const toggleBookmark = useCallback(async (post) => {
    if (!requireAccount({ isGuest, navigation, feature: 'save to your MoneyVault' })) return;
    if (bookmarkingId === post.id) return;

    const nextBookmarked = !post.has_bookmarked;
    syncPost(post.id, { has_bookmarked: nextBookmarked });
    setBookmarkingId(post.id);

    try {
      const result = await socialApi.toggleFeedBookmark(token, post.id);
      syncPost(post.id, { has_bookmarked: result.has_bookmarked });
      await invalidateCache(FEED_CACHE_KEYS.vault(user?.id));
      // Reflect in the vault Saved list right away.
      if (!result.has_bookmarked) {
        setVault((prev) => ({ ...prev, saved: prev.saved.filter((p) => p.id !== post.id) }));
      } else {
        reloadVault();
      }
      setToast(result.has_bookmarked ? 'Saved to MoneyVault.' : 'Removed from MoneyVault.');
    } catch {
      syncPost(post.id, { has_bookmarked: post.has_bookmarked });
      setToast('Could not update bookmark. Try again.');
    } finally {
      setBookmarkingId(null);
    }
  }, [isGuest, navigation, syncPost, token, user?.id, bookmarkingId, reloadVault]);

  const saveImage = useCallback(async (post) => {
    setToast('Saving image…');
    const result = await saveRemoteImageToCameraRoll(post?.image_url);
    if (result.ok) {
      setToast('Saved to your photos.');
    } else if (result.reason === 'unavailable') {
      setToast('Rebuild the app to enable saving photos.');
    } else if (result.reason === 'denied') {
      setToast('Allow photo access in Settings to save.');
    } else {
      setToast('Could not save image. Try again.');
    }
  }, []);

  const deletePost = useCallback((post) => {
    Alert.alert(
      'Delete post?',
      'This removes it for good.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await socialApi.deleteFeedPost(token, post.id);
              const drop = (arr) => arr.filter((p) => p.id !== post.id);
              setPosts(drop);
              setMyPosts(drop);
              setVault((prev) => ({ mine_private: drop(prev.mine_private), saved: drop(prev.saved) }));
              await invalidateCache(FEED_CACHE_KEYS.approved());
              await invalidateCache(FEED_CACHE_KEYS.mine(user?.id));
              await invalidateCache(FEED_CACHE_KEYS.vault(user?.id));
              setToast('Post deleted.');
            } catch {
              setToast('Could not delete. Try again.');
            }
          },
        },
      ],
    );
  }, [token, user?.id]);

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

        const vaultResult = await fetchWithCache(
          FEED_CACHE_KEYS.vault(user?.id),
          () => socialApi.getVault(token),
          { freshMs: TTL.LEADERBOARD_MS, staleMs: TTL.LEADERBOARD_MS * 4, force },
        );
        setVault({
          mine_private: vaultResult.data?.mine_private || [],
          saved: vaultResult.data?.saved || [],
        });
      } else {
        setMyPosts([]);
        setVault({ mine_private: [], saved: [] });
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
      const toVault = !!route.params?.toVault;
      load({ force: posted });
      if (posted) {
        if (toVault) {
          setToast('Saved to your MoneyVault.');
          setTab('vault');
          setVaultSection('private');
        } else {
          setToast('Sent for review. It goes live after an admin checks it.');
          setTab('pending');
        }
        navigation.setParams({ posted: undefined, toVault: undefined });
      }
    }, [load, navigation, route.params?.posted, route.params?.toVault]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ force: true });
  }, [load]);

  const openCompose = (opts = {}) => {
    if (!requireAccount({ isGuest, navigation, feature: 'share a money tip' })) return;
    navigation.navigate(
      'ComposeFeed',
      opts.visibility === 'private' ? { visibility: 'private' } : {},
    );
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
  // The user's live public posts — this is where they track likes & saves.
  const myApprovedPublic = myPosts.filter(
    (post) => post.visibility === 'public' && post.status === 'approved',
  );
  const isVault = tab === 'vault';
  const isPending = tab === 'pending';
  const guestVault = isGuest && isVault;
  const data = guestVault
    ? []
    : isVault
      ? (vaultSection === 'private'
        ? vault.mine_private
        : vaultSection === 'posts'
          ? myApprovedPublic
          : vault.saved)
      : isPending
        ? pendingOrRejected
        : posts;

  const renderItem = ({ item }) => {
    const isOwn = !!(item.author?.user_id && user?.id && item.author.user_id === user.id);
    if (isPending) {
      return (
        <FeedPostCard
          post={item}
          showStatus
          onOpenLink={openLink}
          onSaveImage={saveImage}
          onDelete={deletePost}
          canDelete
        />
      );
    }
    if (isVault && vaultSection === 'posts') {
      return (
        <FeedPostCard
          post={item}
          showStats
          onOpenLink={openLink}
          onSaveImage={saveImage}
          onDelete={deletePost}
          canDelete
        />
      );
    }
    if (isVault && vaultSection === 'private') {
      return (
        <FeedPostCard
          post={item}
          showActions
          onOpenLink={openLink}
          onSaveImage={saveImage}
          onDelete={deletePost}
          canDelete
        />
      );
    }
    return (
      <FeedPostCard
        post={item}
        showActions
        onOpenLink={openLink}
        onToggleUpvote={toggleUpvote}
        upvoteDisabled={upvotingId === item.id}
        onToggleBookmark={toggleBookmark}
        bookmarkDisabled={bookmarkingId === item.id}
        onSaveImage={saveImage}
        onDelete={isOwn ? deletePost : undefined}
        canDelete={isOwn}
      />
    );
  };

  const emptyState = guestVault ? (
    <View style={styles.emptyWrap}>
      <BrandEmptyState
        title="Your MoneyVault"
        body="Create an account to keep private posts and save tips just for you."
      />
      <View style={styles.emptyCta}>
        <PuckButton
          color={colors.primary}
          height={52}
          borderRadius={16}
          lip={5}
          onPress={() => requireAccount({ isGuest, navigation, feature: 'use your MoneyVault' })}
          contentStyle={styles.emptyCtaInner}
        >
          <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
          <Text style={styles.emptyCtaText}>Create account</Text>
        </PuckButton>
      </View>
    </View>
  ) : (
    <View style={styles.emptyWrap}>
      <BrandEmptyState
        title={
          isPending
            ? (isGuest ? 'Your pending posts' : 'Nothing pending')
            : isVault
              ? (vaultSection === 'private'
                ? 'No private posts yet'
                : vaultSection === 'posts'
                  ? 'No public posts yet'
                  : 'Nothing saved yet')
              : 'No tips yet'
        }
        body={
          isPending
            ? (isGuest
              ? 'Create an account to share tips. Posts waiting on review show up here.'
              : 'Tips you submit for the public feed wait here until an admin checks them.')
            : isVault
              ? (vaultSection === 'private'
                ? 'Post something private — only you will see it here. It goes live instantly.'
                : vaultSection === 'posts'
                  ? 'Share a public tip. Once it\u2019s approved, see how many likes and saves it gets right here.'
                  : 'Tap the bookmark on any post to save it into your MoneyVault.')
              : 'Be first — drop a money tip. Guests can browse, posting needs an account.'
        }
      />
      {((!isVault && !isPending) || (isVault && vaultSection !== 'saved')) && (
        <View style={styles.emptyCta}>
          <PuckButton
            color={colors.primary}
            height={52}
            borderRadius={16}
            lip={5}
            onPress={() => openCompose(isVault && vaultSection === 'private' ? { visibility: 'private' } : {})}
          >
            <Ionicons name="camera" size={18} color="#FFFFFF" />
            <Text style={styles.emptyCtaText}>
              {isVault && vaultSection === 'private' ? 'Add a private post' : 'Share a tip'}
            </Text>
          </PuckButton>
        </View>
      )}
    </View>
  );

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenAppBar
          showBack={false}
          rightActions={(
            <TouchableOpacity
              style={styles.composeBtn}
              onPress={() => openCompose(isVault && vaultSection === 'private' ? { visibility: 'private' } : {})}
              activeOpacity={0.85}
              accessibilityLabel="New post"
            >
              <Ionicons name="add" size={22} color={colors.white} />
            </TouchableOpacity>
          )}
        >
          <View style={styles.identity}>
            <View style={styles.identityAvatar}>
              <Ionicons name="newspaper" size={18} color={colors.primary} />
            </View>
            <View style={styles.identityCopy}>
              <Text style={titleStyles.title} numberOfLines={1}>Feed</Text>
              <Text style={titleStyles.eyebrow} numberOfLines={1}>Short money tips</Text>
            </View>
          </View>
        </ScreenAppBar>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'feed' && styles.tabBtnActive]}
            onPress={() => setTab('feed')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, tab === 'feed' && styles.tabTextActive]}>Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, isVault && styles.tabBtnActive]}
            onPress={() => setTab('vault')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, isVault && styles.tabTextActive]}>MoneyVault</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, isPending && styles.tabBtnActive]}
            onPress={() => setTab('pending')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, isPending && styles.tabTextActive]}>Pending</Text>
          </TouchableOpacity>
        </View>

        {isVault && !guestVault && (
          <View style={styles.subTabs}>
            <TouchableOpacity
              style={styles.subTab}
              onPress={() => setVaultSection('private')}
              activeOpacity={0.8}
            >
              <Text style={[styles.subTabText, vaultSection === 'private' && styles.subTabTextActive]}>
                My private
              </Text>
              {vaultSection === 'private' && <View style={styles.subTabUnderline} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.subTab}
              onPress={() => setVaultSection('saved')}
              activeOpacity={0.8}
            >
              <Text style={[styles.subTabText, vaultSection === 'saved' && styles.subTabTextActive]}>
                Saved
              </Text>
              {vaultSection === 'saved' && <View style={styles.subTabUnderline} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.subTab}
              onPress={() => setVaultSection('posts')}
              activeOpacity={0.8}
            >
              <Text style={[styles.subTabText, vaultSection === 'posts' && styles.subTabTextActive]}>
                My posts
              </Text>
              {vaultSection === 'posts' && <View style={styles.subTabUnderline} />}
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <BrandLoader message="Loading the feed…" />
        ) : (
          <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            ListEmptyComponent={emptyState}
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

      <FeedTutorial visible={showTutorial} colors={colors} onDone={dismissTutorial} />
    </LinearGradient>
  );
}

const makeStyles = (colors, tabInset) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    height: 44,
  },
  identityAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    flexShrink: 0,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  composeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtnActive: {
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
  subTabs: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 16,
  },
  subTab: {
    paddingBottom: 6,
  },
  subTabText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: -0.2,
  },
  subTabTextActive: {
    color: colors.white,
  },
  subTabUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: tabInset,
    flexGrow: 1,
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
