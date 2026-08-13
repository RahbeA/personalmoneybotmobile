import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import BrandLogo from './BrandLogo';

const MIN_VISIBLE_MS = 2200;
const FADE_MS = 420;

function PlusPattern({ color }) {
  const rows = 14;
  const cols = 8;
  return (
    <View style={styles.plusLayer} pointerEvents="none">
      {Array.from({ length: rows }).map((_, row) => (
        <View key={row} style={styles.plusRow}>
          {Array.from({ length: cols }).map((__, col) => (
            <Text key={col} style={[styles.plusMark, { color }]}>+</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function WelcomeSplash({ firstName = '', character, ready = false, onDone }) {
  const { colors, isDark } = useTheme();
  const stylesThemed = useMemo(() => makeStyles(colors), [colors]);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.72)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(16)).current;
  const finishedRef = useRef(false);
  const shownAtRef = useRef(Date.now());

  const greetingName = (firstName || '').trim();
  const previewUrl = character?.preview_url;

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDone?.();
    });
  }

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1,
        tension: 64,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(textSlide, {
          toValue: 0,
          duration: 380,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [scale, textOpacity, textSlide]);

  useEffect(() => {
    if (!ready) return undefined;
    const elapsed = Date.now() - shownAtRef.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const timer = setTimeout(finish, wait);
    return () => clearTimeout(timer);
  }, [ready]);

  return (
    <Animated.View style={[stylesThemed.screen, { opacity }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <LinearGradient colors={colors.bgGradient} style={StyleSheet.absoluteFill} />
      <PlusPattern color={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} />

      <View style={stylesThemed.content}>
        <Animated.View style={{ transform: [{ scale }] }}>
          {previewUrl ? (
            <Image source={{ uri: previewUrl }} style={stylesThemed.dude} resizeMode="contain" />
          ) : (
            <BrandLogo size={168} />
          )}
        </Animated.View>

        <Animated.View
          style={[
            stylesThemed.copy,
            { opacity: textOpacity, transform: [{ translateY: textSlide }] },
          ]}
        >
          {greetingName ? (
            <Text style={stylesThemed.hey}>
              Hey, <Text style={stylesThemed.name}>{greetingName}!</Text>
            </Text>
          ) : (
            <Text style={stylesThemed.hey}>Welcome!!</Text>
          )}
          <Text style={stylesThemed.sub}>Let's get it!</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  plusLayer: {
    ...StyleSheet.absoluteFillObject,
    paddingVertical: 24,
  },
  plusRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  plusMark: {
    fontSize: 11,
    fontWeight: '700',
  },
});

const makeStyles = (colors) => StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  dude: {
    width: 168,
    height: 168,
  },
  copy: {
    marginTop: 28,
    alignItems: 'center',
  },
  hey: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  name: {
    color: colors.primary,
  },
  sub: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
