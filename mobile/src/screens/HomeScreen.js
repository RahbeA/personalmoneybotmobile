import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, RefreshControl,
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
import { BrandLogo, BrandToast, BrandEmptyState } from '../components/brand';
import { BRAND_NAME } from '../constants/brandCopy';
import DailyRewardCard from '../components/DailyRewardCard';
import DailyClaimCelebration from '../components/DailyClaimCelebration';
import BadgeIcon from '../components/BadgeIcon';
import AppBar from '../components/AppBar';
import LessonRoadmap, { getNextLesson, ROADMAP_GREEN } from '../components/LessonRoadmap';
import PuckButton from '../components/PuckButton';
import { getFirstName } from '../utils/displayName';
import { API_BASE_URL } from '../config/api';

const DAILY_TIPS = [
  'Pay yourself first — automate savings before spending.',
  'The best time to invest was yesterday. The next best time is today.',
  'Track every dollar for 30 days. The results will surprise you.',
  'An emergency fund is the foundation of every financial plan.',
  'Credit cards are tools. Use them — don\'t let them use you.',
  'Your net worth is not your self-worth, but it\'s worth growing.',
  'Compound interest rewards patience above all else.',
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDailyTip() {
  return DAILY_TIPS[new Date().getDay() % DAILY_TIPS.length];
}

function AnimatedCard({ delay = 0, style, children }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 450, delay, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export default function HomeScreen({ navigation, route }) {
  const { user } = useAuth();
  const {
    streakDays, badges, modules, loading, loadError, refresh,
    dailyReward, claimingDaily, claimDailyReward, getBadgeMeta, badgeCatalog,
    pendingFirstLesson, clearPendingFirstLesson,
  } = useUserProgress();
  const { colors, isDark } = useTheme();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);
  const [streakToast, setStreakToast] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const pendingBadgeRef = useRef(null);
  const scrollRef = useRef(null);
  const sectionYRef = useRef({});

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
    const milestones = [7, 30, 100];
    if (milestones.includes(streakDays)) {
      setStreakToast(`${streakDays}-day streak! Keep it going with MoneyBot.`);
    }
  }, [streakDays]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const displayName = getFirstName(user);
  const nextLesson = getNextLesson(modules);

  const earnedBadges = badges.map((key) => getBadgeMeta(key));
  const catalogBadges = badgeCatalog.map((b) => ({
    ...getBadgeMeta(b.key),
    earned: badges.includes(b.key),
  }));

  function goToProfile() {
    navigation.navigate('SettingsTab');
  }

  function handleLessonPress(lesson, module) {
    navigation.navigate('LessonIntro', { lesson, module });
  }

  function toggleSection(id, isCurrentlyCollapsed) {
    setCollapsed((prev) => ({ ...prev, [id]: !isCurrentlyCollapsed }));
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

    setCollapsed((prev) => ({ ...prev, [focusModuleId]: false }));

    const timer = setTimeout(() => {
      const y = sectionYRef.current[focusModuleId];
      if (y != null && scrollRef.current) {
        scrollRef.current.scrollTo({ y: Math.max(y - 12, 0), animated: true });
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
    const newKey = result.badges?.find((key) => !before.has(key));
    pendingBadgeRef.current = newKey || null;
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
        />

        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ROADMAP_GREEN.solid} />
          }
        >
          <AnimatedCard delay={60} style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Tip</Text>
            <View style={styles.tipCard}>
              <BrandLogo size="sm" style={styles.tipLogo} />
              <View style={styles.tipBody}>
                <Text style={styles.tipTag}>{BRAND_NAME}</Text>
                <Text style={styles.tipText}>{getDailyTip()}</Text>
              </View>
            </View>
          </AnimatedCard>

          {dailyReward?.can_claim && (
            <AnimatedCard delay={90}>
              <DailyRewardCard
                dailyReward={dailyReward}
                onClaim={handleDailyClaim}
                claiming={claimingDaily}
                colors={colors}
                isDark={isDark}
              />
            </AnimatedCard>
          )}

          <AnimatedCard delay={120} style={styles.quickRow}>
            {nextLesson ? (
              <PuckButton
                color={ROADMAP_GREEN.solid}
                height={88}
                borderRadius={18}
                lip={8}
                onPress={() => handleLessonPress(nextLesson.lesson, nextLesson.module)}
                style={styles.continueCard}
                contentStyle={styles.continueGrad}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.continueLabel}>CONTINUE</Text>
                  <Text style={styles.continueTitle} numberOfLines={2}>{nextLesson.lesson.title}</Text>
                </View>
                <PuckButton
                  color="#FFFFFF"
                  width={32}
                  height={32}
                  borderRadius={16}
                  lip={3}
                >
                  <Ionicons name="play" size={16} color={ROADMAP_GREEN.solid} />
                </PuckButton>
              </PuckButton>
            ) : (
              <View style={styles.allDoneCard}>
                <Ionicons name="trophy" size={22} color={colors.primary} />
                <Text style={styles.allDoneTitle}>All caught up</Text>
              </View>
            )}

            <PuckButton
              color="#FF8A1F"
              width={88}
              height={88}
              borderRadius={18}
              lip={8}
              onPress={() => navigation.navigate('DailyBlitz')}
              contentStyle={styles.puzzleGrad}
            >
              <Ionicons name="today" size={22} color="#FFFFFF" />
              <Text style={styles.puzzleLabel}>Daily{'\n'}Puzzle</Text>
            </PuckButton>
          </AnimatedCard>

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
            <LessonRoadmap
              modules={modules}
              collapsed={collapsed}
              onToggle={toggleSection}
              onLessonPress={handleLessonPress}
              pulse={pulse}
              onSectionLayout={(id, y) => { sectionYRef.current[id] = y; }}
            />
          )}

          {catalogBadges.length > 0 && (
            <AnimatedCard delay={240} style={styles.section}>
              <Text style={styles.sectionTitle}>Badges</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesScroll}>
                {catalogBadges.map((badge) => (
                  <TouchableOpacity
                    key={badge.key}
                    style={[styles.badgeItem, !badge.earned && styles.badgeItemLocked]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('BadgeReveal', {
                      badgeKey: badge.key,
                      mode: 'view',
                      earned: badge.earned,
                    })}
                  >
                    <BadgeIcon badge={badge} size={52} style={{ opacity: badge.earned ? 1 : 0.35 }} />
                    <Text style={[styles.badgeLabel, !badge.earned && styles.badgeLabelLocked]} numberOfLines={2}>
                      {badge.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </AnimatedCard>
          )}

          {catalogBadges.length === 0 && earnedBadges.length > 0 && (
            <AnimatedCard delay={240} style={styles.section}>
              <Text style={styles.sectionTitle}>Badges Earned</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesScroll}>
                {earnedBadges.map((badge) => (
                  <TouchableOpacity
                    key={badge.key}
                    style={styles.badgeItem}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('BadgeReveal', {
                      badgeKey: badge.key,
                      mode: 'view',
                      earned: true,
                    })}
                  >
                    <BadgeIcon badge={badge} size={52} />
                    <Text style={styles.badgeLabel}>{badge.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </AnimatedCard>
          )}
        </ScrollView>

        <BrandToast
          visible={!!streakToast}
          message={streakToast}
          onHide={() => setStreakToast(null)}
        />

        <DailyClaimCelebration
          visible={!!celebration}
          amount={celebration?.amount ?? 0}
          onDone={handleCelebrationDone}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors, tabBarInset) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  scrollView: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: tabBarInset },

  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.white, letterSpacing: -0.2, marginBottom: 12 },

  tipCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipLogo: { width: 32, height: 32, marginTop: 2 },
  tipBody: { flex: 1 },
  tipTag: { fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  tipText: { fontSize: 14, color: colors.offWhite, lineHeight: 20 },

  quickRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginBottom: 22,
  },
  continueCard: {
    flex: 1,
  },
  continueGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  continueLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.1,
    marginBottom: 4,
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
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    minHeight: 88,
  },
  allDoneTitle: { fontSize: 14, fontWeight: '700', color: colors.white },

  puzzleGrad: {
    gap: 6,
    paddingVertical: 10,
  },
  puzzleLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 14,
  },

  badgesScroll: { marginHorizontal: -4 },
  badgeItem: { alignItems: 'center', marginHorizontal: 8, width: 72 },
  badgeItemLocked: { opacity: 0.75 },
  badgeLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', fontWeight: '500' },
  badgeLabelLocked: { color: colors.textMuted },
});
