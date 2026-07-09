import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Pressable, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { tutorApi } from '../api/tutor';
import { cacheKeys, fetchWithCache, TTL } from '../utils/apiCache';
import ChatThread from '../components/chat/ChatThread';
import { BrandAvatar } from '../components/brand';
import { EMPTY_STATES } from '../constants/brandCopy';
import { useTabBarInset } from '../navigation/tabBarLayout';

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
};

const SUGGESTED_PROMPTS = [
  'How do I start budgeting?',
  'What is compound interest?',
  'How does credit work?',
  'Tips for building an emergency fund',
  'Explain the 50/30/20 rule',
];

function hairlineBorder(isDark) {
  return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
}

function TutorEmptyHero({ styles, colors, character, onPrompt }) {
  return (
    <ScrollView
      contentContainerStyle={styles.emptyScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.emptyHero}>
        <LinearGradient
          colors={['rgba(61,220,95,0.18)', 'rgba(61,220,95,0.02)', 'transparent']}
          style={styles.emptyHeroGlow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <View style={styles.emptyAvatarRing}>
          <BrandAvatar character={character} size={72} autoRotate={!!character} />
        </View>
        <Text style={styles.emptyTitle}>{EMPTY_STATES.tutor.title}</Text>
        <Text style={styles.emptyBody}>{EMPTY_STATES.tutor.body}</Text>
      </View>

      <Text style={styles.promptsLabel}>TRY ASKING</Text>
      <View style={styles.promptsWrap}>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <TouchableOpacity
            key={prompt}
            style={styles.promptChip}
            activeOpacity={0.85}
            onPress={() => onPrompt(prompt)}
          >
            <Ionicons name="sparkles" size={14} color={colors.primary} />
            <Text style={styles.promptChipText}>{prompt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

export default function TutorScreen() {
  const { token, user } = useAuth();
  const { equippedCharacter } = useUserProgress();
  const { colors, isDark } = useTheme();
  const tabBarInset = useTabBarInset();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [sending, setSending] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!token || !user?.id) return;
    try {
      const { data } = await fetchWithCache(
        cacheKeys.tutorConversations(user.id),
        () => tutorApi.getConversations(token),
        { freshMs: TTL.TUTOR_CONVERSATIONS_MS, staleMs: TTL.TUTOR_CONVERSATIONS_MS * 5 },
      );
      setConversations(data || []);
    } catch (e) {
      // ignore
    }
  }, [token, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations]),
  );

  async function openConversation(id) {
    setHistoryOpen(false);
    setConversationId(id);
    try {
      const msgs = await tutorApi.getMessages(token, id);
      setMessages(msgs || []);
    } catch (e) {
      setMessages([]);
    }
  }

  function startNewChat() {
    setConversationId(null);
    setMessages([]);
    setHistoryOpen(false);
  }

  async function handleSend(text) {
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

  const emptyState = (
    <TutorEmptyHero
      styles={styles}
      colors={colors}
      character={equippedCharacter}
      onPrompt={handleSend}
    />
  );

  const hasMessages = messages.length > 0;

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.heroEyebrow}>AI TUTOR</Text>
            <Text style={styles.title}>Tutor</Text>
            <Text style={styles.heroSub}>Your personal finance coach</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setHistoryOpen(true)}
              activeOpacity={0.85}
              accessibilityLabel="Chat history"
            >
              <Ionicons name="time-outline" size={20} color={colors.white} />
              {conversations.length > 0 && (
                <View style={styles.headerBtnBadge}>
                  <Text style={styles.headerBtnBadgeText}>
                    {conversations.length > 9 ? '9+' : conversations.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={startNewChat}
              activeOpacity={0.85}
              accessibilityLabel="New chat"
            >
              <Ionicons name="create-outline" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {hasMessages && conversationId && (
          <View style={styles.activeChatBar}>
            <Ionicons name="chatbubble-ellipses" size={14} color={colors.primary} />
            <Text style={styles.activeChatText} numberOfLines={1}>
              {conversations.find((c) => c.id === conversationId)?.title || 'Current chat'}
            </Text>
          </View>
        )}

        <ChatThread
          messages={messages}
          sending={sending}
          onSend={handleSend}
          composerDisabled={sending}
          placeholder="Ask about anything you're learning..."
          keyboardVerticalOffset={8}
          bottomInset={tabBarInset}
          emptyComponent={emptyState}
          character={equippedCharacter}
          composerStyle={styles.composerWrap}
        />
      </SafeAreaView>

      <Modal visible={historyOpen} animationType="slide" transparent onRequestClose={() => setHistoryOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setHistoryOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
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
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    headerLeft: { flex: 1, marginRight: 12 },
    heroEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: 4,
    },
    title: { fontSize: 30, fontWeight: '800', color: colors.white, letterSpacing: -0.8, marginBottom: 4 },
    heroSub: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
    headerActions: { flexDirection: 'row', gap: 8, paddingTop: 4 },
    headerBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: hairline,
      ...CARD_SHADOW,
    },
    headerBtnBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 2,
      borderColor: colors.background,
    },
    headerBtnBadgeText: { fontSize: 10, fontWeight: '800', color: colors.background },

    activeChatBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginBottom: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.primaryTint,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primaryTintStrong,
    },
    activeChatText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.primary },

    composerWrap: {
      marginHorizontal: 12,
      marginBottom: 4,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: hairline,
      backgroundColor: colors.surfaceElevated,
      overflow: 'hidden',
      ...CARD_SHADOW,
    },

    emptyScroll: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingBottom: 24,
      justifyContent: 'center',
    },
    emptyHero: {
      alignItems: 'center',
      paddingVertical: 28,
      paddingHorizontal: 20,
      marginBottom: 24,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(61,220,95,0.15)' : 'rgba(22,163,74,0.15)',
      backgroundColor: colors.surfaceElevated,
      overflow: 'hidden',
      position: 'relative',
      ...CARD_SHADOW,
    },
    emptyHeroGlow: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 24,
    },
    emptyAvatarRing: {
      borderRadius: 40,
      borderWidth: 2,
      borderColor: colors.primaryTintStrong,
      padding: 3,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.white,
      letterSpacing: -0.3,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyBody: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      fontWeight: '500',
    },
    promptsLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: 12,
    },
    promptsWrap: { gap: 8 },
    promptChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: hairline,
    },
    promptChipText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.white },

    modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 36,
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
    newChatHero: { borderRadius: 16, overflow: 'hidden', marginBottom: 16, ...CARD_SHADOW },
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
