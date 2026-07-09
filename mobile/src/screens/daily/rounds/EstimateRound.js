import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatValue } from '../format';

const KNOB = 30;

function snap(raw, min, max, step) {
  const clamped = Math.min(max, Math.max(min, raw));
  const stepped = Math.round((clamped - min) / step) * step + min;
  return Math.min(max, Math.max(min, stepped));
}

export default function EstimateRound({ round, onSubmit, colors }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { min, max, step, unit } = round;

  const [value, setValue] = useState(() => snap((min + max) / 2, min, max, step));
  const [touched, setTouched] = useState(false);
  const trackWidth = useRef(0);

  const setFromX = (x) => {
    const w = trackWidth.current;
    if (!w) return;
    const ratio = Math.min(1, Math.max(0, x / w));
    setValue(snap(min + ratio * (max - min), min, max, step));
    setTouched(true);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => setFromX(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => setFromX(evt.nativeEvent.locationX),
    }),
  ).current;

  const ratio = (value - min) / (max - min || 1);
  const fillPct = `${Math.min(100, Math.max(0, ratio * 100))}%`;

  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Ionicons name="calculator" size={14} color={colors.primary} />
        <Text style={styles.badgeText}>ESTIMATE</Text>
      </View>

      <Text style={styles.prompt}>{round.prompt}</Text>

      <View style={styles.readoutWrap}>
        <Text style={styles.readout}>{formatValue(value, unit)}</Text>
        <Text style={styles.readoutHint}>Drag the slider to your best guess</Text>
      </View>

      <View style={styles.sliderArea}>
        <View
          style={styles.track}
          onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
          {...pan.panHandlers}
        >
          <View style={styles.trackBase} pointerEvents="none" />
          <View style={[styles.trackFill, { width: fillPct }]} pointerEvents="none" />
          <View
            style={[styles.knob, { left: `${Math.min(100, Math.max(0, ratio * 100))}%` }]}
            pointerEvents="none"
          >
            <View style={styles.knobInner} />
          </View>
        </View>
        <View style={styles.rangeRow}>
          <Text style={styles.rangeLabel}>{formatValue(min, unit)}</Text>
          <Text style={styles.rangeLabel}>{formatValue(max, unit)}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        activeOpacity={0.85}
        onPress={() => onSubmit({ value })}
      >
        <LinearGradient
          colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.submitGrad}
        >
          <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
          <Text style={styles.submitText}>{touched ? 'Lock it in' : 'Lock in guess'}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center',
    backgroundColor: colors.primaryTint, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 20,
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.primary, letterSpacing: 1 },
  prompt: {
    fontSize: 22, fontWeight: '800', color: colors.white,
    textAlign: 'center', lineHeight: 30, marginBottom: 28,
  },
  readoutWrap: { alignItems: 'center', marginBottom: 32 },
  readout: { fontSize: 44, fontWeight: '900', color: colors.primary, letterSpacing: -1 },
  readoutHint: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  sliderArea: { marginBottom: 40 },
  track: {
    height: KNOB + 12, justifyContent: 'center',
  },
  trackBase: {
    position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 4,
    backgroundColor: colors.border,
  },
  trackFill: {
    position: 'absolute', left: 0, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
  },
  knob: {
    position: 'absolute', width: KNOB, height: KNOB, borderRadius: KNOB / 2,
    marginLeft: -KNOB / 2, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
    borderWidth: 3, borderColor: colors.primary,
  },
  knobInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  rangeLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  submitBtn: { borderRadius: 16, overflow: 'hidden' },
  submitGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  submitText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
