import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import PuckButton from '../components/PuckButton';
import { BRAND_NAME, LANDING } from '../constants/brandCopy';

// MoneyBot landing mascot (transparent hero art).
const MASCOT_GIF = require('../../assets/moneybot-landing-hero.png');
const BRAND_MARK = require('../../assets/logo.png');

// Keep the hero column readable on iPad / large screens instead of stretching
// edge-to-edge (which also made the absolute footer collide with Sign In).
const CONTENT_MAX_WIDTH = 420;

export default function LandingScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { guestSignIn } = useAuth();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [starting, setStarting] = useState(false);

  // "Get started" drops the user straight into onboarding — no auth up front.
  // A silent guest session backs their progress; they create a real account at
  // the end of onboarding (the Save-progress step).
  const handleGetStarted = async () => {
    if (starting) return;
    setStarting(true);
    try {
      await guestSignIn();
      // Root navigator swaps to the Onboarding screen once the session is set.
    } catch (e) {
      setStarting(false);
      Alert.alert(
        'Could not get started',
        'Something went wrong starting your session. Check your connection and try again.',
      );
    }
  };

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const mascotScale = useRef(new Animated.Value(0.8)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(mascotScale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Gentle idle float on the mascot.
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [5, -7] });

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        {/*
          Do NOT use position:absolute for the footer. On iPad (and tall
          phones) a centered CTA stack collides with an absolute bottom footer,
          which is exactly what App Review flagged: Sign In under Privacy Policy.
          Footer lives in normal layout flow under the hero column instead.
        */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { minHeight: Math.max(windowHeight - 80, 560) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Animated.View style={[styles.wordmarkRow, { opacity: fadeAnim }]}>
            <Image source={BRAND_MARK} style={styles.wordmarkLogo} resizeMode="contain" />
            <Text style={styles.wordmark}>{BRAND_NAME.toUpperCase()}</Text>
          </Animated.View>

          <View style={styles.hero}>
            <Animated.Image
              source={MASCOT_GIF}
              resizeMode="contain"
              style={[
                styles.mascot,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: mascotScale }, { translateY: floatY }],
                },
              ]}
            />

            <Animated.View
              style={[
                styles.taglineContainer,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <Text style={styles.tagline}>{LANDING.tagline}</Text>
              <Text style={styles.subTagline}>{LANDING.subTagline}</Text>
            </Animated.View>
          </View>

          <Animated.View style={[styles.buttonContainer, { opacity: buttonOpacity }]}>
            <PuckButton
              color={colors.primary}
              height={58}
              borderRadius={29}
              lip={5}
              onPress={handleGetStarted}
              disabled={starting}
              contentStyle={styles.buttonInner}
              accessibilityLabel="Get started"
            >
              {starting ? (
                <ActivityIndicator color="#08120B" />
              ) : (
                <Text style={styles.primaryButtonText}>Get started</Text>
              )}
            </PuckButton>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Auth', { mode: 'login', lockMode: true })}
              activeOpacity={0.8}
              disabled={starting}
              hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
            >
              <Text style={styles.secondaryButtonText}>
                I already have an account{' '}
                <Text style={styles.secondaryButtonAccent}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  wordmarkLogo: {
    width: 24,
    height: 24,
  },
  wordmark: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 4,
    color: colors.primary,
    textAlign: 'center',
  },
  hero: {
    flexGrow: 1,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascot: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  taglineContainer: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tagline: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.white,
    textAlign: 'center',
    letterSpacing: -0.6,
    lineHeight: 40,
    marginBottom: 12,
  },
  subTagline: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#08120B',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  secondaryButtonAccent: {
    color: colors.primary,
    fontWeight: '800',
  },
});
