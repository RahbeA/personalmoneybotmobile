import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Easing, ScrollView, PanResponder, Pressable, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useUserProgress, getRankMeta } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { coursesApi } from '../api/courses';
import { cacheKeys, fetchWithCache, TTL } from '../utils/apiCache';
import { getFirstName } from '../utils/displayName';
import { localDate } from '../utils/localDate';
import { GOALS } from '../constants/goals';
import {
  areNotificationsSupported,
  getNotificationPermissionInfo,
  loadNotificationPrefs,
  saveNotificationPrefs,
  syncNotificationSchedule,
} from '../utils/notifications';

// Map each onboarding question to a reliable Ionicon. Raw emoji glyphs (e.g. 💸,
// 🧺) render as empty "?" boxes on some iOS versions, so we key off the question
// slug/topic and fall back to a generic money icon.
const QUESTION_ICON_BY_ID = {
  interest: 'trending-up',
  inflation: 'balloon',
  diversification: 'basket',
  bonds: 'stats-chart',
  mortgage: 'home',
};

function questionIcon(question) {
  if (!question) return 'cash';
  if (QUESTION_ICON_BY_ID[question.id]) return QUESTION_ICON_BY_ID[question.id];
  const topic = (question.topic || '').toLowerCase();
  if (topic.includes('interest')) return 'trending-up';
  if (topic.includes('inflation')) return 'balloon';
  if (topic.includes('divers') || topic.includes('risk')) return 'basket';
  if (topic.includes('bond')) return 'stats-chart';
  if (topic.includes('loan') || topic.includes('mortgage')) return 'home';
  if (topic.includes('budget')) return 'pie-chart';
  if (topic.includes('credit')) return 'card';
  if (topic.includes('sav')) return 'wallet';
  if (topic.includes('tax')) return 'receipt';
  if (topic.includes('invest')) return 'trending-up';
  return 'cash';
}

