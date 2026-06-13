import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useUserProgress } from '../context/UserProgressContext';
import { moneyverseApi } from '../api/moneyverse';
import { useTheme } from '../context/ThemeContext';
import CharacterViewer from '../components/CharacterViewer';
import { BrandLoader, BrandHeader, BrandEmptyState } from '../components/brand';
import { LOADER_MESSAGES, EMPTY_STATES } from '../constants/brandCopy';
import { preloadModels } from '../utils/modelCache';

const RARITY_COLORS = {
  common: '#9AA4B2',
  rare: '#3B9EE3',
  epic: '#9B59B6',
  legendary: '#F5B72B',
};

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = (SCREEN_W - 20 * 2 - 14) / 2;

function CoinBadge({ amount, styles, colors }) {
  return (
    <View style={styles.coinBadge}>
      <Ionicons name="logo-bitcoin" size={16} color={colors.botBucks} />
      <Text style={styles.coinBadgeText}>{amount}</Text>
    </View>
  );
}

export default function MoneyverseScreen({ navigation }) {
  const { token } = useAuth();
  const { botBucks, equippedCharacter } = useUserProgress();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [characters, setCharacters] = useState([]);
  const [equippedId, setEquippedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await moneyverseApi.getCharacters(token);
      const list = data.characters || [];
      setCharacters(list);
      setEquippedId(data.equipped_character_id ?? null);
      preloadModels(list.map((c) => c.model_url));
    } catch (e) {
      // fail silently — offline or server not running
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const equipped = equippedCharacter || characters.find((c) => c.id === equippedId);

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <BrandHeader
          title="Moneyverse"
          subtitle="Spend Bot Bucks on characters"
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
            {/* Hero / equipped centerpiece */}
            <LinearGradient
              colors={['rgba(61,220,95,0.16)', 'rgba(61,220,95,0.03)']}
              style={styles.hero}
            >
              {equipped ? (
                <>
                  <View style={styles.heroViewer}>
                    <CharacterViewer
                      modelUrl={equipped.model_url}
                      previewUrl={equipped.preview_url}
                      autoRotate
                      allowDrag
                    />
                  </View>
                  <Text style={styles.heroLabel}>YOUR CHARACTER</Text>
                  <Text style={styles.heroName}>{equipped.name}</Text>
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

            <Text style={styles.sectionTitle}>Character Shop</Text>

            {characters.length === 0 ? (
              <BrandEmptyState
                title={EMPTY_STATES.moneyverseShop.title}
                body={EMPTY_STATES.moneyverseShop.body}
                style={styles.emptyShopBrand}
              />
            ) : (
              <View style={styles.grid}>
                {characters.map((c) => {
                  const rarityColor = RARITY_COLORS[c.rarity] || colors.primary;
                  const isEquipped = c.id === equippedId;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.card}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('CharacterDetail', { character: c })}
                    >
                      <View style={styles.cardViewer}>
                        <CharacterViewer
                          modelUrl={c.model_url}
                          previewUrl={c.preview_url}
                          autoRotate
                        />
                        {c.is_owned && (
                          <View style={[styles.ownedTag, isEquipped && styles.equippedTag]}>
                            <Ionicons
                              name={isEquipped ? 'checkmark-circle' : 'bag-check'}
                              size={12}
                              color="#fff"
                            />
                            <Text style={styles.ownedTagText}>{isEquipped ? 'Equipped' : 'Owned'}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.cardBody}>
                        <Text style={styles.cardName} numberOfLines={1}>{c.name}</Text>
                        <View style={styles.cardMetaRow}>
                          <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
                          <Text style={[styles.rarityText, { color: rarityColor }]}>{c.rarity}</Text>
                          <View style={{ flex: 1 }} />
                          {c.is_owned ? (
                            <Text style={styles.ownedPrice}>Owned</Text>
                          ) : (
                            <View style={styles.priceRow}>
                              <Ionicons name="logo-bitcoin" size={13} color="#F5B72B" />
                              <Text style={styles.priceText}>{c.price}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  brandHeader: { paddingHorizontal: 20 },
  coinBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,183,43,0.14)', borderWidth: 1, borderColor: 'rgba(245,183,43,0.35)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  coinBadgeText: { fontSize: 15, fontWeight: '800', color: colors.botBucks },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
  hero: {
    borderRadius: 24, padding: 18, alignItems: 'center', marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(61,220,95,0.25)',
  },
  heroViewer: { width: '100%', height: 240 },
  heroLabel: { fontSize: 12, fontWeight: '700', color: colors.primary, letterSpacing: 1, marginTop: 8 },
  heroName: { fontSize: 22, fontWeight: '800', color: colors.white, marginTop: 4, letterSpacing: -0.3 },
  heroEmptyBrand: { paddingVertical: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.white, marginBottom: 14, letterSpacing: -0.2 },
  emptyShopBrand: { paddingVertical: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: {
    width: CARD_W, borderRadius: 18, overflow: 'hidden',
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  cardViewer: { height: 150, backgroundColor: 'rgba(127,127,127,0.06)' },
  ownedTag: {
    position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(96,96,96,0.9)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
  },
  equippedTag: { backgroundColor: colors.primaryDark },
  ownedTagText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  cardBody: { padding: 12 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.white, marginBottom: 6 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rarityDot: { width: 8, height: 8, borderRadius: 4 },
  rarityText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  priceText: { fontSize: 14, fontWeight: '800', color: '#F5B72B' },
  ownedPrice: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
