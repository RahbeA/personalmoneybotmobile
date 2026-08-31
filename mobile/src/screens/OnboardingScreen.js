import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Easing, ScrollView, PanResponder, Pressable, Alert, Linking, Image,
  KeyboardAvoidingView, Keyboard, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import MoneyBotGuide from '../components/MoneyBotGuide';
import TypewriterText from '../components/TypewriterText';
import BrandAvatar from '../components/brand/BrandAvatar';
import {
  areNotificationsSupported,
  getNotificationPermissionInfo,
  loadNotificationPrefs,
  saveNotificationPrefs,
  syncNotificationSchedule,
} from '../utils/notifications';

const GUIDE_IMAGE = require('../../assets/moneybot-guide.png');

// Bond-prices "up / down" question uses a vertical slider instead of cards.
const VERTICAL_SCALE_IDS = new Set(['bonds']);

const GREET_MESSAGE =
  "Hey, I'm MoneyBot. Think of me as a chill finance friend. We'll chat about what matters to you, I'll ask a few easy questions, and then I'll set you up with a free character. Sound good?";

const GOALS_GUIDE_MESSAGE =
  "First up, what are you hoping to get better at? Pick anything. Totally optional.";

const QUESTION_GUIDE_LINES = [
  "Cool. Mind if I ask a few easy money questions? No grades, just curious where you're at.",
  "Nice. Here's another one.",
  "You're doing great. Almost done with these.",
  "This one's about rates and prices. Just slide up or down.",
  "Last one, then I'll share where you're starting from.",
];

// Short MoneyBot beats between questions (after answering Q0..Q3).
const BETWEEN_LINES = [
  "Got it, thanks.",
  "Cool. Next one when you're ready.",
  "Nice work.",
  "Almost there. One more after this.",
];

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
  'Taking a look at your answers',
  'Crunching a few numbers',
  'Figuring out your starting rank',
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

function usePressScale(pressedScale = 0.94) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: pressedScale,
      speed: 60,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  }, [pressedScale, scale]);
  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      speed: 18,
      bounciness: 12,
      useNativeDriver: true,
    }).start();
  }, [scale]);
  return { scale, onPressIn, onPressOut };
}

// Springy press feedback wrapper — makes every tappable feel tactile. Layout
// styles (flex, width, padding) apply directly to the pressable so it lays out
// exactly like a plain view.
function Bouncy({ children, style, onPress, disabled }) {
  const { scale, onPressIn, onPressOut } = usePressScale(0.95);
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Full-width CTA with squash/bounce press micro-animation. */
function PressScaleButton({ style, disabled, onPress, children }) {
  const { scale, onPressIn, onPressOut } = usePressScale(0.96);
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={disabled ? undefined : onPressIn}
      onPressOut={disabled ? undefined : onPressOut}
      style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.7 }]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** If typewriter onDone never fires, still reveal the Continue CTA. */
function useContinueFallback(onReady, ms = 10000) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  useEffect(() => {
    const timer = setTimeout(() => onReadyRef.current?.(), ms);
    return () => clearTimeout(timer);
  }, [ms]);
}

