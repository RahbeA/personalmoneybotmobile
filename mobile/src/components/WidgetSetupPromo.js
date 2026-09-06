import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Image, Animated, Easing, ScrollView, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PuckButton from './PuckButton';

const MASCOT = require('../../assets/widgets/mascot-happy.png');

// Real widget surface color (see src/widgets/source/StreakWidget.js) so the
// preview here matches what actually lands on the Home Screen.
const WIDGET_BG = '#0E1614';
const WIDGET_MUTED = '#9BA3A0';

const STEPS = [
  {
    title: 'Touch and hold your Home Screen',
    hint: 'Press an empty spot until the app icons start to jiggle.',
  },
  {
    title: 'Tap Edit, then Add Widget',
    hint: 'It sits in the top-left corner. On older iPhones, tap the + instead.',
  },
  {
    title: 'Search MoneyBot, then add it',
    hint: 'Pick Streak, Stats, or Daily Reward and tap Add Widget.',
  },
];

/** Looping 0 -> 1 -> 0 driver used for float / pulse / jiggle art. */
function useLoop(duration, { active = true, delay = 0 } = {}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      anim.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, anim, delay, duration]);
  return anim;
}

/** Small streak widget mock, scaled from a 132pt reference. */
function WidgetMock({ colors, size = 132 }) {
  const k = size / 132;
  return (
    <View
      style={[
        styles.widget,
        { width: size, height: size, borderRadius: 22 * k, padding: 11 * k },
      ]}
    >
      <View style={styles.widgetRow}>
        <Text style={{ fontSize: 30 * k, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1 }}>7</Text>
        <Ionicons name="flame" size={20 * k} color={colors.streak} />
      </View>
      <Text style={{ fontSize: 10 * k, fontWeight: '700', color: WIDGET_MUTED }}>day streak</Text>
      <Image source={MASCOT} style={{ width: 60 * k, height: 60 * k, marginTop: 'auto', alignSelf: 'center' }} resizeMode="contain" />
    </View>
  );
}

/** Placeholder app icon; jiggles when the Home Screen is in edit mode. */
function AppIcon({ size, jiggle, index }) {
  const rotate = jiggle
    ? jiggle.interpolate({
        inputRange: [0, 1],
        outputRange: index % 2 === 0 ? ['-1.6deg', '1.6deg'] : ['1.6deg', '-1.6deg'],
      })
    : '0deg';
  return (
    <Animated.View
      style={[
        styles.appIcon,
        { width: size, height: size, borderRadius: size * 0.28, transform: [{ rotate }] },
      ]}
    />
  );
}

/**
 * iPhone Home Screen mock. `overlay` draws the step-specific chrome on top
 * (fingertip, Edit pill, widget gallery, or the finished widget).
 */
function HomeScreenMock({ width = 178, jiggle, overlay, dimmed }) {
  const height = width * 1.5;
  const pad = width * 0.1;
  const iconSize = (width - pad * 2 - 12 * 3) / 4;
  return (
    <View style={[styles.phone, { width, height, borderRadius: width * 0.17 }]}>
      <LinearGradient
        colors={['rgba(22,48,34,0.55)', '#0B0F0D']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      />
      <View style={[styles.notchRow, { top: pad * 0.6 }]} pointerEvents="none">
        <View style={styles.notchPill} />
      </View>
      <View style={{ paddingHorizontal: pad, paddingTop: pad * 2.2, gap: 12, opacity: dimmed ? 0.4 : 1 }}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.iconRow}>
            {[0, 1, 2, 3].map((col) => (
              <AppIcon key={col} size={iconSize} jiggle={jiggle} index={row + col} />
            ))}
          </View>
        ))}
      </View>
      {overlay}
    </View>
  );
}

/** Step 1: a fingertip pressing an empty spot, with an expanding ripple. */
function PressRipple({ colors }) {
  const anim = useLoop(900);
  return (
    <View pointerEvents="none" style={styles.centerOverlay}>
      <Animated.View
        style={[
          styles.ripple,
          {
            borderColor: colors.primary,
            opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.finger,
          {
            backgroundColor: colors.primary,
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }) }],
          },
        ]}
      >
        <Ionicons name="hand-left" size={18} color={WIDGET_BG} />
      </Animated.View>
    </View>
  );
}

