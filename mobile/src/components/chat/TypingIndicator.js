import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import BrandAvatar from '../brand/BrandAvatar';

function Dot({ delay, color }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 400, delay, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 400, easing: Easing.ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return <Animated.View style={[styles.dot, { backgroundColor: color, opacity, transform: [{ translateY }] }]} />;
}

export default function TypingIndicator({ character }) {
  const { colors } = useTheme();
  const styles2 = useMemo(() => makeStyles(colors), [colors]);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.row}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <BrandAvatar character={character} size={28} logoSize={18} />
      </Animated.View>
      <View style={styles2.bubble}>
        <Dot delay={0} color={colors.textSecondary} />
        <Dot delay={150} color={colors.textSecondary} />
        <Dot delay={300} color={colors.textSecondary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', marginVertical: 4, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, marginHorizontal: 3 },
});

const makeStyles = (colors) => StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
