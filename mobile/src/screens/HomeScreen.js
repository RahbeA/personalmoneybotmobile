import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Animated, Easing, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { useTabBarInset } from '../navigation/tabBarLayout';
import { useTabReselect } from '../navigation/tabReselect';
import { BrandToast, BrandEmptyState } from '../components/brand';
import DailyRewardModal from '../components/DailyRewardModal';
import DailyClaimCelebration from '../components/DailyClaimCelebration';
import MoneyTipModal from '../components/MoneyTipModal';
import AppBar from '../components/AppBar';
import { readTipSeenToday, persistTipSeenToday } from '../utils/moneyTipStore';
import LessonRoadmap, {
  getNextLesson, getCurrentModuleId, getLockedModuleIds, ROADMAP_GREEN, UnitBanner,
} from '../components/LessonRoadmap';
import { getFirstName } from '../utils/displayName';
import { API_BASE_URL } from '../config/api';

const TIP_CATEGORY_LABELS = {
  general: 'Money tip',
  budget: 'Budget',
  investing: 'Investing',
  credit: 'Credit',
  saving: 'Saving',
  stocks: 'Stocks',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const STICKY_SHOW_OFFSET = 24;
const STICKY_HIDE_OFFSET = 6;

export default function HomeScreen({ navigation, route }) {
  const { user } = useAuth();
  const {
    streakDays, badges, modules, loading, loadError, refresh,
    dailyReward, claimingDaily, claimDailyReward,
    pendingFirstLesson, clearPendingFirstLesson, moneyTip,
  } = useUserProgress();
  const { colors, isDark } = useTheme();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);
  const [streakToast, setStreakToast] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [moneyTipOpen, setMoneyTipOpen] = useState(false);
  const [stickyModuleId, setStickyModuleId] = useState(null);
  // Daily gate: the tip auto-pops at most once per calendar day.
  const [tipSeenToday, setTipSeenToday] = useState(false);
  const [tipGateLoaded, setTipGateLoaded] = useState(false);
  const tipUserId = user?.id || 'guest';
  const dismissedStreakRef = useRef(false);
  // Tracks the first-entry intro sequence (streak -> money tip -> scroll to lesson).
  const introRef = useRef({ started: false, tipShown: false });
  const introActiveRef = useRef(false);
  const pendingBadgeRef = useRef(null);
  const scrollRef = useRef(null);
  const sectionLayoutRef = useRef({});
  const pathStartYRef = useRef(0);
  const stickyIdRef = useRef(null);
  const stickyShownRef = useRef(false);
  const stickyAnim = useRef(new Animated.Value(0)).current;
  const scrollRafRef = useRef(null);
  const lastScrollYRef = useRef(0);
  // Drives the eased "glide to your lesson" scroll (accelerate, then settle).
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const scrollAnimListenerRef = useRef(null);
  // Floating "jump to your lesson" button — shows whenever the current lesson
  // section isn't in view. `jumpAnim` drives its fade/scale in and out.
  const viewportHeightRef = useRef(0);
  const jumpAnim = useRef(new Animated.Value(0)).current;
  const showJumpRef = useRef(false);
  const jumpDirRef = useRef('down');
  const [showJump, setShowJump] = useState(false);
  const [jumpDir, setJumpDir] = useState('down');

  useTabReselect('HomeTab', () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  });

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  useFocusEffect(
    useCallback(() => {
      refresh({ background: true });
    }, [refresh]),
  );

  useEffect(() => () => {
    if (scrollAnimListenerRef.current != null) {
      scrollAnim.removeListener(scrollAnimListenerRef.current);
      scrollAnimListenerRef.current = null;
    }
  }, [scrollAnim]);

  // Smoothly glide the scroll view to a target Y with an ease-in-out curve so
  // it starts gently, speeds up, then eases to a stop (nicer than the default).
  const animateScrollTo = useCallback((targetY) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const startY = lastScrollYRef.current || 0;
    const distance = Math.abs(targetY - startY);
    if (distance < 2) return;
    // Longer trips animate a touch longer, but stay in a snappy, pleasant range.
    const duration = Math.max(420, Math.min(950, 260 + distance * 0.55));

    // Tear down any in-flight glide before starting a new one.
    if (scrollAnimListenerRef.current != null) {
      scrollAnim.removeListener(scrollAnimListenerRef.current);
      scrollAnimListenerRef.current = null;
    }
    scrollAnim.stopAnimation();
    scrollAnim.setValue(startY);
    scrollAnimListenerRef.current = scrollAnim.addListener(({ value }) => {
      scroller.scrollTo({ y: value, animated: false });
    });
    Animated.timing(scrollAnim, {
      toValue: targetY,
      duration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      if (scrollAnimListenerRef.current != null) {
        scrollAnim.removeListener(scrollAnimListenerRef.current);
        scrollAnimListenerRef.current = null;
      }
    });
  }, [scrollAnim]);

  const scrollToCurrentLesson = useCallback(() => {
    const targetId = getCurrentModuleId(modules) || getNextLesson(modules)?.module?.id;
    if (targetId == null) return;
    // Defer so section layouts are measured before we scroll.
    setTimeout(() => {
      const layout = sectionLayoutRef.current[targetId];
      const y = layout?.y != null ? pathStartYRef.current + layout.y : null;
      if (y != null && scrollRef.current) {
        animateScrollTo(Math.max(y - 8, 0));
      }
    }, 260);
  }, [modules, animateScrollTo]);

  // Tap handler for the floating arrow — glides straight to the lesson now
  // (layouts are already measured by the time the button is visible).
  const handleJumpPress = useCallback(() => {
    const targetId = getCurrentModuleId(modules) || getNextLesson(modules)?.module?.id;
    if (targetId == null) return;
    const layout = sectionLayoutRef.current[targetId];
    const y = layout?.y != null ? pathStartYRef.current + layout.y : null;
    if (y != null && scrollRef.current) {
      animateScrollTo(Math.max(y - 8, 0));
    }
  }, [modules, animateScrollTo]);

  // Load today's "already shown" flag once we know the user.
  useEffect(() => {
    let active = true;
    (async () => {
      const seen = await readTipSeenToday(tipUserId);
      if (active) {
        setTipSeenToday(seen);
        setTipGateLoaded(true);
      }
    })();
    return () => { active = false; };
  }, [tipUserId]);

  // Mark the tip as shown for today so it won't auto-pop again until tomorrow.
  const markTipSeenToday = useCallback(() => {
    setTipSeenToday(true);
    persistTipSeenToday(tipUserId);
  }, [tipUserId]);

  // Manual open from the app-bar button — always allowed, any time of day.
  const openMoneyTipManual = useCallback(() => {
    if (!moneyTip?.body) return;
    introActiveRef.current = false; // not part of the first-entry intro
    setMoneyTipOpen(true);
    markTipSeenToday();
  }, [moneyTip?.body, markTipSeenToday]);

  const advanceFromStreak = useCallback(() => {
    if (!introActiveRef.current) return;
    if (moneyTip?.body && !introRef.current.tipShown && !tipSeenToday) {
      introRef.current.tipShown = true;
      setMoneyTipOpen(true);
      markTipSeenToday();
    } else {
      introActiveRef.current = false;
      scrollToCurrentLesson();
    }
  }, [moneyTip?.body, tipSeenToday, markTipSeenToday, scrollToCurrentLesson]);

  const closeMoneyTip = useCallback(() => {
    setMoneyTipOpen(false);
    // Only glide to the lesson when the tip was part of the first-entry intro;
    // a manual open shouldn't move the roadmap when dismissed.
    if (introActiveRef.current) {
      introActiveRef.current = false;
      scrollToCurrentLesson();
    }
  }, [scrollToCurrentLesson]);

  // First-entry intro: streak pop-up, then money tip pop-up, then scroll to the current lesson.
  useEffect(() => {
    if (loading || !modules.length) return;
    // Wait until we know whether today's tip was already shown, so we don't
    // flash it before the daily gate resolves.
    if (!tipGateLoaded) return;
    if (introRef.current.started) return;
    introRef.current.started = true;
    if (dailyReward?.can_claim && !dismissedStreakRef.current) {
      introActiveRef.current = true;
      setStreakModalOpen(true);
    } else if (moneyTip?.body && !tipSeenToday) {
      introActiveRef.current = true;
      introRef.current.tipShown = true;
      setMoneyTipOpen(true);
      markTipSeenToday();
    } else {
      scrollToCurrentLesson();
    }
  }, [
    loading, modules.length, dailyReward?.can_claim, moneyTip?.body,
    tipGateLoaded, tipSeenToday, markTipSeenToday, scrollToCurrentLesson,
  ]);

  useEffect(() => {
    const milestones = [7, 30, 100];
    if (milestones.includes(streakDays)) {
      setStreakToast(`${streakDays}-day streak! Keep it going with MoneyBot.`);
    }
  }, [streakDays]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    dismissedStreakRef.current = false;
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const displayName = getFirstName(user);
  const tipCategory = moneyTip?.category
    ? (TIP_CATEGORY_LABELS[moneyTip.category] || moneyTip.category)
    : null;

  function goToProfile() {
    navigation.navigate('SettingsTab');
  }

  function handleStatPress(key) {
    if (key === 'streak') {
      dismissedStreakRef.current = false;
      introActiveRef.current = false;
      setStreakModalOpen(true);
      return;
    }
    goToProfile();
  }

  const lockedModuleIds = useMemo(() => getLockedModuleIds(modules), [modules]);
  const currentModuleId = useMemo(() => getCurrentModuleId(modules), [modules]);
  // The module that holds the user's current/next lesson — the scroll target.
  const targetLessonModuleId = useMemo(
    () => getCurrentModuleId(modules) ?? getNextLesson(modules)?.module?.id ?? null,
    [modules],
  );
  const stickyModule = useMemo(
    () => modules.find((m) => m.id === stickyModuleId) || modules[0] || null,
    [modules, stickyModuleId],
  );

  const stickySectionNumber = useMemo(() => {
    if (!stickyModule) return 1;
    const idx = modules.findIndex((m) => m.id === stickyModule.id);
    return stickyModule.order || (idx >= 0 ? idx + 1 : 1);
  }, [modules, stickyModule]);

  const setStickyVisible = useCallback((visible) => {
    if (stickyShownRef.current === visible) return;
    stickyShownRef.current = visible;
    Animated.timing(stickyAnim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 200 : 160,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [stickyAnim]);

  const setJumpVisible = useCallback((visible, dir) => {
    if (dir && dir !== jumpDirRef.current) {
      jumpDirRef.current = dir;
      setJumpDir(dir);
    }
    if (showJumpRef.current === visible) return;
    showJumpRef.current = visible;
    setShowJump(visible);
    Animated.timing(jumpAnim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 150,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [jumpAnim]);

  // Show the floating arrow when the current lesson's section isn't on screen.
  const updateJumpButton = useCallback((scrollY) => {
    const targetId = targetLessonModuleId;
    const layout = targetId != null ? sectionLayoutRef.current[targetId] : null;
    const vh = viewportHeightRef.current;
    if (!layout || vh <= 0) {
      setJumpVisible(false);
      return;
    }
    const top = pathStartYRef.current + layout.y;
    const bottom = top + (layout.height || 0);
    const viewTop = scrollY;
    const viewBottom = scrollY + vh;
    const overlap = Math.min(bottom, viewBottom) - Math.max(top, viewTop);
    // Consider it "in view" once a meaningful slice is visible.
    const threshold = Math.min(90, Math.max(40, (layout.height || 80) * 0.35));
    if (overlap >= threshold) {
      setJumpVisible(false);
      return;
    }
    const dir = top >= viewBottom ? 'down' : 'up';
    setJumpVisible(true, dir);
  }, [targetLessonModuleId, setJumpVisible]);

  const updateStickyFromScroll = useCallback((scrollY) => {
    lastScrollYRef.current = scrollY;
    updateJumpButton(scrollY);
    const pathOffset = pathStartYRef.current;
    const entries = modules
      .map((mod) => ({ mod, layout: sectionLayoutRef.current[mod.id] }))
      .filter((e) => e.layout);
    if (!entries.length) return;

    const probeY = scrollY + 12;
    let active = entries[0].mod.id;
    for (const { mod, layout } of entries) {
      const absoluteY = pathOffset + layout.y;
      if (absoluteY <= probeY) active = mod.id;
    }

    if (active !== stickyIdRef.current) {
      stickyIdRef.current = active;
      setStickyModuleId(active);
    }

    const activeLayout = sectionLayoutRef.current[active];
    const bannerTop = activeLayout ? pathOffset + activeLayout.y : 0;
    const showAt = bannerTop + STICKY_SHOW_OFFSET;
    const hideAt = bannerTop + STICKY_HIDE_OFFSET;

    if (!stickyShownRef.current) {
      if (scrollY > showAt) setStickyVisible(true);
    } else if (scrollY < hideAt) {
      setStickyVisible(false);
    }
  }, [modules, setStickyVisible]);

  const handleScroll = useCallback((e) => {
    const scrollY = e.nativeEvent.contentOffset.y;
    if (scrollRafRef.current != null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      updateStickyFromScroll(scrollY);
    });
  }, [updateStickyFromScroll]);

  useEffect(() => () => {
    if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
  }, []);

  // Re-check arrow visibility once layouts settle (initial load / lesson change).
  useEffect(() => {
    const t = setTimeout(() => updateJumpButton(lastScrollYRef.current || 0), 500);
    return () => clearTimeout(t);
  }, [targetLessonModuleId, modules.length, updateJumpButton]);

  function handleSectionLayout(id, y, height) {
    sectionLayoutRef.current[id] = { y, height };
    if (lastScrollYRef.current > 0) {
      updateStickyFromScroll(lastScrollYRef.current);
    }
  }

  useEffect(() => {
    if (modules.length && !stickyModuleId) {
      setStickyModuleId(getCurrentModuleId(modules) || modules[0].id);
    }
  }, [modules, stickyModuleId]);

  function handleLessonPress(lesson, module) {
    navigation.navigate('LessonIntro', { lesson, module });
  }

  useEffect(() => {
    if (!pendingFirstLesson) return;
    if (loading || !modules.length) return;
    const first = getNextLesson(modules);
    clearPendingFirstLesson();
    if (first) {
      navigation.navigate('LessonIntro', { lesson: first.lesson, module: first.module });
    }
  }, [pendingFirstLesson, loading, modules, navigation, clearPendingFirstLesson]);

  const focusModuleId = route?.params?.focusModuleId;
  useEffect(() => {
    if (focusModuleId == null) return;
    if (loading || !modules.length) return;
    if (!modules.some((m) => m.id === focusModuleId)) return;

    const timer = setTimeout(() => {
      const layout = sectionLayoutRef.current[focusModuleId];
      const y = layout?.y != null ? pathStartYRef.current + layout.y : null;
      if (y != null && scrollRef.current) {
        animateScrollTo(Math.max(y - 8, 0));
      }
      navigation.setParams({ focusModuleId: undefined });
    }, 320);
    return () => clearTimeout(timer);
  }, [focusModuleId, loading, modules, navigation, animateScrollTo]);

  async function handleDailyClaim() {
    const claimAmount = dailyReward?.claim_amount ?? 0;
    const before = new Set(badges);
    const result = await claimDailyReward();
    if (!result) return;
    setStreakModalOpen(false);
    dismissedStreakRef.current = true;
    pendingBadgeRef.current = result.badges?.find((key) => !before.has(key)) || null;
    setCelebration({ amount: result.claimed_amount ?? claimAmount });
  }

  function handleCelebrationDone() {
    setCelebration(null);
    const newKey = pendingBadgeRef.current;
    pendingBadgeRef.current = null;
    if (newKey) {
      navigation.navigate('BadgeReveal', { badgeKey: newKey, mode: 'earned' });
      return;
    }
    advanceFromStreak();
  }

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppBar
          variant="home"
          subtitle={getGreeting()}
          title={displayName}
          onLogoPress={goToProfile}
          onStatsPress={goToProfile}
          onStatPress={handleStatPress}
          leadingAction={moneyTip?.body ? (
            <TouchableOpacity
              style={styles.tipBtn}
              onPress={openMoneyTipManual}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="See today's money tip"
            >
              <Ionicons name="bulb" size={20} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        />

        <View style={styles.scrollHost}>
          {stickyModule ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.stickyUnitOverlay,
                {
                  opacity: stickyAnim,
                  transform: [{
                    translateY: stickyAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  }],
                },
              ]}
            >
              <UnitBanner
                module={stickyModule}
                sectionNumber={stickySectionNumber}
                locked={lockedModuleIds.has(stickyModule.id)}
                isCurrent={stickyModule.id === currentModuleId}
                compact
              />
            </Animated.View>
          ) : null}

          <ScrollView
            ref={scrollRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={32}
            onScroll={handleScroll}
            onLayout={(e) => { viewportHeightRef.current = e.nativeEvent.layout.height; }}
            refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ROADMAP_GREEN.solid} />
          }
        >
          {loadError ? (
            <BrandEmptyState
              title="Couldn't load courses"
              body={`${loadError}\n\nConnected to:\n${API_BASE_URL}\n\nPull down to retry, or sign out and sign back in.`}
              style={{ marginTop: 24 }}
            />
          ) : modules.length === 0 && !loading ? (
            <BrandEmptyState
              title="No courses yet"
              body={`Nothing returned from the server.\n\nConnected to:\n${API_BASE_URL}\n\nPull down to refresh.`}
              style={{ marginTop: 24 }}
            />
          ) : (
            <View
              onLayout={(e) => { pathStartYRef.current = e.nativeEvent.layout.y; }}
            >
              <LessonRoadmap
                modules={modules}
                onLessonPress={handleLessonPress}
                pulse={pulse}
                onSectionLayout={handleSectionLayout}
              />
            </View>
          )}
          </ScrollView>

          <Animated.View
            pointerEvents={showJump ? 'auto' : 'none'}
            style={[
              styles.jumpButton,
              {
                opacity: jumpAnim,
                transform: [
                  { scale: jumpAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                  { translateY: jumpAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                ],
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleJumpPress}
              style={styles.jumpButtonInner}
              accessibilityRole="button"
              accessibilityLabel="Scroll to your lesson"
            >
              <Ionicons
                name={jumpDir === 'up' ? 'chevron-up' : 'chevron-down'}
                size={26}
                color="#0A0A0A"
              />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <BrandToast
          visible={!!streakToast}
          message={streakToast}
          onHide={() => setStreakToast(null)}
        />

        <DailyRewardModal
          visible={streakModalOpen && !!dailyReward}
          dailyReward={dailyReward}
          onClaim={handleDailyClaim}
          claiming={claimingDaily}
          onDismiss={() => {
            dismissedStreakRef.current = true;
            setStreakModalOpen(false);
            advanceFromStreak();
          }}
          colors={colors}
        />

        <MoneyTipModal
          visible={moneyTipOpen}
          tip={moneyTip}
          categoryLabel={tipCategory}
          onDismiss={closeMoneyTip}
          colors={colors}
        />

      </SafeAreaView>

      <DailyClaimCelebration
        visible={!!celebration}
        amount={celebration?.amount ?? 0}
        onDone={handleCelebrationDone}
      />
    </LinearGradient>
  );
}

const makeStyles = (colors, tabBarInset) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  tipBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primaryTintStrong || colors.primary,
  },
  scrollHost: { flex: 1, position: 'relative' },
  scrollView: { flex: 1 },
  jumpButton: {
    position: 'absolute',
    right: 18,
    bottom: tabBarInset,
    zIndex: 30,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  jumpButtonInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ROADMAP_GREEN.solid,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  scroll: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: tabBarInset },
  stickyUnitOverlay: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 20,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
