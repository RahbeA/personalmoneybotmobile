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
import { cacheKeys, fetchWithCache, TTL } from '../utils/apiCache';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { BrandLoader, BrandFeedback, BrandEmptyState } from '../components/brand';
import { LOADER_MESSAGES } from '../constants/brandCopy';

const MAX_LIVES = 3;
const PAIR_SEP = '::';

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseMatchData(answers) {
  const pairs = answers
    .filter((a) => a.is_correct)
    .map((a) => {
      const [left = '', right = ''] = String(a.text).split(PAIR_SEP);
      return { left: left.trim(), right: right.trim() };
    });
  const distractors = answers.filter((a) => !a.is_correct).map((a) => a.text.trim());
  const bank = shuffleArray([...pairs.map((p) => p.right), ...distractors]);
  return { pairs, bank };
}

function fillBlankSlotCount(prompt) {
  const parts = String(prompt || '').split('___');
  return Math.min(Math.max(parts.length - 1, 0), 1) || 1;
}

function parseFillBlankData(question) {
  const parts = String(question.prompt || '').split('___');
  const slotCount = fillBlankSlotCount(question.prompt);
  const allCorrect = question.answers
    .filter((a) => a.is_correct)
    .map((a) => a.text.trim())
    .filter(Boolean);
  const distractors = question.answers
    .filter((a) => !a.is_correct)
    .map((a) => a.text.trim())
    .filter(Boolean);
  const correctWords = allCorrect.length ? [allCorrect[0]] : [];
  const bank = shuffleArray([...correctWords, ...distractors]);
  return { parts, correctWords, bank, slotCount };
}

