import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useUserProgress } from '../../context/UserProgressContext';
import { useTheme } from '../../context/ThemeContext';
import GameHUD from '../shared/GameHUD';
import GameOverModal from '../shared/GameOverModal';
import {
  ROUND_SECONDS, CREDIT_LIMIT, SAFE_THRESHOLD, SAFE_TICK_POINTS,
  makeCharge, utilization, isSafe, applyCharge, applyPayment,
  chargeIntervalForElapsed,
} from './engine';

const TIP = 'Credit utilization is how much of your limit you use. Keeping it under 30% protects your credit score.';
const SAFE_COLOR = '#42CF5A';
const WARN_COLOR = '#FB8C3C';
const DANGER_COLOR = '#FF6B6B';

function zoneColor(util) {
  if (util <= SAFE_THRESHOLD) return SAFE_COLOR;
  if (util <= 0.7) return WARN_COLOR;
  return DANGER_COLOR;
}

export default function CreditClimbScreen({ navigation, route }) {
  const { sessionId: initialSessionId, gameKey = 'credit_climb' } = route.params;
  const { finishArcadeGame, startArcadeGame } = useUserProgress();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [sessionId, setSessionId] = useState(initialSessionId);
  const [balance, setBalance] = useState(0);
  const [score, setScore] = useState(0);
  const [safeSeconds, setSafeSeconds] = useState(0);
  const [charges, setCharges] = useState(0);
  const [lastCharge, setLastCharge] = useState(null);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState(null);
  const [restarting, setRestarting] = useState(false);

  const balanceRef = useRef(0);
  const scoreRef = useRef(0);
  const safeSecondsRef = useRef(0);
  const chargesRef = useRef(0);
  const finishedRef = useRef(false);
  const mountedRef = useRef(true);
  const startAtRef = useRef(Date.now());
  const timerRef = useRef(null);
  const chargeTimeoutRef = useRef(null);

  const barAnim = useRef(new Animated.Value(0)).current;
  const chargeFlash = useRef(new Animated.Value(0)).current;

  const animateBar = useCallback((util) => {
    Animated.timing(barAnim, {
      toValue: util,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [barAnim]);

  const finishGame = useCallback(async (finalScore) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(timerRef.current);
    clearTimeout(chargeTimeoutRef.current);
    const res = await finishArcadeGame(gameKey, sessionId, finalScore);
    if (!mountedRef.current) return;
    setResult({
      score: finalScore,
      xpEarned: res?.xp_earned || 0,
      botBucksEarned: res?.bot_bucks_earned || 0,
      isBest: res?.is_best || false,
      safeSeconds: safeSecondsRef.current,
      charges: chargesRef.current,
    });
    setGameOver(true);
  }, [finishArcadeGame, gameKey, sessionId]);

  const scheduleCharge = useCallback(() => {
    if (finishedRef.current) return;
    const elapsed = (Date.now() - startAtRef.current) / 1000;
    const interval = chargeIntervalForElapsed(elapsed);
    chargeTimeoutRef.current = setTimeout(() => {
      const charge = makeCharge();
      balanceRef.current = applyCharge(balanceRef.current, charge.amount);
      chargesRef.current += 1;
      setBalance(balanceRef.current);
      setCharges(chargesRef.current);
      setLastCharge(charge);
      animateBar(utilization(balanceRef.current));
      chargeFlash.setValue(1);
      Animated.timing(chargeFlash, { toValue: 0, duration: 600, useNativeDriver: true }).start();
      scheduleCharge();
    }, interval);
  }, [animateBar, chargeFlash]);

  const startRound = useCallback(() => {
    startAtRef.current = Date.now();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      // Reward keeping utilization in the safe zone each second.
      if (isSafe(balanceRef.current)) {
        scoreRef.current += SAFE_TICK_POINTS;
        safeSecondsRef.current += 1;
        setScore(scoreRef.current);
        setSafeSeconds(safeSecondsRef.current);
      }
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    scheduleCharge();
  }, [scheduleCharge]);

  useEffect(() => {
    mountedRef.current = true;
    startRound();
    return () => {
      mountedRef.current = false;
      clearInterval(timerRef.current);
      clearTimeout(chargeTimeoutRef.current);
    };
  }, [startRound]);

  useEffect(() => {
    if (timeLeft === 0 && !finishedRef.current) {
      finishGame(scoreRef.current);
    }
  }, [timeLeft, finishGame]);

  function makePayment() {
    if (finishedRef.current) return;
    balanceRef.current = applyPayment(balanceRef.current);
    setBalance(balanceRef.current);
    animateBar(utilization(balanceRef.current));
  }

  function confirmQuit() {
    Alert.alert(
      'Quit game?',
      'Your progress will be saved with your current score.',
      [
        { text: 'Keep playing', style: 'cancel' },
        { text: 'Quit', style: 'destructive', onPress: () => finishGame(scoreRef.current) },
      ],
    );
  }

  async function handlePlayAgain() {
    setRestarting(true);
    try {
      const start = await startArcadeGame(gameKey);
      finishedRef.current = false;
      balanceRef.current = 0;
      scoreRef.current = 0;
      safeSecondsRef.current = 0;
      chargesRef.current = 0;
      setSessionId(start.session_id);
      setBalance(0);
      setScore(0);
      setSafeSeconds(0);
      setCharges(0);
      setLastCharge(null);
      setTimeLeft(ROUND_SECONDS);
      setGameOver(false);
      setResult(null);
      barAnim.setValue(0);
      startRound();
    } catch (e) {
      Alert.alert('Cannot play', e.message || 'Not enough Bot Bucks.');
    } finally {
      setRestarting(false);
    }
  }

  const util = utilization(balance);
  const utilPct = Math.round(util * 100);
  const currentZone = zoneColor(util);
  const safe = util <= SAFE_THRESHOLD;

  const barWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <GameHUD
          score={score}
          timeLeft={timeLeft}
          combo={0}
          onQuit={confirmQuit}
          colors={colors}
        />

        <View style={styles.instructions}>
          <Text style={styles.instructionsText}>Keep utilization under 30%</Text>
          <Text style={styles.instructionsSub}>Pay down charges to stay in the green</Text>
        </View>

        <View style={styles.gaugeCard}>
          <View style={styles.utilRow}>
            <Text style={[styles.utilPct, { color: currentZone }]}>{utilPct}%</Text>
            <View style={[styles.zoneBadge, { backgroundColor: `${currentZone}22` }]}>
              <Ionicons
                name={safe ? 'shield-checkmark' : 'warning'}
                size={14}
                color={currentZone}
              />
              <Text style={[styles.zoneText, { color: currentZone }]}>
                {safe ? 'Safe zone' : 'Too high!'}
              </Text>
            </View>
          </View>

          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFill, { width: barWidth, backgroundColor: currentZone }]} />
            {/* 30% safe-line marker */}
            <View style={[styles.safeLine, { left: `${SAFE_THRESHOLD * 100}%` }]} />
          </View>

          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={styles.balanceValue}>${balance} / ${CREDIT_LIMIT}</Text>
          </View>

          <Animated.View style={[styles.chargeToast, { opacity: chargeFlash }]}>
            {lastCharge && (
              <Text style={styles.chargeToastText}>
                {lastCharge.label} +${lastCharge.amount}
              </Text>
            )}
          </Animated.View>
        </View>

        <View style={styles.payWrap}>
          <TouchableOpacity
            style={styles.payBtn}
            activeOpacity={0.85}
            onPress={makePayment}
            disabled={gameOver}
          >
            <LinearGradient
              colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.payBtnGrad}
            >
              <Ionicons name="cash" size={26} color="#FFFFFF" />
              <Text style={styles.payBtnText}>Make Payment</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.payHint}>Tap fast when charges pile up</Text>
        </View>

        <GameOverModal
          visible={gameOver}
          score={result?.score ?? score}
          xpEarned={result?.xpEarned ?? 0}
          botBucksEarned={result?.botBucksEarned ?? 0}
          isBest={result?.isBest ?? false}
          tip={TIP}
          stats={[
            { icon: 'shield-checkmark', color: colors.primary, value: `${result?.safeSeconds ?? safeSeconds}s`, label: 'Safe' },
            { icon: 'card', color: WARN_COLOR, value: result?.charges ?? charges, label: 'Charges' },
          ]}
          onPlayAgain={handlePlayAgain}
          onExit={() => navigation.goBack()}
          loading={restarting}
          colors={colors}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  instructions: { alignItems: 'center', paddingHorizontal: 24, marginBottom: 20 },
  instructionsText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  instructionsSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  gaugeCard: {
    marginHorizontal: 20,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  utilRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  utilPct: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  zoneText: { fontSize: 13, fontWeight: '800' },
  barTrack: {
    height: 20,
    backgroundColor: colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 14,
  },
  barFill: {
    height: '100%',
    borderRadius: 10,
  },
  safeLine: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    width: 2,
    backgroundColor: colors.white,
    opacity: 0.6,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  balanceValue: { fontSize: 15, color: colors.white, fontWeight: '800' },
  chargeToast: {
    alignItems: 'center',
    marginTop: 14,
    minHeight: 20,
  },
  chargeToastText: {
    fontSize: 14,
    fontWeight: '700',
    color: DANGER_COLOR,
  },
  payWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  payBtn: { borderRadius: 20, overflow: 'hidden' },
  payBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 22,
  },
  payBtnText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  payHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
  },
});
