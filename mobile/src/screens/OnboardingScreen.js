import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Easing, ScrollView, Pressable, Image, Alert, Platform, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../context/AuthContext';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { coursesApi } from '../api/courses';
import { getFirstName } from '../utils/displayName';
import { localDate } from '../utils/localDate';
import PuckButton from '../components/PuckButton';
import WidgetSetupPromo from '../components/WidgetSetupPromo';
import BrandAvatar from '../components/brand/BrandAvatar';
import TypewriterText from '../components/TypewriterText';
import {
  areNotificationsSupported,
  getNotificationPermissionInfo,
  loadNotificationPrefs,
  saveNotificationPrefs,
  syncNotificationSchedule,
} from '../utils/notifications';

// Animated MoneyBot mascots (transparent set). Waves hello / points at teaching
// content / celebrates wins — see usage per phase below.
const GIF_WAVE = require('../../assets/gifs/moneybot-wave-transparent-2x.gif');
const GIF_POINT = require('../../assets/gifs/moneybot-point-transparent.gif');
const GIF_CELEBRATE = require('../../assets/gifs/moneybot-celebrate-transparent.gif');
const GUIDE_IMAGE = require('../../assets/moneybot-guide.png');

// ---------------------------------------------------------------------------
// Copy + content
// ---------------------------------------------------------------------------

const GOAL_OPTIONS = [
  { key: 'saving_money', label: 'Saving money', icon: 'wallet' },
  { key: 'managing_spending', label: 'Managing spending', icon: 'pie-chart' },
  { key: 'understanding_credit', label: 'Understanding credit', icon: 'card' },
  { key: 'investing_basics', label: 'Investing basics', icon: 'trending-up' },
  { key: 'not_sure', label: 'Not sure yet', icon: 'help-circle' },
];

const CONFIDENCE_OPTIONS = [
  { key: 'fresh', label: 'Starting fresh', blurb: 'I want the basics explained plainly.' },
  { key: 'some', label: 'Know a little', blurb: 'I get the ideas, the details are fuzzy.' },
  { key: 'ready', label: 'Ready to practice', blurb: 'Give me the decisions to work through.' },
];

// The three buckets that anchor the whole lesson.
const BUCKETS = [
  { key: 'needs', label: 'Needs', pct: 55, color: '#4C8DFF' },
  { key: 'wants', label: 'Wants', pct: 25, color: '#FF8C42' },
  { key: 'savings', label: 'Savings', pct: 20, color: '#3DDC5F' },
];

// Visual-choice plans. Plan B is the only one that leaves room for savings.
const PLANS = [
  { id: 'A', name: 'Plan A', n: 70, w: 30, s: 0 },
  { id: 'B', name: 'Plan B', n: 55, w: 25, s: 20, correct: true },
  { id: 'C', name: 'Plan C', n: 45, w: 55, s: 0 },
];

// Tap-to-match: each spending item belongs in exactly one bucket.
const MATCH_ITEMS = [
  { id: 'rent', label: 'Rent', bucket: 'needs' },
  { id: 'sneakers', label: 'New sneakers', bucket: 'wants' },
  { id: 'emergency', label: 'Emergency fund', bucket: 'savings' },
];

const LESSON_TOTAL_STEPS = 5;

// ---------------------------------------------------------------------------
// Small shared building blocks
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function useEnter(deps = []) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return anim;
}

/** Full-width green 3D CTA matching the app's Duolingo puck style. */
function PrimaryCTA({ label, icon = 'arrow-forward', onPress, disabled, color, styles }) {
  return (
    <PuckButton
      color={disabled ? '#3A3A3A' : (color || '#3DDC5F')}
      height={56}
      borderRadius={18}
      lip={5}
      disabled={disabled}
      onPress={onPress}
      contentStyle={styles.ctaInner}
      accessibilityLabel={label}
    >
      <Text style={[styles.ctaText, disabled && { color: '#7A7A7A' }]}>{label}</Text>
      {icon ? <Ionicons name={icon} size={19} color={disabled ? '#7A7A7A' : '#08120B'} /> : null}
    </PuckButton>
  );
}

/** Animated MoneyBot mascot with a soft glow ring behind it. */
function MascotGif({ source, size = 150, glow = true, colors }) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [float]);
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      {glow && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', width: size * 0.9, height: size * 0.9, borderRadius: size,
            backgroundColor: colors.primary, opacity: 0.14,
          }}
        />
      )}
      <Animated.Image
        source={source}
        resizeMode="contain"
        style={{
          width: size, height: size,
          transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [4, -6] }) }],
        }}
      />
    </View>
  );
}

function OnboardingShell({ colors, isDark, styles, children }) {
  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

/** Back chevron + a smooth progress bar, like the mockups. */
function TopBar({ styles, colors, progress, onBack, showBack = true }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [progress, anim]);
  return (
    <View style={styles.topBar}>
      {showBack ? (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backBtn} />
      )}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            { width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
      <View style={styles.backBtn} />
    </View>
  );
}

/** MoneyBot chat bubble used at the top of the goal/confidence screens. */
function CoachBubble({ styles, message }) {
  return (
    <View style={styles.coachRow}>
      <View style={styles.coachAvatarRing}>
        <Image source={GUIDE_IMAGE} style={styles.coachAvatar} resizeMode="contain" />
      </View>
      <View style={styles.coachBubble}>
        <Text style={styles.coachText}>{message}</Text>
      </View>
    </View>
  );
}

/** Selectable radio row (goal + confidence pickers). */
function SelectRow({ styles, colors, title, blurb, icon, selected, onPress }) {
  return (
    <Bouncy style={[styles.selectRow, selected && styles.selectRowSel]} onPress={onPress}>
      {icon ? (
        <View style={[styles.selectIcon, selected && styles.selectIconSel]}>
          <Ionicons name={icon} size={20} color={selected ? '#08120B' : colors.textSecondary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.selectTitle, selected && styles.selectTitleSel]}>{title}</Text>
        {blurb ? <Text style={styles.selectBlurb}>{blurb}</Text> : null}
      </View>
      <View style={[styles.selectRadio, selected && styles.selectRadioSel]}>
        {selected && <Ionicons name="checkmark" size={15} color="#08120B" />}
      </View>
    </Bouncy>
  );
}

function usePressScale(pressedScale = 0.96) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = useCallback(() => {
    Animated.spring(scale, { toValue: pressedScale, speed: 60, bounciness: 0, useNativeDriver: true }).start();
  }, [pressedScale, scale]);
  const onPressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, speed: 18, bounciness: 12, useNativeDriver: true }).start();
  }, [scale]);
  return { scale, onPressIn, onPressOut };
}

function Bouncy({ children, style, onPress, disabled }) {
  const { scale, onPressIn, onPressOut } = usePressScale(0.97);
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={disabled ? undefined : onPressIn}
      onPressOut={disabled ? undefined : onPressOut}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

function CountUp({ value, duration = 900, delay = 0, prefix = '', style }) {
  const [display, setDisplay] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: value, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    }, delay);
    return () => { clearTimeout(timer); anim.removeListener(id); };
  }, [value]);
  return <Text style={style}>{prefix}{display}</Text>;
}

