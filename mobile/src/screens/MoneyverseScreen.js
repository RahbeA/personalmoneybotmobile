import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import CharacterViewer from '../components/CharacterViewer';
import { BrandLoader, BrandHeader, BrandEmptyState } from '../components/brand';
import { LOADER_MESSAGES, EMPTY_STATES } from '../constants/brandCopy';
import { useTabBarInset } from '../navigation/tabBarLayout';

const RARITY_COLORS = {
  common: '#9AA4B2',
  rare: '#3B9EE3',
  epic: '#9B59B6',
  legendary: '#F5B72B',
};

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = (SCREEN_W - 20 * 2 - 14) / 2;

// Deterministic-ish scattered star positions (generated once).
const STARS = Array.from({ length: 22 }).map((_, i) => ({
  key: i,
  top: `${(i * 37 + 11) % 92}%`,
  left: `${(i * 53 + 7) % 94}%`,
  size: (i % 3) + 1.5,
  opacity: 0.18 + ((i * 7) % 5) * 0.08,
}));

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

function Starfield({ styles }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STARS.map((s) => (
        <View
          key={s.key}
          style={[
            styles.star,
            { top: s.top, left: s.left, width: s.size, height: s.size, opacity: s.opacity },
          ]}
        />
      ))}
    </View>
  );
}

function RarityChip({ rarity, styles }) {
  const color = RARITY_COLORS[rarity] || '#9AA4B2';
  return (
    <View style={[styles.rarityChip, { backgroundColor: rgba(color, 0.16), borderColor: rgba(color, 0.5) }]}>
      <View style={[styles.rarityDot, { backgroundColor: color }]} />
      <Text style={[styles.rarityChipText, { color }]}>{rarity}</Text>
    </View>
  );
}

