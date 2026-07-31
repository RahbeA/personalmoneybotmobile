import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useUserProgress, getModuleIonIcon } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { useTabBarInset } from '../navigation/tabBarLayout';
import { BrandLogo, BrandToast } from '../components/brand';
import { BRAND_NAME } from '../constants/brandCopy';
import DailyRewardCard from '../components/DailyRewardCard';
import DailyClaimCelebration from '../components/DailyClaimCelebration';
import BadgeIcon from '../components/BadgeIcon';
import AppBar from '../components/AppBar';
import { getFirstName } from '../utils/displayName';

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

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const {
    streakDays, badges, modules,
    botBucks,
    dailyReward, claimingDaily, claimDailyReward, getBadgeMeta, badgeCatalog, refresh,
  } = useUserProgress();
  const { colors, isDark } = useTheme();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);
  const [streakToast, setStreakToast] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const pendingBadgeRef = useRef(null);

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

  const displayName = getFirstName(user);

  const nextLesson = (() => {
    for (const mod of modules) {
      if (!mod.lessons) continue;
      for (const lesson of mod.lessons) {
        if (!lesson.is_completed) {
          return { lesson, module: mod };
        }
      }
    }
    return null;
  })();

  const moduleProgress = modules.slice(0, 4).map((mod) => ({
    ...mod,
    pct: mod.lesson_count ? Math.round((mod.completed_lesson_count / mod.lesson_count) * 100) : 0,
  }));

  const earnedBadges = badges.map((key) => getBadgeMeta(key));

  const catalogBadges = badgeCatalog.map((b) => ({
    ...getBadgeMeta(b.key),
    earned: badges.includes(b.key),
  }));

  function goToTab(tab) {
    navigation.navigate(tab);
  }

  function goToProfile() {
    goToTab('SettingsTab');
  }

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
        {/* Pinned — stays fixed while home content scrolls */}
        <AppBar
          variant="home"
          subtitle={getGreeting()}
          title={displayName}
          onLogoPress={goToProfile}
          onStatsPress={goToProfile}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >

          {/* Today's Tip — first content under the pinned app bar */}
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

          <AnimatedCard delay={120} style={styles.section}>
            <Text style={styles.sectionTitle}>Pick Up Where You Left Off</Text>
            {nextLesson ? (
              <TouchableOpacity
                style={styles.continueCard}
                activeOpacity={0.85}
                onPress={() => goToTab('CoursesTab')}
              >
                <View style={styles.continueIconWrap}>
                  <Ionicons name={getModuleIonIcon(nextLesson.module)} size={26} color={colors.primary} />
                </View>
                <View style={styles.continueBody}>
                  <Text style={styles.continueMod}>{nextLesson.module.title}</Text>
                  <Text style={styles.continueLesson}>{nextLesson.lesson.title}</Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${(nextLesson.module.completed_lesson_count / nextLesson.module.lesson_count) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressLabel}>
                    {nextLesson.module.completed_lesson_count}/{nextLesson.module.lesson_count} lessons in module
                  </Text>
                </View>
                <View style={styles.continueGo}>
                  <Ionicons name="play" size={16} color={colors.background} />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.allDoneCard}>
                <Ionicons name="trophy" size={32} color={colors.primary} />
                <Text style={styles.allDoneTitle}>All caught up!</Text>
                <Text style={styles.allDoneText}>You've completed every lesson. Nice work.</Text>
              </View>
            )}
          </AnimatedCard>

          {moduleProgress.length > 0 && (
            <AnimatedCard delay={240} style={styles.section}>
              <View style={styles.sectionRow}>
                <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Your Roadmap</Text>
                <TouchableOpacity onPress={() => goToTab('CoursesTab')} hitSlop={8}>
                  <Text style={styles.sectionLink}>View all</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.roadmapList}>
                {moduleProgress.map((mod) => (
                  <TouchableOpacity
                    key={mod.id}
                    style={styles.roadmapItem}
                    activeOpacity={0.8}
                    onPress={() => goToTab('CoursesTab')}
                  >
                    <View style={styles.roadmapIcon}>
                      <Ionicons name={getModuleIonIcon(mod)} size={18} color={colors.primary} />
                    </View>
                    <View style={styles.roadmapBody}>
                      <Text style={styles.roadmapTitle} numberOfLines={1}>{mod.title}</Text>
                      <View style={styles.roadmapTrack}>
                        <View style={[styles.roadmapFill, { width: `${mod.pct}%` }]} />
                      </View>
                    </View>
                    <Text style={styles.roadmapPct}>{mod.pct}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </AnimatedCard>
          )}

          {catalogBadges.length > 0 && (
            <AnimatedCard delay={300} style={styles.section}>
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
            <AnimatedCard delay={300} style={styles.section}>
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.white, letterSpacing: -0.2, marginBottom: 12 },
  sectionTitleInline: { marginBottom: 0 },
  sectionLink: { fontSize: 13, fontWeight: '600', color: colors.primary },

  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(61,220,95,0.25)',
  },
  continueIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(61,220,95,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBody: { flex: 1 },
  continueMod: { fontSize: 12, color: colors.primary, fontWeight: '600', marginBottom: 2 },
  continueLesson: { fontSize: 16, fontWeight: '700', color: colors.white, marginBottom: 10 },
  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  progressLabel: { fontSize: 11, color: colors.textSecondary },
  continueGo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allDoneCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  allDoneTitle: { fontSize: 17, fontWeight: '700', color: colors.white },
  allDoneText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },

  roadmapList: { gap: 10 },
  roadmapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roadmapIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(61,220,95,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roadmapBody: { flex: 1, gap: 6 },
  roadmapTitle: { fontSize: 14, fontWeight: '600', color: colors.white },
  roadmapTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  roadmapFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  roadmapPct: { fontSize: 13, fontWeight: '700', color: colors.textMuted, minWidth: 36, textAlign: 'right' },

  badgesScroll: { marginHorizontal: -4 },
  badgeItem: { alignItems: 'center', marginHorizontal: 8, width: 72 },
  badgeItemLocked: { opacity: 0.75 },
  badgeLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', fontWeight: '500' },
  badgeLabelLocked: { color: colors.textMuted },

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
});