function ConfettiBurst({ colors }) {
  const palette = [colors.primary, '#F5B72B', '#56C8E8', '#A66BFF', '#FF6B35'];
  const dots = useRef(
    Array.from({ length: 24 }, (_, i) => ({
      key: i,
      anim: new Animated.Value(0),
      x: (Math.random() - 0.5) * 320,
      rot: Math.random() * 2,
      delay: Math.random() * 320,
      color: palette[i % palette.length],
      size: 7 + Math.random() * 7,
    })),
  ).current;
  useEffect(() => {
    Animated.stagger(16, dots.map((d) => Animated.timing(d.anim, {
      toValue: 1, duration: 1500, delay: d.delay, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }))).start();
  }, []);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%', zIndex: 10 }}>
      {dots.map((d) => (
        <Animated.View
          key={d.key}
          style={{
            position: 'absolute', top: 0, alignSelf: 'center',
            width: d.size, height: d.size * 1.4, borderRadius: 2, backgroundColor: d.color,
            opacity: d.anim.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: d.anim.interpolate({ inputRange: [0, 1], outputRange: [0, d.x] }) },
              { translateY: d.anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 620] }) },
              { rotate: d.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${d.rot * 360}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Phase order (drives the top progress bar + back navigation)
// ---------------------------------------------------------------------------

const PHASE_ORDER = [
  'welcome', 'goal', 'confidence', 'lessonIntro', 'lesson', 'lessonComplete',
  'streak', 'character', 'save', 'reminder', 'widget', 'learningPath',
];

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const { token, user, isGuest } = useAuth();
  const {
    submitOnboarding,
    finishOnboarding,
    completeLesson,
    modules,
    characters,
    equippedCharacter,
    equipCharacter,
    purchaseCharacter,
    claimStarterCharacter,
    refreshCharacterCache,
    streakDays,
    botBucks,
  } = useUserProgress();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, insets.bottom), [colors, insets.bottom]);

  const [phase, setPhase] = useState('welcome');
  const [goal, setGoal] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [streakGoalDays, setStreakGoalDays] = useState(7);
  const [lessonReward, setLessonReward] = useState({ xp: 50, botBucks: 25 });
  const finishingRef = useRef(false);

  const firstName = getFirstName(user);

  // The real first lesson on the learning path — completing the onboarding
  // lesson writes to it via completeLesson so it counts on the roadmap.
  const firstLesson = useMemo(() => {
    for (const mod of modules || []) {
      const lesson = (mod.lessons || [])[0];
      if (lesson) return { lesson, module: mod };
    }
    return null;
  }, [modules]);

  const goTo = useCallback((next) => setPhase(next), []);

  const goBack = useCallback(() => {
    const idx = PHASE_ORDER.indexOf(phase);
    if (idx > 0) setPhase(PHASE_ORDER[idx - 1]);
  }, [phase]);

  const progressFor = useCallback((p) => {
    const idx = Math.max(0, PHASE_ORDER.indexOf(p));
    // Small floor so the very first screen still reads as "started".
    return Math.max(0.08, idx / (PHASE_ORDER.length - 1));
  }, []);

  // Mark the lesson complete on the backend (awards XP / Bot Bucks / day-1
  // streak). Runs once when we reach the completion screen.
  const runComplete = useCallback(async (mistakes) => {
    if (!firstLesson) return;
    try {
      const res = await completeLesson(firstLesson.lesson.id, mistakes);
      if (res && !res.pending && res.xp_earned) {
        setLessonReward((prev) => ({ ...prev, xp: res.xp_earned }));
      }
    } catch (e) {
      // Non-fatal — the celebration still shows placeholder rewards.
    }
  }, [firstLesson, completeLesson]);

  // Persist the chosen streak commitment.
  const saveStreakGoal = useCallback(async (days) => {
    setStreakGoalDays(days);
    try { await coursesApi.updateStreakGoal(token, days); } catch (e) { /* best effort */ }
  }, [token]);

  // Final exit: record onboarding as complete on the backend (marks the flag +
  // stores the goals for recommendation weighting), then flip the nav gate.
  const finishAll = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const goals = [goal, confidence ? `confidence:${confidence}` : null].filter(Boolean);
    try { await submitOnboarding({}, goals); } catch (e) { /* gate still flips below */ }
    finishOnboarding();
  }, [goal, confidence, submitOnboarding, finishOnboarding]);

  const afterLesson = 'lessonComplete';

  // Notifications → widget is iOS-only; Android skips straight to the path.
  const afterReminder = Platform.OS === 'ios' ? 'widget' : 'learningPath';

  // ---- Render per phase ----
  // 'lesson' renders its own header (LessonHeader), so it's excluded here.
  const showTopBar = ['welcome', 'goal', 'confidence', 'lessonIntro'].includes(phase);

  return (
    <OnboardingShell colors={colors} isDark={isDark} styles={styles}>
      {showTopBar && (
        <TopBar
          styles={styles}
          colors={colors}
          progress={progressFor(phase)}
          onBack={goBack}
          showBack={phase !== 'welcome'}
        />
      )}

      {phase === 'welcome' && (
        <WelcomeView styles={styles} colors={colors} firstName={firstName} onContinue={() => goTo('goal')} />
      )}

      {phase === 'goal' && (
        <GoalView
          styles={styles}
          colors={colors}
          selected={goal}
          onSelect={setGoal}
          onContinue={() => goTo('confidence')}
        />
      )}

      {phase === 'confidence' && (
        <ConfidenceView
          styles={styles}
          colors={colors}
          selected={confidence}
          onSelect={setConfidence}
          onContinue={() => goTo('lessonIntro')}
        />
      )}

      {phase === 'lessonIntro' && (
        <LessonIntroView styles={styles} colors={colors} onStart={() => goTo('lesson')} />
      )}

      {phase === 'lesson' && (
        <LessonFlow
          styles={styles}
          colors={colors}
          onExit={() => goTo('lessonIntro')}
          onComplete={(mistakes) => { runComplete(mistakes); goTo(afterLesson); }}
        />
      )}

      {phase === 'lessonComplete' && (
        <LessonCompleteView
          styles={styles}
          colors={colors}
          reward={lessonReward}
          streakDays={streakDays || 1}
          onContinue={() => goTo('streak')}
        />
      )}

      {phase === 'streak' && (
        <StreakCommitView
          styles={styles}
          colors={colors}
          selected={streakGoalDays}
          onSelect={saveStreakGoal}
          onContinue={() => goTo('character')}
        />
      )}

      {phase === 'character' && (
        <CharacterMomentView
          styles={styles}
          colors={colors}
          characters={characters}
          equippedCharacter={equippedCharacter}
          equipCharacter={equipCharacter}
          purchaseCharacter={purchaseCharacter}
          claimStarterCharacter={claimStarterCharacter}
          refreshCharacterCache={refreshCharacterCache}
          onDone={() => goTo('save')}
        />
      )}

      {phase === 'save' && (
        <SaveProgressView
          styles={styles}
          colors={colors}
          isGuest={isGuest}
          firstName={firstName}
          streakDays={streakDays || 1}
          botBucks={botBucks}
          character={equippedCharacter}
          navigation={navigation}
          onDone={() => goTo('reminder')}
        />
      )}

      {phase === 'reminder' && (
        <ReminderView
          styles={styles}
          colors={colors}
          firstName={firstName}
          streakDays={streakDays}
          onDone={() => goTo(afterReminder)}
        />
      )}

      {phase === 'widget' && (
        <WidgetSetupPromo colors={colors} onDone={() => goTo('learningPath')} />
      )}

      {phase === 'learningPath' && (
        <LearningPathView
          styles={styles}
          colors={colors}
          modules={modules}
          onFinish={finishAll}
        />
      )}
    </OnboardingShell>
  );
}

// ---------------------------------------------------------------------------
// 1. Welcome
// ---------------------------------------------------------------------------