/** Step 2: pulsing Edit pill plus the Add Widget menu row it reveals. */
function EditMenuOverlay({ colors }) {
  const anim = useLoop(800);
  const glow = {
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.75] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
  };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.editAnchor}>
        <Animated.View style={[styles.editGlow, { backgroundColor: colors.primary }, glow]} />
        <View style={styles.editPill}>
          <Text style={styles.editPillText}>Edit</Text>
        </View>
      </View>
      <View style={styles.menuCard}>
        <View style={[styles.menuRow, { backgroundColor: colors.primary }]}>
          <Text style={[styles.menuRowText, { color: '#FFFFFF' }]}>Add Widget</Text>
          <Ionicons name="add" size={14} color="#FFFFFF" />
        </View>
        <View style={styles.menuDivider} />
        <View style={styles.menuRow}>
          <Text style={styles.menuRowText}>Customize</Text>
          <Ionicons name="options-outline" size={13} color={WIDGET_MUTED} />
        </View>
      </View>
    </View>
  );
}

/** Step 3: the widget gallery — search field, preview, Add Widget button. */
function GalleryOverlay({ colors }) {
  const anim = useLoop(850);
  return (
    <View pointerEvents="none" style={styles.gallerySheet}>
      <View style={styles.searchField}>
        <Ionicons name="search" size={12} color={WIDGET_MUTED} />
        <Text style={styles.searchText}>MoneyBot</Text>
      </View>
      <WidgetMock colors={colors} size={86} />
      <Animated.View
        style={[
          styles.addPill,
          {
            backgroundColor: colors.primary,
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
          },
        ]}
      >
        <Text style={styles.addPillText}>Add Widget</Text>
      </Animated.View>
    </View>
  );
}

function StepArt({ colors, step }) {
  const jiggle = useLoop(200, { active: step > 0 });
  if (step === 0) {
    return <HomeScreenMock width={166} overlay={<PressRipple colors={colors} />} />;
  }
  if (step === 1) {
    return <HomeScreenMock width={166} jiggle={jiggle} overlay={<EditMenuOverlay colors={colors} />} />;
  }
  return <HomeScreenMock width={166} jiggle={jiggle} dimmed overlay={<GalleryOverlay colors={colors} />} />;
}

/** Hero: the finished widget floating over a Home Screen, on a soft glow. */
function PromoHero({ colors }) {
  const float = useLoop(1800);
  const glow = useLoop(1400);
  return (
    <View style={styles.heroWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.heroGlow,
          {
            backgroundColor: colors.primary,
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.22] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] }) }],
          },
        ]}
      />
      <HomeScreenMock
        width={196}
        dimmed
        overlay={
          <Animated.View
            pointerEvents="none"
            style={[
              styles.centerOverlay,
              {
                transform: [
                  { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [5, -7] }) },
                  { rotate: '-3deg' },
                ],
              },
            ]}
          >
            <WidgetMock colors={colors} size={124} />
          </Animated.View>
        }
      />
    </View>
  );
}

/**
 * Duolingo-style "add the widget" prompt: one tappable promo, then three
 * illustrated steps the user can follow with their phone in hand.
 *
 * iOS only (widgets ship via WidgetKit) — callers should skip it elsewhere.
 */
