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
import DailyRewardCard from '../components/DailyRewardCard';
import DailyClaimCelebration from '../components/DailyClaimCelebration';
import BadgeIcon from '../components/BadgeIcon';
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

function hairlineBorder(isDark) {
  return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
}

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
};

function GradientProgressBar({ progress, trackStyle, fillStyle, colors: themeColors }) {
  const pct = `${Math.min(Math.max(progress, 0), 1) * 100}%`;
  return (
    <View style={trackStyle}>
      <LinearGradient
        colors={[themeColors.primaryLight, themeColors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[fillStyle, { width: pct }]}
      />
    </View>
  );
}

function SectionHeader({ title, linkLabel, onLinkPress, styles }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>{title}</Text>
      {linkLabel && onLinkPress ? (
        <TouchableOpacity onPress={onLinkPress} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.sectionLink}>{linkLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
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
    streakDays, badges, modules, level,
    xpInCurrentLevel, XP_PER_LEVEL, botBucks, equippedCharacter, rank,
    dailyReward, claimingDaily, claimDailyReward, getBadgeMeta, badgeCatalog, refresh,
  } = useUserProgress();
  const { colors, isDark } = useTheme();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset, isDark), [colors, tabBarInset, isDark]);
  const [streakToast, setStreakToast] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const pendingBadgeRef = useRef(null);
  const pillPulse = useRef(new Animated.Value(0)).current;
  const prevBucks = useRef(botBucks);

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

  // Give the header stat pill a quick pop whenever Bot Bucks go up (claim,
  // lesson reward, etc.) so the balance change is felt, not just seen.
  useEffect(() => {
    if (botBucks > prevBucks.current) {
      pillPulse.setValue(0);
      Animated.sequence([
        Animated.timing(pillPulse, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(pillPulse, { toValue: 0, friction: 4, tension: 120, useNativeDriver: true }),
      ]).start();
    }
    prevBucks.current = botBucks;
  }, [botBucks, pillPulse]);

  const displayName = getFirstName(user);
  const rankMeta = getRankMeta(rank?.key);
  const levelProgress = xpInCurrentLevel / XP_PER_LEVEL;
  const levelProgressPct = Math.round(levelProgress * 100);

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

  async function handleDailyClaim() {
    // Capture the amount up front — claiming advances the ladder, so
    // dailyReward.claim_amount changes to the *next* day once we're done.
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
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Header: greeting + avatar */}
          <AnimatedCard delay={0}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.greetingEyebrow}>{getGreeting()}</Text>
                <Text style={styles.username} numberOfLines={1}>{displayName}</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => goToTab('SettingsTab')}
                accessibilityRole="button"
                accessibilityLabel="Open profile"
              >
                <View style={styles.avatarRing}>
                  <BrandAvatar character={equippedCharacter} size={44} autoRotate={!!equippedCharacter} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Full-width stats strip */}
            <Animated.View style={{ transform: [{ scale: pillPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }] }}>
              <TouchableOpacity
                style={styles.statsStrip}
                activeOpacity={0.88}
                onPress={() => goToTab('SettingsTab')}
                accessibilityRole="button"
                accessibilityLabel="View your stats and profile"
              >
                <View style={styles.stripStat}>
                  <Ionicons name="flame" size={16} color={colors.streak} />
                  <Text style={styles.stripStatVal}>{streakDays}</Text>
                  <Text style={styles.stripStatLbl}>Streak</Text>
                </View>
                <View style={styles.stripDivider} />
                <View style={styles.stripStat}>
                  <Ionicons name="logo-bitcoin" size={16} color={colors.botBucks} />
                  <Text style={styles.stripStatVal}>{botBucks}</Text>
                  <Text style={styles.stripStatLbl}>Bot Bucks</Text>
                </View>
                <View style={styles.stripDivider} />
                <View style={styles.stripStat}>
                  <Ionicons name="flash" size={16} color={colors.primary} />
                  <Text style={styles.stripStatVal}>{xpInCurrentLevel}</Text>
                  <Text style={styles.stripStatLbl}>XP</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.stripChevron} />
              </TouchableOpacity>
            </Animated.View>
          </AnimatedCard>

          {/* Hero: continue lesson */}
          <AnimatedCard delay={60} style={styles.block}>
            {nextLesson ? (
              <TouchableOpacity
                style={styles.heroLesson}
                activeOpacity={0.9}
                onPress={() => goToTab('CoursesTab')}
              >
                <LinearGradient
                  colors={['rgba(61,220,95,0.22)', 'rgba(61,220,95,0.04)', 'transparent']}
                  style={styles.heroLessonGlow}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <LinearGradient
                  colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0)']}
                  style={styles.cardSheen.top}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
                <View style={styles.heroLessonTop}>
                  <Text style={styles.heroLessonEyebrow}>CONTINUE LEARNING</Text>
                  <View style={styles.heroPlayBtn}>
                    <Ionicons name="play" size={18} color={colors.background} />
                  </View>
                </View>
                <Text style={styles.heroLessonTitle}>{nextLesson.lesson.title}</Text>
                <Text style={styles.heroLessonMod}>{nextLesson.module.title}</Text>
                <View style={styles.heroLessonProgress}>
                  <GradientProgressBar
                    progress={nextLesson.module.completed_lesson_count / nextLesson.module.lesson_count}
                    trackStyle={styles.progressTrack}
                    fillStyle={styles.progressFill}
                    colors={colors}
                  />
                  <Text style={styles.heroLessonMeta}>
                    {nextLesson.module.completed_lesson_count}/{nextLesson.module.lesson_count} lessons
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.allDoneCard}>
                <Ionicons name="trophy" size={36} color={colors.primary} />
                <Text style={styles.allDoneTitle}>All caught up!</Text>
                <Text style={styles.allDoneText}>You've completed every lesson. Nice work.</Text>
              </View>
            )}
          </AnimatedCard>

          {/* Slim progress ribbon */}
          <AnimatedCard delay={90} style={styles.block}>
            <View style={styles.progressRibbon}>
              {rank ? (
                <View style={styles.ribbonRank}>
                  <LinearGradient colors={rankMeta.gradient} style={styles.ribbonRankDot}>
                    <Ionicons name={rankMeta.ionIcon} size={11} color="#fff" />
                  </LinearGradient>
                  <Text style={[styles.ribbonRankText, { color: rankMeta.color }]} numberOfLines={1}>
                    {rank.label}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.ribbonLevel}>Lv {level}</Text>
              <View style={styles.ribbonBarWrap}>
                <GradientProgressBar
                  progress={levelProgress}
                  trackStyle={styles.ribbonTrack}
                  fillStyle={styles.ribbonFill}
                  colors={colors}
                />
              </View>
              <Text style={styles.ribbonPct}>{levelProgressPct}%</Text>
            </View>
            <Text style={styles.ribbonNext}>
              {rank?.next_label
                ? `${rank.points_to_next} XP to ${rank.next_label}`
                : `${XP_PER_LEVEL - xpInCurrentLevel} XP to Level ${level + 1}`}
            </Text>
          </AnimatedCard>

          {/* Daily reward */}
          <AnimatedCard delay={120}>
            <DailyRewardCard
              dailyReward={dailyReward}
              onClaim={handleDailyClaim}
              claiming={claimingDaily}
              colors={colors}
              isDark={isDark}
            />
          </AnimatedCard>

          {/* Money Arcade */}
          <AnimatedCard delay={150} style={styles.block}>
            <TouchableOpacity
              style={styles.arcadeCard}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('Arcade')}
            >
              <LinearGradient
                colors={['#4F46E5', '#7C3AED', '#5B21B6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.arcadeCardGrad}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
                  style={styles.arcadeSheen}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
                <View style={styles.arcadeIconWrap}>
                  <Ionicons name="game-controller" size={26} color="#FFFFFF" />
                </View>
                <View style={styles.arcadeBody}>
                  <Text style={styles.arcadeLabel}>MONEY ARCADE</Text>
                  <Text style={styles.arcadeTitle}>Play mini-games</Text>
                  <Text style={styles.arcadeSub}>Spend Bot Bucks · Earn XP</Text>
                </View>
                <View style={styles.arcadeGo}>
                  <Ionicons name="chevron-forward" size={20} color="#5B21B6" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </AnimatedCard>

          {/* Roadmap carousel */}
          {moduleProgress.length > 0 && (
            <AnimatedCard delay={210} style={styles.section}>
              <SectionHeader
                title="Your Roadmap"
                linkLabel="View all"
                onLinkPress={() => goToTab('CoursesTab')}
                styles={styles}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.roadmapCarousel}
              >
                {moduleProgress.map((mod) => (
                  <TouchableOpacity
                    key={mod.id}
                    style={styles.roadmapCard}
                    activeOpacity={0.88}
                    onPress={() => goToTab('CoursesTab')}
                  >
                    <View style={styles.roadmapCardIcon}>
                      <Ionicons name={getModuleIonIcon(mod)} size={22} color={colors.primary} />
                    </View>
                    <Text style={styles.roadmapCardTitle} numberOfLines={2}>{mod.title}</Text>
                    <View style={styles.roadmapCardProgress}>
                      <GradientProgressBar
                        progress={mod.pct / 100}
                        trackStyle={styles.roadmapTrack}
                        fillStyle={styles.roadmapFill}
                        colors={colors}
                      />
                    </View>
                    <Text style={styles.roadmapCardPct}>{mod.pct}% complete</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </AnimatedCard>
          )}

          {/* Badges */}
          {catalogBadges.length > 0 && (
            <AnimatedCard delay={270} style={styles.section}>
              <Text style={styles.sectionEyebrow}>ACHIEVEMENTS</Text>
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
            <AnimatedCard delay={270} style={styles.section}>
              <Text style={styles.sectionEyebrow}>ACHIEVEMENTS</Text>
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

          {/* Tip banner */}
          <AnimatedCard delay={330} style={styles.block}>
            <View style={styles.tipBanner}>
              <View style={styles.tipBannerIcon}>
                <BrandLogo size="sm" style={styles.tipLogo} />
              </View>
              <View style={styles.tipBannerBody}>
                <Text style={styles.tipBannerLabel}>Today's tip</Text>
                <Text style={styles.tipBannerText} numberOfLines={2}>{getDailyTip()}</Text>
              </View>
            </View>
          </AnimatedCard>

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

const makeStyles = (colors, tabBarInset, isDark) => {
  const hairline = hairlineBorder(isDark);
  const cardBase = {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: hairline,
    overflow: 'hidden',
    ...CARD_SHADOW,
  };

  return StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: tabBarInset },

  cardSheen: {
    top: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 72,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    accent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 120,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  headerLeft: { flex: 1, marginRight: 14 },
  greetingEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  username: { fontSize: 30, fontWeight: '800', color: colors.white, letterSpacing: -0.8 },
  avatarRing: {
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.primaryTintStrong,
    padding: 2,
  },

  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: hairline,
    marginBottom: 28,
    ...CARD_SHADOW,
  },
  stripStat: { flex: 1, alignItems: 'center', gap: 2 },
  stripStatVal: { fontSize: 18, fontWeight: '800', color: colors.white, letterSpacing: -0.3 },
  stripStatLbl: { fontSize: 10, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.2 },
  stripDivider: { width: 1, height: 32, backgroundColor: hairline },
  stripChevron: { marginLeft: 4 },

  heroLesson: {
    ...cardBase,
    padding: 22,
    position: 'relative',
    borderColor: isDark ? 'rgba(61,220,95,0.2)' : 'rgba(22,163,74,0.2)',
  },
  heroLessonGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
  },
  heroLessonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroLessonEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.2,
  },
  heroPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  heroLessonTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.4,
    marginBottom: 6,
    lineHeight: 28,
  },
  heroLessonMod: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 16,
  },
  heroLessonProgress: { gap: 8 },
  heroLessonMeta: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },

  progressRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  ribbonRank: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 120,
  },
  ribbonRankDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbonRankText: { fontSize: 11, fontWeight: '800', flexShrink: 1 },
  ribbonLevel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: -0.2,
  },
  ribbonBarWrap: { flex: 1 },
  ribbonTrack: {
    height: 6,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  ribbonFill: { height: '100%', borderRadius: 6 },
  ribbonPct: { fontSize: 12, fontWeight: '800', color: colors.primary, minWidth: 32, textAlign: 'right' },
  ribbonNext: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },

  block: { marginBottom: 28 },
  arcadeCard: { borderRadius: 24, overflow: 'hidden', ...CARD_SHADOW },
  arcadeCardGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 20,
    position: 'relative',
  },
  arcadeSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  arcadeIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  arcadeBody: { flex: 1 },
  arcadeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  arcadeTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 3,
    letterSpacing: -0.3,
  },
  arcadeSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  arcadeGo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: { marginBottom: 28 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  sectionTitleInline: { marginBottom: 0 },
  sectionLink: { fontSize: 13, fontWeight: '700', color: colors.primary },

  progressTrack: {
    height: 6,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 6 },
  allDoneCard: {
    ...cardBase,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  allDoneTitle: { fontSize: 18, fontWeight: '800', color: colors.white, letterSpacing: -0.2 },
  allDoneText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  roadmapCarousel: { gap: 12, paddingRight: 4 },
  roadmapCard: {
    width: 168,
    ...cardBase,
    padding: 16,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  roadmapCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
    marginBottom: 12,
  },
  roadmapCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.2,
    marginBottom: 12,
    minHeight: 36,
  },
  roadmapCardProgress: { marginBottom: 8 },
  roadmapCardPct: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  roadmapTrack: {
    height: 5,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  roadmapFill: { height: '100%', borderRadius: 5 },

  badgesScroll: { marginHorizontal: -4 },
  badgeItem: { alignItems: 'center', marginHorizontal: 8, width: 72 },
  badgeItemLocked: { opacity: 0.75 },
  badgeLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', fontWeight: '600' },
  badgeLabelLocked: { color: colors.textMuted },

  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: hairline,
  },
  tipBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
  },
  tipLogo: { width: 22, height: 22 },
  tipBannerBody: { flex: 1 },
  tipBannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  tipBannerText: { fontSize: 13, color: colors.offWhite, lineHeight: 18, fontWeight: '500' },
  });
};