function OnboardingShell({ colors, isDark, styles, children, overlay, centered }) {
  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {overlay}
      <KeyboardAvoidingView
        style={styles.gradient}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={[styles.safe, centered && styles.center]} edges={['top']}>
          {children}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </LinearGradient>
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
    claimStarterCharacter,
    rank: ctxRank,
    dailyReward,
    claimDailyReward,
    claimingDaily,
    streakDays,
    lastActive,
    equippedCharacter,
  } = useUserProgress();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, insets.bottom), [colors, insets.bottom]);

  // loading | greet | goals | question | between | calculating | reveal | reward | streak | notifications | character | error | submitError
  const [phase, setPhase] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [goals, setGoals] = useState([]);
  const [result, setResult] = useState(null);
  const [calcLine, setCalcLine] = useState(CALC_LINES[0]);
  const [greetDone, setGreetDone] = useState(false);

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
        setPhase('greet');
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

    try {
      const [res] = await Promise.all([
        submitOnboarding(finalAnswers, finalGoals),
        new Promise((r) => setTimeout(r, 1900)),
      ]);
      clearInterval(ticker);
      if (!res) {
        setPhase('submitError');
        return;
      }
      setResult(res);
      setPhase('reveal');
    } catch (e) {
      clearInterval(ticker);
      setPhase('submitError');
    }
  }, [submitOnboarding]);

  const handleAnswer = useCallback((question, optionId) => {
    const nextAnswers = { ...answers, [question.id]: optionId };
    setAnswers(nextAnswers);
    if (qIndex + 1 >= questions.length) {
      runSubmit(nextAnswers, goals);
    } else {
      setPhase('between');
    }
  }, [answers, qIndex, questions.length, goals, runSubmit]);

  const continueFromBetween = useCallback(() => {
    setQIndex((prev) => prev + 1);
    setPhase('question');
  }, []);

  function toggleGoal(key) {
    setGoals((prev) => (prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]));
  }

  // ---- Loading ----
  if (phase === 'loading') {
    return (
      <OnboardingShell colors={colors} isDark={isDark} styles={styles} centered>
        <ActivityIndicator size="large" color={colors.primary} />
      </OnboardingShell>
    );
  }

  // ---- Error fallback ----
  if (phase === 'error') {
    return (
      <OnboardingShell colors={colors} isDark={isDark} styles={styles} centered>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
        <Text style={styles.errTitle}>Couldn{"'"}t load your money quiz</Text>
        <Text style={styles.errText}>No worries. You can jump straight in and take it later.</Text>
        <PrimaryButton styles={styles} colors={colors} label="Continue" onPress={finishOnboarding} />
      </OnboardingShell>
    );
  }

  if (phase === 'submitError') {
    return (
      <OnboardingShell colors={colors} isDark={isDark} styles={styles} centered>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
        <Text style={styles.errTitle}>Couldn{"'"}t save your answers</Text>
        <Text style={styles.errText}>Check your connection and try again. You{"'"}re not starting over.</Text>
        <PrimaryButton
          styles={styles}
          colors={colors}
          label="Try again"
          icon="refresh"
          onPress={() => runSubmit(answers, goals)}
        />
      </OnboardingShell>
    );
  }

  // ---- Greet (MoneyBot intro) ----
  if (phase === 'greet') {
    return (
      <OnboardingShell colors={colors} isDark={isDark} styles={styles}>
        <GreetView
          styles={styles}
          colors={colors}
          firstName={getFirstName(user)}
          typingDone={greetDone}
          onTypingDone={() => setGreetDone(true)}
          onContinue={() => setPhase('goals')}
        />
      </OnboardingShell>
    );
  }

  // ---- Goals ----
  if (phase === 'goals') {
    return (
      <OnboardingShell colors={colors} isDark={isDark} styles={styles}>
        <GoalsView
          styles={styles}
          colors={colors}
          selected={goals}
          onToggle={toggleGoal}
          onContinue={() => {
            if (!questions.length) runSubmit(answers, goals);
            else setPhase('question');
          }}
        />
      </OnboardingShell>
    );
  }

  // ---- Between questions (conversational beat) ----
  if (phase === 'between') {
    const betweenMessage = BETWEEN_LINES[qIndex] || BETWEEN_LINES[BETWEEN_LINES.length - 1];
    return (
      <OnboardingShell colors={colors} isDark={isDark} styles={styles}>
        <BetweenView
          key={betweenMessage}
          styles={styles}
          colors={colors}
          message={betweenMessage}
          onContinue={continueFromBetween}
        />
      </OnboardingShell>
    );
  }

  // ---- Calculating ----
  if (phase === 'calculating') {
    return (
      <OnboardingShell colors={colors} isDark={isDark} styles={styles} centered>
        <PulseLogo colors={colors} />
        <Text style={styles.calcText}>{calcLine}</Text>
      </OnboardingShell>
    );
  }

  // ---- Reveal ----
  if (phase === 'reveal') {
    const rank = result?.rank || ctxRank;
    const score = result?.score;
    const total = result?.total;
    return (
      <OnboardingShell
        colors={colors}
        isDark={isDark}
        styles={styles}
        overlay={<ConfettiBurst colors={colors} />}
      >
        <RevealView
          styles={styles}
          colors={colors}
          rank={rank}
          score={score}
          total={total}
          onDone={() => setPhase('reward')}
        />
      </OnboardingShell>
    );
  }

  // ---- Reward (welcome Bot Bucks + XP) ----
  if (phase === 'reward') {
    const bonus = result?.onboarding_bonus || { bot_bucks: 25, xp: 10 };
    return (
      <OnboardingShell
        colors={colors}
        isDark={isDark}
        styles={styles}
        overlay={<ConfettiBurst colors={colors} />}
      >
        <RewardView
          styles={styles}
          colors={colors}
          botBucks={bonus.bot_bucks ?? 25}
          xp={bonus.xp ?? 10}
          onNext={() => setPhase('streak')}
        />
      </OnboardingShell>
    );
  }

  // ---- Claim your streak (daily reward) ----
  if (phase === 'streak') {
    return (
      <OnboardingShell colors={colors} isDark={isDark} styles={styles}>
        <StreakClaimView
          styles={styles}
          colors={colors}
          dailyReward={dailyReward}
          claiming={claimingDaily}
          onClaim={claimDailyReward}
          onDone={() => setPhase('notifications')}
        />
      </OnboardingShell>
    );
  }

  // ---- Notifications opt-in ----
  if (phase === 'notifications') {
    return (
      <OnboardingShell colors={colors} isDark={isDark} styles={styles}>
        <NotificationsOptInView
          styles={styles}
          colors={colors}
          firstName={getFirstName(user)}
          streakDays={streakDays}
          lastActive={lastActive}
          onDone={() => setPhase('character')}
        />
      </OnboardingShell>
    );
  }

  // ---- Free starter character (final step) ----
  if (phase === 'character') {
    return (
      <OnboardingShell
        colors={colors}
        isDark={isDark}
        styles={styles}
        overlay={<ConfettiBurst colors={colors} />}
      >
        <CharacterRewardView
          styles={styles}
          colors={colors}
          claimStarterCharacter={claimStarterCharacter}
          equippedCharacter={equippedCharacter}
          onDone={finishOnboarding}
        />
      </OnboardingShell>
    );
  }

  // ---- Question ----
  const question = questions[qIndex];
  if (!question) {
    return (
      <OnboardingShell colors={colors} isDark={isDark} styles={styles} centered>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.calcText}>Getting your next question ready</Text>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell colors={colors} isDark={isDark} styles={styles}>
      <QuestionCard
        key={question.id}
        styles={styles}
        colors={colors}
        question={question}
        guideMessage={QUESTION_GUIDE_LINES[qIndex] || QUESTION_GUIDE_LINES[QUESTION_GUIDE_LINES.length - 1]}
        onAnswer={handleAnswer}
      />
    </OnboardingShell>
  );
}

