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
import { BrandAvatar } from '../components/brand';
import PuckButton from '../components/PuckButton';
import { EMPTY_STATES } from '../constants/brandCopy';
import { useTabBarInset } from '../navigation/tabBarLayout';
import { navigate as rootNavigate } from '../navigation/rootNavigation';
import { ANALYTICS_EVENTS, track } from '../utils/analytics';

const TUTOR_HERO = require('../../assets/tutor-hero.png');

const SUGGESTED_PROMPTS = [
  'How do I start budgeting?',
  'What is compound interest?',
  'How does credit work?',
  'Tips for building an emergency fund',
];

function hairlineBorder(isDark) {
  return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
}

function TutorEmptyHero({ styles, colors, voice, character, onPrompt }) {
  return (
    <ScrollView
      contentContainerStyle={styles.emptyScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.emptyHero}>
        <LinearGradient
          colors={[`${voice.accent || colors.primary}28`, 'transparent']}
          style={styles.emptyHeroGlow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <View style={[styles.emptyAvatarRing, { borderColor: voice.accent || colors.primary }]}>
          {character ? (
            <BrandAvatar character={character} size={80} autoRotate logoSize={44} />
          ) : (
            <Image source={TUTOR_HERO} style={styles.emptyHeroImage} resizeMode="cover" />
          )}
        </View>
        <Text style={[styles.emptyKicker, { color: voice.accent || colors.primary }]}>
          {voice.label.toUpperCase()}
        </Text>
        <Text style={styles.emptyTitle}>{voice.greeting}</Text>
        <Text style={styles.emptyBody}>{EMPTY_STATES.tutor.body}</Text>
      </View>

      <Text style={styles.promptsLabel}>TRY ASKING</Text>
      <View style={styles.promptsGrid}>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <TouchableOpacity
            key={prompt}
            style={styles.promptTile}
            activeOpacity={0.88}
            onPress={() => onPrompt(prompt)}
          >
            <Ionicons name="sparkles" size={15} color={voice.accent || colors.primary} />
            <Text style={styles.promptChipText}>{prompt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

export default function TutorScreen({ navigation }) {
  const { token, user, isGuest } = useAuth();
  const { equippedCharacter, chatPersonality, updatePersonality, isPremium } = useUserProgress();
  const { colors, isDark } = useTheme();
  const tabBarInset = useTabBarInset(6);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

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
    if (item.premium && !isPremium) {
      rootNavigate('Paywall');
      return;
    }
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
  }, [isGuest, navigation, isPremium, chatPersonality, updatePersonality]);

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
          <View style={styles.header}>
            <View style={styles.identity}>
              <View style={styles.identityAvatar}>
                <Image source={TUTOR_HERO} style={styles.identityImage} />
              </View>
              <View style={styles.identityCopy}>
                <Text style={styles.heroEyebrow}>AI TUTOR</Text>
                <Text style={styles.title}>MoneyBot</Text>
              </View>
            </View>
          </View>

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
      colors={colors}
      voice={voice}
      character={equippedCharacter}
      onPrompt={handleSend}
    />
  );

  const hasMessages = messages.length > 0;
  const activeTitle = conversations.find((c) => c.id === conversationId)?.title;

  const composerAccessory = (
    <View style={styles.composerToolbar}>
      <TouchableOpacity style={styles.toolbarBtn} onPress={startNewChat} activeOpacity={0.85}>
        <Ionicons name="create-outline" size={18} color={colors.primary} />
        <Text style={styles.toolbarBtnText}>New</Text>
      </TouchableOpacity>
      <View style={styles.toolbarDivider} />
      <TouchableOpacity style={styles.toolbarBtn} onPress={() => setHistoryOpen(true)} activeOpacity={0.85}>
        <Ionicons name="time-outline" size={18} color={colors.primary} />
        <Text style={styles.toolbarBtnText}>
          History{conversations.length > 0 ? ` (${conversations.length})` : ''}
        </Text>
      </TouchableOpacity>
      {hasMessages && activeTitle ? (
        <>
          <View style={styles.toolbarDivider} />
          <Text style={styles.toolbarActive} numberOfLines={1}>{activeTitle}</Text>
        </>
      ) : null}
    </View>
  );

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.identity}>
            <View style={[styles.identityAvatar, { borderColor: voice.accent || colors.primary }]}>
              {equippedCharacter ? (
                <BrandAvatar character={equippedCharacter} size={40} autoRotate={false} />
              ) : (
                <Image source={TUTOR_HERO} style={styles.identityImage} />
              )}
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.heroEyebrow}>AI TUTOR</Text>
              <Text style={styles.title}>MoneyBot</Text>
              {!keyboardOpen && (
                <Text style={[styles.heroSub, { color: voice.accent || colors.textSecondary }]}>
                  {voice.label} · {voice.blurb}
                </Text>
              )}
            </View>
          </View>
        </View>

        {!keyboardOpen && (
          <PersonalityChips
            variant="dock"
            selected={chatPersonality || 'chill'}
            isPremium={isPremium}
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
          character={equippedCharacter}
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

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 8,
    },
    identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    identityAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
    },
    identityImage: { width: 44, height: 44 },
    identityCopy: { flex: 1, minWidth: 0 },
    heroEyebrow: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 1.2,
      marginBottom: 1,
    },
    title: { fontSize: 20, fontWeight: '800', color: colors.white, letterSpacing: -0.6 },
    heroSub: { fontSize: 13, fontWeight: '600', marginTop: 1 },

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
    toolbarBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 4,
      paddingHorizontal: 2,
    },
    toolbarBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    toolbarDivider: {
      width: 1,
      height: 14,
      backgroundColor: hairline,
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
      paddingVertical: 24,
      paddingHorizontal: 18,
      marginBottom: 16,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(61,220,95,0.14)' : 'rgba(22,163,74,0.14)',
      backgroundColor: colors.surfaceElevated,
      overflow: 'hidden',
      position: 'relative',
    },
    emptyHeroGlow: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 24,
    },
    emptyAvatarRing: {
      borderRadius: 44,
      borderWidth: 2,
      padding: 3,
      marginBottom: 12,
      overflow: 'hidden',
    },
    emptyHeroImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    emptyKicker: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.1,
      marginBottom: 6,
    },
    emptyTitle: {
      fontSize: 21,
      fontWeight: '800',
      color: colors.white,
      letterSpacing: -0.4,
      textAlign: 'center',
      marginBottom: 8,
      lineHeight: 27,
    },
    emptyBody: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      fontWeight: '500',
    },
    promptsLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: 10,
    },
    promptsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    promptTile: {
      width: '48%',
      flexGrow: 1,
      minHeight: 68,
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: hairline,
    },
    promptChipText: { fontSize: 13, fontWeight: '700', color: colors.white, lineHeight: 18 },
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
