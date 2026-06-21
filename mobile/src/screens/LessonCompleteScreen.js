import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { BrandAvatar, LevelUpModal } from '../components/brand';

const CONFETTI_COLORS = ['#3DDC5F', '#FFD700', '#FF6B35', '#00CED1', '#9B59B6', '#E74C3C'];

function ConfettiDot({ x, color, delay }) {
  const y = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(y, { toValue: 300 + Math.random() * 200, duration: 1200 + Math.random() * 600, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: 0,
        opacity,
        transform: [
          { translateY: y },
          { rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
        ],
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
    </Animated.View>
  );
}

export default function LessonCompleteScreen({ navigation, route }) {
  const { lesson, module, mistakes, stars } = route.params;
  const { completeLesson, equippedCharacter, level, XP_PER_LEVEL, xp } = useUserProgress();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpNumber, setLevelUpNumber] = useState(null);
  const previousLevelRef = useRef(Math.floor(xp / XP_PER_LEVEL) + 1);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const confettiItems = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    x: (i / 24) * 360 - 10,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: i * 40,
  }));

  useEffect(() => {
    completeLesson(lesson.id, mistakes || 0).then((res) => {
      setResult(res);
      setLoading(false);
      if (res && !res.already_completed) {
        const xpEarned = res.xp_earned || 0;
        const newLevel = Math.floor((xp + xpEarned) / XP_PER_LEVEL) + 1;
        if (newLevel > previousLevelRef.current) {
          setLevelUpNumber(newLevel);
          setShowLevelUp(true);
        }
      }
    });

    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const xpEarned = result?.xp_earned || 50;
  const botBucksEarned = result?.bot_bucks_earned ?? 0;
  const newBadge = result?.new_badge;
  const moduleComplete = result?.module_complete;

  function handleContinue() {
    if (newBadge) {
      navigation.navigate('BadgeReveal', {
        badgeKey: newBadge,
        mode: 'earned',
        next: moduleComplete
          ? { screen: 'MoneyChat', params: { module, badge: newBadge, xp: xpEarned } }
          : { screen: 'CourseMap' },
      });
      return;
    }
    if (moduleComplete) {
      navigation.navigate('MoneyChat', { module, badge: newBadge, xp: xpEarned });
    } else {
      navigation.navigate('CourseMap');
    }
  }

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Confetti */}
      <View style={styles.confettiLayer} pointerEvents="none">
        {confettiItems.map((c) => (
          <ConfettiDot key={c.id} x={c.x} color={c.color} delay={c.delay} />
        ))}
      </View>

      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <Animated.View style={[styles.checkWrap, { transform: [{ scale: scaleAnim }] }]}>
            <BrandAvatar character={equippedCharacter} size={110} autoRotate={!!equippedCharacter} logoSize={72} />
          </Animated.View>

          <Text style={styles.title}>Lesson Complete!</Text>
          <Text style={styles.lessonName}>{lesson.title}</Text>

          {/* Stars */}
          <View style={styles.starsRow}>
            {[1, 2, 3].map((s) => (
              <Text key={s} style={[styles.star, s <= (stars || 3) && styles.starLit]}>★</Text>
            ))}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statVal}>+{xpEarned}</Text>
              <Text style={styles.statLbl}>XP Earned</Text>
            </View>
            <View style={styles.statChip}>
              <View style={styles.botBucksVal}>
                <Ionicons name="logo-bitcoin" size={20} color={colors.botBucks} />
                <Text style={[styles.statVal, { color: colors.botBucks }]}>+{botBucksEarned}</Text>
              </View>
              <Text style={styles.statLbl}>Bot Bucks</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statVal}>{mistakes || 0}</Text>
              <Text style={styles.statLbl}>Mistakes</Text>
            </View>
          </View>

          {newBadge && (
            <View style={styles.badgeBanner}>
              <Ionicons name="ribbon" size={16} color="#FFD700" />
              <Text style={styles.badgeBannerText}>New badge waiting — tap continue!</Text>
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.85}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.continueBtnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={styles.continueBtnText}>
                {moduleComplete ? 'Start Money Chat' : 'Back to Roadmap'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={colors.background} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>

      <LevelUpModal
        visible={showLevelUp}
        level={levelUpNumber || level}
        onDismiss={() => setShowLevelUp(false)}
      />
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 24 },
  confettiLayer: { position: 'absolute', top: 0, left: 0, right: 0, height: 500, zIndex: 10 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 0 },
  checkWrap: { marginBottom: 28 },
  title: { fontSize: 32, fontWeight: '800', color: colors.white, marginBottom: 8, letterSpacing: -0.5 },
  lessonName: { fontSize: 16, color: colors.textSecondary, marginBottom: 24, textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  star: { fontSize: 40, color: colors.border },
  starLit: { color: '#FFD700' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statChip: {
    flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 18,
    paddingVertical: 18, paddingHorizontal: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  botBucksVal: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statVal: { fontSize: 24, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  statLbl: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  badgeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  badgeBannerText: { fontSize: 15, fontWeight: '700', color: '#FFD700' },
  footer: { paddingBottom: 16 },
  continueBtn: { borderRadius: 18, overflow: 'hidden' },
  continueBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 18, borderRadius: 18,
  },
  continueBtnText: { fontSize: 17, fontWeight: '800', color: colors.background },
});