// Routes each question to its interactive input medium based on input_type.
function QuestionCard({ styles, colors, question, guideMessage, onAnswer }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [guideDone, setGuideDone] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirmOptionId, setConfirmOptionId] = useState(null);
  const markGuideDone = useCallback(() => setGuideDone(true), []);
  useContinueFallback(markGuideDone, 9000);

  useEffect(() => {
    anim.setValue(0);
    setGuideDone(false);
    setDragging(false);
    setConfirmOptionId(null);
    Animated.timing(anim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [question.id]);

  const inputType = question.input_type || 'choice';
  const useVertical = VERTICAL_SCALE_IDS.has(question.id);
  const needsConfirmFooter = useVertical || inputType === 'scale';
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
      <Pressable onPress={markGuideDone}>
        <MoneyBotGuide
          message={guideMessage}
          onDone={markGuideDone}
          avatarSize={56}
          style={styles.qGuide}
        />
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        // Disable page scroll while dragging a slider so the finger stays on the track.
        scrollEnabled={!dragging}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.qScroll}
        keyboardDismissMode="on-drag"
      >
        {guideDone && (
          <>
            <Text style={styles.qPrompt}>{question.prompt}</Text>

            {useVertical && (
              <VerticalScaleInput
                styles={styles}
                colors={colors}
                question={question}
                onSubmit={submit}
                onDragChange={setDragging}
                showSubmit={false}
                onSelectionChange={setConfirmOptionId}
              />
            )}
            {!useVertical && inputType === 'truefalse' && (
              <TrueFalseInput styles={styles} colors={colors} question={question} onSubmit={submit} />
            )}
            {!useVertical && inputType === 'scale' && (
              <ScaleInput
                styles={styles}
                colors={colors}
                question={question}
                onSubmit={submit}
                onDragChange={setDragging}
                showSubmit={false}
                onSelectionChange={setConfirmOptionId}
              />
            )}
            {!useVertical && (inputType === 'choice' || !['truefalse', 'scale'].includes(inputType)) && (
              <ChoiceInput styles={styles} colors={colors} question={question} onSubmit={submit} />
            )}
          </>
        )}
      </ScrollView>

      {guideDone && needsConfirmFooter && (
        <View style={styles.qFooter}>
          <PrimaryButton
            styles={styles}
            colors={colors}
            label="Sounds good"
            icon="checkmark"
            disabled={!confirmOptionId}
            onPress={() => confirmOptionId && submit(confirmOptionId)}
          />
        </View>
      )}
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

// --- Medium 3: forgiving horizontal slider ---
function ScaleInput({
  styles, colors, question, onSubmit, onDragChange,
  showSubmit = true, onSelectionChange,
}) {
  const options = question.options;
  const n = options.length;
  const maxIndex = Math.max(1, n - 1);
  const [index, setIndex] = useState(Math.floor((n - 1) / 2));
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef(null);
  const trackLayout = useRef({ x: 0, width: 0 });
  const lastIndex = useRef(index);
  const onDragChangeRef = useRef(onDragChange);
  onDragChangeRef.current = onDragChange;

  const readoutAnim = useRef(new Animated.Value(1)).current;
  const knobScale = useRef(new Animated.Value(1)).current;

  const setDrag = (next) => {
    setDragging(next);
    onDragChangeRef.current?.(next);
  };

  useEffect(() => {
    onSelectionChange?.(options[index]?.id ?? null);
  }, [index, options, onSelectionChange]);

  useEffect(() => {
    Animated.spring(knobScale, { toValue: dragging ? 1.25 : 1, speed: 30, bounciness: 10, useNativeDriver: true }).start();
  }, [dragging]);

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

  const setFromPageX = (pageX) => {
    const { x, width } = trackLayout.current;
    if (!width) return;
    const ratio = Math.min(1, Math.max(0, (pageX - x) / width));
    applyIndex(Math.round(ratio * maxIndex));
  };

  const measureTrack = () => {
    trackRef.current?.measureInWindow?.((x, _y, width) => {
      trackLayout.current = { x, width };
    });
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        setDrag(true);
        measureTrack();
        setFromPageX(evt.nativeEvent.pageX);
      },
      onPanResponderMove: (evt, gesture) => {
        setFromPageX(gesture.moveX || evt.nativeEvent.pageX);
      },
      onPanResponderRelease: () => setDrag(false),
      onPanResponderTerminate: () => setDrag(false),
    }),
  ).current;

  const pct = `${(index / maxIndex) * 100}%`;

  return (
    <View style={styles.scaleWrap}>
      <Animated.View style={[styles.scaleReadout, { transform: [{ scale: readoutAnim }] }]}>
        <Text style={styles.scaleReadoutText}>{options[index]?.text}</Text>
      </Animated.View>

      <View
        ref={trackRef}
        style={styles.scaleTrack}
        onLayout={measureTrack}
        hitSlop={{ top: 24, bottom: 24, left: 12, right: 12 }}
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

      {showSubmit && (
        <PrimaryButton
          styles={styles}
          colors={colors}
          label="Sounds good"
          icon="checkmark"
          onPress={() => onSubmit(options[index].id)}
        />
      )}
    </View>
  );
}

function classifyScaleOption(opt) {
  const t = (opt.text || '').toLowerCase();
  if (t.includes('not sure') || t.includes("don't know") || t.includes('unsure')) return 'unsure';
  if (t.includes('down') || t.includes('less') || t.includes('lower')) return 'down';
  if (t.includes('up') || t.includes('more') || t.includes('higher')) return 'up';
  if (t.includes('same') || t.includes('stay') || t.includes('exact')) return 'same';
  return 'other';
}

