import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Pressable, ScrollView, Image, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { tutorApi } from '../api/tutor';
import { cacheKeys, fetchWithCache, TTL } from '../utils/apiCache';
import { requireAccount } from '../utils/requireAccount';
import ChatThread from '../components/chat/ChatThread';
import PersonalityChips from '../components/chat/PersonalityChips';
import { personalityByKey } from '../components/chat/personalities';
import PuckButton from '../components/PuckButton';
import ScreenAppBar, { screenAppBarTitleStyles } from '../components/ScreenAppBar';
import { EMPTY_STATES } from '../constants/brandCopy';
import { useTabBarInset } from '../navigation/tabBarLayout';
import { ANALYTICS_EVENTS, track } from '../utils/analytics';

const TUTOR_HERO = require('../../assets/tutor-hero.png');

function hairlineBorder(isDark) {
  return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
}

function TutorEmptyHero({ styles, voice }) {
  return (
    <ScrollView
      contentContainerStyle={styles.emptyScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.emptyHero}>
        <View style={[styles.emptyAvatarRing, { borderColor: voice.accent }]}>
          <Image source={TUTOR_HERO} style={styles.emptyHeroImage} resizeMode="cover" />
        </View>
        <Text style={styles.emptyTitle}>{voice.greeting}</Text>
        <Text style={styles.emptyBody}>{EMPTY_STATES.tutor.body}</Text>
      </View>
    </ScrollView>
  );
}

