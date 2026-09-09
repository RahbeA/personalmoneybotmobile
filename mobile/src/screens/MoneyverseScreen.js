import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import CharacterPoster from '../components/CharacterPoster';
import { BrandLoader, BrandEmptyState } from '../components/brand';
import { LOADER_MESSAGES, EMPTY_STATES } from '../constants/brandCopy';
import { useTabBarInset } from '../navigation/tabBarLayout';

const RARITY_COLORS = {
  common: '#9AA4B2',
  rare: '#3B9EE3',
  epic: '#9B59B6',
  legendary: '#F5B72B',
};

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

const H_PADDING = 20;
const COL_GAP = 12;
const NUM_COLS = 3;
const SCREEN_W = Dimensions.get('window').width;
const CARD_W = Math.floor((SCREEN_W - H_PADDING * 2 - COL_GAP * (NUM_COLS - 1)) / NUM_COLS);

function rgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function CoinBadge({ amount, styles, colors }) {
  return (
    <View style={styles.coinBadge}>
      <Ionicons name="logo-bitcoin" size={16} color={colors.botBucks} />
      <Text style={styles.coinBadgeText}>{amount}</Text>
    </View>
  );
}

// Thin "distance to price" bar shown on locked (unaffordable) cards so the price
// reads as how far away it is, not just a number.
function BalanceBar({ have, need, color, styles }) {
  const frac = need > 0 ? Math.max(0, Math.min(1, have / need)) : 1;
  return (
    <View style={styles.balanceWrap}>
      <View style={styles.balanceTrack}>
        <View style={[styles.balanceFill, { width: `${frac * 100}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.balanceLabel}>
        <Ionicons name="lock-closed" size={10} color={styles._muted.color} />
        <Ionicons name="logo-bitcoin" size={11} color={styles._coin.color} />
        <Text style={styles.balancePriceText}>{need}</Text>
      </View>
    </View>
  );
}

function CharacterCard({ character, equipped, have, onPress, styles, colors }) {
  const tint = RARITY_COLORS[character.rarity] || colors.primary;
  const canAfford = have >= character.price;
  const owned = !!character.is_owned;
  const locked = !owned && !canAfford;
  const affordable = !owned && canAfford;

  // Green ring in the collection when you can already afford an unowned char.
  const ringColor = equipped
    ? colors.primary
    : affordable
      ? colors.primary
      : 'transparent';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(character)}
      style={[
        styles.card,
        {
          borderColor: ringColor === 'transparent' ? colors.border : ringColor,
          borderWidth: ringColor === 'transparent' ? 1 : 2,
          backgroundColor: equipped ? rgba(colors.primary, 0.08) : colors.surface,
        },
      ]}
      accessibilityLabel={character.name}
    >
      <View style={styles.cardThumb}>
        <CharacterPoster
          previewUrl={character.preview_url}
          modelUrl={character.model_url}
          resizeMode="contain"
        />
        {locked ? (
          <View style={styles.cardLockChip}>
            <Ionicons name="lock-closed" size={10} color={colors.white} />
          </View>
        ) : null}
      </View>

      <Text style={styles.cardName} numberOfLines={1}>{character.name}</Text>

      {equipped ? (
        <View style={styles.cardStatusRow}>
          <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
          <Text style={[styles.cardStatusText, { color: colors.primary }]}>On</Text>
        </View>
      ) : owned ? (
        <View style={styles.cardStatusRow}>
          <Ionicons name="cube-outline" size={12} color={colors.textSecondary} />
          <Text style={styles.cardStatusText}>Owned</Text>
        </View>
      ) : affordable ? (
        <View style={styles.cardStatusRow}>
          <Ionicons name="logo-bitcoin" size={13} color={colors.botBucks} />
          <Text style={[styles.cardStatusText, styles.cardPriceText]}>{character.price}</Text>
        </View>
      ) : (
        <BalanceBar have={have} need={character.price} color={tint} styles={styles} />
      )}
    </TouchableOpacity>
  );
}

export default function MoneyverseScreen({ navigation }) {
  const {
    botBucks,
    equippedCharacter,
    characters,
    loading: progressLoading,
    refreshCharacterCache,
    pendingMoneyverseIntro,
    clearPendingMoneyverseIntro,
  } = useUserProgress();
  const { colors, isDark } = useTheme();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);

  const [refreshing, setRefreshing] = useState(false);

  const loading = progressLoading && characters.length === 0;

  useEffect(() => {
    if (pendingMoneyverseIntro) clearPendingMoneyverseIntro();
  }, [pendingMoneyverseIntro, clearPendingMoneyverseIntro]);

  const ownedCount = useMemo(() => characters.filter((c) => c.is_owned).length, [characters]);
  const totalCount = characters.length;

  // Group present rarities into ordered sections.
  const sections = useMemo(() => {
    const byRarity = {};
    characters.forEach((c) => {
      const key = RARITY_ORDER.includes(c.rarity) ? c.rarity : 'common';
      (byRarity[key] = byRarity[key] || []).push(c);
    });
    return RARITY_ORDER
      .filter((r) => byRarity[r]?.length)
      .map((r) => ({
        rarity: r,
        items: byRarity[r],
        owned: byRarity[r].filter((c) => c.is_owned).length,
        total: byRarity[r].length,
      }));
  }, [characters]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshCharacterCache(true);
    } finally {
      setRefreshing(false);
    }
  }, [refreshCharacterCache]);

  const openCloset = useCallback(
    (character) => {
      if (!character) return;
      navigation.navigate('CharacterDetail', { character });
    },
    [navigation],
  );

  const equipped = equippedCharacter
    || characters.find((c) => c.is_owned)
    || characters[0]
    || null;

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Moneyverse</Text>
          <CoinBadge amount={botBucks} styles={styles} colors={colors} />
        </View>

        {loading ? (
          <BrandLoader message={LOADER_MESSAGES.moneyverse} />
        ) : characters.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyScroll}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          >
            <BrandEmptyState
              title={EMPTY_STATES.moneyverseShop.title}
              body={EMPTY_STATES.moneyverseShop.body}
            />
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          >
            {/* Equipped card — tap to open the Closet on your current character. */}
            {equipped ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => openCloset(equipped)}
                style={styles.equippedCard}
              >
                <View style={styles.equippedAvatar}>
                  <CharacterPoster
                    previewUrl={equipped.preview_url}
                    modelUrl={equipped.model_url}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.equippedCopy}>
                  <Text style={styles.equippedEyebrow}>EQUIPPED</Text>
                  <Text style={styles.equippedName} numberOfLines={1}>{equipped.name}</Text>
                </View>
                <View style={styles.closetBtn}>
                  <Text style={styles.closetBtnText}>Closet</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.white} />
                </View>
              </TouchableOpacity>
            ) : null}

            {/* Collection progress */}
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                {Array.from({ length: totalCount }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.progressSeg,
                      { backgroundColor: i < ownedCount ? colors.primary : colors.border },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.progressText}>{ownedCount}/{totalCount}</Text>
            </View>

            {/* Rarity sections */}
            {sections.map((section) => {
              const tint = RARITY_COLORS[section.rarity] || colors.primary;
              return (
                <View key={section.rarity} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionHeaderLeft}>
                      <View style={[styles.sectionDot, { backgroundColor: tint }]} />
                      <Text style={styles.sectionTitle}>{section.rarity}</Text>
                    </View>
                    <Text style={styles.sectionCount}>{section.owned}/{section.total}</Text>
                  </View>
                  <View style={styles.grid}>
                    {section.items.map((c) => (
                      <CharacterCard
                        key={c.id}
                        character={c}
                        equipped={equippedCharacter?.id === c.id}
                        have={botBucks}
                        onPress={openCloset}
                        styles={styles}
                        colors={colors}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors, tabBarInset) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PADDING,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 30, fontWeight: '800', color: colors.white, letterSpacing: -0.5 },

  coinBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,183,43,0.14)', borderWidth: 1, borderColor: 'rgba(245,183,43,0.35)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  coinBadgeText: { fontSize: 15, fontWeight: '800', color: colors.botBucks },

  scroll: { paddingHorizontal: H_PADDING, paddingBottom: tabBarInset },
  emptyScroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  // Equipped card
  equippedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: rgba(colors.primary, 0.4),
    padding: 12,
    marginBottom: 16,
  },
  equippedAvatar: {
    width: 60,
    height: 60,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: rgba(colors.primary, 0.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  equippedCopy: { flex: 1, minWidth: 0 },
  equippedEyebrow: {
    fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 1.4, marginBottom: 2,
  },
  equippedName: { fontSize: 20, fontWeight: '800', color: colors.white, letterSpacing: -0.3 },
  closetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    paddingLeft: 14, paddingRight: 10, paddingVertical: 9,
    borderWidth: 1, borderColor: colors.border,
  },
  closetBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },

  // Progress
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  progressTrack: { flex: 1, flexDirection: 'row', gap: 4 },
  progressSeg: { flex: 1, height: 6, borderRadius: 3 },
  progressText: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },

  // Sections
  section: { marginBottom: 22 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDot: { width: 9, height: 9, borderRadius: 5 },
  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: colors.white, textTransform: 'capitalize', letterSpacing: -0.2,
  },
  sectionCount: { fontSize: 13, fontWeight: '700', color: colors.textMuted },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: COL_GAP },

  // Card
  card: {
    width: CARD_W,
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
  },
  cardThumb: {
    width: '100%',
    height: CARD_W - 20,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cardLockChip: {
    position: 'absolute',
    top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardName: {
    fontSize: 13, fontWeight: '800', color: colors.white, textAlign: 'center', maxWidth: '100%',
  },
  cardStatusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, height: 18,
  },
  cardStatusText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  cardPriceText: { color: colors.botBucks, fontWeight: '800' },

  // Balance bar (locked cards)
  balanceWrap: { width: '100%', marginTop: 6, gap: 4 },
  balanceTrack: {
    width: '100%', height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden',
  },
  balanceFill: { height: '100%', borderRadius: 3 },
  balanceLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  balancePriceText: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },

  // helpers so BalanceBar can read theme colors without another hook
  _muted: { color: colors.textMuted },
  _coin: { color: colors.botBucks },
});