// --- Medium 4: vertical "up / same / down" slider (bond prices) ---
function VerticalScaleInput({
  styles, colors, question, onSubmit, onDragChange,
  showSubmit = true, onSelectionChange,
}) {
  const options = question.options || [];
  const byKind = useMemo(() => {
    const map = { up: null, same: null, down: null, unsure: null, other: [] };
    options.forEach((opt) => {
      const kind = classifyScaleOption(opt);
      if (kind === 'other') map.other.push(opt);
      else if (!map[kind]) map[kind] = opt;
      else map.other.push(opt);
    });
    return map;
  }, [options]);

  const axis = [byKind.up, byKind.same, byKind.down].filter(Boolean);
  const extras = [byKind.unsure, ...byKind.other].filter(Boolean);
  const n = axis.length;
  const maxIndex = Math.max(1, n - 1);
  const defaultIdx = Math.min(1, maxIndex);
  const [index, setIndex] = useState(defaultIdx);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef(null);
  const trackLayout = useRef({ y: 0, height: 0 });
  const lastIndex = useRef(index);
  const knobScale = useRef(new Animated.Value(1)).current;
  const onDragChangeRef = useRef(onDragChange);
  onDragChangeRef.current = onDragChange;

  const setDrag = (next) => {
    setDragging(next);
    onDragChangeRef.current?.(next);
  };

  const selected = axis[index];

  useEffect(() => {
    onSelectionChange?.(selected?.id ?? null);
  }, [selected?.id, onSelectionChange]);

  useEffect(() => {
    Animated.spring(knobScale, { toValue: dragging ? 1.2 : 1, speed: 30, bounciness: 10, useNativeDriver: true }).start();
  }, [dragging]);

  const applyIndex = (next) => {
    if (next !== lastIndex.current) {
      lastIndex.current = next;
      setIndex(next);
    }
  };

  const setFromPageY = (pageY) => {
    const { y, height } = trackLayout.current;
    if (!height) return;
    const ratio = Math.min(1, Math.max(0, (pageY - y) / height));
    applyIndex(Math.round(ratio * maxIndex));
  };

  const measureTrack = () => {
    trackRef.current?.measureInWindow?.((_x, y, _w, height) => {
      trackLayout.current = { y, height };
    });
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        setDrag(true);
        measureTrack();
        setFromPageY(evt.nativeEvent.pageY);
      },
      onPanResponderMove: (evt, gesture) => {
        setFromPageY(gesture.moveY || evt.nativeEvent.pageY);
      },
      onPanResponderRelease: () => setDrag(false),
      onPanResponderTerminate: () => setDrag(false),
    }),
  ).current;

  const pct = `${(index / maxIndex) * 100}%`;

  return (
    <View style={styles.vScaleWrap}>
      <View style={styles.vScaleReadout}>
        <Text style={styles.scaleReadoutText}>{selected?.text || '—'}</Text>
      </View>

      <View style={styles.vScaleRow}>
        <View style={styles.vScaleLabelsCol}>
          {axis.map((opt, i) => (
            <TouchableOpacity key={opt.id} onPress={() => applyIndex(i)} activeOpacity={0.7} style={styles.vScaleLabelBtn}>
              <Text style={[styles.vScaleLabelText, i === index && styles.scaleLabelTextActive]} numberOfLines={2}>
                {opt.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View
          ref={trackRef}
          style={styles.vScaleTrack}
          onLayout={measureTrack}
          hitSlop={{ top: 20, bottom: 20, left: 36, right: 36 }}
          {...pan.panHandlers}
        >
          <View style={styles.vScaleBase} pointerEvents="none" />
          <View style={[styles.vScaleFill, { height: pct }]} pointerEvents="none" />
          {axis.map((opt, i) => (
            <View
              key={opt.id}
              style={[
                styles.vScaleTick,
                { top: `${(i / maxIndex) * 100}%` },
                i === index && styles.scaleTickActive,
              ]}
              pointerEvents="none"
            />
          ))}
          <Animated.View
            style={[styles.vScaleKnob, { top: pct, transform: [{ scale: knobScale }] }]}
            pointerEvents="none"
          >
            <View style={styles.scaleKnobInner} />
          </Animated.View>
        </View>
      </View>

      {extras.map((opt) => (
        <TouchableOpacity
          key={opt.id}
          style={styles.tfExtra}
          activeOpacity={0.8}
          onPress={() => onSubmit(opt.id)}
        >
          <Text style={styles.tfExtraText}>{opt.text}</Text>
        </TouchableOpacity>
      ))}

      {showSubmit && (
        <PrimaryButton
          styles={styles}
          colors={colors}
          label="Sounds good"
          icon="checkmark"
          onPress={() => selected && onSubmit(selected.id)}
        />
      )}
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
  const [guideDone, setGuideDone] = useState(false);
  const markGuideDone = useCallback(() => setGuideDone(true), []);
  useContinueFallback(markGuideDone, 9000);

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
      <Pressable style={styles.goalsHeader} onPress={markGuideDone}>
        <MoneyBotGuide
          message={GOALS_GUIDE_MESSAGE}
          onDone={markGuideDone}
          avatarSize={64}
        />
      </Pressable>

      {guideDone && (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.goalsScroll}
          >
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
        </>
      )}
    </Animated.View>
  );
}

function GreetView({ styles, colors, firstName, typingDone, onTypingDone, onContinue }) {
  const anim = useRef(new Animated.Value(0)).current;
  useContinueFallback(onTypingDone, 12000);
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, tension: 55, useNativeDriver: true }).start();
  }, []);

  const message = firstName
    ? `Hey ${firstName}, I'm MoneyBot. Think of me as a chill finance friend. We'll chat about what matters to you, I'll ask a few easy questions, and then I'll set you up with a free character. Sound good?`
    : GREET_MESSAGE;

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.greetScroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={styles.greetWrap}>
        <Animated.View
          style={{
            alignItems: 'center',
            opacity: anim,
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
          }}
        >
          <View style={styles.greetAvatarRing}>
            <Image source={GUIDE_IMAGE} style={styles.greetAvatar} resizeMode="contain" />
          </View>
          <Text style={styles.rewardKicker}>MEET YOUR COACH</Text>
          <Text style={styles.greetTitle}>MoneyBot</Text>
        </Animated.View>

        <Pressable onPress={onTypingDone} style={styles.greetBubble}>
          <TypewriterText
            key={message}
            text={message}
            style={styles.greetMessage}
            speed={24}
            onDone={onTypingDone}
          />
        </Pressable>

        {typingDone && (
          <PrimaryButton
            styles={styles}
            colors={colors}
            label="Let's go"
            icon="arrow-forward"
            onPress={onContinue}
          />
        )}
      </View>
    </ScrollView>
  );
}