export default function TutorScreen({ navigation }) {
  const { token, user, isGuest } = useAuth();
  const { chatPersonality, updatePersonality } = useUserProgress();
  const { colors, isDark } = useTheme();
  const tabBarInset = useTabBarInset(6);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const titleStyles = useMemo(() => screenAppBarTitleStyles(colors), [colors]);

  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [sending, setSending] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [savingPersonality, setSavingPersonality] = useState(null);

  const voice = personalityByKey(chatPersonality);

  const goCreateAccount = useCallback(() => {
    requireAccount({ isGuest: true, navigation, feature: 'chat with the AI Tutor' });
  }, [navigation]);

  const loadConversations = useCallback(async () => {
    if (!token || !user?.id || isGuest) return;
    try {
      const { data } = await fetchWithCache(
        cacheKeys.tutorConversations(user.id),
        () => tutorApi.getConversations(token),
        { freshMs: TTL.TUTOR_CONVERSATIONS_MS, staleMs: TTL.TUTOR_CONVERSATIONS_MS * 5 },
      );
      setConversations(data || []);
    } catch {
      // ignore
    }
  }, [token, user?.id, isGuest]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations]),
  );

  async function openConversation(id) {
    if (!requireAccount({ isGuest, navigation, feature: 'chat with the AI Tutor' })) return;
    setHistoryOpen(false);
    setConversationId(id);
    try {
      const msgs = await tutorApi.getMessages(token, id);
      setMessages(msgs || []);
    } catch {
      setMessages([]);
    }
  }

  const handlePersonality = useCallback(async (item) => {
    if (!requireAccount({ isGuest, navigation, feature: 'change Tutor voice' })) return;
    if (item.key === chatPersonality) return;
    setSavingPersonality(item.key);
    try {
      await updatePersonality(item.key);
      track(ANALYTICS_EVENTS.PERSONALITY_CHANGED, { personality: item.key });
    } catch (err) {
      Alert.alert('Could not update', err.message || 'Try again in a moment.');
    } finally {
      setSavingPersonality(null);
    }
  }, [isGuest, navigation, chatPersonality, updatePersonality]);

  function startNewChat() {
    if (!requireAccount({ isGuest, navigation, feature: 'chat with the AI Tutor' })) return;
    setConversationId(null);
    setMessages([]);
    setHistoryOpen(false);
  }

  async function handleSend(text) {
    if (!requireAccount({ isGuest, navigation, feature: 'chat with the AI Tutor' })) return;
    const optimistic = { id: `local-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    try {
      const res = await tutorApi.sendMessage(token, text, conversationId);
      if (res.conversation_id && res.conversation_id !== conversationId) {
        setConversationId(res.conversation_id);
        loadConversations();
      }
      setMessages((prev) => [...prev, res.message]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: e.message || 'Something went wrong. Try again.' },
      ]);
    } finally {
      setSending(false);
    }
  }

  const handleKeyboardVisible = useCallback((visible) => {
    setKeyboardOpen(visible);
  }, []);

  if (isGuest) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <ScreenAppBar showBack={false}>
            <View style={styles.identity}>
              <View style={styles.identityAvatar}>
                <Image source={TUTOR_HERO} style={styles.identityImage} />
              </View>
              <View style={styles.identityCopy}>
                <Text style={titleStyles.title} numberOfLines={1}>Tutor</Text>
                <Text style={titleStyles.eyebrow} numberOfLines={1}>Ask MoneyBot anything</Text>
              </View>
            </View>
          </ScreenAppBar>

          <ScrollView
            contentContainerStyle={[styles.emptyScroll, { paddingBottom: tabBarInset }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.emptyHero}>
              <View style={styles.emptyAvatarRing}>
                <Image source={TUTOR_HERO} style={styles.emptyHeroImage} resizeMode="cover" />
              </View>
              <Text style={styles.emptyTitle}>Create an account to chat</Text>
              <Text style={styles.emptyBody}>
                The AI Tutor keeps a personalized chat history and learning profile.
                Create a free account to start asking questions — lessons stay available without signing up.
              </Text>
              <PuckButton color={colors.primary} height={52} borderRadius={16} lip={5} onPress={goCreateAccount}>
                <Text style={styles.guestCtaBtnText}>Create free account</Text>
              </PuckButton>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const emptyState = (
    <TutorEmptyHero
      styles={styles}
      voice={voice}
    />
  );

  const hasMessages = messages.length > 0;
  const activeTitle = conversations.find((c) => c.id === conversationId)?.title;
  const subtitle = keyboardOpen
    ? 'Ask MoneyBot anything'
    : `${voice.label} · ${voice.blurb}`;

  const composerAccessory = hasMessages && activeTitle ? (
    <View style={styles.composerToolbar}>
      <Text style={styles.toolbarActive} numberOfLines={1}>{activeTitle}</Text>
    </View>
  ) : null;

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenAppBar
          showBack={false}
          rightActions={(
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={startNewChat}
                activeOpacity={0.85}
                accessibilityLabel="New chat"
              >
                <Ionicons name="create-outline" size={18} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => setHistoryOpen(true)}
                activeOpacity={0.85}
                accessibilityLabel="Chat history"
              >
                <Ionicons name="time-outline" size={18} color={colors.white} />
              </TouchableOpacity>
            </View>
          )}
        >
          <View style={styles.identity}>
            <View style={[styles.identityAvatar, { borderColor: voice.accent || colors.primary }]}>
              <Image source={TUTOR_HERO} style={styles.identityImage} />
            </View>
            <View style={styles.identityCopy}>
              <Text style={titleStyles.title} numberOfLines={1}>Tutor</Text>
              <Text
                style={[titleStyles.eyebrow, !keyboardOpen && voice.accent ? { color: voice.accent } : null]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            </View>
          </View>
        </ScreenAppBar>

        {!keyboardOpen && (
          <PersonalityChips
            variant="dock"
            selected={chatPersonality || 'chill'}
            savingKey={savingPersonality}
            onSelect={handlePersonality}
          />
        )}

        <ChatThread
          messages={messages}
          sending={sending}
          onSend={handleSend}
          composerDisabled={sending}
          placeholder="Ask about anything you're learning..."
          bottomInset={tabBarInset}
          emptyComponent={emptyState}
          composerStyle={styles.composerWrap}
          composerAccessory={composerAccessory}
          onKeyboardVisibleChange={handleKeyboardVisible}
        />
      </SafeAreaView>

      <Modal visible={historyOpen} animationType="slide" transparent onRequestClose={() => setHistoryOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setHistoryOpen(false)}>
          <Pressable
            style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) + 12 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalEyebrow}>HISTORY</Text>
            <Text style={styles.modalTitle}>Your chats</Text>

            <TouchableOpacity style={styles.newChatHero} onPress={startNewChat} activeOpacity={0.9}>
              <LinearGradient
                colors={[colors.primaryLight, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.newChatHeroGrad}
              >
                <Ionicons name="add" size={22} color={colors.background} />
                <Text style={styles.newChatHeroText}>Start new chat</Text>
              </LinearGradient>
            </TouchableOpacity>

            <FlatList
              data={conversations}
              keyExtractor={(item) => String(item.id)}
              style={styles.modalList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={(
                <View style={styles.modalEmpty}>
                  <Ionicons name="chatbubbles-outline" size={36} color={colors.textMuted} />
                  <Text style={styles.modalEmptyTitle}>{EMPTY_STATES.tutorHistory}</Text>
                </View>
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.convoRow,
                    conversationId === item.id && styles.convoRowActive,
                  ]}
                  onPress={() => openConversation(item.id)}
                  activeOpacity={0.88}
                >
                  <View style={styles.convoIcon}>
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.convoTextWrap}>
                    <Text style={styles.convoTitle} numberOfLines={1}>{item.title}</Text>
                    {!!item.last_message && (
                      <Text style={styles.convoPreview} numberOfLines={1}>{item.last_message}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const makeStyles = (colors, isDark) => {
  const hairline = hairlineBorder(isDark);

  return StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },

    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    identity: {
      flex: 1,
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
    identityImage: { width: 36, height: 36 },
    identityCopy: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },

    composerWrap: {
      marginHorizontal: 12,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: hairline,
      backgroundColor: colors.surfaceElevated,
      overflow: 'hidden',
    },
    composerToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 4,
      gap: 8,
    },
    toolbarActive: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'right',
    },

    emptyScroll: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingBottom: 12,
      justifyContent: 'center',
    },
    emptyHero: {
      alignItems: 'center',
      paddingVertical: 28,
      paddingHorizontal: 20,
      marginBottom: 8,
    },
    emptyAvatarRing: {
      borderRadius: 44,
      borderWidth: 2,
      padding: 3,
      marginBottom: 16,
      overflow: 'hidden',
    },
    emptyHeroImage: {
      width: 72,
      height: 72,
      borderRadius: 36,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.white,
      letterSpacing: -0.4,
      textAlign: 'center',
      marginBottom: 8,
      lineHeight: 26,
    },
    emptyBody: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      fontWeight: '500',
      maxWidth: 300,
    },
    guestCtaBtnText: { fontSize: 15, fontWeight: '800', color: '#0A0A0A' },

    modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 10,
      maxHeight: '75%',
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: hairline,
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: hairline,
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: 4,
    },
    modalTitle: { fontSize: 22, fontWeight: '800', color: colors.white, letterSpacing: -0.4, marginBottom: 16 },
    newChatHero: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
    newChatHeroGrad: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
    },
    newChatHeroText: { fontSize: 16, fontWeight: '800', color: colors.background },
    modalList: { flexGrow: 0 },
    modalEmpty: { alignItems: 'center', paddingVertical: 32, gap: 10 },
    modalEmptyTitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    convoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      marginBottom: 6,
      borderRadius: 16,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: hairline,
    },
    convoRowActive: {
      borderColor: colors.primaryTintStrong,
      backgroundColor: colors.primaryTint,
    },
    convoIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primaryTintStrong,
    },
    convoTextWrap: { flex: 1, minWidth: 0 },
    convoTitle: { fontSize: 15, fontWeight: '700', color: colors.white, letterSpacing: -0.2 },
    convoPreview: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  });
};
