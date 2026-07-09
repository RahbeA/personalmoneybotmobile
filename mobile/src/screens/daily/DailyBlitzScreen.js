import React, {
  useCallback, useMemo, useRef, useState,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useUserProgress } from '../../context/UserProgressContext';
import { useTheme } from '../../context/ThemeContext';
import { dailyApi } from '../../api/daily';
import { secondsUntilLocalMidnight } from '../../utils/localDate';
import { BrandLoader } from '../../components/brand';
import EstimateRound from './rounds/EstimateRound';
import HigherLowerRound from './rounds/HigherLowerRound';
import SequenceRound from './rounds/SequenceRound';
import DailyResult from './DailyResult';

const ROUND_COMPONENTS = {
  estimate: EstimateRound,
  higher_lower: HigherLowerRound,
  sequence: SequenceRound,
};

function normalizeFromToday(data) {
  const e = data.my_entry;
  return {
    number: data.number,
    score: e.total_score,
    maxScore: data.max_score,
    grid: e.grid,
    results: e.results,
    rank: e.rank,
    totalPlayers: data.total_players,
    xpEarned: e.xp_earned,
    botBucksEarned: e.bot_bucks_earned,
    currentStreak: data.current_streak,
  };
}

function normalizeFromSubmit(res) {
  return {
    number: res.number,
    score: res.total_score,
    maxScore: res.max_score,
    grid: res.grid,
    results: res.results,
    rank: res.rank,
    totalPlayers: res.total_players,
    xpEarned: res.xp_earned,
    botBucksEarned: res.bot_bucks_earned,
    currentStreak: res.current_streak,
  };
}

