import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Pressable,
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
import { BrandHeader, BrandEmptyState } from '../components/brand';
import { EMPTY_STATES } from '../constants/brandCopy';
import { useTabBarInset } from '../navigation/tabBarLayout';

export default function TutorScreen() {
  const { token, user } = useAuth();
  const { equippedCharacter } = useUserProgress();
  const { colors, isDark } = useTheme();
  const tabBarInset = useTabBarInset();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
    <BrandEmptyState
      title={EMPTY_STATES.tutor.title}
      body={EMPTY_STATES.tutor.body}
      character={equippedCharacter}
    />
  );

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <BrandHeader
          variant="avatar"
          character={equippedCharacter}
          title="Tutor"
          subtitle="Powered by MoneyBot AI"
          style={styles.brandHeader}
          right={(
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerBtn} onPress={() => setHistoryOpen(true)}>
                <Ionicons name="time-outline" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn} onPress={startNewChat}>
                <Ionicons name="create-outline" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
        />

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
        />
      </SafeAreaView>

      <Modal visible={historyOpen} animationType="slide" transparent onRequestClose={() => setHistoryOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setHistoryOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Your chats</Text>
            <TouchableOpacity style={styles.newChatRow} onPress={startNewChat}>
              <Ionicons name="add-circle" size={22} color={colors.primary} />
              <Text style={styles.newChatText}>New chat</Text>
            </TouchableOpacity>
            <FlatList
              data={conversations}
              keyExtractor={(item) => String(item.id)}
              style={styles.modalList}
              ListEmptyComponent={<Text style={styles.modalEmpty}>{EMPTY_STATES.tutorHistory}</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.convoRow} onPress={() => openConversation(item.id)}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textSecondary} />
                  <View style={styles.convoTextWrap}>
                    <Text style={styles.convoTitle} numberOfLines={1}>{item.title}</Text>
                    {!!item.last_message && (
                      <Text style={styles.convoPreview} numberOfLines={1}>{item.last_message}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  brandHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32, maxHeight: '70%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.white, marginBottom: 12 },
  newChatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  newChatText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  modalList: { marginTop: 4 },
  modalEmpty: { fontSize: 14, color: colors.textMuted, paddingVertical: 16, textAlign: 'center' },
  convoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  convoTextWrap: { flex: 1 },
  convoTitle: { fontSize: 15, fontWeight: '600', color: colors.white },
  convoPreview: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});
