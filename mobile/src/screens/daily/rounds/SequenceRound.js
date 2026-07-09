import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function SequenceRound({ round, onSubmit, colors }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const items = round.items || [];
  const [order, setOrder] = useState([]);

  const positionOf = (id) => order.indexOf(id);
  const allPlaced = order.length === items.length;

  function toggle(id) {
    setOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Ionicons name="swap-vertical" size={14} color={colors.primaryLight} />
        <Text style={styles.badgeText}>RANK IT</Text>
      </View>

      <Text style={styles.prompt}>{round.prompt}</Text>
      <Text style={styles.subPrompt}>Tap in order — tap again to undo</Text>

      <View style={styles.list}>
        {items.map((item) => {
          const pos = positionOf(item.id);
          const placed = pos !== -1;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.item, placed && styles.itemPlaced]}
              activeOpacity={0.9}
              onPress={() => toggle(item.id)}
            >
              <View style={[styles.orderBadge, placed && styles.orderBadgePlaced]}>
                {placed
                  ? <Text style={styles.orderBadgeText}>{pos + 1}</Text>
                  : <Ionicons name="ellipse-outline" size={16} color={colors.textMuted} />}
              </View>
              <Text style={styles.itemEmoji}>{item.emoji}</Text>
              <Text style={styles.itemLabel}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.actions}>
        {order.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => setOrder([])} activeOpacity={0.8}>
            <Ionicons name="refresh" size={15} color={colors.textSecondary} />
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.submitBtn, !allPlaced && styles.submitBtnDisabled]}
          activeOpacity={0.85}
          disabled={!allPlaced}
          onPress={() => onSubmit({ order })}
        >
          <LinearGradient
            colors={allPlaced
              ? [colors.primaryLight, colors.primary, colors.primaryDark]
              : [colors.border, colors.border]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitGrad}
          >
            <Text style={[styles.submitText, !allPlaced && styles.submitTextDisabled]}>
              {allPlaced ? 'Continue' : `Place all ${items.length}`}
            </Text>
            {allPlaced && <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center',
    backgroundColor: colors.primaryTint, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16,
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.primaryLight, letterSpacing: 1 },
  prompt: {
    fontSize: 21, fontWeight: '800', color: colors.white,
    textAlign: 'center', lineHeight: 28, marginBottom: 4,
  },
  subPrompt: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 22 },
  list: { gap: 10, marginBottom: 28 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surfaceElevated, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: 2, borderColor: colors.border,
  },
  itemPlaced: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  orderBadge: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  orderBadgePlaced: { backgroundColor: colors.primary, borderColor: colors.primary },
  orderBadgeText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  itemEmoji: { fontSize: 26 },
  itemLabel: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.white },
  actions: { gap: 12 },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8,
  },
  clearText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  submitBtn: { borderRadius: 16, overflow: 'hidden' },
  submitBtnDisabled: { opacity: 0.8 },
  submitGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  submitText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  submitTextDisabled: { color: colors.textMuted },
});
