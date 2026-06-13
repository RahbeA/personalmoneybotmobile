import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import BrandLogo from './BrandLogo';

export default function BrandToast({ visible, message, onHide, duration = 3200 }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return undefined;

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) onHide?.();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [visible, duration, onHide, translateY, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.wrap, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.toast}>
        <BrandLogo size="xs" />
        <Ionicons name="flame" size={18} color={colors.streak} />
        <Text style={styles.text} numberOfLines={2}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
});