export default function MoneyverseScreen({ navigation }) {
  const {
    botBucks,
    equippedCharacter,
    characters,
    loading: progressLoading,
    refreshCharacterCache,
  } = useUserProgress();
  const { colors, isDark } = useTheme();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const loading = progressLoading && characters.length === 0;
  const equipped = equippedCharacter;
  const equippedRarityColor = RARITY_COLORS[equipped?.rarity] || colors.primary;

  // Gentle floating animation for the hero character.
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
  const floatY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [6, -10] });
  const platformScale = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] });

  const ownedCount = useMemo(() => characters.filter((c) => c.is_owned).length, [characters]);
  const totalCount = characters.length;
  const collectionPct = totalCount ? Math.round((ownedCount / totalCount) * 100) : 0;

  const availableRarities = useMemo(() => {
    const present = new Set(characters.map((c) => c.rarity));
    return RARITY_ORDER.filter((r) => present.has(r));
  }, [characters]);

  const visibleCharacters = useMemo(() => {
    if (filter === 'all') return characters;
    if (filter === 'owned') return characters.filter((c) => c.is_owned);
    return characters.filter((c) => c.rarity === filter);
  }, [characters, filter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshCharacterCache(true);
    } finally {
      setRefreshing(false);
    }
  }, [refreshCharacterCache]);

  const filters = useMemo(
    () => [
      { key: 'all', label: 'All' },
      { key: 'owned', label: 'Owned' },
      ...availableRarities.map((r) => ({ key: r, label: r })),
    ],
    [availableRarities],
  );

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <BrandHeader
          title="Moneyverse"
          subtitle="Collect characters with Bot Bucks"
          style={styles.brandHeader}
          right={<CoinBadge amount={botBucks} styles={styles} colors={colors} />}
        />

        {loading ? (
          <BrandLoader message={LOADER_MESSAGES.moneyverse} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          >
            {/* Immersive hero stage */}
            <View style={styles.heroWrap}>
              <LinearGradient
                colors={
                  equipped
                    ? [rgba(equippedRarityColor, 0.22), 'rgba(10,10,10,0.05)', 'rgba(10,10,10,0)']
                    : ['rgba(61,220,95,0.16)', 'rgba(10,10,10,0.02)', 'rgba(10,10,10,0)']
                }
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[styles.hero, { borderColor: rgba(equippedRarityColor, 0.28) }]}
              >
                <Starfield styles={styles} />

                {equipped ? (
                  <>
                    <View style={styles.heroTopRow}>
                      <View style={[styles.equippedPill, { borderColor: rgba(equippedRarityColor, 0.5) }]}>
                        <Ionicons name="sparkles" size={12} color={equippedRarityColor} />
                        <Text style={[styles.equippedPillText, { color: equippedRarityColor }]}>EQUIPPED</Text>
                      </View>
                    </View>

                    {/* Glow halo behind the character */}
                    <View
                      style={[styles.heroGlow, { backgroundColor: rgba(equippedRarityColor, 0.28) }]}
                      pointerEvents="none"
                    />

                    <Animated.View style={[styles.heroViewer, { transform: [{ translateY: floatY }] }]}>
                      <CharacterViewer
                        modelUrl={equipped.model_url}
                        previewUrl={equipped.preview_url}
                        autoRotate
                        allowDrag
                      />
                    </Animated.View>

                    {/* Floating platform shadow */}
                    <Animated.View
                      style={[
                        styles.platform,
                        { backgroundColor: rgba(equippedRarityColor, 0.35), transform: [{ scaleX: platformScale }] },
                      ]}
                      pointerEvents="none"
                    />

                    <Text style={styles.heroName}>{equipped.name}</Text>
                    <RarityChip rarity={equipped.rarity} styles={styles} />
                  </>
                ) : (
                  <BrandEmptyState
                    title={EMPTY_STATES.moneyverseHero.title}
                    body={EMPTY_STATES.moneyverseHero.body}
                    avatarSize={80}
                    style={styles.heroEmptyBrand}
                  />
                )}
              </LinearGradient>
            </View>

            {/* Collection progress */}
            {totalCount > 0 && (
              <View style={styles.collectionCard}>
                <View style={styles.collectionTop}>
                  <View style={styles.collectionLabelRow}>
                    <Ionicons name="library" size={15} color={colors.primary} />
                    <Text style={styles.collectionLabel}>Collection</Text>
                  </View>
                  <Text style={styles.collectionCount}>
                    <Text style={styles.collectionCountStrong}>{ownedCount}</Text>
                    {` / ${totalCount}`}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${collectionPct}%` }]} />
                </View>
              </View>
            )}

            {/* Filter chips */}
            {filters.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                style={styles.filterScroll}
              >
                {filters.map((f) => {
                  const active = filter === f.key;
                  const tint = RARITY_COLORS[f.key] || colors.primary;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      activeOpacity={0.85}
                      onPress={() => setFilter(f.key)}
                      style={[
                        styles.filterChip,
                        active && { backgroundColor: rgba(tint, 0.16), borderColor: rgba(tint, 0.55) },
                      ]}
                    >
                      <Text style={[styles.filterChipText, active && { color: tint }]}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {characters.length === 0 ? (
              <BrandEmptyState
                title={EMPTY_STATES.moneyverseShop.title}
                body={EMPTY_STATES.moneyverseShop.body}
                style={styles.emptyShopBrand}
              />
            ) : (
              <View style={styles.grid}>
                {visibleCharacters.map((c) => {
                  const rarityColor = RARITY_COLORS[c.rarity] || colors.primary;
                  const isEquipped = equippedCharacter?.id === c.id;
                  const canAfford = botBucks >= c.price;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.card, { borderColor: rgba(rarityColor, isEquipped ? 0.6 : 0.28) }]}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('CharacterDetail', { character: c })}
                    >
                      <LinearGradient
                        colors={[rgba(rarityColor, 0.18), 'rgba(127,127,127,0.04)']}
                        style={styles.cardViewer}
                      >
                        <CharacterViewer
                          modelUrl={c.model_url}
                          previewUrl={c.preview_url}
                          autoRotate
                        />
                        {c.is_owned ? (
                          <View style={[styles.ownedTag, isEquipped && styles.equippedTag]}>
                            <Ionicons
                              name={isEquipped ? 'checkmark-circle' : 'bag-check'}
                              size={12}
                              color="#fff"
                            />
                            <Text style={styles.ownedTagText}>{isEquipped ? 'Equipped' : 'Owned'}</Text>
                          </View>
                        ) : (
                          <View style={[styles.rarityTag, { backgroundColor: rgba(rarityColor, 0.9) }]}>
                            <Text style={styles.rarityTagText}>{c.rarity}</Text>
                          </View>
                        )}
                      </LinearGradient>
                      <View style={styles.cardBody}>
                        <Text style={styles.cardName} numberOfLines={1}>{c.name}</Text>
                        <View style={styles.cardMetaRow}>
                          {c.is_owned ? (
                            <View style={styles.ownedPriceRow}>
                              <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                              <Text style={styles.ownedPrice}>In collection</Text>
                            </View>
                          ) : (
                            <View style={styles.priceRow}>
                              <Ionicons
                                name="logo-bitcoin"
                                size={14}
                                color={canAfford ? colors.botBucks : colors.textMuted}
                              />
                              <Text style={[styles.priceText, !canAfford && styles.priceTextLocked]}>
                                {c.price}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors, tabBarInset) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  brandHeader: { paddingHorizontal: 20 },
  coinBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,183,43,0.14)', borderWidth: 1, borderColor: 'rgba(245,183,43,0.35)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  coinBadgeText: { fontSize: 15, fontWeight: '800', color: colors.botBucks },
  scroll: { paddingHorizontal: 20, paddingBottom: tabBarInset },

  // Hero stage
  heroWrap: { marginBottom: 20 },
  hero: {
    borderRadius: 28, paddingTop: 16, paddingBottom: 22, paddingHorizontal: 18,
    alignItems: 'center', borderWidth: 1, overflow: 'hidden',
  },
  star: {
    position: 'absolute', borderRadius: 4, backgroundColor: '#FFFFFF',
  },
  heroTopRow: { width: '100%', alignItems: 'center', marginBottom: 4 },
  equippedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
  },
  equippedPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  heroGlow: {
    position: 'absolute', top: 70, alignSelf: 'center',
    width: 220, height: 220, borderRadius: 110,
    // Soft radial-like halo (blur approximated with large translucent circle).
  },
  heroViewer: { width: '100%', height: 250 },
  platform: {
    width: 150, height: 18, borderRadius: 999, marginTop: -6, marginBottom: 12,
    opacity: 0.7,
  },
  heroName: { fontSize: 24, fontWeight: '800', color: colors.white, letterSpacing: -0.4, marginBottom: 8 },
  heroEmptyBrand: { paddingVertical: 28 },

  // Rarity chip (shared)
  rarityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1,
  },
  rarityDot: { width: 7, height: 7, borderRadius: 4 },
  rarityChipText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize', letterSpacing: 0.3 },

  // Collection progress
  collectionCard: {
    backgroundColor: colors.surfaceElevated, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 18,
  },
  collectionTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  collectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  collectionLabel: { fontSize: 14, fontWeight: '700', color: colors.white, letterSpacing: 0.2 },
  collectionCount: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  collectionCountStrong: { color: colors.white, fontWeight: '800' },
  progressTrack: {
    height: 8, borderRadius: 999, backgroundColor: 'rgba(127,127,127,0.18)', overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.primary },

  // Filters
  filterScroll: { marginBottom: 16 },
  filterRow: { gap: 8, paddingRight: 4 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  filterChipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'capitalize' },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: {
    width: CARD_W, borderRadius: 20, overflow: 'hidden',
    backgroundColor: colors.surfaceElevated, borderWidth: 1,
  },
  cardViewer: { height: 152 },
  ownedTag: {
    position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(96,96,96,0.9)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
  },
  equippedTag: { backgroundColor: colors.primaryDark },
  ownedTagText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  rarityTag: {
    position: 'absolute', top: 8, left: 8, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  rarityTagText: { fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'capitalize', letterSpacing: 0.3 },
  cardBody: { padding: 12 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.white, marginBottom: 8 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceText: { fontSize: 15, fontWeight: '800', color: colors.botBucks },
  priceTextLocked: { color: colors.textMuted },
  ownedPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownedPrice: { fontSize: 13, fontWeight: '700', color: colors.primary },
  emptyShopBrand: { paddingVertical: 16 },
});
