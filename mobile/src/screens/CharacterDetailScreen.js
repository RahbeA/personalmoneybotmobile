import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { requireAccount } from '../utils/requireAccount';
import CharacterViewer from '../components/CharacterViewer';
import CharacterPoster from '../components/CharacterPoster';
import PuckButton from '../components/PuckButton';

const RARITY_COLORS = {
  common: '#9AA4B2',
  rare: '#3B9EE3',
  epic: '#9B59B6',
  legendary: '#F5B72B',
};

const STRIP_ITEM_W = 64;

function rgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// The Closet: one big stage you can browse, "try on" via the eye button, and
// buy/equip from. Data model + purchase/equip actions are unchanged.
export default function CharacterDetailScreen({ navigation, route }) {
  const routeCharacter = route.params?.character;
  const { isGuest } = useAuth();
  const {
    botBucks, equippedCharacter, characters,
    purchaseCharacter, equipCharacter, refreshCharacterCache,
  } = useUserProgress();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isFocused = useIsFocused();
  const stripRef = useRef(null);

  // Browse the live context list so ownership/equipped stay in sync. Fall back
  // to the single character we were opened with if the list isn't ready.
  const list = characters?.length ? characters : (routeCharacter ? [routeCharacter] : []);

  const initialIndex = useMemo(() => {
    const i = list.findIndex((c) => c.id === routeCharacter?.id);
    return i >= 0 ? i : 0;
  }, [list, routeCharacter?.id]);

  const [index, setIndex] = useState(initialIndex);
  // The eye button "tries on" a character in live 3D without spending. Reset
  // whenever you browse away so it clears, per spec.
  const [previewOn, setPreviewOn] = useState(false);
  const [busy, setBusy] = useState(false);
  // Instant ownership feedback after a purchase, before the cache reloads.
  const [ownedOverride, setOwnedOverride] = useState({});

  const count = list.length;
  const safeIndex = count ? Math.min(Math.max(0, index), count - 1) : 0;
  const character = count ? list[safeIndex] : null;

  const rarityColor = character ? (RARITY_COLORS[character.rarity] || colors.primary) : colors.primary;
  const owned = character ? (!!character.is_owned || !!ownedOverride[character.id]) : false;
  const isEquipped = character && equippedCharacter?.id === character.id;
  const canAfford = character ? botBucks >= character.price : false;

  const select = useCallback((i) => {
    if (i < 0 || i >= count) return;
    setIndex(i);
    setPreviewOn(false); // clears the try-on when you browse away
  }, [count]);

  const bump = useCallback((delta) => {
    if (!count) return;
    const next = ((safeIndex + delta) % count + count) % count;
    select(next);
  }, [count, safeIndex, select]);

  // Keep the active thumbnail roughly centered.
  useEffect(() => {
    if (!stripRef.current || !count) return;
    const x = Math.max(0, safeIndex * STRIP_ITEM_W - STRIP_ITEM_W * 2);
    try { stripRef.current.scrollToOffset({ offset: x, animated: true }); } catch { /* noop */ }
  }, [safeIndex, count]);

  async function handleBuy() {
    if (busy || !character) return;
    if (!requireAccount({ isGuest, navigation, feature: 'buy characters with Bot Bucks' })) return;
    if (!canAfford) {
      Alert.alert('Not enough Bot Bucks', `You need ${character.price - botBucks} more Bot Bucks. Complete more lessons to earn them!`);
      return;
    }
    setBusy(true);
    try {
      await purchaseCharacter(character.id);
      setOwnedOverride((m) => ({ ...m, [character.id]: true }));
      refreshCharacterCache(true).catch(() => {});
      Alert.alert('Purchased!', `${character.name} is now yours. Tap Equip to wear it.`);
    } catch (e) {
      Alert.alert('Purchase failed', e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function handleEquip() {
    if (busy || !character) return;
    if (!requireAccount({ isGuest, navigation, feature: 'equip characters' })) return;
    setBusy(true);
    try {
      await equipCharacter(character.id);
    } catch (e) {
      Alert.alert('Could not equip', e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const renderStripItem = useCallback(({ item, index: i }) => {
    const tint = RARITY_COLORS[item.rarity] || colors.primary;
    const active = i === safeIndex;
    const itemOwned = !!item.is_owned || !!ownedOverride[item.id];
    const locked = !itemOwned && botBucks < item.price;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => select(i)}
        style={[
          styles.stripThumb,
          {
            borderColor: active ? tint : rgba(tint, 0.3),
            backgroundColor: rgba(tint, active ? 0.22 : 0.1),
          },
        ]}
        accessibilityLabel={item.name}
      >
        <CharacterPoster
          previewUrl={item.preview_url}
          modelUrl={item.model_url}
          resizeMode="contain"
        />
        {itemOwned ? (
          <View style={[styles.stripDot, { backgroundColor: colors.primary }]}>
            <Ionicons name="checkmark" size={8} color="#fff" />
          </View>
        ) : locked ? (
          <View style={styles.stripLock}>
            <Ionicons name="lock-closed" size={9} color={colors.white} />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }, [colors, safeIndex, ownedOverride, botBucks, select, styles]);

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Closet</Text>
          <View style={styles.coinBadge}>
            <Ionicons name="logo-bitcoin" size={16} color={colors.botBucks} />
            <Text style={styles.coinBadgeText}>{botBucks}</Text>
          </View>
        </View>

        {!character ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No character selected.</Text>
          </View>
        ) : (
          <>
            {/* Stage */}
            <View style={styles.stage}>
              {isFocused && previewOn ? (
                <CharacterViewer
                  modelUrl={character.model_url}
                  previewUrl={character.preview_url}
                  autoRotate
                  allowDrag
                />
              ) : (
                <CharacterPoster
                  previewUrl={character.preview_url}
                  modelUrl={character.model_url}
                  resizeMode="contain"
                />
              )}

              {count > 1 ? (
                <>
                  <TouchableOpacity
                    style={[styles.arrow, styles.arrowLeft]}
                    onPress={() => bump(-1)}
                    hitSlop={16}
                    accessibilityLabel="Previous character"
                  >
                    <Ionicons name="chevron-back" size={22} color={colors.white} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.arrow, styles.arrowRight]}
                    onPress={() => bump(1)}
                    hitSlop={16}
                    accessibilityLabel="Next character"
                  >
                    <Ionicons name="chevron-forward" size={22} color={colors.white} />
                  </TouchableOpacity>
                </>
              ) : null}

              {previewOn ? (
                <Text style={styles.dragHint}>Drag to rotate</Text>
              ) : null}
            </View>

            {/* Meta */}
            <View style={styles.metaRow}>
              <View style={[styles.rarityChip, { backgroundColor: rgba(rarityColor, 0.16), borderColor: rgba(rarityColor, 0.5) }]}>
                <Text style={[styles.rarityChipText, { color: rarityColor }]}>{character.rarity}</Text>
              </View>
              {isEquipped ? (
                <View style={styles.equippedChip}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                  <Text style={styles.equippedChipText}>EQUIPPED</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.name}>{character.name}</Text>

            {/* Locked: show the balance as distance to the price. */}
            {!owned && !canAfford ? (
              <View style={styles.balanceRow}>
                <View style={styles.balanceTrack}>
                  <View
                    style={[
                      styles.balanceFill,
                      { width: `${Math.min(1, botBucks / character.price) * 100}%`, backgroundColor: rarityColor },
                    ]}
                  />
                </View>
                <Text style={styles.balanceText}>
                  {botBucks} / {character.price}
                </Text>
              </View>
            ) : null}

            {/* Actions: eye = try on (no spend), primary = buy/equip */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => setPreviewOn((v) => !v)}
                style={[styles.eyeBtn, previewOn && styles.eyeBtnActive]}
                accessibilityLabel="Preview in 3D"
              >
                <Ionicons
                  name={previewOn ? 'eye' : 'eye-outline'}
                  size={22}
                  color={previewOn ? colors.background : colors.white}
                />
              </TouchableOpacity>

              <View style={styles.primaryWrap}>
                {owned ? (
                  isEquipped ? (
                    <PuckButton color="#1E3D28" borderRadius={16} lip={5} contentStyle={[styles.ctaContent, styles.ctaEquipped]}>
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      <Text style={[styles.ctaText, { color: colors.primary }]}>Equipped</Text>
                    </PuckButton>
                  ) : (
                    <PuckButton color={colors.primary} borderRadius={16} lip={5} onPress={handleEquip} disabled={busy} contentStyle={styles.ctaContent}>
                      {busy ? (
                        <ActivityIndicator color={colors.background} />
                      ) : (
                        <>
                          <Ionicons name="shirt-outline" size={20} color={colors.background} />
                          <Text style={styles.ctaText}>Equip</Text>
                        </>
                      )}
                    </PuckButton>
                  )
                ) : (
                  <PuckButton
                    color={!isGuest && !canAfford ? colors.surfaceElevated : colors.primary}
                    borderRadius={16}
                    lip={5}
                    onPress={handleBuy}
                    disabled={busy}
                    contentStyle={styles.ctaContent}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.background} />
                    ) : isGuest ? (
                      <>
                        <Ionicons name="lock-closed" size={18} color={colors.background} />
                        <Text style={styles.ctaText}>Create account to buy</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="logo-bitcoin" size={20} color={canAfford ? colors.background : colors.textMuted} />
                        <Text style={[styles.ctaText, !canAfford && styles.ctaTextDisabled]}>
                          {canAfford ? `Buy for ${character.price}` : `${character.price - botBucks} more to unlock`}
                        </Text>
                      </>
                    )}
                  </PuckButton>
                )}
              </View>
            </View>

            {/* Thumbnail strip */}
            <FlatList
              ref={stripRef}
              horizontal
              data={list}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderStripItem}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stripContent}
              getItemLayout={(_, i) => ({ length: STRIP_ITEM_W, offset: STRIP_ITEM_W * i, index: i })}
              style={styles.strip}
            />
          </>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 14 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  topTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  coinBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,183,43,0.14)', borderWidth: 1, borderColor: 'rgba(245,183,43,0.35)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  coinBadgeText: { fontSize: 15, fontWeight: '800', color: colors.botBucks },

  stage: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 4,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  arrow: {
    position: 'absolute',
    top: '46%',
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
  dragHint: {
    position: 'absolute', bottom: 12, alignSelf: 'center',
    fontSize: 12, color: colors.textMuted, fontWeight: '500',
  },

  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, marginTop: 16,
  },
  rarityChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  rarityChipText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  equippedChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  equippedChipText: { fontSize: 12, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 },
  name: {
    fontSize: 30, fontWeight: '800', color: colors.white, letterSpacing: -0.5,
    paddingHorizontal: 20, marginTop: 8,
  },

  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginTop: 14 },
  balanceTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  balanceFill: { height: '100%', borderRadius: 3 },
  balanceText: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },

  actionRow: {
    flexDirection: 'row', alignItems: 'stretch', gap: 12,
    paddingHorizontal: 20, marginTop: 14,
  },
  eyeBtn: {
    width: 58, borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  eyeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  primaryWrap: { flex: 1 },
  ctaContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 18,
  },
  ctaEquipped: {
    backgroundColor: 'rgba(61,220,95,0.12)',
    borderWidth: 1, borderColor: 'rgba(61,220,95,0.3)', borderRadius: 16,
  },
  ctaText: { fontSize: 17, fontWeight: '800', color: colors.background },
  ctaTextDisabled: { color: colors.textMuted },

  strip: { flexGrow: 0, marginTop: 18 },
  stripContent: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  stripThumb: {
    width: STRIP_ITEM_W - 8,
    height: STRIP_ITEM_W - 8,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripDot: {
    position: 'absolute', top: 3, right: 3,
    width: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  stripLock: {
    position: 'absolute', top: 3, right: 3,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
});
