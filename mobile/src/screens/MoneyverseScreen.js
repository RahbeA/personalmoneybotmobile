import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import FeaturedCharacter from '../components/FeaturedCharacter';
import { BrandLoader, BrandEmptyState } from '../components/brand';
import ScreenAppBar, { screenAppBarTitleStyles } from '../components/ScreenAppBar';
import PuckButton from '../components/PuckButton';
import { LOADER_MESSAGES, EMPTY_STATES } from '../constants/brandCopy';
import { useTabBarInset } from '../navigation/tabBarLayout';

const RARITY_COLORS = {
  common: '#9AA4B2',
  rare: '#3B9EE3',
  epic: '#9B59B6',
  legendary: '#F5B72B',
};

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

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
  const tabBarInset = useTabBarInset(16);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);
  const titleStyles = useMemo(() => screenAppBarTitleStyles(colors), [colors]);

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [index, setIndex] = useState(0);

  const loading = progressLoading && characters.length === 0;

  useEffect(() => {
    if (pendingMoneyverseIntro) clearPendingMoneyverseIntro();
  }, [pendingMoneyverseIntro, clearPendingMoneyverseIntro]);

  const ownedCount = useMemo(() => characters.filter((c) => c.is_owned).length, [characters]);
  const totalCount = characters.length;

  const availableRarities = useMemo(() => {
    const present = new Set(characters.map((c) => c.rarity));
    return RARITY_ORDER.filter((r) => present.has(r));
  }, [characters]);

  const visibleCharacters = useMemo(() => {
    if (filter === 'all') return characters;
    if (filter === 'owned') return characters.filter((c) => c.is_owned);
    return characters.filter((c) => c.rarity === filter);
  }, [characters, filter]);

  // Snap index when the filter changes. Prefer equipped character on "all".
  useEffect(() => {
    if (!visibleCharacters.length) {
      setIndex(0);
      return;
    }
    if (filter === 'all' && equippedCharacter?.id) {
      const eq = visibleCharacters.findIndex((c) => c.id === equippedCharacter.id);
      setIndex(eq >= 0 ? eq : 0);
      return;
    }
    setIndex(0);
    // Only re-snap when the user changes filter — not on every characters refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Clamp if the list shrinks under the current index.
  useEffect(() => {
    setIndex((i) => (visibleCharacters.length ? Math.min(i, visibleCharacters.length - 1) : 0));
  }, [visibleCharacters.length]);

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

  const openCharacter = useCallback(
    (character) => navigation.navigate('CharacterDetail', { character }),
    [navigation],
  );

  const subtitle = totalCount
    ? `${ownedCount} / ${totalCount} collected · swipe to shop`
    : 'Collect characters with Bot Bucks';

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenAppBar
          showBack={false}
          rightActions={<CoinBadge amount={botBucks} styles={styles} colors={colors} />}
        >
          <View style={styles.identity}>
            <View style={styles.identityAvatar}>
              <Ionicons name="planet" size={18} color={colors.primary} />
            </View>
            <View style={styles.identityCopy}>
              <Text style={titleStyles.title} numberOfLines={1}>Moneyverse</Text>
              <Text style={titleStyles.eyebrow} numberOfLines={1}>{subtitle}</Text>
            </View>
          </View>
        </ScreenAppBar>

        {loading ? (
          <BrandLoader message={LOADER_MESSAGES.moneyverse} />
        ) : (
          <View style={styles.body}>
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
                  <PuckButton
                    key={f.key}
                    color={active ? tint : colors.surfaceElevated}
                    borderRadius={999}
                    lip={5}
                    onPress={() => setFilter(f.key)}
                    contentStyle={styles.filterChipContent}
                    accessibilityLabel={`Filter ${f.label}`}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {f.label}
                    </Text>
                  </PuckButton>
                );
              })}
            </ScrollView>

            {characters.length === 0 ? (
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
              <View style={styles.showcase}>
                <FeaturedCharacter
                  characters={visibleCharacters}
                  index={index}
                  onIndexChange={setIndex}
                  onOpen={openCharacter}
                  equippedId={equippedCharacter?.id}
                />
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors, tabBarInset) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    height: 44,
  },
  identityAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    flexShrink: 0,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  coinBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,183,43,0.14)', borderWidth: 1, borderColor: 'rgba(245,183,43,0.35)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  coinBadgeText: { fontSize: 15, fontWeight: '800', color: colors.botBucks },
  body: { flex: 1, paddingBottom: tabBarInset },
  emptyScroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  showcase: { flex: 1 },

  filterScroll: { flexGrow: 0, marginBottom: 12, maxHeight: 52 },
  filterRow: { gap: 8, paddingHorizontal: 20, paddingRight: 24, alignItems: 'center' },
  filterChipContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChipText: {
    fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
});
