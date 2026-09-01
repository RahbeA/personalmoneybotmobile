import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Animated, Easing,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { useTabBarInset } from '../navigation/tabBarLayout';
import { useTabReselect } from '../navigation/tabReselect';
import { BrandLogo, BrandToast, BrandEmptyState } from '../components/brand';
import DailyRewardModal from '../components/DailyRewardModal';
import DailyClaimCelebration from '../components/DailyClaimCelebration';
import AppBar from '../components/AppBar';
import LessonRoadmap, {
  getNextLesson, getCurrentModuleId, getLockedModuleIds, ROADMAP_GREEN, UnitBanner,
} from '../components/LessonRoadmap';
import PuckButton from '../components/PuckButton';
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
  const [stickyModuleId, setStickyModuleId] = useState(null);
  const dismissedStreakRef = useRef(false);
  const pendingBadgeRef = useRef(null);
  const scrollRef = useRef(null);
  const sectionLayoutRef = useRef({});
  const pathStartYRef = useRef(0);
  const stickyIdRef = useRef(null);
  const stickyShownRef = useRef(false);
  const stickyAnim = useRef(new Animated.Value(0)).current;
  const scrollRafRef = useRef(null);
  const lastScrollYRef = useRef(0);

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

  useEffect(() => {
    if (dailyReward?.can_claim && !dismissedStreakRef.current) {
      setStreakModalOpen(true);
    }
  }, [dailyReward?.can_claim, dailyReward?.current_day]);

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
  const nextLesson = getNextLesson(modules);
  const tipCategory = moneyTip?.category
    ? (TIP_CATEGORY_LABELS[moneyTip.category] || moneyTip.category)
    : null;

  function goToProfile() {
    navigation.navigate('SettingsTab');
  }

  function handleStatPress(key) {
    if (key === 'streak') {
      dismissedStreakRef.current = false;
      setStreakModalOpen(true);
      return;
    }
    goToProfile();
  }

  const lockedModuleIds = useMemo(() => getLockedModuleIds(modules), [modules]);
  const currentModuleId = useMemo(() => getCurrentModuleId(modules), [modules]);
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

  const updateStickyFromScroll = useCallback((scrollY) => {
    lastScrollYRef.current = scrollY;
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
        scrollRef.current.scrollTo({ y: Math.max(y - 8, 0), animated: true });
      }
      navigation.setParams({ focusModuleId: undefined });
    }, 320);
    return () => clearTimeout(timer);
  }, [focusModuleId, loading, modules, navigation]);

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
    }
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
            refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ROADMAP_GREEN.solid} />
          }
        >
          {moneyTip?.body ? (
            <View style={styles.tipWrap}>
              <BrandLogo size="sm" style={styles.tipLogo} />
              <View style={styles.tipBody}>
                <Text style={styles.tipTag}>{tipCategory || 'Money tip'}</Text>
                <Text style={styles.tipText} numberOfLines={3}>{moneyTip.body}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.quickRow}>
            {nextLesson ? (
              <PuckButton
                color={ROADMAP_GREEN.solid}
                height={64}
                borderRadius={16}
                lip={5}
                onPress={() => handleLessonPress(nextLesson.lesson, nextLesson.module)}
                style={styles.continueCard}
                contentStyle={styles.continueGrad}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.continueLabel}>CONTINUE</Text>
                  <Text style={styles.continueTitle} numberOfLines={1}>{nextLesson.lesson.title}</Text>
                </View>
                <Ionicons name="play-circle" size={26} color="#FFFFFF" />
              </PuckButton>
            ) : (
              <View style={styles.allDoneCard}>
                <Ionicons name="trophy" size={18} color={colors.primary} />
                <Text style={styles.allDoneTitle}>All caught up</Text>
              </View>
            )}

            <PuckButton
              color="#FF8A1F"
              width={88}
              height={64}
              borderRadius={16}
              lip={5}
              onPress={() => navigation.navigate('DailyBlitz')}
              contentStyle={styles.puzzleContent}
              accessibilityLabel="Daily Puzzle"
            >
              <Ionicons name="today" size={18} color="#FFFFFF" />
              <Text style={styles.puzzleLabel}>Daily Puzzle</Text>
            </PuckButton>
          </View>

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
          }}
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
  scrollHost: { flex: 1, position: 'relative' },
  scrollView: { flex: 1 },
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

  tipWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  tipLogo: { width: 28, height: 28, marginTop: 2 },
  tipBody: { flex: 1 },
  tipTag: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  tipText: { fontSize: 13, color: colors.offWhite, lineHeight: 18, fontWeight: '600' },

  quickRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginBottom: 8,
  },
  continueCard: { flex: 1 },
  continueGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
  },
  continueLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  continueTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  allDoneCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: 8,
    minHeight: 64,
  },
  allDoneTitle: { fontSize: 14, fontWeight: '700', color: colors.white },
  puzzleContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  puzzleLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.2,
    lineHeight: 12,
  },
});