function BetweenView({ styles, colors, message, onContinue }) {
  const [typed, setTyped] = useState(false);
  const advanced = useRef(false);
  const markTyped = useCallback(() => setTyped(true), []);
  useContinueFallback(markTyped, 8000);

  const go = useCallback(() => {
    if (advanced.current) return;
    advanced.current = true;
    onContinue();
  }, [onContinue]);

  useEffect(() => {
    advanced.current = false;
    setTyped(false);
  }, [message]);

  useEffect(() => {
    if (!typed || advanced.current) return undefined;
    const timer = setTimeout(go, 3000);
    return () => clearTimeout(timer);
  }, [typed, go]);

  return (
    <View style={styles.betweenWrap}>
      <Pressable onPress={markTyped}>
        <MoneyBotGuide
          key={message}
          message={message}
          onDone={markTyped}
          avatarSize={72}
          style={styles.betweenGuide}
        />
      </Pressable>
      {typed && (
        <PrimaryButton
          styles={styles}
          colors={colors}
          label="Continue"
          icon="arrow-forward"
          onPress={go}
        />
      )}
    </View>
  );
}

function CharacterRewardView({ styles, colors, claimStarterCharacter, equippedCharacter, onDone }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [character, setCharacter] = useState(null);
  const [typed, setTyped] = useState(false);
  const claimedRef = useRef(false);

  const showCharacter = useCallback((granted) => {
    setCharacter(granted);
    setStatus('ready');
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
  }, [anim]);

  const retryClaim = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await claimStarterCharacter();
      const granted = result?.character || equippedCharacter;
      if (granted) {
        showCharacter(granted);
      } else {
        setStatus('error');
      }
    } catch (e) {
      if (equippedCharacter) {
        showCharacter(equippedCharacter);
      } else {
        setStatus('error');
      }
    }
  }, [claimStarterCharacter, equippedCharacter, showCharacter]);

  useEffect(() => {
    if (claimedRef.current) return;
    claimedRef.current = true;
    retryClaim();
  }, [retryClaim]);

  useEffect(() => {
    if (status === 'error' && equippedCharacter) {
      showCharacter(equippedCharacter);
    }
  }, [status, equippedCharacter, showCharacter]);

  const markTyped = useCallback(() => setTyped(true), []);
  useContinueFallback(markTyped, 10000);

  if (status === 'loading') {
    return (
      <View style={[styles.rewardWrap, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.calcText}>Picking your starter character</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.rewardWrap}>
        <Text style={styles.rewardTitle}>One sec</Text>
        <Text style={styles.rewardSub}>
          Couldn{"'"}t grab your free character. Try again. It{"'"}s waiting for you.
        </Text>
        <PrimaryButton styles={styles} colors={colors} label="Try again" icon="refresh" onPress={retryClaim} />
        <TouchableOpacity style={styles.notifSkip} activeOpacity={0.7} onPress={onDone}>
          <Text style={styles.notifSkipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const name = character?.name || 'your new friend';
  const message = `Meet ${name}, your first MoneyBot friend. On the house. Head to the Moneyverse to hang out.`;

  return (
    <View style={styles.rewardWrap}>
      <Animated.View
        style={{
          alignItems: 'center',
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }}
      >
        <Text style={styles.rewardKicker}>FREE CHARACTER</Text>
        <View style={styles.charRevealFrame}>
          <BrandAvatar character={character} size={140} autoRotate logoSize={72} />
        </View>
        <Text style={styles.rewardTitle}>{name}</Text>
      </Animated.View>

      <Pressable onPress={markTyped} style={styles.greetBubble}>
        <View style={styles.charGuideRow}>
          <Image source={GUIDE_IMAGE} style={styles.charGuideThumb} resizeMode="contain" />
          <TypewriterText
            key={message}
            text={message}
            style={styles.greetMessage}
            speed={22}
            onDone={markTyped}
          />
        </View>
      </Pressable>

      {typed && (
        <PrimaryButton
          styles={styles}
          colors={colors}
          label="See them in the Moneyverse"
          icon="planet"
          onPress={onDone}
        />
      )}
    </View>
  );
}

function RevealView({ styles, colors, rank, score, total, onDone }) {
  const anim = useRef(new Animated.Value(0)).current;
  const meta = getRankMeta(rank?.key);

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
  }, []);

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.greetScroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
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
              : `You're already at the top tier. Keep learning to stay sharp.`}
          </Text>
        </View>
        <View style={styles.revealCardRow}>
          <Ionicons name="gift" size={18} color={colors.primary} />
          <Text style={styles.revealCardText}>
            There{"'"}s a welcome bonus waiting for you. Let{"'"}s grab it next.
          </Text>
        </View>
      </View>

      <PrimaryButton styles={styles} colors={colors} label="Claim my rewards" icon="arrow-forward" onPress={onDone} />
    </View>
    </ScrollView>
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
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.greetScroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
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
        <Text style={styles.rewardTitle}>You{"'"}re all set</Text>
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

      <PrimaryButton styles={styles} colors={colors} label="Nice, keep going" icon="arrow-forward" onPress={onNext} />
    </View>
    </ScrollView>
  );
}

