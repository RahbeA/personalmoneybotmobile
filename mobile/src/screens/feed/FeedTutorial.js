import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PuckButton from '../../components/PuckButton';

const LOGO = require('../../../assets/logo.png');

/**
 * One-time intro shown the first time a user opens the Feed. Walks through the
 * three tabs, sharing a post, and the per-card menu. Purely presentational —
 * the parent decides when to show it and persists the "seen" flag on done.
 */
const SLIDES = [
  {
    key: 'welcome',
    logo: true,
    kicker: 'WELCOME',
    title: 'This is the Feed',
    body: 'Quick money tips from the MoneyBot community. Scroll, learn, and share your own wins.',
  },
  {
    key: 'tabs',
    icon: 'albums-outline',
    kicker: 'THREE TABS',
    title: 'Feed, MoneyVault & Pending',
    body: 'Feed is the public stream everyone sees. MoneyVault holds your private posts and saved tips. Pending shows posts you submitted that are waiting on review.',
  },
  {
    key: 'share',
    icon: 'add-circle-outline',
    kicker: 'SHARE A TIP',
    title: 'Tap + to post',
    body: 'Snap a photo, add a caption, and choose who sees it: Public posts go live after a quick review, or keep it private in your MoneyVault instantly.',
  },
  {
    key: 'menu',
    icon: 'ellipsis-horizontal',
    kicker: 'EACH POST',
    title: 'Save, share & more',
    body: 'Tap the ••• on any post to save the photo, share a link, or manage your own posts.',
  },
];

export default function FeedTutorial({ visible, colors, onDone }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const next = () => {
    if (isLast) onDone?.();
    else setIndex((i) => i + 1);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <TouchableOpacity
            style={styles.skip}
            onPress={onDone}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          <View style={styles.badge}>
            {slide.logo ? (
              <Image source={LOGO} style={styles.badgeLogo} resizeMode="contain" />
            ) : (
              <Ionicons name={slide.icon} size={30} color="#FFFFFF" />
            )}
          </View>

          <Text style={styles.kicker}>{slide.kicker}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>

          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <View
                key={s.key}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>

          <PuckButton
            color={colors.primary}
            height={54}
            borderRadius={16}
            lip={5}
            onPress={next}
            contentStyle={styles.ctaInner}
          >
            <Text style={styles.ctaText}>{isLast ? 'Got it' : 'Next'}</Text>
            <Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={17} color="#fff" />
          </PuckButton>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 10, 18, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.primaryTint || 'rgba(61,220,95,0.35)',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
    alignItems: 'center',
  },
  skip: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  badge: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 14,
    overflow: 'hidden',
  },
  badgeLogo: {
    width: 60,
    height: 60,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: colors.primary,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
  },
  dots: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 18,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 20,
  },
  ctaInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