function normalizeFillSelection(selected, slotCount) {
  if (Array.isArray(selected)) {
    const arr = selected.slice(0, slotCount);
    while (arr.length < slotCount) arr.push(null);
    return arr;
  }
  return Array(slotCount).fill(null);
}

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
  const selectedIds = Array.isArray(selected) ? selected : [];
  return (
    <View style={styles.mcqList}>
      {answers.map((ans) => {
        const isSelected = selectedIds.includes(ans.id);
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

function WordBank({ styles, colors, words, onPick, revealed }) {
  if (!words.length) return null;
  return (
    <View style={styles.wordBankWrap}>
      <Text style={styles.wordBankLabel}>Word bank</Text>
      <View style={styles.wordBank}>
        {words.map((word, idx) => (
          <TouchableOpacity
            key={`${word}-${idx}`}
            style={styles.wordChip}
            onPress={() => !revealed && onPick(word)}
            disabled={revealed}
            activeOpacity={0.75}
          >
            <Text style={styles.wordChipText}>{word}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function MatchQuestion({ styles, colors, answers, selected, onChange, revealed }) {
  const { pairs, bank } = useMemo(() => parseMatchData(answers), [answers]);
  const [activeSlot, setActiveSlot] = useState(0);
  const assignments = Array.isArray(selected) ? selected : Array(pairs.length).fill(null);
  const remaining = useMemo(() => {
    const pool = [...bank];
    assignments.filter(Boolean).forEach((word) => {
      const i = pool.indexOf(word);
      if (i >= 0) pool.splice(i, 1);
    });
    return pool;
  }, [bank, assignments]);

  function pickWord(word) {
    const slot = assignments.findIndex((v) => !v);
    const target = slot >= 0 ? slot : activeSlot;
    if (assignments[target]) return;
    const next = [...assignments];
    next[target] = word;
    onChange(next);
    const nextEmpty = next.findIndex((v) => !v);
    if (nextEmpty >= 0) setActiveSlot(nextEmpty);
  }

  function clearSlot(index) {
    if (revealed) return;
    const next = [...assignments];
    next[index] = null;
    onChange(next);
    setActiveSlot(index);
  }

  return (
    <View style={styles.matchWrap}>
      {pairs.map((pair, index) => {
        const assigned = assignments[index];
        const isCorrect = revealed && assigned === pair.right;
        const isWrong = revealed && assigned && assigned !== pair.right;
        const isActive = !revealed && activeSlot === index && !assigned;
        return (
          <View key={`${pair.left}-${index}`} style={styles.matchRow}>
            <Text style={styles.matchLeft} numberOfLines={2}>{pair.left}</Text>
            <TouchableOpacity
              style={[
                styles.matchSlot,
                assigned && !revealed && styles.matchSlotFilled,
                isActive && styles.matchSlotActive,
                isCorrect && styles.matchSlotCorrect,
                isWrong && styles.matchSlotWrong,
              ]}
              onPress={() => {
                if (revealed) return;
                if (assigned) clearSlot(index);
                else setActiveSlot(index);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.matchSlotText, !assigned && styles.matchSlotPlaceholder]}>
                {assigned || 'Tap to match'}
              </Text>
              {revealed && isCorrect && (
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              )}
              {revealed && isWrong && (
                <Ionicons name="close-circle" size={18} color={colors.error} />
              )}
            </TouchableOpacity>
          </View>
        );
      })}
      <WordBank
        styles={styles}
        colors={colors}
        words={remaining}
        onPick={pickWord}
        revealed={revealed}
      />
    </View>
  );
}

function FillBlankQuestion({ styles, colors, question, selected, onChange, revealed }) {
  const { parts, correctWords, bank, slotCount } = useMemo(() => parseFillBlankData(question), [question]);
  const [activeBlank, setActiveBlank] = useState(0);
  const filled = normalizeFillSelection(selected, slotCount);
  const remaining = useMemo(() => {
    const pool = [...bank];
    filled.filter(Boolean).forEach((word) => {
      const i = pool.indexOf(word);
      if (i >= 0) pool.splice(i, 1);
    });
    return pool;
  }, [bank, filled]);

  function pickWord(word) {
    const blank = filled.findIndex((v) => !v);
    const target = blank >= 0 ? blank : activeBlank;
    if (filled[target]) return;
    const next = [...filled];
    next[target] = word;
    onChange(next);
    const nextEmpty = next.findIndex((v) => !v);
    if (nextEmpty >= 0) setActiveBlank(nextEmpty);
  }

  function clearBlank(index) {
    if (revealed) return;
    const next = [...filled];
    next[index] = null;
    onChange(next);
    setActiveBlank(index);
  }

  return (
    <View style={styles.fillWrap}>
      <View style={styles.fillSentence}>
        {parts.map((part, index) => (
          <React.Fragment key={`part-${index}`}>
            {part ? <Text style={styles.fillText}>{part}</Text> : null}
            {index < parts.length - 1 && index < slotCount ? (
              <TouchableOpacity
                onPress={() => {
                  if (revealed) return;
                  if (filled[index]) clearBlank(index);
                  else setActiveBlank(index);
                }}
                activeOpacity={0.8}
                style={[
                  styles.blankPill,
                  filled[index] && !revealed && styles.blankPillFilled,
                  !revealed && activeBlank === index && !filled[index] && styles.blankPillActive,
                  revealed && filled[index] && filled[index] === correctWords[index] && styles.blankPillCorrect,
                  revealed && filled[index] && filled[index] !== correctWords[index] && styles.blankPillWrong,
                ]}
              >
                <Text
                  style={[
                    styles.blankPillText,
                    !filled[index] && styles.blankPillPlaceholder,
                  ]}
                >
                  {filled[index] || '___'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </React.Fragment>
        ))}
      </View>
      <WordBank
        styles={styles}
        colors={colors}
        words={remaining}
        onPick={pickWord}
        revealed={revealed}
      />
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
  const [selected, setSelected] = useState(null); // id(s) for standard types, string[] for match/fill_blank
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
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
  const qType = currentQ?.question_type;
  const isSelectAll = qType === 'select_all';
  const isMatch = qType === 'match';
  const isFillBlank = qType === 'fill_blank';
  const currentSelected = isSelectAll
    ? (Array.isArray(selected) ? selected : [])
    : selected;

  function resetForQuestion(question) {
    if (!question) return;
    const t = question.question_type;
    if (t === 'select_all') setSelected([]);
    else if (t === 'match') {
      const count = question.answers.filter((a) => a.is_correct).length;
      setSelected(Array(count).fill(null));
    } else if (t === 'fill_blank') {
      setSelected(Array(fillBlankSlotCount(question.prompt)).fill(null));
    } else setSelected(null);
    setRevealed(false);
    setIsCorrect(null);
    setShowFeedback(false);
  }

  useEffect(() => {
    resetForQuestion(currentQ);
  }, [currentIdx, currentQ?.id]);

  let hasSelection = false;
  if (isSelectAll) hasSelection = Array.isArray(selected) && selected.length > 0;
  else if (isMatch) {
    hasSelection = Array.isArray(selected) && selected.length > 0 && selected.every((v) => v);
  } else if (isFillBlank) {
    const slots = fillBlankSlotCount(currentQ?.prompt);
    hasSelection = normalizeFillSelection(selected, slots).every((v) => v);
  } else hasSelection = selected !== null;

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
      const selectedSorted = [...(Array.isArray(selected) ? selected : [])].sort();
      correct = JSON.stringify(correctIds) === JSON.stringify(selectedSorted);
    } else if (isMatch) {
      const { pairs } = parseMatchData(currentQ.answers);
      correct = pairs.every((pair, i) => selected[i] === pair.right);
    } else if (isFillBlank) {
      const { correctWords, slotCount } = parseFillBlankData(currentQ);
      const filled = normalizeFillSelection(selected, slotCount);
      correct = correctWords.every((word, i) => filled[i] === word);
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

  if (!currentQ) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safe}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={exitToCourses} style={styles.exitBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.emptyWrap}>
            <BrandEmptyState
              character={equippedCharacter}
              title="No questions yet"
              body="This lesson doesn't have any questions yet. Check back soon — we're still putting it together."
            />
          </View>
          <View style={styles.footer}>
            <TouchableOpacity style={styles.ctaBtn} onPress={exitToCourses} activeOpacity={0.85}>
              <Text style={styles.ctaText}>Back to Lessons</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

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
                {qType === 'true_false' ? 'True or False' :
                 qType === 'mcq' ? 'Choose One' :
                 qType === 'select_all' ? 'Select All That Apply' :
                 qType === 'match' ? 'Match the Following' :
                 qType === 'fill_blank' ? 'Fill in the Blanks' : 'Question'}
              </Text>
            </View>

            {/* Prompt — hidden for fill_blank (sentence includes it) */}
            {qType !== 'fill_blank' && (
              <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                <Text style={styles.prompt}>{currentQ.prompt}</Text>
              </Animated.View>
            )}
            {qType === 'fill_blank' && (
              <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                <Text style={styles.fillHint}>Tap words from the bank to fill each blank.</Text>
              </Animated.View>
            )}

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
                    const arr = Array.isArray(prev) ? prev : [];
                    return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
                  });
                }}
                revealed={revealed}
              />
            )}
            {isMatch && (
              <MatchQuestion
                styles={styles}
                colors={colors}
                answers={currentQ.answers}
                selected={selected}
                onChange={setSelected}
                revealed={revealed}
              />
            )}
            {isFillBlank && (
              <FillBlankQuestion
                styles={styles}
                colors={colors}
                question={currentQ}
                selected={selected}
                onChange={setSelected}
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
                  {isSelectAll || isMatch || isFillBlank ? 'Check Answers' : 'Check Answer'}
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
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  fillHint: { fontSize: 15, color: colors.textSecondary, marginBottom: 16, lineHeight: 22 },
  matchWrap: { gap: 12 },
  matchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceElevated, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  matchLeft: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.white },
  matchSlot: {
    minWidth: 130, maxWidth: '52%', minHeight: 44, borderRadius: 12,
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
    paddingHorizontal: 10, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  matchSlotFilled: { borderStyle: 'solid', borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.08)' },
  matchSlotActive: { borderColor: colors.primary, borderStyle: 'solid' },
  matchSlotCorrect: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.12)' },
  matchSlotWrong: { borderColor: colors.error, backgroundColor: 'rgba(255,77,77,0.08)' },
  matchSlotText: { fontSize: 14, fontWeight: '600', color: colors.white, textAlign: 'center', flexShrink: 1 },
  matchSlotPlaceholder: { color: colors.textMuted, fontWeight: '500' },
  fillWrap: { gap: 20 },
  fillSentence: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  fillText: { fontSize: 20, fontWeight: '600', color: colors.white, lineHeight: 32 },
  blankPill: {
    minWidth: 72, minHeight: 36, borderRadius: 10, marginHorizontal: 4, marginVertical: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 2, borderColor: colors.border,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
  },
  blankPillFilled: { borderStyle: 'solid', borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.08)' },
  blankPillActive: { borderColor: colors.primary, borderStyle: 'solid' },
  blankPillCorrect: { borderColor: colors.primary, backgroundColor: 'rgba(61,220,95,0.12)' },
  blankPillWrong: { borderColor: colors.error, backgroundColor: 'rgba(255,77,77,0.08)' },
  blankPillText: { fontSize: 16, fontWeight: '700', color: colors.white },
  blankPillPlaceholder: { color: colors.textMuted, fontWeight: '500' },
  wordBankWrap: { marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  wordBankLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 10 },
  wordBank: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  wordChip: {
    backgroundColor: colors.surfaceElevated, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  wordChipText: { fontSize: 15, fontWeight: '600', color: colors.white },
});
