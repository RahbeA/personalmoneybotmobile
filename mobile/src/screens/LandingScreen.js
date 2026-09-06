import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { BrandLogo } from '../components/brand';
import { LANDING } from '../constants/brandCopy';

// Keep the hero column readable on iPad / large screens instead of stretching
// edge-to-edge (which also made the absolute footer collide with Sign In).
const CONTENT_MAX_WIDTH = 420;

export default function LandingScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
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
  }, []);

  return (
    <LinearGradient
      colors={colors.bgGradient}
      style={styles.gradient}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        {/*
          Do NOT use position:absolute for the legal footer. On iPad (and tall
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
          <View style={[styles.hero, { paddingTop: windowHeight * 0.1 }]}>
            <View style={styles.contentColumn}>
              <Animated.View
                style={[
                  styles.logoContainer,
                  { opacity: fadeAnim, transform: [{ scale: logoScale }] },
                ]}
              >
                <BrandLogo size="hero" />
              </Animated.View>

              <Animated.View
                style={[
                  styles.taglineContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <Text style={styles.tagline}>{LANDING.tagline}</Text>
                <Text style={styles.subTagline}>
                  {LANDING.subTagline}
                </Text>
              </Animated.View>

              <Animated.View style={[styles.divider, { opacity: fadeAnim }]}>
                <View style={styles.dividerLine} />
                <View style={styles.dividerDot} />
                <View style={styles.dividerLine} />
              </Animated.View>

            </View>
          </View>

          <Animated.View style={[styles.buttonContainer, { opacity: buttonOpacity }]}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Auth', { mode: 'register' })}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Auth', { mode: 'login' })}
              activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
            >
              <Text style={styles.secondaryButtonText}>
                Already have an account?{' '}
                <Text style={styles.secondaryButtonAccent}>Sign In</Text>
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
    paddingHorizontal: 32,
    paddingTop: 12,
    paddingBottom: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hero: {
    flexGrow: 1,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingBottom: 24,
  },
  contentColumn: {
    width: '100%',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  taglineContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  tagline: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  subTagline: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    width: '80%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginHorizontal: 10,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignItems: 'center',
    gap: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  secondaryButtonAccent: {
    color: colors.primary,
    fontWeight: '600',
  },
});
