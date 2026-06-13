import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { coursesApi } from '../api/courses';
import { useTheme } from '../context/ThemeContext';
import { useUserProgress, getModuleIonIcon } from '../context/UserProgressContext';
import { BrandAvatar } from '../components/brand';
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
  const [questions, setQuestions] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    let cancelled = false;
    coursesApi.getLessonQuestions(token, lesson.id)
      .then((data) => { if (!cancelled) setQuestions(data || []); })
      .catch(() => { if (!cancelled) setQuestions([]); });
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

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.mascotWrap}>
            <BrandAvatar character={equippedCharacter} size={80} />
            <Text style={styles.cheerText}>{CELEBRATIONS.lessonIntro}</Text>
          </View>

          <View style={styles.iconWrap}>
            <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.iconGrad}>
              <Ionicons name={getModuleIonIcon(module)} size={48} color={colors.background} />
            </LinearGradient>
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
            ].map((item) => (
              <View key={item.text} style={styles.typeRow}>
                <Ionicons name={item.icon} size={18} color={colors.primary} />
                <Text style={styles.typeText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.startBtn}
            activeOpacity={0.85}
            onPress={startLesson}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.startGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={styles.startText}>Start Lesson</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.background} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 24 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, marginBottom: 8, gap: 4, alignSelf: 'flex-start' },
  backLabel: { fontSize: 16, color: colors.textSecondary },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 0 },
  mascotWrap: { alignItems: 'center', marginBottom: 16 },
  cheerText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  iconWrap: { marginBottom: 28 },
  iconGrad: { width: 100, height: 100, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 48 },
  moduleLabel: { fontSize: 14, fontWeight: '600', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  lessonTitle: { fontSize: 28, fontWeight: '800', color: colors.white, textAlign: 'center', letterSpacing: -0.5, marginBottom: 24 },
  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 36 },
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
  footer: { paddingBottom: 16 },
  startBtn: { borderRadius: 18, overflow: 'hidden' },
  startGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 18, paddingHorizontal: 32, borderRadius: 18,
  },
  startText: { fontSize: 18, fontWeight: '800', color: colors.background },
});
