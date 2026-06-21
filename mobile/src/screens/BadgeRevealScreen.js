import React, { useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import BadgeIcon from '../components/BadgeIcon';

const METRIC_LABELS = {
  lessons_completed: 'lessons completed',
  modules_completed: 'modules completed',
  module_completed: 'module completed',
  streak_days: 'day lesson streak',
  daily_claim_streak: 'day claim streak',
  daily_reward_day: 'daily reward tier',
  bot_bucks: 'Bot Bucks',
  xp: 'XP',
  onboarding_score: 'onboarding score',
  characters_owned: 'characters owned',
  questions_correct: 'questions correct',
  perfect_lessons: 'perfect lessons',
};

function ConfettiBurst({ accent, active }) {
  const palette = [accent, '#F5B72B', '#56C8E8', '#A66BFF', '#FF6B35', '#FFD700'];
  const dots = useRef(
    Array.from({ length: 28 }, (_, i) => ({
      key: i,
      anim: new Animated.Value(0),
      x: (Math.random() - 0.5) * 340,
      delay: Math.random() * 400,
      color: palette[i % palette.length],
      size: 6 + Math.random() * 8,
    }))
  ).current;

  useEffect(() => {
    if (!active) return;
    Animated.stagger(
      16,
      dots.map((d) =>
        Animated.timing(d.anim, {
          toValue: 1,
          duration: 1400,
          delay: d.delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, [active, dots]);

  if (!active) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {dots.map((d) => (
        <Animated.View
          key={d.key}
          style={{
            position: 'absolute',
            top: '28%',
            alignSelf: 'center',
            width: d.size,
            height: d.size * 1.35,
            borderRadius: 2,
            backgroundColor: d.color,
            opacity: d.anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: d.x },
              {
                translateY: d.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 280 + Math.random() * 120],
                }),
              },
              {
                rotate: d.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${180 + Math.random() * 180}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

function formatRequirement(badge) {
  const label = METRIC_LABELS[badge.metric] || badge.metric?.replace(/_/g, ' ');
  return `Earn at ${badge.threshold} ${label}`;
}

export default function BadgeRevealScreen({ navigation, route }) {
  const {
    badgeKey,
    mode = 'view',
    earned: earnedParam,
    next,
  } = route.params || {};

  const { getBadgeMeta, badges, xp, streakDays, lessonsCompleted, botBucks } = useUserProgress();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, insets.bottom), [colors, insets.bottom]);

  const badge = getBadgeMeta(badgeKey);
  const accent = badge.accent_color || badge.color || colors.primary;
  const isEarned = earnedParam ?? badges.includes(badgeKey);
  const isUnlock = mode === 'earned' || (mode === 'view' && isEarned);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(36)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeRotate = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 52, friction: 9, useNativeDriver: true }),
        Animated.spring(badgeScale, { toValue: 1, tension: 42, friction: 5, delay: 120, useNativeDriver: true }),
        Animated.timing(badgeRotate, {
          toValue: 1,
          duration: 700,
          delay: 100,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
        Animated.timing(ringAnim, { toValue: 1, duration: 900, delay: 200, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    if (isUnlock) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shineAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
          Animated.timing(shineAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isUnlock]);

  function handleClose() {
    if (next?.screen) {
      navigation.replace(next.screen, next.params || {});
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }

  const progressHint = (() => {
    if (isEarned || !badge.metric) return null;
    const current = {
      lessons_completed: lessonsCompleted,
      streak_days: streakDays,
      bot_bucks: botBucks,
      xp,
    }[badge.metric];
    if (typeof current === 'number' && badge.threshold) {
      return `${Math.min(current, badge.threshold)} / ${badge.threshold}`;
    }
    return formatRequirement(badge);
  })();

  const headline = mode === 'earned'
    ? 'Badge Unlocked!'
    : isEarned
      ? badge.label || badge.name
      : 'Badge Locked';

  const subline = mode === 'earned'
    ? 'You crushed it — this achievement is yours.'
    : isEarned
      ? 'Achievement earned'
      : 'Keep going to unlock this badge';

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ConfettiBurst accent={accent} active={mode === 'earned'} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={12}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.eyebrow}>{subline}</Text>
          <Text style={styles.headline}>{headline}</Text>

          <View style={styles.heroWrap}>
            <Animated.View
              style={[
                styles.ring,
                styles.ringOuter,
                {
                  borderColor: accent + '44',
                  opacity: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }),
                  transform: [{ scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.45] }) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.ring,
                styles.ringMid,
                {
                  borderColor: accent + '66',
                  opacity: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
                  transform: [{ scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.25] }) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.glow,
                {
                  backgroundColor: accent,
                  opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.28] }),
                  transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.08] }) }],
                },
              ]}
            />

            <Animated.View
              style={{
                transform: [
                  { scale: badgeScale },
                  {
                    rotate: badgeRotate.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-18deg', '0deg'],
                    }),
                  },
                ],
              }}
            >
              <View style={[styles.badgePlate, { borderColor: accent + '55', opacity: isEarned ? 1 : 0.45 }]}>
                <BadgeIcon badge={badge} size={120} />
                {!isEarned && (
                  <View style={styles.lockOverlay}>
                    <Ionicons name="lock-closed" size={28} color="#fff" />
                  </View>
                )}
              </View>
            </Animated.View>

            {isUnlock && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.shine,
                  {
                    opacity: shineAnim.interpolate({ inputRange: [0, 0.4, 0.8, 1], outputRange: [0, 0.5, 0, 0] }),
                    transform: [
                      {
                        translateX: shineAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-80, 80],
                        }),
                      },
                    ],
                  },
                ]}
              />
            )}
          </View>

          {mode !== 'earned' && (
            <Text style={[styles.badgeTitle, { color: accent }]}>{badge.label || badge.name}</Text>
          )}

          {!!badge.description && (
            <Text style={styles.description}>{badge.description}</Text>
          )}

          {!isEarned && progressHint && (
            <View style={[styles.progressChip, { borderColor: accent + '33' }]}>
              <Ionicons name="flag-outline" size={14} color={accent} />
              <Text style={[styles.progressText, { color: accent }]}>{progressHint}</Text>
            </View>
          )}

          {mode === 'earned' && (
            <View style={[styles.nameChip, { backgroundColor: accent + '18', borderColor: accent + '44' }]}>
              <Ionicons name="ribbon" size={16} color={accent} />
              <Text style={[styles.nameChipText, { color: accent }]}>{badge.label || badge.name}</Text>
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.ctaBtn} onPress={handleClose} activeOpacity={0.85}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.ctaGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.ctaText}>
                {mode === 'earned' ? 'Nice!' : 'Close'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={colors.background} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors, bottomInset) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 24 },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 24 },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  headline: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 32,
  },
  heroWrap: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 999,
  },
  ringOuter: { width: 210, height: 210 },
  ringMid: { width: 170, height: 170 },
  glow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  badgePlate: {
    width: 148,
    height: 148,
    borderRadius: 74,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    overflow: 'hidden',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shine: {
    position: 'absolute',
    width: 40,
    height: 160,
    backgroundColor: 'rgba(255,255,255,0.35)',
    transform: [{ rotate: '24deg' }],
  },
  badgeTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  progressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: colors.surfaceElevated,
  },
  progressText: { fontSize: 13, fontWeight: '700' },
  nameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  nameChipText: { fontSize: 17, fontWeight: '800' },
  footer: { paddingBottom: Math.max(bottomInset, 16) },
  ctaBtn: { borderRadius: 18, overflow: 'hidden' },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 18,
  },
  ctaText: { fontSize: 17, fontWeight: '800', color: colors.background },
});
