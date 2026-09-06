import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
  PanResponder, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import CharacterPoster from './CharacterPoster';
import PuckButton from './PuckButton';

const RARITY_COLORS = {
  common: '#9AA4B2',
  rare: '#3B9EE3',
  epic: '#9B59B6',
  legendary: '#F5B72B',
};

const SWIPE_THRESHOLD = 50;
// Thumbnail + gap used for strip scroll snapping / getItemLayout.
const STRIP_ITEM_W = 72;

function rgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Full-screen Moneyverse showcase: one live 3D viewer, swipe to browse,
 * richer bottom dock, and a horizontal catalog strip so the shop feels large.
 * Purchase/equip happens on CharacterDetail via onOpen — no inline buy.
 */
export default function FeaturedCharacter({
  characters = [],
  index = 0,
  onIndexChange,
  onOpen,
  equippedId,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const stripRef = useRef(null);

  const list = characters;
  const count = list.length;
  const safeIndex = count ? Math.min(Math.max(0, index), count - 1) : 0;
  const character = count ? list[safeIndex] : null;
  const rarityColor = RARITY_COLORS[character?.rarity] || colors.primary;
  const isEquipped = character && equippedId === character.id;

  const bump = useCallback((delta) => {
    if (!count) return;
    const next = ((safeIndex + delta) % count + count) % count;
    onIndexChange?.(next);
  }, [count, safeIndex, onIndexChange]);

  const jumpTo = useCallback((i) => {
    if (i < 0 || i >= count) return;
    onIndexChange?.(i);
  }, [count, onIndexChange]);

  // Keep the active catalog tile roughly centered in the strip.
  useEffect(() => {
    if (!stripRef.current || !count) return;
    const x = Math.max(0, safeIndex * STRIP_ITEM_W - STRIP_ITEM_W * 2);
    stripRef.current.scrollToOffset({ offset: x, animated: true });
  }, [safeIndex, count]);

  const gestureRef = useRef({ dx: 0, dy: 0 });
  const stageWidthRef = useRef(0);
  const countRef = useRef(count);
  const bumpRef = useRef(bump);
  countRef.current = count;
  bumpRef.current = bump;
  const characterRef = useRef(character);
  const onOpenRef = useRef(onOpen);
  characterRef.current = character;
  onOpenRef.current = onOpen;

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => (
        Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8
      ),
      onPanResponderGrant: () => {
        gestureRef.current = { dx: 0, dy: 0 };
      },
      onPanResponderMove: (_, g) => {
        gestureRef.current = { dx: g.dx, dy: g.dy };
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (evt, g) => {
        const dx = g.dx;
        const dy = g.dy;
        if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) bumpRef.current(1);
          else bumpRef.current(-1);
          return;
        }
        // Tap (no meaningful swipe): left third = previous, right third = next,
        // center = open detail / purchase flow. Falls back to open if unmeasured.
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
          const w = stageWidthRef.current;
          const x = evt.nativeEvent.locationX;
          if (countRef.current > 1 && w > 0 && x < w * 0.3) {
            bumpRef.current(-1);
            return;
          }
          if (countRef.current > 1 && w > 0 && x > w * 0.7) {
            bumpRef.current(1);
            return;
          }
          onOpenRef.current?.(characterRef.current);
        }
      },
    }),
    [],
  );

  // Gentle bob matching the old hero stage.
  const floatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);
  const floatY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [4, -10] });

  const renderStripItem = useCallback(({ item, index: i }) => {
    const tint = RARITY_COLORS[item.rarity] || colors.primary;
    const active = i === safeIndex;
    const shortName = (item.name || 'Bot').split(/(?=[A-Z])|[\s_-]+/).filter(Boolean)[0] || item.name;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => jumpTo(i)}
        style={styles.stripItem}
        accessibilityLabel={item.name}
      >
        <View
          style={[
            styles.stripThumb,
            {
              borderColor: active ? tint : rgba(tint, 0.35),
              backgroundColor: rgba(tint, active ? 0.22 : 0.1),
            },
          ]}
        >
          {item.preview_url ? (
            <CharacterPoster
              previewUrl={item.preview_url}
              style={styles.stripImage}
              resizeMode="contain"
            />
          ) : (
            <LinearGradient
              colors={[rgba(tint, 0.45), rgba(tint, 0.08)]}
              style={styles.stripFallback}
            >
              <Ionicons name="hardware-chip-outline" size={22} color={tint} />
            </LinearGradient>
          )}
          {item.is_owned ? (
            <View style={[styles.stripOwnedDot, { backgroundColor: colors.primary }]}>
              <Ionicons name="checkmark" size={8} color="#fff" />
            </View>
          ) : null}
          {active ? (
            <View style={[styles.stripActiveBar, { backgroundColor: tint }]} />
          ) : null}
        </View>
        <Text
          style={[styles.stripName, active && { color: colors.white }]}
          numberOfLines={1}
        >
          {shortName}
        </Text>
      </TouchableOpacity>
    );
  }, [colors.primary, colors.white, jumpTo, safeIndex, styles]);

  if (!character) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No characters match this filter yet.</Text>
      </View>
    );
  }

  const ctaLabel = character.is_owned
    ? (isEquipped ? 'View character' : 'View & equip')
    : 'Buy with Bot Bucks';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[rgba(rarityColor, 0.22), 'rgba(10,10,10,0.02)', 'rgba(10,10,10,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.stage, { borderColor: rgba(rarityColor, 0.28) }]}
      >
        {isEquipped ? (
          <View style={[styles.equippedPill, { borderColor: rgba(rarityColor, 0.5) }]}>
            <Ionicons name="sparkles" size={12} color={rarityColor} />
            <Text style={[styles.equippedPillText, { color: rarityColor }]}>EQUIPPED</Text>
          </View>
        ) : null}

        <View style={styles.viewerPress}>
          <Animated.View
            style={[styles.viewer, { transform: [{ translateY: floatY }] }]}
            pointerEvents="none"
          >
            <CharacterPoster
              previewUrl={character.preview_url}
              modelUrl={character.preview_url ? undefined : character.model_url}
              resizeMode="contain"
            />
          </Animated.View>
          {/* Overlay captures swipe + tap — WebView would otherwise eat gestures. */}
          <View
            style={StyleSheet.absoluteFill}
            onLayout={(e) => { stageWidthRef.current = e.nativeEvent.layout.width; }}
            {...panResponder.panHandlers}
          />
        </View>

        {count > 1 ? (
          <>
            <TouchableOpacity
              style={[styles.arrow, styles.arrowLeft]}
              onPress={() => bump(-1)}
              activeOpacity={0.75}
              hitSlop={16}
              accessibilityLabel="Previous character"
            >
              <Ionicons name="chevron-back" size={22} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.arrow, styles.arrowRight]}
              onPress={() => bump(1)}
              activeOpacity={0.75}
              hitSlop={16}
              accessibilityLabel="Next character"
            >
              <Ionicons name="chevron-forward" size={22} color={colors.white} />
            </TouchableOpacity>

            <Text style={styles.swipeHint}>Swipe to browse</Text>
          </>
        ) : null}
      </LinearGradient>

      <View style={styles.dock}>
        <View style={styles.dockTop}>
          <View style={styles.dockTitleCol}>
            <Text style={styles.name} numberOfLines={1}>{character.name}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.rarityChip, { backgroundColor: rgba(rarityColor, 0.16), borderColor: rgba(rarityColor, 0.5) }]}>
                <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
                <Text style={[styles.rarityText, { color: rarityColor }]}>{character.rarity}</Text>
              </View>
              {character.is_owned ? (
                <View style={styles.ownedRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                  <Text style={styles.ownedText}>Owned</Text>
                </View>
              ) : (
                <View style={styles.priceRow}>
                  <Ionicons name="logo-bitcoin" size={15} color={colors.botBucks} />
                  <Text style={styles.priceText}>{character.price}</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.counter}>{safeIndex + 1} / {count}</Text>
        </View>

        {character.description ? (
          <Text style={styles.description} numberOfLines={2}>{character.description}</Text>
        ) : null}

        <PuckButton
          color={character.is_owned ? colors.surfaceElevated : colors.primary}
          borderRadius={16}
          lip={5}
          onPress={() => onOpen?.(character)}
          contentStyle={styles.ctaContent}
        >
          <Text style={[styles.ctaText, character.is_owned && { color: colors.white }]}>
            {ctaLabel}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={character.is_owned ? colors.white : '#0A0A0A'}
          />
        </PuckButton>
      </View>

      <View style={styles.stripWrap}>
        <Text style={styles.stripLabel}>{count} characters</Text>
        <FlatList
          ref={stripRef}
          horizontal
          data={list}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderStripItem}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}
          getItemLayout={(_, i) => ({ length: STRIP_ITEM_W, offset: STRIP_ITEM_W * i, index: i })}
        />
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  root: { flex: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },

  stage: {
    flex: 1,
    minHeight: 220,
    borderRadius: 24,
    borderWidth: 1,
    marginHorizontal: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  equippedPill: {
    position: 'absolute',
    top: 12,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  equippedPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  viewerPress: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewer: { width: '100%', height: '100%', minHeight: 200 },
  arrow: {
    position: 'absolute',
    top: '42%',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  arrowLeft: { left: 10 },
  arrowRight: { right: 10 },
  swipeHint: {
    position: 'absolute',
    bottom: 10,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },

  dock: {
    marginTop: 14,
    marginHorizontal: 20,
    gap: 10,
  },
  dockTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  dockTitleCol: { flex: 1, gap: 8 },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  rarityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  rarityDot: { width: 6, height: 6, borderRadius: 3 },
  rarityText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceText: { fontSize: 16, fontWeight: '800', color: colors.botBucks },
  ownedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownedText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  counter: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: 4 },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A0A0A',
  },

  stripWrap: {
    marginTop: 14,
    paddingBottom: 4,
  },
  stripLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 8,
    paddingHorizontal: 20,
    letterSpacing: 0.3,
  },
  stripContent: {
    paddingHorizontal: 20,
  },
  stripItem: {
    width: STRIP_ITEM_W - 8,
    marginRight: 8,
    alignItems: 'center',
  },
  stripThumb: {
    width: '100%',
    height: 64,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripImage: {
    width: '100%',
    height: '100%',
  },
  stripFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripName: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    maxWidth: '100%',
    textAlign: 'center',
  },
  stripOwnedDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripActiveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
});
