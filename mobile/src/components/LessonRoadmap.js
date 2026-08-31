import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import PuckButton, { shadeHex } from './PuckButton';
import AnimatedProgressBar from './AnimatedProgressBar';

export const ROADMAP_GREEN = { a: '#5BCB3C', b: '#3FB22E', solid: '#46B82F' };

const NODE_SIZE = 70;
const NODE_LIP = 6;
const ROW_H = 112;
const TOP_PAD = 24;
const BOTTOM_PAD = 28;
const UNIT_BANNER_H = 96;
const SCREEN_W = Dimensions.get('window').width;
const CARD_W = SCREEN_W - 40;
const CENTER_X = CARD_W / 2;
const AMPLITUDE = CARD_W * 0.17;

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
  const shared = {
    position: 'absolute',
    left: fromX,
    width: length,
    borderRadius: 4,
    transform: [{ rotateZ: `${angle}rad` }],
    transformOrigin: 'left center',
  };
  return (
    <>
      <View
        style={{
          ...shared,
          top: fromY - 1.5,
          height: 8,
          backgroundColor: shadeHex(ROADMAP_GREEN.solid, -0.35),
        }}
      />
      <View
        style={{
          ...shared,
          top: fromY - 3.5,
          height: 6,
          backgroundColor: ROADMAP_GREEN.solid,
        }}
      />
    </>
  );
}

function RoadmapNode({ styles, lockColor, index, status, onPress, pulse }) {
  const theme = NODE_PALETTE[index % NODE_PALETTE.length];
  const isLocked = status === 'locked';
  const isCompleted = status === 'completed';
  const isCurrent = status === 'current';

  const circleColor = isLocked ? lockColor : theme.color;
  const iconName = isLocked ? 'lock-closed' : theme.icon;

  const cx = nodeCenterX(index);
  const cy = nodeCenterY(index);
  const pillOnLeft = nodeOffsetX(index) > 8;

  return (
    <>
      {isCurrent && (
        <Animated.View
          style={[
            styles.glowRing,
            {
              left: cx - (NODE_SIZE + 26) / 2,
              top: cy - (NODE_SIZE + 26) / 2,
              backgroundColor: theme.color,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.1] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) }],
            },
          ]}
        />
      )}

      <View
        style={{
          position: 'absolute',
          left: cx - NODE_SIZE / 2,
          top: cy - NODE_SIZE / 2,
          opacity: isLocked ? 0.78 : 1,
        }}
      >
        <PuckButton
          color={circleColor}
          width={NODE_SIZE}
          height={NODE_SIZE}
          borderRadius={NODE_SIZE / 2}
          lip={NODE_LIP}
          disabled={isLocked}
          onPress={isLocked ? undefined : onPress}
        >
          <Ionicons name={iconName} size={28} color="#FFFFFF" />
        </PuckButton>
        {isCompleted && (
          <View style={styles.checkBadgeWrap} pointerEvents="none">
            <PuckButton
              color={ROADMAP_GREEN.solid}
              width={22}
              height={22}
              borderRadius={11}
              lip={3}
            >
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </PuckButton>
          </View>
        )}
      </View>

      {isCurrent && (
        <View
          style={[
            styles.jumpPillWrap,
            pillOnLeft
              ? { right: CARD_W - (cx - NODE_SIZE / 2 + 6), top: cy + 4 }
              : { left: cx + NODE_SIZE / 2 - 2, top: cy + 4 },
          ]}
        >
          <PuckButton
            color="#FFFFFF"
            height={32}
            width={118}
            borderRadius={16}
            lip={3}
            onPress={onPress}
            contentStyle={styles.jumpPillContent}
          >
            <Text style={[styles.jumpPillText, { color: shadeHex(theme.color, -0.12) }]}>START</Text>
          </PuckButton>
        </View>
      )}
    </>
  );
}

/** Duolingo-style green unit banner — used inline and in the sticky header. */
export const UnitBanner = React.memo(function UnitBanner({
  module, sectionNumber, locked, isCurrent, compact = false,
}) {
  const lessons = module.lessons || [];
  const lessonCount = module.lesson_count || lessons.length;
  const completedCount = module.completed_lesson_count || 0;
  const progress = lessonCount > 0 ? completedCount / lessonCount : 0;

  return (
    <View style={[unitBannerStyles.wrap, compact && unitBannerStyles.wrapCompact]}>
      <View style={unitBannerStyles.copy}>
        <View style={unitBannerStyles.labelRow}>
          <Text style={unitBannerStyles.kicker}>
            SECTION {sectionNumber}{locked ? ' · LOCKED' : ''}
          </Text>
          {!locked && isCurrent ? (
            <View style={unitBannerStyles.currentPill}>
              <Text style={unitBannerStyles.currentPillText}>CURRENT</Text>
            </View>
          ) : null}
        </View>
        <Text style={unitBannerStyles.title} numberOfLines={2}>{module.title}</Text>
        {!compact ? (
          <View style={unitBannerStyles.progressRow}>
            <AnimatedProgressBar
              progress={progress}
              height={6}
              trackColor="rgba(255,255,255,0.28)"
              fillColor="#FFFFFF"
              style={unitBannerStyles.track}
            />
            <Text style={unitBannerStyles.progressText}>{completedCount}/{lessonCount}</Text>
          </View>
        ) : null}
      </View>
      <View style={unitBannerStyles.divider} />
      <View style={unitBannerStyles.guideIcon}>
        <Ionicons name="book-outline" size={22} color="#FFFFFF" />
      </View>
    </View>
  );
});

const unitBannerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ROADMAP_GREEN.solid,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    minHeight: UNIT_BANNER_H - 8,
  },
  wrapCompact: {
    marginBottom: 0,
    borderRadius: 0,
    minHeight: 72,
    paddingVertical: 12,
  },
  copy: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 1.1,
  },
  currentPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  currentPillText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.35,
    marginBottom: 8,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, borderWidth: 0 },
  progressText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  divider: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginHorizontal: 12,
  },
  guideIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function ModuleSection({
  styles, lockColor, module, sectionNumber, isCurrentModule, locked,
  onLessonPress, pulse, onLayout,
}) {
  const lessons = module.lessons || [];
  const lessonCount = module.lesson_count || lessons.length;
  const completedCount = module.completed_lesson_count || 0;

  let currentAssigned = false;
  const statuses = lessons.map((l) => {
    if (locked) return 'locked';
    if (l.is_completed) return 'completed';
    if (!currentAssigned) { currentAssigned = true; return 'current'; }
    return 'locked';
  });

  const pathHeight = TOP_PAD + BOTTOM_PAD + Math.max(lessons.length - 1, 0) * ROW_H + NODE_SIZE;

  return (
    <View
      style={styles.section}
      onLayout={(e) => onLayout?.(module.id, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
    >
      <UnitBanner
        module={module}
        sectionNumber={sectionNumber}
        locked={locked}
        isCurrent={isCurrentModule}
      />

      <View style={[styles.pathArea, { height: pathHeight }]}>
        {lessons.map((lesson, idx) => {
          if (idx === 0) return null;
          const prevCompleted = lessons[idx - 1]?.is_completed;
          return prevCompleted
            ? <SolidConnector key={`c-${lesson.id}`} index={idx} />
            : <ConnectorDots key={`c-${lesson.id}`} styles={styles} index={idx} />;
        })}
        {lessons.map((lesson, idx) => (
          <RoadmapNode
            key={lesson.id}
            styles={styles}
            lockColor={lockColor}
            index={idx}
            status={statuses[idx]}
            pulse={pulse}
            onPress={() => onLessonPress(lesson, module)}
          />
        ))}
      </View>

      {lessonCount === 0 ? (
        <Text style={styles.emptyPath}>Lessons coming soon</Text>
      ) : null}
    </View>
  );
}

export function getNextLesson(modules) {
  for (const mod of modules) {
    for (const lesson of (mod.lessons || [])) {
      if (!lesson.is_completed) return { lesson, module: mod };
    }
  }
  return null;
}

export function isModuleComplete(mod) {
  const total = mod.lesson_count || (mod.lessons || []).length;
  const done = mod.completed_lesson_count || 0;
  return total > 0 && done >= total;
}

export function getLockedModuleIds(modules) {
  const locked = new Set();
  let prevAllComplete = true;
  for (const mod of modules) {
    if (!prevAllComplete) locked.add(mod.id);
    if (!isModuleComplete(mod)) prevAllComplete = false;
  }
  return locked;
}

export function getCurrentModuleId(modules) {
  for (const mod of modules) {
    if (!isModuleComplete(mod)) return mod.id;
  }
  return null;
}

export default React.memo(function LessonRoadmap({
  modules,
  onLessonPress,
  pulse,
  onSectionLayout,
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const lockColor = isDark ? '#3A3D42' : '#C2C8D0';
  const lockedModuleIds = useMemo(() => getLockedModuleIds(modules), [modules]);
  const currentModuleId = getCurrentModuleId(modules);

  return (
    <View style={styles.roadmap}>
      {modules.map((module, i) => {
        const locked = lockedModuleIds.has(module.id);
        return (
          <ModuleSection
            key={module.id}
            styles={styles}
            lockColor={lockColor}
            module={module}
            sectionNumber={module.order || i + 1}
            isCurrentModule={module.id === currentModuleId}
            locked={locked}
            onLessonPress={onLessonPress}
            pulse={pulse}
            onLayout={onSectionLayout}
          />
        );
      })}
    </View>
  );
});

const makeStyles = (colors) => StyleSheet.create({
  roadmap: { paddingTop: 4 },
  section: { marginBottom: 28 },
  pathArea: { position: 'relative', width: '100%' },
  emptyPath: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    paddingVertical: 16,
  },
  connectorDot: {
    position: 'absolute', width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: colors.textMuted,
  },
  checkBadgeWrap: {
    position: 'absolute',
    top: -2,
    right: -4,
    zIndex: 3,
  },
  glowRing: {
    position: 'absolute',
    width: NODE_SIZE + 26, height: NODE_SIZE + 26,
    borderRadius: (NODE_SIZE + 26) / 2,
  },
  jumpPillWrap: {
    position: 'absolute',
    zIndex: 4,
  },
  jumpPillContent: {
    paddingHorizontal: 4,
  },
  jumpPillText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
});
