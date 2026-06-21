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
import { useUserProgress, getModuleIonIcon, getRankMeta } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { useTabBarInset } from '../navigation/tabBarLayout';
import { BrandAvatar, BrandLogo, BrandToast } from '../components/brand';
import { BRAND_NAME } from '../constants/brandCopy';
import DailyRewardCard from '../components/DailyRewardCard';
import BadgeIcon from '../components/BadgeIcon';

const DAILY_TIPS = [
  'Pay yourself first — automate savings before spending.',
  'The best time to invest was yesterday. The next best time is today.',
  'Track every dollar for 30 days. The results will surprise you.',
  'An emergency fund is the foundation of every financial plan.',
  'Credit cards are tools. Use them — don\'t let them use you.',
  'Your net worth is not your self-worth, but it\'s worth growing.',
  'Compound interest rewards patience above all else.',
];

const QUICK_ACTIONS = [
  { key: 'courses', label: 'Courses', subtitle: 'Keep learning', icon: 'book', tab: 'CoursesTab', colors: ['#3DDC5F', '#2BA84A'] },
  { key: 'leaderboard', label: 'Leaderboard', subtitle: 'Global ranks', icon: 'trophy', screen: 'Leaderboard', colors: ['#F5B72B', '#D4920A'] },
  { key: 'moneyverse', label: 'Moneyverse', subtitle: 'Characters & shop', icon: 'planet', tab: 'MoneyverseTab', colors: ['#7C5CFC', '#5B3FD4'] },
  { key: 'tutor', label: 'AI Tutor', subtitle: 'Ask anything', icon: 'chatbubbles', tab: 'TutorTab', colors: ['#3B9EE3', '#2563EB'] },
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

function QuickActionTile({ action, onPress, styles }) {
  return (
    <TouchableOpacity style={styles.quickTile} activeOpacity={0.85} onPress={onPress}>
      <LinearGradient colors={action.colors} style={styles.quickTileGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.quickTileIcon}>
          <Ionicons name={action.icon} size={22} color="#fff" />
        </View>
        <Text style={styles.quickTileLabel}>{action.label}</Text>
        <Text style={styles.quickTileSub}>{action.subtitle}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const {
    xp, streakDays, badges, lessonsCompleted, modules, level,
    xpInCurrentLevel, XP_PER_LEVEL, botBucks, equippedCharacter, rank,
    dailyReward, claimingDaily, claimDailyReward, getBadgeMeta, badgeCatalog, refresh,
  } = useUserProgress();
  const { colors, isDark } = useTheme();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);
  const [streakToast, setStreakToast] = useState(null);

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

  const emailDisplay = user?.email || '';
  const firstName = emailDisplay.split('@')[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  const rankMeta = getRankMeta(rank?.key);
  const levelProgress = xpInCurrentLevel / XP_PER_LEVEL;

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

  function handleQuickAction(action) {
    if (action.screen) {
      navigation.navigate(action.screen);
      return;
    }
    goToTab(action.tab);
  }

  async function handleDailyClaim() {
    const before = new Set(badges);
    const result = await claimDailyReward();
    if (!result?.badges) return;
    const newKey = result.badges.find((key) => !before.has(key));
    if (newKey) {
      navigation.navigate('BadgeReveal', { badgeKey: newKey, mode: 'earned' });
    }
  }

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Hub header */}
          <AnimatedCard delay={0} style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.username}>{displayName}</Text>
            </View>
            <TouchableOpacity
              style={styles.profileBtn}
              activeOpacity={0.85}
              onPress={() => goToTab('SettingsTab')}
            >
              <BrandAvatar character={equippedCharacter} size={44} autoRotate={!!equippedCharacter} />
              <View style={styles.profileBtnDot} />
            </TouchableOpacity>
          </AnimatedCard>

          {/* Status hero */}
          <AnimatedCard delay={60}>
            <LinearGradient
              colors={['rgba(61,220,95,0.18)', 'rgba(61,220,95,0.04)']}
              style={styles.heroCard}
            >
              <View style={styles.heroTop}>
                {rank ? (
                  <View style={styles.rankChip}>
                    <LinearGradient colors={rankMeta.gradient} style={styles.rankChipIcon}>
                      <Ionicons name={rankMeta.ionIcon} size={14} color="#fff" />
                    </LinearGradient>
                    <Text style={[styles.rankChipText, { color: rankMeta.color }]}>{rank.label}</Text>
                  </View>
                ) : (
                  <Text style={styles.heroEyebrow}>Your progress</Text>
                )}
                <Text style={styles.heroLevel}>Level {level}</Text>
              </View>

              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Ionicons name="flame" size={18} color={colors.streak} />
                  <Text style={styles.heroStatVal}>{streakDays}</Text>
                  <Text style={styles.heroStatLbl}>Streak</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Ionicons name="logo-bitcoin" size={18} color={colors.botBucks} />
                  <Text style={styles.heroStatVal}>{botBucks}</Text>
                  <Text style={styles.heroStatLbl}>Bot Bucks</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Ionicons name="school" size={18} color={colors.primary} />
                  <Text style={styles.heroStatVal}>{lessonsCompleted}</Text>
                  <Text style={styles.heroStatLbl}>Lessons</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Ionicons name="flash" size={18} color={colors.primaryLight} />
                  <Text style={styles.heroStatVal}>{xp}</Text>
                  <Text style={styles.heroStatLbl}>XP</Text>
                </View>
              </View>

              <View style={styles.xpSection}>
                <View style={styles.xpRow}>
                  <Text style={styles.xpLabel}>Level progress</Text>
                  <Text style={styles.xpValue}>{xpInCurrentLevel} / {XP_PER_LEVEL} XP</Text>
                </View>
                <View style={styles.xpTrack}>
                  <View style={[styles.xpFill, { width: `${Math.min(levelProgress * 100, 100)}%` }]} />
                </View>
                {rank?.next_label && (
                  <Text style={styles.rankNext}>{rank.points_to_next} pts to {rank.next_label}</Text>
                )}
              </View>
            </LinearGradient>
          </AnimatedCard>

          {/* Daily reward */}
          <AnimatedCard delay={90}>
            <DailyRewardCard
              dailyReward={dailyReward}
              botBucks={botBucks}
              onClaim={handleDailyClaim}
              claiming={claimingDaily}
              colors={colors}
            />
          </AnimatedCard>

          {/* Quick access */}
          <AnimatedCard delay={120} style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Access</Text>
            <View style={styles.quickGrid}>
              {QUICK_ACTIONS.map((action) => (
                <QuickActionTile
                  key={action.key}
                  action={action}
                  styles={styles}
                  onPress={() => handleQuickAction(action)}
                />
              ))}
            </View>
          </AnimatedCard>

          {/* Continue learning */}
          <AnimatedCard delay={180} style={styles.section}>
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

          {/* Module overview */}
          {moduleProgress.length > 0 && (
            <AnimatedCard delay={240} style={styles.section}>
              <View style={styles.sectionRow}>
                <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Your Roadmap</Text>
                <TouchableOpacity onPress={() => goToTab('CoursesTab')}>
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

          {/* Badges */}
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

          {/* Daily tip */}
          <AnimatedCard delay={360} style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Tip</Text>
            <View style={styles.tipCard}>
              <BrandLogo size="sm" style={styles.tipLogo} />
              <View style={styles.tipBody}>
                <Text style={styles.tipTag}>{BRAND_NAME}</Text>
                <Text style={styles.tipText}>{getDailyTip()}</Text>
              </View>
            </View>
          </AnimatedCard>

        </ScrollView>

        <BrandToast
          visible={!!streakToast}
          message={streakToast}
          onHide={() => setStreakToast(null)}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors, tabBarInset) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: tabBarInset },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 14, color: colors.textSecondary, marginBottom: 2 },
  username: { fontSize: 26, fontWeight: '800', color: colors.white, letterSpacing: -0.5 },
  profileBtn: { position: 'relative' },
  profileBtnDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },

  heroCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(61,220,95,0.25)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroEyebrow: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  rankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rankChipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankChipText: { fontSize: 13, fontWeight: '800' },
  heroLevel: { fontSize: 15, fontWeight: '700', color: colors.white },
  heroStats: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroStat: { flex: 1, alignItems: 'center', gap: 4 },
  heroStatVal: { fontSize: 18, fontWeight: '800', color: colors.white },
  heroStatLbl: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  heroStatDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  xpSection: { gap: 8 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xpLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  xpValue: { fontSize: 12, color: colors.textMuted },
  xpTrack: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  rankNext: { fontSize: 12, color: colors.textMuted },

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

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickTile: { width: '47.5%', flexGrow: 1, borderRadius: 16, overflow: 'hidden' },
  quickTileGrad: { padding: 16, minHeight: 108, justifyContent: 'flex-end' },
  quickTileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickTileLabel: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  quickTileSub: { fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 2 },

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
  badgeCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: 6,
  },
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
