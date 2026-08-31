import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useUserProgress } from '../context/UserProgressContext';
import { BrandToast, BrandLogo } from '../components/brand';
import PuckButton from '../components/PuckButton';
import {
  fetchPremiumPackages,
  formatPackagePerMonth,
  formatPackagePrice,
  initPurchases,
  isPurchasesConfigured,
  purchasePremiumPackage,
  restorePremiumPurchases,
  PLAN_KEYS,
} from '../services/purchases';
import { LEGAL } from '../constants/legal';

const GOLD = '#F5B72B';

const PERKS = ['Premium characters', 'Extra Tutor voices', 'Early shop drops'];
const FREE_INCLUDES = ['Lessons & Daily Puzzle', 'Starter character', 'Chill Tutor voice'];

export default function PaywallScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { isPremium, refresh } = useUserProgress();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [plan, setPlan] = useState(PLAN_KEYS.yearly);
  const [toast, setToast] = useState('');
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [busy, setBusy] = useState(false);
  const [packages, setPackages] = useState({ monthly: null, yearly: null });

  const configured = isPurchasesConfigured();
  const hideToast = useCallback(() => setToast(''), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!configured || !user?.id) {
        setLoadingPlans(false);
        return;
      }
      try {
        await initPurchases(user.id);
        const result = await fetchPremiumPackages();
        if (!cancelled) setPackages(result);
      } catch {
        if (!cancelled) setToast('Could not load plans. Try again.');
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => { cancelled = true; };
  }, [configured, user?.id]);

  const yearlyPrice = formatPackagePrice(packages.yearly) || '$39.99';
  const monthlyPrice = formatPackagePrice(packages.monthly) || '$6.99';
  const yearlyPerMonth = formatPackagePerMonth(packages.yearly, true) || '$3.33/mo';

  const selectedPkg = plan === PLAN_KEYS.yearly ? packages.yearly : packages.monthly;
  const selectedPrice = plan === PLAN_KEYS.yearly ? yearlyPrice : monthlyPrice;

  async function handleSubscribe() {
    if (isPremium) {
      navigation.goBack();
      return;
    }
    if (!configured) {
      setToast('Subscriptions are not live yet. Your team still needs to connect App Store and RevenueCat.');
      return;
    }
    if (!selectedPkg) {
      setToast('This plan is not available in the store yet.');
      return;
    }
    setBusy(true);
    try {
      const ok = await purchasePremiumPackage(selectedPkg);
      if (ok) {
        await refresh();
        setToast('Welcome to Premium!');
        setTimeout(() => navigation.goBack(), 1200);
      } else {
        setToast('Purchase completed but Premium was not activated. Contact support.');
      }
    } catch (e) {
      if (e?.userCancelled) return;
      setToast(e?.message || 'Purchase failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    if (!configured) {
      setToast('Restore is not available until RevenueCat is configured.');
      return;
    }
    setBusy(true);
    try {
      const ok = await restorePremiumPurchases();
      await refresh();
      setToast(ok ? 'Premium restored!' : 'No active subscription found on this Apple ID.');
    } catch (e) {
      setToast(e?.message || 'Restore failed.');
    } finally {
      setBusy(false);
    }
  }

  function openLegal(type) {
    const url = type === 'terms' ? LEGAL.termsUrl : LEGAL.privacyUrl;
    if (url) Linking.openURL(url);
  }

  return (
    <LinearGradient colors={['#1A1408', '#0A0A0A', '#071009']} style={styles.flex}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <PuckButton
            color={colors.surfaceElevated}
            width={36}
            height={36}
            borderRadius={18}
            lip={3}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={18} color={colors.white} />
          </PuckButton>
        </View>

        <View style={styles.body}>
          <View style={styles.heroBlock}>
            <View style={styles.heroOrb}>
              <LinearGradient
                colors={['rgba(245,183,43,0.35)', 'rgba(245,183,43,0.05)', 'transparent']}
                style={styles.heroOrbGrad}
              />
              <View style={styles.logoRing}>
                <BrandLogo size={52} />
              </View>
            </View>

            <Text style={styles.brand}>MONEYBOT PREMIUM</Text>
            <Text style={styles.headline}>
              {isPremium ? "You're all set." : 'Level up your Moneyverse'}
            </Text>
            <Text style={styles.subhead}>
              {isPremium
                ? 'Extra characters, voices, and shop drops are unlocked.'
                : 'Learning stays free. Premium unlocks the fun extras.'}
            </Text>
          </View>

          {!isPremium && (
            <View style={styles.midBlock}>
              <View style={styles.compareCard}>
                <PuckButton
                  color={colors.surfaceElevated}
                  borderRadius={16}
                  lip={4}
                  style={styles.comparePuck}
                  contentStyle={styles.compareInner}
                >
                  <Text style={styles.compareLabel}>FREE</Text>
                  {FREE_INCLUDES.map((line) => (
                    <View key={line} style={styles.compareRow}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                      <Text style={styles.compareText}>{line}</Text>
                    </View>
                  ))}
                </PuckButton>
                <PuckButton
                  color="#2A2110"
                  borderRadius={16}
                  lip={4}
                  style={styles.comparePuck}
                  contentStyle={styles.compareInner}
                >
                  <Text style={[styles.compareLabel, styles.compareLabelGold]}>PREMIUM</Text>
                  {PERKS.map((line) => (
                    <View key={line} style={styles.compareRow}>
                      <Ionicons name="star" size={13} color={GOLD} />
                      <Text style={styles.compareText}>{line}</Text>
                    </View>
                  ))}
                </PuckButton>
              </View>

              {loadingPlans ? (
                <ActivityIndicator color={GOLD} style={styles.plansLoader} />
              ) : (
                <View style={styles.plans}>
                  <PlanCard
                    active={plan === PLAN_KEYS.yearly}
                    label="Yearly"
                    price={yearlyPrice}
                    meta={yearlyPerMonth}
                    badge="BEST VALUE"
                    onPress={() => setPlan(PLAN_KEYS.yearly)}
                    styles={styles}
                    colors={colors}
                  />
                  <PlanCard
                    active={plan === PLAN_KEYS.monthly}
                    label="Monthly"
                    price={monthlyPrice}
                    meta={null}
                    badge={null}
                    onPress={() => setPlan(PLAN_KEYS.monthly)}
                    styles={styles}
                    colors={colors}
                  />
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {isPremium ? (
            <PuckButton color={colors.primary} height={56} borderRadius={18} lip={5} onPress={() => navigation.goBack()}>
              <Text style={styles.ctaTextDark}>Back to the app</Text>
            </PuckButton>
          ) : (
            <>
              <PuckButton
                color={GOLD}
                height={52}
                borderRadius={16}
                lip={5}
                onPress={handleSubscribe}
                disabled={busy}
                contentStyle={styles.ctaInner}
              >
                {busy ? (
                  <ActivityIndicator color="#0A0A0A" />
                ) : (
                  <Text style={styles.ctaText}>
                    {configured ? `Start Premium · ${selectedPrice}` : 'Premium coming soon'}
                  </Text>
                )}
              </PuckButton>
              <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn} disabled={busy}>
                <Text style={styles.restoreText}>Restore purchases</Text>
              </TouchableOpacity>
              <Text style={styles.legal}>
                Auto-renews until canceled. Manage in Settings → Apple ID → Subscriptions.
              </Text>
              <View style={styles.legalLinks}>
                <TouchableOpacity onPress={() => openLegal('terms')}>
                  <Text style={styles.legalLink}>Terms</Text>
                </TouchableOpacity>
                <Text style={styles.legalDot}>·</Text>
                <TouchableOpacity onPress={() => openLegal('privacy')}>
                  <Text style={styles.legalLink}>Privacy</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
      <BrandToast visible={!!toast} message={toast} onHide={hideToast} />
    </LinearGradient>
  );
}

function PlanCard({ active, label, price, meta, badge, onPress, styles, colors }) {
  return (
    <View style={styles.planWrap}>
      {badge ? (
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <PuckButton
        color={active ? GOLD : colors.surfaceElevated}
        height={118}
        borderRadius={16}
        lip={5}
        onPress={onPress}
        style={styles.planPuck}
        contentStyle={styles.planInner}
      >
        <View style={[styles.radio, active && styles.radioOn]}>
          {active ? <View style={styles.radioDot} /> : null}
        </View>
        <Text style={[styles.planLabel, active && styles.planLabelOn]}>{label}</Text>
        <View style={styles.planPriceBlock}>
          <Text style={[styles.planPrice, active && styles.planPriceOn]}>{price}</Text>
          {meta ? <Text style={[styles.planMeta, active && styles.planMetaOn]}>{meta}</Text> : null}
        </View>
      </PuckButton>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingTop: 2, alignItems: 'flex-end' },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  heroBlock: {
    alignItems: 'center',
    paddingTop: 8,
  },
  midBlock: {
    flex: 1,
    justifyContent: 'center',
    gap: 18,
    paddingVertical: 12,
  },
  heroOrb: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  heroOrbGrad: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 48,
  },
  logoRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,183,43,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(245,183,43,0.45)',
  },
  brand: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: GOLD,
    marginBottom: 6,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 6,
  },
  subhead: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  compareCard: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  comparePuck: { flex: 1 },
  compareInner: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 8,
  },
  compareLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.textMuted,
    marginBottom: 2,
  },
  compareLabelGold: { color: GOLD },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compareText: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.white, lineHeight: 16 },
  plansLoader: { marginVertical: 16 },
  plans: { width: '100%', flexDirection: 'row', gap: 10 },
  planWrap: { flex: 1 },
  planPuck: { alignSelf: 'stretch' },
  planInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  planBadge: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    zIndex: 2,
    backgroundColor: GOLD,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  planBadgeText: { fontSize: 8, fontWeight: '900', color: '#0A0A0A', letterSpacing: 0.5 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  radioOn: { borderColor: '#0A0A0A' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0A0A0A' },
  planLabel: { fontSize: 15, fontWeight: '800', color: colors.white, marginBottom: 2 },
  planLabelOn: { color: '#0A0A0A' },
  planPriceBlock: { alignItems: 'center' },
  planPrice: { fontSize: 17, fontWeight: '800', color: colors.white },
  planPriceOn: { color: '#0A0A0A' },
  planMeta: { fontSize: 11, fontWeight: '700', color: GOLD, marginTop: 2 },
  planMetaOn: { color: '#5C4308' },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  ctaInner: { alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#0A0A0A' },
  ctaTextDark: { fontSize: 16, fontWeight: '800', color: '#0A0A0A' },
  restoreBtn: { alignItems: 'center', paddingVertical: 8 },
  restoreText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  legal: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 6,
  },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  legalLink: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  legalDot: { color: colors.textMuted },
});
