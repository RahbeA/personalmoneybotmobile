import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, Linking, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { BrandLogo } from './brand';
import PuckButton from './PuckButton';

/**
 * Full-screen, non-dismissible gate shown when the installed app is older than
 * the backend's minimum supported version. There is intentionally no close
 * affordance — the only way forward is to update.
 */
export default function ForceUpdateOverlay({ visible, storeUrl }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const openStore = () => {
    if (!storeUrl) return;
    Linking.openURL(storeUrl).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      // Swallow the Android hardware back button so the gate can't be dismissed.
      onRequestClose={() => {}}
      statusBarTranslucent
    >
      <LinearGradient colors={colors.bgGradient} style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.logoWrap}>
            <BrandLogo size="xl" />
          </View>

          <View style={styles.badge}>
            <Ionicons name="arrow-up-circle" size={20} color={colors.primary} />
            <Text style={styles.badgeText}>Update required</Text>
          </View>

          <Text style={styles.title}>Time for a fresh update</Text>
          <Text style={styles.body}>
            This version of MoneyBot is no longer supported. Update to the latest
            version to keep learning, posting, and earning Bot Bucks.
          </Text>
        </View>

        <View style={styles.footer}>
          <PuckButton
            color={colors.primary}
            height={56}
            borderRadius={18}
            lip={5}
            onPress={openStore}
            contentStyle={styles.btnInner}
          >
            <Ionicons name="cloud-download-outline" size={20} color={colors.background} />
            <Text style={styles.btnText}>
              {Platform.OS === 'android' ? 'Update on Google Play' : 'Update on the App Store'}
            </Text>
          </PuckButton>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 28 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: { marginBottom: 28 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryTint,
    borderColor: colors.primaryTintStrong,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
  },
  footer: { paddingBottom: 40, paddingTop: 8 },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnText: { fontSize: 17, fontWeight: '800', color: colors.background },
});
