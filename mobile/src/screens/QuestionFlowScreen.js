import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ScrollView, Alert, BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { coursesApi } from '../api/courses';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { BrandLoader, BrandFeedback } from '../components/brand';
import { LOADER_MESSAGES } from '../constants/brandCopy';

const MAX_LIVES = 3;

function ProgressBar({ styles, current, total }) {
  const anim = useRef(new Animated.Value(0)).current;
  const progress = total > 0 ? (current / total) : 0;

  useEffect(() => {
    Animated.timing(anim, { toValue: progress, duration: 300, useNativeDriver: false }).start();
  }, [progress]);

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          { width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

function Hearts({ styles, colors, lives }) {
  return (
    <View style={styles.hearts}>
      {Array.from({ length: MAX_LIVES }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < lives ? 'heart' : 'heart-outline'}
          size={22}
          color={i < lives ? '#FF4D6D' : colors.textMuted}
        />
      ))}
    </View>
  );
}

function confirmExit(onLeave) {
  Alert.alert(
    'Leave lesson?',
    'Your progress in this lesson will not be saved.',
    [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: onLeave },
    ],
  );
}

function TrueFalseQuestion({ styles, colors, answers, selected, onSelect, revealed }) {
  return (
    <View style={styles.tfRow}>
      {answers.map((ans) => {
        const isSelected = selected === ans.id;
        let cardStyle = styles.tfCard;
        if (revealed) {
          if (ans.is_correct) cardStyle = styles.tfCardCorrect;
          else if (isSelected && !ans.is_correct) cardStyle = styles.tfCardWrong;
        } else if (isSelected) {
          cardStyle = styles.tfCardSelected;
        }
        return (
          <TouchableOpacity
            key={ans.id}
            style={[styles.tfCard, cardStyle]}
            onPress={() => !revealed && onSelect(ans.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.tfText}>{ans.text}</Text>
            {revealed && ans.is_correct && (
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} style={{ marginTop: 6 }} />
            )}
            {revealed && isSelected && !ans.is_correct && (
              <Ionicons name="close-circle" size={22} color={colors.error} style={{ marginTop: 6 }} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MCQQuestion({ styles, colors, answers, selected, onSelect, revealed }) {
  return (
    <View style={styles.mcqList}>
      {answers.map((ans, idx) => {
        const isSelected = selected === ans.id;
        let cardStyle = null;
        let textStyle = null;
        let icon = null;
        if (revealed) {
          if (ans.is_correct) { cardStyle = styles.ansCorrect; textStyle = styles.ansTextCorrect; icon = 'checkmark-circle'; }
          else if (isSelected) { cardStyle = styles.ansWrong; textStyle = styles.ansTextWrong; icon = 'close-circle'; }
        } else if (isSelected) {
          cardStyle = styles.ansSelected;
        }
        return (
          <TouchableOpacity
            key={ans.id}
            style={[styles.ansCard, cardStyle]}
            onPress={() => !revealed && onSelect(ans.id)}
            activeOpacity={0.8}
          >
            <View style={[styles.ansIndex, isSelected && !revealed && styles.ansIndexSelected]}>
              <Text style={styles.ansIndexText}>{['A', 'B', 'C', 'D'][idx]}</Text>
            </View>
            <Text style={[styles.ansText, textStyle]} numberOfLines={3}>{ans.text}</Text>
            {revealed && icon && (
              <Ionicons
                name={icon}
                size={20}
                color={ans.is_correct ? colors.primary : colors.error}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SelectAllQuestion({ styles, colors, answers, selected, onToggle, revealed }) {
  return (
    <View style={styles.mcqList}>
      {answers.map((ans) => {
        const isSelected = selected.includes(ans.id);
        let cardStyle = null;
        let textStyle = null;
        let icon = null;
        if (revealed) {
          if (ans.is_correct) { cardStyle = styles.ansCorrect; textStyle = styles.ansTextCorrect; icon = 'checkmark-circle'; }
          else if (isSelected) { cardStyle = styles.ansWrong; textStyle = styles.ansTextWrong; icon = 'close-circle'; }
        } else if (isSelected) {
          cardStyle = styles.ansSelected;
        }
        return (
          <TouchableOpacity
            key={ans.id}
            style={[styles.ansCard, cardStyle]}
            onPress={() => !revealed && onToggle(ans.id)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, isSelected && !revealed && styles.checkboxSelected]}>
              {isSelected && <Ionicons name="checkmark" size={14} color={revealed ? colors.textMuted : colors.background} />}
            </View>
            <Text style={[styles.ansText, textStyle]} numberOfLines={3}>{ans.text}</Text>
            {revealed && icon && (
              <Ionicons name={icon} size={20} color={ans.is_correct ? colors.primary : colors.error} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function QuestionFlowScreen({ navigation, route }) {
  const { lesson, module, questions: prefetchedQuestions } = route.params;
  const { token } = useAuth();
  const { equippedCharacter } = useUserProgress();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const hasPrefetched = Array.isArray(prefetchedQuestions) && prefetchedQuestions.length > 0;
  const [questions, setQuestions] = useState(hasPrefetched ? prefetchedQuestions : []);
  const [loading, setLoading] = useState(!hasPrefetched);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState(null); // string id for true_false/mcq, array for select_all
  const [revealed, setRevealed] = useState(false);
  const [lives, setLives] = useState(MAX_LIVES);
  const [mistakes, setMistakes] = useState(0);
  const [isCorrect, setIsCorrect] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const feedbackAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hasPrefetched) return undefined;
    let cancelled = false;
    coursesApi.getLessonQuestions(token, lesson.id)
      .then((data) => { if (!cancelled) setQuestions(data || []); })
      .catch(() => { if (!cancelled) setQuestions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hasPrefetched, token, lesson.id]);

  const exitToCourses = useCallback(() => {
    navigation.popToTop();
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        confirmExit(exitToCourses);
        return true;
      });
      return () => sub.remove();
    }, [exitToCourses]),
  );

  const currentQ = questions[currentIdx];
  const isSelectAll = currentQ?.question_type === 'select_all';
  const currentSelected = isSelectAll ? (selected || []) : selected;
  const hasSelection = isSelectAll ? (selected || []).length > 0 : selected !== null;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function flashFeedback() {
    feedbackAnim.setValue(1);
    Animated.timing(feedbackAnim, { toValue: 0, duration: 600, delay: 300, useNativeDriver: false }).start();
  }

  function checkAnswer() {
    if (!currentQ || !hasSelection) return;

    let correct = false;
    if (isSelectAll) {
      const correctIds = currentQ.answers.filter(a => a.is_correct).map(a => a.id).sort();
      const selectedSorted = [...(selected || [])].sort();
      correct = JSON.stringify(correctIds) === JSON.stringify(selectedSorted);
    } else {
      const selectedAns = currentQ.answers.find(a => a.id === selected);
      correct = selectedAns?.is_correct || false;
    }

    setRevealed(true);
    setIsCorrect(correct);
    setShowFeedback(true);
    flashFeedback();
    if (!correct) {
      shake();
      setLives(l => Math.max(l - 1, 0));
      setMistakes(m => m + 1);
    }
  }

  function nextQuestion() {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(i => i + 1);
      setSelected(isSelectAll ? [] : null);
      setRevealed(false);
      setIsCorrect(null);
      setShowFeedback(false);
    } else {
      navigation.replace('LessonComplete', { lesson, module, mistakes, stars: mistakesToStars(mistakes) });
    }
  }

  function mistakesToStars(m) {
    if (m === 0) return 3;
    if (m === 1) return 2;
    return 1;
  }

  if (loading) {
    return <BrandLoader message={LOADER_MESSAGES.questions} />;
  }

  if (!currentQ) return null;

  const feedbackBg = feedbackAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', isCorrect ? 'rgba(61,220,95,0.15)' : 'rgba(255,77,77,0.15)'],
  });

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => confirmExit(exitToCourses)}
            style={styles.exitBtn}
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <ProgressBar styles={styles} current={currentIdx} total={questions.length} />
          <Hearts styles={styles} colors={colors} lives={lives} />
        </View>

        <Animated.View style={[styles.content, { backgroundColor: feedbackBg }]}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Question type badge */}
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {currentQ.question_type === 'true_false' ? 'True or False' :
                 currentQ.question_type === 'mcq' ? 'Choose One' : 'Select All That Apply'}
              </Text>
            </View>

            {/* Prompt */}
            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              <Text style={styles.prompt}>{currentQ.prompt}</Text>
            </Animated.View>

            {/* Answer options */}
            {currentQ.question_type === 'true_false' && (
              <TrueFalseQuestion
                styles={styles}
                colors={colors}
                answers={currentQ.answers}
                selected={selected}
                onSelect={setSelected}
                revealed={revealed}
              />
            )}
            {currentQ.question_type === 'mcq' && (
              <MCQQuestion
                styles={styles}
                colors={colors}
                answers={currentQ.answers}
                selected={selected}
                onSelect={setSelected}
                revealed={revealed}
              />
            )}
            {currentQ.question_type === 'select_all' && (
              <SelectAllQuestion
                styles={styles}
                colors={colors}
                answers={currentQ.answers}
                selected={currentSelected}
                onToggle={(id) => {
                  setSelected(prev => {
                    const arr = prev || [];
                    return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
                  });
                }}
                revealed={revealed}
              />
            )}

            {/* Explanation (after reveal) */}
            {revealed && currentQ.explanation ? (
              <View style={[styles.explanation, isCorrect ? styles.explanationCorrect : styles.explanationWrong]}>
                <Ionicons
                  name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={isCorrect ? colors.primary : colors.error}
                />
                <Text style={[styles.explanationText, { color: isCorrect ? colors.primary : colors.error }]}>
                  {isCorrect ? 'Correct! ' : 'Not quite. '}
                  <Text style={styles.explanationBody}>{currentQ.explanation}</Text>
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer CTA */}
          <View style={styles.footer}>
            {!revealed ? (
              <TouchableOpacity
                style={[styles.ctaBtn, !hasSelection && styles.ctaBtnDisabled]}
                onPress={checkAnswer}
                disabled={!hasSelection}
                activeOpacity={0.85}
              >
                <Text style={[styles.ctaText, !hasSelection && styles.ctaTextDisabled]}>
                  {isSelectAll ? 'Check Answers' : 'Check Answer'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.ctaBtn} onPress={nextQuestion} activeOpacity={0.85}>
                <Text style={styles.ctaText}>
                  {currentIdx < questions.length - 1 ? 'Continue' : 'Finish Lesson'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        <BrandFeedback
          visible={showFeedback && revealed && isCorrect !== null}
          correct={!!isCorrect}
          character={equippedCharacter}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  loaderWrap: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 12 },
  exitBtn: { padding: 4 },
  progressTrack: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  hearts: { flexDirection: 'row', gap: 2 },
  content: { flex: 1, borderRadius: 0 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(61,220,95,0.12)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(61,220,95,0.2)',
  },
  typeBadgeText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  prompt: { fontSize: 22, fontWeight: '700', color: colors.white, lineHeight: 32, marginBottom: 28 },
  tfRow: { flexDirection: 'row', gap: 12 },
  tfCard: {
    flex: 1, paddingVertical: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceElevated, borderRadius: 18,
    borderWidth: 2, borderColor: colors.border,
  },
  tfCardSelected: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.1)' },
  tfCardCorrect: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.15)' },
  tfCardWrong: { borderColor: colors.error, backgroundColor: 'rgba(255,77,77,0.1)' },
  tfText: { fontSize: 17, fontWeight: '700', color: colors.white },
  mcqList: { gap: 12 },
  ansCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surfaceElevated, borderRadius: 16,
    padding: 16, borderWidth: 2, borderColor: colors.border,
  },
  ansSelected: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.08)' },
  ansCorrect: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.12)' },
  ansWrong: { borderColor: colors.error, backgroundColor: 'rgba(255,77,77,0.08)' },
  ansIndex: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  ansIndexSelected: { backgroundColor: colors.primary },
  ansIndexText: { fontSize: 13, fontWeight: '700', color: colors.white },
  ansText: { flex: 1, fontSize: 15, color: colors.white, lineHeight: 20 },
  ansTextCorrect: { color: colors.primary },
  ansTextWrong: { color: colors.error },
  checkbox: {
    width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent',
  },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  explanation: {
    flexDirection: 'row', gap: 10, padding: 16, borderRadius: 16, marginTop: 20,
    alignItems: 'flex-start', borderWidth: 1,
  },
  explanationCorrect: { backgroundColor: 'rgba(61,220,95,0.08)', borderColor: 'rgba(61,220,95,0.2)' },
  explanationWrong: { backgroundColor: 'rgba(255,77,77,0.08)', borderColor: 'rgba(255,77,77,0.2)' },
  explanationText: { fontSize: 14, fontWeight: '700', flex: 1, lineHeight: 20 },
  explanationBody: { fontWeight: '400', color: colors.offWhite },
  footer: { paddingHorizontal: 20, paddingBottom: 16 },
  ctaBtn: {
    backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
  },
  ctaBtnDisabled: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  ctaText: { fontSize: 17, fontWeight: '800', color: colors.background },
  ctaTextDisabled: { color: colors.textMuted },
});
