import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useUserProgress } from '../context/UserProgressContext';
import { useTheme } from '../context/ThemeContext';
import { BrandLoader, BrandHeader, BrandEmptyState } from '../components/brand';
import { API_BASE_URL } from '../config/api';
import { LOADER_MESSAGES } from '../constants/brandCopy';
import { useTabBarInset } from '../navigation/tabBarLayout';

// Brand greens stay constant across light/dark themes
const GREEN = { a: '#5BCB3C', b: '#3FB22E', solid: '#46B82F' };

const NODE_SIZE = 64;
const ROW_H = 104;
const TOP_PAD = 28;
const BOTTOM_PAD = 28;
const SCREEN_W = Dimensions.get('window').width;
const CARD_W = SCREEN_W - 40;        // scroll has 20px horizontal padding
const CENTER_X = CARD_W / 2;
const AMPLITUDE = CARD_W * 0.17;

// Rotating colors + icons give each node visual variety (Duolingo style)
const NODE_PALETTE = [
  { color: '#A77BF0', icon: 'clipboard' },
  { color: '#42CF5A', icon: 'create' },
  { color: '#FB8C3C', icon: 'swap-horizontal' },
  { color: '#3B9EE3', icon: 'analytics' },
  { color: '#EC4899', icon: 'play' },
  { color: '#4F86F7', icon: 'chatbubble-ellipses' },
  { color: '#F5B72B', icon: 'checkmark-circle' },
];

function nodeOffsetX(index) {
  return Math.sin(index * (Math.PI / 4)) * AMPLITUDE;
}
function nodeCenterX(index) {
  return CENTER_X + nodeOffsetX(index);
}
function nodeCenterY(index) {
  return TOP_PAD + NODE_SIZE / 2 + index * ROW_H;
}

function ConnectorDots({ styles, index }) {
  // dotted diagonal segment between node[index-1] and node[index]
  const fromX = nodeCenterX(index - 1);
  const fromY = nodeCenterY(index - 1);
  const toX = nodeCenterX(index);
  const toY = nodeCenterY(index);
  const DOTS = 5;
  return (
    <>
      {Array.from({ length: DOTS - 1 }).map((_, k) => {
        const t = (k + 1) / DOTS;
        const x = fromX + (toX - fromX) * t;
        const y = fromY + (toY - fromY) * t;
        return (
          <View
            key={k}
            style={[styles.connectorDot, { left: x - 3.5, top: y - 3.5 }]}
          />
        );
      })}
    </>
  );
}

function SolidConnector({ index }) {
  const fromX = nodeCenterX(index - 1);
  const fromY = nodeCenterY(index - 1);
  const toX = nodeCenterX(index);
  const toY = nodeCenterY(index);
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  return (
    <View
      style={{
        position: 'absolute',
        left: fromX,
        top: fromY - 2.5,
        width: length,
        height: 5,
        borderRadius: 3,
        backgroundColor: GREEN.solid,
        transform: [{ rotateZ: `${angle}rad` }],
        transformOrigin: 'left center',
      }}
    />
  );
}

function RoadmapNode({ styles, lockColor, lesson, index, status, onPress, pulse }) {
  const theme = NODE_PALETTE[index % NODE_PALETTE.length];
  const isLocked = status === 'locked';
  const isCompleted = status === 'completed';
  const isCurrent = status === 'current';

  const circleColor = isLocked ? lockColor : theme.color;
  const iconName = isLocked ? 'lock-closed' : theme.icon;

  const cx = nodeCenterX(index);
  const cy = nodeCenterY(index);
  // Flip the "JUMP HERE?" pill to the node's left when the node sits on the
  // right side of the lane, so it never runs off the screen edge.
  const pillOnLeft = nodeOffsetX(index) > 8;

  return (
    <>
      {/* Pulsing glow ring for current node */}
      {isCurrent && (
        <Animated.View
          style={[
            styles.glowRing,
            {
              left: cx - (NODE_SIZE + 24) / 2,
              top: cy - (NODE_SIZE + 24) / 2,
              backgroundColor: theme.color,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.12] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }],
            },
          ]}
        />
      )}

      <TouchableOpacity
        activeOpacity={isLocked ? 1 : 0.85}
        disabled={isLocked}
        onPress={onPress}
        style={[
          styles.node,
          {
            left: cx - NODE_SIZE / 2,
            top: cy - NODE_SIZE / 2,
            backgroundColor: circleColor,
            shadowColor: circleColor,
            opacity: isLocked ? 0.75 : 1,
          },
        ]}
      >
        <Ionicons name={iconName} size={26} color="#FFFFFF" />
        {isCompleted && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>

      {/* JUMP HERE pill for current node — sits on whichever side has room */}
      {isCurrent && (
        <View
          style={[
            styles.jumpPill,
            pillOnLeft
              ? { right: CARD_W - (cx - NODE_SIZE / 2 + 4), top: cy + 4 }
              : { left: cx + NODE_SIZE / 2 - 4, top: cy + 4 },
          ]}
        >
          <Text style={styles.jumpPillText}>JUMP HERE?</Text>
        </View>
      )}
    </>
  );
}