const confettiLayerStyle = {
  position: 'absolute', top: 0, left: 0, right: 0, height: '100%', zIndex: 10,
};

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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Springy press feedback wrapper — makes every tappable feel tactile. Layout
// styles (flex, width, padding) apply directly to the pressable so it lays out
// exactly like a plain view.
function Bouncy({ children, style, onPress, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => Animated.spring(scale, { toValue: 0.96, speed: 50, bounciness: 0, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, speed: 20, bounciness: 8, useNativeDriver: true }).start()}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

function SegmentFill({ colors, state }) {
  const anim = useRef(new Animated.Value(state === 'done' ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: state === 'todo' ? 0 : 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [state]);
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

function SegmentedProgress({ colors, styles, total, current }) {
  return (
    <View style={styles.segRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={styles.segTrack}>
          <SegmentFill colors={colors} state={i < current ? 'done' : i === current ? 'active' : 'todo'} />
        </View>
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const { token, user } = useAuth();
  const {
    submitOnboarding,
    finishOnboarding,
    rank: ctxRank,
    dailyReward,
    claimDailyReward,
    claimingDaily,
    streakDays,
    lastActive,
  } = useUserProgress();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // loading | goals | question | calculating | reveal | reward | streak | notifications | error
  const [phase, setPhase] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [goals, setGoals] = useState([]);
  const [result, setResult] = useState(null);
  const [calcLine, setCalcLine] = useState(CALC_LINES[0]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await fetchWithCache(
          cacheKeys.onboardingQuestions(),
          () => coursesApi.getOnboardingQuestions(token),
          { freshMs: TTL.ONBOARDING_MS, staleMs: TTL.ONBOARDING_MS },
        );
        if (cancelled) return;
        setQuestions(data.questions || []);
        setPhase('goals');
      } catch (e) {
        if (!cancelled) setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const runSubmit = useCallback(async (finalAnswers, finalGoals) => {
    setPhase('calculating');
    let i = 0;
    const ticker = setInterval(() => {
      i = (i + 1) % CALC_LINES.length;
      setCalcLine(CALC_LINES[i]);
    }, 700);

    const [res] = await Promise.all([
      submitOnboarding(finalAnswers, finalGoals),
      new Promise((r) => setTimeout(r, 1900)),
    ]);

    clearInterval(ticker);
    setResult(res);
    setPhase('reveal');
  }, [submitOnboarding]);

  const handleAnswer = useCallback((question, optionId) => {
    const nextAnswers = { ...answers, [question.id]: optionId };
    setAnswers(nextAnswers);
    if (qIndex + 1 >= questions.length) {
      runSubmit(nextAnswers, goals);
    } else {
      setQIndex((prev) => prev + 1);
    }
  }, [answers, qIndex, questions.length, goals, runSubmit]);

  function toggleGoal(key) {
    setGoals((prev) => (prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]));
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

  // ---- Goals ----
  if (phase === 'goals') {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe}>
          <GoalsView
            styles={styles}
            colors={colors}
            selected={goals}
            onToggle={toggleGoal}
            onContinue={() => setPhase('question')}
          />
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
            onDone={() => setPhase('reward')}
          />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ---- Reward (welcome Bot Bucks + XP) ----
  if (phase === 'reward') {
    const bonus = result?.onboarding_bonus || { bot_bucks: 25, xp: 10 };
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ConfettiBurst colors={colors} />
        <SafeAreaView style={styles.safe}>
          <RewardView
            styles={styles}
            colors={colors}
            botBucks={bonus.bot_bucks ?? 25}
            xp={bonus.xp ?? 10}
            onNext={() => setPhase('streak')}
          />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ---- Claim your streak (daily reward) ----
  if (phase === 'streak') {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe}>
          <StreakClaimView
            styles={styles}
            colors={colors}
            dailyReward={dailyReward}
            claiming={claimingDaily}
            onClaim={claimDailyReward}
            onDone={() => setPhase('notifications')}
          />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ---- Notifications opt-in (last step before entering the app) ----
  if (phase === 'notifications') {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe}>
          <NotificationsOptInView
            styles={styles}
            colors={colors}
            firstName={getFirstName(user)}
            streakDays={streakDays}
            lastActive={lastActive}
            onDone={finishOnboarding}
          />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ---- Question ----
  const question = questions[qIndex];

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.progressHeader}>
          <SegmentedProgress colors={colors} styles={styles} total={questions.length} current={qIndex} />
          <Text style={styles.progressCount}>
            {qIndex + 1} of {questions.length} · no wrong answers, just your gut
          </Text>
        </View>

        <QuestionCard
          key={question.id}
          styles={styles}
          colors={colors}
          question={question}
          onAnswer={handleAnswer}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

// Routes each question to its interactive input medium based on input_type.
function QuestionCard({ styles, colors, question, onAnswer }) {
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

  const inputType = question.input_type || 'choice';
  const submit = (optionId) => onAnswer(question, optionId);

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
        <View style={styles.qIconWrap}>
          <Ionicons name={questionIcon(question)} size={44} color={colors.primary} />
        </View>
        <View style={styles.topicChip}>
          <Text style={styles.topicChipText}>{question.topic}</Text>
        </View>
        <Text style={styles.qVibe}>{question.vibe}</Text>
        <Text style={styles.qPrompt}>{question.prompt}</Text>

        {inputType === 'truefalse' && (
          <TrueFalseInput styles={styles} colors={colors} question={question} onSubmit={submit} />
        )}
        {inputType === 'scale' && (
          <ScaleInput styles={styles} colors={colors} question={question} onSubmit={submit} />
        )}
        {(inputType === 'choice' || !['truefalse', 'scale'].includes(inputType)) && (
          <ChoiceInput styles={styles} colors={colors} question={question} onSubmit={submit} />
        )}
      </ScrollView>
    </Animated.View>
  );
}

// --- Medium 1: multiple-choice cards ---
function ChoiceInput({ styles, colors, question, onSubmit }) {
  const [sel, setSel] = useState(null);

  function pick(id) {
    if (sel) return;
    setSel(id);
    setTimeout(() => onSubmit(id), 280);
  }

  return (
    <View style={styles.options}>
      {question.options.map((opt) => {
        const isSel = sel === opt.id;
        return (
          <Bouncy
            key={opt.id}
            style={[styles.option, isSel && styles.optionSel]}
            disabled={!!sel}
            onPress={() => pick(opt.id)}
          >
            <View style={[styles.optionRadio, isSel && styles.optionRadioSel]}>
              {isSel && <Ionicons name="checkmark" size={16} color={colors.background} />}
            </View>
            <Text style={[styles.optionText, isSel && styles.optionTextSel]}>{opt.text}</Text>
          </Bouncy>
        );
      })}
    </View>
  );
}

// --- Medium 2: big True / False buttons (extra options shown subtly) ---
function TrueFalseInput({ styles, colors, question, onSubmit }) {
  const [sel, setSel] = useState(null);
  const primary = question.options.slice(0, 2);
  const extras = question.options.slice(2);

  function pick(id) {
    if (sel) return;
    setSel(id);
    setTimeout(() => onSubmit(id), 260);
  }

  const ICONS = ['checkmark-circle', 'close-circle'];
  const TINTS = [colors.primary, '#FF6B6B'];

  return (
    <View>
      <View style={styles.tfRow}>
        {primary.map((opt, i) => {
          const isSel = sel === opt.id;
          const tint = TINTS[i] || colors.primary;
          return (
            <Bouncy
              key={opt.id}
              style={[
                styles.tfBtn,
                { borderColor: isSel ? tint : colors.border },
                isSel && { backgroundColor: `${tint}22` },
              ]}
              disabled={!!sel}
              onPress={() => pick(opt.id)}
            >
              <Ionicons name={ICONS[i] || 'ellipse'} size={40} color={tint} />
              <Text style={styles.tfBtnText}>{opt.text}</Text>
            </Bouncy>
          );
        })}
      </View>

      {extras.map((opt) => {
        const isSel = sel === opt.id;
        return (
          <Bouncy
            key={opt.id}
            style={[styles.tfExtra, isSel && styles.tfExtraSel]}
            disabled={!!sel}
            onPress={() => pick(opt.id)}
          >
            <Text style={[styles.tfExtraText, isSel && { color: colors.primary }]}>{opt.text}</Text>
          </Bouncy>
        );
      })}
    </View>
  );
}

// --- Medium 3: draggable slider scale ---
function ScaleInput({ styles, colors, question, onSubmit }) {
  const options = question.options;
  const n = options.length;
  const maxIndex = Math.max(1, n - 1);
  const [index, setIndex] = useState(Math.floor((n - 1) / 2));
  const [dragging, setDragging] = useState(false);
  const trackWidth = useRef(0);
  const lastIndex = useRef(index);

  const readoutAnim = useRef(new Animated.Value(1)).current;
  const knobScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(knobScale, { toValue: dragging ? 1.3 : 1, speed: 30, bounciness: 10, useNativeDriver: true }).start();
  }, [dragging]);

  // Small pop on the readout whenever the selected option changes.
  const bumpReadout = () => {
    readoutAnim.setValue(0.85);
    Animated.spring(readoutAnim, { toValue: 1, speed: 40, bounciness: 12, useNativeDriver: true }).start();
  };

  const applyIndex = (next) => {
    if (next !== lastIndex.current) {
      lastIndex.current = next;
      setIndex(next);
      bumpReadout();
    }
  };

  const setFromX = (x) => {
    const w = trackWidth.current;
    if (!w) return;
    const ratio = Math.min(1, Math.max(0, x / w));
    applyIndex(Math.round(ratio * maxIndex));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => { setDragging(true); setFromX(evt.nativeEvent.locationX); },
      onPanResponderMove: (evt) => setFromX(evt.nativeEvent.locationX),
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    }),
  ).current;

  const pct = `${(index / maxIndex) * 100}%`;

  return (
    <View style={styles.scaleWrap}>
      <Animated.View style={[styles.scaleReadout, { transform: [{ scale: readoutAnim }] }]}>
        <Text style={styles.scaleReadoutText}>{options[index]?.text}</Text>
      </Animated.View>

      <View
        style={styles.scaleTrack}
        onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
        {...pan.panHandlers}
      >
        <View style={styles.scaleBase} pointerEvents="none" />
        <View style={[styles.scaleFill, { width: pct }]} pointerEvents="none" />
        {options.map((opt, i) => (
          <View
            key={opt.id}
            style={[
              styles.scaleTick,
              { left: `${(i / maxIndex) * 100}%` },
              i <= index && styles.scaleTickActive,
            ]}
            pointerEvents="none"
          />
        ))}
        <Animated.View
          style={[styles.scaleKnob, { left: pct, transform: [{ scale: knobScale }] }]}
          pointerEvents="none"
        >
          <View style={styles.scaleKnobInner} />
        </Animated.View>
      </View>

      <View style={styles.scaleLabels}>
        {options.map((opt, i) => (
          <TouchableOpacity
            key={opt.id}
            style={styles.scaleLabelBtn}
            activeOpacity={0.7}
            onPress={() => applyIndex(i)}
          >
            <Text
              style={[styles.scaleLabelText, i === index && styles.scaleLabelTextActive]}
              numberOfLines={2}
            >
              {opt.text}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <PrimaryButton
        styles={styles}
        colors={colors}
        label="Lock it in"
        icon="lock-closed"
        onPress={() => onSubmit(options[index].id)}
      />
    </View>
  );
}

function GoalChip({ styles, colors, goal, index, selected, onToggle }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 360,
      delay: index * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={{
        width: '48%',
        marginBottom: 12,
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
        ],
      }}
    >
      <Bouncy
        style={[styles.goalChip, selected && styles.goalChipSel]}
        onPress={() => onToggle(goal.key)}
      >
        <View style={[styles.goalIconWrap, selected && styles.goalIconWrapSel]}>
          <Ionicons name={goal.icon} size={22} color={selected ? colors.background : colors.primary} />
        </View>
        <Text style={[styles.goalLabel, selected && styles.goalLabelSel]}>{goal.label}</Text>
        {selected && (
          <View style={styles.goalCheck}>
            <Ionicons name="checkmark" size={12} color={colors.background} />
          </View>
        )}
      </Bouncy>
    </Animated.View>
  );
}

function GoalsView({ styles, colors, selected, onToggle, onContinue }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const count = selected.length;

  return (
    <Animated.View
      style={[
        styles.goalsWrap,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        },
      ]}
    >
      <View style={styles.goalsHeader}>
        <View style={styles.introIcon}>
          <Ionicons name="rocket" size={36} color={colors.primary} />
        </View>
        <Text style={styles.introTitle}>What brings you to MoneyBot?</Text>
        <Text style={styles.introSub}>
          Pick what matters most — we{"'"}ll tailor your journey. Choose as many as you like.
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.goalsScroll}>
        <View style={styles.goalsGrid}>
          {GOALS.map((g, i) => (
            <GoalChip
              key={g.key}
              styles={styles}
              colors={colors}
              goal={g}
              index={i}
              selected={selected.includes(g.key)}
              onToggle={onToggle}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.goalsFooter}>
        <PrimaryButton
          styles={styles}
          colors={colors}
          label={count > 0 ? `Continue${count > 1 ? ` · ${count} goals` : ''}` : 'Skip for now'}
          icon="arrow-forward"
          onPress={onContinue}
        />
      </View>
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
          <Ionicons name="gift" size={18} color={colors.primary} />
          <Text style={styles.revealCardText}>
            We{"'"}ve stashed a welcome bonus for you — let{"'"}s grab it before your first lesson.
          </Text>
        </View>
      </View>

      <PrimaryButton styles={styles} colors={colors} label="Claim my rewards" icon="arrow-forward" onPress={onDone} />
    </View>
  );
}

// Animated number that counts up from 0 to `value` for a satisfying reward pop.
function CountUp({ value, duration = 1000, delay = 0, prefix = '', style }) {
  const [display, setDisplay] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: value,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, delay);
    return () => {
      clearTimeout(timer);
      anim.removeListener(id);
    };
  }, [value]);

  return <Text style={style}>{prefix}{display}</Text>;
}

