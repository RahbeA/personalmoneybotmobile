import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { CELEBRATIONS } from '../../constants/brandCopy';
import BrandAvatar from './BrandAvatar';

export default function BrandFeedback({ visible, correct, character }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, correct), [colors, correct]);
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      return undefined;
    }

    scale.setValue(0.6);
    rotate.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: correct ? 70 : 50,
        friction: correct ? 7 : 5,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ...(correct ? [] : [
        Animated.sequence([
          Animated.timing(rotate, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: -1, duration: 80, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 0, duration: 80, useNativeDriver: true }),
        ]),
      ]),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }, 900);

    return () => clearTimeout(timer);
  }, [visible, correct, scale, opacity, rotate]);

  if (!visible) return null;

  const rotateDeg = rotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-8deg', '0deg', '8deg'],
  });

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none">
      <Animated.View style={{ transform: [{ scale }, { rotate: rotateDeg }] }}>
        <BrandAvatar character={character} size={72} logoSize={48} />
      </Animated.View>
      <Text style={styles.message}>
        {correct ? CELEBRATIONS.correctAnswer : CELEBRATIONS.wrongAnswer}
      </Text>
    </Animated.View>
  );
}

const makeStyles = (colors, correct) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    backgroundColor: correct ? 'rgba(61,220,95,0.08)' : 'rgba(255,77,77,0.08)',
  },
  message: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: '800',
    color: correct ? colors.primary : colors.error,
  },
});
