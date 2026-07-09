import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatValue, colorHex } from './format';

function formatCountdown(seconds) {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function RoundBreakdown({ item, colors, styles }) {
  const dot = colorHex(item.color, colors);

  let detail = null;
  if (item.type === 'estimate') {
    detail = (
      <Text style={styles.rowDetail}>
        Answer: <Text style={styles.rowStrong}>{formatValue(item.correct_value, item.unit)}</Text>
        {item.guess != null && `  ·  You: ${formatValue(item.guess, item.unit)}`}
      </Text>
    );
  } else if (item.type === 'higher_lower') {
    const correctOpt = item.correct === 'a' ? item.a : item.b;
    detail = (
      <Text style={styles.rowDetail}>
        Answer: <Text style={styles.rowStrong}>{correctOpt?.emoji} {correctOpt?.label}</Text>
      </Text>
    );
  } else if (item.type === 'sequence') {
    const labels = (item.correct_order || []).map((id) => item.items?.[id]?.label).filter(Boolean);
    detail = <Text style={styles.rowDetail}>Order: <Text style={styles.rowStrong}>{labels.join(' → ')}</Text></Text>;
  }

  return (
    <View style={styles.breakRow}>
      <View style={[styles.breakDot, { backgroundColor: dot }]} />
      <View style={styles.breakBody}>
        <Text style={styles.rowPrompt}>{item.prompt}</Text>
        {detail}
        {!!item.fact && <Text style={styles.rowFact}>{item.fact}</Text>}
      </View>
      <Text style={[styles.rowPoints, { color: dot }]}>+{item.points}</Text>
    </View>
  );
}

export default function DailyResult({
  result, colors, styles, onLeaderboard, onExit, secondsUntilReset,
}) {
  const pct = result.maxScore ? Math.round((result.score / result.maxScore) * 100) : 0;
  const countdown = useMemo(() => formatCountdown(secondsUntilReset), [secondsUntilReset]);

  const headline = pct === 100 ? 'Flawless!'
    : pct >= 80 ? 'Sharp!'
      : pct >= 50 ? 'Nice run!'
        : 'Puzzle complete';

  async function handleShare() {
    const lines = [
      `MoneyBot Daily #${result.number}`,
      `${result.score}/${result.maxScore} · Rank #${result.rank}`,
      result.grid,
    ];
    if (result.currentStreak > 0) lines.push(`🔥 ${result.currentStreak} day streak`);
    try {
      await Share.share({ message: lines.join('\n') });
    } catch (e) {
      // user cancelled or share unavailable — no-op
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['rgba(61,220,95,0.18)', 'rgba(61,220,95,0.03)']}
        style={styles.resultHero}
      >
        <Text style={styles.resultEyebrow}>MONEYBOT DAILY #{result.number}</Text>
        <Text style={styles.resultHeadline}>{headline}</Text>

        <View style={styles.scoreCircle}>
          <Text style={styles.scoreValue}>{result.score}</Text>
          <Text style={styles.scoreMax}>/ {result.maxScore}</Text>
        </View>

        <Text style={styles.grid}>{result.grid}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="podium" size={16} color={colors.primary} />
            <Text style={styles.metaVal}>#{result.rank}</Text>
            <Text style={styles.metaLbl}>of {result.totalPlayers}</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Ionicons name="flame" size={16} color={colors.streak} />
            <Text style={styles.metaVal}>{result.currentStreak}</Text>
            <Text style={styles.metaLbl}>streak</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Ionicons name="flash" size={16} color={colors.primaryLight} />
            <Text style={styles.metaVal}>+{result.xpEarned}</Text>
            <Text style={styles.metaLbl}>XP</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Ionicons name="logo-bitcoin" size={16} color={colors.botBucks} />
            <Text style={styles.metaVal}>+{result.botBucksEarned}</Text>
            <Text style={styles.metaLbl}>Bucks</Text>
          </View>
        </View>
      </LinearGradient>

      <TouchableOpacity style={styles.shareBtn} activeOpacity={0.85} onPress={handleShare}>
        <LinearGradient
          colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.shareGrad}
        >
          <Ionicons name="share-social" size={18} color="#FFFFFF" />
          <Text style={styles.shareText}>Share result</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.lbBtn} activeOpacity={0.85} onPress={onLeaderboard}>
        <Ionicons name="trophy" size={18} color={colors.primary} />
        <Text style={styles.lbText}>Today's leaderboard</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </TouchableOpacity>

      <Text style={styles.breakTitle}>How you did</Text>
      <View style={styles.breakCard}>
        {result.results.map((item, i) => (
          <React.Fragment key={item.id}>
            {i > 0 && <View style={styles.breakSep} />}
            <RoundBreakdown item={item} colors={colors} styles={styles} />
          </React.Fragment>
        ))}
      </View>

      {countdown && (
        <Text style={styles.countdown}>Next puzzle in {countdown}</Text>
      )}

      <TouchableOpacity style={styles.exitBtn} activeOpacity={0.8} onPress={onExit}>
        <Text style={styles.exitText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
