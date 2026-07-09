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
import { ROUND_SECONDS } from './messages';
import { createInitialState, scoreAnswer, advanceState } from './engine';

const TIP = 'Red flags: urgency, requests for codes/PINs, odd links, and look-alike sender names.';
const FEEDBACK_MS = 1300;
const DANGER = '#FF6B6B';

export default function ScamSpotterScreen({ navigation, route }) {
  const { sessionId: initialSessionId, gameKey = 'scam_spotter' } = route.params;
  const { finishArcadeGame, startArcadeGame } = useUserProgress();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [sessionId, setSessionId] = useState(initialSessionId);
  const [gameState, setGameState] = useState(createInitialState);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [feedback, setFeedback] = useState(null); // { correct, flag }
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState(null);
  const [restarting, setRestarting] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const cardAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const advanceRef = useRef(null);
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

  const startTimer = useCallback(() => {
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
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(advanceRef.current);
    };
  }, [startTimer]);

  useEffect(() => {
    if (timeLeft === 0 && !finishedRef.current) {
      finishGame(gameState.score, gameState.correctCount, gameState.wrongCount);
    }
  }, [timeLeft, finishGame, gameState.score, gameState.correctCount, gameState.wrongCount]);

  function animatePop() {
    cardAnim.setValue(0.9);
    Animated.spring(cardAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }

  function animateShake() {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 9, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -9, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 7, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }

  function handleAnswer(choice) {
    if (gameOver || finishing || feedback || !gameState.current) return;

    const outcome = scoreAnswer(gameState, choice, gameState.current);
    setFeedback({ correct: outcome.correct, flag: gameState.current.flag });

    if (outcome.correct) animatePop();
    else animateShake();

    setGameState((prev) => ({
      ...prev,
      score: outcome.score,
      combo: outcome.combo,
      correctCount: prev.correctCount + (outcome.correct ? 1 : 0),
      wrongCount: prev.wrongCount + (outcome.correct ? 0 : 1),
    }));

    advanceRef.current = setTimeout(() => {
      setFeedback(null);
      setGameState((prev) => advanceState(prev));
    }, FEEDBACK_MS);
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
            clearTimeout(advanceRef.current);
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
      clearTimeout(advanceRef.current);
      setSessionId(start.session_id);
      setGameState(createInitialState());
      setTimeLeft(ROUND_SECONDS);
      setGameOver(false);
      setResult(null);
      setFeedback(null);
      startTimer();
    } catch (e) {
      Alert.alert('Cannot play', e.message || 'Not enough Bot Bucks.');
    } finally {
      setRestarting(false);
    }
  }

  const message = gameState.current;
  const isEmail = message?.channel === 'Email';
  const cardBorderColor = feedback
    ? (feedback.correct ? colors.primary : DANGER)
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
          <Text style={styles.instructionsText}>Scam or Safe?</Text>
          <Text style={styles.instructionsSub}>Read the message, then make the call</Text>
        </View>

        <Animated.View
          style={[
            styles.cardWrap,
            { transform: [{ scale: cardAnim }, { translateX: shakeAnim }] },
          ]}
        >
          <View style={[styles.msgCard, { borderColor: cardBorderColor }]}>
            <View style={styles.channelRow}>
              <View style={styles.channelChip}>
                <Ionicons
                  name={isEmail ? 'mail' : 'chatbubble-ellipses'}
                  size={13}
                  color={colors.primary}
                />
                <Text style={styles.channelText}>{isEmail ? 'EMAIL' : 'TEXT MESSAGE'}</Text>
              </View>
            </View>

            <Text style={styles.sender} numberOfLines={1}>
              {isEmail ? 'From: ' : ''}{message?.sender}
            </Text>
            {isEmail && !!message?.subject && (
              <Text style={styles.subject} numberOfLines={2}>{message.subject}</Text>
            )}
            <Text style={styles.body}>{message?.body}</Text>
          </View>
        </Animated.View>

        <View style={styles.feedbackWrap}>
          {feedback && (
            <View
              style={[
                styles.feedbackBanner,
                { backgroundColor: feedback.correct ? 'rgba(61,220,95,0.14)' : 'rgba(255,107,107,0.14)' },
              ]}
            >
              <Ionicons
                name={feedback.correct ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={feedback.correct ? colors.primary : DANGER}
              />
              <Text style={styles.feedbackText}>{feedback.flag}</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.85}
            onPress={() => handleAnswer('scam')}
            disabled={!!feedback || gameOver || finishing}
          >
            <LinearGradient
              colors={['#FF7A7A', '#F0484B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionGrad}
            >
              <Ionicons name="warning" size={24} color="#FFFFFF" />
              <Text style={styles.actionLabel}>Scam</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.85}
            onPress={() => handleAnswer('safe')}
            disabled={!!feedback || gameOver || finishing}
          >
            <LinearGradient
              colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionGrad}
            >
              <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
              <Text style={styles.actionLabel}>Safe</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <GameOverModal
          visible={gameOver}
          score={result?.score ?? gameState.score}
          xpEarned={result?.xpEarned ?? 0}
          botBucksEarned={result?.botBucksEarned ?? 0}
          isBest={result?.isBest ?? false}
          correctCount={result?.correctCount ?? gameState.correctCount}
          wrongCount={result?.wrongCount ?? gameState.wrongCount}
          tip={TIP}
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
  instructions: { alignItems: 'center', paddingHorizontal: 24, marginBottom: 18 },
  instructionsText: { fontSize: 18, fontWeight: '800', color: colors.white, textAlign: 'center' },
  instructionsSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  cardWrap: { alignItems: 'center', paddingHorizontal: 20 },
  msgCard: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 3,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  channelRow: { flexDirection: 'row', marginBottom: 12 },
  channelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(61,220,95,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  channelText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.6,
  },
  sender: { fontSize: 14, fontWeight: '800', color: colors.white, marginBottom: 4 },
  subject: { fontSize: 15, fontWeight: '700', color: colors.white, marginBottom: 8 },
  body: { fontSize: 15, color: colors.offWhite, lineHeight: 22 },
  feedbackWrap: { minHeight: 78, justifyContent: 'center', paddingHorizontal: 20, marginTop: 12 },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    padding: 14,
  },
  feedbackText: { flex: 1, fontSize: 13, color: colors.white, lineHeight: 19, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 16,
    marginTop: 'auto',
  },
  actionBtn: { flex: 1, borderRadius: 18, overflow: 'hidden' },
  actionGrad: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 22,
  },
  actionLabel: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
});