export default function WidgetSetupPromo({ colors, onDone }) {
  const insets = useSafeAreaInsets();
  const styled = useMemo(() => makeStyles(colors, insets.bottom), [colors, insets.bottom]);
  const [step, setStep] = useState(-1); // -1 = promo, 0..2 = how-to steps
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }).start();
  }, [enter, step]);

  const isPromo = step < 0;
  const isLastStep = step === STEPS.length - 1;

  const next = useCallback(() => {
    if (isLastStep) onDone?.();
    else setStep((prev) => prev + 1);
  }, [isLastStep, onDone]);

  const entering = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  };

  return (
    <View style={styled.wrap}>
      <View style={styled.topBar}>
        {isPromo ? (
          <View style={styled.topSpacer} />
        ) : (
          <TouchableOpacity
            style={styled.backBtn}
            activeOpacity={0.7}
            onPress={() => setStep((prev) => prev - 1)}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        <View style={styled.dots}>
          {!isPromo && STEPS.map((s, i) => (
            <View
              key={s.title}
              style={[
                styled.dot,
                i <= step && { backgroundColor: colors.primary, width: i === step ? 20 : 8 },
              ]}
            />
          ))}
        </View>
        {isPromo ? (
          <View style={styled.topSpacer} />
        ) : (
          <TouchableOpacity style={styled.skipBtn} activeOpacity={0.7} onPress={onDone}>
            <Text style={styled.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styled.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View key={step} style={[styled.content, entering]}>
          {isPromo ? (
            <>
              <PromoHero colors={colors} />
              <Text style={styled.kicker}>HOME SCREEN</Text>
              <Text style={styled.title}>Add the MoneyBot widget</Text>
              <Text style={styled.sub}>
                Your streak, Bot Bucks, and daily reward sit right on your Home Screen — so you never
                miss a day.
              </Text>
            </>
          ) : (
            <>
              <StepArt colors={colors} step={step} />
              <Text style={styled.kicker}>{`STEP ${step + 1} OF ${STEPS.length}`}</Text>
              <Text style={styled.title}>{STEPS[step].title}</Text>
              <Text style={styled.sub}>{STEPS[step].hint}</Text>
            </>
          )}
        </Animated.View>
      </ScrollView>

      <View style={styled.footer}>
        <PuckButton
          color={colors.primary}
          height={56}
          borderRadius={18}
          lip={5}
          onPress={next}
          contentStyle={styled.ctaInner}
          accessibilityLabel={isPromo ? 'Show me how to add the widget' : 'Continue'}
        >
          <Text style={styled.ctaText}>
            {isPromo ? 'Show me how' : isLastStep ? 'I added it' : 'Next'}
          </Text>
          <Ionicons name={isLastStep ? 'checkmark' : 'arrow-forward'} size={18} color="#FFFFFF" />
        </PuckButton>
        {isPromo ? (
          <TouchableOpacity style={styled.laterBtn} activeOpacity={0.7} onPress={onDone}>
            <Text style={styled.laterText}>Maybe later</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styled.reassure}>Do it on your phone now — I&apos;ll wait right here.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  widget: {
    backgroundColor: WIDGET_BG,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  widgetRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  phone: {
    overflow: 'hidden',
    backgroundColor: '#0B0F0D',
    borderWidth: 3,
    borderColor: '#2B322E',
  },
  notchRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  notchPill: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  iconRow: { flexDirection: 'row', gap: 12 },
  appIcon: { backgroundColor: 'rgba(255,255,255,0.12)' },
  centerOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute', width: 74, height: 74, borderRadius: 37, borderWidth: 2 },
  finger: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  editAnchor: { position: 'absolute', top: 14, left: 14 },
  editGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 14 },
  editPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  editPillText: { fontSize: 11, fontWeight: '800', color: '#111' },
  menuCard: {
    position: 'absolute',
    top: 46,
    left: 14,
    width: 116,
    borderRadius: 12,
    backgroundColor: 'rgba(24,28,26,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  menuRowText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  menuDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  gallerySheet: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    alignItems: 'center',
    gap: 9,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(18,22,20,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'stretch',
    marginHorizontal: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  searchText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  addPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 },
  addPillText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  heroWrap: { alignItems: 'center', justifyContent: 'center' },
  heroGlow: { position: 'absolute', width: 250, height: 250, borderRadius: 125 },
});

const makeStyles = (colors, bottomInset = 16) => StyleSheet.create({
  wrap: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 4,
    height: 44,
  },
  topSpacer: { width: 44 },
  backBtn: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  skipBtn: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 12 },
  content: { alignItems: 'center' },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: colors.primary,
    marginTop: 26,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 10,
  },
  sub: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: Math.max(bottomInset, 12),
    gap: 10,
  },
  ctaInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  laterBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  laterText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  reassure: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    paddingBottom: 8,
  },
});