export default function DailyBlitzScreen({ navigation }) {
  const { token } = useAuth();
  const { refresh } = useUserProgress();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [phase, setPhase] = useState('loading'); // loading | intro | playing | result | error
  const [today, setToday] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const answersRef = useRef([]);
  const roundStartRef = useRef(0);

  const load = useCallback(async () => {
    if (!token) return;
    setPhase('loading');
    try {
      const data = await dailyApi.getToday(token);
      setToday(data);
      if (data.played && data.my_entry) {
        setResult(normalizeFromToday(data));
        setPhase('result');
      } else {
        setRounds(data.challenge?.rounds || []);
        setPhase('intro');
      }
    } catch (e) {
      setError(e.message || 'Could not load today\u2019s challenge.');
      setPhase('error');
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    // Only auto-load when we don't already have a fresh session in progress.
    if (phase === 'loading') load();
  }, [phase, load]));

  function startGame() {
    answersRef.current = [];
    setIndex(0);
    roundStartRef.current = Date.now();
    setPhase('playing');
  }

  const submitFinal = useCallback(async (allAnswers) => {
    setSubmitting(true);
    const totalTime = allAnswers.reduce((sum, a) => sum + (a.time_ms || 0), 0);
    try {
      const res = await dailyApi.submit(token, allAnswers, totalTime);
      setResult(normalizeFromSubmit(res));
      setPhase('result');
      refresh({ background: true });
    } catch (e) {
      if (e.status === 409) {
        // Already played (e.g. another device) — just show the stored result.
        await load();
      } else {
        Alert.alert('Could not submit', e.message || 'Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [token, refresh, load]);

  function handleRoundSubmit(answer) {
    const round = rounds[index];
    const timeMs = Date.now() - roundStartRef.current;
    answersRef.current = [...answersRef.current, { id: round.id, ...answer, time_ms: timeMs }];

    if (index + 1 < rounds.length) {
      setIndex(index + 1);
      roundStartRef.current = Date.now();
    } else {
      submitFinal(answersRef.current);
    }
  }

  function confirmQuit() {
    Alert.alert(
      'Leave the Daily?',
      'Your progress will be lost and you\u2019ll have to start over.',
      [
        { text: 'Keep playing', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
      ],
    );
  }

  const goLeaderboard = () => navigation.navigate('DailyLeaderboard');

  // ---- render states ----
  if (phase === 'loading' || submitting) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <BrandLoader message={submitting ? 'Scoring your run…' : 'Loading today\u2019s challenge…'} />
      </LinearGradient>
    );
  }

  if (phase === 'error') {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.centered} edges={['top', 'bottom']}>
          <Ionicons name="cloud-offline" size={40} color={colors.textMuted} />
          <Text style={styles.errorTitle}>Couldn't load the Daily</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.85}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.retrySecondary} onPress={() => navigation.goBack()}>
            <Text style={styles.retrySecondaryText}>Go back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (phase === 'result' && result) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>MoneyBot Daily</Text>
            <View style={styles.iconBtnGhost} />
          </View>
          <DailyResult
            result={result}
            colors={colors}
            styles={styles}
            onLeaderboard={goLeaderboard}
            onExit={() => navigation.goBack()}
            secondsUntilReset={secondsUntilLocalMidnight()}
          />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (phase === 'intro') {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>MoneyBot Daily</Text>
            <View style={styles.iconBtnGhost} />
          </View>

          <View style={styles.introBody}>
            <LinearGradient
              colors={['#F5B72B', '#FF9F1C', '#FF6B35']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.introIcon}
            >
              <Ionicons name="today" size={40} color="#FFFFFF" />
            </LinearGradient>

            <Text style={styles.introNumber}>Daily #{today?.number}</Text>
            <Text style={styles.introTitle}>One puzzle. Everyone plays the same.</Text>
            <Text style={styles.introSub}>
              5 quick rounds — estimate, compare, and rank your way up the board.
              Score by accuracy and speed. One shot per day.
            </Text>

            <View style={styles.introStats}>
              <View style={styles.introStat}>
                <Ionicons name="flame" size={20} color={colors.streak} />
                <Text style={styles.introStatVal}>{today?.current_streak ?? 0}</Text>
                <Text style={styles.introStatLbl}>Day streak</Text>
              </View>
              <View style={styles.introStatDivider} />
              <View style={styles.introStat}>
                <Ionicons name="people" size={20} color={colors.primary} />
                <Text style={styles.introStatVal}>{today?.total_players ?? 0}</Text>
                <Text style={styles.introStatLbl}>Played today</Text>
              </View>
              <View style={styles.introStatDivider} />
              <View style={styles.introStat}>
                <Ionicons name="trophy" size={20} color={colors.botBucks} />
                <Text style={styles.introStatVal}>{today?.best_streak ?? 0}</Text>
                <Text style={styles.introStatLbl}>Best streak</Text>
              </View>
            </View>
          </View>

          <View style={styles.introFooter}>
            <TouchableOpacity style={styles.playBtn} activeOpacity={0.85} onPress={startGame}>
              <LinearGradient
                colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.playGrad}
              >
                <Ionicons name="play" size={20} color="#FFFFFF" />
                <Text style={styles.playText}>Play today's Daily</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.introLbBtn} activeOpacity={0.8} onPress={goLeaderboard}>
              <Ionicons name="trophy" size={16} color={colors.primary} />
              <Text style={styles.introLbText}>View leaderboard</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // phase === 'playing'
  const round = rounds[index];
  const RoundComponent = round ? ROUND_COMPONENTS[round.type] : null;

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={confirmQuit} activeOpacity={0.8}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.progressDots}>
            {rounds.map((r, i) => (
              <View
                key={r.id}
                style={[
                  styles.dot,
                  i < index && styles.dotDone,
                  i === index && styles.dotActive,
                ]}
              />
            ))}
          </View>
          <Text style={styles.roundCount}>{index + 1}/{rounds.length}</Text>
        </View>

        {RoundComponent && (
          <RoundComponent
            key={round.id}
            round={round}
            onSubmit={handleRoundSubmit}
            colors={colors}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnGhost: { width: 40, height: 40 },
  topTitle: { fontSize: 15, fontWeight: '800', color: colors.white, letterSpacing: -0.2 },
  progressDots: { flexDirection: 'row', gap: 6, flex: 1, justifyContent: 'center', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotDone: { backgroundColor: colors.primaryDark },
  dotActive: { width: 22, backgroundColor: colors.primary },
  roundCount: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, minWidth: 40, textAlign: 'right' },

  // intro
  introBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  introIcon: {
    width: 88, height: 88, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    marginBottom: 22,
    shadowColor: '#FF9F1C', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  introNumber: { fontSize: 14, fontWeight: '800', color: colors.botBucks, letterSpacing: 1, marginBottom: 8 },
  introTitle: {
    fontSize: 26, fontWeight: '900', color: colors.white, textAlign: 'center',
    letterSpacing: -0.5, lineHeight: 32, marginBottom: 12,
  },
  introSub: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  introStats: {
    flexDirection: 'row', backgroundColor: colors.surfaceElevated, borderRadius: 18,
    paddingVertical: 18, width: '100%', borderWidth: 1, borderColor: colors.border,
  },
  introStat: { flex: 1, alignItems: 'center', gap: 4 },
  introStatVal: { fontSize: 22, fontWeight: '900', color: colors.white },
  introStatLbl: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  introStatDivider: { width: 1, backgroundColor: colors.border, marginVertical: 6 },
  introFooter: { paddingHorizontal: 24, paddingBottom: 8, gap: 12 },
  playBtn: { borderRadius: 18, overflow: 'hidden' },
  playGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18,
  },
  playText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  introLbBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  introLbText: { fontSize: 15, fontWeight: '700', color: colors.primary },

  // error
  errorTitle: { fontSize: 18, fontWeight: '800', color: colors.white, marginTop: 8 },
  errorText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    marginTop: 16, backgroundColor: colors.primary, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  retryText: { fontSize: 15, fontWeight: '800', color: colors.background },
  retrySecondary: { paddingVertical: 12 },
  retrySecondaryText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  // result (consumed by DailyResult)
  resultScroll: { paddingHorizontal: 20, paddingBottom: 40 },
  resultHero: {
    borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(61,220,95,0.25)',
  },
  resultEyebrow: { fontSize: 12, fontWeight: '800', color: colors.primary, letterSpacing: 1.2, marginBottom: 6 },
  resultHeadline: { fontSize: 28, fontWeight: '900', color: colors.white, letterSpacing: -0.5, marginBottom: 16 },
  scoreCircle: {
    width: 130, height: 130, borderRadius: 65, backgroundColor: colors.surface,
    borderWidth: 3, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, flexDirection: 'row',
  },
  scoreValue: { fontSize: 44, fontWeight: '900', color: colors.primary, letterSpacing: -1 },
  scoreMax: { fontSize: 15, fontWeight: '700', color: colors.textSecondary, marginLeft: 2, marginTop: 12 },
  grid: { fontSize: 30, letterSpacing: 4, marginBottom: 18 },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceElevated,
    borderRadius: 16, paddingVertical: 12, width: '100%', borderWidth: 1, borderColor: colors.border,
  },
  metaItem: { flex: 1, alignItems: 'center', gap: 2 },
  metaVal: { fontSize: 16, fontWeight: '900', color: colors.white },
  metaLbl: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  metaDivider: { width: 1, height: 34, backgroundColor: colors.border },

  shareBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  shareGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15,
  },
  shareText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  lbBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.surfaceElevated, borderRadius: 16, paddingVertical: 15,
    borderWidth: 1, borderColor: colors.primary + '55', marginBottom: 24,
  },
  lbText: { fontSize: 15, fontWeight: '800', color: colors.primary },

  breakTitle: { fontSize: 17, fontWeight: '800', color: colors.white, marginBottom: 12 },
  breakCard: {
    backgroundColor: colors.surfaceElevated, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 20,
  },
  breakRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  breakDot: { width: 12, height: 12, borderRadius: 3, marginTop: 4 },
  breakBody: { flex: 1 },
  rowPrompt: { fontSize: 14, fontWeight: '700', color: colors.white, lineHeight: 19, marginBottom: 3 },
  rowDetail: { fontSize: 13, color: colors.textSecondary, marginBottom: 3 },
  rowStrong: { fontWeight: '800', color: colors.offWhite },
  rowFact: { fontSize: 12, color: colors.textMuted, lineHeight: 17, fontStyle: 'italic' },
  rowPoints: { fontSize: 15, fontWeight: '900', minWidth: 44, textAlign: 'right' },
  breakSep: { height: 1, backgroundColor: colors.border, marginVertical: 14 },

  countdown: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 16, fontWeight: '600' },
  exitBtn: {
    backgroundColor: colors.surfaceElevated, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  exitText: { fontSize: 16, fontWeight: '800', color: colors.white },
});
