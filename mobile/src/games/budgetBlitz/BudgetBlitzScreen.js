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
import { BUCKETS, ROUND_SECONDS } from './expenses';
import {
  createInitialState, scoreAnswer, advanceState,
} from './engine';

export default function BudgetBlitzScreen({ navigation, route }) {
  const { sessionId: initialSessionId, gameKey = 'budget_blitz' } = route.params;
  const { finishArcadeGame, startArcadeGame } = useUserProgress();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [sessionId, setSessionId] = useState(initialSessionId);
  const [gameState, setGameState] = useState(createInitialState);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [feedback, setFeedback] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState(null);
  const [restarting, setRestarting] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const cardAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const finishedRef = useRef(false);

  const finishGame = useCallback(async (finalScore, correctCount, wrongCount) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinishing(true);
    const res = await finishArcadeGame(gameKey, sessionId, finalScore);
    setResult({
      score: finalScore,
      xpEarned: res?.xp_earned || 0,
      botBucksEarned: res?.bot_bucks_earned || 0,
      isBest: res?.is_best || false,
      correctCount,
      wrongCount,
    });
    setGameOver(true);
    setFinishing(false);
  }, [finishArcadeGame, gameKey, sessionId]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (timeLeft === 0 && !finishedRef.current) {
      finishGame(gameState.score, gameState.correctCount, gameState.wrongCount);
    }
  }, [timeLeft, finishGame, gameState.score, gameState.correctCount, gameState.wrongCount]);

  function animateCard() {
    cardAnim.setValue(0.85);
    Animated.spring(cardAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  }

  function animateShake() {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }

  function handleBucketPress(bucketKey) {
    if (gameOver || finishing || !gameState.current) return;

    const outcome = scoreAnswer(gameState, bucketKey, gameState.current);
    setFeedback(outcome.correct ? 'correct' : 'wrong');

    if (outcome.correct) {
      animateCard();
    } else {
      animateShake();
    }

    setGameState((prev) => {
      const next = advanceState({
        ...prev,
        score: outcome.score,
        combo: outcome.combo,
        correctCount: prev.correctCount + (outcome.correct ? 1 : 0),
        wrongCount: prev.wrongCount + (outcome.correct ? 0 : 1),
      });
      return next;
    });

    setTimeout(() => setFeedback(null), 400);
  }

  function confirmQuit() {
    Alert.alert(
      'Quit game?',
      'Your progress will be saved with your current score.',
      [
        { text: 'Keep playing', style: 'cancel' },
        {
          text: 'Quit',
          style: 'destructive',
          onPress: () => {
            clearInterval(timerRef.current);
            finishGame(gameState.score, gameState.correctCount, gameState.wrongCount);
          },
        },
      ],
    );
  }

  async function handlePlayAgain() {
    setRestarting(true);
    try {
      const start = await startArcadeGame(gameKey);
      finishedRef.current = false;
      setSessionId(start.session_id);
      setGameState(createInitialState());
      setTimeLeft(ROUND_SECONDS);
      setGameOver(false);
      setResult(null);
      setFeedback(null);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e) {
      Alert.alert('Cannot play', e.message || 'Not enough Bot Bucks.');
    } finally {
      setRestarting(false);
    }
  }

  const cardBorderColor = feedback === 'correct'
    ? colors.primary
    : feedback === 'wrong'
      ? '#FF6B6B'
      : colors.border;

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <GameHUD
          score={gameState.score}
          timeLeft={timeLeft}
          combo={gameState.combo}
          onQuit={confirmQuit}
          colors={colors}
        />

        <View style={styles.instructions}>
          <Text style={styles.instructionsText}>Tap the right bucket for each expense</Text>
          <Text style={styles.instructionsSub}>50% Needs · 30% Wants · 20% Savings</Text>
        </View>

        <Animated.View
          style={[
            styles.cardWrap,
            {
              transform: [
                { scale: cardAnim },
                { translateX: shakeAnim },
              ],
            },
          ]}
        >
          <View style={[styles.expenseCard, { borderColor: cardBorderColor }]}>
            <Text style={styles.expenseEmoji}>{gameState.current?.emoji}</Text>
            <Text style={styles.expenseLabel}>{gameState.current?.label}</Text>
            <Text style={styles.expenseHint}>Where does this go?</Text>
          </View>
        </Animated.View>

        <View style={styles.buckets}>
          {Object.entries(BUCKETS).map(([key, bucket]) => (
            <TouchableOpacity
              key={key}
              style={styles.bucketBtn}
              activeOpacity={0.85}
              onPress={() => handleBucketPress(key)}
              disabled={gameOver || finishing}
            >
              <LinearGradient
                colors={[bucket.color, `${bucket.color}CC`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bucketGrad}
              >
                <Ionicons name={bucket.icon} size={24} color="#FFFFFF" />
                <Text style={styles.bucketLabel}>{bucket.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        <GameOverModal
          visible={gameOver}
          score={result?.score ?? gameState.score}
          xpEarned={result?.xpEarned ?? 0}
          botBucksEarned={result?.botBucksEarned ?? 0}
          isBest={result?.isBest ?? false}
          correctCount={result?.correctCount ?? gameState.correctCount}
          wrongCount={result?.wrongCount ?? gameState.wrongCount}
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
  instructions: { alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 },
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
  },
  cardWrap: { alignItems: 'center', marginBottom: 32 },
  expenseCard: {
    width: 280,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 24,
    borderWidth: 3,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  expenseEmoji: { fontSize: 52, marginBottom: 12 },
  expenseLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 6,
  },
  expenseHint: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  buckets: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 12,
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
  bucketBtn: { borderRadius: 18, overflow: 'hidden' },
  bucketGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  bucketLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
