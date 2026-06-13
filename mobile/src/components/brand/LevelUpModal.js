import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Modal, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { CELEBRATIONS } from '../../constants/brandCopy';
import BrandLogo from './BrandLogo';

export default function LevelUpModal({ visible, level, onDismiss }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(0.6)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return undefined;

    scale.setValue(0.6);
    fade.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      onDismiss?.();
    }, 2400);

    return () => clearTimeout(timer);
  }, [visible, level, onDismiss, scale, fade]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { opacity: fade, transform: [{ scale }] }]}>
          <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
            <View style={styles.glow} />
            <BrandLogo size="lg" />
            <Text style={styles.kicker}>{CELEBRATIONS.levelUp}</Text>
            <Text style={styles.level}>Level {level}</Text>
            <Text style={styles.sub}>Keep learning with MoneyBot</Text>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
  },
  gradient: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  glow: {
    position: 'absolute',
    top: 24,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primaryTintStrong,
  },
  kicker: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  level: {
    marginTop: 6,
    fontSize: 36,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },
  sub: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