function ModuleSection({ styles, lockColor, module, sectionNumber, isCurrentModule, locked, collapsed, onToggle, onLessonPress, pulse }) {
  const lessons = module.lessons || [];
  const lessonCount = module.lesson_count || lessons.length;
  const completedCount = module.completed_lesson_count || 0;
  const progress = lessonCount > 0 ? completedCount / lessonCount : 0;

  // Determine status of each lesson. A locked module keeps every lesson locked
  // until the previous module is fully completed.
  let currentAssigned = false;
  const statuses = lessons.map((l) => {
    if (locked) return 'locked';
    if (l.is_completed) return 'completed';
    if (!currentAssigned) { currentAssigned = true; return 'current'; }
    return 'locked';
  });

  const pathHeight = TOP_PAD + BOTTOM_PAD + Math.max(lessons.length - 1, 0) * ROW_H + NODE_SIZE;

  return (
    <View style={styles.section}>
      {/* Green section header */}
      <LinearGradient
        colors={[GREEN.a, GREEN.b]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.sectionHeader}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>SECTION {sectionNumber}</Text>
            {locked && (
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed" size={10} color="#FFFFFF" />
                <Text style={styles.currentBadgeText}>LOCKED</Text>
              </View>
            )}
            {!locked && isCurrentModule && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>CURRENT</Text>
              </View>
            )}
          </View>
          <Text style={styles.sectionTitle}>{module.title}</Text>
          <View style={styles.sectionProgressRow}>
            <View style={styles.sectionTrack}>
              <View style={[styles.sectionFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.sectionProgressText}>{completedCount}/{lessonCount}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.collapseBtn} onPress={onToggle} activeOpacity={0.8}>
          <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* White path area */}
      {!collapsed && (
        <View style={[styles.pathArea, { height: pathHeight }]}>
          {/* Connectors first (drawn behind nodes) */}
          {lessons.map((lesson, idx) => {
            if (idx === 0) return null;
            const prevCompleted = lessons[idx - 1]?.is_completed;
            return prevCompleted
              ? <SolidConnector key={`c-${lesson.id}`} index={idx} />
              : <ConnectorDots key={`c-${lesson.id}`} styles={styles} index={idx} />;
          })}
          {/* Nodes */}
          {lessons.map((lesson, idx) => (
            <RoadmapNode
              key={lesson.id}
              styles={styles}
              lockColor={lockColor}
              lesson={lesson}
              index={idx}
              status={statuses[idx]}
              pulse={pulse}
              onPress={() => onLessonPress(lesson, module)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function getNextLesson(modules) {
  for (const mod of modules) {
    for (const lesson of (mod.lessons || [])) {
      if (!lesson.is_completed) return { lesson, module: mod };
    }
  }
  return null;
}

export default function CoursesScreen({ navigation }) {
  const { modules, loading, loadError, refresh, pendingFirstLesson, clearPendingFirstLesson } = useUserProgress();
  const { colors, isDark } = useTheme();
  const tabBarInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabBarInset), [colors, tabBarInset]);
  const lockColor = isDark ? '#3A3D42' : '#C2C8D0';
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  function handleLessonPress(lesson, module) {
    navigation.navigate('LessonIntro', { lesson, module });
  }

  // Fresh out of onboarding: drop the user straight into their first lesson so
  // they experience the app right away.
  useEffect(() => {
    if (!pendingFirstLesson) return;
    if (loading || !modules.length) return;
    const first = getNextLesson(modules);
    clearPendingFirstLesson();
    if (first) {
      navigation.navigate('LessonIntro', { lesson: first.lesson, module: first.module });
    }
  }, [pendingFirstLesson, loading, modules, navigation, clearPendingFirstLesson]);

  function toggleSection(id, isCurrentlyCollapsed) {
    setCollapsed((prev) => ({ ...prev, [id]: !isCurrentlyCollapsed }));
  }

  const nextLesson = getNextLesson(modules);

  // A module is unlocked only once every module before it is fully completed.
  // This forces users to progress through the roadmap in order.
  const isModuleComplete = (mod) => {
    const total = mod.lesson_count || (mod.lessons || []).length;
    const done = mod.completed_lesson_count || 0;
    return total > 0 && done >= total;
  };
  const lockedModuleIds = useMemo(() => {
    const locked = new Set();
    let prevAllComplete = true;
    for (const mod of modules) {
      if (!prevAllComplete) locked.add(mod.id);
      if (!isModuleComplete(mod)) prevAllComplete = false;
    }
    return locked;
  }, [modules]);

  // The current module is the first one not fully completed
  const currentModuleId = (() => {
    for (const mod of modules) {
      if (!isModuleComplete(mod)) return mod.id;
    }
    return null;
  })();

  return (
    <View style={styles.screen}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {loading ? (
          <BrandLoader message={LOADER_MESSAGES.roadmap} />
        ) : (
          <>
            <BrandHeader title="Courses" subtitle="Your learning roadmap" />

            {loadError ? (
              <BrandEmptyState
                title="Couldn't load courses"
                body={`${loadError}\n\nConnected to:\n${API_BASE_URL}\n\nPull down to retry, or sign out and sign back in.`}
                style={{ marginTop: 48 }}
              />
            ) : modules.length === 0 ? (
              <BrandEmptyState
                title="No courses yet"
                body={`Nothing returned from the server.\n\nConnected to:\n${API_BASE_URL}\n\nPull down to refresh.`}
                style={{ marginTop: 48 }}
              />
            ) : (
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN.solid} />
              }
            >
            {/* MoneyBot Daily */}
            <TouchableOpacity
              style={styles.dailyCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('DailyBlitz')}
            >
              <LinearGradient
                colors={['#F5B72B', '#FF9F1C', '#FF6B35']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dailyCardGrad}
              >
                <View style={styles.dailyIconWrap}>
                  <Ionicons name="today" size={26} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dailyLabel}>MONEYBOT DAILY</Text>
                  <Text style={styles.dailyTitle}>Today's puzzle</Text>
                  <Text style={styles.dailySub}>5 rounds · Same for everyone · Keep your streak</Text>
                </View>
                <View style={styles.dailyGo}>
                  <Ionicons name="arrow-forward" size={20} color="#FF6B35" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Continue Learning banner */}
            {nextLesson && (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => handleLessonPress(nextLesson.lesson, nextLesson.module)}
              >
                <LinearGradient
                  colors={[GREEN.a, GREEN.b]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.continueCard}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.continueLabel}>CONTINUE LEARNING</Text>
                    <Text style={styles.continueTitle} numberOfLines={1}>{nextLesson.lesson.title}</Text>
                    <Text style={styles.continueSub} numberOfLines={1}>
                      {nextLesson.module.title} · 50 XP
                    </Text>
                  </View>
                  <View style={styles.continueArrow}>
                    <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {modules.map((module, i) => {
              const locked = lockedModuleIds.has(module.id);
              // Locked modules collapse by default; the user can still expand
              // them to preview the lessons, but cannot start them.
              const isCollapsed = module.id in collapsed ? collapsed[module.id] : locked;
              return (
                <ModuleSection
                  key={module.id}
                  styles={styles}
                  lockColor={lockColor}
                  module={module}
                  sectionNumber={module.order || i + 1}
                  isCurrentModule={module.id === currentModuleId}
                  locked={locked}
                  collapsed={isCollapsed}
                  onToggle={() => toggleSection(module.id, isCollapsed)}
                  onLessonPress={handleLessonPress}
                  pulse={pulse}
                />
              );
            })}
            <View style={{ height: 32 }} />
          </ScrollView>
            )}
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors, tabBarInset) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: tabBarInset },

  // MoneyBot Daily
  dailyCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 16 },
  dailyCardGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18,
    shadowColor: '#FF6B35', shadowOpacity: 0.3, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  dailyIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  dailyLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.9)', letterSpacing: 1.2, marginBottom: 4 },
  dailyTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 },
  dailySub: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  dailyGo: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },

  // Continue Learning
  continueCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 22, padding: 20, marginBottom: 22,
    shadowColor: GREEN.b, shadowOpacity: 0.3, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  continueLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', letterSpacing: 1.2, marginBottom: 6 },
  continueTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 4, letterSpacing: -0.3 },
  continueSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  continueArrow: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Section
  section: {
    borderRadius: 24, marginBottom: 22, overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 18, paddingHorizontal: 20,
  },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 1.2 },
  currentBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  lockedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  currentBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 12, letterSpacing: -0.4 },
  sectionProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTrack: { flex: 1, height: 7, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 4, overflow: 'hidden' },
  sectionFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 4 },
  sectionProgressText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  collapseBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Path
  pathArea: { position: 'relative', width: '100%' },
  connectorDot: {
    position: 'absolute', width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: colors.textMuted,
  },
  node: {
    position: 'absolute',
    width: NODE_SIZE, height: NODE_SIZE, borderRadius: NODE_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  checkBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: GREEN.solid, borderWidth: 2.5, borderColor: colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: NODE_SIZE + 24, height: NODE_SIZE + 24,
    borderRadius: (NODE_SIZE + 24) / 2,
  },
  jumpPill: {
    position: 'absolute',
    backgroundColor: colors.surfaceElevated, borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 2, borderColor: GREEN.solid,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  jumpPillText: { fontSize: 12, fontWeight: '800', color: GREEN.solid, letterSpacing: 0.3 },
});
