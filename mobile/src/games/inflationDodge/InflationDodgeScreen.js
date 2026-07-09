import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useUserProgress } from '../../context/UserProgressContext';
import { useTheme } from '../../context/ThemeContext';
import GameHUD from '../shared/GameHUD';
import GameOverModal from '../shared/GameOverModal';
import {
  ROUND_SECONDS, COIN_SIZE, makeCoin, collectedValue, spawnIntervalForElapsed,
} from './engine';

const TIP = 'Inflation eats your money over time. Spend or invest sooner — waiting shrinks what your cash can buy.';

export default function InflationDodgeScreen({ navigation, route }) {
  const { sessionId: initialSessionId, gameKey = 'inflation_dodge' } = route.params;
  const { finishArcadeGame, startArcadeGame } = useUserProgress();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [sessionId, setSessionId] = useState(initialSessionId);
  const [coins, setCoins] = useState([]);
  const [score, setScore] = useState(0);
  const [collected, setCollected] = useState(0);
  const [missed, setMissed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState(null);
  const [restarting, setRestarting] = useState(false);

  const scoreRef = useRef(0);
  const collectedRef = useRef(0);
  const missedRef = useRef(0);
  const finishedRef = useRef(false);
  const mountedRef = useRef(true);
  const areaRef = useRef({ width: 0, height: 0 });
  const startAtRef = useRef(Date.now());
  const timerRef = useRef(null);
  const spawnTimeoutRef = useRef(null);

  const finishGame = useCallback(async (finalScore) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(timerRef.current);
    clearTimeout(spawnTimeoutRef.current);
    setCoins([]);
    const res = await finishArcadeGame(gameKey, sessionId, finalScore);
    if (!mountedRef.current) return;
    setResult({
      score: finalScore,
      xpEarned: res?.xp_earned || 0,
      botBucksEarned: res?.bot_bucks_earned || 0,
      isBest: res?.is_best || false,
      collected: collectedRef.current,
      missed: missedRef.current,
    });
    setGameOver(true);
  }, [finishArcadeGame, gameKey, sessionId]);

  const removeCoin = useCallback((id) => {
    setCoins((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const spawnCoin = useCallback(() => {
    const area = areaRef.current;
    if (finishedRef.current || area.width < COIN_SIZE) return;
    const coin = makeCoin(area.width, area.height);
    coin.anim = new Animated.Value(1);
    coin.collected = false;
    setCoins((prev) => [...prev, coin]);
    Animated.timing(coin.anim, {
      toValue: 0,
      duration: coin.lifetime,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !coin.collected && !finishedRef.current && mountedRef.current) {
        missedRef.current += 1;
        setMissed(missedRef.current);
        removeCoin(coin.id);
      }
    });
  }, [removeCoin]);

  const scheduleSpawn = useCallback(() => {
    if (finishedRef.current) return;
    const elapsed = (Date.now() - startAtRef.current) / 1000;
    const interval = spawnIntervalForElapsed(elapsed);
    spawnTimeoutRef.current = setTimeout(() => {
      spawnCoin();
      scheduleSpawn();
    }, interval);
  }, [spawnCoin]);

  const startRound = useCallback(() => {
    startAtRef.current = Date.now();
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
    scheduleSpawn();
  }, [scheduleSpawn]);

  useEffect(() => {
    mountedRef.current = true;
    startRound();
    return () => {
      mountedRef.current = false;
      clearInterval(timerRef.current);
      clearTimeout(spawnTimeoutRef.current);
    };
  }, [startRound]);

  useEffect(() => {
    if (timeLeft === 0 && !finishedRef.current) {
      finishGame(scoreRef.current);
    }
  }, [timeLeft, finishGame]);

  function collectCoin(coin) {
    if (coin.collected || finishedRef.current) return;
    coin.collected = true;
    coin.anim.stopAnimation();
    const gained = collectedValue(coin);
    scoreRef.current += gained;
    collectedRef.current += 1;
    setScore(scoreRef.current);
    setCollected(collectedRef.current);
    removeCoin(coin.id);
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
      scoreRef.current = 0;
      collectedRef.current = 0;
      missedRef.current = 0;
      setSessionId(start.session_id);
      setCoins([]);
      setScore(0);
      setCollected(0);
      setMissed(0);
      setTimeLeft(ROUND_SECONDS);
      setGameOver(false);
      setResult(null);
      startRound();
    } catch (e) {
      Alert.alert('Cannot play', e.message || 'Not enough Bot Bucks.');
    } finally {
      setRestarting(false);
    }
  }

  function handleArea(e) {
    const { width, height } = e.nativeEvent.layout;
    areaRef.current = { width, height };
  }

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
          <Text style={styles.instructionsText}>Tap coins fast — their value shrinks!</Text>
          <Text style={styles.instructionsSub}>The longer they sit, the less they're worth</Text>
        </View>

        <View style={styles.playArea} onLayout={handleArea}>
          {coins.map((coin) => (
            <Animated.View
              key={coin.id}
              pointerEvents="box-none"
              style={[
                styles.coinWrap,
                {
                  left: coin.x,
                  top: coin.y,
                  opacity: coin.anim.interpolate({
                    inputRange: [0, 0.15, 1],
                    outputRange: [0.35, 1, 1],
                  }),
                  transform: [
                    {
                      scale: coin.anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.45, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => collectCoin(coin)}
                style={styles.coin}
              >
                <LinearGradient
                  colors={['#F5D76E', '#F5B72B', '#E0A21B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.coinGrad}
                >
                  <Text style={styles.coinValue}>${coin.value}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        <GameOverModal
          visible={gameOver}
          score={result?.score ?? score}
          xpEarned={result?.xpEarned ?? 0}
          botBucksEarned={result?.botBucksEarned ?? 0}
          isBest={result?.isBest ?? false}
          tip={TIP}
          stats={[
            { icon: 'cash', color: colors.primary, value: result?.collected ?? collected, label: 'Collected' },
            { icon: 'close-circle', color: '#FF6B6B', value: result?.missed ?? missed, label: 'Missed' },
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
  instructions: { alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 },
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
  playArea: {
    flex: 1,
    position: 'relative',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  coinWrap: {
    position: 'absolute',
    width: COIN_SIZE,
    height: COIN_SIZE,
  },
  coin: {
    width: COIN_SIZE,
    height: COIN_SIZE,
    borderRadius: COIN_SIZE / 2,
  },
  coinGrad: {
    width: COIN_SIZE,
    height: COIN_SIZE,
    borderRadius: COIN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F5B72B',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  coinValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5A3E00',
  },
});
