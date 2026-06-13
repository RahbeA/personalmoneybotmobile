import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { moneyChatApi } from '../api/moneyChat';
import ChatThread from '../components/chat/ChatThread';
import { BrandLoader } from '../components/brand';
import { LOADER_MESSAGES } from '../constants/brandCopy';

export default function MoneyChatScreen({ navigation, route }) {
  const { module, badge, xp } = route.params;
  const { token } = useAuth();
  const { refresh, equippedCharacter } = useUserProgress();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startError, setStartError] = useState(false);
  const [progress, setProgress] = useState({ met: 0, total: 0 });
  const [passed, setPassed] = useState(false);
  const [bonus, setBonus] = useState(null);

  const goToModuleComplete = useCallback(() => {
    navigation.replace('ModuleComplete', {
      module,
      badge,
      xp,
      moneyChatBonus: bonus,
    });
  }, [navigation, module, badge, xp, bonus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await moneyChatApi.start(token, module.id);
        if (cancelled) return;
        setSessionId(data.session_id);
        setMessages([data.message]);
        setProgress({ met: data.met || 0, total: data.total_benchmarks || 0 });
      } catch (e) {
        if (!cancelled) setStartError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, module.id]);

  async function handleSend(text) {
    if (!sessionId) return;
    const optimistic = { id: `local-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    try {
      const res = await moneyChatApi.sendMessage(token, sessionId, text);
      setMessages((prev) => [...prev, res.message]);
      setProgress({ met: res.met || 0, total: res.total_benchmarks || 0 });
      if (res.passed) {
        setPassed(true);
        if (res.bonus) {
          setBonus(res.bonus);
          refresh();
        }
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: e.message || 'Something went wrong. Try again.' },
      ]);
    } finally {
      setSending(false);
    }
  }

  function confirmSkip() {
    Alert.alert(
      'Skip Money Chat?',
      'Money Chat is optional, but passing earns bonus XP and Bot Bucks. Skip anyway?',
      [
        { text: 'Keep chatting', style: 'cancel' },
        { text: 'Skip', style: 'destructive', onPress: goToModuleComplete },
      ],
    );
  }

  const pct = progress.total > 0 ? progress.met / progress.total : 0;

  if (loading) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <BrandLoader message={LOADER_MESSAGES.moneyChat} />
      </LinearGradient>
    );
  }

  if (startError) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={[styles.safe, styles.center]}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
          <Text style={styles.errorTitle}>Money Chat is unavailable</Text>
          <Text style={styles.errorText}>
            We couldn{"'"}t start the chat right now. You can still finish the module.
          </Text>
          <TouchableOpacity style={[styles.primaryBtn, styles.errorBtn]} onPress={goToModuleComplete} activeOpacity={0.85}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.primaryBtnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topSection}>
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.headerAvatar}>
                <Ionicons name="chatbubble-ellipses" size={18} color={colors.background} />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>Money Chat</Text>
                <Text style={styles.headerSub} numberOfLines={1}>{module.title}</Text>
              </View>
            </View>
            {!passed && (
              <TouchableOpacity style={styles.skipBtn} onPress={confirmSkip}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` }]} />
            </View>
            <Text style={styles.progressLabel}>
              {passed ? 'Passed!' : `Vibe check ${progress.met}/${progress.total}`}
            </Text>
          </View>
        </View>

        <ChatThread
          messages={messages}
          sending={sending}
          onSend={passed ? null : handleSend}
          composerDisabled={sending}
          placeholder="Reply..."
          keyboardVerticalOffset={8}
          character={equippedCharacter}
          footer={passed ? (
            <View style={styles.passedFooter}>
              {bonus && (
                <View style={styles.bonusChip}>
                  <Ionicons name="sparkles" size={16} color="#F5B72B" />
                  <Text style={styles.bonusText}>+{bonus.xp} XP   +{bonus.bot_bucks} Bot Bucks</Text>
                </View>
              )}
              <TouchableOpacity style={styles.primaryBtn} onPress={goToModuleComplete} activeOpacity={0.85}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  style={styles.primaryBtnGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.primaryBtnText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.background} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : null}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  loadingText: { fontSize: 15, color: colors.textSecondary },
  errorTitle: { fontSize: 20, fontWeight: '800', color: colors.white },
  errorText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  topSection: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 8,
  },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerTextWrap: { flex: 1 },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: colors.textSecondary },
  skipBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  skipText: { fontSize: 15, color: colors.textSecondary, fontWeight: '600' },
  progressWrap: { gap: 6 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  progressLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  passedFooter: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  bonusChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(245,183,43,0.12)', borderWidth: 1, borderColor: 'rgba(245,183,43,0.32)',
    borderRadius: 14, paddingVertical: 10,
  },
  bonusText: { fontSize: 14, fontWeight: '800', color: '#F5B72B' },
  primaryBtn: { borderRadius: 16, overflow: 'hidden' },
  errorBtn: { alignSelf: 'stretch', marginTop: 8 },
  primaryBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '800', color: colors.background },
});