function WelcomeView({ styles, colors, firstName, onContinue }) {
  const anim = useEnter([]);
  const [typed, setTyped] = useState(false);
  const btnAnim = useRef(new Animated.Value(0)).current;
  const markTyped = useCallback(() => setTyped(true), []);
  // Fallback so the CTA always appears even if onDone never fires.
  useEffect(() => {
    const t = setTimeout(markTyped, 9000);
    return () => clearTimeout(t);
  }, [markTyped]);
  useEffect(() => {
    if (typed) {
      Animated.spring(btnAnim, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start();
    }
  }, [typed, btnAnim]);

  const message = firstName
    ? `Hey ${firstName}, I'm MoneyBot. Give me three minutes and I'll teach you your first money skill.`
    : "Hey, I'm MoneyBot. Give me three minutes and I'll teach you your first money skill.";

  const PROMISES = [
    { icon: 'time', text: 'Three minutes, one real lesson' },
    { icon: 'heart', text: 'No lives, no penalties' },
    { icon: 'gift', text: 'A free character at the end' },
  ];

  return (
    <View style={styles.welcomeWrap}>
      <ScrollView contentContainerStyle={styles.welcomeScroll} showsVerticalScrollIndicator={false} bounces={false}>
        <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
          {/* Speech bubble on top — greeting types out. Tail points DOWN to MoneyBot. */}
          <Pressable style={styles.speechBubble} onPress={markTyped}>
            <TypewriterText
              key={message}
              text={message}
              style={styles.speechText}
              speed={26}
              onDone={markTyped}
            />
          </Pressable>
          <View style={styles.speechTailDownWrap}>
            <View style={styles.speechTailDownBorder} />
            <View style={styles.speechTailDownFill} />
          </View>

          {/* MoneyBot answering below the bubble, with the coach label beside it. */}
          <View style={styles.coachIntroRow}>
            <MascotGif source={GIF_WAVE} size={150} colors={colors} glow={false} />
            <View style={styles.coachIntroText}>
              <Text style={styles.kickerLeft}>YOUR COACH</Text>
              <Text style={styles.coachName}>MoneyBot</Text>
            </View>
          </View>

          {/* Three promises fill the space and set expectations up front. */}
          <View style={styles.promiseList}>
            {PROMISES.map((p) => (
              <View key={p.icon} style={styles.promiseRow}>
                <View style={styles.promiseIcon}>
                  <Ionicons name={p.icon} size={18} color={colors.primary} />
                </View>
                <Text style={styles.promiseText}>{p.text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        {typed && (
          <Animated.View
            style={{
              opacity: btnAnim,
              transform: [{ translateY: btnAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}
          >
            <PrimaryCTA styles={styles} label="LET'S GO" icon={null} onPress={onContinue} />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 2. Goal
// ---------------------------------------------------------------------------

function GoalView({ styles, colors, selected, onSelect, onContinue }) {
  const anim = useEnter([]);
  return (
    <Animated.View style={[styles.flexFill, { opacity: anim }]}>
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        <CoachBubble styles={styles} message="Pick one thing to aim at. I'll lead with it — everything else stays open." />
        <Text style={styles.screenTitle}>What would you like to feel better about?</Text>
        <View style={{ gap: 12, marginTop: 6 }}>
          {GOAL_OPTIONS.map((g) => (
            <SelectRow
              key={g.key}
              styles={styles}
              colors={colors}
              title={g.label}
              icon={g.icon}
              selected={selected === g.key}
              onPress={() => onSelect(g.key)}
            />
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryCTA styles={styles} label="Continue" onPress={onContinue} disabled={!selected} />
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// 3. Confidence
// ---------------------------------------------------------------------------

function ConfidenceView({ styles, colors, selected, onSelect, onContinue }) {
  const anim = useEnter([]);
  return (
    <Animated.View style={[styles.flexFill, { opacity: anim }]}>
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>How comfortable do you feel with money basics?</Text>
        <Text style={styles.screenSub}>This sets the pace of the hints, nothing else. You can change it any time.</Text>
        <View style={{ gap: 12, marginTop: 18 }}>
          {CONFIDENCE_OPTIONS.map((c) => (
            <SelectRow
              key={c.key}
              styles={styles}
              colors={colors}
              title={c.label}
              blurb={c.blurb}
              selected={selected === c.key}
              onPress={() => onSelect(c.key)}
            />
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryCTA styles={styles} label="Continue" onPress={onContinue} disabled={!selected} />
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// 4. Lesson intro
// ---------------------------------------------------------------------------

function LessonIntroView({ styles, colors, onStart }) {
  const anim = useEnter([]);
  return (
    <View style={styles.centerWrap}>
      <Animated.View style={{ alignItems: 'center', opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
        <MascotGif source={GIF_WAVE} size={150} colors={colors} />
        <View style={styles.sectionPill}>
          <Text style={styles.sectionPillText}>SECTION 1 · LESSON 1</Text>
        </View>
        <Text style={styles.bigTitle}>Plan your spending</Text>
        <Text style={styles.bodyText}>
          Five quick steps, about three minutes. I'll teach first, then ask. Get one wrong and we just try again.
        </Text>
        <View style={styles.noteRow}>
          <Ionicons name="ribbon" size={16} color={colors.primary} />
          <Text style={styles.noteText}>This is a real lesson — it counts on your path.</Text>
        </View>
      </Animated.View>
      <View style={styles.footer}>
        <PrimaryCTA styles={styles} label="Start lesson" icon="play" onPress={onStart} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 4a–4e. The lesson itself (teaching + 4 interactions), no lives
// ---------------------------------------------------------------------------

function LessonSegments({ styles, colors, current }) {
  return (
    <View style={styles.lessonSegs}>
      {Array.from({ length: LESSON_TOTAL_STEPS }).map((_, i) => (
        <View key={i} style={styles.lessonSeg}>
          <View
            style={[
              styles.lessonSegFill,
              { backgroundColor: i <= current ? colors.primary : 'transparent' },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

function LessonHeader({ styles, colors, step, onExit }) {
  return (
    <View style={styles.lessonHeader}>
      <TouchableOpacity style={styles.backBtn} onPress={onExit} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
      </TouchableOpacity>
      <LessonSegments styles={styles} colors={colors} current={step} />
      <Text style={styles.lessonCount}>{step + 1}/{LESSON_TOTAL_STEPS}</Text>
    </View>
  );
}

/** Green success / retry hint banner that slides up from the footer. */
function FeedbackBanner({ styles, colors, tone, title, body }) {
  const anim = useEnter([tone, title, body]);
  const ok = tone === 'success';
  return (
    <Animated.View
      style={[
        styles.feedback,
        { borderColor: ok ? colors.primary : '#FF6B6B', backgroundColor: ok ? 'rgba(61,220,95,0.12)' : 'rgba(255,107,107,0.12)' },
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
      ]}
    >
      <Ionicons name={ok ? 'checkmark-circle' : 'bulb'} size={22} color={ok ? colors.primary : '#FF6B6B'} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.feedbackTitle, { color: ok ? colors.primary : '#FF8C8C' }]}>{title}</Text>
        {body ? <Text style={styles.feedbackBody}>{body}</Text> : null}
      </View>
    </Animated.View>
  );
}

function BucketBar({ styles, label, pct, color }) {
  return (
    <View style={styles.bucketRow}>
      <View style={styles.bucketHead}>
        <Text style={styles.bucketLabel}>{label}</Text>
        <Text style={[styles.bucketPct, { color }]}>{pct}%</Text>
      </View>
      <View style={styles.bucketTrack}>
        <View style={[styles.bucketFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function LessonFlow({ styles, colors, onExit, onComplete }) {
  const [step, setStep] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const addMistake = useCallback(() => setMistakes((m) => m + 1), []);

  const next = useCallback(() => {
    if (step + 1 >= LESSON_TOTAL_STEPS) onComplete(mistakes);
    else setStep((s) => s + 1);
  }, [step, mistakes, onComplete]);

  const back = useCallback(() => {
    if (step === 0) onExit();
    else setStep((s) => s - 1);
  }, [step, onExit]);

  return (
    <View style={styles.flexFill}>
      <LessonHeader styles={styles} colors={colors} step={step} onExit={back} />
      {step === 0 && <TeachingCard key="t" styles={styles} colors={colors} onNext={next} />}
      {step === 1 && <VisualChoice key="v" styles={styles} colors={colors} onNext={next} onMistake={addMistake} />}
      {step === 2 && <TapToMatch key="m" styles={styles} colors={colors} onNext={next} onMistake={addMistake} />}
      {step === 3 && <WordBank key="w" styles={styles} colors={colors} onNext={next} onMistake={addMistake} />}
      {step === 4 && <Application key="a" styles={styles} colors={colors} onNext={next} onMistake={addMistake} />}
    </View>
  );
}

// 4a. Teaching card
function TeachingCard({ styles, colors, onNext }) {
  const anim = useEnter([]);
  return (
    <View style={styles.flexFill}>
      <Animated.View style={[styles.lessonBody, { opacity: anim }]}>
        <View style={styles.pointRow}>
          <Image source={GIF_POINT} style={styles.pointMascot} resizeMode="contain" />
          <Text style={styles.lessonKicker}>TEACHING</Text>
        </View>
        <Text style={styles.lessonTitle}>Give every dollar a job</Text>
        <Text style={styles.lessonPara}>
          A spending plan is just deciding where money goes <Text style={styles.bold}>before</Text> you spend it. Three buckets cover most of it.
        </Text>
        <View style={styles.teachCard}>
          {BUCKETS.map((b) => (
            <BucketBar key={b.key} styles={styles} label={b.label} pct={b.pct} color={b.color} />
          ))}
        </View>
        <Text style={styles.lessonPara}>
          The exact split is yours. What matters is that savings gets a slice before the fun money does.
        </Text>
      </Animated.View>
      <View style={styles.footer}>
        <PrimaryCTA styles={styles} label="Got it" icon="checkmark" onPress={onNext} />
      </View>
    </View>
  );
}

// 4b. Visual choice
function VisualChoice({ styles, colors, onNext, onMistake }) {
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const correct = sel && PLANS.find((p) => p.id === sel)?.correct;

  function check() {
    if (correct) { setChecked(true); }
    else { onMistake(); setChecked('wrong'); }
  }

  return (
    <View style={styles.flexFill}>
      <ScrollView contentContainerStyle={styles.lessonScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lessonKicker}>PICK ONE</Text>
        <Text style={styles.lessonTitle}>Which plan leaves room for savings?</Text>
        <View style={styles.planRow}>
          {PLANS.map((p) => {
            const isSel = sel === p.id;
            const isRight = checked === true && p.correct;
            return (
              <Bouncy
                key={p.id}
                style={[styles.planCard, isSel && styles.planCardSel, isRight && styles.planCardRight]}
                disabled={checked === true}
                onPress={() => { setSel(p.id); if (checked === 'wrong') setChecked(false); }}
              >
                <View style={styles.planHead}>
                  <Text style={styles.planName}>{p.name}</Text>
                  {isRight && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
                </View>
                <MiniBar styles={styles} letter="N" pct={p.n} color="#4C8DFF" />
                <MiniBar styles={styles} letter="W" pct={p.w} color="#FF8C42" />
                <MiniBar styles={styles} letter="S" pct={p.s} color="#3DDC5F" />
              </Bouncy>
            );
          })}
        </View>
        <Text style={styles.planLegend}>N = needs · W = wants · S = savings</Text>
      </ScrollView>

      <View style={styles.footer}>
        {checked === true ? (
          <>
            <FeedbackBanner
              styles={styles}
              colors={colors}
              tone="success"
              title="Nice."
              body="Plan B keeps 20% for savings, so money is set aside before the spending starts."
            />
            <PrimaryCTA styles={styles} label="Continue" onPress={onNext} />
          </>
        ) : (
          <>
            {checked === 'wrong' && (
              <FeedbackBanner
                styles={styles}
                colors={colors}
                tone="hint"
                title="Not quite — check the S bar."
                body="Look for the plan where savings still gets a real slice. Try again."
              />
            )}
            <PrimaryCTA styles={styles} label="Check" icon={null} onPress={check} disabled={!sel} />
          </>
        )}
      </View>
    </View>
  );
}

function MiniBar({ styles, letter, pct, color }) {
  return (
    <View style={styles.miniRow}>
      <Text style={styles.miniLetter}>{letter}</Text>
      <View style={styles.miniTrack}>
        <View style={[styles.miniFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// 4c. Tap to match
function TapToMatch({ styles, colors, onNext, onMistake }) {
  const [activeItem, setActiveItem] = useState(null);
  const [matched, setMatched] = useState({}); // itemId -> bucketKey
  const [wrong, setWrong] = useState(null); // bucketKey briefly flashed red
  const allMatched = Object.keys(matched).length === MATCH_ITEMS.length;

  function tapBucket(bucketKey) {
    if (!activeItem) return;
    const item = MATCH_ITEMS.find((i) => i.id === activeItem);
    if (item.bucket === bucketKey) {
      setMatched((m) => ({ ...m, [item.id]: bucketKey }));
      setActiveItem(null);
    } else {
      onMistake();
      setWrong(bucketKey);
      setTimeout(() => setWrong(null), 500);
    }
  }

  return (
    <View style={styles.flexFill}>
      <ScrollView contentContainerStyle={styles.lessonScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lessonKicker}>TAP TO MATCH</Text>
        <Text style={styles.lessonTitle}>Sort each one into its bucket</Text>
        <Text style={styles.lessonPara}>Tap an item, then tap where it belongs.</Text>

        <View style={styles.chipWrap}>
          {MATCH_ITEMS.map((item) => {
            const done = !!matched[item.id];
            const active = activeItem === item.id;
            return (
              <Bouncy
                key={item.id}
                disabled={done}
                style={[styles.matchChip, active && styles.matchChipActive, done && styles.matchChipDone]}
                onPress={() => setActiveItem(active ? null : item.id)}
              >
                {done && <Ionicons name="checkmark" size={14} color={colors.primary} />}
                <Text style={[styles.matchChipText, done && { color: colors.textMuted, textDecorationLine: 'line-through' }]}>
                  {item.label}
                </Text>
              </Bouncy>
            );
          })}
        </View>

        <View style={{ gap: 12, marginTop: 8 }}>
          {BUCKETS.map((b) => {
            const filled = MATCH_ITEMS.filter((i) => matched[i.id] === b.key);
            const isWrong = wrong === b.key;
            return (
              <TouchableOpacity
                key={b.key}
                activeOpacity={0.85}
                onPress={() => tapBucket(b.key)}
                style={[
                  styles.bucketDrop,
                  { borderColor: isWrong ? '#FF6B6B' : (activeItem ? b.color : colors.border) },
                ]}
              >
                <View style={[styles.bucketDot, { backgroundColor: b.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bucketDropLabel}>{b.label}</Text>
                  {filled.length > 0 && (
                    <Text style={styles.bucketDropItems}>{filled.map((i) => i.label).join(' · ')}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {allMatched ? (
          <>
            <FeedbackBanner styles={styles} colors={colors} tone="success" title="All sorted." body="Rent is a need, sneakers are a want, and the emergency fund is savings." />
            <PrimaryCTA styles={styles} label="Continue" onPress={onNext} />
          </>
        ) : (
          <Text style={styles.helperCenter}>
            {activeItem ? 'Now tap the right bucket.' : 'Tap an item to start.'}
          </Text>
        )}
      </View>
    </View>
  );
}

// 4d. Word bank
const WORD_BANK = [
  { word: 'before', correct: true },
  { word: 'after', correct: false },
  { word: 'while', correct: false },
];

function WordBank({ styles, colors, onNext, onMistake }) {
  const [pick, setPick] = useState(null);
  const [checked, setChecked] = useState(false);
  const isCorrect = pick && WORD_BANK.find((w) => w.word === pick)?.correct;

  function check() {
    if (isCorrect) setChecked(true);
    else { onMistake(); setChecked('wrong'); }
  }

  return (
    <View style={styles.flexFill}>
      <ScrollView contentContainerStyle={styles.lessonScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lessonKicker}>FILL THE BLANK</Text>
        <Text style={styles.lessonTitle}>Finish the rule</Text>
        <View style={styles.sentenceCard}>
          <Text style={styles.sentenceText}>
            A spending plan decides where money goes{'  '}
            <Text style={[styles.blankChip, pick && styles.blankChipFilled]}>
              {pick || '______'}
            </Text>
            {'  '}you spend it.
          </Text>
        </View>
        <View style={styles.chipWrap}>
          {WORD_BANK.map((w) => {
            const sel = pick === w.word;
            return (
              <Bouncy
                key={w.word}
                disabled={checked === true}
                style={[styles.wordChip, sel && styles.wordChipSel]}
                onPress={() => { setPick(w.word); if (checked === 'wrong') setChecked(false); }}
              >
                <Text style={[styles.wordChipText, sel && styles.wordChipTextSel]}>{w.word}</Text>
              </Bouncy>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {checked === true ? (
          <>
            <FeedbackBanner styles={styles} colors={colors} tone="success" title="Exactly." body="Deciding before you spend is what turns wishes into a plan." />
            <PrimaryCTA styles={styles} label="Continue" onPress={onNext} />
          </>
        ) : (
          <>
            {checked === 'wrong' && (
              <FeedbackBanner styles={styles} colors={colors} tone="hint" title="Close — think about timing." body="A plan works when you choose ahead of time, not once the money's gone." />
            )}
            <PrimaryCTA styles={styles} label="Check" icon={null} onPress={check} disabled={!pick} />
          </>
        )}
      </View>
    </View>
  );
}

// 4e. Application
const APPLY_OPTIONS = [
  { id: 'save', text: 'Move $20 to savings first, then budget the rest', correct: true },
  { id: 'wants', text: 'Spend on wants now, save whatever is left', correct: false },
  { id: 'wait', text: 'Cover needs only and decide about savings later', correct: false },
];

function Application({ styles, colors, onNext, onMistake }) {
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const isCorrect = sel && APPLY_OPTIONS.find((o) => o.id === sel)?.correct;

  function check() {
    if (isCorrect) setChecked(true);
    else { onMistake(); setChecked('wrong'); }
  }

  return (
    <View style={styles.flexFill}>
      <ScrollView contentContainerStyle={styles.lessonScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lessonKicker}>YOUR MOVE</Text>
        <Text style={styles.lessonTitle}>You just got $100. Using 50/30/20, what happens first?</Text>
        <View style={{ gap: 12, marginTop: 12 }}>
          {APPLY_OPTIONS.map((o) => {
            const isSel = sel === o.id;
            const showRight = checked === true && o.correct;
            return (
              <Bouncy
                key={o.id}
                disabled={checked === true}
                style={[styles.applyOption, isSel && styles.applyOptionSel, showRight && styles.applyOptionRight]}
                onPress={() => { setSel(o.id); if (checked === 'wrong') setChecked(false); }}
              >
                <View style={[styles.selectRadio, isSel && styles.selectRadioSel]}>
                  {isSel && <Ionicons name="checkmark" size={15} color="#08120B" />}
                </View>
                <Text style={[styles.applyText, isSel && { color: colors.white }]}>{o.text}</Text>
              </Bouncy>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {checked === true ? (
          <>
            <FeedbackBanner styles={styles} colors={colors} tone="success" title="That's the habit." body="Pay your savings first — $20 of every $100 — and the rest of the plan falls into place." />
            <PrimaryCTA styles={styles} label="Finish lesson" icon="checkmark" onPress={onNext} />
          </>
        ) : (
          <>
            {checked === 'wrong' && (
              <FeedbackBanner styles={styles} colors={colors} tone="hint" title="Remember the order." body="Savings gets its slice before the fun money. Try again." />
            )}
            <PrimaryCTA styles={styles} label="Check" icon={null} onPress={check} disabled={!sel} />
          </>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 5. Lesson complete
// ---------------------------------------------------------------------------

function LessonCompleteView({ styles, colors, reward, streakDays, onContinue }) {
  const anim = useEnter([]);
  return (
    <View style={styles.flexFill}>
      <ConfettiBurst colors={colors} />
      <ScrollView contentContainerStyle={styles.centerScroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ alignItems: 'center', opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}>
          <MascotGif source={GIF_CELEBRATE} size={150} colors={colors} />
          <Text style={styles.bigTitle}>Lesson 1 complete</Text>
          <Text style={styles.screenSub}>Plan your spending · Section 1</Text>

          <View style={styles.xpBanner}>
            <Ionicons name="flash" size={26} color={colors.primary} />
            <CountUp value={reward.xp} prefix="+" style={styles.xpValue} />
            <Text style={styles.xpLabel}>XP EARNED</Text>
          </View>

          <View style={styles.rewardRow}>
            <View style={styles.rewardTile}>
              <Ionicons name="logo-bitcoin" size={22} color={colors.botBucks} />
              <CountUp value={reward.botBucks} prefix="+" style={styles.rewardTileValue} />
              <Text style={styles.rewardTileLabel}>Bot Bucks</Text>
            </View>
            <View style={styles.rewardTile}>
              <Ionicons name="flame" size={22} color={colors.streak} />
              <Text style={styles.rewardTileValue}>{streakDays}</Text>
              <Text style={styles.rewardTileLabel}>Day streak</Text>
            </View>
          </View>
          <Text style={styles.finePrint}>Your streak counts days you finish a lesson, not days you open the app.</Text>
        </Animated.View>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryCTA styles={styles} label="Continue" onPress={onContinue} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 6. Streak commitment
// ---------------------------------------------------------------------------

const STREAK_GOALS = [
  { days: 7, label: 'Casual', blurb: 'Easy does it' },
  { days: 14, label: 'Regular', blurb: 'Build the habit' },
  { days: 30, label: 'Serious', blurb: 'Real momentum' },
  { days: 60, label: 'Intense', blurb: 'All in' },
];

function StreakCommitView({ styles, colors, selected, onSelect, onContinue }) {
  const anim = useEnter([]);
  const flame = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(flame, { toValue: 1.12, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(flame, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [flame]);
  return (
    <View style={styles.flexFill}>
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ alignItems: 'center', opacity: anim }}>
          <Animated.View style={[styles.streakBadge, { transform: [{ scale: flame }] }]}>
            <Ionicons name="flame" size={46} color="#fff" />
          </Animated.View>
          <Text style={styles.kicker}>YOUR COMMITMENT</Text>
          <Text style={styles.bigTitle}>Pick a streak goal</Text>
          <Text style={styles.bodyText}>How many days in a row will you show up? You can change it later.</Text>
        </Animated.View>

        <View style={{ gap: 10, marginTop: 20 }}>
          {STREAK_GOALS.map((o) => {
            const isSel = selected === o.days;
            return (
              <Bouncy
                key={o.days}
                style={[styles.streakRow, isSel && styles.streakRowSel]}
                onPress={() => onSelect(o.days)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.streakLabel, isSel && { color: colors.streak }]}>{o.label}</Text>
                  <Text style={styles.streakBlurb}>{o.blurb}</Text>
                </View>
                <Text style={[styles.streakDays, isSel && { color: colors.streak }]}>{o.days} days</Text>
                <View style={[styles.streakRadio, isSel && styles.streakRadioSel]}>
                  {isSel && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </Bouncy>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryCTA styles={styles} label={`Commit to ${selected} days`} icon="flame" color={colors.streak} onPress={onContinue} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 7. Character moment
// ---------------------------------------------------------------------------

function CharacterMomentView({
  styles, colors, characters, equippedCharacter, equipCharacter, purchaseCharacter,
  claimStarterCharacter, refreshCharacterCache, onDone,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!characters || characters.length === 0) {
      refreshCharacterCache?.(false);
    }
  }, []);

  // Build the roster: equipped = "Yours", free (price 0) = selectable,
  // everything else = locked shop item.
  const roster = useMemo(() => {
    const list = [...(characters || [])].sort((a, b) => (a.price || 0) - (b.price || 0));
    // Guarantee the equipped character is shown even if it's not in the list.
    if (equippedCharacter && !list.some((c) => c.id === equippedCharacter.id)) {
      list.unshift(equippedCharacter);
    }
    return list.map((c) => {
      const equipped = equippedCharacter && c.id === equippedCharacter.id;
      const free = !equipped && (c.is_owned || (c.price || 0) === 0);
      return {
        ...c,
        _state: equipped ? 'equipped' : free ? 'free' : 'shop',
      };
    });
  }, [characters, equippedCharacter]);

  async function choose() {
    if (busy) return;
    if (!selectedId) { onDone(); return; }
    const c = roster.find((x) => x.id === selectedId);
    if (!c || c._state === 'shop') { onDone(); return; }
    setBusy(true);
    try {
      if (!c.is_owned && (c.price || 0) === 0) {
        try { await purchaseCharacter(c.id); } catch (e) { await claimStarterCharacter?.(); }
      }
      await equipCharacter(c.id);
    } catch (e) {
      try { await claimStarterCharacter?.(); } catch (e2) { /* ignore */ }
    } finally {
      setBusy(false);
      onDone();
    }
  }

  return (
    <View style={styles.flexFill}>
      <View style={styles.charHeader}>
        <Text style={styles.bigTitleLeft}>Pick a starter character</Text>
        <Text style={styles.screenSub}>One is free and yours to keep. Nothing here costs your Bot Bucks.</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 12 }} showsVerticalScrollIndicator={false}>
        {roster.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
        {roster.map((c) => {
          const isSel = selectedId === c.id;
          const locked = c._state === 'shop';
          const selectable = c._state === 'free';
          return (
            <Bouncy
              key={c.id}
              disabled={!selectable}
              style={[styles.charCard, isSel && styles.charCardSel, locked && { opacity: 0.6 }]}
              onPress={() => selectable && setSelectedId(c.id)}
            >
              <View style={styles.charAvatar}>
                <BrandAvatar character={c} size={60} logoSize={34} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.charNameRow}>
                  <Text style={styles.charName}>{c.name}</Text>
                  {c._state === 'equipped' && <View style={[styles.tag, { backgroundColor: 'rgba(61,220,95,0.18)' }]}><Text style={[styles.tagText, { color: colors.primary }]}>Yours</Text></View>}
                  {c._state === 'free' && <View style={[styles.tag, { backgroundColor: 'rgba(61,220,95,0.18)' }]}><Text style={[styles.tagText, { color: colors.primary }]}>Free</Text></View>}
                  {c._state === 'shop' && <View style={[styles.tag, { backgroundColor: 'rgba(245,183,43,0.18)' }]}><Text style={[styles.tagText, { color: colors.botBucks }]}>In the shop · {c.price}</Text></View>}
                </View>
                <Text style={styles.charDesc} numberOfLines={2}>
                  {c.description || (c._state === 'shop' ? 'Unlock later with Bot Bucks you earn.' : 'A friendly starter build.')}
                </Text>
              </View>
              {selectable && (
                <View style={[styles.selectRadio, isSel && styles.selectRadioSel]}>
                  {isSel && <Ionicons name="checkmark" size={15} color="#08120B" />}
                </View>
              )}
            </Bouncy>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryCTA
          styles={styles}
          label={busy ? 'Saving…' : 'Choose a character'}
          icon={busy ? null : 'checkmark'}
          onPress={choose}
          disabled={busy || !selectedId}
        />
        <TouchableOpacity style={styles.linkBtn} activeOpacity={0.7} onPress={onDone} disabled={busy}>
          <Text style={styles.linkText}>Keep {equippedCharacter?.name || 'MoneyBot'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 8. Save progress (account creation) — only for guests
// ---------------------------------------------------------------------------

function SaveProgressView({ styles, colors, isGuest, firstName, streakDays, botBucks, character, navigation, onDone }) {
  const anim = useEnter([]);
  const { appleSignIn } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  // Full accounts already have their progress saved — skip straight through.
  useEffect(() => {
    if (!isGuest) onDone();
  }, [isGuest]);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    }
  }, []);

  const handleApple = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      await appleSignIn({
        identityToken: credential.identityToken,
        email: credential.email,
        fullName: credential.fullName,
      });
      onDone();
    } catch (e) {
      if (e?.code !== 'ERR_REQUEST_CANCELED' && e?.code !== 'ERR_CANCELED') {
        Alert.alert('Sign in failed', 'Could not sign in with Apple. You can keep going as a guest.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, appleSignIn, onDone]);

  if (!isGuest) {
    return (
      <View style={[styles.flexFill, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const rows = [
    { icon: 'school', color: colors.primary, label: 'Lesson 1 complete', value: 'Section 1' },
    { icon: 'flame', color: colors.streak, label: 'Day streak', value: `${streakDays} day${streakDays === 1 ? '' : 's'}` },
    { icon: 'logo-bitcoin', color: colors.botBucks, label: 'Bot Bucks', value: String(botBucks || 0) },
    { icon: 'happy', color: colors.primary, label: 'Your character', value: character?.name || 'MoneyBot' },
  ];

  return (
    <View style={styles.flexFill}>
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: anim }}>
          <Text style={styles.bigTitleLeft}>Save what you just earned</Text>
          <Text style={styles.screenSub}>An account keeps your progress if you switch phones.</Text>

          <View style={styles.summaryCard}>
            {rows.map((r, i) => (
              <View key={r.label} style={[styles.summaryRow, i < rows.length - 1 && styles.summaryDivider]}>
                <View style={[styles.summaryIcon, { backgroundColor: `${r.color}22` }]}>
                  <Ionicons name={r.icon} size={18} color={r.color} />
                </View>
                <Text style={styles.summaryLabel}>{r.label}</Text>
                <Text style={styles.summaryValue}>{r.value}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        {appleAvailable && (
          <TouchableOpacity style={styles.appleBtn} activeOpacity={0.85} onPress={handleApple} disabled={busy}>
            <Ionicons name="logo-apple" size={20} color="#000" />
            <Text style={styles.appleBtnText}>Continue with Apple</Text>
          </TouchableOpacity>
        )}
        <PrimaryCTA styles={styles} label="Sign up with email" icon="mail" onPress={() => navigation.navigate('AuthUpgrade', { mode: 'register', lockMode: true })} disabled={busy} />
        <TouchableOpacity style={styles.linkBtn} activeOpacity={0.7} onPress={onDone} disabled={busy}>
          <Text style={styles.linkText}>Continue as guest</Text>
        </TouchableOpacity>
        <Text style={styles.finePrint}>As a guest, everything stays on this device only.</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 9. Reminder (notifications opt-in)
// ---------------------------------------------------------------------------

const NOTIF_BENEFITS = [
  { icon: 'flame', tint: '#FF6B35', text: 'A nudge before your streak breaks at midnight.' },
  { icon: 'logo-bitcoin', tint: '#F5B72B', text: "Reminders so you don't miss free Bot Bucks." },
  { icon: 'trophy', tint: '#A66BFF', text: 'Heads up when new lessons and challenges drop.' },
];

function ReminderView({ styles, colors, firstName, streakDays, onDone }) {
  const anim = useEnter([]);
  const bell = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(bell, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(bell, { toValue: -1, duration: 120, useNativeDriver: true }),
        Animated.timing(bell, { toValue: 0.6, duration: 100, useNativeDriver: true }),
        Animated.timing(bell, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]),
    ).start();
  }, [bell]);

  const handleAllow = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!areNotificationsSupported()) { onDone(); return; }
      const info = await getNotificationPermissionInfo();
      const saveAndSync = async () => {
        const prefs = await loadNotificationPrefs();
        const next = { ...prefs, daily: true, streak: true };
        await saveNotificationPrefs(next);
        await syncNotificationSchedule(next, {
          firstName, streakDays, activeToday: true,
        });
      };
      if (info.status === 'granted') { await saveAndSync(); onDone(); return; }
      if (info.status === 'denied' || !info.canAskAgain) {
        Alert.alert(
          'Turn on in Settings',
          'Notifications are off for MoneyBot. iOS only asks once, so open Settings to switch them on. You can keep going either way.',
          [
            { text: 'Not now', style: 'cancel', onPress: onDone },
            { text: 'Open Settings', onPress: () => { Linking.openSettings(); onDone(); } },
          ],
        );
        return;
      }
      await saveAndSync();
      onDone();
    } catch (e) {
      onDone();
    } finally {
      setBusy(false);
    }
  }, [busy, firstName, streakDays, onDone]);

  const bellRotate = bell.interpolate({ inputRange: [-1, 1], outputRange: ['-16deg', '16deg'] });

  return (
    <View style={styles.flexFill}>
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ alignItems: 'center', opacity: anim }}>
          <View style={styles.notifBadge}>
            <Animated.View style={{ transform: [{ rotate: bellRotate }] }}>
              <Ionicons name="notifications" size={46} color={colors.primary} />
            </Animated.View>
          </View>
          <Text style={styles.kicker}>STAY ON TRACK</Text>
          <Text style={styles.bigTitle}>{firstName ? `Keep it going, ${firstName}` : 'Keep it going'}</Text>
          <Text style={styles.bodyText}>Turn on reminders so we can protect your streak and nudge you before you lose progress.</Text>
        </Animated.View>

        <View style={{ gap: 12, marginTop: 26 }}>
          {NOTIF_BENEFITS.map((b) => (
            <View key={b.icon} style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: `${b.tint}22` }]}>
                <Ionicons name={b.icon} size={20} color={b.tint} />
              </View>
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryCTA styles={styles} label={busy ? 'One sec…' : 'Turn on reminders'} icon={busy ? null : 'notifications'} onPress={handleAllow} disabled={busy} />
        <TouchableOpacity style={styles.linkBtn} activeOpacity={0.7} onPress={onDone} disabled={busy}>
          <Text style={styles.linkText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 10. Learning path (final)
// ---------------------------------------------------------------------------

function LearningPathView({ styles, colors, modules, onFinish }) {
  const anim = useEnter([]);
  const [busy, setBusy] = useState(false);

  // Show the first module's lessons as the path ahead; lesson 1 is done.
  const firstModule = (modules || [])[0];
  const lessons = (firstModule?.lessons || []).slice(0, 4);
  const fallback = [
    { id: 'l1', title: 'Plan your spending' },
    { id: 'l2', title: 'Track where it goes' },
    { id: 'l3', title: 'Save on autopilot' },
    { id: 'l4', title: 'Smart with credit' },
  ];
  const path = lessons.length ? lessons : fallback;

  async function finish() {
    if (busy) return;
    setBusy(true);
    await onFinish();
  }

  return (
    <View style={styles.flexFill}>
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: anim }}>
          <View style={{ alignItems: 'center' }}>
            <MascotGif source={GIF_CELEBRATE} size={130} colors={colors} />
          </View>
          <Text style={styles.bigTitle}>Your learning path</Text>
          <Text style={styles.bodyText}>{firstModule?.title || 'Budgeting Basics'} is up first. Here's what's ahead.</Text>

          <View style={{ marginTop: 22, gap: 10 }}>
            {path.map((l, i) => {
              const done = i === 0;
              return (
                <View key={l.id} style={styles.pathRow}>
                  <View style={[styles.pathNode, done && styles.pathNodeDone, i === 1 && styles.pathNodeNext]}>
                    {done
                      ? <Ionicons name="checkmark" size={16} color="#08120B" />
                      : <Text style={styles.pathNum}>{i + 1}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pathTitle, done && { color: colors.textMuted }]}>{l.title}</Text>
                    <Text style={styles.pathMeta}>{done ? 'Completed' : i === 1 ? 'Up next' : 'Locked'}</Text>
                  </View>
                  {!done && i !== 1 && <Ionicons name="lock-closed" size={16} color={colors.textMuted} />}
                </View>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryCTA styles={styles} label={busy ? 'Setting up…' : 'Start learning'} icon={busy ? null : 'arrow-forward'} onPress={finish} disabled={busy} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const makeStyles = (colors, bottomInset = 16) => {
  const footerPad = Math.max(bottomInset, 16);
  return StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    flexFill: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center' },

    // Top bar / progress
    topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 48, gap: 8 },
    backBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
    progressTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 5, backgroundColor: colors.primary },

    // Generic layout
    centerWrap: { flex: 1, justifyContent: 'space-between' },
    centerScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingTop: 8 },
    scrollBody: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, flexGrow: 1 },
    footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: footerPad, gap: 10 },

    kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: colors.primary, marginTop: 20, marginBottom: 6 },

    // Welcome layout
    welcomeWrap: { flex: 1 },
    welcomeScroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20 },

    // Duolingo-style speech bubble. Greeting types out; tail points DOWN at
    // MoneyBot below. Two stacked triangles = a crisp outlined tail (border
    // triangle behind, slightly smaller fill triangle in front).
    speechBubble: {
      alignSelf: 'stretch',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: 20,
      paddingHorizontal: 22,
      minHeight: 108,
      justifyContent: 'center',
    },
    speechText: { fontSize: 21, fontWeight: '800', color: colors.white, lineHeight: 29, letterSpacing: -0.3 },
    speechTailDownWrap: { alignSelf: 'center', marginTop: -1, height: 15, width: 28, zIndex: 2 },
    speechTailDownBorder: {
      position: 'absolute', top: 0, alignSelf: 'center', width: 0, height: 0,
      borderLeftWidth: 13, borderRightWidth: 13, borderTopWidth: 15,
      borderLeftColor: 'transparent', borderRightColor: 'transparent',
      borderTopColor: colors.border,
    },
    speechTailDownFill: {
      position: 'absolute', top: 0, alignSelf: 'center', width: 0, height: 0,
      borderLeftWidth: 11, borderRightWidth: 11, borderTopWidth: 12,
      borderLeftColor: 'transparent', borderRightColor: 'transparent',
      borderTopColor: colors.surfaceElevated,
    },

    // Coach intro (mascot + label beside it)
    coachIntroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 },
    coachIntroText: { alignItems: 'flex-start' },
    kickerLeft: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: colors.primary, marginBottom: 2 },
    coachName: { fontSize: 26, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },

    // Promises
    promiseList: { gap: 14, marginTop: 24, paddingHorizontal: 4 },
    promiseRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    promiseIcon: {
      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(61,220,95,0.14)',
    },
    promiseText: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.white },
    bigTitle: { fontSize: 30, fontWeight: '900', color: colors.white, letterSpacing: -0.6, textAlign: 'center', marginBottom: 12 },
    bigTitleLeft: { fontSize: 27, fontWeight: '900', color: colors.white, letterSpacing: -0.5, marginBottom: 8 },
    bodyText: { fontSize: 15, fontWeight: '500', color: colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 },
    screenTitle: { fontSize: 25, fontWeight: '900', color: colors.white, letterSpacing: -0.5, marginTop: 20, marginBottom: 4 },
    screenSub: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, lineHeight: 20, marginTop: 4 },

    ctaInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    ctaText: { fontSize: 17, fontWeight: '800', color: '#08120B' },
    linkBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20, minHeight: 44, justifyContent: 'center' },
    linkText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
    finePrint: { fontSize: 12, fontWeight: '500', color: colors.textMuted, textAlign: 'center', lineHeight: 17, marginTop: 4 },

    // Coach bubble
    coachRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8 },
    coachAvatarRing: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', borderWidth: 2, borderColor: colors.primaryTintStrong, backgroundColor: colors.surfaceElevated },
    coachAvatar: { width: '100%', height: '100%' },
    coachBubble: { flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 18, borderTopLeftRadius: 6, padding: 14, borderWidth: 1, borderColor: colors.border },
    coachText: { fontSize: 15, fontWeight: '600', color: colors.white, lineHeight: 21 },

    // Select rows
    selectRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surfaceElevated, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: colors.border, minHeight: 66 },
    selectRowSel: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.10)' },
    selectIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
    selectIconSel: { backgroundColor: colors.primary },
    selectTitle: { fontSize: 16, fontWeight: '800', color: colors.white },
    selectTitleSel: { color: colors.white },
    selectBlurb: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 2 },
    selectRadio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
    selectRadioSel: { backgroundColor: colors.primary, borderColor: colors.primary },

    // Lesson intro
    sectionPill: { backgroundColor: 'rgba(61,220,95,0.14)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 10 },
    sectionPillText: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: colors.primary },
    noteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
    noteText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },

    // Lesson chrome
    lessonHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 48, gap: 10 },
    lessonSegs: { flex: 1, flexDirection: 'row', gap: 5 },
    lessonSeg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },
    lessonSegFill: { flex: 1, borderRadius: 4 },
    lessonCount: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, width: 34, textAlign: 'right' },
    lessonBody: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
    lessonScroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, flexGrow: 1 },
    lessonKicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: colors.textMuted, marginTop: 8 },
    lessonTitle: { fontSize: 23, fontWeight: '900', color: colors.white, letterSpacing: -0.4, marginTop: 6, marginBottom: 12, lineHeight: 29 },
    lessonPara: { fontSize: 15, fontWeight: '500', color: colors.offWhite, lineHeight: 22, marginBottom: 14 },
    bold: { fontWeight: '900', color: colors.white },
    pointRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pointMascot: { width: 34, height: 34 },

    // Teaching bucket card
    teachCard: { backgroundColor: colors.surfaceElevated, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border, gap: 16, marginBottom: 16 },
    bucketRow: { gap: 8 },
    bucketHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    bucketLabel: { fontSize: 15, fontWeight: '800', color: colors.white },
    bucketPct: { fontSize: 15, fontWeight: '900' },
    bucketTrack: { height: 10, borderRadius: 5, backgroundColor: colors.surface, overflow: 'hidden' },
    bucketFill: { height: '100%', borderRadius: 5 },

    // Visual choice
    planRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    planCard: { flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 12, borderWidth: 1.5, borderColor: colors.border, gap: 8 },
    planCardSel: { borderColor: colors.primary },
    planCardRight: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.10)' },
    planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    planName: { fontSize: 14, fontWeight: '800', color: colors.white },
    planLegend: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textAlign: 'center', marginTop: 16 },
    miniRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    miniLetter: { fontSize: 11, fontWeight: '800', color: colors.textMuted, width: 12 },
    miniTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' },
    miniFill: { height: '100%', borderRadius: 4, minWidth: 2 },

    // Feedback banner
    feedback: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, borderWidth: 1.5, padding: 14 },
    feedbackTitle: { fontSize: 16, fontWeight: '900' },
    feedbackBody: { fontSize: 13, fontWeight: '500', color: colors.offWhite, lineHeight: 19, marginTop: 3 },
    helperCenter: { fontSize: 14, fontWeight: '600', color: colors.textMuted, textAlign: 'center', paddingVertical: 16 },

    // Tap to match
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, marginBottom: 18 },
    matchChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceElevated, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1.5, borderColor: colors.border },
    matchChipActive: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.12)' },
    matchChipDone: { borderColor: colors.border, backgroundColor: colors.surface },
    matchChipText: { fontSize: 14, fontWeight: '700', color: colors.white },
    bucketDrop: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 16, borderWidth: 1.5, minHeight: 60 },
    bucketDot: { width: 14, height: 14, borderRadius: 7 },
    bucketDropLabel: { fontSize: 15, fontWeight: '800', color: colors.white },
    bucketDropItems: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },

    // Word bank
    sentenceCard: { backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border, marginTop: 16 },
    sentenceText: { fontSize: 17, fontWeight: '600', color: colors.white, lineHeight: 30 },
    blankChip: { fontWeight: '900', color: colors.textMuted, backgroundColor: colors.surface, borderRadius: 6, overflow: 'hidden' },
    blankChipFilled: { color: colors.primary },
    wordChip: { backgroundColor: colors.surfaceElevated, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1.5, borderColor: colors.border },
    wordChipSel: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.12)' },
    wordChipText: { fontSize: 15, fontWeight: '800', color: colors.white },
    wordChipTextSel: { color: colors.primary },

    // Application
    applyOption: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: colors.border },
    applyOptionSel: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.10)' },
    applyOptionRight: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.14)' },
    applyText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.offWhite, lineHeight: 21 },

    // Lesson complete
    xpBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(61,220,95,0.10)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(61,220,95,0.3)', paddingVertical: 22, paddingHorizontal: 28, marginTop: 18, marginBottom: 16 },
    xpValue: { fontSize: 40, fontWeight: '900', color: colors.primary, letterSpacing: -1 },
    xpLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: colors.primary },
    rewardRow: { flexDirection: 'row', gap: 14 },
    rewardTile: { flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 18, paddingVertical: 18, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border },
    rewardTileValue: { fontSize: 26, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
    rewardTileLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },

    // Streak commit
    streakBadge: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.streak, marginTop: 12, marginBottom: 4, shadowColor: colors.streak, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
    streakRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surfaceElevated, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 16, borderWidth: 1.5, borderColor: colors.border },
    streakRowSel: { borderColor: colors.streak, backgroundColor: 'rgba(255,107,53,0.10)' },
    streakLabel: { fontSize: 16, fontWeight: '800', color: colors.white },
    streakBlurb: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 2 },
    streakDays: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
    streakRadio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    streakRadioSel: { backgroundColor: colors.streak, borderColor: colors.streak },

    // Character moment
    charHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 },
    charCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surfaceElevated, borderRadius: 18, padding: 14, borderWidth: 1.5, borderColor: colors.border },
    charCardSel: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.08)' },
    charAvatar: { width: 60, height: 60 },
    charNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    charName: { fontSize: 16, fontWeight: '800', color: colors.white },
    charDesc: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 3, lineHeight: 18 },
    tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    tagText: { fontSize: 11, fontWeight: '800' },

    // Save progress
    summaryCard: { backgroundColor: colors.surfaceElevated, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, marginTop: 22 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 },
    summaryDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    summaryIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    summaryLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.white },
    summaryValue: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
    appleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 18, height: 56 },
    appleBtnText: { fontSize: 17, fontWeight: '800', color: '#000' },

    // Reminder
    notifBadge: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(61,220,95,0.12)', borderWidth: 1, borderColor: 'rgba(61,220,95,0.3)', marginTop: 12, marginBottom: 4 },
    benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
    benefitIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    benefitText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.offWhite, lineHeight: 20 },

    // Learning path
    pathRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border },
    pathNode: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
    pathNodeDone: { backgroundColor: colors.primary, borderColor: colors.primary },
    pathNodeNext: { borderColor: colors.primary },
    pathNum: { fontSize: 14, fontWeight: '800', color: colors.textSecondary },
    pathTitle: { fontSize: 15, fontWeight: '800', color: colors.white },
    pathMeta: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  });
};