const STREAK_GOAL_OPTIONS = [
  { days: 7, label: 'Casual', blurb: 'Easy does it' },
  { days: 14, label: 'Regular', blurb: 'Build the habit' },
  { days: 30, label: 'Serious', blurb: 'Real momentum' },
  { days: 60, label: 'Intense', blurb: 'All in' },
];

function StreakClaimView({ styles, colors, dailyReward, claiming, onClaim, onDone }) {
  const anim = useRef(new Animated.Value(0)).current;
  const flame = useRef(new Animated.Value(1)).current;
  const claimBurst = useRef(new Animated.Value(0)).current;
  const cardPop = useRef(new Animated.Value(1)).current;
  const [claimed, setClaimed] = useState(dailyReward?.claimed_today ?? false);
  const [earned, setEarned] = useState(0);
  const [goalDays, setGoalDays] = useState(7);
  const flameLoop = useRef(null);

  const amount = dailyReward?.claim_amount ?? dailyReward?.tiers?.[0]?.bot_bucks ?? 5;
  const selectedGoal = STREAK_GOAL_OPTIONS.find((o) => o.days === goalDays) || STREAK_GOAL_OPTIONS[0];

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
    flameLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(flame, { toValue: 1.12, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(flame, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    flameLoop.current.start();
    return () => flameLoop.current?.stop();
  }, []);

  async function handleClaim() {
    try {
      const result = await onClaim({ streakGoal: goalDays });
      if (!result) {
        Alert.alert('Couldn\u2019t claim Day 1', 'Give it another tap in a second.');
        return;
      }
      const got = result?.bot_bucks_earned ?? amount;
      setEarned(got);
      setClaimed(true);

      // Flame whoosh + reward card pop on successful claim.
      flameLoop.current?.stop();
      claimBurst.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.spring(flame, { toValue: 1.45, friction: 4, tension: 120, useNativeDriver: true }),
          Animated.spring(flame, { toValue: 1.08, friction: 5, tension: 80, useNativeDriver: true }),
        ]),
        Animated.timing(claimBurst, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.spring(cardPop, { toValue: 1.06, friction: 5, tension: 140, useNativeDriver: true }),
          Animated.spring(cardPop, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }),
        ]),
      ]).start();
    } catch (e) {
      Alert.alert('Couldn\u2019t claim Day 1', 'Give it another tap in a second.');
    }
  }

  function pickGoal(days) {
    setGoalDays(days);
    Animated.sequence([
      Animated.spring(cardPop, { toValue: 0.97, friction: 8, tension: 200, useNativeDriver: true }),
      Animated.spring(cardPop, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }),
    ]).start();
  }

  return (
    <ScrollView
      style={styles.streakWrap}
      contentContainerStyle={styles.streakScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      bounces={false}
    >
      <Animated.View
        style={{
          alignItems: 'center',
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }}
      >
        <View style={styles.streakBadgeWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.streakBurstRing,
              {
                opacity: claimBurst.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.55, 0] }),
                transform: [{
                  scale: claimBurst.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.8] }),
                }],
              },
            ]}
          />
          <Animated.View style={[styles.streakBadge, { transform: [{ scale: flame }] }]}>
            <Ionicons name="flame" size={54} color="#fff" />
          </Animated.View>
        </View>
        <Text style={styles.rewardKicker}>DAY 1 STREAK</Text>
        <Text style={styles.rewardTitle}>{claimed ? 'Streak started' : 'Commit to a streak'}</Text>
        <Text style={styles.rewardSub}>
          {claimed
            ? `You're going for ${goalDays} days. Come back tomorrow to keep it alive.`
            : 'How many days in a row can you show up? Pick a goal, then claim Day 1.'}
        </Text>
      </Animated.View>

      {!claimed && (
        <View style={styles.streakGoalList}>
          {STREAK_GOAL_OPTIONS.map((opt) => {
            const selected = opt.days === goalDays;
            return (
              <Bouncy
                key={opt.days}
                style={[styles.streakGoalRow, selected && styles.streakGoalRowSel]}
                onPress={() => pickGoal(opt.days)}
              >
                <View style={styles.streakGoalTextWrap}>
                  <Text style={[styles.streakGoalLabel, selected && styles.streakGoalLabelSel]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.streakGoalBlurb}>{opt.blurb}</Text>
                </View>
                <Text style={[styles.streakGoalDays, selected && styles.streakGoalDaysSel]}>
                  {opt.days} days
                </Text>
                <View style={[styles.streakGoalRadio, selected && styles.streakGoalRadioSel]}>
                  {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </Bouncy>
            );
          })}
        </View>
      )}

      <Animated.View style={[styles.streakCard, { transform: [{ scale: cardPop }] }]}>
        {claimed ? (
          <View style={styles.streakClaimedCol}>
            <View style={styles.streakClaimedRow}>
              <View style={styles.streakCheck}>
                <Ionicons name="checkmark" size={18} color={colors.background} />
              </View>
              <Text style={styles.streakClaimedText}>
                <CountUp value={earned} prefix="+" style={styles.streakClaimedText} /> Bot Bucks added
              </Text>
            </View>
            <Text style={styles.streakGoalCommitted}>
              Goal: {selectedGoal.label} · {goalDays} days
            </Text>
          </View>
        ) : (
          <View style={styles.streakAmountRow}>
            <Ionicons name="logo-bitcoin" size={24} color={colors.botBucks || '#F5B72B'} />
            <Text style={styles.streakAmount}>+{amount}</Text>
            <Text style={styles.streakAmountLabel}>Bot Bucks today</Text>
          </View>
        )}
      </Animated.View>

      {claimed ? (
        <PrimaryButton styles={styles} colors={colors} label="Keep going" icon="arrow-forward" onPress={onDone} />
      ) : (
        <PressScaleButton style={styles.primaryBtn} onPress={handleClaim} disabled={claiming}>
          <LinearGradient
            colors={['#FF8C42', '#FF6B35']}
            style={styles.primaryBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            {claiming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={[styles.primaryBtnText, { color: '#fff' }]}>
                  Claim Day 1 · {amount} Bot Bucks
                </Text>
                <Ionicons name="flame" size={19} color="#fff" />
              </>
            )}
          </LinearGradient>
        </PressScaleButton>
      )}
    </ScrollView>
  );
}

