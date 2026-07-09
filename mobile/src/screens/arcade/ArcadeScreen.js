import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useUserProgress } from '../../context/UserProgressContext';
import { useTheme } from '../../context/ThemeContext';
import { gamesApi } from '../../api/games';
import { BrandHeader, BrandLoader } from '../../components/brand';
import { useTabBarInset } from '../../navigation/tabBarLayout';

const GAME_ROUTES = {
  budget_blitz: 'BudgetBlitz',
  inflation_dodge: 'InflationDodge',
  credit_climb: 'CreditClimb',
  scam_spotter: 'ScamSpotter',
};

function CoinBadge({ amount, styles, colors }) {
  return (
    <View style={styles.coinBadge}>
      <Ionicons name="logo-bitcoin" size={16} color={colors.botBucks} />
      <Text style={styles.coinBadgeText}>{amount}</Text>
    </View>
  );
}

function GameTile({
  game, playCost, onPlay, starting, styles, colors,
}) {
  const playable = game.playable;
  const best = game.best_score || 0;

  return (
    <View style={[styles.tile, !playable && styles.tileLocked]}>
      <View style={styles.tileHeader}>
        <View style={[styles.tileIcon, !playable && styles.tileIconLocked]}>
          <Ionicons
            name={game.icon}
            size={24}
            color={playable ? colors.primary : colors.textMuted}
          />
        </View>
        <View style={styles.tileBody}>
          <Text style={[styles.tileTitle, !playable && styles.tileTitleLocked]}>{game.title}</Text>
          <Text style={styles.tileDesc} numberOfLines={2}>{game.description}</Text>
          {playable && best > 0 && (
            <Text style={styles.tileBest}>Best: {best} pts</Text>
          )}
        </View>
      </View>

      {playable ? (
        <TouchableOpacity
          style={styles.playBtn}
          activeOpacity={0.85}
          onPress={() => onPlay(game)}
          disabled={starting}
        >
          <LinearGradient
            colors={[colors.primaryLight, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.playBtnGrad}
          >
            {starting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="play" size={18} color="#FFFFFF" />
                <Text style={styles.playBtnText}>Play · {playCost} Bot Bucks</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <View style={styles.comingSoon}>
          <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
          <Text style={styles.comingSoonText}>Coming soon</Text>
        </View>
      )}
    </View>
  );
}

export default function ArcadeScreen({ navigation }) {
  const { token } = useAuth();
  const { botBucks, startArcadeGame } = useUserProgress();
  const { colors, isDark } = useTheme();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);

  const [arcade, setArcade] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startingKey, setStartingKey] = useState(null);

  const loadArcade = useCallback(async () => {
    if (!token) return;
    try {
      const data = await gamesApi.getArcade(token);
      setArcade(data);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadArcade();
    }, [loadArcade]),
  );

  async function handlePlay(game) {
    const route = GAME_ROUTES[game.key];
    if (!route) return;

    const cost = arcade?.play_cost ?? 10;
    const freeAvailable = arcade?.free_play_available;
    const balance = arcade?.bot_bucks ?? botBucks;

    if (!freeAvailable && balance < cost) {
      Alert.alert(
        'Not enough Bot Bucks',
        `You need ${cost} Bot Bucks to play. Earn more by completing lessons or claiming your daily reward.`,
      );
      return;
    }

    setStartingKey(game.key);
    try {
      const result = await startArcadeGame(game.key);
      navigation.navigate(route, {
        sessionId: result.session_id,
        gameKey: game.key,
        wasFree: result.was_free,
      });
      loadArcade();
    } catch (e) {
      Alert.alert('Cannot start game', e.message || 'Something went wrong.');
    } finally {
      setStartingKey(null);
    }
  }

  const playCost = arcade?.play_cost ?? 10;
  const freeAvailable = arcade?.free_play_available ?? false;
  const displayBucks = arcade?.bot_bucks ?? botBucks;

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.topBarSpacer} />
          <CoinBadge amount={displayBucks} styles={styles} colors={colors} />
        </View>

        <BrandHeader
          title="Money Arcade"
          subtitle="Play mini-games, win Bot Bucks & XP"
          style={styles.brandHeader}
        />

        {loading ? (
          <BrandLoader message="Loading arcade..." />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="logo-bitcoin" size={18} color={colors.botBucks} />
                <Text style={styles.infoText}>
                  Each play costs <Text style={styles.infoBold}>{playCost} Bot Bucks</Text>
                </Text>
              </View>
              <View style={[styles.infoRow, { marginTop: 8 }]}>
                <Ionicons name="trophy" size={18} color={colors.primary} />
                <Text style={styles.infoText}>
                  Score well to <Text style={styles.infoBold}>win Bot Bucks + XP</Text> back
                </Text>
              </View>
              {freeAvailable && (
                <View style={styles.freeBadge}>
                  <Ionicons name="gift" size={14} color={colors.primary} />
                  <Text style={styles.freeBadgeText}>1 free play available today</Text>
                </View>
              )}
            </View>

            {(arcade?.games || []).map((game) => (
              <GameTile
                key={game.key}
                game={game}
                playCost={freeAvailable ? 0 : playCost}
                onPlay={handlePlay}
                starting={startingKey === game.key}
                styles={styles}
                colors={colors}
              />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors, tabBarInset) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    marginBottom: -8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarSpacer: { flex: 1 },
  brandHeader: { paddingHorizontal: 20, paddingTop: 0 },
  scroll: { paddingHorizontal: 20, paddingBottom: tabBarInset },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  coinBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.botBucks,
  },
  infoCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  infoBold: {
    fontWeight: '800',
    color: colors.white,
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: colors.primaryTint,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  freeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  tile: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileLocked: { opacity: 0.72 },
  tileHeader: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconLocked: { backgroundColor: colors.surface },
  tileBody: { flex: 1 },
  tileTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 4,
  },
  tileTitleLocked: { color: colors.textSecondary },
  tileDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  tileBest: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 6,
  },
  playBtn: { borderRadius: 14, overflow: 'hidden' },
  playBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  playBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  comingSoon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  comingSoonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
