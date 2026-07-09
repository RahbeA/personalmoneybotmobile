import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

function OptionCard({ option, side, selected, onPress, styles, colors }) {
  return (
    <TouchableOpacity
      style={[styles.option, selected && styles.optionSelected]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <Text style={styles.optionEmoji}>{option.emoji}</Text>
      <Text style={styles.optionLabel}>{option.label}</Text>
      {selected && (
        <View style={styles.checkWrap}>
          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        </View>
      )}
      {!selected && <Text style={styles.tapHint}>Tap to pick</Text>}
    </TouchableOpacity>
  );
}

export default function HigherLowerRound({ round, onSubmit, colors }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pick, setPick] = useState(null);

  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Ionicons name="git-compare" size={14} color={colors.botBucks} />
        <Text style={styles.badgeText}>WHICH IS MORE?</Text>
      </View>

      <Text style={styles.prompt}>{round.prompt}</Text>

      <View style={styles.options}>
        <OptionCard
          option={round.a}
          side="a"
          selected={pick === 'a'}
          onPress={() => setPick('a')}
          styles={styles}
          colors={colors}
        />
        <View style={styles.vsWrap}>
          <Text style={styles.vsText}>VS</Text>
        </View>
        <OptionCard
          option={round.b}
          side="b"
          selected={pick === 'b'}
          onPress={() => setPick('b')}
          styles={styles}
          colors={colors}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, !pick && styles.submitBtnDisabled]}
        activeOpacity={0.85}
        disabled={!pick}
        onPress={() => onSubmit({ value: pick })}
      >
        <LinearGradient
          colors={pick
            ? [colors.primaryLight, colors.primary, colors.primaryDark]
            : [colors.border, colors.border]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.submitGrad}
        >
          <Text style={[styles.submitText, !pick && styles.submitTextDisabled]}>
            {pick ? 'Continue' : 'Pick one'}
          </Text>
          {pick && <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center',
    backgroundColor: 'rgba(245,183,43,0.14)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 20,
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.botBucks, letterSpacing: 1 },
  prompt: {
    fontSize: 22, fontWeight: '800', color: colors.white,
    textAlign: 'center', lineHeight: 30, marginBottom: 28,
  },
  options: { gap: 14, marginBottom: 36 },
  option: {
    backgroundColor: colors.surfaceElevated, borderRadius: 20,
    paddingVertical: 26, paddingHorizontal: 20, alignItems: 'center',
    borderWidth: 2, borderColor: colors.border,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  optionEmoji: { fontSize: 40, marginBottom: 10 },
  optionLabel: { fontSize: 18, fontWeight: '800', color: colors.white, textAlign: 'center' },
  tapHint: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
  checkWrap: { marginTop: 6 },
  vsWrap: { alignSelf: 'center', marginVertical: -4 },
  vsText: { fontSize: 14, fontWeight: '900', color: colors.textMuted, letterSpacing: 1 },
  submitBtn: { borderRadius: 16, overflow: 'hidden' },
  submitBtnDisabled: { opacity: 0.8 },
  submitGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  submitText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  submitTextDisabled: { color: colors.textMuted },
});