// Persuasive notification opt-in — the last onboarding step. We push hard for
// "Allow" (big animated bell, benefit bullets, glowing CTA) but always leave an
// honest, low-friction escape hatch so the user can decline.
const NOTIF_BENEFITS = [
  { icon: 'flame', tint: '#FF6B35', text: 'A nudge before your streak breaks at midnight.' },
  { icon: 'logo-bitcoin', tint: '#F5B72B', text: "Reminders so you don't miss free Bot Bucks." },
  { icon: 'trophy', tint: '#A66BFF', text: 'Heads up when new lessons and challenges drop.' },
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
        Alert.alert(
          'Almost there',
          "Notifications aren't available in this build yet. Rebuild the dev client to enable them:\n\ncd mobile && npx expo run:ios",
          [{ text: 'Continue', onPress: onDone }],
        );
        return;
      }

      const info = await getNotificationPermissionInfo();
      console.log('[Onboarding][notif] permission before request:', info);

      const saveAndSync = async () => {
        const prefs = await loadNotificationPrefs();
        const next = { ...prefs, daily: true, streak: true };
        await saveNotificationPrefs(next);
        const result = await syncNotificationSchedule(next, {
          firstName,
          streakDays,
          activeToday: lastActive === localDate(),
        });
        console.log('[Onboarding][notif] sync result:', result);
      };

      if (info.status === 'granted') {
        await saveAndSync();
        onDone();
        return;
      }

      // Already decided at the OS level: iOS won't show the system prompt again.
      if (info.status === 'denied' || !info.canAskAgain) {
        Alert.alert(
          'Turn on in Settings',
          "Notifications are currently off for MoneyBot. iOS only asks once, so open Settings to switch them on. You can keep going either way.",
          [
            { text: 'Not now', style: 'cancel', onPress: onDone },
            { text: 'Open Settings', onPress: () => { Linking.openSettings(); onDone(); } },
          ],
        );
        return;
      }

      await saveAndSync();
      onDone();
    } catch (err) {
      console.log('[Onboarding][notif] error:', err?.message || err);
      onDone();
    } finally {
      setBusy(false);
    }
  }, [busy, firstName, streakDays, lastActive, onDone]);

  const bellRotate = bell.interpolate({ inputRange: [-1, 1], outputRange: ['-16deg', '16deg'] });

  return (
    <ScrollView
      style={styles.notifWrap}
      contentContainerStyle={styles.notifScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
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
        <PressScaleButton style={styles.primaryBtn} onPress={handleAllow} disabled={busy}>
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
        </PressScaleButton>
        <Text style={styles.notifReassure}>Tap Allow when your phone asks. You can change this anytime.</Text>
        <TouchableOpacity style={styles.notifSkip} activeOpacity={0.7} onPress={finish} disabled={busy}>
          <Text style={styles.notifSkipText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function PrimaryButton({ styles, colors, label, icon, onPress, disabled }) {
  return (
    <PressScaleButton
      style={styles.primaryBtn}
      onPress={() => {
        Keyboard.dismiss();
        onPress?.();
      }}
      disabled={disabled}
    >
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.primaryBtnGrad}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      >
        <Text style={styles.primaryBtnText}>{label}</Text>
        {icon && <Ionicons name={icon} size={20} color={colors.background} />}
      </LinearGradient>
    </PressScaleButton>
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

const makeStyles = (colors, bottomInset = 16) => {
  const footerPad = Math.max(bottomInset, 16);
  return StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  flexFill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32, paddingBottom: footerPad },

  // Goals
  goalsWrap: { flex: 1, paddingTop: 12 },
  goalsHeader: { paddingHorizontal: 20, marginBottom: 18 },
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
  goalsFooter: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: footerPad },

  // Greet
  greetWrap: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 8, justifyContent: 'center', gap: 22 },
  greetScroll: { flexGrow: 1, justifyContent: 'center', paddingBottom: footerPad },
  greetAvatarRing: {
    width: 132, height: 132, borderRadius: 66, overflow: 'hidden', marginBottom: 16,
    borderWidth: 2, borderColor: 'rgba(61,220,95,0.45)', backgroundColor: colors.surfaceElevated,
  },
  greetAvatar: { width: '100%', height: '100%' },
  greetTitle: { fontSize: 32, fontWeight: '900', color: colors.white, letterSpacing: -0.6, marginBottom: 4 },
  greetBubble: {
    backgroundColor: colors.surfaceElevated, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  greetMessage: { fontSize: 16, fontWeight: '600', color: colors.white, lineHeight: 24 },
  betweenWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: footerPad,
    justifyContent: 'center',
    gap: 28,
  },
  betweenGuide: { marginBottom: 4 },
  charGuideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  charGuideThumb: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.primaryTintStrong,
  },
  charRevealFrame: {
    width: 168, height: 168, borderRadius: 28, overflow: 'hidden', marginBottom: 14, marginTop: 8,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Progress
  progressHeader: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4, gap: 10 },
  progressCount: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
  segRow: { flexDirection: 'row', gap: 6 },
  segTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },

  // Question
  qWrap: { flex: 1 },
  qScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  qFooter: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: footerPad,
  },
  qGuide: { paddingHorizontal: 24, paddingTop: 12 },
  qPrompt: { fontSize: 19, fontWeight: '700', color: colors.white, textAlign: 'center', lineHeight: 26, marginBottom: 16 },
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

  // Scale slider (forgiving touch target)
  scaleWrap: { marginTop: 6 },
  scaleReadout: {
    backgroundColor: colors.surfaceElevated, borderRadius: 18, paddingVertical: 22, paddingHorizontal: 18,
    borderWidth: 1.5, borderColor: colors.primary, marginBottom: 30, minHeight: 72, justifyContent: 'center',
  },
  scaleReadoutText: { fontSize: 20, fontWeight: '800', color: colors.white, textAlign: 'center' },
  scaleTrack: { height: 56, justifyContent: 'center', marginBottom: 6, paddingHorizontal: 4 },
  scaleBase: {
    position: 'absolute', left: 4, right: 4, height: 12, borderRadius: 6, backgroundColor: colors.border,
  },
  scaleFill: { position: 'absolute', left: 4, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  scaleTick: {
    position: 'absolute', width: 14, height: 14, borderRadius: 7, marginLeft: -7,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border,
  },
  scaleTickActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  scaleKnob: {
    position: 'absolute', width: 40, height: 40, borderRadius: 20, marginLeft: -20,
    backgroundColor: colors.white, borderWidth: 4, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  scaleKnobInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  scaleLabels: { flexDirection: 'row', marginTop: 4, marginBottom: 26 },
  scaleLabelBtn: { flex: 1, paddingHorizontal: 2, paddingVertical: 10 },
  scaleLabelText: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textAlign: 'center', lineHeight: 14 },
  scaleLabelTextActive: { color: colors.primary, fontWeight: '800' },

  // Vertical scale
  vScaleWrap: { marginTop: 6, gap: 14 },
  vScaleReadout: {
    backgroundColor: colors.surfaceElevated, borderRadius: 18, paddingVertical: 18, paddingHorizontal: 18,
    borderWidth: 1.5, borderColor: colors.primary, minHeight: 64, justifyContent: 'center',
  },
  vScaleRow: { flexDirection: 'row', alignItems: 'stretch', gap: 14, minHeight: 200, flexShrink: 1 },
  vScaleLabelsCol: { flex: 1, justifyContent: 'space-between', paddingVertical: 4 },
  vScaleLabelBtn: { paddingVertical: 8 },
  vScaleLabelText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, lineHeight: 18 },
  vScaleTrack: {
    width: 72, borderRadius: 36, backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border, justifyContent: 'flex-start', overflow: 'visible',
  },
  vScaleBase: {
    position: 'absolute', top: 16, bottom: 16, left: 28, width: 16, borderRadius: 8, backgroundColor: colors.border,
  },
  vScaleFill: {
    position: 'absolute', top: 16, left: 28, width: 16, borderRadius: 8, backgroundColor: colors.primary,
  },
  vScaleTick: {
    position: 'absolute', left: 22, width: 28, height: 28, borderRadius: 14, marginTop: -14,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border,
  },
  vScaleKnob: {
    position: 'absolute', left: 12, width: 48, height: 48, borderRadius: 24, marginTop: -24,
    backgroundColor: colors.white, borderWidth: 4, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },

  // Calculating
  calcText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },

  // Reveal
  revealWrap: { flex: 1, paddingHorizontal: 24, paddingBottom: footerPad, justifyContent: 'center' },
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
  rewardWrap: { flex: 1, paddingHorizontal: 24, paddingBottom: footerPad, justifyContent: 'center' },
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
  streakWrap: { flex: 1 },
  streakScroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: footerPad,
    justifyContent: 'center',
  },
  streakBadgeWrap: {
    width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  streakBurstRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#FF8C42',
    backgroundColor: 'rgba(255,107,53,0.25)',
  },
  streakBadge: {
    width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  streakGoalList: { marginTop: 22, gap: 10 },
  streakGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  streakGoalRowSel: {
    borderColor: '#FF6B35',
    backgroundColor: 'rgba(255,107,53,0.12)',
  },
  streakGoalTextWrap: { flex: 1, minWidth: 0 },
  streakGoalLabel: { fontSize: 16, fontWeight: '800', color: colors.white, marginBottom: 2 },
  streakGoalLabelSel: { color: '#FF8C42' },
  streakGoalBlurb: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  streakGoalDays: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  streakGoalDaysSel: { color: '#FF8C42' },
  streakGoalRadio: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  streakGoalRadioSel: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  streakCard: {
    backgroundColor: colors.surfaceElevated, borderRadius: 18, paddingVertical: 18, paddingHorizontal: 18,
    borderWidth: 1, borderColor: colors.border, marginTop: 18, marginBottom: 20, alignItems: 'center',
  },
  streakAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakAmount: { fontSize: 28, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  streakAmountLabel: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  streakClaimedCol: { alignItems: 'center', gap: 10 },
  streakClaimedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakCheck: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  streakClaimedText: { fontSize: 17, fontWeight: '800', color: colors.white },
  streakGoalCommitted: { fontSize: 13, fontWeight: '700', color: '#FF8C42' },

  // Notifications opt-in
  notifWrap: { flex: 1 },
  notifScroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: footerPad,
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
};
