import React, { useEffect, useMemo, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, Animated, Easing, Pressable, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const COIN_COUNT = 14;
const GOLD = '#F5B72B';
const GOLD_LIGHT = '#FFD75E';
const ORANGE = '#FF6B35';
// Warm dim — lets Home peek through instead of a flat black wall.
const BACKDROP_MAX = 0.72;

export default function DailyClaimCelebration({ visible, amount = 0, onDone }) {
  const { width, height } = useWindowDimensions();

  const coins = useMemo(() => {
    return Array.from({ length: COIN_COUNT }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / COIN_COUNT + (Math.random() - 0.5) * 0.5;
      const distance = 110 + Math.random() * 130;
      return {
        key: i,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - 50,
        size: 16 + Math.random() * 14,
        delay: Math.random() * 120,
        spin: (Math.random() - 0.5) * 2,
      };
    });
  }, [visible]);

  const backdrop = useRef(new Animated.Value(0)).current;
  const coinPop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const amountAnim = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);

  useEffect(() => {
    if (!visible) return undefined;
    finished.current = false;
    backdrop.setValue(0);
    coinPop.setValue(0);
    burst.setValue(0);
    amountAnim.setValue(0);
    ring.setValue(0);

    const sequence = Animated.sequence([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(coinPop, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(ring, {
          toValue: 1,
          duration: 780,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(burst, {
          toValue: 1,
          duration: 1050,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(amountAnim, {
          toValue: 1,
          friction: 7,
          tension: 80,
          delay: 160,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(720),
    ]);

    sequence.start(({ finished: done }) => {
      if (done) close();
    });

    return () => sequence.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function close() {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(backdrop, {
      toValue: 0,
      duration: 280,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      onDone?.();
    });
  }

  if (!visible) return null;

  const centerX = width / 2;
  const centerY = height / 2;
  const backdropOpacity = backdrop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, BACKDROP_MAX],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.screen}>
        <Pressable style={styles.fill} onPress={close}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
          <Animated.View
            style={[styles.backdropWarm, { opacity: backdrop.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.35],
            }) }]}
          />

          <Animated.View
            style={[
              styles.glow,
              {
                left: centerX - 160,
                top: centerY - 160,
                opacity: backdrop.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                transform: [{
                  scale: coinPop.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.05] }),
                }],
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(245,183,43,0.5)', 'rgba(255,107,53,0.18)', 'rgba(255,107,53,0)']}
              style={styles.glowGrad}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.ring,
              {
                left: centerX - 70,
                top: centerY - 70,
                opacity: ring.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.65, 0.35, 0] }),
                transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 2.4] }) }],
              },
            ]}
          />

          {coins.map((c) => {
            const translateX = burst.interpolate({ inputRange: [0, 1], outputRange: [0, c.dx] });
            const translateY = burst.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, c.dy, c.dy + 70] });
            const opacity = burst.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 1, 0.85, 0] });
            const scale = burst.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.15, 1, 0.75] });
            const rotate = burst.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', `${c.spin * 480}deg`],
            });
            return (
              <Animated.View
                key={c.key}
                style={{
                  position: 'absolute',
                  left: centerX - c.size / 2,
                  top: centerY - c.size / 2,
                  opacity,
                  transform: [{ translateX }, { translateY }, { scale }, { rotate }],
                }}
              >
                <View style={[styles.miniCoin, { width: c.size, height: c.size, borderRadius: c.size / 2 }]}>
                  <Ionicons name="logo-bitcoin" size={c.size * 0.62} color="#7A4E00" />
                </View>
              </Animated.View>
            );
          })}

          <Animated.View
            style={[
              styles.heroWrap,
              {
                left: centerX - 55,
                top: centerY - 55,
                opacity: coinPop,
                transform: [
                  { scale: coinPop.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
                  {
                    rotate: coinPop.interpolate({ inputRange: [0, 1], outputRange: ['-22deg', '0deg'] }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient colors={[GOLD_LIGHT, GOLD]} style={styles.heroCoin}>
              <Ionicons name="logo-bitcoin" size={54} color="#7A4E00" />
            </LinearGradient>
          </Animated.View>

          <Animated.View
            style={[
              styles.amountWrap,
              {
                top: centerY + 80,
                opacity: amountAnim,
                transform: [
                  { scale: amountAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                  { translateY: amountAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                ],
              },
            ]}
          >
            <Text style={styles.amountText}>+{amount}</Text>
            <Text style={styles.amountLabel}>Bot Bucks claimed!</Text>
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fill: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 10, 18, 0.92)',
  },
  backdropWarm: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 120, 40, 0.12)',
  },
  glow: { position: 'absolute', width: 320, height: 320 },
  glowGrad: { flex: 1, borderRadius: 160 },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2.5,
    borderColor: ORANGE,
  },
  miniCoin: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
    borderWidth: 2,
    borderColor: GOLD_LIGHT,
  },
  heroWrap: { position: 'absolute', width: 110, height: 110 },
  heroCoin: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFE9A8',
    shadowColor: GOLD,
    shadowOpacity: 0.65,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  amountWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  amountText: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    textShadowColor: 'rgba(245,183,43,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  amountLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: GOLD_LIGHT,
    marginTop: 4,
    letterSpacing: 0.3,
  },
});
