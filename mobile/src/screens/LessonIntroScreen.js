import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, BackHandler, ScrollView } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { coursesApi } from '../api/courses';
import { cacheKeys, fetchWithCache, TTL } from '../utils/apiCache';
import { useTheme } from '../context/ThemeContext';
import { useUserProgress } from '../context/UserProgressContext';
import { BrandAvatar } from '../components/brand';
import PuckButton from '../components/PuckButton';
import { CELEBRATIONS } from '../constants/brandCopy';

function confirmExit(onLeave) {
  Alert.alert(
    'Leave lesson?',
    'You haven\'t started yet. Are you sure you want to go back?',
    [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: onLeave },
    ],
  );
}

export default function LessonIntroScreen({ navigation, route }) {
  const { lesson, module } = route.params;
  const { token } = useAuth();
  const { equippedCharacter } = useUserProgress();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isFocused = useIsFocused();
  const [questions, setQuestions] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await fetchWithCache(
          cacheKeys.lessonQuestions(lesson.id),
          () => coursesApi.getLessonQuestions(token, lesson.id),
          { freshMs: TTL.LESSON_QUESTIONS_MS, staleMs: TTL.LESSON_QUESTIONS_MS },
        );
        if (!cancelled) setQuestions(data || []);
      } catch {
        if (!cancelled) setQuestions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [token, lesson.id]);

  const startLesson = useCallback(() => {
    navigation.replace('QuestionFlow', { lesson, module, questions: questions || undefined });
  }, [navigation, lesson, module, questions]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        confirmExit(() => navigation.goBack());
        return true;
      });
      return () => sub.remove();
    }, [navigation]),
  );

  const estimatedMinutes = Math.ceil((lesson.question_count || 5) * 0.5);

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => confirmExit(() => navigation.goBack())}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.body, { opacity: fadeAnim }]}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.mascotWrap}>
              {/* 3D only while focused — unmount frees the WebView + RAM. */}
              <BrandAvatar
                character={equippedCharacter}
                size={180}
                autoRotate={isFocused}
                allowDrag={isFocused}
              />
              <Text style={styles.cheerText}>{CELEBRATIONS.lessonIntro}</Text>
            </View>

            <Text style={styles.moduleLabel}>{module.title}</Text>
            <Text style={styles.lessonTitle}>{lesson.title}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.metaText}>{lesson.question_count || 5} questions</Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={styles.metaText}>~{estimatedMinutes} min</Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="flash-outline" size={16} color={colors.primary} />
                <Text style={styles.metaText}>+50 XP</Text>
              </View>
            </View>

            <View style={styles.typesList}>
              <Text style={styles.typesTitle}>What to expect</Text>
              {[
                { icon: 'checkmark-circle-outline', text: 'True / False questions' },
                { icon: 'radio-button-on-outline', text: 'Multiple choice questions' },
                { icon: 'list-outline', text: 'Select all that apply' },
                { icon: 'git-compare-outline', text: 'Match the following' },
                { icon: 'create-outline', text: 'Fill in the blanks' },
              ].map((item) => (
                <View key={item.text} style={styles.typeRow}>
                  <Ionicons name={item.icon} size={18} color={colors.primary} />
                  <Text style={styles.typeText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <PuckButton
              color={colors.primary}
              height={56}
              borderRadius={18}
              lip={5}
              onPress={startLesson}
              contentStyle={styles.startInner}
            >
              <Text style={styles.startText}>Start Lesson</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.background} />
            </PuckButton>
          </View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 24 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    marginBottom: 8,
    gap: 4,
    alignSelf: 'flex-start',
    minHeight: 44,
  },
  backLabel: { fontSize: 16, color: colors.textSecondary },
  body: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 16,
  },
  mascotWrap: { alignItems: 'center', marginBottom: 28 },
  cheerText: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  moduleLabel: { fontSize: 14, fontWeight: '600', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  lessonTitle: { fontSize: 28, fontWeight: '800', color: colors.white, textAlign: 'center', letterSpacing: -0.5, marginBottom: 24 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 36 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(61,220,95,0.1)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(61,220,95,0.2)',
  },
  metaText: { fontSize: 13, fontWeight: '600', color: colors.white },
  typesList: {
    width: '100%', backgroundColor: colors.surfaceElevated,
    borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border,
  },
  typesTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  typeText: { fontSize: 15, color: colors.white },
  footer: { paddingBottom: 16, paddingTop: 8 },
  startInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  startText: { fontSize: 18, fontWeight: '800', color: colors.background },
});
