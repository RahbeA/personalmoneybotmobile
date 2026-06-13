import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import CharacterViewer from '../components/CharacterViewer';

const RARITY_COLORS = {
  common: '#9AA4B2',
  rare: '#3B9EE3',
  epic: '#9B59B6',
  legendary: '#F5B72B',
};

export default function CharacterDetailScreen({ navigation, route }) {
  const { character } = route.params;
  const { botBucks, equippedCharacter, purchaseCharacter, equipCharacter } = useUserProgress();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [owned, setOwned] = useState(!!character.is_owned);
  const [busy, setBusy] = useState(false);

  const isEquipped = equippedCharacter?.id === character.id;
  const rarityColor = RARITY_COLORS[character.rarity] || colors.primary;
  const canAfford = botBucks >= character.price;

  async function handleBuy() {
    if (busy) return;
    if (!canAfford) {
      Alert.alert('Not enough Bot Bucks', `You need ${character.price - botBucks} more Bot Bucks. Complete more lessons to earn them!`);
      return;
    }
    setBusy(true);
    try {
      await purchaseCharacter(character.id);
      setOwned(true);
      Alert.alert('Purchased!', `${character.name} is now yours. Equip it to make it your character.`);
    } catch (e) {
      Alert.alert('Purchase failed', e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function handleEquip() {
    if (busy) return;
    setBusy(true);
    try {
      await equipCharacter(character.id);
    } catch (e) {
      Alert.alert('Could not equip', e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.coinBadge}>
            <Ionicons name="logo-bitcoin" size={16} color="#F5B72B" />
            <Text style={styles.coinBadgeText}>{botBucks}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.viewerWrap}>
            <CharacterViewer
              modelUrl={character.model_url}
              previewUrl={character.preview_url}
              autoRotate
              allowDrag
            />
            <Text style={styles.dragHint}>Drag to rotate</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.name}>{character.name}</Text>
            <View style={[styles.rarityChip, { backgroundColor: rarityColor + '22', borderColor: rarityColor + '55' }]}>
              <Text style={[styles.rarityChipText, { color: rarityColor }]}>{character.rarity}</Text>
            </View>
          </View>

          {character.description ? (
            <Text style={styles.description}>{character.description}</Text>
          ) : null}

          {!owned && (
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>Price</Text>
              <View style={styles.priceRow}>
                <Ionicons name="logo-bitcoin" size={22} color="#F5B72B" />
                <Text style={styles.priceValue}>{character.price}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {owned ? (
            isEquipped ? (
              <View style={[styles.cta, styles.ctaEquipped]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                <Text style={[styles.ctaText, { color: colors.primary }]}>Equipped</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.cta} onPress={handleEquip} activeOpacity={0.85} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <>
                    <Ionicons name="shirt-outline" size={20} color={colors.background} />
                    <Text style={styles.ctaText}>Equip Character</Text>
                  </>
                )}
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              style={[styles.cta, !canAfford && styles.ctaDisabled]}
              onPress={handleBuy}
              activeOpacity={0.85}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Ionicons name="logo-bitcoin" size={20} color={canAfford ? colors.background : colors.textMuted} />
                  <Text style={[styles.ctaText, !canAfford && styles.ctaTextDisabled]}>
                    {canAfford ? `Buy for ${character.price}` : 'Not enough Bot Bucks'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  coinBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,183,43,0.14)', borderWidth: 1, borderColor: 'rgba(245,183,43,0.35)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  coinBadgeText: { fontSize: 15, fontWeight: '800', color: '#F5B72B' },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },
  viewerWrap: {
    height: 340, borderRadius: 24, overflow: 'hidden', marginBottom: 20,
    backgroundColor: 'rgba(127,127,127,0.06)', borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center',
  },
  dragHint: {
    position: 'absolute', bottom: 12, alignSelf: 'center',
    fontSize: 12, color: colors.textMuted, fontWeight: '500',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  name: { fontSize: 26, fontWeight: '800', color: colors.white, letterSpacing: -0.4, flexShrink: 1 },
  rarityChip: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1 },
  rarityChipText: { fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
  description: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 18 },
  priceCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: colors.border,
  },
  priceLabel: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priceValue: { fontSize: 24, fontWeight: '800', color: '#F5B72B' },
  footer: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 18,
  },
  ctaDisabled: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  ctaEquipped: { backgroundColor: 'rgba(61,220,95,0.12)', borderWidth: 1, borderColor: 'rgba(61,220,95,0.3)' },
  ctaText: { fontSize: 17, fontWeight: '800', color: colors.background },
  ctaTextDisabled: { color: colors.textMuted },
});
