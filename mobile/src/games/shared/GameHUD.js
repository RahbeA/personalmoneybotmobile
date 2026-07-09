import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function GameHUD({
  score,
  timeLeft,
  combo,
  onQuit,
  colors,
  styles: customStyles,
}) {
  const styles = customStyles || makeStyles(colors);

  return (
    <View style={styles.hud}>
      <TouchableOpacity style={styles.quitBtn} onPress={onQuit} activeOpacity={0.8}>
        <Ionicons name="close" size={22} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.hudCenter}>
        <Text style={styles.hudLabel}>SCORE</Text>
        <Text style={styles.hudScore}>{score}</Text>
      </View>

      <View style={styles.hudRight}>
        <View style={styles.timerWrap}>
          <Ionicons name="timer-outline" size={16} color={timeLeft <= 10 ? '#FF6B6B' : colors.primary} />
          <Text style={[styles.timerText, timeLeft <= 10 && styles.timerUrgent]}>{timeLeft}s</Text>
        </View>
        {combo > 1 && (
          <View style={styles.comboWrap}>
            <Text style={styles.comboText}>{combo}x COMBO</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quitBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudCenter: { alignItems: 'center', flex: 1 },
  hudLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  hudScore: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },
  hudRight: { alignItems: 'flex-end', minWidth: 72 },
  timerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
  },
  timerUrgent: { color: '#FF6B6B' },
  comboWrap: {
    marginTop: 4,
    backgroundColor: colors.primaryTint,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comboText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.3,
  },
});

export { makeStyles as makeGameHUDStyles };