// A single reward pill (icon + counting value + label) that springs in.
function RewardPill({ styles, colors, icon, iconColor, value, label, delay }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      friction: 6,
      tension: 70,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.rewardPill,
        {
          opacity: anim,
          transform: [
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          ],
        },
      ]}
    >
      <View style={[styles.rewardPillIcon, { backgroundColor: `${iconColor}1F` }]}>
        <Ionicons name={icon} size={26} color={iconColor} />
      </View>
      <CountUp value={value} prefix="+" delay={delay + 150} style={styles.rewardPillValue} />
      <Text style={styles.rewardPillLabel}>{label}</Text>
    </Animated.View>
  );
}

function RewardView({ styles, colors, botBucks, xp, onNext }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.rewardWrap}>
      <Animated.View
        style={{
          alignItems: 'center',
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }}
      >
        <View style={styles.rewardBadge}>
          <Ionicons name="gift" size={48} color={colors.primary} />
        </View>
        <Text style={styles.rewardKicker}>WELCOME BONUS</Text>
        <Text style={styles.rewardTitle}>You{"'"}re all set!</Text>
        <Text style={styles.rewardSub}>
          Here{"'"}s a head start for finishing your money check-in.
        </Text>
      </Animated.View>

      <View style={styles.rewardPillRow}>
        <RewardPill
          styles={styles}
          colors={colors}
          icon="logo-bitcoin"
          iconColor={colors.botBucks || '#F5B72B'}
          value={botBucks}
          label="Bot Bucks"
          delay={300}
        />
        <RewardPill
          styles={styles}
          colors={colors}
          icon="flash"
          iconColor={colors.primary}
          value={xp}
          label="XP"
          delay={450}
        />
      </View>

      <PrimaryButton styles={styles} colors={colors} label="Nice — keep going" icon="arrow-forward" onPress={onNext} />
    </View>
  );
}

