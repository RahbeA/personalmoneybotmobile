import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Easing, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useUserProgress, getRankMeta } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { coursesApi } from '../api/courses';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

const confettiLayerStyle = {
  position: 'absolute', top: 0, left: 0, right: 0, height: '100%', zIndex: 10,
};

// Ordered ladder for the teaser + reveal (matches backend RANK_TIERS).
const RANK_LADDER = [
  { key: 'bronze', label: 'Money Rookie' },
  { key: 'silver', label: 'Money Apprentice' },
  { key: 'gold', label: 'Money Strategist' },
  { key: 'platinum', label: 'Money Master' },
  { key: 'diamond', label: 'Wealth Wizard' },
];

const CALC_LINES = [
  'Reading your money mind...',
  'Crunching the numbers...',
  'Calibrating your rank...',
];

function ConfettiBurst({ colors }) {
  const palette = [colors.primary, '#F5B72B', '#56C8E8', '#A66BFF', '#FF6B35'];
  const dots = useRef(
    Array.from({ length: 26 }, (_, i) => ({
      key: i,
      anim: new Animated.Value(0),
      x: (Math.random() - 0.5) * 320,
      rot: Math.random() * 2,
      delay: Math.random() * 350,
      color: palette[i % palette.length],
      size: 7 + Math.random() * 7,
    }))
  ).current;

  useEffect(() => {
    Animated.stagger(
      18,
      dots.map((d) =>
        Animated.timing(d.anim, {
          toValue: 1,
          duration: 1500,
          delay: d.delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, []);

  return (
    <View pointerEvents="none" style={confettiLayerStyle}>
      {dots.map((d) => (
        <Animated.View
          key={d.key}
          style={{
            position: 'absolute',
            top: 0,
            alignSelf: 'center',
            width: d.size,
            height: d.size * 1.4,
            borderRadius: 2,
            backgroundColor: d.color,
            opacity: d.anim.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: d.anim.interpolate({ inputRange: [0, 1], outputRange: [0, d.x] }) },
              { translateY: d.anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 540] }) },
              { rotate: d.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${d.rot * 360}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const { token } = useAuth();
  const { submitOnboarding, finishOnboarding, rank: ctxRank } = useUserProgress();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [phase, setPhase] = useState('loading'); // loading | intro | question | calculating | reveal | error
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [calcLine, setCalcLine] = useState(CALC_LINES[0]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await coursesApi.getOnboardingQuestions(token);
        if (cancelled) return;
        setQuestions(data.questions || []);
        setPhase('intro');
      } catch (e) {
        if (!cancelled) setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const runSubmit = useCallback(async (finalAnswers) => {
    setPhase('calculating');
    let i = 0;
    const ticker = setInterval(() => {
      i = (i + 1) % CALC_LINES.length;
      setCalcLine(CALC_LINES[i]);
    }, 700);

    const [res] = await Promise.all([
      submitOnboarding(finalAnswers),
      new Promise((r) => setTimeout(r, 1900)),
    ]);

    clearInterval(ticker);
    setResult(res);
    setPhase('reveal');
  }, [submitOnboarding]);

  function handleSelect(question, optionId) {
    if (selected) return; // ignore double taps mid-transition
    setSelected(optionId);
    const nextAnswers = { ...answers, [question.id]: optionId };

    setTimeout(() => {
      setAnswers(nextAnswers);
      setSelected(null);
      if (qIndex + 1 >= questions.length) {
        runSubmit(nextAnswers);
      } else {
        setQIndex((prev) => prev + 1);
      }
    }, 300);
  }

  // ---- Loading ----
  if (phase === 'loading') {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={[styles.safe, styles.center]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ---- Error fallback ----
  if (phase === 'error') {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={[styles.safe, styles.center]}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
          <Text style={styles.errTitle}>Couldn{"'"}t load your money quiz</Text>
          <Text style={styles.errText}>No worries — you can jump straight in and take it later.</Text>
          <PrimaryButton styles={styles} colors={colors} label="Continue" onPress={finishOnboarding} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ---- Intro ----
  if (phase === 'intro') {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe}>
          <IntroView styles={styles} colors={colors} onStart={() => setPhase('question')} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ---- Calculating ----
  if (phase === 'calculating') {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={[styles.safe, styles.center]}>
          <PulseLogo colors={colors} />
          <Text style={styles.calcText}>{calcLine}</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ---- Reveal ----
  if (phase === 'reveal') {
    const rank = result?.rank || ctxRank;
    const score = result?.score;
    const total = result?.total;
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ConfettiBurst colors={colors} />
        <SafeAreaView style={styles.safe}>
          <RevealView
            styles={styles}
            colors={colors}
            rank={rank}
            score={score}
            total={total}
            onDone={finishOnboarding}
          />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ---- Question ----
  const question = questions[qIndex];
  const progress = (qIndex) / questions.length;

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressCount}>Question {qIndex + 1} of {questions.length}</Text>
          <View style={styles.progressTrack}>
            <ProgressFill colors={colors} progress={progress} />
          </View>
        </View>

        <QuestionCard
          key={question.id}
          styles={styles}
          colors={colors}
          question={question}
          selected={selected}
          onSelect={handleSelect}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

function ProgressFill({ colors, progress }) {
  const anim = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: progress, duration: 400, useNativeDriver: false }).start();
  }, [progress]);
  return (
    <Animated.View
      style={{
        height: '100%',
        borderRadius: 4,
        backgroundColor: colors.primary,
        width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }}
    />
  );
}

function QuestionCard({ styles, colors, question, selected, onSelect }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [question.id]);

  return (
    <Animated.View
      style={[
        styles.qWrap,
        {
          opacity: anim,
          transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        },
      ]}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.qScroll}>
        <Text style={styles.qEmoji}>{question.emoji}</Text>
        <View style={styles.topicChip}>
          <Text style={styles.topicChipText}>{question.topic}</Text>
        </View>
        <Text style={styles.qVibe}>{question.vibe}</Text>
        <Text style={styles.qPrompt}>{question.prompt}</Text>

        <View style={styles.options}>
          {question.options.map((opt, i) => {
            const isSel = selected === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.option, isSel && styles.optionSel]}
                activeOpacity={0.85}
                onPress={() => onSelect(question, opt.id)}
              >
                <View style={[styles.optionLetter, isSel && styles.optionLetterSel]}>
                  <Text style={[styles.optionLetterText, isSel && styles.optionLetterTextSel]}>
                    {OPTION_LETTERS[i] || '?'}
                  </Text>
                </View>
                <Text style={[styles.optionText, isSel && styles.optionTextSel]}>{opt.text}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

function IntroView({ styles, colors, onStart }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.introWrap,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        },
      ]}
    >
      <View style={styles.introTop}>
        <View style={styles.introIcon}>
          <Ionicons name="sparkles" size={40} color={colors.primary} />
        </View>
        <Text style={styles.introTitle}>What{"'"}s your Money IQ?</Text>
        <Text style={styles.introSub}>
          5 quick questions. No studying, no pressure. We{"'"}ll reveal your starting rank — then
          you level it up by crushing lessons.
        </Text>
      </View>

      <View style={styles.ladderCard}>
        {RANK_LADDER.map((r, i) => {
          const meta = getRankMeta(r.key);
          return (
            <View key={r.key} style={styles.ladderRow}>
              <LinearGradient colors={meta.gradient} style={styles.ladderBadge}>
                <Ionicons name={meta.ionIcon} size={15} color="#fff" />
              </LinearGradient>
              <Text style={styles.ladderLabel}>{r.label}</Text>
              {i < RANK_LADDER.length - 1 && (
                <Ionicons name="arrow-up" size={13} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
              )}
            </View>
          );
        })}
      </View>

      <PrimaryButton styles={styles} colors={colors} label="Let's find out" icon="arrow-forward" onPress={onStart} />
      <Text style={styles.introFootnote}>
        Based on the “Big Three” financial literacy questions by economists Lusardi & Mitchell.
      </Text>
    </Animated.View>
  );
}

function RevealView({ styles, colors, rank, score, total, onDone }) {
  const anim = useRef(new Animated.Value(0)).current;
  const meta = getRankMeta(rank?.key);

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={styles.revealWrap}>
      <Animated.View
        style={{
          alignItems: 'center',
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        }}
      >
        <Text style={styles.revealKicker}>YOUR STARTING RANK</Text>
        <LinearGradient colors={meta.gradient} style={styles.revealBadge}>
          <Ionicons name={meta.ionIcon} size={56} color="#fff" />
        </LinearGradient>
        <Text style={[styles.revealRank, { color: meta.color }]}>{rank?.label || 'Money Rookie'}</Text>
        {typeof score === 'number' && (
          <Text style={styles.revealScore}>You nailed {score}/{total} right</Text>
        )}
      </Animated.View>

      <View style={styles.revealCard}>
        <View style={styles.revealCardRow}>
          <Ionicons name="trending-up" size={18} color={colors.primary} />
          <Text style={styles.revealCardText}>
            {rank?.next_label
              ? `This is just the start. Earn ${rank.points_to_next} more points to reach ${rank.next_label}.`
              : `You're already at the top tier — keep learning to stay sharp!`}
          </Text>
        </View>
        <View style={styles.revealCardRow}>
          <Ionicons name="rocket" size={18} color={colors.primary} />
          <Text style={styles.revealCardText}>
            Every lesson, streak, and task you complete pushes your rank higher.
          </Text>
        </View>
      </View>

      <PrimaryButton styles={styles} colors={colors} label="Enter MoneyBot" icon="arrow-forward" onPress={onDone} />
    </View>
  );
}

function PrimaryButton({ styles, colors, label, icon, onPress }) {
  return (
    <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={onPress}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.primaryBtnGrad}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      >
        <Text style={styles.primaryBtnText}>{label}</Text>
        {icon && <Ionicons name={icon} size={20} color={colors.background} />}
      </LinearGradient>
    </TouchableOpacity>
  );
}

function PulseLogo({ colors }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 650, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        width: 96, height: 96, borderRadius: 48,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(61,220,95,0.12)',
        borderWidth: 1, borderColor: 'rgba(61,220,95,0.3)',
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }],
        marginBottom: 22,
      }}
    >
      <Ionicons name="sparkles" size={42} color={colors.primary} />
    </Animated.View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },

  // Intro
  introWrap: { flex: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, justifyContent: 'center' },
  introTop: { alignItems: 'center', marginBottom: 28 },
  introIcon: {
    width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(61,220,95,0.12)', borderWidth: 1, borderColor: 'rgba(61,220,95,0.3)', marginBottom: 20,
  },
  introTitle: { fontSize: 28, fontWeight: '800', color: colors.white, textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 },
  introSub: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  ladderCard: {
    backgroundColor: colors.surfaceElevated, borderRadius: 18, padding: 14, gap: 10,
    borderWidth: 1, borderColor: colors.border, marginBottom: 28,
  },
  ladderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ladderBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  ladderLabel: { fontSize: 14, fontWeight: '600', color: colors.white },
  introFootnote: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 16, lineHeight: 17 },

  // Progress
  progressHeader: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4, gap: 10 },
  progressCount: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },

  // Question
  qWrap: { flex: 1 },
  qScroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 },
  qEmoji: { fontSize: 52, textAlign: 'center', marginBottom: 14 },
  topicChip: {
    alignSelf: 'center', backgroundColor: 'rgba(61,220,95,0.12)', borderWidth: 1,
    borderColor: 'rgba(61,220,95,0.3)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 14,
  },
  topicChipText: { fontSize: 12, fontWeight: '700', color: colors.primary, letterSpacing: 0.3 },
  qVibe: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 10 },
  qPrompt: { fontSize: 20, fontWeight: '700', color: colors.white, textAlign: 'center', lineHeight: 28, marginBottom: 26 },
  options: { gap: 12 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: colors.border,
  },
  optionSel: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.12)' },
  optionLetter: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  optionLetterSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionLetterText: { fontSize: 14, fontWeight: '800', color: colors.textSecondary },
  optionLetterTextSel: { color: colors.background },
  optionText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.white },
  optionTextSel: { color: colors.white },

  // Calculating
  calcText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },

  // Reveal
  revealWrap: { flex: 1, paddingHorizontal: 24, paddingBottom: 16, justifyContent: 'center' },
  revealKicker: { fontSize: 13, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5, marginBottom: 18 },
  revealBadge: {
    width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 10,
  },
  revealRank: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  revealScore: { fontSize: 15, color: colors.textSecondary, fontWeight: '600' },
  revealCard: {
    backgroundColor: colors.surfaceElevated, borderRadius: 18, padding: 18, gap: 14,
    borderWidth: 1, borderColor: colors.border, marginTop: 30, marginBottom: 24,
  },
  revealCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  revealCardText: { flex: 1, fontSize: 14, color: colors.offWhite, lineHeight: 20 },

  // Shared
  primaryBtn: { borderRadius: 16, overflow: 'hidden' },
  primaryBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '800', color: colors.background },

  // Error
  errTitle: { fontSize: 20, fontWeight: '800', color: colors.white, textAlign: 'center' },
  errText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 8 },
});