function StreakClaimView({ styles, colors, dailyReward, claiming, onClaim, onDone }) {
  const anim = useRef(new Animated.Value(0)).current;
  const flame = useRef(new Animated.Value(1)).current;
  const [claimed, setClaimed] = useState(dailyReward?.claimed_today ?? false);
  const [earned, setEarned] = useState(0);

  const amount = dailyReward?.claim_amount ?? dailyReward?.tiers?.[0]?.bot_bucks ?? 5;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(flame, { toValue: 1.12, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(flame, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  async function handleClaim() {
    const result = await onClaim();
    const got = result?.bot_bucks_earned ?? amount;
    setEarned(got);
    setClaimed(true);
  }

  return (
    <View style={styles.streakWrap}>
      <Animated.View
        style={{
          alignItems: 'center',
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }}
      >
        <Animated.View style={[styles.streakBadge, { transform: [{ scale: flame }] }]}>
          <Ionicons name="flame" size={54} color="#fff" />
        </Animated.View>
        <Text style={styles.rewardKicker}>DAY 1 STREAK</Text>
        <Text style={styles.rewardTitle}>{claimed ? 'Streak started!' : 'Start your streak'}</Text>
        <Text style={styles.rewardSub}>
          {claimed
            ? 'Come back tomorrow to keep it alive and earn even more.'
            : 'Claim your first daily reward, then come back every day to grow it.'}
        </Text>
      </Animated.View>

      <View style={styles.streakCard}>
        {claimed ? (
          <View style={styles.streakClaimedRow}>
            <View style={styles.streakCheck}>
              <Ionicons name="checkmark" size={18} color={colors.background} />
            </View>
            <Text style={styles.streakClaimedText}>
              <CountUp value={earned} prefix="+" style={styles.streakClaimedText} /> Bot Bucks added
            </Text>
          </View>
        ) : (
          <View style={styles.streakAmountRow}>
            <Ionicons name="logo-bitcoin" size={24} color={colors.botBucks || '#F5B72B'} />
            <Text style={styles.streakAmount}>+{amount}</Text>
            <Text style={styles.streakAmountLabel}>Bot Bucks</Text>
          </View>
        )}
      </View>

      {claimed ? (
        <PrimaryButton styles={styles} colors={colors} label="Start my first lesson" icon="arrow-forward" onPress={onDone} />
      ) : (
        <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleClaim} disabled={claiming}>
          <LinearGradient
            colors={['#FF8C42', '#FF6B35']}
            style={styles.primaryBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            {claiming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={[styles.primaryBtnText, { color: '#fff' }]}>Claim {amount} Bot Bucks</Text>
                <Ionicons name="logo-bitcoin" size={19} color="#fff" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Persuasive notification opt-in — the last onboarding step. We push hard for
// "Allow" (big animated bell, benefit bullets, glowing CTA) but always leave an
// honest, low-friction escape hatch so the user can decline.
const NOTIF_BENEFITS = [
  { icon: 'flame', tint: '#FF6B35', text: 'Protect your streak — a nudge before it breaks at midnight.' },
  { icon: 'logo-bitcoin', tint: '#F5B72B', text: 'Never miss free Bot Bucks and daily rewards.' },
  { icon: 'trophy', tint: '#A66BFF', text: 'Get pinged the moment new lessons and challenges drop.' },
];

function NotificationBenefit({ styles, colors, icon, tint, text, delay }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, tension: 60, delay, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View
      style={[
        styles.notifBenefitRow,
        {
          opacity: anim,
          transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        },
      ]}
    >
      <View style={[styles.notifBenefitIcon, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.notifBenefitText}>{text}</Text>
    </Animated.View>
  );
}

function NotificationsOptInView({ styles, colors, firstName, streakDays, lastActive, onDone }) {
  const anim = useRef(new Animated.Value(0)).current;
  const bell = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, tension: 55, useNativeDriver: true }).start();
    // Gentle repeating "ring" wobble to draw the eye to the bell.
    Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(bell, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(bell, { toValue: -1, duration: 120, useNativeDriver: true }),
        Animated.timing(bell, { toValue: 0.6, duration: 100, useNativeDriver: true }),
        Animated.timing(bell, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]),
    ).start();
    // Soft pulsing glow behind the primary button.
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const finish = useCallback(() => {
    if (busy) return;
    onDone();
  }, [busy, onDone]);

  const handleAllow = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!areNotificationsSupported()) {
        console.log('[Onboarding][notif] native module NOT linked in this build');
        setBusy(false);
        Alert.alert(
          'Almost there',
          "Notifications aren't available in this build yet. Rebuild the dev client to enable them:\n\ncd mobile && npx expo run:ios",
          [{ text: 'Continue', onPress: onDone }],
        );
        return;
      }

      const info = await getNotificationPermissionInfo();
      console.log('[Onboarding][notif] permission before request:', info);

      // Already decided at the OS level: iOS won't show the system prompt again.
      if (info.status === 'denied' || !info.canAskAgain) {
        setBusy(false);
        Alert.alert(
          'Turn on in Settings',
          "Notifications are currently off for MoneyBot. iOS only asks once — open Settings to switch them on.",
          [
            { text: 'Not now', style: 'cancel', onPress: onDone },
            { text: 'Open Settings', onPress: () => { Linking.openSettings(); onDone(); } },
          ],
        );
        return;
      }

      // status === 'undetermined' (or granted): this triggers the system prompt.
      const prefs = await loadNotificationPrefs();
      const next = { ...prefs, daily: true, streak: true };
      await saveNotificationPrefs(next);
      const result = await syncNotificationSchedule(next, {
        firstName,
        streakDays,
        activeToday: lastActive === localDate(),
      });
      console.log('[Onboarding][notif] sync result:', result);
    } catch (err) {
      console.log('[Onboarding][notif] error:', err?.message || err);
    } finally {
      onDone();
    }
  }, [busy, firstName, streakDays, lastActive, onDone]);

  const bellRotate = bell.interpolate({ inputRange: [-1, 1], outputRange: ['-16deg', '16deg'] });

  return (
    <ScrollView
      style={styles.notifWrap}
      contentContainerStyle={styles.notifScroll}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <Animated.View
        style={{
          alignItems: 'center',
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }}
      >
        <View style={styles.notifBadge}>
          <Animated.View style={{ transform: [{ rotate: bellRotate }] }}>
            <Ionicons name="notifications" size={48} color={colors.primary} />
          </Animated.View>
        </View>
        <Text style={styles.rewardKicker}>ONE LAST THING</Text>
        <Text style={styles.rewardTitle}>
          {firstName ? `Stay on track, ${firstName}` : 'Stay on track'}
        </Text>
        <Text style={styles.rewardSub}>
          Turn on notifications so we can keep your streak alive and remind you before you lose progress.
        </Text>
      </Animated.View>

      <View style={styles.notifBenefits}>
        {NOTIF_BENEFITS.map((b, i) => (
          <NotificationBenefit
            key={b.icon}
            styles={styles}
            colors={colors}
            icon={b.icon}
            tint={b.tint}
            text={b.text}
            delay={250 + i * 120}
          />
        ))}
      </View>

      <View style={styles.notifCta}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.notifGlow,
            {
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.5] }),
              transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] }) }],
            },
          ]}
        />
        <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleAllow} disabled={busy}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            style={styles.primaryBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            {busy ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <Ionicons name="notifications" size={20} color={colors.background} />
                <Text style={styles.primaryBtnText}>Turn on notifications</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.notifReassure}>Tap “Allow” when your phone asks — you can change this anytime.</Text>
        <TouchableOpacity style={styles.notifSkip} activeOpacity={0.7} onPress={finish} disabled={busy}>
          <Text style={styles.notifSkipText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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

  // Goals
  goalsWrap: { flex: 1, paddingTop: 12 },
  goalsHeader: { alignItems: 'center', paddingHorizontal: 24, marginBottom: 20 },
  introIcon: {
    width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(61,220,95,0.12)', borderWidth: 1, borderColor: 'rgba(61,220,95,0.3)', marginBottom: 18,
  },
  introTitle: { fontSize: 26, fontWeight: '800', color: colors.white, textAlign: 'center', letterSpacing: -0.5, marginBottom: 10 },
  introSub: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  goalsScroll: { paddingHorizontal: 20, paddingBottom: 12 },
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  goalChip: {
    backgroundColor: colors.surfaceElevated, borderRadius: 18, padding: 16,
    borderWidth: 1.5, borderColor: colors.border, gap: 8, minHeight: 104, justifyContent: 'center',
  },
  goalChipSel: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.12)' },
  goalIconWrap: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(61,220,95,0.12)',
  },
  goalIconWrapSel: { backgroundColor: colors.primary },
  goalLabel: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, lineHeight: 19 },
  goalLabelSel: { color: colors.white },
  goalCheck: {
    position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  goalsFooter: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 16 },

  // Progress
  progressHeader: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4, gap: 10 },
  progressCount: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
  segRow: { flexDirection: 'row', gap: 6 },
  segTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },

  // Question
  qWrap: { flex: 1 },
  qScroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 },
  qIconWrap: {
    alignSelf: 'center',
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61,220,95,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(61,220,95,0.3)',
    marginBottom: 14,
  },
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
  optionRadio: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border,
  },
  optionRadioSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.white },
  optionTextSel: { color: colors.white },

  // True / False
  tfRow: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  tfBtn: {
    flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 20, paddingVertical: 30,
    alignItems: 'center', gap: 12, borderWidth: 2,
  },
  tfBtnText: { fontSize: 18, fontWeight: '800', color: colors.white },
  tfExtra: {
    alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 14,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, marginTop: 4,
  },
  tfExtraSel: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.12)' },
  tfExtraText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },

  // Scale slider
  scaleWrap: { marginTop: 6 },
  scaleReadout: {
    backgroundColor: colors.surfaceElevated, borderRadius: 18, paddingVertical: 22, paddingHorizontal: 18,
    borderWidth: 1.5, borderColor: colors.primary, marginBottom: 30, minHeight: 72, justifyContent: 'center',
  },
  scaleReadoutText: { fontSize: 20, fontWeight: '800', color: colors.white, textAlign: 'center' },
  scaleTrack: { height: 40, justifyContent: 'center', marginBottom: 6 },
  scaleBase: {
    position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 4, backgroundColor: colors.border,
  },
  scaleFill: { position: 'absolute', left: 0, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  scaleTick: {
    position: 'absolute', width: 12, height: 12, borderRadius: 6, marginLeft: -6,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border,
  },
  scaleTickActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  scaleKnob: {
    position: 'absolute', width: 30, height: 30, borderRadius: 15, marginLeft: -15,
    backgroundColor: colors.white, borderWidth: 3, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  scaleKnobInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  scaleLabels: { flexDirection: 'row', marginTop: 4, marginBottom: 26 },
  scaleLabelBtn: { flex: 1, paddingHorizontal: 2, paddingVertical: 6 },
  scaleLabelText: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textAlign: 'center', lineHeight: 14 },
  scaleLabelTextActive: { color: colors.primary, fontWeight: '800' },

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

  // Reward (welcome bonus)
  rewardWrap: { flex: 1, paddingHorizontal: 24, paddingBottom: 16, justifyContent: 'center' },
  rewardBadge: {
    width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(61,220,95,0.12)', borderWidth: 1, borderColor: 'rgba(61,220,95,0.3)', marginBottom: 20,
  },
  rewardKicker: { fontSize: 13, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5, marginBottom: 10 },
  rewardTitle: { fontSize: 30, fontWeight: '900', color: colors.white, letterSpacing: -0.5, marginBottom: 10, textAlign: 'center' },
  rewardSub: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 },
  rewardPillRow: { flexDirection: 'row', gap: 14, marginTop: 34, marginBottom: 30 },
  rewardPill: {
    flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 20, paddingVertical: 22,
    alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border,
  },
  rewardPillIcon: {
    width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  rewardPillValue: { fontSize: 30, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  rewardPillLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },

  // Streak claim
  streakWrap: { flex: 1, paddingHorizontal: 24, paddingBottom: 16, justifyContent: 'center' },
  streakBadge: {
    width: 118, height: 118, borderRadius: 59, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FF6B35', marginBottom: 18,
    shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  streakCard: {
    backgroundColor: colors.surfaceElevated, borderRadius: 18, paddingVertical: 20, paddingHorizontal: 18,
    borderWidth: 1, borderColor: colors.border, marginTop: 30, marginBottom: 24, alignItems: 'center',
  },
  streakAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakAmount: { fontSize: 28, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  streakAmountLabel: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  streakClaimedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakCheck: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  streakClaimedText: { fontSize: 17, fontWeight: '800', color: colors.white },

  // Notifications opt-in
  notifWrap: { flex: 1 },
  notifScroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 16,
    justifyContent: 'center',
  },
  notifBadge: {
    width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(61,220,95,0.12)', borderWidth: 1, borderColor: 'rgba(61,220,95,0.3)', marginBottom: 20,
  },
  notifBenefits: { marginTop: 30, marginBottom: 26, gap: 14 },
  notifBenefitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  notifBenefitIcon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  notifBenefitText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.offWhite, lineHeight: 20 },
  notifCta: { alignItems: 'stretch' },
  notifGlow: {
    position: 'absolute', left: 0, right: 0, top: 0, height: 54, borderRadius: 16,
    backgroundColor: colors.primary,
  },
  notifReassure: {
    fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 14, lineHeight: 18,
  },
  notifSkip: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  notifSkipText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },

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
